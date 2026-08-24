import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';
import { normalizeBillingCustomerData, saveBillingCustomerData } from '../../billing/BillingCustomerService.js';
import { env } from '../../config/env.js';

const ALLOWED_CYCLES = new Set(['MONTHLY', 'SEMIANNUALLY', 'YEARLY']);

function mapBusinessType(segment: string): string {
  switch (segment) {
    case 'Barbearia': return 'barbershop';
    case 'Clínica de Estética': return 'clinic';
    case 'Estúdio': return 'studio';
    case 'Outro': return 'other';
    default: return 'salon';
  }
}

function planCyclePrice(plan: any, cycle: string): number {
  if (cycle === 'MONTHLY') return Number(plan.price || 0);
  if (cycle === 'SEMIANNUALLY') return Number(plan.semiannualPrice || 0);
  return Number(plan.annualPrice || 0);
}

export default async function createCheckoutHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { salonId, planId, billingCycle, customerData } = req.body || {};
    const selectedCycle = String(billingCycle || 'MONTHLY').toUpperCase();
    if (!salonId || !planId) return res.status(400).json({ success: false, error: 'Informe salonId e planId.' });
    if (!ALLOWED_CYCLES.has(selectedCycle)) return res.status(400).json({ success: false, error: 'Periodicidade inválida.' });

    let user;
    try {
      user = await verifyIdToken(req);
    } catch (err: any) {
      return res.status(401).json({ success: false, error: err.message || 'Não autorizado' });
    }

    const adminDb = getAdminDb();
    const plan = await billingService.getPlan(planId);
    if (plan.active === false || plan.legacy === true) {
      return res.status(400).json({ success: false, code: 'PLAN_UNAVAILABLE', error: 'Este plano não está disponível para novas contratações.' });
    }
    if (plan.customPricing === true || Number(planCyclePrice(plan, selectedCycle)) <= 0) {
      return res.status(400).json({ success: false, code: 'PLAN_CONTACT_SALES', error: 'Este plano requer contato com a equipe comercial.' });
    }

    const salonRef = adminDb.collection('salons').doc(salonId);
    const salonDoc = await salonRef.get();
    let salonData: any;

    if (!salonDoc.exists) {
      // New self-service registration: the client creates the Firebase user first,
      // then this authenticated endpoint creates the tenant before billing starts.
      // The deterministic salon_${uid} id prevents creating a tenant for another user.
      if (salonId !== `salon_${user.uid}`) {
        return res.status(403).json({ success: false, error: 'Identificador de empresa inválido.' });
      }

      const body = req.body || {};
      const now = Date.now();
      const ownerName = String(body.ownerName || body.customerData?.legalName || user.name || '').trim();
      const salonName = String(body.salonName || '').trim();
      const phone = String(body.phone || body.customerData?.mobilePhone || '').trim();
      const email = String(user.email || body.email || '').trim().toLowerCase();
      const city = String(body.city || '').trim();
      const state = String(body.state || '').trim().toUpperCase();
      if (ownerName.length < 2 || salonName.length < 2 || !email) {
        return res.status(422).json({ success: false, code: 'REGISTRATION_DATA_INVALID', error: 'Dados básicos do estabelecimento estão incompletos.' });
      }

      salonData = {
        id: salonId,
        name: salonName,
        ownerName,
        ownerId: user.uid,
        ownerEmail: email,
        phone,
        businessType: mapBusinessType(String(body.businessSegment || '')),
        city,
        state,
        plan: planId,
        subscriptionStatus: 'pending_payment',
        activationStatus: 'pending',
        paymentStatus: 'pending',
        previewEndsAt: now + Number(plan.trialDays || 0) * 24 * 60 * 60 * 1000,
        isActive: false,
        professionalsLimit: Number(plan.maxProfessionals || 0),
        professionalLimit: Number(plan.maxProfessionals || 0),
        maxProfessionals: Number(plan.maxProfessionals || 0),
        billingEmail: email,
        onboardingCompleted: false,
        billing: {
          provider: 'asaas',
          status: 'PENDING_PAYMENT',
          planId,
          billingCycle: selectedCycle,
          value: planCyclePrice(plan, selectedCycle),
          updatedAt: new Date(now).toISOString()
        },
        createdAt: now,
        updatedAt: now
      };

      await salonRef.create(salonData);
      await adminDb.collection('users').doc(user.uid).set({
        id: user.uid,
        email,
        fullName: ownerName,
        name: ownerName,
        phone,
        role: 'owner',
        salonId,
        onboardingStatus: 'pending_payment',
        updatedAt: now
      }, { merge: true });
    } else {
      salonData = salonDoc.data() || {};
    }

    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) return res.status(403).json({ success: false, error: authResult.reason || 'Sem permissão de faturamento para este salão.' });

    if (customerData) {
      await saveBillingCustomerData(salonId, customerData);
      salonData = (await salonRef.get()).data() || {};
    }

    const billingData = salonData.billing || {};
    const document = billingData.document || salonData.document || salonData.cnpj || '';
    if (!document) {
      const completionUrl = `/dashboard/dados-faturamento?salonId=${encodeURIComponent(salonId)}&planId=${encodeURIComponent(planId)}&billingCycle=${encodeURIComponent(selectedCycle)}`;
      return res.status(200).json({ success: true, requiresBillingData: true, checkoutUrl: completionUrl, bankSlipUrl: completionUrl, missingFields: ['document', 'legalName', 'email', 'mobilePhone'] });
    }

    try {
      normalizeBillingCustomerData({
        document,
        legalName: billingData.legalName || salonData.name,
        email: billingData.email || salonData.billingEmail || salonData.ownerEmail,
        mobilePhone: billingData.mobilePhone || salonData.phone || salonData.whatsapp
      });
    } catch (validationError: any) {
      return res.status(422).json({ success: false, code: 'BILLING_DATA_INVALID', error: validationError.message, missingFields: ['document', 'legalName', 'email', 'mobilePhone'] });
    }

    const appUrl = env.app.url.replace(/\/$/, '');
    const paymentCallback = {
      successUrl: `${appUrl}/aguardando-pagamento?payment=success`,
      cancelUrl: `${appUrl}/aguardando-pagamento?payment=cancelled`,
      expiredUrl: `${appUrl}/aguardando-pagamento?payment=expired`,
      autoRedirect: true
    };

    // Semestral/anual são contratos de prazo fechado. No cartão, o Checkout
    // usa INSTALLMENT (parcelamento da compra); no Pix, usa DETACHED (à vista).
    // Não tratamos esses ciclos como assinatura recorrente, pois isso cobraria
    // novamente a cada 6/12 meses e não permitiria o parcelamento desejado.
    if (selectedCycle === 'SEMIANNUALLY' || selectedCycle === 'YEARLY') {
      const termMonths = selectedCycle === 'YEARLY' ? 12 : 6;
      const maxInstallmentCount = termMonths;
      const termEndDate = new Date();
      termEndDate.setMonth(termEndDate.getMonth() + termMonths);
      const checkout = await billingService.createTermCheckout(
        salonId,
        planId,
        selectedCycle as 'SEMIANNUALLY' | 'YEARLY',
        planCyclePrice(plan, selectedCycle),
        {
          ...salonData,
          billing: billingData,
          callback: paymentCallback,
        },
        maxInstallmentCount
      );
      const checkoutUrl = checkout.link || checkout.url || null;
      if (!checkoutUrl) return res.status(502).json({ success: false, error: 'O Asaas criou o checkout, mas não retornou o link de pagamento.', providerCheckoutId: checkout.id });
      await salonRef.update({
        'billing.pendingTermCheckout': true,
        'billing.termMonths': termMonths,
        'billing.termEndDate': termEndDate.toISOString().split('T')[0],
        'billing.installmentCount': maxInstallmentCount,
        'billing.value': planCyclePrice(plan, selectedCycle),
        'billing.billingCycle': selectedCycle,
        'billing.paymentMethod': 'UNDEFINED',
        'billing.checkoutId': checkout.id || null,
        'billing.checkoutUrl': checkoutUrl,
        'billing.status': 'PENDING_PAYMENT',
        'billing.updatedAt': new Date().toISOString(),
      });
      return res.status(200).json({ success: true, checkoutUrl, authorizationUrl: checkoutUrl, providerCheckoutId: checkout.id, billingCycle: selectedCycle, value: planCyclePrice(plan, selectedCycle), termMonths, maxInstallmentCount, termEndDate: termEndDate.toISOString().split('T')[0] });
    }

    const billingType = 'UNDEFINED' as const;
    const subscription = await billingService.createSubscription(
      salonId,
      planId,
      billingType,
      { ...salonData, billing: billingData, callback: paymentCallback },
      undefined,
      undefined,
      selectedCycle as 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY'
    );

    let invoiceUrl: string | null = null;
    try {
      invoiceUrl = await billingService.getSubscriptionInvoiceUrl(subscription.id);
    } catch (err) {
      console.warn('[Asaas] Não foi possível obter a invoiceUrl da assinatura:', err);
    }
    if (!invoiceUrl) {
      return res.status(502).json({ success: false, error: 'A assinatura foi criada, mas o Asaas ainda não disponibilizou uma página de pagamento. Aguarde alguns segundos e tente novamente.', providerSubscriptionId: subscription.id });
    }

    return res.status(200).json({ success: true, checkoutUrl: invoiceUrl, invoiceUrl, bankSlipUrl: invoiceUrl, providerSubscriptionId: subscription.id, returnUrl: paymentCallback.successUrl, billingCycle: selectedCycle });
  } catch (error: any) {
    console.error('[Asaas] Create Checkout Error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 409) return res.status(409).json({ success: false, code: 'CHECKOUT_IN_PROGRESS', error: error.message || 'Já existe uma tentativa de checkout em andamento.' });
    return res.status(500).json({ success: false, error: error?.message || 'Erro interno ao criar pagamento.' });
  }
}

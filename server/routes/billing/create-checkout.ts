import type { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { asaasProvider } from '../../billing/AsaasProvider.js';
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

async function resolveAsaasInvoiceUrl(subscriptionId: string, adminDb: any): Promise<string | null> {
  const settingsDoc = await adminDb.collection('settings').doc('asaas').get();
  const settingsData = settingsDoc.exists ? settingsDoc.data() || {} : {};
  const apiKey = String(settingsData.apiKey || env.asaas.apiKey || '').trim();
  const mode = settingsData.mode === 'production' ? 'production' : 'sandbox';

  if (!apiKey) {
    throw new Error('O serviço de pagamento ainda não está configurado. Configure a chave do Asaas para continuar.');
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const payments = await asaasProvider.getPaymentsBySubscription(mode, apiKey, subscriptionId);
      const payment = payments.find((item: any) => item?.invoiceUrl && ['PENDING', 'OVERDUE'].includes(String(item.status || '').toUpperCase()))
        || payments.find((item: any) => item?.invoiceUrl);
      if (payment?.invoiceUrl) {
        return `${payment.invoiceUrl}${payment.invoiceUrl.includes('?') ? '&' : '?'}autoRedirect=true`;
      }
    } catch (error: any) {
      console.warn(`[Asaas] Falha ao consultar a cobrança da assinatura (tentativa ${attempt + 1}/8):`, error?.message || error);
    }
    if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 1500));
  }
  return null;
}

export default async function createCheckoutHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { salonId, planId, billingCycle, customerData, paymentMethod: rawPaymentMethod } = req.body || {};
    const selectedCycle = String(billingCycle || 'MONTHLY').toUpperCase();
    if (!salonId || !planId) return res.status(400).json({ success: false, error: 'Informe salonId e planId.' });
    if (!ALLOWED_CYCLES.has(selectedCycle)) return res.status(400).json({ success: false, error: 'Periodicidade inválida.' });

    const reqMethod = String(rawPaymentMethod || '').trim().toUpperCase();
    const chosenMethod: 'CREDIT_CARD' | 'PIX' | 'BOLETO' = ['PIX', 'BOLETO'].includes(reqMethod) ? (reqMethod as 'PIX' | 'BOLETO') : 'CREDIT_CARD';

    let user;
    try { user = await verifyIdToken(req); }
    catch (err: any) { return res.status(401).json({ success: false, error: err.message || 'Não autorizado' }); }

    const adminDb = getAdminDb();
    const plan = await billingService.getPlan(planId);
    if (plan.active === false || plan.legacy === true) return res.status(400).json({ success: false, code: 'PLAN_UNAVAILABLE', error: 'Este plano não está disponível para novas contratações.' });
    if (plan.customPricing === true || Number(planCyclePrice(plan, selectedCycle)) <= 0) return res.status(400).json({ success: false, code: 'PLAN_CONTACT_SALES', error: 'Este plano requer contato com a equipe comercial.' });

    const salonRef = adminDb.collection('salons').doc(salonId);
    const salonDoc = await salonRef.get();
    let salonData: any;

    if (!salonDoc.exists) {
      if (salonId !== `salon_${user.uid}`) return res.status(403).json({ success: false, error: 'Identificador de empresa inválido.' });
      const body = req.body || {};
      const now = Date.now();
      const ownerName = String(body.ownerName || body.customerData?.legalName || user.name || '').trim();
      const salonName = String(body.salonName || '').trim() || `Estabelecimento de ${ownerName || 'Novo Usuário'}`;
      const phone = String(body.phone || body.customerData?.mobilePhone || '').trim();
      const email = String(user.email || body.email || '').trim().toLowerCase();
      const city = String(body.city || '').trim();
      const state = String(body.state || '').trim().toUpperCase();
      if (ownerName.length < 2 || !email) return res.status(422).json({ success: false, code: 'REGISTRATION_DATA_INVALID', error: 'Dados básicos incompletos (nome e email são obrigatórios).' });
      salonData = {
        id: salonId, name: salonName, ownerName, ownerId: user.uid, ownerEmail: email, phone,
        businessType: mapBusinessType(String(body.businessSegment || '')), city, state, plan: planId,
        subscriptionStatus: 'pending_payment', activationStatus: 'pending', paymentStatus: 'pending',
        previewEndsAt: now + Number(plan.trialDays || 0) * 24 * 60 * 60 * 1000, isActive: false,
        professionalsLimit: Number(plan.maxProfessionals || 0), professionalLimit: Number(plan.maxProfessionals || 0), maxProfessionals: Number(plan.maxProfessionals || 0),
        billingEmail: email, onboardingCompleted: false,
        billing: { provider: 'asaas', status: 'PENDING_PAYMENT', planId, billingCycle: selectedCycle, value: planCyclePrice(plan, selectedCycle), updatedAt: new Date(now).toISOString() },
        createdAt: now, updatedAt: now
      };
      await salonRef.create(salonData);
      await adminDb.collection('users').doc(user.uid).set({ id: user.uid, email, fullName: ownerName, name: ownerName, phone, role: 'pending', salonId, onboardingStatus: 'pending_payment', updatedAt: now }, { merge: true });
    } else salonData = salonDoc.data() || {};

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
      normalizeBillingCustomerData({ document, legalName: billingData.legalName || salonData.name, email: billingData.email || salonData.billingEmail || salonData.ownerEmail, mobilePhone: billingData.mobilePhone || salonData.phone || salonData.whatsapp });
    } catch (validationError: any) {
      return res.status(422).json({ success: false, code: 'BILLING_DATA_INVALID', error: validationError.message, missingFields: ['document', 'legalName', 'email', 'mobilePhone'] });
    }

    const appUrl = env.app.url.replace(/\/$/, '');
    const paymentCallback = {
      successUrl: `${appUrl}/aguardando-pagamento?payment=success`, cancelUrl: `${appUrl}/aguardando-pagamento?payment=cancelled`, expiredUrl: `${appUrl}/aguardando-pagamento?payment=expired`, autoRedirect: true
    };

    const subscription = await billingService.createSubscription(salonId, planId, chosenMethod, { ...salonData, billing: billingData, callback: paymentCallback }, undefined, undefined, selectedCycle as 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY');

    const invoiceUrl = await resolveAsaasInvoiceUrl(subscription.id, adminDb);
    if (!invoiceUrl) {
      return res.status(502).json({ success: false, code: 'PAYMENT_PAGE_NOT_READY', error: 'A assinatura foi criada, mas o Asaas ainda está preparando a página de pagamento. Aguarde alguns segundos e tente novamente.', providerSubscriptionId: subscription.id });
    }

    return res.status(200).json({ success: true, checkoutUrl: invoiceUrl, invoiceUrl, bankSlipUrl: invoiceUrl, providerSubscriptionId: subscription.id, returnUrl: paymentCallback.successUrl, billingCycle: selectedCycle });
  } catch (error: any) {
    console.error('[Asaas] Create Checkout Error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 409) return res.status(409).json({ success: false, code: 'CHECKOUT_IN_PROGRESS', error: error.message || 'Já existe uma tentativa de checkout em andamento.' });
    const rawMessage = String(error?.message || '').trim();
    const safeMessage = rawMessage.startsWith('Asaas API Error:') ? 'O Asaas recusou a criação do pagamento. Verifique a configuração da conta de pagamentos e tente novamente.' : (rawMessage || 'Erro interno ao criar pagamento.');
    return res.status(500).json({ success: false, error: safeMessage });
  }
}

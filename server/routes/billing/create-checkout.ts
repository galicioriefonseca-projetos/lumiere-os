import type { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { asaasProvider } from '../../billing/AsaasProvider.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';
import { normalizeBillingCustomerData, saveBillingCustomerData } from '../../billing/BillingCustomerService.js';
import { env } from '../../config/env.js';

const ALLOWED_CYCLES = new Set(['MONTHLY', 'SEMIANNUALLY', 'YEARLY']);
const ALLOWED_CHECKOUT_METHODS = new Set(['CREDIT_CARD', 'PIX']);

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

function asaasCheckoutUrl(linkOrId: string, mode: 'sandbox' | 'production') {
  if (!linkOrId) return '';
  if (linkOrId.startsWith('http://') || linkOrId.startsWith('https://')) return linkOrId;
  const host = mode === 'sandbox' ? 'https://sandbox.asaas.com' : 'https://asaas.com';
  return `${host}/checkoutSession/show?id=${encodeURIComponent(linkOrId)}`;
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

    const reqMethod = String(rawPaymentMethod || 'CREDIT_CARD').trim().toUpperCase();
    if (!ALLOWED_CHECKOUT_METHODS.has(reqMethod)) {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_METHOD_UNAVAILABLE',
        error: 'No Checkout online do LumièreOS, estão disponíveis Cartão de Crédito e PIX.'
      });
    }
    const chosenMethod = reqMethod as 'CREDIT_CARD' | 'PIX';

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
        billing: { provider: 'asaas', status: 'PENDING_CHECKOUT', planId, billingCycle: selectedCycle, value: planCyclePrice(plan, selectedCycle), updatedAt: new Date(now).toISOString() },
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

    const settingsDoc = await adminDb.collection('settings').doc('asaas').get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() || {} : {};
    const apiKey = String(settingsData.apiKey || env.asaas.apiKey || '').trim();
    const mode = settingsData.mode === 'production' ? 'production' : 'sandbox';
    if (!apiKey) return res.status(503).json({ success: false, code: 'PAYMENT_NOT_CONFIGURED', error: 'O serviço de pagamento ainda não está configurado. Configure a chave do Asaas para continuar.' });

    // Se já existe um Checkout ativo para a mesma contratação, reaproveitamos o link
    // para impedir cobranças/Checkouts duplicados em cliques repetidos.
    const existingCheckoutId = String(billingData.checkoutId || '');
    if (existingCheckoutId && billingData.checkoutPlanId === planId && (billingData.checkoutBillingCycle || 'MONTHLY') === selectedCycle) {
      try {
        const existingCheckout = await asaasProvider.getCheckout(mode, apiKey, existingCheckoutId);
        if (String(existingCheckout?.status || '').toUpperCase() === 'ACTIVE' && existingCheckout?.link) {
          return res.status(200).json({ success: true, checkoutUrl: existingCheckout.link, invoiceUrl: existingCheckout.link, providerCheckoutId: existingCheckoutId, billingCycle: selectedCycle, reused: true });
        }
      } catch (lookupError: any) {
        console.warn('[Asaas] Não foi possível consultar Checkout anterior; um novo poderá ser criado:', lookupError?.message || lookupError);
      }
    }

    const appUrl = env.app.url.replace(/\/$/, '');
    const paymentCallback = {
      successUrl: `${appUrl}/aguardando-pagamento?payment=success`,
      cancelUrl: `${appUrl}/aguardando-pagamento?payment=cancelled`,
      expiredUrl: `${appUrl}/aguardando-pagamento?payment=expired`
    };

    let customerId = String(billingData.customerId || salonData.asaasCustomerId || '').trim();
    if (!customerId) {
      try {
        customerId = await billingService.ensureCustomer(salonId, salonData);
      } catch (ensureErr: any) {
        console.warn('[Asaas] Tentativa de assegurar customer:', ensureErr?.message || ensureErr);
      }
    }

    const postalCode = String(billingData.postalCode || salonData.postalCode || customerData?.postalCode || '').replace(/\D/g, '');
    const address = String(billingData.address || salonData.address || customerData?.address || '').trim();
    const addressNumber = String(billingData.addressNumber || salonData.addressNumber || customerData?.addressNumber || '').trim();
    const province = String(billingData.province || salonData.province || customerData?.province || '').trim();

    // Se temos dados de endereço completos e o cliente existe, podemos sincronizar previamente
    if (customerId && postalCode && address && addressNumber && province) {
      try {
        await asaasProvider.updateCustomer(mode, apiKey, customerId, {
          postalCode,
          address,
          addressNumber,
          province
        });
      } catch (syncAddrErr: any) {
        console.warn('[Asaas] Aviso ao pré-atualizar endereço do cliente:', syncAddrErr?.message || syncAddrErr);
      }
    }

    const value = planCyclePrice(plan, selectedCycle);
    const checkoutPayload: any = {
      // Para planos recorrentes (subscription), o Asaas Checkout requer exclusivamente CREDIT_CARD
      billingTypes: ['CREDIT_CARD'],
      minutesToExpire: 60,
      externalReference: salonId,
      callback: paymentCallback,
      items: [{
        externalReference: planId,
        name: `LumièreOS — ${plan.name}`,
        description: `Assinatura ${plan.name} (${selectedCycle === 'MONTHLY' ? 'mensal' : selectedCycle === 'SEMIANNUALLY' ? 'semestral' : 'anual'})`,
        quantity: 1,
        value
      }],
      subscription: {
        cycle: selectedCycle,
        nextDueDate: new Date(Date.now() + Math.max(Number(plan.trialDays || 0), 0) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      }
    };

    if (customerId) {
      checkoutPayload.customer = customerId;
    }

    let checkout: any;
    try {
      checkout = await asaasProvider.createRecurringCheckout(mode, apiKey, checkoutPayload);
    } catch (checkoutError: any) {
      const errMsg = String(checkoutError?.message || '');
      const isMissingAddress = errMsg.includes('address deve existir') || errMsg.includes('addressNumber') || errMsg.includes('postalCode') || errMsg.includes('province') || errMsg.includes('city');

      if (isMissingAddress && customerId) {
        console.warn(`[Asaas] Cliente ${customerId} sem endereço cadastrado no Asaas. Sincronizando endereço comercial e reprocessando...`);
        try {
          await asaasProvider.updateCustomer(mode, apiKey, customerId, {
            address: address || salonData.name || 'Endereço Comercial',
            addressNumber: addressNumber || 'S/N',
            postalCode: postalCode.length === 8 ? postalCode : '01001000',
            province: province || 'Centro'
          });
          checkout = await asaasProvider.createRecurringCheckout(mode, apiKey, checkoutPayload);
        } catch (retryWithAddrErr: any) {
          console.warn('[Asaas] Recorrendo à criação do Checkout sem vincular customer prévio para permitir pagamento sem bloqueio:', retryWithAddrErr?.message || retryWithAddrErr);
          delete checkoutPayload.customer;
          checkout = await asaasProvider.createRecurringCheckout(mode, apiKey, checkoutPayload);
        }
      } else {
        throw checkoutError;
      }
    }

    const checkoutUrl = asaasCheckoutUrl(checkout?.link || checkout?.id, mode);
    if (!checkoutUrl) return res.status(502).json({ success: false, code: 'CHECKOUT_LINK_NOT_RETURNED', error: 'O Asaas criou o Checkout, mas não retornou o link de pagamento.' });

    await salonRef.set({
      billing: {
        ...(billingData || {}),
        provider: 'asaas',
        checkoutId: checkout.id || null,
        checkoutUrl,
        checkoutStatus: checkout.status || 'ACTIVE',
        checkoutPlanId: planId,
        checkoutBillingCycle: selectedCycle,
        checkoutPaymentMethod: chosenMethod,
        status: 'PENDING_CHECKOUT',
        planId,
        billingCycle: selectedCycle,
        value,
        updatedAt: new Date().toISOString()
      },
      paymentStatus: 'pending',
      subscriptionStatus: 'pending_payment',
      activationStatus: 'pending',
      isActive: false,
      updatedAt: Date.now()
    }, { merge: true });

    return res.status(200).json({
      success: true,
      checkoutUrl,
      invoiceUrl: checkoutUrl,
      providerCheckoutId: checkout.id,
      returnUrl: paymentCallback.successUrl,
      billingCycle: selectedCycle,
      checkoutStatus: checkout.status || 'ACTIVE'
    });
  } catch (error: any) {
    console.error('[Asaas] Create Checkout Error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 409) return res.status(409).json({ success: false, code: 'CHECKOUT_IN_PROGRESS', error: error.message || 'Já existe uma tentativa de checkout em andamento.' });
    const rawMessage = String(error?.message || '').trim();
    const safeMessage = rawMessage.startsWith('Asaas API Error:') ? 'O Asaas recusou a criação do Checkout. Verifique a configuração da conta de pagamentos e tente novamente.' : (rawMessage || 'Erro interno ao criar pagamento.');
    return res.status(500).json({ success: false, error: safeMessage });
  }
}

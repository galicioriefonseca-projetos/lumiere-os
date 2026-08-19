import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';
import { normalizeBillingCustomerData, saveBillingCustomerData } from '../../billing/BillingCustomerService.js';
import { env } from '../../config/env.js';

const ALLOWED_CYCLES = new Set(['MONTHLY', 'SEMIANNUALLY', 'YEARLY']);

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
    try { user = await verifyIdToken(req); } catch (err: any) { return res.status(401).json({ success: false, error: err.message || 'Não autorizado' }); }
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    if (!salonDoc.exists) return res.status(404).json({ success: false, error: 'Salão não encontrado.' });
    let salonData = salonDoc.data() || {};
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) return res.status(403).json({ success: false, error: authResult.reason || 'Sem permissão de faturamento para este salão.' });

    if (customerData) {
      await saveBillingCustomerData(salonId, customerData);
      salonData = (await adminDb.collection('salons').doc(salonId).get()).data() || {};
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

    const billingType = 'UNDEFINED' as const;
    const appUrl = env.app.url.replace(/\/$/, '');
    const paymentCallback = { successUrl: `${appUrl}/aguardando-pagamento?payment=success`, cancelUrl: `${appUrl}/aguardando-pagamento?payment=cancelled`, expiredUrl: `${appUrl}/aguardando-pagamento?payment=expired`, autoRedirect: true };
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
    try { invoiceUrl = await billingService.getSubscriptionInvoiceUrl(subscription.id); } catch (err) { console.warn('[Asaas] Não foi possível obter a invoiceUrl da assinatura:', err); }
    if (!invoiceUrl) return res.status(502).json({ success: false, error: 'A assinatura foi criada, mas o Asaas ainda não disponibilizou uma página de pagamento. Aguarde alguns segundos e tente novamente.', providerSubscriptionId: subscription.id });
    return res.status(200).json({ success: true, checkoutUrl: invoiceUrl, invoiceUrl, bankSlipUrl: invoiceUrl, providerSubscriptionId: subscription.id, returnUrl: paymentCallback.successUrl, billingCycle: selectedCycle });
  } catch (error: any) {
    console.error('[Asaas] Create Checkout Error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 409) return res.status(409).json({ success: false, code: 'CHECKOUT_IN_PROGRESS', error: error.message || 'Já existe uma tentativa de checkout em andamento.' });
    return res.status(500).json({ success: false, error: error?.message || 'Erro interno ao criar pagamento.' });
  }
}

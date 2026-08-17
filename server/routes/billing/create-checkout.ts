import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';
import { normalizeBillingCustomerData, saveBillingCustomerData } from '../../billing/BillingCustomerService.js';

export default async function createCheckoutHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { salonId, planId, customerData } = req.body || {};

    if (!salonId || !planId) {
      return res.status(400).json({ success: false, error: 'Informe salonId e planId.' });
    }

    let user;
    try {
      user = await verifyIdToken(req);
    } catch (err: any) {
      return res.status(401).json({ success: false, error: err.message || 'Não autorizado' });
    }

    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    if (!salonDoc.exists) {
      return res.status(404).json({ success: false, error: 'Salão não encontrado.' });
    }

    let salonData = salonDoc.data() || {};
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) {
      return res.status(403).json({
        success: false,
        error: authResult.reason || 'Sem permissão de faturamento para este salão.'
      });
    }

    // O checkout nunca deve chegar à Asaas sem CPF/CNPJ. Se o frontend
    // enviar os dados nesta chamada, salvamos e sincronizamos o cliente primeiro.
    if (customerData) {
      await saveBillingCustomerData(salonId, customerData);
      const refreshed = await adminDb.collection('salons').doc(salonId).get();
      salonData = refreshed.data() || {};
    }

    const billingData = salonData.billing || {};
    const document = billingData.document || salonData.document || salonData.cnpj || '';

    // Primeira etapa do fluxo: abrir a tela segura de complementação cadastral.
    // Isso evita mandar uma requisição inválida à Asaas e dá ao usuário a opção
    // de finalizar os dados dentro de Minha Assinatura.
    if (!document) {
      const completionUrl = `/dashboard/dados-faturamento?salonId=${encodeURIComponent(salonId)}&planId=${encodeURIComponent(planId)}`;
      return res.status(200).json({
        success: true,
        requiresBillingData: true,
        checkoutUrl: completionUrl,
        bankSlipUrl: completionUrl,
        missingFields: ['document', 'legalName', 'email', 'mobilePhone']
      });
    }

    // Valida também documentos legados antes de criar qualquer cobrança.
    try {
      normalizeBillingCustomerData({
        document,
        legalName: billingData.legalName || salonData.name,
        email: billingData.email || salonData.billingEmail || salonData.ownerEmail,
        mobilePhone: billingData.mobilePhone || salonData.phone || salonData.whatsapp
      });
    } catch (validationError: any) {
      return res.status(422).json({
        success: false,
        code: 'BILLING_DATA_INVALID',
        error: validationError.message,
        missingFields: ['document', 'legalName', 'email', 'mobilePhone']
      });
    }

    // O checkout hospedado permite que o cliente escolha a forma de pagamento.
    // Nenhum dado de cartão é capturado ou armazenado pelo LumièreOS.
    const billingType = 'UNDEFINED' as const;

    const subscription = await billingService.createSubscription(
      salonId,
      planId,
      billingType,
      { ...salonData, billing: billingData }
    );

    let invoiceUrl: string | null = null;
    try {
      invoiceUrl = await billingService.getSubscriptionInvoiceUrl(subscription.id);
    } catch (err) {
      console.warn('[Asaas] Não foi possível obter a invoiceUrl da assinatura:', err);
    }

    if (!invoiceUrl) {
      return res.status(502).json({
        success: false,
        error: 'A assinatura foi criada, mas o Asaas ainda não disponibilizou uma página de pagamento. Aguarde alguns segundos e tente novamente.',
        providerSubscriptionId: subscription.id
      });
    }

    return res.status(200).json({
      success: true,
      checkoutUrl: invoiceUrl,
      invoiceUrl,
      bankSlipUrl: invoiceUrl,
      providerSubscriptionId: subscription.id
    });
  } catch (error: any) {
    console.error('[Asaas] Create Checkout Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erro interno ao criar pagamento.'
    });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

export default async function asaasUpdatePaymentMethodHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const body = req.body || {};
    const salonId = body.salonId;

    if (!salonId) {
      return res.status(400).json({ error: 'Informe o salonId.' });
    }

    // Pix Automático possui uma jornada de autorização própria e não pode ser
    // tratado como billingType de uma assinatura comum.
    if (body.paymentMethod === 'pix_automatic') {
      return res.status(400).json({
        error: 'Pix Automático utiliza uma jornada própria de autorização e ainda não está disponível nesta tela.'
      });
    }

    // A tela de configuração das próximas mensalidades não coleta cartão no
    // LumièreOS. UNDEFINED faz o Asaas apresentar a página hospedada e permitir
    // que o próprio pagador escolha uma forma de pagamento habilitada na conta.
    const billingType = 'UNDEFINED' as const;

    let user;
    try {
      user = await verifyIdToken(req);
    } catch (err: any) {
      return res.status(401).json({ error: err.message || 'Não autorizado' });
    }

    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    if (!salonDoc.exists) {
      return res.status(404).json({ error: 'Salão não encontrado' });
    }

    const salonData = salonDoc.data();
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) {
      return res.status(403).json({
        error: authResult.reason || 'Sem permissão para alterar a forma de pagamento deste salão.'
      });
    }

    await billingService.updatePaymentMethod(salonId, billingType);

    const subscriptionId = salonData?.billing?.subscriptionId;
    let invoiceUrl: string | null = null;

    if (subscriptionId) {
      try {
        invoiceUrl = await billingService.getSubscriptionInvoiceUrl(subscriptionId);
      } catch (e) {
        console.warn('[Asaas Update Payment Method] Não foi possível obter a fatura pendente:', e);
      }
    }

    return res.status(200).json({
      success: true,
      message: invoiceUrl
        ? 'Configuração atualizada. A página segura do Asaas permitirá escolher a forma de pagamento.'
        : 'Configuração atualizada, mas não há uma cobrança pendente disponível para abrir agora.',
      checkoutUrl: invoiceUrl,
      authorizationUrl: invoiceUrl,
      billingType
    });
  } catch (error: any) {
    console.error('[Asaas Update Payment Method]', error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao atualizar forma de pagamento.'
    });
  }
}

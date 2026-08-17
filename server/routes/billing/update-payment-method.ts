import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

function normalizeBillingType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  const aliases: Record<string, string> = {
    CREDIT_CARD: 'CREDIT_CARD',
    CREDITCARD: 'CREDIT_CARD',
    BOLETO: 'BOLETO',
    PIX: 'PIX'
  };
  return aliases[normalized] || aliases[value.toLowerCase()] || undefined;
}

export default async function asaasUpdatePaymentMethodHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = req.body || {};
    const salonId = body.salonId;
    const billingType = normalizeBillingType(body.billingType || body.paymentMethod);
    const { creditCard, creditCardHolderInfo } = body;

    if (!salonId || !billingType) {
      return res.status(400).json({
        error: 'Informe salonId e uma forma de pagamento válida: CREDIT_CARD, PIX ou BOLETO.'
      });
    }

    // Pix Automático possui uma jornada própria no Asaas e não é um billingType
    // válido para atualização de assinatura. Não enviar esse valor diretamente à API.
    if (body.paymentMethod === 'pix_automatic') {
      return res.status(400).json({
        error: 'Pix Automático utiliza uma jornada de autorização própria e não pode ser configurado como billingType da assinatura.'
      });
    }

    // 1. Autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (err: any) {
      return res.status(401).json({ error: err.message || 'Não autorizado' });
    }

    // 2. Buscar documento do salão
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();

    if (!salonDoc.exists) {
      return res.status(404).json({ error: 'Salão não encontrado' });
    }

    const salonData = salonDoc.data();

    // 3. Autorização de faturamento
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) {
      return res.status(403).json({
        error: authResult.reason || 'Sem permissão para alterar a forma de pagamento deste salão.'
      });
    }

    // 4. Atualizar a assinatura no Asaas.
    await billingService.updatePaymentMethod(
      salonId,
      billingType as any,
      creditCard,
      creditCardHolderInfo
    );

    // 5. Se existir cobrança pendente, devolver a fatura correspondente.
    // Não usar URL fixa de sandbox: a configuração do BillingService já determina
    // se a conta está em sandbox ou produção.
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
      message: 'Forma de pagamento atualizada com sucesso.',
      checkoutUrl: invoiceUrl,
      authorizationUrl: invoiceUrl
    });
  } catch (error: any) {
    console.error('[Asaas Update Payment Method]', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao atualizar forma de pagamento.' });
  }
}

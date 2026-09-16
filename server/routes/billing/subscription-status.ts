import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

export default async function asaasSubscriptionStatusHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { salonId } = req.query;
    if (!salonId || typeof salonId !== 'string') {
      return res.status(400).json({ error: 'salonId é obrigatório' });
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

    // 3. Autorização de Faturamento
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || 'Sem permissão para visualizar o status de assinatura deste salão.' });
    }
    
    const statusData = {
      billingProvider: salonData?.billingProvider || salonData?.billing?.provider || 'asaas',
      subscriptionStatus: salonData?.subscriptionStatus || salonData?.billing?.status || 'unknown',
      paymentStatus: salonData?.paymentStatus || 'unknown',
      status: salonData?.status || 'unknown',
      isActive: salonData?.isActive === true,
      billing: salonData?.billing || null,
      asaasPaymentStatus: salonData?.asaasLastEvent || salonData?.billing?.lastPaymentEvent || null,
      nextBillingDate: salonData?.nextBillingDate || salonData?.billing?.nextDueDate || null,
      asaasCustomerId: salonData?.billing?.customerId || salonData?.asaasCustomerId || null,
      asaasOrderId: salonData?.asaasOrderId || null,
      asaasSubscriptionId: salonData?.billing?.subscriptionId || salonData?.asaasSubscriptionId || null,
      asaasCheckoutUrl: salonData?.billing?.checkoutUrl || salonData?.providerCheckoutUrl || null,
      asaasOfferId: null
    };

    return res.status(200).json(statusData);
  } catch (error: any) {
    console.error('[Asaas Subscription Status]', error);
    return res.status(500).json({ error: error.message });
  }
}

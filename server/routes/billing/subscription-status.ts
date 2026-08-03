import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';

export default async function asaasSubscriptionStatusHandler(req: VercelRequest, res: VercelResponse) {
  try {
    const { salonId } = req.query;
    if (!salonId) {
      return res.status(400).json({ error: 'salonId é obrigatório' });
    }

    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId as string).get();
    
    if (!salonDoc.exists) {
      return res.status(404).json({ error: 'Salão não encontrado' });
    }

    const salonData = salonDoc.data();
    
    const statusData = {
      billingProvider: salonData?.billingProvider || 'unknown',
      subscriptionStatus: salonData?.subscriptionStatus || 'unknown',
      paymentStatus: salonData?.paymentStatus || 'unknown',
      asaasPaymentStatus: salonData?.asaasLastEvent || null,
      nextBillingDate: salonData?.nextBillingDate || null,
      asaasCustomerId: salonData?.asaasCustomerId || null,
      asaasOrderId: salonData?.asaasOrderId || null,
      asaasSubscriptionId: salonData?.asaasSubscriptionId || null,
      asaasCheckoutUrl: null,
      asaasOfferId: null
    };

    return res.status(200).json(statusData);
  } catch (error: any) {
    console.error('[Asaas Subscription Status]', error);
    return res.status(500).json({ error: error.message });
  }
}

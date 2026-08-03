import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';

export default async function asaasRealSubscriptionHandler(req: VercelRequest, res: VercelResponse) {
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
    
    // In a full implementation we would query the Asaas API here
    // asaasProvider.getSubscription(salonData.asaasSubscriptionId)
    // For now we mock the real status based on Firestore to keep UI working
    const mockRealStatus = {
      active: salonData?.subscriptionStatus === 'active',
      status: salonData?.subscriptionStatus || 'unknown',
      provider: 'asaas',
      subscriptionId: salonData?.asaasSubscriptionId
    };

    return res.status(200).json(mockRealStatus);
  } catch (error: any) {
    console.error('[Asaas Real Subscription]', error);
    return res.status(500).json({ error: error.message });
  }
}

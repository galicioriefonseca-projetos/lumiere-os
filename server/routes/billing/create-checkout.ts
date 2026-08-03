import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { Plan } from '../../billing/types.js';

export default async function createCheckoutHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { salonId, planId, billingType } = req.body;
    
    if (!salonId || !planId) {
      return res.status(400).json({ error: 'Missing salonId or planId' });
    }

    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    
    if (!salonDoc.exists) {
      return res.status(404).json({ error: 'Salon not found' });
    }
    
    const salonData = salonDoc.data();

    // Cria a assinatura usando o BillingService
    const subscription = await billingService.createSubscription(
       salonId, 
       planId, 
       billingType || 'CREDIT_CARD', 
       salonData
    );

    
    let invoiceUrl = `https://sandbox.asaas.com/i/${subscription.id}`;
    try {
      const fetchedUrl = await billingService.getSubscriptionInvoiceUrl(subscription.id);
      if (fetchedUrl) invoiceUrl = fetchedUrl;
    } catch(err) {
      console.warn('Could not fetch invoiceUrl from Asaas:', err);
    }
    
    return res.status(200).json({ 
      success: true, 
      bankSlipUrl: invoiceUrl,
      providerSubscriptionId: subscription.id
    });
  
    
  } catch (error: any) {
    console.error('[Asaas] Create Checkout Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

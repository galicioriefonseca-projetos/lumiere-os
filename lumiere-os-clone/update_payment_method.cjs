const fs = require('fs');
let code = `import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';

export default async function asaasUpdatePaymentMethodHandler(req: VercelRequest, res: VercelResponse) {
  try {
    const { salonId, billingType, creditCard, creditCardHolderInfo } = req.body;
    
    if (!salonId || !billingType) {
      return res.status(400).json({ error: 'Missing salonId or billingType' });
    }

    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    
    if (!salonDoc.exists) {
       return res.status(404).json({ error: 'Salon not found' });
    }

    // Call billingService to update the payment method in Asaas
    await billingService.updatePaymentMethod(salonId, billingType, creditCard, creditCardHolderInfo);
    
    // Also try to get the invoice url so they can pay the current pending if there is one
    const salonData = salonDoc.data();
    const subscriptionId = salonData?.billing?.subscriptionId;
    
    let invoiceUrl = \`https://sandbox.asaas.com/i/\${subscriptionId}\`;
    try {
      const fetchedUrl = await billingService.getSubscriptionInvoiceUrl(subscriptionId);
      if (fetchedUrl) invoiceUrl = fetchedUrl;
    } catch(e) {}

    return res.status(200).json({ 
      success: true, 
      checkoutUrl: invoiceUrl
    });
  } catch (error: any) {
    console.error('[Asaas Update Payment Method]', error);
    return res.status(500).json({ error: error.message });
  }
}
`;
fs.writeFileSync('server/routes/billing/update-payment-method.ts', code);

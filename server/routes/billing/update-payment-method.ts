import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

export default async function asaasUpdatePaymentMethodHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { salonId, billingType, creditCard, creditCardHolderInfo } = req.body || {};
    
    if (!salonId || !billingType) {
      return res.status(400).json({ error: 'Missing salonId or billingType' });
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
      return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar a forma de pagamento deste salão.' });
    }

    // Call billingService to update the payment method in Asaas
    await billingService.updatePaymentMethod(salonId, billingType, creditCard, creditCardHolderInfo);
    
    // Also try to get the invoice url so they can pay the current pending if there is one
    const subscriptionId = salonData?.billing?.subscriptionId;
    
    let invoiceUrl = `https://sandbox.asaas.com/i/${subscriptionId}`;
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

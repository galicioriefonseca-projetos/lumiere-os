import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';

export default async function asaasChangePlanHandler(req: VercelRequest, res: VercelResponse) {
  try {
    const { salonId, planId, action } = req.body;
    const adminDb = getAdminDb();
    
    if (action === 'cancel') {
      await adminDb.collection('salons').doc(salonId).update({
        pendingPlanChange: null
      });
      return res.status(200).json({ success: true, message: 'Agendamento cancelado.' });
    }

    if (action === 'schedule' || action === 'change') {
       // Using BillingService to change the plan in Asaas
       const sub = await billingService.changePlan(salonId, planId);
       
       return res.status(200).json({ success: true, message: 'Plano alterado com sucesso no Asaas.', subscription: sub });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error: any) {
    console.error('[Asaas Change Plan]', error);
    return res.status(500).json({ error: error.message });
  }
}

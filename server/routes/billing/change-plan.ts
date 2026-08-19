import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

export default async function asaasChangePlanHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { salonId, planId, action } = req.body || {};
    if (!salonId) return res.status(400).json({ error: 'salonId é obrigatório' });

    let user;
    try {
      user = await verifyIdToken(req);
    } catch (err: any) {
      return res.status(401).json({ error: err.message || 'Não autorizado' });
    }

    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    if (!salonDoc.exists) return res.status(404).json({ error: 'Salão não encontrado' });

    const authResult = await canManageBilling(user, salonId, salonDoc.data());
    if (!authResult.authorized) return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar o plano deste salão.' });

    if (action === 'cancel') {
      await adminDb.collection('salons').doc(salonId).update({ pendingPlanChange: null });
      return res.status(200).json({ success: true, message: 'Agendamento cancelado.' });
    }

    if (action === 'schedule' || action === 'change') {
      if (!planId) return res.status(400).json({ error: 'planId é obrigatório para alterar ou agendar plano' });
      const plan = await billingService.getPlan(planId);
      if (plan.active === false || plan.legacy === true) return res.status(400).json({ error: 'Este plano não está disponível para contratação.' });
      if (plan.customPricing === true || Number(plan.price || 0) <= 0) return res.status(400).json({ error: 'Este plano requer contato com a equipe comercial.' });

      const sub = await billingService.changePlan(salonId, planId);
      return res.status(200).json({ success: true, message: 'Plano alterado com sucesso no Asaas.', subscription: sub });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error: any) {
    console.error('[Asaas Change Plan]', error);
    return res.status(500).json({ error: 'Não foi possível alterar o plano.' });
  }
}

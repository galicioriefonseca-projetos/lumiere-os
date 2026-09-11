import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { BillingService } from '../../billing/BillingService.js';
import { commercialPlan, normalizePlanId } from '../../billing/commercialPlans.js';
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
    const salonRef = adminDb.collection('salons').doc(salonId);
    const salonDoc = await salonRef.get();
    if (!salonDoc.exists) return res.status(404).json({ error: 'Salão não encontrado' });
    const salonData = salonDoc.data() || {};

    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar o plano deste salão.' });
    }

    if (action === 'cancel') {
      await salonRef.update({ pendingPlanChange: null });
      return res.status(200).json({ success: true, message: 'Agendamento cancelado.' });
    }

    if (action !== 'schedule' && action !== 'change') return res.status(400).json({ error: 'Ação inválida' });
    if (!planId) return res.status(400).json({ error: 'planId é obrigatório para alterar ou agendar plano' });

    const normalizedPlanId = normalizePlanId(String(planId));
    const plan = commercialPlan(normalizedPlanId);
    if (!plan) return res.status(404).json({ error: `Plano ${planId} não encontrado no catálogo comercial.` });
    if (plan.customPricing) return res.status(400).json({ error: 'Este plano requer contato com a equipe comercial.' });

    // Toda alteração passa pelo BillingService para manter uma única regra de
    // faturamento. A troca fica pendente até confirmação financeira pelo webhook.
    const billingService = new BillingService();
    const subscription = await billingService.changePlan(salonId, normalizedPlanId);

    return res.status(200).json({
      success: true,
      status: 'PENDING_PAYMENT',
      message: 'Solicitação de alteração registrada. O novo plano será ativado após a confirmação do pagamento.',
      subscription,
    });
  } catch (error: any) {
    console.error('[Asaas Change Plan]', error);
    return res.status(500).json({ error: error?.message || 'Não foi possível alterar o plano.' });
  }
}

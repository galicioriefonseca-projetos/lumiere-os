import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { asaasProvider } from '../../billing/AsaasProvider.js';
import { BillingCycle } from '../../billing/types.js';
import { commercialPlan, commercialPlanPrice, normalizePlanId } from '../../billing/commercialPlans.js';
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
    try { user = await verifyIdToken(req); }
    catch (err: any) { return res.status(401).json({ error: err.message || 'Não autorizado' }); }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection('salons').doc(salonId);
    const salonDoc = await salonRef.get();
    if (!salonDoc.exists) return res.status(404).json({ error: 'Salão não encontrado' });
    const salonData = salonDoc.data() || {};

    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar o plano deste salão.' });

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

    const subscriptionId = salonData?.billing?.subscriptionId;
    if (!subscriptionId) return res.status(409).json({ error: 'Esta conta ainda não possui uma assinatura Asaas ativa. Configure o pagamento primeiro.' });

    const settingsDoc = await adminDb.collection('settings').doc('asaas').get();
    const settings = settingsDoc.data() || {};
    const mode = (settings.mode || 'production') as 'sandbox' | 'production';
    const apiKey = String(settings.apiKey || '');
    if (!apiKey) return res.status(500).json({ error: 'Asaas não está configurado.' });

    const cycle = String(salonData?.billing?.billingCycle || 'MONTHLY').toUpperCase() as BillingCycle;
    const value = commercialPlanPrice(normalizedPlanId, cycle);
    if (!value || value <= 0) return res.status(400).json({ error: `O plano ${normalizedPlanId} não possui preço válido para a periodicidade ${cycle}.` });

    const subscription = await asaasProvider.updateSubscription(mode, apiKey, subscriptionId, {
      value,
      cycle,
      description: `Assinatura ${plan.name} - LumièreOS`,
      updatePendingPayments: true,
    });

    await salonRef.update({
      'billing.planId': normalizedPlanId,
      'billing.value': value,
      'billing.billingCycle': cycle,
      'billing.nextDueDate': subscription.nextDueDate,
      'billing.paymentMethod': subscription.billingType,
      'billing.providerStatus': subscription.status,
      'billing.updatedAt': new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: 'Plano alterado com sucesso no Asaas.', subscription });
  } catch (error: any) {
    console.error('[Asaas Change Plan]', error);
    return res.status(500).json({ error: error?.message || 'Não foi possível alterar o plano.' });
  }
}

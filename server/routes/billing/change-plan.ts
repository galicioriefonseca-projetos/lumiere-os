import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { asaasProvider } from '../../billing/AsaasProvider.js';
import { BillingService } from '../../billing/BillingService.js';
import { BillingCycle, PaymentMethod } from '../../billing/types.js';
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
    const isCancelledLocally = salonData?.billing?.status === 'CANCELLED' || salonData?.billing?.providerStatus === 'INACTIVE';

    const settingsDoc = await adminDb.collection('settings').doc('asaas').get();
    const settings = settingsDoc.data() || {};
    let apiKey = String(settings.apiKey || '');
    const secondIndex = apiKey.indexOf('$aact_', 1);
    if (secondIndex > 0) apiKey = apiKey.slice(0, secondIndex).trim();
    if (!apiKey) return res.status(500).json({ error: 'Asaas não está configurado.' });
    const mode = (settings.mode || (apiKey.startsWith('$aact_prod_') ? 'production' : 'sandbox')) as 'sandbox' | 'production';

    const cycle = String(salonData?.billing?.billingCycle || 'MONTHLY').toUpperCase() as BillingCycle;
    const value = commercialPlanPrice(normalizedPlanId, cycle);
    if (!value || value <= 0) return res.status(400).json({ error: `O plano ${normalizedPlanId} não possui preço válido para a periodicidade ${cycle}.` });

    let subscription: any = null;

    if (subscriptionId && !isCancelledLocally) {
      try {
        subscription = await asaasProvider.updateSubscription(mode, apiKey, subscriptionId, {
          value,
          cycle,
          description: `Assinatura ${plan.name} - LumièreOS`,
          updatePendingPayments: true,
        });
      } catch (updateErr: any) {
        const errMsg = String(updateErr?.message || updateErr);
        if (errMsg.includes('404')) {
          console.warn(`[Asaas Change Plan] Assinatura ${subscriptionId} não encontrada no Asaas (404). Criando nova assinatura para o salão...`);
          subscription = null;
        } else {
          throw updateErr;
        }
      }
    }

    if (!subscription) {
      const billingService = new BillingService();
      const customerId = await billingService.ensureCustomer(salonId, salonData);

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + (plan.trialDays || 3));

      const rawMethod = String(salonData?.billing?.paymentMethod || '').toUpperCase();
      const billingType = (rawMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD') as PaymentMethod;

      subscription = await asaasProvider.createSubscription(mode, apiKey, {
        customer: customerId,
        billingType,
        value,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        cycle,
        description: `Assinatura ${plan.name} - LumièreOS`,
        externalReference: salonId,
      });
    }

    await salonRef.update({
      'billing.provider': 'asaas',
      'billing.subscriptionId': subscription.id,
      'billing.customerId': subscription.customer || salonData?.billing?.customerId,
      'billing.planId': normalizedPlanId,
      'billing.value': value,
      'billing.billingCycle': cycle,
      'billing.status': 'ACTIVE',
      'billing.nextDueDate': subscription.nextDueDate,
      'billing.paymentMethod': subscription.billingType,
      'billing.providerStatus': subscription.status,
      'billing.updatedAt': new Date().toISOString(),
      'plan': normalizedPlanId,
    });

    return res.status(200).json({ success: true, message: 'Plano alterado com sucesso no Asaas.', subscription });
  } catch (error: any) {
    console.error('[Asaas Change Plan]', error);
    return res.status(500).json({ error: error?.message || 'Não foi possível alterar o plano.' });
  }
}

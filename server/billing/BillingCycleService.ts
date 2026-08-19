import { getAdminDb } from '../shared/firebaseAdmin.js';
import { asaasProvider } from './AsaasProvider.js';
import { BillingCycle } from './types.js';
import { commercialPlan, commercialPlanPrice, normalizePlanId } from './commercialPlans.js';
import { env } from '../config/env.js';

interface BillingSettings {
  mode: 'sandbox' | 'production';
  apiKey: string;
  webhookToken: string;
}

async function getSettings(): Promise<BillingSettings> {
  const db = getAdminDb();
  const snap = await db.collection('settings').doc('asaas').get();
  if (snap.exists && snap.data()?.apiKey) return snap.data() as BillingSettings;
  return { mode: 'sandbox', apiKey: env.asaas.apiKey || '', webhookToken: env.asaas.webhookToken || '' };
}

export async function changeBillingCycle(salonId: string, cycle: BillingCycle) {
  const db = getAdminDb();
  const salonRef = db.collection('salons').doc(salonId);
  const salonSnap = await salonRef.get();
  if (!salonSnap.exists) throw new Error('Salão não encontrado.');

  const salon = salonSnap.data() || {};
  const billing = salon.billing || {};
  const subscriptionId = billing.subscriptionId;
  if (!subscriptionId) throw new Error('Nenhuma assinatura Asaas encontrada.');

  const planId = normalizePlanId(String(billing.planId || salon.plan || ''));
  const plan = commercialPlan(planId);
  if (!plan) throw new Error(`Plano ${planId || 'atual'} não encontrado no catálogo comercial.`);
  if (plan.customPricing) throw new Error('Este plano não pode ser alterado automaticamente.');

  const value = commercialPlanPrice(planId, cycle);
  if (!value || value <= 0) throw new Error(`O plano ${plan.name} não possui preço configurado para esta periodicidade.`);

  const settings = await getSettings();
  const remote = await asaasProvider.getSubscription(settings.mode, settings.apiKey, subscriptionId);
  if (!remote || remote.status !== 'ACTIVE') throw new Error('A assinatura Asaas não está ativa.');

  const currentCycle = (remote.cycle || billing.billingCycle || 'MONTHLY') as BillingCycle;
  if (currentCycle === cycle && Math.abs(Number(remote.value) - value) < 0.01) return { value, subscription: remote };

  const subscription = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, {
    value,
    cycle,
    description: `Assinatura ${plan.name} - LumièreOS`,
    updatePendingPayments: false,
    externalReference: salonId,
  });

  await salonRef.update({
    'billing.planId': planId,
    'billing.billingCycle': cycle,
    'billing.value': value,
    'billing.nextDueDate': subscription.nextDueDate || billing.nextDueDate || null,
    'billing.updatedAt': new Date().toISOString(),
  });

  return { value, subscription };
}

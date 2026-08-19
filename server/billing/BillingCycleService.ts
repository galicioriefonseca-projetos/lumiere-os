import { getAdminDb } from '../shared/firebaseAdmin.js';
import { asaasProvider } from './AsaasProvider.js';
import { BillingCycle } from './types.js';
import { env } from '../config/env.js';

interface BillingSettings {
  mode: 'sandbox' | 'production';
  apiKey: string;
  webhookToken: string;
}

function resolveCyclePrice(plan: any, cycle: BillingCycle): number {
  if (cycle === 'MONTHLY') return Number(plan.price);
  if (cycle === 'SEMIANNUALLY') return Number(plan.semiannualPrice || 0);
  return Number(plan.annualPrice || 0);
}

async function getSettings(): Promise<BillingSettings> {
  const db = getAdminDb();
  const snap = await db.collection('settings').doc('asaas').get();
  if (snap.exists && snap.data()?.apiKey) return snap.data() as BillingSettings;
  return {
    mode: 'sandbox',
    apiKey: env.asaas.apiKey || '',
    webhookToken: env.asaas.webhookToken || ''
  };
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

  const planId = billing.planId || salon.plan;
  if (!planId) throw new Error('Plano atual não identificado.');

  const planSnap = await db.collection('plans').doc(planId).get();
  if (!planSnap.exists) throw new Error('Plano atual não encontrado.');
  const plan = { id: planSnap.id, ...planSnap.data() } as any;
  if (plan.customPricing || plan.legacy) throw new Error('Este plano não pode ser alterado automaticamente.');

  const value = resolveCyclePrice(plan, cycle);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`O plano ${plan.name || planId} não possui preço configurado para esta periodicidade.`);
  }

  const settings = await getSettings();
  const remote = await asaasProvider.getSubscription(settings.mode, settings.apiKey, subscriptionId);
  if (!remote || remote.status !== 'ACTIVE') throw new Error('A assinatura Asaas não está ativa.');

  const currentCycle = (remote.cycle || billing.billingCycle || 'MONTHLY') as BillingCycle;
  if (currentCycle === cycle && Math.abs(Number(remote.value) - value) < 0.01) {
    return { value, subscription: remote };
  }

  // Do not update pending invoices: the current charge, if already generated,
  // remains governed by its original terms. The new cycle/value applies to future charges.
  const subscription = await asaasProvider.updateSubscription(
    settings.mode,
    settings.apiKey,
    subscriptionId,
    {
      value,
      cycle,
      description: `Assinatura ${plan.name} - LumièreOS`,
      updatePendingPayments: false,
      externalReference: salonId
    }
  );

  await salonRef.update({
    'billing.billingCycle': cycle,
    'billing.value': value,
    'billing.nextDueDate': subscription.nextDueDate || billing.nextDueDate || null,
    'billing.updatedAt': new Date().toISOString()
  });

  return { value, subscription };
}

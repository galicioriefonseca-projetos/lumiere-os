import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../server/shared/firebaseAdmin.js';
import { verifyIdToken, resolvePlatformAdmin } from '../../server/shared/auth.js';
import { billingService } from '../../server/billing/BillingService.js';

const ALLOWED_EVENTS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_CANCELLED',
  'SUBSCRIPTION_DELETED',
]);

function makeId(prefix: string) {
  return `${prefix}_sim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const user = await verifyIdToken(req);
    const adminDb = getAdminDb();
    if (!(await resolvePlatformAdmin(user, adminDb))) {
      return res.status(403).json({ error: 'Somente o Platform Admin pode executar simulações de billing.' });
    }

    const { salonId, event, paymentStatus, planId, billingCycle } = req.body || {};
    if (!salonId) return res.status(400).json({ error: 'salonId é obrigatório.' });

    const simulatedEvent = String(event || '').toUpperCase();
    if (!ALLOWED_EVENTS.has(simulatedEvent)) {
      return res.status(400).json({ error: 'Evento de teste inválido.', allowedEvents: [...ALLOWED_EVENTS] });
    }

    const salonRef = adminDb.collection('salons').doc(String(salonId));
    const salonSnap = await salonRef.get();
    if (!salonSnap.exists) return res.status(404).json({ error: 'Salão não encontrado.' });

    const salon = salonSnap.data() || {};
    const billing = salon.billing || {};
    const customerId = billing.customerId || salon.asaasCustomerId;
    if (!customerId) {
      return res.status(422).json({ error: 'O salão não possui customerId do Asaas. A simulação não cria cliente nem chama a API do Asaas.' });
    }

    const subscriptionId = billing.subscriptionId || makeId('sub');
    const resolvedPlanId = String(planId || billing.planId || 'essential');
    const resolvedCycle = String(billingCycle || billing.billingCycle || 'MONTHLY').toUpperCase();
    const resolvedValue = Number(billing.value || 197);
    const dueDate = billing.nextDueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const payload: any = {
      id: makeId('evt'),
      customer: customerId,
      subscription: {
        id: subscriptionId,
        customer: customerId,
        status: simulatedEvent === 'SUBSCRIPTION_CANCELLED' || simulatedEvent === 'SUBSCRIPTION_DELETED' ? 'CANCELED' : 'ACTIVE',
        value: resolvedValue,
        cycle: resolvedCycle,
        nextDueDate: dueDate,
        billingType: billing.paymentMethod || 'UNDEFINED',
      },
      payment: {
        id: makeId('pay'),
        customer: customerId,
        subscription: subscriptionId,
        value: resolvedValue,
        dueDate,
        billingType: billing.paymentMethod || 'UNDEFINED',
        status: paymentStatus || (simulatedEvent === 'PAYMENT_OVERDUE' ? 'OVERDUE' : 'RECEIVED'),
      },
      simulation: {
        source: 'lumiere-master',
        planId: resolvedPlanId,
        billingCycle: resolvedCycle,
        createdAt: new Date().toISOString(),
      },
    };

    await billingService.handleWebhook(simulatedEvent, payload);

    return res.status(200).json({
      success: true,
      simulated: true,
      event: simulatedEvent,
      salonId,
      planId: resolvedPlanId,
      billingCycle: resolvedCycle,
      message: 'Webhook simulado processado localmente. Nenhuma chamada foi feita à API do Asaas.',
    });
  } catch (error: any) {
    console.error('[Billing Webhook Test]', error);
    return res.status(500).json({ error: error?.message || 'Falha ao executar a simulação.' });
  }
}

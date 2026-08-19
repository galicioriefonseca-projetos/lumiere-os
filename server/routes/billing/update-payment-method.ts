import { VercelRequest, VercelResponse } from '@vercel/node';
import { billingService } from '../../billing/BillingService.js';
import { asaasProvider } from '../../billing/AsaasProvider.js';
import { BillingCycle, PaymentMethod } from '../../billing/types.js';
import { env } from '../../config/env.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

const LEGACY_PLAN_MAP: Record<string, string> = {
  start: 'essential',
  founder: 'professional',
  performance: 'performance_plus',
  network: 'multiunit',
  enterprise: 'enterprise_custom'
};

function toCycle(value: unknown): BillingCycle {
  const normalized = String(value || 'MONTHLY').toUpperCase();
  if (normalized === 'SEMIANNUALLY' || normalized === 'YEARLY') return normalized;
  return 'MONTHLY';
}

function nextCycleDate(input: Date, cycle: BillingCycle): Date {
  const result = new Date(input);
  const months = cycle === 'YEARLY' ? 12 : cycle === 'SEMIANNUALLY' ? 6 : 1;
  result.setMonth(result.getMonth() + months);
  return result;
}

function resolveNextDueDate(salonData: any, cycle: BillingCycle): string {
  const candidates = [salonData?.billing?.nextDueDate, salonData?.billing?.nextBillingDate, salonData?.nextBillingDate];
  let candidate: Date | null = null;
  for (const value of candidates) {
    if (value === undefined || value === null || value === '') continue;
    const parsed = new Date(typeof value === 'number' ? value : String(value));
    if (!Number.isNaN(parsed.getTime())) { candidate = parsed; break; }
  }

  if (!candidate) {
    const lastPayment = salonData?.lastPaymentAt || salonData?.billing?.lastPaymentDate;
    if (lastPayment) {
      const parsed = new Date(typeof lastPayment === 'number' ? lastPayment : String(lastPayment));
      if (!Number.isNaN(parsed.getTime())) candidate = nextCycleDate(parsed, cycle);
    }
  }

  if (!candidate) throw new Error('Não foi possível determinar o próximo vencimento do ciclo já pago. Atualize a data de próxima cobrança antes de migrar para o Asaas.');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (candidate <= today) candidate = nextCycleDate(candidate, cycle);
  return candidate.toISOString().split('T')[0];
}

async function getAsaasSettings() {
  const adminDb = getAdminDb();
  const doc = await adminDb.collection('settings').doc('asaas').get();
  const data = doc.exists ? doc.data() || {} : {};
  return { mode: (data.mode || 'sandbox') as 'sandbox' | 'production', apiKey: String(data.apiKey || env.asaas.apiKey || '') };
}

export default async function asaasUpdatePaymentMethodHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const body = req.body || {};
    const salonId = body.salonId;
    if (!salonId) return res.status(400).json({ error: 'Informe o salonId.' });
    if (body.paymentMethod === 'pix_automatic') return res.status(400).json({ error: 'Pix Automático utiliza uma jornada própria de autorização e ainda não está disponível nesta tela.' });

    let user;
    try { user = await verifyIdToken(req); } catch (err: any) { return res.status(401).json({ error: err.message || 'Não autorizado' }); }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection('salons').doc(salonId);
    const salonDoc = await salonRef.get();
    if (!salonDoc.exists) return res.status(404).json({ error: 'Salão não encontrado' });

    const salonData = salonDoc.data() || {};
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar a forma de pagamento deste salão.' });

    const existingSubscriptionId = salonData?.billing?.subscriptionId || salonData?.providerSubscriptionId;

    // Migração segura de clientes que já pagaram manualmente e ainda não possuem assinatura Asaas.
    if (!existingSubscriptionId) {
      const isManualPaid = Boolean(
        salonData?.billingProvider === 'manual' ||
        salonData?.billingProvider === 'manual_pix' ||
        salonData?.paymentStatus === 'paid' ||
        salonData?.lastPaymentAt ||
        salonData?.billing?.lastPaymentDate
      );
      if (!isManualPaid) return res.status(409).json({ error: 'Esta conta ainda não possui uma assinatura Asaas nem um pagamento manual identificado. Conclua o checkout inicial antes de configurar a forma de pagamento.' });

      const requestedPlanId = String(body.planId || salonData?.billing?.planId || salonData?.plan || 'professional');
      const planId = LEGACY_PLAN_MAP[requestedPlanId] || requestedPlanId;
      const plan = await billingService.getPlan(planId);
      const cycle = toCycle(body.billingCycle || salonData?.billing?.billingCycle || 'MONTHLY');
      const value = cycle === 'MONTHLY' ? Number(plan.price) : cycle === 'SEMIANNUALLY' ? Number(plan.semiannualPrice || 0) : Number(plan.annualPrice || 0);
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: `O plano ${planId} não possui preço válido para a periodicidade ${cycle}.` });

      const nextDueDate = resolveNextDueDate(salonData, cycle);
      const settings = await getAsaasSettings();
      if (!settings.apiKey) return res.status(500).json({ error: 'Asaas não está configurado no ambiente de produção.' });

      const customerId = await billingService.ensureCustomer(salonId, salonData);
      const description = `Assinatura ${plan.name} - LumièreOS`;
      const remote = await asaasProvider.listSubscriptions(settings.mode, settings.apiKey, { customer: customerId, externalReference: salonId });
      const compatible = remote.find(sub => sub.status === 'ACTIVE' && (sub.cycle || 'MONTHLY') === cycle && Math.abs(Number(sub.value) - value) < 0.01 && sub.description === description);

      if (compatible) {
        await salonRef.update({
          'billing.provider': 'asaas', 'billing.customerId': customerId, 'billing.subscriptionId': compatible.id,
          'billing.planId': planId, 'billing.billingCycle': cycle, 'billing.value': value, 'billing.nextDueDate': compatible.nextDueDate,
          'billing.providerStatus': compatible.status, 'billing.paymentMethod': compatible.billingType, 'billing.migrationSource': 'manual_payment',
          'billing.updatedAt': new Date().toISOString(), asaasCustomerId: customerId, providerSubscriptionId: compatible.id
        });
        return res.status(200).json({ success: true, migrated: true, subscriptionId: compatible.id, nextDueDate: compatible.nextDueDate, billingType: compatible.billingType, checkoutUrl: null });
      }

      const requestedBillingType = String(body.billingType || 'UNDEFINED').toUpperCase() as PaymentMethod;
      const billingType: PaymentMethod = requestedBillingType === 'CREDIT_CARD' && body.creditCard && body.creditCardHolderInfo ? 'CREDIT_CARD' : 'UNDEFINED';
      const payload: any = { customer: customerId, billingType, value, nextDueDate, cycle, description, externalReference: salonId };
      if (billingType === 'CREDIT_CARD') {
        payload.creditCard = body.creditCard;
        payload.creditCardHolderInfo = body.creditCardHolderInfo;
        if (body.remoteIp) payload.remoteIp = body.remoteIp;
        if (body.creditCardToken) payload.creditCardToken = body.creditCardToken;
      }

      const lockRef = adminDb.collection('billing_checkout_locks').doc(salonId);
      const lockToken = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await adminDb.runTransaction(async transaction => {
        const lockSnapshot = await transaction.get(lockRef);
        if (lockSnapshot.exists) {
          const createdAt = Number(lockSnapshot.data()?.createdAtMs || 0);
          if (createdAt && Date.now() - createdAt < 5 * 60 * 1000) throw new Error('CHECKOUT_LOCKED');
        }
        transaction.set(lockRef, { token: lockToken, salonId, planId, billingCycle: cycle, value, migration: true, createdAtMs: Date.now() });
      });

      try {
        // Não abrir invoiceUrl nesta migração: o Asaas informa que adicionar
        // cartão depois de criar a assinatura sem cartão pode cobrar imediatamente.
        const sub = await asaasProvider.createSubscription(settings.mode, settings.apiKey, payload);
        await salonRef.update({
          'billing.provider': 'asaas', 'billing.customerId': customerId, 'billing.subscriptionId': sub.id,
          'billing.planId': planId, 'billing.billingCycle': cycle, 'billing.value': value,
          'billing.nextDueDate': sub.nextDueDate || nextDueDate, 'billing.providerStatus': sub.status,
          'billing.paymentMethod': billingType, 'billing.migrationSource': 'manual_payment',
          'billing.migrationPreviousPaymentAt': salonData?.lastPaymentAt || salonData?.billing?.lastPaymentDate || null,
          'billing.migrationPreviousPaymentAmount': salonData?.lastPaymentAmount || null,
          'billing.updatedAt': new Date().toISOString(), asaasCustomerId: customerId, providerSubscriptionId: sub.id
        });
        return res.status(200).json({
          success: true, migrated: true, subscriptionId: sub.id, nextDueDate: sub.nextDueDate || nextDueDate, billingType, checkoutUrl: null,
          message: billingType === 'CREDIT_CARD'
            ? 'Assinatura migrada. O cartão foi validado e a primeira cobrança ocorrerá no próximo vencimento do ciclo.'
            : 'Assinatura migrada sem cobrança imediata. A forma de pagamento será configurada na cobrança do próximo ciclo.'
        });
      } finally {
        const currentLock = await lockRef.get();
        if (currentLock.exists && currentLock.data()?.token === lockToken) await lockRef.delete();
      }
    }

    const billingType = 'UNDEFINED' as const;
    await billingService.updatePaymentMethod(salonId, billingType);
    const subscriptionId = salonData?.billing?.subscriptionId;
    let invoiceUrl: string | null = null;
    if (subscriptionId) {
      try { invoiceUrl = await billingService.getSubscriptionInvoiceUrl(subscriptionId); }
      catch (e) { console.warn('[Asaas Update Payment Method] Não foi possível obter a fatura pendente:', e); }
    }

    return res.status(200).json({ success: true, message: invoiceUrl ? 'Configuração atualizada. A página segura do Asaas permitirá escolher a forma de pagamento.' : 'Configuração atualizada, mas não há uma cobrança pendente disponível para abrir agora.', checkoutUrl: invoiceUrl, authorizationUrl: invoiceUrl, billingType });
  } catch (error: any) {
    if (error?.message === 'CHECKOUT_LOCKED') return res.status(409).json({ error: 'Já existe uma tentativa de migração em andamento. Aguarde alguns segundos e tente novamente.' });
    console.error('[Asaas Update Payment Method]', error);
    return res.status(500).json({ error: error?.message || 'Erro interno ao atualizar forma de pagamento.' });
  }
}

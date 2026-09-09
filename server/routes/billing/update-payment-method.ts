import { VercelRequest, VercelResponse } from '@vercel/node';
import { asaasProvider } from '../../billing/AsaasProvider.js';
import { BillingService } from '../../billing/BillingService.js';
import { BillingCycle, PaymentMethod } from '../../billing/types.js';
import { commercialPlan, commercialPlanPrice, normalizePlanId } from '../../billing/commercialPlans.js';
import { env } from '../../config/env.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

function toCycle(value: unknown): BillingCycle {
  const normalized = String(value || 'MONTHLY').toUpperCase();
  return normalized === 'SEMIANNUALLY' || normalized === 'YEARLY' ? normalized : 'MONTHLY';
}

function nextCycleDate(input: Date, cycle: BillingCycle): Date {
  const result = new Date(input);
  result.setMonth(result.getMonth() + (cycle === 'YEARLY' ? 12 : cycle === 'SEMIANNUALLY' ? 6 : 1));
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
  if (!candidate) throw new Error('Não foi possível determinar o próximo vencimento. Atualize a data de próxima cobrança antes de configurar o pagamento.');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (candidate <= today) candidate = nextCycleDate(candidate, cycle);
  return candidate.toISOString().split('T')[0];
}

function buildCustomerData(salonData: any) {
  const billing = salonData?.billing || {};
  return {
    name: billing.legalName || salonData?.name || 'Cliente LumièreOS',
    email: billing.email || salonData?.billingEmail || salonData?.ownerEmail || '',
    cpfCnpj: billing.document || salonData?.document || salonData?.cnpj || '',
    phone: billing.mobilePhone || salonData?.phone || salonData?.whatsapp || '',
    mobilePhone: billing.mobilePhone || salonData?.phone || salonData?.whatsapp || '',
    postalCode: billing.postalCode || salonData?.postalCode || '',
    address: billing.address || salonData?.address || '',
    addressNumber: billing.addressNumber || salonData?.addressNumber || '',
    complement: billing.complement || salonData?.complement || '',
    province: billing.province || salonData?.province || '',
    city: billing.city || salonData?.city || '',
  };
}

async function getSettings() {
  const db = getAdminDb();
  const doc = await db.collection('settings').doc('asaas').get();
  const data = doc.exists ? doc.data() || {} : {};
  let rawKey = String(data.apiKey || env.asaas.apiKey || '');
  const secondIndex = rawKey.indexOf('$aact_', 1);
  if (secondIndex > 0) rawKey = rawKey.slice(0, secondIndex).trim();
  const mode = (data.mode || (rawKey.startsWith('$aact_prod_') ? 'production' : 'sandbox')) as 'sandbox' | 'production';
  return { mode, apiKey: rawKey };
}

export default async function asaasUpdatePaymentMethodHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const body = req.body || {};
    const salonId = String(body.salonId || '');
    const requested = String(body.paymentMethod || '').trim().toUpperCase();
    let paymentMethod: PaymentMethod | '' = '';
    if (requested === 'CREDIT_CARD' || requested === 'CARTAO' || requested === 'CARTÃO' || requested === 'CARD') {
      paymentMethod = 'CREDIT_CARD';
    } else if (requested === 'PIX' || requested === 'PIX_AUTOMATIC') {
      paymentMethod = 'PIX';
    } else if (requested === 'BOLETO') {
      return res.status(400).json({ error: 'A forma de pagamento Boleto não está disponível. Escolha Cartão de Crédito ou Pix.' });
    }

    if (!salonId) return res.status(400).json({ error: 'Informe o salonId.' });
    if (!paymentMethod) return res.status(400).json({ error: 'Forma de pagamento inválida. Escolha Cartão de Crédito ou Pix.' });

    let user;
    try { user = await verifyIdToken(req); }
    catch (err: any) { return res.status(401).json({ error: err.message || 'Não autorizado' }); }

    const db = getAdminDb();
    const salonRef = db.collection('salons').doc(salonId);
    const salonDoc = await salonRef.get();
    if (!salonDoc.exists) return res.status(404).json({ error: 'Salão não encontrado.' });
    const salonData = salonDoc.data() || {};
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar a forma de pagamento.' });

    const settings = await getSettings();
    if (!settings.apiKey) return res.status(500).json({ error: 'Asaas não está configurado.' });

    const subscriptionId = salonData?.billing?.subscriptionId || salonData?.providerSubscriptionId;
    let validRemoteSubscription = false;

    if (subscriptionId && salonData?.billing?.status !== 'CANCELLED') {
      try {
        const remote = await asaasProvider.getSubscription(settings.mode, settings.apiKey, subscriptionId);
        if (remote && remote.status !== 'INACTIVE') {
          validRemoteSubscription = true;
        }
      } catch (err: any) {
        console.warn(`[update-payment-method] Assinatura ${subscriptionId} não encontrada no Asaas (404).`);
      }
    }

    if (subscriptionId && validRemoteSubscription) {
      if (paymentMethod === 'CREDIT_CARD') {
        const creditCardToken = body.creditCardToken;
        const creditCard = body.creditCard;
        const creditCardHolderInfo = body.creditCardHolderInfo;
        if (creditCardToken || (creditCard && creditCardHolderInfo)) {
          const payload: any = { remoteIp: body.remoteIp };
          if (creditCardToken) payload.creditCardToken = creditCardToken;
          else { payload.creditCard = creditCard; payload.creditCardHolderInfo = creditCardHolderInfo; }
          await asaasProvider.updateSubscriptionCreditCard(settings.mode, settings.apiKey, subscriptionId, payload);
          await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, { billingType: 'CREDIT_CARD', updatePendingPayments: true });
          await salonRef.update({ 'billing.paymentMethod': 'CREDIT_CARD', 'billing.updatedAt': new Date().toISOString() });
          return res.status(200).json({ success: true, message: 'Cartão atualizado com segurança.', billingType: 'CREDIT_CARD' });
        }

        // Atualiza a assinatura no Asaas para CREDIT_CARD com sincronização dos pagamentos pendentes
        const subscription = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, {
          billingType: 'CREDIT_CARD',
          updatePendingPayments: true
        });

        // Atualiza o salão no banco de dados imediatamente
        await salonRef.update({
          'billing.paymentMethod': 'CREDIT_CARD',
          'billing.nextDueDate': subscription.nextDueDate,
          'billing.providerStatus': subscription.status,
          'billing.updatedAt': new Date().toISOString()
        });

        // Busca cobranças pendentes da assinatura
        const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
        const pending = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');

        if (pending) {
          // Garante que a cobrança pendente esteja configurada como CREDIT_CARD no Asaas
          if (pending.billingType !== 'CREDIT_CARD') {
            try {
              await asaasProvider.updatePaymentMethod(settings.mode, settings.apiKey, pending.id, 'CREDIT_CARD');
              pending.billingType = 'CREDIT_CARD';
            } catch (pmErr: any) {
              console.warn(`[update-payment-method] Falha ao atualizar método de cobrança ${pending.id} para CREDIT_CARD:`, pmErr?.message || pmErr);
            }
          }

          if (pending.invoiceUrl) {
            return res.status(200).json({
              success: true,
              checkoutUrl: pending.invoiceUrl,
              authorizationUrl: pending.invoiceUrl,
              billingType: 'CREDIT_CARD',
              subscription,
              message: 'Abra a página segura do Asaas para inserir os dados do cartão de crédito.'
            });
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Forma de pagamento atualizada para Cartão de Crédito com sucesso. As próximas mensalidades serão cobradas em cartão.',
          billingType: 'CREDIT_CARD',
          subscription
        });
      }

      const subscription = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, {
        billingType: paymentMethod,
        updatePendingPayments: true
      });

      const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
      const pending = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
      if (pending && pending.billingType !== paymentMethod) {
        try {
          await asaasProvider.updatePaymentMethod(settings.mode, settings.apiKey, pending.id, paymentMethod);
          pending.billingType = paymentMethod;
        } catch (err: any) {
          console.warn(`[update-payment-method] Falha ao atualizar cobrança pendente para ${paymentMethod}:`, err?.message || err);
        }
      }

      await salonRef.update({
        'billing.paymentMethod': paymentMethod,
        'billing.nextDueDate': subscription.nextDueDate,
        'billing.providerStatus': subscription.status,
        'billing.updatedAt': new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: `Forma de pagamento atualizada para ${paymentMethod === 'PIX' ? 'Pix' : 'Cartão de Crédito'} com sucesso.`,
        billingType: paymentMethod,
        authorizationUrl: pending?.invoiceUrl || undefined,
        checkoutUrl: pending?.invoiceUrl || undefined,
        subscription
      });
    }

    if (!subscriptionId || !validRemoteSubscription) {
      const billingService = new BillingService();
      const customerId = await billingService.ensureCustomer(salonId, salonData);
      const requestedPlanId = String(body.planId || salonData?.billing?.planId || salonData?.plan || 'essential');
      const planId = normalizePlanId(requestedPlanId);
      const plan = commercialPlan(planId);
      const cycle = toCycle(body.billingCycle || salonData?.billing?.billingCycle || 'MONTHLY');
      const value = commercialPlanPrice(planId, cycle);

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + (plan?.trialDays || 3));

      const newSub = await asaasProvider.createSubscription(settings.mode, settings.apiKey, {
        customer: customerId,
        billingType: paymentMethod,
        value,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        cycle,
        description: `Assinatura ${plan?.name || 'LumièreOS'} - LumièreOS`,
        externalReference: salonId
      });

      await salonRef.update({
        'billing.provider': 'asaas',
        'billing.subscriptionId': newSub.id,
        'billing.customerId': customerId,
        'billing.planId': planId,
        'billing.value': value,
        'billing.billingCycle': cycle,
        'billing.status': 'ACTIVE',
        'billing.paymentMethod': paymentMethod,
        'billing.nextDueDate': newSub.nextDueDate,
        'billing.providerStatus': newSub.status,
        'billing.updatedAt': new Date().toISOString(),
        plan: planId
      });

      const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, newSub.id);
      const pending = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');

      return res.status(200).json({
        success: true,
        message: `Assinatura configurada com ${paymentMethod === 'CREDIT_CARD' ? 'Cartão de Crédito' : 'Pix'}.`,
        billingType: paymentMethod,
        authorizationUrl: pending?.invoiceUrl || undefined,
        checkoutUrl: pending?.invoiceUrl || undefined,
        subscription: newSub
      });
    }

    const isManualPaid = Boolean(salonData?.billingProvider === 'manual' || salonData?.billingProvider === 'manual_pix' || salonData?.paymentStatus === 'paid' || salonData?.lastPaymentAt || salonData?.billing?.lastPaymentDate);
    if (!isManualPaid) return res.status(409).json({ error: 'Esta conta ainda não possui assinatura Asaas nem pagamento manual identificado. Conclua o checkout inicial antes de configurar a forma de pagamento.' });

    const requestedPlanId = String(body.planId || salonData?.billing?.planId || salonData?.plan || 'professional');
    const planId = normalizePlanId(requestedPlanId);
    const plan = commercialPlan(planId);
    if (!plan) return res.status(404).json({ error: `Plano ${requestedPlanId} não encontrado no catálogo comercial.` });
    if (plan.customPricing) return res.status(400).json({ error: 'Este plano requer contato com a equipe comercial.' });

    const cycle = toCycle(body.billingCycle || salonData?.billing?.billingCycle || 'MONTHLY');
    const value = commercialPlanPrice(planId, cycle);
    if (!value || value <= 0) return res.status(400).json({ error: `O plano ${planId} não possui preço válido para ${cycle}.` });

    const nextDueDate = resolveNextDueDate(salonData, cycle);
    const customerData = buildCustomerData(salonData);
    if (!customerData.cpfCnpj || !customerData.email || !customerData.name) {
      const appUrl = String(env.app.url || '').replace(/\/$/, '');
      const setupUrl = `${appUrl}/dashboard/dados-faturamento?salonId=${encodeURIComponent(salonId)}&planId=${encodeURIComponent(planId)}&billingCycle=${encodeURIComponent(cycle)}&migration=1&paymentMethod=${encodeURIComponent(paymentMethod)}`;
      return res.status(200).json({ success: true, requiresBillingData: true, authorizationUrl: setupUrl, setupUrl, message: 'Antes de configurar o pagamento, complete os dados de faturamento (CPF/CNPJ, nome e e-mail).' });
    }

    const lockRef = db.collection('billing_checkout_locks').doc(salonId);
    const lockToken = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(lockRef);
      if (snapshot.exists && Date.now() - Number(snapshot.data()?.createdAtMs || 0) < 5 * 60 * 1000) throw new Error('CHECKOUT_LOCKED');
      transaction.set(lockRef, { token: lockToken, salonId, planId, billingCycle: cycle, value, migration: true, createdAtMs: Date.now() });
    });

    try {
      const appUrl = env.app.url.replace(/\/$/, '');
      const callback = {
        successUrl: `${appUrl}/dashboard/assinatura?payment=success&migration=1`,
        cancelUrl: `${appUrl}/dashboard/assinatura?payment=cancelled&migration=1`,
        expiredUrl: `${appUrl}/dashboard/assinatura?payment=expired&migration=1`,
        autoRedirect: true,
      };
      const checkout = await asaasProvider.createRecurringCheckout(settings.mode, settings.apiKey, {
        billingTypes: [paymentMethod],
        minutesToExpire: 60,
        callback,
        externalReference: `manual-migration:${salonId}`,
        items: [{ name: `LumièreOS - ${plan.name}`, description: `Assinatura ${cycle.toLowerCase()} - migração de pagamento`, quantity: 1, value }],
        customerData,
        subscription: { cycle, nextDueDate },
      });

      const checkoutUrl = checkout.link || checkout.url || null;
      await salonRef.update({
        'billing.pendingMigration': true,
        'billing.migrationSource': 'manual_payment',
        'billing.migrationPlanId': planId,
        'billing.migrationBillingCycle': cycle,
        'billing.migrationValue': value,
        'billing.migrationNextDueDate': nextDueDate,
        'billing.migrationCheckoutId': checkout.id || null,
        'billing.migrationCheckoutUrl': checkoutUrl,
        'billing.updatedAt': new Date().toISOString(),
      });

      return res.status(200).json({ success: true, pendingMigration: true, checkoutUrl, authorizationUrl: checkoutUrl, billingCycle: cycle, nextDueDate, value, message: 'Checkout seguro aberto. A escolha da forma de pagamento será feita no Asaas.' });
    } finally {
      const currentLock = await lockRef.get();
      if (currentLock.exists && currentLock.data()?.token === lockToken) await lockRef.delete();
    }
  } catch (error: any) {
    if (error?.message === 'CHECKOUT_LOCKED') return res.status(409).json({ error: 'Já existe uma tentativa de migração em andamento. Aguarde alguns segundos e tente novamente.' });
    console.error('[Asaas Update Payment Method]', error);
    return res.status(500).json({ error: error?.message || 'Erro interno ao atualizar forma de pagamento.' });
  }
}

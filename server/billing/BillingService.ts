import { env } from "../config/env.js";
import { getAdminDb } from '../shared/firebaseAdmin.js';
import { asaasProvider } from './AsaasProvider.js';
import { Plan, PaymentMethod, Subscription, BillingCycle } from './types.js';
import crypto from 'crypto';

interface BillingSettings {
  mode: 'sandbox' | 'production';
  apiKey: string;
  webhookToken: string;
  updatedAt?: number;
}

class CheckoutInProgressError extends Error {
  statusCode = 409;
  constructor() {
    super('Já existe uma tentativa de checkout em andamento. Aguarde alguns segundos e tente novamente.');
    this.name = 'CheckoutInProgressError';
  }
}

export class BillingService {
  private async getSettings(): Promise<BillingSettings> {
    const adminDb = getAdminDb();
    const doc = await adminDb.collection('settings').doc('asaas').get();
    if (!doc.exists || !doc.data()?.apiKey) {
      const defaultSettings: BillingSettings = { mode: 'sandbox', apiKey: env.asaas.apiKey || '', webhookToken: env.asaas.webhookToken || '', updatedAt: Date.now() };
      try { await adminDb.collection('settings').doc('asaas').set(defaultSettings); } catch (e) { console.warn('Failed to seed default settings', e); }
      return defaultSettings;
    }
    return doc.data() as BillingSettings;
  }

  async testConnection(settingsOverride?: BillingSettings) {
    const settings = settingsOverride || await this.getSettings();
    return asaasProvider.testConnection(settings.mode, settings.apiKey);
  }

  async ensureCustomer(salonId: string, salonData: any): Promise<string> {
    const adminDb = getAdminDb();
    let customerId = salonData.billing?.customerId || salonData.asaasCustomerId;
    if (!customerId) {
      const settings = await this.getSettings();
      const customer = await asaasProvider.createCustomer(settings.mode, settings.apiKey, {
        name: salonData.billing?.legalName || salonData.name,
        email: salonData.billing?.email || salonData.email || salonData.billingEmail || salonData.ownerEmail,
        cpfCnpj: salonData.billing?.document || salonData.document || salonData.cnpj,
        mobilePhone: salonData.billing?.mobilePhone || salonData.phone || salonData.whatsapp,
        externalReference: salonId
      });
      customerId = customer.id;
      await adminDb.collection('salons').doc(salonId).update({ 'billing.provider': 'asaas', 'billing.customerId': customerId, asaasCustomerId: customerId });
    }
    return customerId;
  }

  async getPlan(planId: string): Promise<Plan> {
    const adminDb = getAdminDb();
    const planDoc = await adminDb.collection('plans').doc(planId).get();
    if (!planDoc.exists) throw new Error(`Plan ${planId} not found`);
    return { id: planDoc.id, ...planDoc.data() } as Plan;
  }

  private resolvePlanPricing(plan: Plan, cycle: BillingCycle): number {
    if (cycle === 'MONTHLY') return Number(plan.price);
    if (cycle === 'SEMIANNUALLY') return Number(plan.semiannualPrice || 0);
    return Number(plan.annualPrice || 0);
  }

  async createSubscription(
    salonId: string,
    planId: string,
    billingType: PaymentMethod,
    salonData: any,
    creditCard?: any,
    creditCardHolderInfo?: any,
    selectedBillingCycle?: BillingCycle
  ) {
    const adminDb = getAdminDb();
    const plan = await this.getPlan(planId);
    const cycle = selectedBillingCycle || plan.billingCycle || 'MONTHLY';
    const value = this.resolvePlanPricing(plan, cycle);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`O plano ${planId} não possui preço válido para a periodicidade ${cycle}.`);
    const settings = await this.getSettings();
    const description = `Assinatura ${plan.name} - LumièreOS`;

    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    const currentSalonData = salonDoc.exists ? salonDoc.data() || {} : salonData || {};
    const currentBilling = currentSalonData.billing || {};
    const currentSubscriptionId = currentBilling.subscriptionId;
    const currentBillingStatus = String(currentBilling.status || '').toUpperCase();
    const reusableLocalStatuses = new Set(['PENDING_PAYMENT', 'ACTIVE', 'OVERDUE']);

    if (currentSubscriptionId && reusableLocalStatuses.has(currentBillingStatus)) {
      try {
        const existing = await asaasProvider.getSubscription(settings.mode, settings.apiKey, currentSubscriptionId);
        const existingCycle = existing.cycle || 'MONTHLY';
        if (existing.status === 'ACTIVE' && currentBilling.planId === planId && existingCycle === cycle && Math.abs(Number(existing.value) - value) < 0.01) {
          console.info('[Asaas] Reutilizando assinatura existente:', currentSubscriptionId);
          return existing;
        }
      } catch (err: any) {
        const message = String(err?.message || err);
        if (!message.includes('Asaas API Error: 404')) throw err;
      }
    }

    if (currentSubscriptionId && currentBillingStatus === 'ACTIVE' && currentBilling.planId && currentBilling.planId !== planId) {
      throw new Error('Já existe uma assinatura ativa para este estabelecimento. Utilize a alteração de plano em vez de criar um novo checkout.');
    }
    if (currentSubscriptionId && currentBillingStatus === 'ACTIVE' && currentBilling.planId === planId && (currentBilling.billingCycle || 'MONTHLY') !== cycle) {
      throw new Error('Já existe uma assinatura ativa para este plano. Altere a periodicidade pela opção de alteração de assinatura.');
    }

    const externalReference = salonId;
    const remoteBeforeLock = await asaasProvider.listSubscriptions(settings.mode, settings.apiKey, { customer: currentBilling.customerId || currentSalonData.asaasCustomerId, externalReference });
    const matchingRemote = remoteBeforeLock.find(subscription =>
      subscription.status === 'ACTIVE' &&
      Math.abs(Number(subscription.value) - value) < 0.01 &&
      (subscription.cycle || 'MONTHLY') === cycle &&
      subscription.description === description
    );

    if (matchingRemote) {
      await adminDb.collection('salons').doc(salonId).update({
        'billing.provider': 'asaas',
        'billing.customerId': matchingRemote.customer,
        asaasCustomerId: matchingRemote.customer,
        'billing.subscriptionId': matchingRemote.id,
        'billing.planId': planId,
        'billing.billingCycle': cycle,
        'billing.value': value,
        'billing.status': currentBillingStatus === 'ACTIVE' ? 'ACTIVE' : 'PENDING_PAYMENT',
        'billing.pendingSubscriptionStatus': matchingRemote.status,
        'billing.paymentMethod': matchingRemote.billingType,
        'billing.nextDueDate': matchingRemote.nextDueDate,
        'billing.updatedAt': new Date().toISOString()
      });
      console.info('[Asaas] Assinatura existente reconciliada antes de criar outra:', matchingRemote.id);
      return matchingRemote;
    }

    const lockRef = adminDb.collection('billing_checkout_locks').doc(salonId);
    const lockToken = crypto.randomUUID();
    const lockCreatedAt = Date.now();
    const lockTtlMs = 5 * 60 * 1000;

    await adminDb.runTransaction(async transaction => {
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists) {
        const lockData = lockDoc.data() || {};
        const existingCreatedAt = Number(lockData.createdAtMs || 0);
        if (existingCreatedAt && lockCreatedAt - existingCreatedAt < lockTtlMs) throw new CheckoutInProgressError();
      }
      transaction.set(lockRef, { token: lockToken, salonId, planId, billingCycle: cycle, value, createdAtMs: lockCreatedAt, createdAt: new Date(lockCreatedAt).toISOString() });
    });

    try {
      const customerId = await this.ensureCustomer(salonId, currentSalonData);
      const remoteAfterLock = await asaasProvider.listSubscriptions(settings.mode, settings.apiKey, { customer: customerId, externalReference });
      const matchingAfterLock = remoteAfterLock.find(subscription =>
        subscription.status === 'ACTIVE' &&
        Math.abs(Number(subscription.value) - value) < 0.01 &&
        (subscription.cycle || 'MONTHLY') === cycle &&
        subscription.description === description
      );

      if (matchingAfterLock) {
        await adminDb.runTransaction(async transaction => {
          const salonRef = adminDb.collection('salons').doc(salonId);
          const lockSnapshot = await transaction.get(lockRef);
          transaction.set(salonRef, { billing: { provider: 'asaas', customerId, subscriptionId: matchingAfterLock.id, planId, billingCycle: cycle, value, status: currentBillingStatus === 'ACTIVE' ? 'ACTIVE' : 'PENDING_PAYMENT', pendingSubscriptionStatus: matchingAfterLock.status, paymentMethod: matchingAfterLock.billingType, nextDueDate: matchingAfterLock.nextDueDate, updatedAt: new Date().toISOString() }, asaasCustomerId: customerId }, { merge: true });
          if (lockSnapshot.exists && lockSnapshot.data()?.token === lockToken) transaction.delete(lockRef);
        });
        return matchingAfterLock;
      }

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + (plan.trialDays || 1));
      const payload: any = { customer: customerId, billingType, value, nextDueDate: nextDueDate.toISOString().split('T')[0], cycle, description, externalReference };
      if (salonData.callback?.successUrl) payload.callback = { successUrl: salonData.callback.successUrl, cancelUrl: salonData.callback.cancelUrl, expiredUrl: salonData.callback.expiredUrl, autoRedirect: salonData.callback.autoRedirect ?? true };
      if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) { payload.creditCard = creditCard; payload.creditCardHolderInfo = creditCardHolderInfo; }

      const sub = await asaasProvider.createSubscription(settings.mode, settings.apiKey, payload);
      await adminDb.runTransaction(async transaction => {
        const salonRef = adminDb.collection('salons').doc(salonId);
        const lockSnapshot = await transaction.get(lockRef);
        transaction.set(salonRef, { billing: { provider: 'asaas', customerId, subscriptionId: sub.id, planId, billingCycle: cycle, value, status: 'PENDING_PAYMENT', pendingSubscriptionStatus: sub.status, paymentMethod: billingType, nextDueDate: sub.nextDueDate, updatedAt: new Date().toISOString() } }, { merge: true });
        if (lockSnapshot.exists && lockSnapshot.data()?.token === lockToken) transaction.delete(lockRef);
      });
      return sub;
    } catch (error) {
      try {
        await adminDb.runTransaction(async transaction => {
          const lockSnapshot = await transaction.get(lockRef);
          if (lockSnapshot.exists && lockSnapshot.data()?.token === lockToken) transaction.delete(lockRef);
        });
      } catch (cleanupError) { console.warn('[Asaas] Falha ao liberar lock de checkout:', cleanupError); }
      throw error;
    }
  }

  async createTermCheckout(
    salonId: string,
    planId: string,
    cycle: 'SEMIANNUALLY' | 'YEARLY',
    value: number,
    salonData: any,
    maxInstallmentCount: number
  ) {
    const adminDb = getAdminDb();
    const settings = await this.getSettings();
    if (!Number.isFinite(value) || value <= 0) throw new Error('Valor do contrato inválido.');
    const termMonths = cycle === 'YEARLY' ? 12 : 6;
    const customerId = await this.ensureCustomer(salonId, salonData);
    const customerData = {
      name: salonData.billing?.legalName || salonData.name,
      email: salonData.billing?.email || salonData.billingEmail || salonData.ownerEmail,
      cpfCnpj: salonData.billing?.document || salonData.document || salonData.cnpj,
      phone: salonData.billing?.mobilePhone || salonData.phone || salonData.whatsapp,
      mobilePhone: salonData.billing?.mobilePhone || salonData.phone || salonData.whatsapp,
      postalCode: salonData.billing?.postalCode || salonData.postalCode,
      address: salonData.billing?.address || salonData.address,
      addressNumber: salonData.billing?.addressNumber || salonData.addressNumber,
      complement: salonData.billing?.complement || salonData.complement,
      province: salonData.billing?.province || salonData.province,
      city: salonData.billing?.city || salonData.city,
    };
    const termEndDate = new Date();
    termEndDate.setMonth(termEndDate.getMonth() + termMonths);
    const checkout = await asaasProvider.createTermCheckout(settings.mode, settings.apiKey, {
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED', 'INSTALLMENT'],
      minutesToExpire: 60,
      callback: salonData.callback,
      items: [{ name: 'LumièreOS - ' + planId, description: 'Plano ' + (cycle === 'YEARLY' ? 'anual' : 'semestral'), quantity: 1, value }],
      customerData,
      externalReference: 'term:' + salonId + ':' + cycle + ':' + crypto.randomUUID(),
      installment: { maxInstallmentCount },
    });
    const checkoutUrl = checkout.link || checkout.url || null;
    await adminDb.collection('salons').doc(salonId).set({ billing: {
      provider: 'asaas', customerId, planId, billingCycle: cycle, value,
      status: 'PENDING_PAYMENT', pendingTermCheckout: true,
      termMonths, termEndDate: termEndDate.toISOString().split('T')[0],
      installmentCount: maxInstallmentCount, checkoutId: checkout.id || null,
      checkoutUrl, paymentMethod: 'UNDEFINED', updatedAt: new Date().toISOString()
    }, asaasCustomerId: customerId }, { merge: true });
    return checkout;
  }

  async cancelSubscription(salonId: string) {
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    const subscriptionId = salonDoc.data()?.billing?.subscriptionId;
    if (!subscriptionId) throw new Error('Nenhuma assinatura ativa encontrada.');
    const settings = await this.getSettings();
    await asaasProvider.cancelSubscription(settings.mode, settings.apiKey, subscriptionId);
    await adminDb.collection('salons').doc(salonId).update({ 'billing.status': 'CANCELLED', 'billing.updatedAt': new Date().toISOString() });
  }

  async changePlan(salonId: string, newPlanId: string) {
    const adminDb = getAdminDb();
    const data = (await adminDb.collection('salons').doc(salonId).get()).data();
    const subscriptionId = data?.billing?.subscriptionId;
    if (!subscriptionId) throw new Error('Nenhuma assinatura ativa encontrada.');
    const plan = await this.getPlan(newPlanId);
    const settings = await this.getSettings();
    const cycle = (data?.billing?.billingCycle || 'MONTHLY') as BillingCycle;
    const value = this.resolvePlanPricing(plan, cycle);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`O plano ${newPlanId} não possui preço válido para a periodicidade ${cycle}.`);
    const sub = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, { value, cycle, description: `Assinatura ${plan.name} - LumièreOS`, updatePendingPayments: true });
    await adminDb.collection('salons').doc(salonId).update({ 'billing.planId': newPlanId, 'billing.value': value, 'billing.billingCycle': cycle, 'billing.updatedAt': new Date().toISOString() });
    return sub;
  }

  async updatePaymentMethod(salonId: string, billingType: PaymentMethod, creditCard?: any, creditCardHolderInfo?: any) {
    const adminDb = getAdminDb();
    const data = (await adminDb.collection('salons').doc(salonId).get()).data();
    const subscriptionId = data?.billing?.subscriptionId;
    if (!subscriptionId) throw new Error('Nenhuma assinatura ativa encontrada.');
    const settings = await this.getSettings();
    const payload: any = { billingType, updatePendingPayments: true };
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) { payload.creditCard = creditCard; payload.creditCardHolderInfo = creditCardHolderInfo; }
    const sub = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, payload);
    await adminDb.collection('salons').doc(salonId).update({ 'billing.paymentMethod': billingType, 'billing.updatedAt': new Date().toISOString() });
    return sub;
  }

  async getSubscriptionInvoiceUrl(subscriptionId: string): Promise<string | null> {
    const settings = await this.getSettings();
    const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
    const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    return pendingPayment?.invoiceUrl || null;
  }

  async getPixPaymentDetails(salonId: string) {
    const adminDb = getAdminDb();
    const data = (await adminDb.collection('salons').doc(salonId).get()).data();
    const subscriptionId = data?.billing?.subscriptionId;
    if (!subscriptionId) throw new Error('Nenhuma assinatura encontrada.');
    const settings = await this.getSettings();
    const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
    const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    if (!pendingPayment) throw new Error('Nenhum pagamento pendente encontrado.');
    if (pendingPayment.billingType !== 'PIX') throw new Error('O pagamento pendente não é do tipo PIX.');
    return asaasProvider.getPixQrCode(settings.mode, settings.apiKey, pendingPayment.id);
  }

  async getBoletoDetails(salonId: string) {
    const adminDb = getAdminDb();
    const data = (await adminDb.collection('salons').doc(salonId).get()).data();
    const subscriptionId = data?.billing?.subscriptionId;
    if (!subscriptionId) throw new Error('Nenhuma assinatura encontrada.');
    const settings = await this.getSettings();
    const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
    const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    if (!pendingPayment) throw new Error('Nenhum pagamento pendente encontrado.');
    return asaasProvider.getBoleto(settings.mode, settings.apiKey, pendingPayment.id);
  }

  async syncSubscription(salonId: string) {
    const adminDb = getAdminDb();
    const data = (await adminDb.collection('salons').doc(salonId).get()).data();
    const subscriptionId = data?.billing?.subscriptionId;
    if (!subscriptionId) return null;
    const settings = await this.getSettings();
    const sub = await asaasProvider.getSubscription(settings.mode, settings.apiKey, subscriptionId);
    await adminDb.collection('salons').doc(salonId).update({ 'billing.providerStatus': sub.status, 'billing.nextDueDate': sub.nextDueDate, 'billing.paymentMethod': sub.billingType, 'billing.billingCycle': sub.cycle || data?.billing?.billingCycle || 'MONTHLY', 'billing.value': sub.value, 'billing.updatedAt': new Date().toISOString() });
    return sub;
  }

  async handleWebhook(event: string, payload: any, signature?: string) {
    const adminDb = getAdminDb();
    const eventId = payload.id;
    const auditId = eventId || crypto.randomUUID();
    try { await adminDb.collection('billing_logs').doc(auditId).set({ id: auditId, event, payload, createdAt: new Date().toISOString() }, { merge: true }); } catch (e) { console.warn('[BillingService] Falha ao salvar log de auditoria:', e); }
    if (eventId) {
      const eventRef = adminDb.collection('billing_events').doc(eventId);
      const isNewEvent = await adminDb.runTransaction(async transaction => {
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) return false;
        transaction.set(eventRef, { id: eventId, event, payload, status: 'PROCESSING', processed: false, createdAt: new Date().toISOString() });
        return true;
      });
      if (!isNewEvent) {
        const eventData = (await eventRef.get()).data();
        if (eventData?.processed || eventData?.dlq) return;
      }
    }

    const customerId = payload.payment?.customer || payload.subscription?.customer || payload.customer;
    if (!customerId) {
      const errorMsg = 'Dados do cliente (customerId) ausentes no payload do webhook.';
      if (eventId) await this.sendToDeadLetterQueue(eventId, errorMsg, payload);
      return;
    }

    let salonId = '';
    try {
      const salonsSnapshot = await adminDb.collection('salons').where('billing.customerId', '==', customerId).limit(1).get();
      let salonDoc = salonsSnapshot.docs[0];
      if (!salonDoc) {
        const legacySnapshot = await adminDb.collection('salons').where('asaasCustomerId', '==', customerId).limit(1).get();
        salonDoc = legacySnapshot.docs[0];
      }
      if (!salonDoc) {
        const errorMsg = `Nenhum estabelecimento encontrado para o customerId do Asaas: ${customerId}`;
        if (eventId) await this.sendToDeadLetterQueue(eventId, errorMsg, payload);
        return;
      }
      salonId = salonDoc.id;
    } catch (err) { throw err; }

    try {
      const payment = payload.payment;
      const subscription = payload.subscription;
      let billingStatus: 'ACTIVE' | 'OVERDUE' | 'CANCELLED' | null = null;
      let tenantStatus: 'active' | 'overdue' | 'cancelled' | null = null;
      switch (event) {
        case 'PAYMENT_CREATED':
        case 'PAYMENT_UPDATED':
        case 'PAYMENT_AWAITING_RISK_ANALYSIS':
        case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
          break;
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED': billingStatus = 'ACTIVE'; tenantStatus = 'active'; break;
        case 'PAYMENT_OVERDUE': billingStatus = 'OVERDUE'; tenantStatus = 'overdue'; break;
        case 'SUBSCRIPTION_CANCELLED':
        case 'SUBSCRIPTION_DELETED': billingStatus = 'CANCELLED'; tenantStatus = 'cancelled'; break;
        case 'SUBSCRIPTION_UPDATED': {
          const subStatus = (subscription?.status || '').toUpperCase();
          if (subStatus === 'OVERDUE') { billingStatus = 'OVERDUE'; tenantStatus = 'overdue'; }
          else if (subStatus === 'CANCELED' || subStatus === 'CANCELLED' || subStatus === 'DELETED') { billingStatus = 'CANCELLED'; tenantStatus = 'cancelled'; }
          break;
        }
        default:
          if (eventId) await adminDb.collection('billing_events').doc(eventId).update({ status: 'IGNORED', processed: true, processedAt: new Date().toISOString() });
          return;
      }

      await adminDb.runTransaction(async transaction => {
        const salonRef = adminDb.collection('salons').doc(salonId);
        const tenantRef = adminDb.collection('tenants').doc(salonId);
        const subRef = adminDb.collection('subscriptions').doc(salonId);
        const salonDoc = await transaction.get(salonRef);
        if (!salonDoc.exists) throw new Error(`Estabelecimento ${salonId} não localizado no Firestore.`);
        const salonData = salonDoc.data();
        const currentBilling = salonData?.billing || {};
        const now = new Date();
        const isPaymentConfirmed = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED';
        const lastPayment = isPaymentConfirmed ? now : (currentBilling.lastPaymentDate ? new Date(currentBilling.lastPaymentDate) : null);
        const isFixedTerm = currentBilling.billingCycle === 'SEMIANNUALLY' || currentBilling.billingCycle === 'YEARLY' || currentBilling.pendingTermCheckout === true;
        const paymentDueDate = (payment?.dueDate || subscription?.nextDueDate) ? new Date(payment?.dueDate || subscription?.nextDueDate) : null;
        const resolvedNextDueDate = isFixedTerm
          ? (currentBilling.termEndDate ? new Date(currentBilling.termEndDate) : (currentBilling.nextDueDate ? new Date(currentBilling.nextDueDate) : null))
          : (paymentDueDate || (currentBilling.nextDueDate ? new Date(currentBilling.nextDueDate) : null));
        const asaasSubscriptionId = subscription?.id || payment?.subscription || currentBilling.subscriptionId || '';
        const activePlanId = currentBilling.planId || 'essential';
        const billingUpdate: any = { ...currentBilling, updatedAt: now.toISOString(), customerId };
        if (billingStatus) billingUpdate.status = billingStatus;
        if (asaasSubscriptionId) billingUpdate.subscriptionId = asaasSubscriptionId;
        if (payment?.billingType || subscription?.billingType) billingUpdate.paymentMethod = payment?.billingType || subscription?.billingType;
        if (payment?.installment) {
          billingUpdate.installmentId = typeof payment.installment === 'string' ? payment.installment : payment.installment.id || null;
          billingUpdate.installmentNumber = Number(payment.installmentNumber || payment.installment?.number || currentBilling.installmentNumber || 1);
          billingUpdate.installmentTotal = Number(payment.installmentCount || payment.installment?.count || currentBilling.installmentTotal || currentBilling.installmentCount || 1);
          if (paymentDueDate) billingUpdate.nextInstallmentDueDate = paymentDueDate.toISOString().split('T')[0];
        }
        if (lastPayment) billingUpdate.lastPaymentDate = lastPayment.toISOString();
        if (resolvedNextDueDate) billingUpdate.nextDueDate = resolvedNextDueDate.toISOString().split('T')[0];
        if (subscription?.status) billingUpdate.providerStatus = subscription.status;
        if (subscription?.cycle) billingUpdate.billingCycle = subscription.cycle;
        if (payment?.value != null) billingUpdate.value = Number(payment.value);
        else if (subscription?.value != null) billingUpdate.value = Number(subscription.value);
        transaction.set(salonRef, { billing: billingUpdate }, { merge: true });
        if (tenantStatus) transaction.set(tenantRef, { id: salonId, status: tenantStatus, subscriptionStatus: tenantStatus, active: tenantStatus === 'active', updatedAt: now.toISOString() }, { merge: true });
        transaction.set(subRef, {
          tenantId: salonId,
          provider: 'asaas',
          subscriptionId: asaasSubscriptionId || null,
          installmentId: billingUpdate.installmentId || currentBilling.installmentId || null,
          status: billingStatus || currentBilling.status || 'PENDING_PAYMENT',
          planId: activePlanId,
          customerId,
          billingCycle: subscription?.cycle || currentBilling.billingCycle || 'MONTHLY',
          value: subscription?.value != null ? Number(subscription.value) : currentBilling.value || null,
          lastPaymentDate: lastPayment ? lastPayment.toISOString() : currentBilling.lastPaymentDate || null,
          nextDueDate: resolvedNextDueDate ? resolvedNextDueDate.toISOString().split('T')[0] : currentBilling.nextDueDate || null,
          nextInstallmentDueDate: billingUpdate.nextInstallmentDueDate || currentBilling.nextInstallmentDueDate || null,
          updatedAt: now.toISOString()
        }, { merge: true });
      });
      if (eventId) await adminDb.collection('billing_events').doc(eventId).update({ status: 'PROCESSED', processed: true, processedAt: new Date().toISOString() });
    } catch (err: any) {
      const isTemporary = this.checkIfTemporaryError(err);
      if (!isTemporary && eventId) { await this.sendToDeadLetterQueue(eventId, err.message || String(err), payload); return; }
      throw err;
    }
  }

  private checkIfTemporaryError(err: any): boolean {
    const errMsg = String(err?.message || err).toLowerCase();
    return ['timeout', 'deadline exceeded', 'unavailable', 'resource exhausted', 'rate limit', 'connection closed', 'service unavailable', 'try again'].some(indicator => errMsg.includes(indicator));
  }

  private async sendToDeadLetterQueue(eventId: string, errorMsg: string, payload: any): Promise<void> {
    const adminDb = getAdminDb();
    await adminDb.collection('billing_dlq').doc(eventId).set({ eventId, error: errorMsg, payload, failedAt: new Date().toISOString(), resolved: false }, { merge: true });
    await adminDb.collection('billing_events').doc(eventId).set({ id: eventId, processed: false, dlq: true, status: 'DLQ', error: errorMsg, updatedAt: new Date().toISOString() }, { merge: true });
  }
}

export const billingService = new BillingService();

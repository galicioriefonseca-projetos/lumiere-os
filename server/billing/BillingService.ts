import { env } from "../config/env.js";
import { getAdminDb } from '../shared/firebaseAdmin.js';
import { asaasProvider } from './AsaasProvider.js';
import { Plan, PaymentMethod, Customer, Subscription } from './types.js';
import crypto from 'crypto';

interface BillingSettings {
  mode: 'sandbox' | 'production';
  apiKey: string;
  webhookToken: string;
  updatedAt?: number;
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

  async createSubscription(salonId: string, planId: string, billingType: PaymentMethod, salonData: any, creditCard?: any, creditCardHolderInfo?: any) {
    const customerId = await this.ensureCustomer(salonId, salonData);
    const plan = await this.getPlan(planId);
    const settings = await this.getSettings();
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + (plan.trialDays || 1));

    const payload: any = {
      customer: customerId,
      billingType,
      value: plan.price,
      nextDueDate: nextDueDate.toISOString().split('T')[0],
      cycle: plan.billingCycle || 'MONTHLY',
      description: `Assinatura ${plan.name} - LumièreOS`,
      externalReference: salonId
    };

    // Retorno é apenas UX; a ativação depende do webhook de pagamento.
    if (salonData.callback?.successUrl) {
      payload.callback = {
        successUrl: salonData.callback.successUrl,
        cancelUrl: salonData.callback.cancelUrl,
        expiredUrl: salonData.callback.expiredUrl,
        autoRedirect: salonData.callback.autoRedirect ?? true
      };
    }
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
      payload.creditCard = creditCard;
      payload.creditCardHolderInfo = creditCardHolderInfo;
    }

    const sub = await asaasProvider.createSubscription(settings.mode, settings.apiKey, payload);
    const adminDb = getAdminDb();
    // Assinatura criada != pagamento recebido. Nunca liberar acesso aqui.
    await adminDb.collection('salons').doc(salonId).update({
      'billing.subscriptionId': sub.id,
      'billing.planId': planId,
      'billing.status': 'PENDING_PAYMENT',
      'billing.pendingSubscriptionStatus': sub.status,
      'billing.paymentMethod': billingType,
      'billing.nextDueDate': sub.nextDueDate,
      'billing.updatedAt': new Date().toISOString()
    });
    return sub;
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
    const sub = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, { value: plan.price, cycle: plan.billingCycle || 'MONTHLY', description: `Assinatura ${plan.name} - LumièreOS`, updatePendingPayments: true });
    await adminDb.collection('salons').doc(salonId).update({ 'billing.planId': newPlanId, 'billing.value': plan.price, 'billing.updatedAt': new Date().toISOString() });
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
    await adminDb.collection('salons').doc(salonId).update({ 'billing.providerStatus': sub.status, 'billing.nextDueDate': sub.nextDueDate, 'billing.paymentMethod': sub.billingType, 'billing.updatedAt': new Date().toISOString() });
    return sub;
  }

  async handleWebhook(event: string, payload: any, signature?: string) {
    const adminDb = getAdminDb();
    const eventId = payload.id;
    const auditId = eventId || crypto.randomUUID();
    try {
      await adminDb.collection('billing_logs').doc(auditId).set({ id: auditId, event, payload, createdAt: new Date().toISOString() }, { merge: true });
    } catch (e) { console.warn('[BillingService] Falha ao salvar log de auditoria:', e); }

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
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          billingStatus = 'ACTIVE'; tenantStatus = 'active'; break;
        case 'PAYMENT_OVERDUE':
          billingStatus = 'OVERDUE'; tenantStatus = 'overdue'; break;
        case 'SUBSCRIPTION_CANCELLED':
        case 'SUBSCRIPTION_DELETED':
          billingStatus = 'CANCELLED'; tenantStatus = 'cancelled'; break;
        case 'SUBSCRIPTION_UPDATED': {
          const subStatus = (subscription?.status || '').toUpperCase();
          if (subStatus === 'OVERDUE') { billingStatus = 'OVERDUE'; tenantStatus = 'overdue'; }
          else if (subStatus === 'CANCELED' || subStatus === 'CANCELLED' || subStatus === 'DELETED') { billingStatus = 'CANCELLED'; tenantStatus = 'cancelled'; }
          // ACTIVE da assinatura não libera acesso sem confirmação de pagamento.
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
        const resolvedNextDueDate = (payment?.dueDate || subscription?.nextDueDate) ? new Date(payment?.dueDate || subscription?.nextDueDate) : (currentBilling.nextDueDate ? new Date(currentBilling.nextDueDate) : null);
        const asaasSubscriptionId = subscription?.id || payment?.subscription || currentBilling.subscriptionId || '';
        const activePlanId = currentBilling.planId || 'performance';
        const billingUpdate: any = { ...currentBilling, updatedAt: now.toISOString(), customerId };
        if (billingStatus) billingUpdate.status = billingStatus;
        if (asaasSubscriptionId) billingUpdate.subscriptionId = asaasSubscriptionId;
        if (payment?.billingType || subscription?.billingType) billingUpdate.paymentMethod = payment?.billingType || subscription?.billingType;
        if (lastPayment) billingUpdate.lastPaymentDate = lastPayment.toISOString();
        if (resolvedNextDueDate) billingUpdate.nextDueDate = resolvedNextDueDate.toISOString().split('T')[0];
        if (subscription?.status) billingUpdate.providerStatus = subscription.status;
        transaction.set(salonRef, { billing: billingUpdate }, { merge: true });
        if (tenantStatus) transaction.set(tenantRef, { id: salonId, status: tenantStatus, subscriptionStatus: tenantStatus, active: tenantStatus === 'active', updatedAt: now.toISOString() }, { merge: true });
        transaction.set(subRef, { tenantId: salonId, provider: 'asaas', subscriptionId: asaasSubscriptionId, status: billingStatus || currentBilling.status || 'PENDING_PAYMENT', planId: activePlanId, customerId, lastPaymentDate: lastPayment ? lastPayment.toISOString() : currentBilling.lastPaymentDate || null, nextDueDate: resolvedNextDueDate ? resolvedNextDueDate.toISOString().split('T')[0] : currentBilling.nextDueDate || null, updatedAt: now.toISOString() }, { merge: true });
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

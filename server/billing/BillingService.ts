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
      const defaultSettings: BillingSettings = {
        mode: 'sandbox',
        apiKey: env.asaas.apiKey || '',
        webhookToken: env.asaas.webhookToken || '',
        updatedAt: Date.now()
      };
      try {
        await adminDb.collection('settings').doc('asaas').set(defaultSettings);
      } catch (e) {
        console.warn('Failed to seed default settings', e);
      }
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
        name: salonData.name,
        email: salonData.email,
        cpfCnpj: salonData.document || salonData.cnpj,
        mobilePhone: salonData.phone || salonData.whatsapp,
        externalReference: salonId
      });
      customerId = customer.id;
      
      await adminDb.collection('salons').doc(salonId).update({
        'billing.provider': 'asaas',
        'billing.customerId': customerId,
        asaasCustomerId: customerId // Keep for legacy compatibility if needed
      });
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
    if (plan.trialDays) {
        nextDueDate.setDate(nextDueDate.getDate() + plan.trialDays);
    } else {
        nextDueDate.setDate(nextDueDate.getDate() + 1); // 1 day to pay by default for boleto/pix
    }

    const payload: any = {
      customer: customerId,
      billingType: billingType,
      value: plan.price,
      nextDueDate: nextDueDate.toISOString().split('T')[0],
      cycle: plan.billingCycle || 'MONTHLY',
      description: `Assinatura ${plan.name} - LumièreOS`,
      externalReference: salonId
    };

    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
      payload.creditCard = creditCard;
      payload.creditCardHolderInfo = creditCardHolderInfo;
    }

    const sub = await asaasProvider.createSubscription(settings.mode, settings.apiKey, payload);
    
    const adminDb = getAdminDb();
    await adminDb.collection('salons').doc(salonId).update({
        'billing.subscriptionId': sub.id,
        'billing.planId': planId,
        'billing.status': sub.status,
        'billing.paymentMethod': billingType,
        'billing.nextDueDate': sub.nextDueDate,
        'billing.updatedAt': new Date().toISOString()
    });

    return sub;
  }

  async cancelSubscription(salonId: string) {
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    const data = salonDoc.data();
    const subscriptionId = data?.billing?.subscriptionId;

    if (!subscriptionId) throw new Error('Nenhuma assinatura ativa encontrada.');

    const settings = await this.getSettings();
    await asaasProvider.cancelSubscription(settings.mode, settings.apiKey, subscriptionId);

    await adminDb.collection('salons').doc(salonId).update({
        'billing.status': 'CANCELLED',
        'billing.updatedAt': new Date().toISOString()
    });
  }

  async changePlan(salonId: string, newPlanId: string) {
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    const data = salonDoc.data();
    const subscriptionId = data?.billing?.subscriptionId;

    if (!subscriptionId) throw new Error('Nenhuma assinatura ativa encontrada.');

    const plan = await this.getPlan(newPlanId);
    const settings = await this.getSettings();

    const sub = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, {
      value: plan.price,
      cycle: plan.billingCycle || 'MONTHLY',
      description: `Assinatura ${plan.name} - LumièreOS`,
      updatePendingPayments: true
    });

    await adminDb.collection('salons').doc(salonId).update({
        'billing.planId': newPlanId,
        'billing.value': plan.price,
        'billing.updatedAt': new Date().toISOString()
    });

    return sub;
  }

  async updatePaymentMethod(salonId: string, billingType: PaymentMethod, creditCard?: any, creditCardHolderInfo?: any) {
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    const data = salonDoc.data();
    const subscriptionId = data?.billing?.subscriptionId;

    if (!subscriptionId) throw new Error('Nenhuma assinatura ativa encontrada.');
    const settings = await this.getSettings();

    // In Asaas, to update a subscription payment method, you update the subscription itself
    const payload: any = { billingType, updatePendingPayments: true };
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
      payload.creditCard = creditCard;
      payload.creditCardHolderInfo = creditCardHolderInfo;
    }

    const sub = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, payload);

    await adminDb.collection('salons').doc(salonId).update({
        'billing.paymentMethod': billingType,
        'billing.updatedAt': new Date().toISOString()
    });

    return sub;
  }

  
  async getSubscriptionInvoiceUrl(subscriptionId: string): Promise<string | null> {
    const settings = await this.getSettings();
    const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
    const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    if (!pendingPayment) return null;
    return pendingPayment.invoiceUrl;
  }

  async getPixPaymentDetails(salonId: string) {
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    const data = salonDoc.data();
    const subscriptionId = data?.billing?.subscriptionId;
    if (!subscriptionId) throw new Error('Nenhuma assinatura encontrada.');

    const settings = await this.getSettings();
    const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
    const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    
    if (!pendingPayment) throw new Error('Nenhum pagamento pendente encontrado.');

    if (pendingPayment.billingType !== 'PIX') {
       // if not PIX, we can't get qr code
       throw new Error('O pagamento pendente não é do tipo PIX.');
    }

    return asaasProvider.getPixQrCode(settings.mode, settings.apiKey, pendingPayment.id);
  }

  async getBoletoDetails(salonId: string) {
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    const data = salonDoc.data();
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
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    const data = salonDoc.data();
    const subscriptionId = data?.billing?.subscriptionId;
    
    if (!subscriptionId) return null;

    const settings = await this.getSettings();
    const sub = await asaasProvider.getSubscription(settings.mode, settings.apiKey, subscriptionId);
    
    await adminDb.collection('salons').doc(salonId).update({
        'billing.status': sub.status,
        'billing.nextDueDate': sub.nextDueDate,
        'billing.paymentMethod': sub.billingType,
        'billing.updatedAt': new Date().toISOString()
    });
    
    return sub;
  }

  async handleWebhook(event: string, payload: any, signature?: string) {
    const adminDb = getAdminDb();
    
    // Obter o ID único do evento enviado pelo Asaas para garantir idempotência
    const eventId = payload.id;
    if (!eventId) {
      console.warn('[BillingService] Evento do Asaas recebido sem campo "id". Processando sem idempotência rigorosa.');
    }

    // 1. Log preliminar e auditoria limpa
    try {
      await adminDb.collection('billing_logs').doc(eventId || crypto.randomUUID()).set({
        id: eventId || crypto.randomUUID(),
        event,
        payload,
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('[BillingService] Falha ao salvar log de auditoria simples:', e);
    }

    if (eventId) {
      const eventRef = adminDb.collection('billing_events').doc(eventId);
      
      // Bloqueio atômico para garantir idempotência thread-safe no Firestore
      try {
        const isNewEvent = await adminDb.runTransaction(async (transaction) => {
          const eventDoc = await transaction.get(eventRef);
          if (eventDoc.exists) {
            return false; // Evento duplicado já registrado
          }
          transaction.set(eventRef, {
            id: eventId,
            event,
            payload,
            processed: false,
            createdAt: new Date().toISOString()
          });
          return true; // Novo evento bloqueado com sucesso
        });

        if (!isNewEvent) {
          const eventDoc = await eventRef.get();
          const eventData = eventDoc.data();
          if (eventData?.processed) {
            console.info(`[BillingService] Evento duplicado ignorado de forma idempotente (Já processado com sucesso): ${eventId}`);
            return;
          }
          if (eventData?.dlq) {
            console.warn(`[BillingService] Evento duplicado ignorado de forma idempotente (Já roteado anteriormente para a DLQ): ${eventId}`);
            return;
          }
          console.warn(`[BillingService] Evento ${eventId} está em processamento ou falhou anteriormente. Continuando processamento.`);
        }
      } catch (err) {
        console.error(`[BillingService] Erro no controle de concorrência/idempotência para o evento ${eventId}:`, err);
        throw err; // Força retry em caso de indisponibilidade de escrita temporária do banco
      }
    }

    // 2. Localizar o Tenant (Salão) correspondente no ecossistema
    const customerId = payload.payment?.customer || payload.subscription?.customer || payload.customer;
    if (!customerId) {
      const errorMsg = 'Dados do cliente (customerId) ausentes no payload do webhook.';
      console.warn(`[BillingService] ${errorMsg}`);
      if (eventId) {
        await this.sendToDeadLetterQueue(eventId, errorMsg, payload);
      }
      return;
    }

    // Busca o salão correspondente por customerId
    let salonId = '';
    try {
      const salonsSnapshot = await adminDb.collection('salons')
        .where('billing.customerId', '==', customerId)
        .limit(1)
        .get();

      let salonDoc = salonsSnapshot.docs[0];
      if (!salonDoc) {
        const legacySnapshot = await adminDb.collection('salons')
          .where('asaasCustomerId', '==', customerId)
          .limit(1)
          .get();
        salonDoc = legacySnapshot.docs[0];
      }

      if (!salonDoc) {
        const errorMsg = `Nenhum estabelecimento encontrado para o customerId do Asaas: ${customerId}`;
        console.warn(`[BillingService] ${errorMsg}`);
        if (eventId) {
          await this.sendToDeadLetterQueue(eventId, errorMsg, payload);
        }
        return;
      }

      salonId = salonDoc.id;
    } catch (err) {
      console.error('[BillingService] Erro de infraestrutura ao buscar salão do Firestore:', err);
      throw err; // Força retry pelo Asaas (erro de infraestrutura)
    }

    // 3. Processamento das Regras de Negócio e Atualização Transacional Consistente
    try {
      const payment = payload.payment;
      const subscription = payload.subscription;

      let billingStatus = 'ACTIVE';
      let tenantStatus: 'active' | 'overdue' | 'cancelled' = 'active';

      switch (event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          billingStatus = 'ACTIVE';
          tenantStatus = 'active';
          break;
        case 'PAYMENT_OVERDUE':
          billingStatus = 'OVERDUE';
          tenantStatus = 'overdue';
          break;
        case 'SUBSCRIPTION_CANCELLED':
        case 'SUBSCRIPTION_DELETED':
          billingStatus = 'CANCELLED';
          tenantStatus = 'cancelled';
          break;
        case 'SUBSCRIPTION_UPDATED':
          const subStatus = (subscription?.status || 'ACTIVE').toUpperCase();
          if (subStatus === 'ACTIVE') {
            billingStatus = 'ACTIVE';
            tenantStatus = 'active';
          } else if (subStatus === 'OVERDUE') {
            billingStatus = 'OVERDUE';
            tenantStatus = 'overdue';
          } else if (subStatus === 'CANCELED' || subStatus === 'CANCELLED' || subStatus === 'DELETED') {
            billingStatus = 'CANCELLED';
            tenantStatus = 'cancelled';
          }
          break;
      }

      // Executar transação atômica única unificando coleções 'salons', 'tenants' e 'subscriptions'
      await adminDb.runTransaction(async (transaction) => {
        const salonRef = adminDb.collection('salons').doc(salonId);
        const tenantRef = adminDb.collection('tenants').doc(salonId);
        const subRef = adminDb.collection('subscriptions').doc(salonId);

        const salonDoc = await transaction.get(salonRef);
        if (!salonDoc.exists) {
          throw new Error(`Estabelecimento ${salonId} não localizado no Firestore.`);
        }

        const salonData = salonDoc.data();
        const currentBilling = salonData?.billing || {};

        const lastPayment = (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED')
          ? new Date()
          : (currentBilling.lastPaymentDate ? new Date(currentBilling.lastPaymentDate) : null);

        const resolvedNextDueDate = (payment?.dueDate || subscription?.nextDueDate)
          ? new Date(payment?.dueDate || subscription?.nextDueDate)
          : (currentBilling.nextDueDate ? new Date(currentBilling.nextDueDate) : null);

        const asaasSubscriptionId = subscription?.id || payment?.subscription || currentBilling.subscriptionId || '';
        const activePlanId = currentBilling.planId || 'performance';

        // A. Atualizar salon billing
        transaction.set(salonRef, {
          billing: {
            ...currentBilling,
            status: billingStatus,
            subscriptionId: asaasSubscriptionId,
            customerId: customerId,
            paymentMethod: payment?.billingType || subscription?.billingType || currentBilling.paymentMethod || 'BOLETO',
            lastPaymentDate: lastPayment ? lastPayment.toISOString() : null,
            nextDueDate: resolvedNextDueDate ? resolvedNextDueDate.toISOString().split('T')[0] : null,
            updatedAt: new Date().toISOString()
          }
        }, { merge: true });

        // B. Atualizar tenant
        transaction.set(tenantRef, {
          id: salonId,
          status: tenantStatus,
          subscriptionStatus: tenantStatus,
          active: tenantStatus === 'active',
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // C. Sincronizar subscription
        transaction.set(subRef, {
          tenantId: salonId,
          provider: 'asaas',
          subscriptionId: asaasSubscriptionId,
          status: billingStatus,
          planId: activePlanId,
          customerId: customerId,
          lastPaymentDate: lastPayment ? lastPayment.toISOString() : null,
          nextDueDate: resolvedNextDueDate ? resolvedNextDueDate.toISOString().split('T')[0] : null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      // Se o evento foi atualizado por subscrição, sincronizar assinatura de forma assíncrona se necessário
      if (event === 'SUBSCRIPTION_UPDATED') {
        try {
          await this.syncSubscription(salonId);
        } catch (syncErr) {
          console.warn(`[BillingService] Falha não-bloqueante na sincronização secundária de assinatura para o salão ${salonId}:`, syncErr);
        }
      }

      // Marcar evento como processado com sucesso na coleção de idempotência
      if (eventId) {
        await adminDb.collection('billing_events').doc(eventId).update({
          processed: true,
          processedAt: new Date().toISOString()
        });
      }

      console.info(`[BillingService] Evento ${event} (${eventId}) processado de forma totalmente transacional e consistente.`);
    } catch (err: any) {
      console.error(`[BillingService] Falha durante a execução lógica ou transacional do evento ${eventId}:`, err);

      // Distinguir erros de infraestrutura temporários dos erros lógicos permanentes
      const isTemporary = this.checkIfTemporaryError(err);
      if (!isTemporary && eventId) {
        console.warn(`[BillingService] Erro permanente detectado. Direcionando evento ${eventId} para a Dead Letter Queue (DLQ).`);
        await this.sendToDeadLetterQueue(eventId, err.message || String(err), payload);
        return; // Retorno limpo (200) para parar as retentativas do Asaas para dados ruins
      }

      throw err; // Relança o erro de infraestrutura para que a Vercel responda com 500 e acione retries automáticos do Asaas
    }
  }

  /**
   * Identifica se o erro é de infraestrutura temporária (e.g., timeouts, limites de cota ou indisponibilidade do Firebase).
   */
  private checkIfTemporaryError(err: any): boolean {
    const errMsg = String(err?.message || err).toLowerCase();
    const temporaryIndicators = [
      'timeout',
      'deadline exceeded',
      'unavailable',
      'resource exhausted',
      'rate limit',
      'connection closed',
      'service unavailable',
      'try again'
    ];
    return temporaryIndicators.some(indicator => errMsg.includes(indicator));
  }

  /**
   * Envia o evento falho de forma limpa para a Dead Letter Queue (DLQ) para fins de auditoria humana.
   */
  private async sendToDeadLetterQueue(eventId: string, errorMsg: string, payload: any): Promise<void> {
    try {
      const adminDb = getAdminDb();
      await adminDb.collection('billing_dlq').doc(eventId).set({
        eventId,
        error: errorMsg,
        payload,
        failedAt: new Date().toISOString(),
        resolved: false
      }, { merge: true });

      await adminDb.collection('billing_events').doc(eventId).set({
        id: eventId,
        processed: false,
        dlq: true,
        error: errorMsg,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.info(`[BillingService] Evento ${eventId} registrado com sucesso na Dead Letter Queue (DLQ).`);
    } catch (dlqErr) {
      console.error(`[BillingService] Erro crítico ao tentar salvar na DLQ para o evento ${eventId}:`, dlqErr);
    }
  }

}

export const billingService = new BillingService();

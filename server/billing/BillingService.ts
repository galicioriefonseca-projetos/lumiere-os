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
    const settings = await this.getSettings();
    let customerId = salonData?.billing?.customerId || salonData?.asaasCustomerId;

    if (customerId) {
      try {
        await asaasProvider.getCustomer(settings.mode, settings.apiKey, customerId);
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes('404')) {
          console.warn(`[Asaas] Cliente ${customerId} não encontrado no Asaas (404). Recriando...`);
          customerId = null;
        } else {
          throw err;
        }
      }
    }

    if (!customerId) {
      const billing = salonData?.billing || {};
      const customerData = billing?.customerData || salonData?.billingData;
      const name = billing?.legalName || customerData?.name || salonData?.name;
      const email = billing?.email || customerData?.email || salonData?.email || salonData?.billingEmail || salonData?.ownerEmail;
      const cpfCnpj = billing?.document || customerData?.cpfCnpj || salonData?.document || salonData?.cnpj;
      const mobilePhone = billing?.mobilePhone || customerData?.mobilePhone || salonData?.phone || salonData?.whatsapp;

      if (!name || !email || !cpfCnpj) {
        throw new Error('Complete nome, e-mail e CPF/CNPJ em Dados de faturamento antes de configurar a forma de pagamento.');
      }

      const postalCode = String(billing?.postalCode || customerData?.postalCode || salonData?.postalCode || '').replace(/\D/g, '');
      const address = String(billing?.address || customerData?.address || salonData?.address || '').trim();
      const addressNumber = String(billing?.addressNumber || customerData?.addressNumber || salonData?.addressNumber || '').trim();
      const complement = String(billing?.complement || customerData?.complement || '').trim();
      const province = String(billing?.province || customerData?.province || salonData?.province || '').trim();

      const customer = await asaasProvider.createCustomer(settings.mode, settings.apiKey, {
        name,
        email,
        cpfCnpj,
        ...(mobilePhone ? { mobilePhone } : {}),
        ...(postalCode ? { postalCode } : {}),
        ...(address ? { address } : {}),
        ...(addressNumber ? { addressNumber } : {}),
        ...(complement ? { complement } : {}),
        ...(province ? { province } : {}),
        externalReference: salonId
      });
      customerId = customer.id;
      await adminDb.collection('salons').doc(salonId).update({
        'billing.provider': 'asaas',
        'billing.customerId': customerId,
        asaasCustomerId: customerId
      });
    }
    return customerId;
  }

  async getPlan(planId: string): Promise<Plan> {
    const normalizedId = planId === 'performance_plus' ? 'performance' : planId;
    const officialCatalog: Record<string, Plan> = {
      essential: {
        id: 'essential',
        name: 'Essencial',
        description: 'Operação, clientes e caixa básico',
        price: 197,
        semiannualPrice: Math.round(197 * 6 * 0.9),
        annualPrice: Math.round(197 * 12 * 0.85),
        billingCycle: 'MONTHLY',
        trialDays: 0,
        features: ['Agenda e gestão de horários', 'Cadastro de clientes', 'Serviços e produtos', 'Controle básico de caixa'],
        active: true,
        legacy: false,
        displayOrder: 1,
        maxProfessionals: 5,
      } as Plan,
      professional: {
        id: 'professional',
        name: 'Gestão',
        description: 'Equipes, metas, comissões e DRE',
        price: 397,
        semiannualPrice: Math.round(397 * 6 * 0.9),
        annualPrice: Math.round(397 * 12 * 0.85),
        billingCycle: 'MONTHLY',
        trialDays: 0,
        features: ['Tudo do Essencial', 'Gestão de equipe e funções', 'Metas e comissões', 'Financeiro completo'],
        active: true,
        legacy: false,
        displayOrder: 2,
        maxProfessionals: 15,
      } as Plan,
      performance: {
        id: 'performance',
        name: 'Performance',
        description: 'Gestão completa + Lumi IA 24/7',
        price: 597,
        semiannualPrice: Math.round(597 * 6 * 0.9),
        annualPrice: Math.round(597 * 12 * 0.85),
        billingCycle: 'MONTHLY',
        trialDays: 0,
        features: ['Tudo do Gestão', 'Lumi — IA para apoio à gestão', 'Insights automáticos', 'Automação avançada'],
        active: true,
        legacy: false,
        displayOrder: 3,
        maxProfessionals: 30,
      } as Plan,
      multiunit: {
        id: 'multiunit',
        name: 'Multiunidade',
        description: 'Múltiplas empresas, polos e filiais',
        price: 897,
        semiannualPrice: Math.round(897 * 6 * 0.9),
        annualPrice: Math.round(897 * 12 * 0.85),
        billingCycle: 'MONTHLY',
        trialDays: 0,
        features: ['Tudo do Performance', 'Gestão de múltiplas unidades', 'Dashboard consolidado', 'Suporte VIP'],
        active: true,
        legacy: false,
        displayOrder: 4,
        maxProfessionals: 60,
      } as Plan,
    };

    if (normalizedId === 'founder') {
      throw new Error('O plano Founder foi descontinuado e não está mais disponível.');
    }

    const adminDb = getAdminDb();
    if (officialCatalog[normalizedId]) {
      const catalogPlan = officialCatalog[normalizedId];
      try {
        await adminDb.collection('plans').doc(normalizedId).set(catalogPlan, { merge: true });
      } catch (e) {
        console.warn('[BillingService] Aviso ao sincronizar plano no Firestore:', e);
      }
      return catalogPlan;
    }

    const planDoc = await adminDb.collection('plans').doc(normalizedId).get();
    if (!planDoc.exists) throw new Error(`Plano ${planId} não encontrado.`);
    return { id: planDoc.id, ...planDoc.data() } as Plan;
  }

  async validateCoupon(rawCode: string): Promise<{ valid: boolean; code: string; planId: string; price: number; error?: string }> {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) {
      return { valid: false, code: '', planId: 'performance', price: 597, error: 'Informe um código de cupom.' };
    }

    const adminDb = getAdminDb();
    const couponRef = adminDb.collection('coupons').doc(code);
    let couponSnap = await couponRef.get();

    // Garante que o cupom oficial ANGULARGF esteja provisionado na coleção coupons
    if (code === 'ANGULARGF' && !couponSnap.exists) {
      const defaultCoupon = {
        code: 'ANGULARGF',
        planId: 'performance',
        planName: 'Performance',
        originalPrice: 597,
        discountPercent: 100,
        active: true,
        isValid: true,
        createdAt: Date.now(),
        expiresAt: null,
      };
      await couponRef.set(defaultCoupon, { merge: true });
      couponSnap = await couponRef.get();
    }

    if (!couponSnap.exists) {
      return { valid: false, code, planId: 'performance', price: 597, error: 'Cupom de desconto inválido ou não encontrado.' };
    }

    const data = couponSnap.data() || {};
    const isActive = data.active !== false && data.isValid !== false;
    const isExpired = data.expiresAt && new Date(data.expiresAt).getTime() < Date.now();

    if (!isActive || isExpired) {
      return { valid: false, code, planId: 'performance', price: 597, error: 'Este cupom de desconto está inativo ou expirado.' };
    }

    return {
      valid: true,
      code,
      planId: String(data.planId || 'performance'),
      price: Number(data.originalPrice || 597),
    };
  }

  async activateWithCoupon(params: {
    salonId: string;
    userId: string;
    couponCode: string;
    billingCycle?: string;
    ownerName?: string;
    email?: string;
    phone?: string;
    document?: string;
    salonName?: string;
    businessType?: string;
    city?: string;
    state?: string;
  }) {
    const validation = await this.validateCoupon(params.couponCode);
    if (!validation.valid) {
      throw new Error(validation.error || 'Cupom inválido.');
    }

    const adminDb = getAdminDb();
    const plan = await this.getPlan('performance');
    const now = Date.now();
    const selectedCycle = String(params.billingCycle || 'MONTHLY').toUpperCase();

    const salonRef = adminDb.collection('salons').doc(params.salonId);
    const salonSnap = await salonRef.get();
    const existingSalon = salonSnap.exists ? salonSnap.data() || {} : {};

    const ownerName = String(params.ownerName || existingSalon.ownerName || 'Proprietário').trim();
    const email = String(params.email || existingSalon.ownerEmail || existingSalon.billingEmail || '').trim().toLowerCase();
    const phone = String(params.phone || existingSalon.phone || '').trim();
    const document = String(params.document || existingSalon.document || existingSalon.billing?.document || '').replace(/\D/g, '');
    const salonName = String(params.salonName || existingSalon.name || `Estabelecimento de ${ownerName}`).trim();
    const isAlreadyOnboarded = existingSalon.onboardingCompleted === true;

    const nextDue = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const updatedSalonData = {
      ...existingSalon,
      id: params.salonId,
      name: salonName,
      ownerName,
      ownerId: params.userId || existingSalon.ownerId || '',
      ownerEmail: email,
      billingEmail: email,
      phone,
      ...(document ? { document } : {}),
      businessType: params.businessType || existingSalon.businessType || 'salon',
      city: params.city ?? existingSalon.city ?? '',
      state: params.state ?? existingSalon.state ?? '',
      plan: 'performance',
      status: 'active',
      subscriptionStatus: 'active',
      activationStatus: 'active',
      paymentStatus: 'paid',
      isActive: true,
      onboardingCompleted: isAlreadyOnboarded,
      onboardingStatus: isAlreadyOnboarded ? 'completed' : 'pending_setup',
      professionalsLimit: 30,
      professionalLimit: 30,
      maxProfessionals: 30,
      couponUsed: validation.code,
      billingProvider: 'coupon',
      billing: {
        ...(existingSalon.billing || {}),
        provider: 'coupon',
        couponCode: validation.code,
        status: 'ACTIVE',
        planId: 'performance',
        billingCycle: selectedCycle,
        value: 0,
        originalValue: Number(plan.price || 597),
        paymentMethod: 'COUPON',
        nextDueDate: nextDue,
        ...(document ? { document } : {}),
        ...(ownerName ? { legalName: ownerName } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { mobilePhone: phone } : {}),
        updatedAt: new Date(now).toISOString(),
      },
      createdAt: existingSalon.createdAt || now,
      updatedAt: now,
    };

    await salonRef.set(updatedSalonData, { merge: true });

    if (params.userId) {
      await adminDb.collection('users').doc(params.userId).set(
        {
          id: params.userId,
          email,
          fullName: ownerName,
          name: ownerName,
          phone,
          role: 'owner',
          salonId: params.salonId,
          isActive: true,
          status: 'active',
          onboardingStatus: isAlreadyOnboarded ? 'completed' : 'pending_setup',
          updatedAt: now,
        },
        { merge: true }
      );
    }

    // Sincronizar collections auxiliares de tenant e subscription
    await adminDb.collection('tenants').doc(params.salonId).set(
      {
        id: params.salonId,
        status: 'active',
        subscriptionStatus: 'active',
        active: true,
        planId: 'performance',
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true }
    );

    await adminDb.collection('subscriptions').doc(params.salonId).set(
      {
        tenantId: params.salonId,
        provider: 'coupon',
        couponCode: validation.code,
        status: 'ACTIVE',
        planId: 'performance',
        billingCycle: selectedCycle,
        value: 0,
        originalValue: 597,
        nextDueDate: nextDue,
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true }
    );

    // Registrar pagamento gratuito via cupom
    const paymentId = `coupon_${validation.code}_${now}`;
    await adminDb.collection(`salons/${params.salonId}/payments`).doc(paymentId).set({
      id: paymentId,
      salonId: params.salonId,
      plan: 'performance',
      amount: 0,
      value: 0,
      originalValue: 597,
      description: `Assinatura Plano Performance (R$ 597,00) — Cupom ${validation.code} (100% OFF)`,
      status: 'paid',
      paymentStatus: 'paid_via_coupon',
      method: 'COUPON',
      paymentMethod: 'COUPON',
      billingType: 'COUPON',
      couponCode: validation.code,
      dueDate: new Date(now).toISOString().slice(0, 10),
      paidAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Registrar histórico de auditoria
    const historyRef = adminDb.collection(`salons/${params.salonId}/billingHistory`).doc();
    await historyRef.set({
      id: historyRef.id,
      salonId: params.salonId,
      action: 'coupon_applied',
      description: `Cupom ${validation.code} aplicado: Plano Performance (R$ 597,00/mês) ativado gratuitamente.`,
      couponCode: validation.code,
      planId: 'performance',
      amount: 0,
      originalAmount: 597,
      timestamp: now,
      createdAt: now,
    });

    return {
      salonId: params.salonId,
      planId: 'performance',
      couponCode: validation.code,
      onboardingCompleted: isAlreadyOnboarded,
    };
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
    const currentBilling = data?.billing || {};
    const currentPlanId = currentBilling.planId || data?.plan;
    const plan = await this.getPlan(newPlanId);
    const settings = await this.getSettings();
    const cycle = (currentBilling.billingCycle || 'MONTHLY') as BillingCycle;
    const value = this.resolvePlanPricing(plan, cycle);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`O plano ${newPlanId} não possui preço válido para a periodicidade ${cycle}.`);
    if (currentPlanId === newPlanId) throw new Error('O estabelecimento já está neste plano.');

    let sub: any = null;
    const isCancelledLocally = currentBilling.status === 'CANCELLED' || currentBilling.providerStatus === 'INACTIVE';

    if (subscriptionId && !isCancelledLocally) {
      try {
        sub = await asaasProvider.updateSubscription(settings.mode, settings.apiKey, subscriptionId, {
          value,
          cycle,
          description: `Assinatura ${plan.name} - LumièreOS`,
          updatePendingPayments: true
        });
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes('404')) {
          console.warn(`[BillingService] Assinatura ${subscriptionId} não encontrada no Asaas (404). Criando nova assinatura...`);
          sub = null;
        } else {
          throw err;
        }
      }
    }

    if (!sub) {
      const customerId = await this.ensureCustomer(salonId, data);
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + (plan.trialDays || 3));
      sub = await asaasProvider.createSubscription(settings.mode, settings.apiKey, {
        customer: customerId,
        billingType: data?.billing?.paymentMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD',
        value,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        cycle,
        description: `Assinatura ${plan.name} - LumièreOS`,
        externalReference: salonId
      });
    }

    // A alteração fica pendente até confirmação financeira pelo webhook.
    // O plano atual continua sendo a fonte de acesso enquanto o novo pagamento não for confirmado.
    await adminDb.collection('salons').doc(salonId).update({
      'billing.provider': 'asaas',
      'billing.customerId': sub.customer || data?.billing?.customerId,
      'billing.subscriptionId': sub.id,
      'billing.pendingPlanId': newPlanId,
      'billing.pendingPlanValue': value,
      'billing.billingCycle': cycle,
      'billing.status': 'PENDING_PAYMENT',
      'billing.providerStatus': sub.status,
      'billing.nextDueDate': sub.nextDueDate,
      'billing.updatedAt': new Date().toISOString()
    });
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
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
        const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
        if (pendingPayment?.invoiceUrl) {
          return pendingPayment.invoiceUrl;
        }
      } catch (err) {
        console.warn(`[Asaas] Tentativa ${attempt + 1} de buscar pagamentos da assinatura ${subscriptionId} falhou:`, err);
      }
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    return null;
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

    const customerId = payload.payment?.customer || payload.subscription?.customer || payload.checkout?.customer || payload.customer;

    let salonId = '';
    try {
      const externalRef = String(
        payload.checkout?.externalReference ||
        payload.subscription?.externalReference ||
        payload.payment?.externalReference ||
        ''
      );

      if (externalRef) {
        const cleanRef = externalRef.startsWith('manual-migration:') ? externalRef.slice('manual-migration:'.length) : externalRef;
        const directDoc = await adminDb.collection('salons').doc(cleanRef).get();
        if (directDoc.exists) salonId = directDoc.id;
      }

      if (!salonId && payload.checkout?.id) {
        const checkoutSnapshot = await adminDb.collection('salons')
          .where('billing.checkoutId', '==', payload.checkout.id)
          .limit(1)
          .get();
        if (checkoutSnapshot.docs?.[0]?.exists) salonId = checkoutSnapshot.docs[0].id;
      }

      if (!salonId && customerId) {
        const salonsSnapshot = await adminDb.collection('salons').where('billing.customerId', '==', customerId).limit(1).get();
        let salonDoc = salonsSnapshot.docs[0];
        if (!salonDoc) {
          const legacySnapshot = await adminDb.collection('salons').where('asaasCustomerId', '==', customerId).limit(1).get();
          salonDoc = legacySnapshot.docs[0];
        }
        if (salonDoc) salonId = salonDoc.id;
      }

      if (!salonId) {
        const errorMsg = `Nenhum estabelecimento encontrado para o payload do Asaas (customerId: ${customerId || 'N/A'}, ref: ${externalRef || 'N/A'})`;
        if (eventId) await this.sendToDeadLetterQueue(eventId, errorMsg, payload);
        return;
      }
    } catch (err) { throw err; }

    try {
      const payment = payload.payment;
      const subscription = payload.subscription;
      let billingStatus: 'ACTIVE' | 'OVERDUE' | 'CANCELLED' | null = null;
      let tenantStatus: 'active' | 'overdue' | 'cancelled' | null = null;
      switch (event) {
        case 'CHECKOUT_PAID':
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED': billingStatus = 'ACTIVE'; tenantStatus = 'active'; break;
        case 'SUBSCRIPTION_CREATED': billingStatus = 'ACTIVE'; tenantStatus = 'active'; break;
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
        const isPaymentConfirmed = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || event === 'CHECKOUT_PAID';
        const lastPayment = isPaymentConfirmed ? now : (currentBilling.lastPaymentDate ? new Date(currentBilling.lastPaymentDate) : null);
        const resolvedNextDueDate = (payment?.dueDate || subscription?.nextDueDate) ? new Date(payment?.dueDate || subscription?.nextDueDate) : (currentBilling.nextDueDate ? new Date(currentBilling.nextDueDate) : null);
        const asaasSubscriptionId = subscription?.id || payment?.subscription || payload.checkout?.subscription?.id || payload.checkout?.subscription || currentBilling.subscriptionId || '';
        const activePlanId = currentBilling.planId || salonData?.plan || 'essential';
        const billingUpdate: any = { ...currentBilling, updatedAt: now.toISOString(), ...(customerId ? { customerId } : {}) };
        if (billingStatus) billingUpdate.status = billingStatus;
        if (asaasSubscriptionId) billingUpdate.subscriptionId = asaasSubscriptionId;
        if (payment?.billingType || subscription?.billingType) billingUpdate.paymentMethod = payment?.billingType || subscription?.billingType;
        if (lastPayment) billingUpdate.lastPaymentDate = lastPayment.toISOString();
        if (resolvedNextDueDate) billingUpdate.nextDueDate = resolvedNextDueDate.toISOString().split('T')[0];
        if (subscription?.status) billingUpdate.providerStatus = subscription.status;
        if (subscription?.cycle) billingUpdate.billingCycle = subscription.cycle;
        if (payment?.value != null) billingUpdate.value = Number(payment.value);
        else if (subscription?.value != null) billingUpdate.value = Number(subscription.value);

        if (isPaymentConfirmed && currentBilling.pendingPlanId) {
          const confirmedPlanId = currentBilling.pendingPlanId;
          billingUpdate.planId = confirmedPlanId;
          billingUpdate.value = currentBilling.pendingPlanValue ?? billingUpdate.value;
          delete billingUpdate.pendingPlanId;
          delete billingUpdate.pendingPlanValue;
          transaction.set(salonRef, { plan: confirmedPlanId }, { merge: true });
        }

        const salonDataUpdate: any = { billing: billingUpdate };
        if (tenantStatus === 'active' || isPaymentConfirmed) {
          salonDataUpdate.status = 'active';
          salonDataUpdate.subscriptionStatus = 'active';
          salonDataUpdate.activationStatus = 'active';
          salonDataUpdate.isActive = true;
          salonDataUpdate.paymentStatus = 'confirmed';
          if (salonData?.onboardingCompleted !== true) {
            salonDataUpdate.onboardingStatus = 'pending_setup';
          }
        }
        transaction.set(salonRef, salonDataUpdate, { merge: true });
        if (tenantStatus) transaction.set(tenantRef, { id: salonId, status: tenantStatus, subscriptionStatus: tenantStatus, active: tenantStatus === 'active', updatedAt: now.toISOString() }, { merge: true });
        transaction.set(subRef, { tenantId: salonId, provider: 'asaas', subscriptionId: asaasSubscriptionId, status: billingStatus || currentBilling.status || 'PENDING_PAYMENT', planId: isPaymentConfirmed && currentBilling.pendingPlanId ? currentBilling.pendingPlanId : activePlanId, customerId, billingCycle: subscription?.cycle || currentBilling.billingCycle || 'MONTHLY', value: subscription?.value != null ? Number(subscription.value) : currentBilling.value || null, lastPaymentDate: lastPayment ? lastPayment.toISOString() : currentBilling.lastPaymentDate || null, nextDueDate: resolvedNextDueDate ? resolvedNextDueDate.toISOString().split('T')[0] : currentBilling.nextDueDate || null, updatedAt: now.toISOString() }, { merge: true });

        // Promote pending owner to full owner upon payment confirmation
        if (tenantStatus === 'active' && salonData?.ownerId) {
          const userRef = adminDb.collection('users').doc(salonData.ownerId);
          transaction.set(userRef, { role: 'owner', onboardingStatus: salonData?.onboardingCompleted ? 'completed' : 'pending_setup' }, { merge: true });
        }

        // Registrar / Atualizar cobrança na subcoleção salons/{salonId}/payments
        if (payment?.id || isPaymentConfirmed) {
          const paymentId = String(payment?.id || `asaas_pay_${now.getTime()}`);
          const payRef = adminDb.collection(`salons/${salonId}/payments`).doc(paymentId);
          const payVal = payment?.value != null ? Number(payment.value) : (billingUpdate.value || 0);
          const payStatus = isPaymentConfirmed ? 'PAID' : (event === 'PAYMENT_OVERDUE' ? 'OVERDUE' : 'PENDING');
          const payMethod = payment?.billingType || subscription?.billingType || billingUpdate.paymentMethod || 'CREDIT_CARD';
          const payDue = payment?.dueDate || resolvedNextDueDate?.toISOString().split('T')[0] || billingUpdate.nextDueDate || now.toISOString().split('T')[0];
          
          transaction.set(payRef, {
            id: paymentId,
            salonId,
            plan: billingUpdate.planId || activePlanId,
            amount: payVal,
            value: payVal,
            description: payment?.description || `Mensalidade LumièreOS — Asaas (${payMethod})`,
            status: payStatus,
            dueDate: payDue,
            paymentMethod: payMethod,
            billingType: payMethod,
            invoiceUrl: payment?.invoiceUrl || payment?.bankSlipUrl || null,
            invoicePdf: payment?.invoicePdf || null,
            paidAt: isPaymentConfirmed ? now.getTime() : null,
            updatedAt: now.getTime()
          }, { merge: true });

          // Registrar no histórico de alterações
          const historyRef = adminDb.collection(`salons/${salonId}/billingHistory`).doc();
          transaction.set(historyRef, {
            id: historyRef.id,
            salonId,
            action: isPaymentConfirmed ? 'asaas_payment_confirmed' : `asaas_event_${event.toLowerCase()}`,
            description: `Evento Asaas (${event}) processado. Método: ${payMethod}. Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payVal)}. Status: ${payStatus}`,
            timestamp: now.getTime(),
            amount: payVal,
            paymentMethod: payMethod,
            dueDate: payDue,
            createdAt: now.getTime()
          });
        }
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

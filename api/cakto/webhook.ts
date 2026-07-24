import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, isFirebaseAdminCredentialError } from "../_shared/firebaseAdmin.js";

interface CaktoSettings {
  productId: string;
  startOfferId: string;
  founderOfferId: string;
  performanceOfferId: string;
  networkOfferId: string;
  enterpriseOfferId: string;
  updatedAt?: number;
}

async function getCaktoSettingsCached(adminDb: any): Promise<CaktoSettings> {
  const docRef = adminDb.collection("settings").doc("cakto");
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return {
      productId: data?.productId || "",
      startOfferId: data?.startOfferId || "",
      founderOfferId: data?.founderOfferId || "",
      performanceOfferId: data?.performanceOfferId || "",
      networkOfferId: data?.networkOfferId || "",
      enterpriseOfferId: data?.enterpriseOfferId || "",
      updatedAt: data?.updatedAt
    };
  }
  throw new Error("Settings document 'cakto' not found.");
}


export async function processCaktoWebhookPayload(normalizedData: any, homologationMode = false, logOnly = false) {
  const adminDb = getAdminDb();
  
  const eventName = normalizedData.event || normalizedData.eventType || normalizedData.status || normalizedData.event_type;
  if (!eventName) {
    return { success: false, requiresReview: true, reason: "missing_event_name" };
  }

  const orderId = normalizedData.order_id || normalizedData.orderId || normalizedData.id;
  const subscriptionId = normalizedData.subscription_id || normalizedData.subscriptionId;
  const customerId = normalizedData.customer_id || normalizedData.customerId || normalizedData.customer?.id;
  const salonId = normalizedData.external_id || normalizedData.externalId;
  const customerEmail = String(normalizedData.customer?.email || normalizedData.customerEmail || "").trim().toLowerCase();
  const offerId = String(normalizedData.offer_id || normalizedData.offerId || normalizedData.checkout_offer_id || "").trim();

  const isTestEvent = !orderId && !subscriptionId && !salonId && !customerEmail;
  if (isTestEvent) {
    return { success: true, info: "Webhook de teste/ping recebido com sucesso.", testEvent: true, salonFound: false };
  }

  // 1. Geração de ID de Evento Estável e Sem Date.now
  const crypto = require('crypto');
  const eventIdRaw = normalizedData.event_id || normalizedData.eventId;
  let eventId = eventIdRaw;
  if (!eventId) {
    const stableString = `${eventName || ""}_${orderId || ""}_${subscriptionId || ""}_${salonId || ""}_${offerId || ""}_${customerEmail || ""}`;
    eventId = "evt_" + crypto.createHash('md5').update(stableString).digest('hex');
  }

  try {
    // 2. Idempotência atômica / Controle de Webhook
    let eventRef: any = null;
    if (!homologationMode && !logOnly) {
      eventRef = adminDb.collection("billingWebhookEvents").doc(eventId);
      const claimResult = await adminDb.runTransaction(async (transaction: any) => {
        const now = Date.now();
        const eventDoc = await transaction.get(eventRef);
        const evData = eventDoc.exists ? (eventDoc.data() || {}) : {};
        const status = evData.status;
        const updatedAt = Number(evData.updatedAt || evData.createdAt || 0);
        const isRecent = now - updatedAt < 300000;

        if (eventDoc.exists && status === "processed") return { state: "duplicate" };
        if (eventDoc.exists && status === "processing" && isRecent) return { state: "processing" };
        if (eventDoc.exists && status === "review_required") return { state: "review_required" };
        if (eventDoc.exists && !["failed_retryable", "processing"].includes(status)) {
          return { state: "invalid_event_state" };
        }

        transaction.set(eventRef, {
          status: "processing",
          eventName: String(eventName),
          orderId: orderId ? String(orderId) : null,
          subscriptionId: subscriptionId ? String(subscriptionId) : null,
          salonId: salonId ? String(salonId) : null,
          attempts: Number(evData.attempts || 0) + 1,
          createdAt: evData.createdAt || now,
          updatedAt: now
        }, { merge: true });
        return { state: "claimed" };
      });

      if (claimResult.state === "duplicate") {
        return { success: true, info: "Evento duplicado já processado.", eventProcessed: eventName, duplicate: true };
      }
      if (claimResult.state === "processing") {
        return { success: true, processing: true, info: "Evento ainda em processamento recente." };
      }
      if (claimResult.state === "review_required") {
        return { success: false, requiresReview: true, reason: "review_required" };
      }
      if (claimResult.state === "invalid_event_state") {
        return { success: false, requiresReview: true, reason: "invalid_event_state" };
      }
    }

    // Carregar configurações da Cakto. Se falhar, vai disparar um throw que cairá no catch geral.
    const sData = await getCaktoSettingsCached(adminDb);
    let mappedPlan = null;
    if (offerId) {
      const offId = offerId.trim();
      if (sData.startOfferId === offId) mappedPlan = "start";
      else if (sData.founderOfferId === offId) mappedPlan = "founder";
      else if (sData.performanceOfferId === offId) mappedPlan = "performance";
      else if (sData.networkOfferId === offId) mappedPlan = "network";
      else if (sData.enterpriseOfferId === offId) mappedPlan = "enterprise";
    }

    // Validação de tipo de evento
    const ev = String(eventName).toLowerCase();
    const APPROVED_EVENTS = new Set(["purchase_approved", "subscription_renewed"]);
    const REFUSED_EVENTS = new Set(["purchase_refused", "subscription_renewal_refused"]);
    const CANCELED_EVENTS = new Set(["subscription_canceled", "refund", "chargeback"]);
    const CREATED_EVENTS = new Set(["subscription_created", "trial"]);

    let category = "unknown";
    if (APPROVED_EVENTS.has(ev)) category = "approved";
    else if (REFUSED_EVENTS.has(ev)) category = "refused";
    else if (CANCELED_EVENTS.has(ev)) category = "canceled";
    else if (CREATED_EVENTS.has(ev)) category = "created";
    else {
      if (!homologationMode && !logOnly && eventRef) {
        await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: "unknown_event" });
      }
      return { success: false, requiresReview: true, reason: "unknown_event" };
    }

    if (!mappedPlan) {
      if (!homologationMode && !logOnly && eventRef) {
        await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: "unknown_offer" });
      }
      return { success: false, requiresReview: true, reason: "unknown_offer" };
    }

    const PLAN_LIMITS: Record<string, number> = {
      start: 5,
      founder: 22,
      performance: 20,
      network: 999,
      enterprise: 9999
    };
    const mappedPlanLimit = PLAN_LIMITS[mappedPlan] || 5;

    // 3. Localização do Salão e Correlação Segura
    let salonDoc = null;
    let salonRef = null;

    // Buscar por subscriptionId se houver
    if (subscriptionId) {
      const snapshot = await adminDb.collection("salons")
        .where("caktoSubscriptionId", "==", String(subscriptionId))
        .limit(2).get();
      if (snapshot.size === 1) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      } else if (snapshot.size > 1) {
        if (!homologationMode && !logOnly && eventRef) {
          await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: 'ambiguous_salon_match' });
        }
        return { success: false, requiresReview: true, reason: "ambiguous_salon_match" };
      }
    }

    // Se não encontrou e temos salonId, buscar por salonId
    if (!salonDoc && salonId) {
      salonRef = adminDb.collection("salons").doc(String(salonId));
      salonDoc = await salonRef.get();
    }

    // Validação de Correlação Segura e Renovação
    if (salonDoc && salonDoc.exists) {
      const isRenewal = ev === "subscription_renewed" || ev.includes("renew");
      
      if (isRenewal) {
        // Para renovação: localizar obrigatoriamente por caktoSubscriptionId. Se não bater, mismatch.
        const sData = salonDoc.data() || {};
        if (sData.caktoSubscriptionId !== subscriptionId) {
          if (!homologationMode && !logOnly && eventRef) {
            await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: 'correlation_mismatch' });
          }
          return { success: false, requiresReview: true, reason: "correlation_mismatch" };
        }
      } else if (category === "approved" || category === "created") {
        // Nova assinatura/ativação recorrente exige intenção completa criada pelo checkout autenticado.
        const currentSalon = salonDoc.data() || {};
        const pendingPlan = String(currentSalon.pendingPlan || "").trim();
        const pendingOffer = String(currentSalon.pendingOfferId || "").trim();
        const pendingEmail = String(currentSalon.pendingCheckoutEmail || "").trim().toLowerCase();
        const pendingPurpose = String(currentSalon.pendingCheckoutPurpose || "").trim();
        const pendingRequestedAt = Number(currentSalon.pendingRequestedAt || 0);
        const allowedPurposes = new Set(["activate_recurring", "regularize_payment", "plan_change"]);

        if (!pendingPlan || !pendingOffer || !pendingEmail || !pendingPurpose || !pendingRequestedAt) {
          if (eventRef) await eventRef.update({ status: "review_required", updatedAt: Date.now(), reason: "missing_checkout_intent" });
          return { success: false, requiresReview: true, reason: "missing_checkout_intent" };
        }
        if (!allowedPurposes.has(pendingPurpose) || pendingPlan !== mappedPlan || pendingOffer !== offerId || !customerEmail || pendingEmail !== customerEmail) {
          if (eventRef) await eventRef.update({ status: "review_required", updatedAt: Date.now(), reason: "correlation_mismatch" });
          return { success: false, requiresReview: true, reason: "correlation_mismatch" };
        }
      }
    }

    // 4. Tratamento do Homologation Mode
    if (homologationMode) {
      if (!salonDoc || !salonDoc.exists || !salonRef) {
        // Se homologationMode === true, exigir salão existente; nunca criar onboarding; nunca criar salão;
        return { success: false, requiresReview: true, reason: "onboarding_not_found" };
      }

      const homologationPayload = buildHomologationWebhookUpdate({
        eventName,
        eventId,
        orderId,
        subscriptionId,
        customerId,
        offerId,
        normalizedData
      });

      if (logOnly) {
        return {
          success: true,
          preview: homologationPayload
        };
      }

      await salonRef.update(homologationPayload);

      return {
        success: true,
        salonUpdated: true,
        homologation: true,
        plan: salonDoc.data()?.plan || "start",
        status: salonDoc.data()?.subscriptionStatus || "active",
        firestorePath: `salons/${salonDoc.id}`
      };
    }

    // Se logOnly estiver ativado em produção (não deve ser comum, mas suportamos de forma segura)
    if (logOnly) {
      return {
        success: true,
        logOnly: true,
        info: "Operação logOnly sem gravação."
      };
    }

    // 5. Construção do Payload de Atualização de Produção
    const realUpdatePayload: any = {
      caktoLastEventId: eventId,
      caktoLastEvent: eventName,
      updatedAt: Date.now()
    };
    if (orderId) realUpdatePayload.caktoOrderId = String(orderId);
    if (subscriptionId) realUpdatePayload.caktoSubscriptionId = String(subscriptionId);
    if (customerId) realUpdatePayload.caktoCustomerId = String(customerId);
    if (offerId) realUpdatePayload.caktoOfferId = offerId;

    const paymentMethodVal = String(normalizedData.payment_method || normalizedData.paymentMethod || normalizedData.billing_type || normalizedData.billingType || "").trim();
    const rawAmount = Number(normalizedData.amount ?? normalizedData.value ?? normalizedData.price ?? 0);
    const paymentAmount = Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;

    if (category === "approved") {
      realUpdatePayload.billingProvider = "cakto";
      realUpdatePayload.subscriptionStatus = "active";
      realUpdatePayload.activationStatus = "active";
      realUpdatePayload.caktoPaymentStatus = "paid";
      realUpdatePayload.paymentStatus = "paid";
      realUpdatePayload.plan = mappedPlan;
      realUpdatePayload.isActive = true;

      if (paymentMethodVal) realUpdatePayload.paymentMethod = paymentMethodVal;

      const hasValidSubscription = subscriptionId && typeof subscriptionId === "string" && subscriptionId.trim().length > 0 && !subscriptionId.includes("manual");
      realUpdatePayload.billingMode = hasValidSubscription ? "recurring_gateway" : "one_time_gateway";
      if (!hasValidSubscription) {
        realUpdatePayload.billingSyncRequired = true;
        realUpdatePayload.billingSyncReason = "recurring_subscription_not_confirmed";
      }
      realUpdatePayload.professionalsLimit = mappedPlanLimit;
      realUpdatePayload.professionalLimit = mappedPlanLimit;
      realUpdatePayload.maxProfessionals = mappedPlanLimit;
      
      realUpdatePayload.pendingPlan = null;
      realUpdatePayload.pendingOfferId = null;
      realUpdatePayload.pendingCheckoutUrl = null;
      realUpdatePayload.pendingCheckoutEmail = null;
      realUpdatePayload.pendingRequestedAt = null;
      realUpdatePayload.pendingCheckoutPurpose = null;
      realUpdatePayload.pendingBillingActivation = null;
      
      if (customerEmail) realUpdatePayload.caktoCheckoutEmail = customerEmail;

      const periodEnd = normalizedData.current_period_end || normalizedData.next_billing_date || normalizedData.nextBillingDate;
      if (periodEnd) {
        const ms = new Date(periodEnd).getTime();
        if (!isNaN(ms)) {
          realUpdatePayload.nextBillingDate = ms;
          realUpdatePayload.currentPeriodEnd = periodEnd;
        } else {
          realUpdatePayload.billingSyncRequired = true;
          realUpdatePayload.billingSyncReason = "missing_next_billing_date";
        }
      } else {
        realUpdatePayload.billingSyncRequired = true;
        realUpdatePayload.billingSyncReason = "missing_next_billing_date";
      }
      realUpdatePayload.lastPaymentAt = Date.now();
      realUpdatePayload.lastPaymentAmount = paymentAmount;
    } else if (category === "canceled") {
      const currentEnd = (salonDoc && salonDoc.exists) ? salonDoc.data()?.currentPeriodEnd : null;
      const currentEndMs = currentEnd ? new Date(currentEnd).getTime() : 0;
      const hasPaidPeriod = ev === "subscription_canceled" && Number.isFinite(currentEndMs) && currentEndMs > Date.now();

      realUpdatePayload.caktoPaymentStatus = "canceled";
      realUpdatePayload.cancellationRequestedAt = Date.now();
      if (hasPaidPeriod) {
        realUpdatePayload.cancelAtPeriodEnd = true;
        realUpdatePayload.subscriptionStatus = "active";
        realUpdatePayload.paymentStatus = salonDoc.data()?.paymentStatus || "paid";
        realUpdatePayload.activationStatus = salonDoc.data()?.activationStatus || "active";
        realUpdatePayload.isActive = true;
      } else {
        realUpdatePayload.cancelAtPeriodEnd = false;
        realUpdatePayload.subscriptionStatus = "canceled";
        realUpdatePayload.activationStatus = "canceled";
        realUpdatePayload.paymentStatus = "canceled";
        realUpdatePayload.isActive = false;
      }
    } else if (category === "refused") {
      realUpdatePayload.subscriptionStatus = "overdue";
      realUpdatePayload.caktoPaymentStatus = "refused";
      realUpdatePayload.paymentStatus = "overdue";
      realUpdatePayload.billingSyncRequired = true;
      realUpdatePayload.billingSyncReason = "payment_refused";
      
      const currentEnd = (salonDoc && salonDoc.exists) ? salonDoc.data()?.currentPeriodEnd : null;
      let isPeriodActive = false;
      if (currentEnd) {
         const ms = new Date(currentEnd).getTime();
         if (!isNaN(ms) && ms > Date.now()) isPeriodActive = true;
      }
      if (!isPeriodActive) {
        realUpdatePayload.activationStatus = "blocked";
      }
    } else if (category === "created") {
      if (salonDoc && salonDoc.exists) {
        const currentStatus = salonDoc.data()?.subscriptionStatus;
        if (currentStatus !== "active" && currentStatus !== "preview") {
          realUpdatePayload.subscriptionStatus = "pending";
        }
        realUpdatePayload.caktoPaymentStatus = "pending";
        realUpdatePayload.paymentStatus = "pending";
      }
    }

    const appendBillingRecords = (batch: any, targetSalonRef: any, targetSalonId: string) => {
      const statusByCategory: Record<string, string> = {
        approved: "paid",
        refused: "overdue",
        canceled: "canceled",
        created: "pending"
      };
      const paymentRef = targetSalonRef.collection("payments").doc(String(eventId));
      const historyRef = targetSalonRef.collection("billingHistory").doc(String(eventId));
      const createdAt = Date.now();

      batch.set(paymentRef, {
        id: String(eventId),
        salonId: targetSalonId,
        provider: "cakto",
        origin: "webhook",
        status: statusByCategory[category] || "pending",
        method: paymentMethodVal || "not_informed",
        amount: paymentAmount,
        plan: mappedPlan,
        eventType: ev,
        orderId: orderId ? String(orderId) : null,
        subscriptionId: subscriptionId ? String(subscriptionId) : null,
        offerId: offerId || null,
        customerId: customerId ? String(customerId) : null,
        createdAt,
        paidAt: category === "approved" ? createdAt : null
      }, { merge: true });

      batch.set(historyRef, {
        id: String(eventId),
        eventType: category === "approved" ? "charge_approved" : category === "refused" ? "charge_refused" : category === "canceled" ? "canceled" : "subscription_created",
        title: category === "approved" ? "Pagamento aprovado" : category === "refused" ? "Pagamento não aprovado" : category === "canceled" ? "Assinatura cancelada" : "Assinatura criada",
        description: `Evento ${ev} recebido e validado pelo gateway Cakto.`,
        amount: paymentAmount,
        paymentMethod: paymentMethodVal || "not_informed",
        provider: "cakto",
        recordedBy: "Cakto Webhook",
        timestamp: createdAt
      }, { merge: true });
    };

    let finalAction = "none";
    let salonToReturn = salonId;

    if (!salonDoc || !salonDoc.exists || !salonRef) {
      if (!salonId || !/^[A-Za-z0-9_-]{3,128}$/.test(String(salonId))) {
        if (!homologationMode && !logOnly && eventRef) {
          await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: 'invalid_or_missing_salon_id' });
        }
        return { success: false, requiresReview: true, reason: "invalid_or_missing_salon_id" };
      }
      
      const onboardingRef = adminDb.collection("onboarding").doc(String(salonId));
      const onboardingDoc = await onboardingRef.get();
      
      if (!onboardingDoc.exists) {
        if (!homologationMode && !logOnly && eventRef) {
          await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: 'onboarding_not_found' });
        }
        return { success: false, requiresReview: true, reason: "onboarding_not_found" };
      }
      
      const onboardingData = onboardingDoc.data() || {};
      const pendingPlan = String(onboardingData.pendingPlan || "").trim();
      const pendingOffer = String(onboardingData.pendingOfferId || "").trim();
      const pendingEmail = String(onboardingData.pendingCheckoutEmail || "").trim().toLowerCase();
      const pendingPurpose = String(onboardingData.pendingCheckoutPurpose || "").trim();
      const pendingRequestedAt = Number(onboardingData.pendingRequestedAt || 0);
      if (!onboardingData.ownerId || !onboardingData.createdBy || onboardingData.createdBy !== onboardingData.ownerId) {
        if (eventRef) await eventRef.update({ status: "review_required", updatedAt: Date.now(), reason: "onboarding_missing_owner" });
        return { success: false, requiresReview: true, reason: "onboarding_missing_owner" };
      }
      if (!pendingPlan || !pendingOffer || !pendingEmail || pendingPurpose !== "new_subscription" || !pendingRequestedAt) {
        if (eventRef) await eventRef.update({ status: "review_required", updatedAt: Date.now(), reason: "missing_checkout_intent" });
        return { success: false, requiresReview: true, reason: "missing_checkout_intent" };
      }

      const emailMismatch = !customerEmail || pendingEmail !== customerEmail;
      const offerMismatch = pendingOffer !== offerId || pendingPlan !== mappedPlan;
      
      if (emailMismatch || offerMismatch) {
        if (!homologationMode && !logOnly && eventRef) {
          await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: 'correlation_mismatch' });
        }
        return { success: false, requiresReview: true, reason: "correlation_mismatch" };
      }

      if (category !== "approved") {
        if (!homologationMode && !logOnly && eventRef) {
          await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: 'payment_not_approved' });
        }
        return { success: false, requiresReview: true, reason: "payment_not_approved" };
      }
      
      const batch = adminDb.batch();
      salonRef = adminDb.collection("salons").doc(String(salonId));
      
      const newSalonData = {
        id: String(salonId),
        name: normalizedData.customer?.name || onboardingData.name || "LumièreOS Salon",
        ownerName: normalizedData.customer?.name || onboardingData.ownerName || "",
        ownerEmail: onboardingData.ownerEmail || customerEmail || "",
        ownerId: onboardingData.ownerId,
        plan: mappedPlan,
        subscriptionStatus: "active",
        activationStatus: "active",
        isActive: true,
        createdAt: onboardingData.createdAt || Date.now(),
        ...realUpdatePayload
      };
      
      batch.set(salonRef, newSalonData);
      
      const userRef = adminDb.collection("users").doc(onboardingData.ownerId);
      batch.update(userRef, {
        salonId: String(salonId),
        role: "owner",
        onboardingStatus: "completed",
        updatedAt: Date.now()
      });
      
      batch.delete(onboardingRef);
      appendBillingRecords(batch, salonRef, String(salonId));
      if (!homologationMode && !logOnly && eventRef) {
        batch.update(eventRef, { status: 'processed', updatedAt: Date.now() });
      }
      
      await batch.commit();
      finalAction = "created";
    } else {
      // Salão existente
      const batch = adminDb.batch();
      batch.update(salonRef, realUpdatePayload);
      appendBillingRecords(batch, salonRef, String(salonDoc.id || salonId));
      if (!homologationMode && !logOnly && eventRef) {
        batch.update(eventRef, { status: 'processed', updatedAt: Date.now() });
      }
      await batch.commit();
      finalAction = "updated";
      salonToReturn = salonDoc.id;
    }
    
    return {
      success: true,
      salonUpdated: true,
      plan: realUpdatePayload.plan || "start",
      status: realUpdatePayload.subscriptionStatus || "active",
      firestorePath: `salons/${salonToReturn}`
    };

  } catch (err: any) {
    console.error("[Cakto Webhook processCaktoWebhookPayload] Erro no processamento:", err);
    if (!homologationMode && !logOnly) {
      try {
        const eventRef = adminDb.collection("billingWebhookEvents").doc(eventId);
        await eventRef.update({ status: 'failed_retryable', updatedAt: Date.now(), errorCode: 'WEBHOOK_PROCESSING_FAILED' });
      } catch (err2) {
        console.error("Erro ao marcar failed_retryable:", err2);
      }
    }
    throw err;
  }
}

export function buildHomologationWebhookUpdate({
  eventName,
  eventId,
  orderId,
  subscriptionId,
  customerId,
  offerId,
  normalizedData
}: {
  eventName: string;
  eventId: string;
  orderId?: any;
  subscriptionId?: any;
  customerId?: any;
  offerId?: string;
  normalizedData?: any;
}) {
  const ev = String(eventName).toLowerCase();
  const updatePayload: any = {
    homologationLastEventId: eventId,
    homologationLastEvent: eventName,
    homologationUpdatedAt: Date.now()
  };

  if (orderId) updatePayload.homologationOrderId = String(orderId);
  if (subscriptionId) updatePayload.homologationSubscriptionId = String(subscriptionId);
  if (customerId) updatePayload.homologationCustomerId = String(customerId);
  if (offerId) updatePayload.homologationOfferId = String(offerId);

  // Determinar status de homologação
  if (ev === "purchase_approved" || ev === "subscription_renewed") {
    updatePayload.homologationSubscriptionStatus = "active";
    updatePayload.homologationActivationStatus = "active";
    updatePayload.homologationPaymentStatus = "paid";
    
    // Determinar data de faturamento de homologação caso venha no payload
    const periodEnd = normalizedData?.current_period_end || normalizedData?.next_billing_date || normalizedData?.nextBillingDate;
    let nextBillingDateVal = periodEnd ? new Date(periodEnd).getTime() : null;
    if (nextBillingDateVal && !isNaN(nextBillingDateVal)) {
      updatePayload.homologationNextBillingDate = nextBillingDateVal;
    }
    
    updatePayload.homologationLastPaymentAt = Date.now();
    updatePayload.homologationLastPaymentAmount = normalizedData?.amount || normalizedData?.value || normalizedData?.price || 0;

  } else if (ev === "subscription_created" || ev === "trial") {
    updatePayload.homologationSubscriptionStatus = "pending";
    updatePayload.homologationActivationStatus = "pending";
    updatePayload.homologationPaymentStatus = "pending";

  } else if (ev === "subscription_canceled" || ev === "refund" || ev === "chargeback") {
    updatePayload.homologationSubscriptionStatus = "canceled";
    updatePayload.homologationActivationStatus = "canceled";
    updatePayload.homologationPaymentStatus = "canceled";

  } else if (ev === "purchase_refused" || ev === "subscription_renewal_refused") {
    updatePayload.homologationSubscriptionStatus = "overdue";
    updatePayload.homologationActivationStatus = "blocked";
    updatePayload.homologationPaymentStatus = "refused";
  }

  return updatePayload;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    let receivedToken =
      req.headers["x-cakto-token"] ||
      req.headers["cakto-token"] ||
      req.headers["authorization"] ||
      req.headers["x-cakto-signature"] ||
      req.headers["cakto-signature"] ||
      req.body?.secret ||
      req.body?.token ||
      req.body?.signature;

    if (typeof receivedToken === "string" && receivedToken.startsWith("Bearer ")) {
      receivedToken = receivedToken.substring(7);
    }

    const expectedSecret =
      process.env.CAKTO_WEBHOOK_SECRET;

    if (
      process.env.NODE_ENV === "production" &&
      !expectedSecret
    ) {
      return res.status(503).json({
        error: "Webhook de faturamento não configurado."
      });
    }

    if (
      expectedSecret &&
      receivedToken !== expectedSecret
    ) {
      return res.status(401).json({
        error: "Assinatura inválida de webhook."
      });
    }

    const result = await processCaktoWebhookPayload(req.body, false, false);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Cakto Webhook Serverless Error] Falha de processamento:", err);
    if (isFirebaseAdminCredentialError(err)) {
       return res.status(503).json({
          error: "O serviço de faturamento está temporariamente indisponível.",
          code: "FIREBASE_ADMIN_AUTH_FAILED"
       });
    }
    return res.status(500).json({ 
       error: "Erro interno no processamento do webhook.",
       code: "WEBHOOK_PROCESSING_FAILED"
    });
  }
}

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
    // 2. Idempotência / Controle de Webhook
    let eventRef = null;
    if (!homologationMode && !logOnly && process.env.VITEST !== "true") {
      eventRef = adminDb.collection("billingWebhookEvents").doc(eventId);
      const eventDoc = await eventRef.get();
      const evData = eventDoc.exists ? (eventDoc.data() || {}) : {};
      const status = evData.status;
      
      if (eventDoc.exists && status) {
        const updatedAt = evData.updatedAt || evData.createdAt || 0;
        const isRecent = (Date.now() - updatedAt) < 300000;

        if (status === "processed") {
          return { success: true, info: "Evento duplicado já processado.", eventProcessed: eventName, duplicate: true };
        } else if (status === "processing" && isRecent) {
          return { success: true, processing: true, info: "Evento ainda em processamento recente." };
        } else if (status === "failed_retryable" || (status === "processing" && !isRecent)) {
          // Retomar processamento
          await eventRef.update({ status: 'processing', updatedAt: Date.now() });
        } else if (status === "review_required") {
          return { success: false, requiresReview: true, reason: "review_required" };
        } else {
          return { success: false, requiresReview: true, reason: "invalid_event_state" };
        }
      } else if (!eventDoc.exists) {
        await eventRef.set({ status: 'processing', createdAt: Date.now(), updatedAt: Date.now() });
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
      } else {
        // Para novas assinaturas ou alterações pendentes, validar pendingOfferId e pendingCheckoutEmail
        const sData = salonDoc.data() || {};
        const pendingOffer = String(sData.pendingOfferId || "").trim();
        const pendingEmail = String(sData.pendingCheckoutEmail || "").trim().toLowerCase();
        
        const emailMismatch = pendingEmail && customerEmail && pendingEmail !== customerEmail;
        const offerMismatch = pendingOffer && pendingOffer !== offerId;
        
        if (emailMismatch || offerMismatch) {
          if (!homologationMode && !logOnly && eventRef) {
            await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: 'correlation_mismatch' });
          }
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

    if (category === "approved") {
      realUpdatePayload.billingProvider = "cakto";
      realUpdatePayload.subscriptionStatus = "active";
      realUpdatePayload.activationStatus = "active";
      realUpdatePayload.caktoPaymentStatus = "paid";
      realUpdatePayload.paymentStatus = "paid";
      realUpdatePayload.plan = mappedPlan;
      realUpdatePayload.isActive = true;

      // Extract the payment method returned by Cakto
      const paymentMethodVal = normalizedData.payment_method || normalizedData.paymentMethod || normalizedData.billing_type || normalizedData.billingType || "";
      if (paymentMethodVal) {
        realUpdatePayload.paymentMethod = paymentMethodVal;
      }

      // Check if a valid subscription was created/exists in the gateway
      const hasValidSubscription = subscriptionId && typeof subscriptionId === "string" && subscriptionId.trim().length > 0 && !subscriptionId.includes("manual");
      if (hasValidSubscription) {
        realUpdatePayload.billingMode = "recurring";
      }
      
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
      realUpdatePayload.lastPaymentAmount = normalizedData.amount || normalizedData.value || normalizedData.price || 0;
    } else if (category === "canceled") {
      realUpdatePayload.subscriptionStatus = "canceled";
      realUpdatePayload.activationStatus = "canceled";
      realUpdatePayload.caktoPaymentStatus = "canceled";
      realUpdatePayload.paymentStatus = "canceled";
      realUpdatePayload.isActive = false;
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

    let finalAction = "none";
    let salonToReturn = salonId;

    if (!salonDoc || !salonDoc.exists || !salonRef) {
      if (!salonId || !/^[A-Za-z0-9_-]{3,128}$/.test(String(salonId))) {
        if (!homologationMode && !logOnly && eventRef) {
          await eventRef.update({ status: 'processed' });
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
      if (!onboardingData.ownerId) {
        if (!homologationMode && !logOnly && eventRef) {
          await eventRef.update({ status: 'review_required', updatedAt: Date.now(), reason: 'onboarding_missing_owner' });
        }
        return { success: false, requiresReview: true, reason: "onboarding_missing_owner" };
      }

      // Validar correlação segura do onboarding
      const pendingOffer = String(onboardingData.pendingOfferId || "").trim();
      const pendingEmail = String(onboardingData.pendingCheckoutEmail || "").trim().toLowerCase();
      
      const emailMismatch = pendingEmail && customerEmail && pendingEmail !== customerEmail;
      const offerMismatch = pendingOffer && pendingOffer !== offerId;
      
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
        role: "owner"
      });
      
      batch.delete(onboardingRef);
      if (!homologationMode && !logOnly && eventRef) {
        batch.update(eventRef, { status: 'processed', updatedAt: Date.now() });
      }
      
      await batch.commit();
      finalAction = "created";
    } else {
      // Salão existente
      const batch = adminDb.batch();
      batch.update(salonRef, realUpdatePayload);
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
        await eventRef.update({ status: 'failed_retryable', updatedAt: Date.now(), error: err.message || String(err) });
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
  if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
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

  } else if (ev === "subscription_created" || ev.includes("trial") || ev.includes("created")) {
    updatePayload.homologationSubscriptionStatus = "pending";
    updatePayload.homologationActivationStatus = "pending";
    updatePayload.homologationPaymentStatus = "pending";

  } else if (ev === "subscription_canceled" || ev === "refund" || ev === "chargeback" || ev.includes("cancel") || ev.includes("refund") || ev.includes("chargeback")) {
    updatePayload.homologationSubscriptionStatus = "canceled";
    updatePayload.homologationActivationStatus = "canceled";
    updatePayload.homologationPaymentStatus = "canceled";

  } else if (ev === "purchase_refused" || ev === "subscription_renewal_refused" || ev.includes("refused") || ev.includes("failed") || ev.includes("rejected") || ev.includes("overdue")) {
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

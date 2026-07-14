import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";

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
  try {
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
  } catch (err) {
    console.error("[Cakto Webhook Serverless Settings] Erro ao carregar configurações:", err);
  }
  return {
    productId: "",
    startOfferId: "",
    founderOfferId: "",
    performanceOfferId: "",
    networkOfferId: "",
    enterpriseOfferId: ""
  };
}

export async function processCaktoWebhookPayload(bodyData: any, skipTokenValidation: boolean = false, isSimulation: boolean = false) {
  // 1. Normalizar a estrutura do corpo da requisição (lida com dados simples ou agrupados/data array)
  let normalizedData = bodyData || {};
  if (normalizedData.data) {
    if (Array.isArray(normalizedData.data)) {
      if (normalizedData.data.length > 0) {
        normalizedData = { ...normalizedData, ...normalizedData.data[0] };
      }
    } else if (typeof normalizedData.data === "object") {
      normalizedData = { ...normalizedData, ...normalizedData.data };
    }
  }

  // Extrair metadados, suportando serialização em string
  let metadataObj = normalizedData.metadata;
  if (typeof metadataObj === "string") {
    try {
      metadataObj = JSON.parse(metadataObj);
    } catch (e) {
      metadataObj = {};
    }
  }

  // Extrair propriedades relevantes de forma tolerante a falhas
  const eventName = normalizedData.event || normalizedData.eventType || normalizedData.status || normalizedData.event_type || "purchase_approved";
  const orderId = normalizedData.order_id || normalizedData.orderId || normalizedData.id;
  const subscriptionId = normalizedData.subscription_id || normalizedData.subscriptionId;
  const customerId = normalizedData.customer_id || normalizedData.customerId || normalizedData.customer?.id;
  const salonId = normalizedData.external_id || normalizedData.externalId || metadataObj?.salonId;
  const customerEmail = String(normalizedData.customer?.email || normalizedData.customerEmail || metadataObj?.email || "").trim().toLowerCase();
  const offerId = String(normalizedData.offer_id || normalizedData.offerId || normalizedData.checkout_offer_id || "").trim();

  const isTestEvent = !orderId && !subscriptionId && !salonId && !customerEmail;
  if (isTestEvent) {
    console.log("[Cakto Webhook Processor] Recebido evento genérico de teste/ping da Cakto.");
    return {
      success: true,
      info: "Webhook de teste/ping recebido com sucesso.",
      testEvent: true,
      salonFound: false
    };
  }

  const adminDb = getAdminDb();
  let salonRef = null;
  let salonDoc = null;

  // 4. Correlação do salão:
  // a. Tentar localizar pelo salonId direto (external_id / externalId / metadata.salonId)
  if (salonId) {
    salonRef = adminDb.collection("salons").doc(String(salonId));
    salonDoc = await salonRef.get();
  }

  // b. Se não encontrado, buscar por caktoSubscriptionId
  if ((!salonDoc || !salonDoc.exists) && subscriptionId) {
    const snapshot = await adminDb.collection("salons").where("caktoSubscriptionId", "==", String(subscriptionId)).limit(1).get();
    if (!snapshot.empty) {
      salonDoc = snapshot.docs[0];
      salonRef = salonDoc.ref;
    }
  }

  // c. Se ainda não encontrado, buscar por caktoOrderId
  if ((!salonDoc || !salonDoc.exists) && orderId) {
    const snapshot = await adminDb.collection("salons").where("caktoOrderId", "==", String(orderId)).limit(1).get();
    if (!snapshot.empty) {
      salonDoc = snapshot.docs[0];
      salonRef = salonDoc.ref;
    }
  }

  // d. Se ainda não encontrado, buscar por caktoOfferId + caktoCheckoutEmail
  if ((!salonDoc || !salonDoc.exists) && offerId && customerEmail) {
    const snapshot = await adminDb.collection("salons")
      .where("caktoOfferId", "==", offerId)
      .where("caktoCheckoutEmail", "==", customerEmail)
      .limit(1).get();
    if (!snapshot.empty) {
      salonDoc = snapshot.docs[0];
      salonRef = salonDoc.ref;
    }
  }

  // e. Se ainda não encontrado, buscar por e-mail normalizado do cliente (checkout ou owner email)
  if ((!salonDoc || !salonDoc.exists) && customerEmail) {
    const snapshot = await adminDb.collection("salons")
      .where("caktoCheckoutEmail", "==", customerEmail)
      .limit(1).get();
    if (!snapshot.empty) {
      salonDoc = snapshot.docs[0];
      salonRef = salonDoc.ref;
    }
  }

  if ((!salonDoc || !salonDoc.exists) && customerEmail) {
    const snapshot = await adminDb.collection("salons")
      .where("ownerEmail", "==", customerEmail)
      .limit(1).get();
    if (!snapshot.empty) {
      salonDoc = snapshot.docs[0];
      salonRef = salonDoc.ref;
    }
  }

  // 6. Adicionar logs seguros
  console.log(`[Cakto Webhook Processor Secure Log] Processando evento:
  - Evento: ${eventName}
  - Offer ID: ${offerId || "N/A"}
  - Order ID: ${orderId || "N/A"}
  - Subscription ID: ${subscriptionId || "N/A"}
  - Customer Email: ${customerEmail || "N/A"}
  - Salon ID: ${salonId || "N/A"}
  - Salão Encontrado no Firestore: ${!!(salonDoc && salonDoc.exists)} (${salonDoc?.id || "N/A"})`);

  // Carregar configurações de ofertas para mapear o plano correto
  const sData = await getCaktoSettingsCached(adminDb);
  let mappedPlan = null;
  if (offerId) {
    const offId = offerId.trim();
    if (sData.startOfferId && sData.startOfferId.trim() === offId) mappedPlan = "start";
    else if (sData.founderOfferId && sData.founderOfferId.trim() === offId) mappedPlan = "founder";
    else if (sData.performanceOfferId && sData.performanceOfferId.trim() === offId) mappedPlan = "performance";
    else if (sData.networkOfferId && sData.networkOfferId.trim() === offId) mappedPlan = "network";
    else if (sData.enterpriseOfferId && sData.enterpriseOfferId.trim() === offId) mappedPlan = "enterprise";
  }

  // Fallback baseado em nome do checkout
  if (!mappedPlan) {
    const checkoutName = String(normalizedData.checkout_name || normalizedData.name || "").toLowerCase();
    if (checkoutName.includes("start")) mappedPlan = "start";
    else if (checkoutName.includes("founder") || checkoutName.includes("pioneiro")) mappedPlan = "founder";
    else if (checkoutName.includes("performance")) mappedPlan = "performance";
    else if (checkoutName.includes("network")) mappedPlan = "network";
    else if (checkoutName.includes("enterprise")) mappedPlan = "enterprise";
  }

  const ev = String(eventName).toLowerCase();
  const eventId = normalizedData.event_id || normalizedData.eventId || `${eventName}_${orderId || "test"}_${Date.now()}`;

  const updatePayload: any = {
    billingProvider: "cakto",
    updatedAt: Date.now(),
    caktoLastEventId: eventId,
    caktoLastEvent: eventName,
  };

  if (isSimulation) {
    if (orderId) updatePayload.homologationOrderId = String(orderId);
    if (subscriptionId) updatePayload.homologationSubscriptionId = String(subscriptionId);
    if (customerId) updatePayload.homologationCustomerId = String(customerId);
    if (offerId) updatePayload.homologationOfferId = offerId;
  } else {
    if (orderId) updatePayload.caktoOrderId = String(orderId);
    if (subscriptionId) updatePayload.caktoSubscriptionId = String(subscriptionId);
    if (customerId) updatePayload.caktoCustomerId = String(customerId);
    if (offerId) updatePayload.caktoOfferId = offerId;
  }

  // Regras de Status conforme especificado
  if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
    // 1. Ao receber evento aprovado/renovado:
    if (!isSimulation && salonDoc?.exists) {
      const data = salonDoc.data();
      if (data?.pendingOfferId && offerId && data.pendingOfferId !== offerId) {
        console.error(`[Cakto Webhook] ALERTA DE SEGURANÇA: Oferta divergente detectada para o salão ${salonDoc.id}. Esperada: ${data.pendingOfferId}, Recebida: ${offerId}.`);
        
        const historyRef = adminDb.collection("salons").doc(salonDoc.id).collection("billingHistory").doc();
        await historyRef.set({
          id: historyRef.id,
          eventType: "webhook_offer_mismatch",
          title: "Divergência de Oferta Bloqueada",
          description: `A assinatura Cakto foi rejeitada por divergência de oferta (Esperada: ${data.pendingOfferId}, Recebida: ${offerId}).`,
          timestamp: Date.now(),
          recordedBy: "system"
        });

        return { status: 200, data: { success: false, requiresReview: true, reason: "offer_mismatch" } };
      }
    }
    
    if (isSimulation) {
      updatePayload.homologationSubscriptionStatus = "active";
      updatePayload.homologationActivationStatus = "active";
      updatePayload.homologationPaymentStatus = "paid";
    } else {
      updatePayload.subscriptionStatus = "active";
      updatePayload.activationStatus = "active";
      updatePayload.caktoPaymentStatus = "paid";
      updatePayload.paymentStatus = "paid";
      updatePayload.plan = mappedPlan || (salonDoc?.exists ? salonDoc.data()?.plan : null) || "start";
      updatePayload.isActive = true;
      
      // Clear pending fields
      updatePayload.pendingPlan = null;
      updatePayload.pendingOfferId = null;
      updatePayload.pendingCheckoutUrl = null;
      updatePayload.pendingCheckoutEmail = null;
      updatePayload.pendingRequestedAt = null;
      updatePayload.pendingCheckoutPurpose = null;
      updatePayload.pendingBillingActivation = null;
    }
    updatePayload.ownerEmail = customerEmail || (salonDoc?.exists ? salonDoc.data()?.ownerEmail : null) || "";
    
    const periodEnd = normalizedData.current_period_end || normalizedData.next_billing_date || normalizedData.nextBillingDate;
    let nextBillingDate = periodEnd ? new Date(periodEnd).getTime() : (Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (isNaN(nextBillingDate)) {
      nextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
    }
    updatePayload.nextBillingDate = nextBillingDate;
    if (periodEnd) {
      updatePayload.currentPeriodEnd = periodEnd;
    }
    updatePayload.lastPaymentAt = Date.now();
    updatePayload.lastPaymentAmount = normalizedData.amount || normalizedData.value || normalizedData.price || 0;

  } else if (ev === "subscription_canceled" || ev === "refund" || ev === "chargeback" || ev.includes("cancel") || ev.includes("refund") || ev.includes("chargeback")) {
    // 2. Ao receber cancelado/refund/chargeback:
    if (isSimulation) {
      updatePayload.homologationSubscriptionStatus = "canceled";
      updatePayload.homologationActivationStatus = "canceled";
      updatePayload.homologationPaymentStatus = "canceled";
    } else {
      updatePayload.subscriptionStatus = "canceled";
      updatePayload.activationStatus = "canceled";
      updatePayload.caktoPaymentStatus = "canceled";
      updatePayload.paymentStatus = "canceled";
      updatePayload.isActive = false;
    }

  } else if (ev === "purchase_refused" || ev === "subscription_renewal_refused" || ev.includes("refused") || ev.includes("failed") || ev.includes("rejected") || ev.includes("overdue")) {
    // 3. Ao receber recusado/inadimplente:
    if (isSimulation) {
      updatePayload.homologationSubscriptionStatus = "overdue";
      updatePayload.homologationActivationStatus = "blocked";
      updatePayload.homologationPaymentStatus = "refused";
    } else {
      updatePayload.subscriptionStatus = "overdue";
      updatePayload.activationStatus = "blocked";
      updatePayload.caktoPaymentStatus = "refused";
      updatePayload.paymentStatus = "overdue";
      updatePayload.isActive = false;
    }

  } else if (ev === "subscription_created" || ev.includes("trial") || ev.includes("created")) {
    // Criação de assinatura
    if (salonDoc?.exists && salonDoc.data()?.subscriptionStatus !== "active") {
      updatePayload.subscriptionStatus = "pending";
      updatePayload.caktoPaymentStatus = "pending";
      updatePayload.paymentStatus = "pending";
    }
  }

  // Se o salão não existe e o pagamento foi aprovado ou se temos um salonId, criamos o salão!
  if (!salonDoc || !salonDoc.exists || !salonRef) {
    const finalSalonId = salonId || `salon_${Date.now()}`;
    salonRef = adminDb.collection("salons").doc(String(finalSalonId));
    
    const isApproved = updatePayload.subscriptionStatus === "active";
    const newSalonData = {
      id: String(finalSalonId),
      name: normalizedData.customer?.name || "LumièreOS Salon",
      ownerEmail: customerEmail || "",
      ownerName: normalizedData.customer?.name || "",
      plan: mappedPlan || "start",
      subscriptionStatus: updatePayload.subscriptionStatus || "pending",
      activationStatus: updatePayload.activationStatus || "pending",
      isActive: isApproved,
      billingProvider: "cakto",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...updatePayload
    };

    await salonRef.set(newSalonData);
    console.log(`[Cakto Webhook Processor] Salão novo criado e ativado com ID: ${finalSalonId}`);
    
    return {
      success: true,
      salonUpdated: true,
      plan: newSalonData.plan,
      status: newSalonData.subscriptionStatus,
      firestorePath: `salons/${finalSalonId}`
    };
  }

  const salonData = salonDoc.data();

  // Evitar processamento de eventos duplicados
  if (!skipTokenValidation && salonData?.caktoLastEventId === eventId) {
    console.log(`[Cakto Webhook Processor] Evento duplicado já processado anteriormente: ${eventId}. Ignorando.`);
    return {
      success: true,
      info: "Evento duplicado já processado.",
      salonFound: true,
      salonId: salonDoc.id,
      plan: salonData?.plan || "start",
      status: salonData?.subscriptionStatus || "active",
      firestorePath: `salons/${salonDoc.id}`
    };
  }

  await salonRef.update(updatePayload);
  console.log(`[Cakto Webhook Processor] Sincronização concluída com sucesso para o salão ${salonDoc.id} (Evento: ${eventName})`);

  // Salvar registro no histórico de cobrança
  try {
    const historyRef = salonRef.collection("billingHistory").doc();
    let histType = "charge_approved";
    let histTitle = "Cobrança Aprovada";
    let histDesc = `O pagamento da assinatura Cakto foi processado com sucesso.`;

    const PLAN_NAMES_LOCAL: Record<string, string> = {
      start: "Start",
      founder: "Founder (Pioneiro)",
      performance: "Performance",
      network: "Network",
      enterprise: "Enterprise"
    };

    const PLANS_PRICES_LOCAL: Record<string, number> = {
      start: 197,
      founder: 297,
      performance: 397,
      network: 797,
      enterprise: 1997
    };

    const prevPlan = salonData?.plan || "start";
    const nextPlan = updatePayload.plan || prevPlan;
    const prevStatus = salonData?.subscriptionStatus || "pending";

    if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
      if (prevStatus === "overdue") {
        histType = "regularization";
        histTitle = "Regularização de Faturamento";
        histDesc = "A assinatura em atraso foi regularizada com sucesso após compensação.";
      } else if (prevStatus === "preview" || prevStatus === "pending") {
        histType = "activation";
        histTitle = "Ativação de Assinatura";
        histDesc = `Assinatura iniciada no plano ${PLAN_NAMES_LOCAL[nextPlan] || nextPlan}.`;
      } else if (prevPlan !== nextPlan) {
        const isUp = (PLANS_PRICES_LOCAL[nextPlan] || 0) > (PLANS_PRICES_LOCAL[prevPlan] || 0);
        histType = isUp ? "upgrade_applied" : "downgrade_applied";
        histTitle = isUp ? "Upgrade de Plano Aplicado" : "Downgrade de Plano Aplicado";
        histDesc = `Plano definitivo alterado de ${PLAN_NAMES_LOCAL[prevPlan] || prevPlan} para ${PLAN_NAMES_LOCAL[nextPlan] || nextPlan}.`;
      } else {
        histType = "charge_approved";
        histTitle = "Mensalidade Aprovada";
        histDesc = `Cobrança mensal do plano ${PLAN_NAMES_LOCAL[nextPlan] || nextPlan} aprovada com sucesso.`;
      }
    } else if (ev === "subscription_canceled" || ev === "refund" || ev === "chargeback" || ev.includes("cancel") || ev.includes("refund") || ev.includes("chargeback")) {
      histType = "canceled";
      histTitle = "Assinatura Cancelada";
      histDesc = `Assinatura do LumièreOS foi cancelada.`;
    } else if (ev === "purchase_refused" || ev === "subscription_renewal_refused" || ev.includes("refused") || ev.includes("failed") || ev.includes("rejected") || ev.includes("overdue")) {
      histType = "charge_refused";
      histTitle = "Cobrança Recusada";
      histDesc = `O faturamento mensal da assinatura Cakto falhou ou foi recusado pela operadora.`;
    } else if (ev === "subscription_created" || ev.includes("trial") || ev.includes("created")) {
      histType = "activation";
      histTitle = "Nova Assinatura Registrada";
      histDesc = `Faturamento recorrente registrado na Cakto, aguardando compensação inicial.`;
    }

    await historyRef.set({
      id: historyRef.id,
      eventType: histType,
      title: histTitle,
      description: histDesc,
      amount: updatePayload.lastPaymentAmount || normalizedData.amount || normalizedData.value || normalizedData.price || 0,
      plan: nextPlan,
      timestamp: Date.now(),
      recordedBy: "Cakto Gateway"
    });
  } catch (err) {
    console.error("[Cakto Webhook History Logger] Falha ao gravar histórico:", err);
  }

  return {
    success: true,
    salonUpdated: true,
    plan: updatePayload.plan || salonData?.plan || "start",
    status: updatePayload.subscriptionStatus || salonData?.subscriptionStatus || "active",
    firestorePath: `salons/${salonDoc.id}`
  };
}


function buildHomologationWebhookUpdate(ev, offerId, bodyData) {
  const updatePayload: any = { homologationUpdatedAt: Date.now() };
  if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
      updatePayload.homologationSubscriptionStatus = "active";
      updatePayload.homologationActivationStatus = "active";
      updatePayload.homologationPaymentStatus = "paid";
      updatePayload.homologationNextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
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
    // 1. Obter e validar o token/assinatura do webhook de forma robusta
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

    const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;

    if (expectedSecret && receivedToken !== expectedSecret) {
      console.warn("[Cakto Webhook Serverless] Token ou assinatura de webhook inválida.");
      return res.status(401).json({ error: "Assinatura inválida de webhook." });
    }

    const result = await processCaktoWebhookPayload(req.body, false);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Cakto Webhook Serverless Error] Falha de processamento:", err);
    return res.status(500).json({ error: err.message || "Erro interno no processamento do webhook." });
  }
}

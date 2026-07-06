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

    // 2. Normalizar a estrutura do corpo da requisição (lida com dados simples ou agrupados/data array)
    let bodyData = req.body || {};
    if (bodyData.data) {
      if (Array.isArray(bodyData.data)) {
        if (bodyData.data.length > 0) {
          bodyData = { ...bodyData, ...bodyData.data[0] };
        }
      } else if (typeof bodyData.data === "object") {
        bodyData = { ...bodyData, ...bodyData.data };
      }
    }

    // Extrair metadados, suportando serialização em string
    let metadataObj = bodyData.metadata;
    if (typeof metadataObj === "string") {
      try {
        metadataObj = JSON.parse(metadataObj);
      } catch (e) {
        metadataObj = {};
      }
    }

    // Extrair propriedades relevantes de forma tolerante a falhas
    const eventName = bodyData.event || bodyData.eventType || bodyData.status || bodyData.event_type || "purchase_approved";
    const orderId = bodyData.order_id || bodyData.orderId || bodyData.id;
    const subscriptionId = bodyData.subscription_id || bodyData.subscriptionId;
    const customerId = bodyData.customer_id || bodyData.customerId || bodyData.customer?.id;
    const salonId = bodyData.external_id || bodyData.externalId || metadataObj?.salonId;
    const customerEmail = String(bodyData.customer?.email || bodyData.customerEmail || metadataObj?.email || "").trim().toLowerCase();
    const offerId = String(bodyData.offer_id || bodyData.offerId || bodyData.checkout_offer_id || "").trim();

    const isTestEvent = !orderId && !subscriptionId && !salonId && !customerEmail;
    if (isTestEvent) {
      console.log("[Cakto Webhook Serverless] Recebido evento genérico de teste/ping da Cakto.");
      return res.status(200).json({ success: true, info: "Webhook de teste/ping recebido com sucesso." });
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
    console.log(`[Cakto Webhook Serverless Secure Log] Processando evento:
    - Evento: ${eventName}
    - Offer ID: ${offerId || "N/A"}
    - Order ID: ${orderId || "N/A"}
    - Subscription ID: ${subscriptionId || "N/A"}
    - Customer Email: ${customerEmail || "N/A"}
    - Salon ID: ${salonId || "N/A"}
    - Salão Encontrado no Firestore: ${!!(salonDoc && salonDoc.exists)} (${salonDoc?.id || "N/A"})`);

    // 5. Todos os eventos devem retornar 200 OK quando recebidos corretamente, mesmo se salão não for encontrado, mas logar claramente.
    if (!salonDoc || !salonDoc.exists || !salonRef) {
      console.warn(`[Cakto Webhook Serverless] Salão correspondente não localizado para os parâmetros informados. Respondendo 200 OK.`);
      return res.status(200).json({
        success: true,
        info: "Salão correspondente não localizado. Evento tratado com sucesso como caso de teste/integração.",
        salonFound: false
      });
    }

    const salonData = salonDoc.data();
    const eventId = bodyData.event_id || bodyData.eventId || `${eventName}_${orderId || "test"}_${Date.now()}`;

    // Evitar processamento de eventos duplicados
    if (salonData?.caktoLastEventId === eventId) {
      console.log(`[Cakto Webhook Serverless] Evento duplicado já processado anteriormente: ${eventId}. Ignorando.`);
      return res.status(200).json({ success: true, info: "Evento duplicado já processado." });
    }

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
      const checkoutName = String(bodyData.checkout_name || bodyData.name || "").toLowerCase();
      if (checkoutName.includes("start")) mappedPlan = "start";
      else if (checkoutName.includes("founder") || checkoutName.includes("pioneiro")) mappedPlan = "founder";
      else if (checkoutName.includes("performance")) mappedPlan = "performance";
      else if (checkoutName.includes("network")) mappedPlan = "network";
      else if (checkoutName.includes("enterprise")) mappedPlan = "enterprise";
    }

    const updatePayload: any = {
      billingProvider: "cakto",
      updatedAt: Date.now(),
      caktoLastEventId: eventId,
      caktoLastEvent: eventName,
    };

    if (orderId) updatePayload.caktoOrderId = String(orderId);
    if (subscriptionId) updatePayload.caktoSubscriptionId = String(subscriptionId);
    if (customerId) updatePayload.caktoCustomerId = String(customerId);
    if (offerId) updatePayload.caktoOfferId = offerId;

    const ev = String(eventName).toLowerCase();

    // Regras de Status conforme especificado
    if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
      // 1. Ao receber evento aprovado/renovado:
      updatePayload.subscriptionStatus = "active";
      updatePayload.caktoPaymentStatus = "paid";
      updatePayload.paymentStatus = "paid";
      updatePayload.plan = mappedPlan || salonData?.plan || "start";
      
      const periodEnd = bodyData.current_period_end || bodyData.next_billing_date || bodyData.nextBillingDate;
      let nextBillingDate = periodEnd ? new Date(periodEnd).getTime() : (Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (isNaN(nextBillingDate)) {
        nextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      }
      updatePayload.nextBillingDate = nextBillingDate;
      if (periodEnd) {
        updatePayload.currentPeriodEnd = periodEnd;
      }
      updatePayload.lastPaymentAt = Date.now();
      updatePayload.lastPaymentAmount = bodyData.amount || bodyData.value || bodyData.price || 0;

    } else if (ev === "subscription_canceled" || ev === "refund" || ev === "chargeback" || ev.includes("cancel") || ev.includes("refund") || ev.includes("chargeback")) {
      // 2. Ao receber cancelado/refund/chargeback:
      updatePayload.subscriptionStatus = "canceled";
      updatePayload.caktoPaymentStatus = "canceled";
      updatePayload.paymentStatus = "canceled";

    } else if (ev === "purchase_refused" || ev === "subscription_renewal_refused" || ev.includes("refused") || ev.includes("failed") || ev.includes("rejected") || ev.includes("overdue")) {
      // 3. Ao receber recusado/inadimplente:
      updatePayload.subscriptionStatus = "overdue";
      updatePayload.caktoPaymentStatus = "refused";
      updatePayload.paymentStatus = "overdue";

    } else if (ev === "subscription_created" || ev.includes("trial") || ev.includes("created")) {
      // Criação de assinatura
      if (salonData?.subscriptionStatus !== "active") {
        updatePayload.subscriptionStatus = "pending";
        updatePayload.caktoPaymentStatus = "pending";
        updatePayload.paymentStatus = "pending";
      }
    }

    await salonRef.update(updatePayload);
    console.log(`[Cakto Webhook Serverless] Sincronização concluída com sucesso para o salão ${salonDoc.id} (Evento: ${eventName})`);

    return res.status(200).json({ success: true, eventProcessed: eventName, salonId: salonDoc.id });
  } catch (err: any) {
    console.error("[Cakto Webhook Serverless Error] Falha de processamento:", err);
    return res.status(500).json({ error: err.message || "Erro interno no processamento do webhook." });
  }
}

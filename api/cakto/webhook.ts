import type { VercelRequest, VercelResponse } from "@vercel/node";

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

    console.log(`[Cakto Webhook Serverless] Evento: ${eventName} | Order ID: ${orderId} | Subscription ID: ${subscriptionId} | Salon ID: ${salonId}`);

    // Se for um evento genérico de teste/ping sem dados de pedidos ou salões, retornar sucesso 200 imediatamente
    const isTestEvent = !orderId && !subscriptionId && !salonId;
    if (isTestEvent) {
      console.log("[Cakto Webhook Serverless] Recebido evento genérico de teste/ping da Cakto.");
      return res.status(200).json({ success: true, info: "Webhook de teste/ping recebido com sucesso." });
    }

    const { getAdminDb } = await import("../_shared/firebaseAdmin");
    const adminDb = getAdminDb();
    let salonRef = null;
    let salonDoc = null;

    // Buscar pelo ID do salão (external_id / metadata.salonId)
    if (salonId) {
      salonRef = adminDb.collection("salons").doc(String(salonId));
      salonDoc = await salonRef.get();
    }

    // Se não encontrado, buscar pelo Order ID correspondente no Firestore
    if ((!salonDoc || !salonDoc.exists) && orderId) {
      const snapshot = await adminDb.collection("salons").where("caktoOrderId", "==", String(orderId)).limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    // Se ainda não encontrado, buscar pela Subscription ID correspondente no Firestore
    if ((!salonDoc || !salonDoc.exists) && subscriptionId) {
      const snapshot = await adminDb.collection("salons").where("caktoSubscriptionId", "==", String(subscriptionId)).limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    // Se for um evento de teste com IDs simulados ou se o salão de fato não existir no banco
    if (!salonDoc || !salonDoc.exists || !salonRef) {
      console.warn(`[Cakto Webhook Serverless] Salão correspondente não localizado para orderId: ${orderId}, subscriptionId: ${subscriptionId}, salonId: ${salonId}. Respondendo 200 OK para testes.`);
      return res.status(200).json({
        received: true,
        info: "Salão correspondente não localizado. Evento tratado com sucesso como caso de teste/integração."
      });
    }

    const salonData = salonDoc.data();
    const eventId = bodyData.event_id || bodyData.eventId || `${eventName}_${orderId || "test"}_${Date.now()}`;

    // Evitar processamento de eventos duplicados
    if (salonData?.caktoLastEventId === eventId) {
      console.log(`[Cakto Webhook Serverless] Evento duplicado já processado anteriormente: ${eventId}. Ignorando.`);
      return res.status(200).json({ success: true, info: "Evento duplicado já processado." });
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

    const ev = String(eventName).toLowerCase();

    // Mapeamento preciso de eventos da Cakto
    if (
      ev === "purchase_approved" ||
      ev === "subscription_renewed" ||
      ev.includes("approved") ||
      ev.includes("paid") ||
      ev.includes("success") ||
      ev.includes("completed") ||
      ev === "active"
    ) {
      updatePayload.paymentStatus = "paid";
      updatePayload.subscriptionStatus = "active";
      updatePayload.lastPaymentAt = Date.now();
      updatePayload.lastPaymentAmount = bodyData.amount || bodyData.value || bodyData.price || 0;
      updatePayload.nextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
    } else if (
      ev === "purchase_refused" ||
      ev.includes("overdue") ||
      ev.includes("failed") ||
      ev.includes("rejected") ||
      ev.includes("refused")
    ) {
      updatePayload.paymentStatus = "overdue";
      updatePayload.subscriptionStatus = "overdue";
    } else if (
      ev === "subscription_canceled" ||
      ev.includes("cancel") ||
      ev.includes("deleted") ||
      ev.includes("refunded")
    ) {
      updatePayload.paymentStatus = "canceled";
      updatePayload.subscriptionStatus = "canceled";
    } else if (
      ev === "subscription_created" ||
      ev.includes("trial") ||
      ev.includes("created")
    ) {
      updatePayload.paymentStatus = "pending";
      updatePayload.subscriptionStatus = "trial";
    }

    await salonRef.update(updatePayload);
    console.log(`[Cakto Webhook Serverless] Sincronização concluída para o salão ${salonDoc.id} (Evento: ${eventName})`);

    return res.status(200).json({ success: true, eventProcessed: eventName });
  } catch (err: any) {
    console.error("[Cakto Webhook Serverless] Falha ao processar webhook:", err);
    return res.status(500).json({ error: err.message || "Erro interno no processamento do webhook." });
  }
}

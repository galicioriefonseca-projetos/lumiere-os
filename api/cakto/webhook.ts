import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { getAdminDb } = await import("../_shared/firebaseAdmin");
    const receivedToken =
      req.headers["x-cakto-token"] ||
      req.headers["cakto-token"] ||
      req.headers["authorization"] ||
      req.headers["x-cakto-signature"] ||
      req.headers["cakto-signature"];
    const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;

    if (expectedSecret && receivedToken !== expectedSecret) {
      console.warn("[Cakto Webhook Serverless] Token ou assinatura de webhook inválida.");
      return res.status(401).json({ error: "Assinatura inválida de webhook." });
    }

    const eventName = req.body?.event || req.body?.eventType || req.body?.status || "payment.approved";
    const orderId = req.body?.order_id || req.body?.orderId || req.body?.data?.order_id || req.body?.id;
    const subscriptionId = req.body?.subscription_id || req.body?.subscriptionId || req.body?.data?.subscription_id;
    const customerId = req.body?.customer_id || req.body?.customerId || req.body?.data?.customer_id || req.body?.customer?.id;
    const salonId = req.body?.external_id || req.body?.externalId || req.body?.metadata?.salonId || req.body?.data?.metadata?.salonId || req.body?.data?.external_id;

    console.log(`[Cakto Webhook Serverless] Evento recebido: ${eventName} para Order ID: ${orderId}, Salon: ${salonId}`);

    const adminDb = getAdminDb();
    let salonRef = null;
    let salonDoc = null;

    if (salonId) {
      salonRef = adminDb.collection("salons").doc(String(salonId));
      salonDoc = await salonRef.get();
    }

    if ((!salonDoc || !salonDoc.exists) && orderId) {
      const snapshot = await adminDb.collection("salons").where("caktoOrderId", "==", String(orderId)).limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    if ((!salonDoc || !salonDoc.exists) && subscriptionId) {
      const snapshot = await adminDb.collection("salons").where("caktoSubscriptionId", "==", String(subscriptionId)).limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    if (!salonDoc || !salonDoc.exists || !salonRef) {
      console.warn(`[Cakto Webhook Serverless] Salão não localizado para orderId ${orderId} ou subscriptionId ${subscriptionId}`);
      return res.status(200).json({ received: true, info: "Salão correspondente não localizado." });
    }

    const salonData = salonDoc.data();
    const eventId = req.body?.id || req.body?.event_id || `${eventName}_${orderId}_${Date.now()}`;

    if (salonData?.caktoLastEventId === eventId) {
      console.log(`[Cakto Webhook Serverless] Evento duplicado já processado: ${eventId}. Ignorando.`);
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

    if (
      ev.includes("approved") ||
      ev.includes("paid") ||
      ev.includes("success") ||
      ev.includes("completed") ||
      ev === "active"
    ) {
      updatePayload.paymentStatus = "paid";
      updatePayload.subscriptionStatus = "active";
      updatePayload.lastPaymentAt = Date.now();
      updatePayload.lastPaymentAmount = req.body?.amount || req.body?.value || req.body?.data?.amount || 0;
      updatePayload.nextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
    } else if (ev.includes("overdue") || ev.includes("failed") || ev.includes("rejected")) {
      updatePayload.paymentStatus = "overdue";
      updatePayload.subscriptionStatus = "overdue";
    } else if (ev.includes("cancel") || ev.includes("deleted") || ev.includes("refunded")) {
      updatePayload.paymentStatus = "canceled";
      updatePayload.subscriptionStatus = "canceled";
    } else if (ev.includes("trial") || ev.includes("created")) {
      updatePayload.paymentStatus = "pending";
      updatePayload.subscriptionStatus = "trial";
    }

    await salonRef.update(updatePayload);
    console.log(`[Cakto Webhook Serverless] Sincronização concluída para salão ${salonDoc.id} (Evento: ${eventName})`);

    return res.status(200).json({ success: true, eventProcessed: eventName });
  } catch (err: any) {
    console.error("[Cakto Webhook Serverless] Falha ao processar webhook:", err);
    return res.status(500).json({ error: err.message || "Erro interno no processamento do webhook." });
  }
}

const fs = require('fs');

let webhookCode = fs.readFileSync('api/cakto/webhook.ts', 'utf-8');

const buildWebhookUpdateStr = `
function buildHomologationWebhookUpdate(ev, offerId, bodyData) {
  const updatePayload = { homologationUpdatedAt: Date.now() };
  if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
      updatePayload.homologationSubscriptionStatus = "active";
      updatePayload.homologationActivationStatus = "active";
      updatePayload.homologationPaymentStatus = "paid";
      updatePayload.homologationNextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
  } else if (ev === "subscription_created") {
      updatePayload.homologationSubscriptionStatus = "pending";
      updatePayload.homologationActivationStatus = "pending";
      updatePayload.homologationPaymentStatus = "pending";
  } else if (ev === "subscription_canceled" || ev === "canceled") {
      updatePayload.homologationSubscriptionStatus = "canceled";
      updatePayload.homologationActivationStatus = "canceled";
  }
  return updatePayload;
}
`;

if (!webhookCode.includes('buildHomologationWebhookUpdate')) {
    webhookCode = webhookCode.replace('export default async function handler', buildWebhookUpdateStr + '\nexport default async function handler');
}

const statusBlockStart = webhookCode.indexOf('  const updatePayload: any = {');
const statusBlockEnd = webhookCode.indexOf('    // Atualizar no Firestore');

if (statusBlockStart !== -1 && statusBlockEnd !== -1) {
    const newStatusBlock = `
  let updatePayload = {};
  if (isSimulation) {
    updatePayload = buildHomologationWebhookUpdate(ev, offerId, bodyData);
    updatePayload.homologationLastEventId = eventId;
    updatePayload.homologationLastEvent = eventName;
    if (orderId) updatePayload.homologationOrderId = String(orderId);
    if (subscriptionId) updatePayload.homologationSubscriptionId = String(subscriptionId);
    if (customerId) updatePayload.homologationCustomerId = String(customerId);
    if (offerId) updatePayload.homologationOfferId = offerId;
  } else {
    updatePayload = { updatedAt: Date.now(), caktoLastEventId: eventId, caktoLastEvent: eventName };
    if (orderId) updatePayload.caktoOrderId = String(orderId);
    if (subscriptionId) updatePayload.caktoSubscriptionId = String(subscriptionId);
    if (customerId) updatePayload.caktoCustomerId = String(customerId);
    if (offerId) updatePayload.caktoOfferId = offerId;
    if (customerEmail) updatePayload.ownerEmail = customerEmail;
    updatePayload.billingProvider = "cakto";

    if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
      if (salonDoc?.exists) {
        const data = salonDoc.data();
        if (data?.pendingOfferId && offerId && data.pendingOfferId !== offerId) {
          console.error(\`[Cakto Webhook] ALERTA DE SEGURANÇA: Oferta divergente detectada para o salão \${salonId}. Esperada: \${data.pendingOfferId}, Recebida: \${offerId}.\`);
          
          const historyRef = adminDb.collection("salons").doc(salonId).collection("billingHistory").doc();
          await historyRef.set({
            id: historyRef.id,
            eventType: "webhook_offer_mismatch",
            title: "Divergência de Oferta Bloqueada",
            description: \`A assinatura Cakto foi rejeitada por divergência de oferta (Esperada: \${data.pendingOfferId}, Recebida: \${offerId}).\`,
            timestamp: Date.now(),
            recordedBy: "system"
          });

          return res.status(200).json({ success: false, requiresReview: true, reason: "offer_mismatch" });
        }
      }
      
      updatePayload.subscriptionStatus = "active";
      updatePayload.caktoPaymentStatus = "paid";
      updatePayload.paymentStatus = "paid";
      updatePayload.plan = mappedPlan || (salonDoc?.exists ? salonDoc.data()?.plan : null) || "start";
      updatePayload.isActive = true;
      
      updatePayload.pendingPlan = null;
      updatePayload.pendingOfferId = null;
      updatePayload.pendingCheckoutUrl = null;
      updatePayload.pendingCheckoutEmail = null;
      updatePayload.pendingRequestedAt = null;
      updatePayload.pendingCheckoutPurpose = null;
      updatePayload.pendingBillingActivation = null;

      const periodEnd = bodyData.current_period_end || bodyData.next_billing_date || bodyData.nextBillingDate;
      let nextBillingDate = periodEnd ? new Date(periodEnd).getTime() : (Date.now() + 30 * 24 * 60 * 60 * 1000);
      updatePayload.nextBillingDate = nextBillingDate;
      updatePayload.lastPaymentAt = Date.now();
      updatePayload.lastPaymentAmount = amount;
    } else if (ev === "subscription_canceled" || ev === "canceled") {
      updatePayload.subscriptionStatus = "canceled";
      updatePayload.activationStatus = "canceled";
    } else if (ev === "subscription_created") {
      updatePayload.subscriptionStatus = "pending";
    }
  }
`;
    webhookCode = webhookCode.substring(0, statusBlockStart) + newStatusBlock + webhookCode.substring(statusBlockEnd);
    fs.writeFileSync('api/cakto/webhook.ts', webhookCode);
    console.log('Updated webhook.ts');
    
    // Server/index.ts
    let serverCode = fs.readFileSync('server/index.ts', 'utf-8');
    if (!serverCode.includes('buildHomologationWebhookUpdate')) {
        serverCode = serverCode.replace('async function processCaktoWebhookPayload', buildWebhookUpdateStr + '\nasync function processCaktoWebhookPayload');
    }
    const serverStatusBlockStart = serverCode.indexOf('  const updatePayload: any = {', serverCode.indexOf('async function processCaktoWebhookPayload'));
    const serverStatusBlockEnd = serverCode.indexOf('    // Atualizar no Firestore', serverStatusBlockStart);
    if (serverStatusBlockStart !== -1 && serverStatusBlockEnd !== -1) {
        let serverNewStatusBlock = newStatusBlock.replace(/isSimulation/g, 'skipTokenValidation');
        serverNewStatusBlock = serverNewStatusBlock.replace(/return res\.status\(200\)\.json\(/g, 'return { status: 200, data: ');
        serverNewStatusBlock = serverNewStatusBlock.replace(/\}\);/g, '} };');
        
        serverCode = serverCode.substring(0, serverStatusBlockStart) + serverNewStatusBlock + serverCode.substring(serverStatusBlockEnd);
        fs.writeFileSync('server/index.ts', serverCode);
        console.log('Updated server/index.ts webhook block');
    }
}

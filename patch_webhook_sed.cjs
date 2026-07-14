const fs = require('fs');
let code = fs.readFileSync('api/cakto/webhook.ts', 'utf-8');
const regex = /const updatePayload: any = \{[\s\S]*?\/\/ Atualizar no Firestore/m;
const replacement = `
  let updatePayload: any = {};
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
          console.error(\`[Cakto Webhook] ALERTA DE SEGURANÇA: Oferta divergente detectada. Esperada: \${data.pendingOfferId}, Recebida: \${offerId}.\`);
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

  // Atualizar no Firestore
`;
if(regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('api/cakto/webhook.ts', code);
    console.log('Webhook updated successfully.');
} else {
    console.log('Regex not found in webhook');
}

let serverCode = fs.readFileSync('server/index.ts', 'utf-8');
const regexServer = /const updatePayload: any = \{[\s\S]*?\/\/ Atualizar no Firestore/m;
let serverReplacement = replacement.replace(/isSimulation/g, 'skipTokenValidation');
serverReplacement = serverReplacement.replace(/return res\.status\(200\)\.json\(/g, 'return { status: 200, data: ');
serverReplacement = serverReplacement.replace(/\}\);/g, '} };');

// we need to make sure we only replace the one inside processCaktoWebhookPayload
// serverCode has two endpoints maybe, but processCaktoWebhookPayload has this logic.
const processIdx = serverCode.indexOf('async function processCaktoWebhookPayload');
if(processIdx !== -1) {
    const part1 = serverCode.substring(0, processIdx);
    let part2 = serverCode.substring(processIdx);
    if(regexServer.test(part2)) {
        part2 = part2.replace(regexServer, serverReplacement);
        fs.writeFileSync('server/index.ts', part1 + part2);
        console.log('Server webhook updated successfully.');
    } else {
        console.log('Regex not found in server');
    }
}

const fs = require('fs');

let code = fs.readFileSync('api/cakto/webhook.ts', 'utf-8');

const buildWebhookUpdateStr = `
function buildHomologationWebhookUpdate(ev, offerId, bodyData) {
  const updatePayload = { homologationUpdatedAt: Date.now() };
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
`;

if (!code.includes('buildHomologationWebhookUpdate')) {
    code = code.replace('export default async function handler', buildWebhookUpdateStr + '\nexport default async function handler');
}

const startString = `  const updatePayload: any = {`;
const endString = `    }  }`;

const startIdx = code.indexOf(startString);
let endIdx = code.indexOf(endString, startIdx);
endIdx += endString.length;

const newStatusBlock = `
  let updatePayload: any = {};
  if (isSimulation) {
    updatePayload = buildHomologationWebhookUpdate(ev, offerId, normalizedData);
    updatePayload.homologationLastEventId = eventId;
    updatePayload.homologationLastEvent = eventName;
    if (orderId) updatePayload.homologationOrderId = String(orderId);
    if (subscriptionId) updatePayload.homologationSubscriptionId = String(subscriptionId);
    if (customerId) updatePayload.homologationCustomerId = String(customerId);
    if (offerId) updatePayload.homologationOfferId = offerId;
  } else {
    updatePayload = { updatedAt: Date.now(), caktoLastEventId: eventId, caktoLastEvent: eventName, billingProvider: "cakto" };
    if (orderId) updatePayload.caktoOrderId = String(orderId);
    if (subscriptionId) updatePayload.caktoSubscriptionId = String(subscriptionId);
    if (customerId) updatePayload.caktoCustomerId = String(customerId);
    if (offerId) updatePayload.caktoOfferId = offerId;
    if (customerEmail) updatePayload.ownerEmail = customerEmail;

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
      updatePayload.activationStatus = "active";
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

      const periodEnd = normalizedData.current_period_end || normalizedData.next_billing_date || normalizedData.nextBillingDate;
      let nextBillingDate = periodEnd ? new Date(periodEnd).getTime() : (Date.now() + 30 * 24 * 60 * 60 * 1000);
      updatePayload.nextBillingDate = nextBillingDate;
      updatePayload.lastPaymentAt = Date.now();
      updatePayload.lastPaymentAmount = normalizedData.amount || normalizedData.value || normalizedData.price || 0;
    } else if (ev === "subscription_canceled" || ev === "refund" || ev === "chargeback" || ev.includes("cancel") || ev.includes("refund") || ev.includes("chargeback")) {
      updatePayload.subscriptionStatus = "canceled";
      updatePayload.activationStatus = "canceled";
      updatePayload.caktoPaymentStatus = "canceled";
      updatePayload.paymentStatus = "canceled";
      updatePayload.isActive = false;
    } else if (ev === "purchase_refused" || ev === "subscription_renewal_refused" || ev.includes("refused") || ev.includes("failed") || ev.includes("rejected") || ev.includes("overdue")) {
      updatePayload.subscriptionStatus = "overdue";
      updatePayload.activationStatus = "blocked";
      updatePayload.caktoPaymentStatus = "refused";
      updatePayload.paymentStatus = "overdue";
      updatePayload.isActive = false;
    } else if (ev === "subscription_created" || ev.includes("trial") || ev.includes("created")) {
      if (salonDoc?.exists && salonDoc.data()?.subscriptionStatus !== "active") {
        updatePayload.subscriptionStatus = "pending";
        updatePayload.caktoPaymentStatus = "pending";
        updatePayload.paymentStatus = "pending";
      }
    }
  }`;

code = code.substring(0, startIdx) + newStatusBlock + code.substring(endIdx);
fs.writeFileSync('api/cakto/webhook.ts', code);
console.log('Webhook updated successfully with precise slice!');

// server/index.ts
let serverCode = fs.readFileSync('server/index.ts', 'utf-8');
if (!serverCode.includes('buildHomologationWebhookUpdate')) {
    serverCode = serverCode.replace('async function processCaktoWebhookPayload', buildWebhookUpdateStr + '\nasync function processCaktoWebhookPayload');
}

const serverStartString = `  const updatePayload: any = {`;
const serverEndString = `    }  }`;
const sProcessStart = serverCode.indexOf('async function processCaktoWebhookPayload');
const sStartIdx = serverCode.indexOf(serverStartString, sProcessStart);
let sEndIdx = serverCode.indexOf(serverEndString, sStartIdx);
sEndIdx += serverEndString.length;

let serverNewStatusBlock = newStatusBlock.replace(/isSimulation/g, 'skipTokenValidation');
serverNewStatusBlock = serverNewStatusBlock.replace(/return res\.status\(200\)\.json\(/g, 'return { status: 200, data: ');
serverNewStatusBlock = serverNewStatusBlock.replace(/\}\);/g, '} };');

serverCode = serverCode.substring(0, sStartIdx) + serverNewStatusBlock + serverCode.substring(sEndIdx);
fs.writeFileSync('server/index.ts', serverCode);
console.log('Server index updated successfully with precise slice!');

const fs = require('fs');

function patchWebhook(file) {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf-8');

  // 1. Fix webhook unconditional billingProvider="cakto"
  const payloadTarget = `  const realUpdatePayload: any = {
    billingProvider: "cakto",
    caktoLastEventId: eventId,
    caktoLastEvent: eventName,
    updatedAt: Date.now()
  };`;
  const payloadReplacement = `  const realUpdatePayload: any = {
    caktoLastEventId: eventId,
    caktoLastEvent: eventName,
    updatedAt: Date.now()
  };`;
  code = code.replace(payloadTarget, payloadReplacement);

  // 2. Add billingProvider="cakto" to active rules
  const activeTarget = `  if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
    realUpdatePayload.subscriptionStatus = "active";`;
  const activeReplacement = `  if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
    realUpdatePayload.billingProvider = "cakto";
    realUpdatePayload.subscriptionStatus = "active";`;
  code = code.replace(activeTarget, activeReplacement);

  // 3. Fix pending status for preview/founder
  const pendingTarget = `  } else if (ev === "subscription_created" || ev.includes("trial") || ev.includes("created")) {
    if (salonDoc?.exists && salonDoc.data()?.subscriptionStatus !== "active") {
      realUpdatePayload.subscriptionStatus = "pending";
      realUpdatePayload.caktoPaymentStatus = "pending";
      realUpdatePayload.paymentStatus = "pending";
    }
  }`;
  const pendingReplacement = `  } else if (ev === "subscription_created" || ev.includes("trial") || ev.includes("created")) {
    if (salonDoc?.exists) {
      const currentStatus = salonDoc.data()?.subscriptionStatus;
      if (currentStatus !== "active" && currentStatus !== "preview") {
        realUpdatePayload.subscriptionStatus = "pending";
      }
      realUpdatePayload.caktoPaymentStatus = "pending";
      realUpdatePayload.paymentStatus = "pending";
    }
  }`;
  code = code.replace(pendingTarget, pendingReplacement);

  fs.writeFileSync(file, code);
  console.log('Fixed ' + file);
}

function patchRealSubscription(file) {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf-8');

  const errorTarget1 = `return res.status(500).json({ error: err.message || "Erro interno ao consultar assinatura real na Cakto." });`;
  const errorReplacement1 = `return res.status(500).json({ error: "Erro interno ao processar sua solicitação no gateway de pagamento. Por favor, contate o suporte." });`;
  code = code.split(errorTarget1).join(errorReplacement1);

  fs.writeFileSync(file, code);
  console.log('Fixed ' + file);
}

function patchCreateCheckout(file) {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf-8');

  const errorTarget2 = `return res.status(500).json({ error: err.message || "Falha ao iniciar faturamento via Cakto." });`;
  const errorReplacement2 = `return res.status(500).json({ error: "Falha ao iniciar faturamento via Cakto. Por favor, verifique sua conexão ou contate o suporte." });`;
  code = code.split(errorTarget2).join(errorReplacement2);

  fs.writeFileSync(file, code);
  console.log('Fixed ' + file);
}

patchWebhook('api/cakto/webhook.ts');
patchRealSubscription('api/cakto/real-subscription.ts');
patchCreateCheckout('api/cakto/create-checkout.ts');


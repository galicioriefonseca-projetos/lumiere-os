import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { asaasRequest } from "../_shared/asaasClient";
import { verifyIdToken, canManageBilling } from "../_shared/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Verificar autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      console.error("[Asaas Subscription Serverless] Erro de autenticação:", authErr);
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    const { salonId, customerId, planId, paymentMethod } = req.body || {};
    if (!salonId || !customerId || !planId) {
      return res.status(400).json({ error: "salonId, customerId e planId são obrigatórios." });
    }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection("salons").doc(salonId);
    const salonDoc = await salonRef.get();

    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
    }

    const salonData = salonDoc.data();

    // 2. Verificar permissões
    const authResult = await canManageBilling(user, salonId, salonData);
    console.log(`[Asaas Subscription Serverless] UID: ${user.uid} | Salon: ${salonId} | Role: ${authResult.role || "Nenhuma"} | Autorizado: ${authResult.authorized}`);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || "Você não tem permissão para gerenciar o faturamento deste salão." });
    }

    // 3. Idempotência: Se já houver asaasSubscriptionId, retornar as informações existentes
    if (salonData?.asaasSubscriptionId) {
      console.log(`[Asaas Subscription Serverless] Salão ${salonId} já possui assinatura ativa: ${salonData.asaasSubscriptionId}`);
      return res.status(200).json({
        id: salonData.asaasSubscriptionId,
        externalId: salonData.asaasSubscriptionId,
        salonId,
        customerId,
        planId,
        status: salonData.subscriptionStatus || "active",
        price: salonData.lastPaymentAmount || 0,
        paymentMethod: paymentMethod || "credit_card",
        interval: "monthly",
        createdAt: new Date(salonData.createdAt || Date.now()),
        updatedAt: new Date(),
      });
    }

    // 4. Calcular valor do plano baseado em planId
    const planPrices: Record<string, number> = {
      start: Number(process.env.ASAAS_PLAN_START_AMOUNT) || Number(process.env.MP_PLAN_START_AMOUNT) || 197,
      studio: Number(process.env.ASAAS_PLAN_STUDIO_AMOUNT) || Number(process.env.MP_PLAN_STUDIO_AMOUNT) || 397,
      performance: Number(process.env.ASAAS_PLAN_PERFORMANCE_AMOUNT) || Number(process.env.MP_PLAN_PERFORMANCE_AMOUNT) || 697,
      network: Number(process.env.ASAAS_PLAN_NETWORK_AMOUNT) || Number(process.env.MP_PLAN_NETWORK_AMOUNT) || 1497,
      founder: Number(process.env.ASAAS_PLAN_FOUNDER_AMOUNT) || Number(process.env.MP_PLAN_FOUNDER_AMOUNT) || 297,
    };
    const planAmount = planPrices[planId] || 197;

    // 5. Configurar o vencimento para o primeiro dia do próximo mês
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    nextDueDate.setDate(1);
    const nextDueDateStr = nextDueDate.toISOString().split("T")[0];

    const billingType = paymentMethod === "credit_card" ? "CREDIT_CARD" : paymentMethod === "pix" ? "PIX" : "BOLETO";

    const subscriptionPayload = {
      customer: customerId,
      billingType,
      value: planAmount,
      nextDueDate: nextDueDateStr,
      cycle: "MONTHLY",
      description: `LumièreOS - Plano ${planId.toUpperCase()}`,
      externalReference: salonId,
    };

    // 6. Criar assinatura no Asaas
    const asaasSubscription = await asaasRequest("POST", "/subscriptions", subscriptionPayload);

    // 7. Buscar primeiro pagamento para obter checkoutUrl (invoiceUrl)
    let checkoutUrl = "";
    try {
      const paymentsResponse = await asaasRequest("GET", `/payments?subscription=${asaasSubscription.id}`);
      if (paymentsResponse.data && paymentsResponse.data.length > 0) {
        checkoutUrl = paymentsResponse.data[0].invoiceUrl;
      }
    } catch (err) {
      console.warn("[Asaas Subscription Serverless] Erro ao carregar checkoutUrl para a assinatura recém-criada:", err);
    }

    // 8. Atualizar informações no Firestore
    const billingMode = billingType === "CREDIT_CARD" ? "recurring_card" : "manual_pix";
    await salonRef.update({
      billingProvider: "asaas",
      billingMode,
      asaasSubscriptionId: asaasSubscription.id,
      asaasCheckoutUrl: checkoutUrl || null,
      subscriptionStatus: "pending_payment",
      paymentStatus: "pending",
      plan: planId,
      nextBillingDate: nextDueDate.getTime(),
      updatedAt: Date.now(),
    });

    console.log(`[Asaas Subscription Serverless] Assinatura criada com sucesso para o salão ${salonId}: ${asaasSubscription.id}`);
    return res.status(200).json({
      id: asaasSubscription.id,
      externalId: asaasSubscription.id,
      salonId,
      customerId,
      planId,
      status: "pending_payment",
      price: planAmount,
      paymentMethod: paymentMethod || "credit_card",
      interval: "monthly",
      checkoutUrl: checkoutUrl || null,
      trialEnd: nextDueDate,
      nextDueDate,
      createdAt: new Date(asaasSubscription.dateCreated),
      updatedAt: new Date(),
    });
  } catch (err: any) {
    console.error("[Asaas Subscription Serverless] Erro ao criar assinatura:", err);
    return res.status(500).json({ error: err.message || "Falha ao criar assinatura no Asaas." });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../../shared/firebaseAdmin.js";
import { verifyIdToken, canManageBilling } from "../../shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { salonId } = req.query || {};
    if (!salonId) {
      return res.status(400).json({ error: "O parâmetro salonId é obrigatório." });
    }

    // 1. Autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      console.error("[Cakto Status Serverless] Erro de autenticação:", authErr);
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection("salons").doc(String(salonId)).get();

    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
    }

    const salonData = salonDoc.data();

    // 2. Autorização de Faturamento
    const authResult = await canManageBilling(user, String(salonId), salonData);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || "Não autorizado." });
    }

    // 3. Retornar status atual
    return res.status(200).json({
      billingProvider: salonData?.billingProvider || "none",
      subscriptionStatus: salonData?.subscriptionStatus || "none",
      paymentStatus: salonData?.paymentStatus || "none",
      caktoPaymentStatus: salonData?.caktoPaymentStatus || "none",
      nextBillingDate: salonData?.nextBillingDate || null,
      caktoCustomerId: salonData?.caktoCustomerId || null,
      caktoOrderId: salonData?.caktoOrderId || null,
      caktoSubscriptionId: salonData?.caktoSubscriptionId || null,
      caktoCheckoutUrl: salonData?.caktoCheckoutUrl || null,
      caktoOfferId: salonData?.caktoOfferId || null,
    });

  } catch (err: any) {
    console.error("[Cakto Status Serverless] Erro ao obter status:", err);
    return res.status(500).json({ error: "Falha ao obter status de faturamento.", code: "SUBSCRIPTION_STATUS_FAILED" });
  }
}

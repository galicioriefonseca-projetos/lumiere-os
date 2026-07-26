import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, isFirebaseAdminCredentialError } from "../../shared/firebaseAdmin.js";
import { verifyIdToken, canManageBilling } from "../../shared/auth.js";

function getCaktoApiBaseUrl() {
  const raw = process.env.CAKTO_API_URL || "https://api.cakto.com.br";
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    return "https://api.cakto.com.br";
  }
}

async function getCaktoAccessToken(): Promise<string> {
  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;
  const apiUrl = getCaktoApiBaseUrl();

  if (!clientId || !clientSecret) {
    throw new Error("CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no servidor.");
  }

  const url = `${apiUrl}/public_api/token/`;
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error("CAKTO_UPSTREAM_ERROR");
  }

  const data = await response.json();
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  
  try {
    const { salonId } = req.query;
    if (!salonId) {
      return res.status(400).json({ error: "O parâmetro salonId é obrigatório." });
    }
    
    // Validar salonId: /^[A-Za-z0-9_-]{3,128}$/
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(String(salonId))) {
      return res.status(400).json({ error: "Formato de salonId inválido." });
    }
    
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (e: any) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }
    
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection("salons").doc(String(salonId)).get();
    
    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salão não encontrado." });
    }
    
    const salonData = salonDoc.data();
    
    const authResult = await canManageBilling(user, String(salonId), salonData);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || "Não autorizado." });
    }
    
    if (salonData?.billingProvider === "manual" || salonData?.billingMode === "manual_pix" || (salonData?.billingProvider === "cakto" && salonData?.caktoSubscriptionId && salonData.caktoSubscriptionId.startsWith("sub_manual"))) {
      return res.status(200).json({
         status: salonData?.subscriptionStatus || salonData?.activationStatus || (salonData?.isActive ? "active" : "canceled"),
         amount: salonData?.lastPaymentAmount || 0,
         paymentMethod: "manual",
         next_payment_date: salonData?.nextBillingDate || null,
         offer: null,
         recurrence_period: "monthly",
         hasRealSubscription: false,
         billingProvider: "manual",
         paymentStatus: salonData?.paymentStatus || "paid"
      });
    }
    
    const subscriptionId = salonData?.caktoSubscriptionId;
    if (!subscriptionId) {
      return res.status(409).json({ 
        error: "A assinatura Cakto ainda não foi confirmada.",
        requiresCheckout: true
      });
    }
    
    if (subscriptionId.toLowerCase().includes("homolog") || subscriptionId.toLowerCase().includes("simulated")) {
      return res.status(200).json({
        hasRealSubscription: false,
        homologation: true,
        status: salonData?.homologationSubscriptionStatus || "pending",
        amount: salonData?.homologationLastPaymentAmount || 0,
        paymentMethod: salonData?.homologationPaymentMethod || "not_informed",
        next_payment_date: salonData?.homologationNextBillingDate || null,
        offer: salonData?.homologationOfferId || null,
        recurrence_period: "monthly"
      });
    }
    
    const accessToken = await getCaktoAccessToken();
    const apiUrl = getCaktoApiBaseUrl();
    const subUrl = `${apiUrl}/public_api/subscriptions/${encodeURIComponent(subscriptionId)}/`;
    
    const response = await fetch(subUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error("[Cakto Real Subscription Error] Falha upstream:", errText);
      return res.status(502).json({ 
        error: "Não foi possível consultar o gateway de pagamento neste momento.",
        code: "CAKTO_UPSTREAM_ERROR"
      });
    }
    
    const caktoSub = await response.json();
    const status = caktoSub.status || caktoSub.subscriptionStatus || "unknown";
    const amount = caktoSub.amount || caktoSub.value || 0;
    const paymentMethod = caktoSub.paymentMethod || caktoSub.payment_method || caktoSub.billingType || "not_informed";
    const next_payment_date = caktoSub.next_payment_date || caktoSub.next_billing_date || caktoSub.nextBillingDate || null;
    const offer = caktoSub.offer || caktoSub.offer_id || caktoSub.offerId || null;
    const recurrence_period = caktoSub.recurrence_period || caktoSub.recurrencePeriod || "monthly";
    
    return res.status(200).json({
      status,
      amount,
      paymentMethod,
      next_payment_date,
      offer,
      recurrence_period
    });
    
  } catch (err: any) {
    if (isFirebaseAdminCredentialError(err)) {
      console.error("[LumièreOS SERVER ERROR] Firebase Admin credential error caught in real-sub:", err);
      return res.status(503).json({
        error: "O serviço de faturamento está temporariamente indisponível.",
        code: "FIREBASE_ADMIN_AUTH_FAILED"
      });
    }
    console.error("[Cakto Real Sub Serverless] Erro ao obter assinatura real:", err);
    return res.status(502).json({ 
      error: "Não foi possível consultar o gateway de pagamento neste momento.",
      code: "CAKTO_UPSTREAM_ERROR"
    });
  }
}

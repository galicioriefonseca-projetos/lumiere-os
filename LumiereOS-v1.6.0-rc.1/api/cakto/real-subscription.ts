import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, isFirebaseAdminCredentialError } from "../_shared/firebaseAdmin.js";
import { verifyIdToken, canManageBilling } from "../_shared/auth.js";

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
    throw new Error(`Falha ao obter token da Cakto. Status: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.access_token) {
    throw new Error("Token de acesso não encontrado na resposta do Cakto.");
  }

  return data.access_token;
}

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
    const normalizedSalonId = Array.isArray(salonId) ? salonId[0] : String(salonId);
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(normalizedSalonId)) {
      return res.status(400).json({ error: "salonId inválido." });
    }

    // 1. Autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      if (isFirebaseAdminCredentialError(authErr)) {
        throw authErr;
      }
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection("salons").doc(normalizedSalonId).get();

    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salão não encontrado." });
    }

    const salonData = salonDoc.data();

    // 2. Autorização
    const authResult = await canManageBilling(user, normalizedSalonId, salonData);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || "Não autorizado." });
    }

    const subscriptionId = salonData?.caktoSubscriptionId;
    const billingProvider = salonData?.billingProvider;

    const isManualActive = (billingProvider === "manual" || salonData?.billingMode === "manual_pix") &&
      salonData?.subscriptionStatus === "active" &&
      salonData?.paymentStatus === "paid";

    if (isManualActive && !subscriptionId) {
      return res.status(200).json({
        hasRealSubscription: false,
        billingProvider: "manual",
        status: "active",
        paymentStatus: "paid",
        next_payment_date: salonData?.nextBillingDate || null
      });
    }

    if (billingProvider === "cakto" && !subscriptionId) {
      return res.status(409).json({
        error: "A assinatura Cakto ainda não foi confirmada.",
        requiresCheckout: true
      });
    }

    if (!subscriptionId) {
      return res.status(400).json({ error: "Nenhuma assinatura Cakto configurada para este salão." });
    }

    // Proteger contra IDs simulados / homologados
    const isHomolog = subscriptionId.toLowerCase().includes("homolog") || 
                      subscriptionId.toLowerCase().includes("simulated") || 
                      subscriptionId === "sub_simulated_dev";
    if (isHomolog) {
      // Se for Platform Admin (verificado via authResult.role), retornamos dados simulados com sucesso para permitir testes e desenvolvimento.
      // Clientes reais nunca visualizam dados simulados.
      const isUserPlatformAdmin = authResult.role === "platform_admin";
      if (isUserPlatformAdmin) {
        return res.status(200).json({
          status: salonData?.homologationSubscriptionStatus || "pending",
          amount: salonData?.homologationLastPaymentAmount || salonData?.lastPaymentAmount || null,
          paymentMethod: salonData?.paymentMethod || null,
          next_payment_date: salonData?.homologationNextBillingDate || null,
          offer: salonData?.homologationOfferId || null,
          recurrence_period: "monthly",
          isSimulated: true
        });
      }

      return res.status(400).json({ 
        error: "Sua assinatura está em modo de homologação/simulação. Migre a conta para produção antes de prosseguir.",
        isHomolog: true
      });
    }

    // Fazer a chamada real para a Cakto
    const accessToken = await getCaktoAccessToken();
    const apiUrl = getCaktoApiBaseUrl();
    const caktoUrl = `${apiUrl}/public_api/subscriptions/${encodeURIComponent(String(subscriptionId))}/`;

    const response = await fetch(caktoUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Cakto Real Sub Serverless] Erro upstream (${response.status}):`, errText.slice(0, 1000));
      return res.status(502).json({
        error: "Não foi possível consultar o gateway de pagamento neste momento.",
        code: "CAKTO_UPSTREAM_ERROR"
      });
    }

    const caktoSub = await response.json();

    const status = caktoSub.status || caktoSub.subscriptionStatus || "unknown";
    const amount = caktoSub.amount || caktoSub.value || 0;
    const paymentMethod = caktoSub.paymentMethod || caktoSub.payment_method || caktoSub.billingType || "credit_card";
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
        error: "O serviço de faturamento está temporariamente indisponível. Nossa equipe técnica já pode verificar a configuração do servidor.",
        code: "FIREBASE_ADMIN_AUTH_FAILED"
      });
    }
    console.error("[Cakto Real Sub Serverless] Erro ao obter assinatura real:", err);
    return res.status(500).json({
      error: "Não foi possível consultar os detalhes de faturamento neste momento.",
      code: "BILLING_LOOKUP_FAILED"
    });
  }
}

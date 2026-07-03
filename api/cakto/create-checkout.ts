import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { verifyIdToken, canManageBilling } from "../_shared/auth.js";

interface CaktoSettings {
  productId: string;
  founderOfferId: string;
  studioOfferId: string;
  performanceOfferId: string;
  networkOfferId: string;
  updatedAt?: number;
}

let cachedCaktoSettings: { data: CaktoSettings; expiresAt: number } | null = null;
const CAKTO_SETTINGS_CACHE_TTL = 5 * 60 * 1000;

async function getCaktoSettingsCached(): Promise<CaktoSettings> {
  if (cachedCaktoSettings && cachedCaktoSettings.expiresAt > Date.now()) {
    return cachedCaktoSettings.data;
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection("settings").doc("cakto");
  const docSnap = await docRef.get();

  let settingsData: CaktoSettings = {
    productId: "",
    founderOfferId: "",
    studioOfferId: "",
    performanceOfferId: "",
    networkOfferId: ""
  };

  if (docSnap.exists) {
    const data = docSnap.data();
    settingsData = {
      productId: data?.productId || "",
      founderOfferId: data?.founderOfferId || "",
      studioOfferId: data?.studioOfferId || "",
      performanceOfferId: data?.performanceOfferId || "",
      networkOfferId: data?.networkOfferId || "",
      updatedAt: data?.updatedAt
    };
  }

  cachedCaktoSettings = {
    data: settingsData,
    expiresAt: Date.now() + CAKTO_SETTINGS_CACHE_TTL
  };

  return settingsData;
}

let cachedCaktoToken: { token: string; expiresAt: number } | null = null;

async function getCaktoAccessToken(): Promise<string> {
  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;
  const apiUrl = process.env.CAKTO_API_URL || "https://api.cakto.com.br";

  console.log("[Cakto API Serverless Secure Log] getCaktoAccessToken chamado.");

  if (!clientId || !clientSecret) {
    throw new Error("CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no servidor.");
  }

  if (cachedCaktoToken && cachedCaktoToken.expiresAt > Date.now()) {
    return cachedCaktoToken.token;
  }

  console.log("[Cakto API Serverless] Solicitando novo token de acesso...");
  
  try {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);

    const response = await fetch(`${apiUrl}/public_api/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const responseStatus = response.status;
    const text = await response.text();
    
    if (response.ok) {
      const data = JSON.parse(text);
      if (data && data.access_token) {
        const expiresIn = (data.expires_in || 3600) * 1000;
        cachedCaktoToken = {
          token: data.access_token,
          expiresAt: Date.now() + expiresIn - 60000
        };
        console.log("[Cakto API Serverless] Token de acesso obtido com sucesso!");
        return data.access_token;
      }
    }

    throw new Error(`Falha ao autenticar: Status ${responseStatus}, Resposta: ${text}`);
  } catch (err: any) {
    console.error("[Cakto API Serverless] Erro na autenticação:", err);
    throw new Error(`Falha ao autenticar com a API Cakto: ${err.message}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { salonId, planId, paymentMethod, email } = req.body || {};
    if (!salonId || !planId) {
      return res.status(400).json({ error: "salonId e planId são campos obrigatórios." });
    }

    // 1. Autenticação do Usuário
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      console.error("[Cakto Checkout Serverless] Erro de autenticação:", authErr);
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection("salons").doc(salonId);
    const salonDoc = await salonRef.get();

    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
    }

    const salonData = salonDoc.data();

    // 2. Autorização de Faturamento
    const authResult = await canManageBilling(user, salonId, salonData);
    console.log(`[Cakto Checkout Serverless Auth] UID: ${user.uid} | Salon: ${salonId} | Autorizado: ${authResult.authorized}`);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || "Você não tem permissão para gerenciar o faturamento deste salão." });
    }

    // 3. Buscar configurações dinâmicas
    let offerId = "";
    try {
      const sData = await getCaktoSettingsCached();
      switch (planId) {
        case "start": offerId = sData.founderOfferId || ""; break;
        case "studio": offerId = sData.studioOfferId || ""; break;
        case "performance": offerId = sData.performanceOfferId || ""; break;
        case "network": offerId = sData.networkOfferId || ""; break;
        default: offerId = sData.founderOfferId || ""; break;
      }
    } catch (err) {
      console.error("[Cakto Checkout Serverless] Erro ao carregar configurações dinâmicas:", err);
      return res.status(500).json({ error: "Erro ao carregar configurações de pagamento." });
    }

    if (!offerId) {
      return res.status(400).json({ error: "Oferta não configurada." });
    }

    const isProduction = process.env.NODE_ENV === "production";
    
    // URL de checkout estática
    const checkoutEmail = (email || salonData?.ownerEmail || user.email || "").toLowerCase();
    const params = new URLSearchParams({
      name: salonData?.ownerName || salonData?.name || "Cliente",
      email: checkoutEmail,
    });
    
    if (salonData?.phone) {
      const digits = String(salonData.phone).replace(/\D/g, "");
      const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
      params.append("phone", withCountry);
    }
    
    const checkoutUrl = `https://pay.cakto.com.br/${offerId}?${params.toString()}`;

    await salonRef.update({
      billingProvider: "cakto",
      caktoOfferId: offerId,
      caktoCheckoutUrl: checkoutUrl,
      caktoCheckoutEmail: checkoutEmail,
      subscriptionStatus: "pending",
      paymentStatus: "pending",
      updatedAt: Date.now(),
    });

    console.log(`[Cakto Checkout Serverless] URL de checkout montada para o salão ${salonId}`);
    return res.status(200).json({
      success: true,
      checkoutUrl,
    });

  } catch (err: any) {
    console.error("[Cakto Checkout Serverless] Falha ao processar requisição:", err);
    return res.status(500).json({ error: err.message || "Falha ao iniciar faturamento via Cakto." });
  }
}

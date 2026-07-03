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

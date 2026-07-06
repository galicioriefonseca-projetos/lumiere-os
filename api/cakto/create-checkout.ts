import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";

interface CaktoSettings {
  productId: string;
  startOfferId: string;
  founderOfferId: string;
  performanceOfferId: string;
  networkOfferId: string;
  enterpriseOfferId: string;
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
    startOfferId: "",
    founderOfferId: "",
    performanceOfferId: "",
    networkOfferId: "",
    enterpriseOfferId: ""
  };

  if (docSnap.exists) {
    const data = docSnap.data();
    settingsData = {
      productId: data?.productId || "",
      startOfferId: data?.startOfferId || "",
      founderOfferId: data?.founderOfferId || "",
      performanceOfferId: data?.performanceOfferId || "",
      networkOfferId: data?.networkOfferId || "",
      enterpriseOfferId: data?.enterpriseOfferId || "",
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
    const { 
      salonId, 
      planId, 
      paymentMethod, 
      email,
      ownerName,
      salonName,
      phone,
      city,
      state,
      businessSegment,
      estimatedProfessionals
    } = req.body || {};

    if (!salonId || !planId) {
      return res.status(400).json({ error: "salonId e planId são campos obrigatórios." });
    }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection("salons").doc(salonId);
    let salonDoc = await salonRef.get();
    let salonData = salonDoc.exists ? salonDoc.data() : null;

    let legacyBusinessType = salonData?.businessType || 'salon';
    if (businessSegment === 'Barbearia') legacyBusinessType = 'barbershop';
    else if (businessSegment === 'Clínica de Estética') legacyBusinessType = 'clinic';

    const now = Date.now();
    const finalEmail = (email || salonData?.ownerEmail || "").trim().toLowerCase();

    // Preparar dados de mesclagem do salão
    const mergedSalonData: any = {
      id: salonId,
      name: salonName || salonData?.name || "LumièreOS Salon",
      ownerEmail: finalEmail,
      ownerName: ownerName || salonData?.ownerName || "",
      phone: phone || salonData?.phone || "",
      city: city || salonData?.city || "",
      state: state || salonData?.state || "",
      businessType: legacyBusinessType,
      businessSegment: businessSegment || salonData?.businessSegment || "",
      estimatedProfessionals: estimatedProfessionals || salonData?.estimatedProfessionals || "",
      plan: planId,
      subscriptionStatus: salonData?.subscriptionStatus || "pending",
      activationStatus: salonData?.activationStatus || "pending",
      isActive: salonData?.isActive || false,
      createdAt: salonData?.createdAt || now,
      updatedAt: now,
      billingProvider: "cakto",
    };

    // 3. Buscar configurações dinâmicas
    let offerId = "";
    try {
      const sData = await getCaktoSettingsCached();
      switch (planId) {
        case "start": offerId = sData.startOfferId || ""; break;
        case "founder": offerId = sData.founderOfferId || ""; break;
        case "performance": offerId = sData.performanceOfferId || ""; break;
        case "network": offerId = sData.networkOfferId || ""; break;
        case "enterprise": offerId = sData.enterpriseOfferId || ""; break;
        default: offerId = sData.founderOfferId || ""; break;
      }
    } catch (err) {
      console.error("[Cakto Checkout Serverless] Erro ao carregar configurações dinâmicas:", err);
      return res.status(500).json({ error: "Erro ao carregar configurações de pagamento." });
    }

    if (!offerId) {
      return res.status(400).json({ error: "Oferta não configurada para o plano informado." });
    }

    const isProduction = process.env.NODE_ENV === "production";
    const hasCaktoCredentials = !!(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET);

    // 1. Em desenvolvimento sem credenciais, permitir simulação
    if (!isProduction && !hasCaktoCredentials) {
      console.warn("[Cakto Checkout Serverless] Aviso: Credenciais do Cakto ausentes. Usando simulação.");
      const simulatedOrderId = "ord_" + Math.random().toString(36).substring(2, 11).toUpperCase();
      const simulatedCheckoutUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard/faturamento?simulated_checkout=true&order_id=${simulatedOrderId}`;

      const simulatedData = {
        ...mergedSalonData,
        billingProvider: "cakto",
        caktoCustomerId: "cus_simulated_dev",
        caktoOrderId: simulatedOrderId,
        caktoSubscriptionId: "sub_simulated_dev",
        caktoCheckoutUrl: simulatedCheckoutUrl,
        caktoOfferId: offerId || "off_simulated",
        subscriptionStatus: salonData?.subscriptionStatus || "pending",
        paymentStatus: salonData?.paymentStatus || "pending",
        nextBillingDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now(),
      };

      await salonRef.set(simulatedData, { merge: true });

      return res.status(200).json({
        success: true,
        checkoutUrl: simulatedCheckoutUrl,
        orderId: simulatedOrderId,
        subscriptionId: "sub_simulated_dev",
        simulated: true
      });
    }

    // Se estiver em produção e faltar credenciais, reportar erro
    if (isProduction && !hasCaktoCredentials) {
      console.error("[Cakto Checkout Serverless] Erro Crítico: Credenciais da Cakto ausentes no ambiente de produção.");
      return res.status(500).json({
        error: "Erro crítico: A integração com a Cakto não está configurada corretamente no ambiente de produção. Faltam as credenciais CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET."
      });
    }

    // URL de checkout estática
    const checkoutEmail = finalEmail;
    const params = new URLSearchParams({
      name: ownerName || salonData?.ownerName || mergedSalonData.name || "Cliente",
      email: checkoutEmail,
      external_id: salonId,
    });
    
    const activePhone = phone || salonData?.phone;
    if (activePhone) {
      const digits = String(activePhone).replace(/\D/g, "");
      const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
      params.append("phone", withCountry);
    }
    
    const buildCheckoutUrl = (offerIdOrUrl: string, searchParams: URLSearchParams): string => {
      if (!offerIdOrUrl) return "";
      const baseUrl = offerIdOrUrl.trim();
      if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
        try {
          const urlObj = new URL(baseUrl);
          searchParams.forEach((value, key) => {
            urlObj.searchParams.set(key, value);
          });
          return urlObj.toString();
        } catch (e) {
          const separator = baseUrl.includes("?") ? "&" : "?";
          return `${baseUrl}${separator}${searchParams.toString()}`;
        }
      } else {
        return `https://pay.cakto.com.br/${baseUrl}?${searchParams.toString()}`;
      }
    };

    const checkoutUrl = buildCheckoutUrl(offerId, params);

    // Mapear campos de checkout Cakto
    const finalData = {
      ...mergedSalonData,
      caktoOfferId: offerId,
      caktoCheckoutUrl: checkoutUrl,
      caktoCheckoutEmail: checkoutEmail,
      subscriptionStatus: salonData?.subscriptionStatus || "pending",
      paymentStatus: salonData?.paymentStatus || "pending",
      updatedAt: Date.now(),
    };

    await salonRef.set(finalData, { merge: true });

    console.log(`[Cakto Checkout Serverless] URL de checkout montada e salão registrado para ID: ${salonId}`);
    return res.status(200).json({
      success: true,
      checkoutUrl,
    });

  } catch (err: any) {
    console.error("[Cakto Checkout Serverless] Falha ao processar requisição:", err);
    return res.status(500).json({ error: err.message || "Falha ao iniciar faturamento via Cakto." });
  }
}

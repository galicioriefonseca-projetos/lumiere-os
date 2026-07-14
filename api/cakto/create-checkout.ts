import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { verifyIdToken, canManageBilling } from "../_shared/auth.js";

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
      estimatedProfessionals,
      checkoutPurpose = "new_subscription"
    } = req.body || {};

    
    if (!['new_subscription', 'activate_recurring', 'regularize_payment'].includes(checkoutPurpose)) {
      return res.status(400).json({ error: 'checkoutPurpose inválido.' });
    }
    if (!salonId || !planId) {
      return res.status(400).json({ error: "salonId e planId são campos obrigatórios." });
    }

    // Rule 6: Plano inválido deve ser rejeitado
    const validPlans = ["start", "performance", "network", "enterprise", "founder"];
    if (!validPlans.includes(planId)) {
      return res.status(400).json({ error: "O plano especificado é inválido." });
    }

    // 1. Autenticação Global do Checkout (Exigir usuário autenticado)
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      console.error("[Cakto Checkout Serverless] Erro de autenticação:", authErr);
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection("salons").doc(salonId);
    let salonDoc = await salonRef.get();
    let salonData = salonDoc.exists ? salonDoc.data() : null;

    // 2. Proteção Global Founder (Mover para fora de salonDoc.exists)
    if (planId === "founder") {
      if (!salonDoc.exists) {
        return res.status(403).json({
          error: "O plano Founder é exclusivo para contas autorizadas."
        });
      }

      const authResult = await canManageBilling(user, salonId, salonData);
      if (!authResult.authorized) {
        return res.status(403).json({ error: authResult.reason || "Não autorizado a gerenciar o faturamento deste salão." });
      }

      const isAuthorized = 
        salonData?.plan === "founder" || 
        salonData?.founderAuthorized === true || 
        salonData?.isFounderAuthorized === true || 
        salonData?.isFounder === true || 
        authResult.role === "platform_admin";

      if (!isAuthorized) {
        return res.status(403).json({
          error: "O plano Founder é exclusivo para contas autorizadas."
        });
      }
    }

    // 3. Validação baseada na Existência do Salão
    if (salonDoc.exists) {
      if (planId !== "founder") {
        const authResult = await canManageBilling(user, salonId, salonData);
        if (!authResult.authorized) {
          return res.status(403).json({ error: authResult.reason || "Não autorizado a gerenciar o faturamento deste salão." });
        }
      }

      const isRealCakto = salonData?.billingProvider === "cakto" &&
        salonData?.subscriptionStatus === "active" &&
        !!salonData?.caktoSubscriptionId &&
        !salonData?.caktoSubscriptionId?.includes("homolog") &&
        !salonData?.caktoSubscriptionId?.includes("simulated") &&
        !salonData?.caktoSubscriptionId?.includes("test");

      const isManualActive = (salonData?.billingProvider === "manual" || salonData?.billingMode === "manual_pix") &&
        salonData?.subscriptionStatus === "active" &&
        salonData?.paymentStatus === "paid" &&
        !isRealCakto;

      // 4. Activate Recurring
      if (checkoutPurpose === "activate_recurring") {
        if (!isManualActive) {
          return res.status(400).json({ error: "Apenas contas com plano manual ativo podem ativar a recorrência." });
        }
        if (planId !== salonData?.plan) {
          return res.status(400).json({ error: "A recorrência deve ser configurada para o plano atual da conta. Não é permitida a troca de plano neste fluxo." });
        }
        if (isRealCakto) {
          return res.status(400).json({ error: "Este salão já possui uma assinatura ativa da Cakto." });
        }
      }

      if (isRealCakto && checkoutPurpose !== "activate_recurring") {
        return res.status(400).json({ 
          error: "Este salão já possui uma assinatura ativa da Cakto. Para alterar, use a Central de Planos." 
        });
      }

      if (isManualActive && checkoutPurpose !== "activate_recurring") {
        return res.status(400).json({ 
          error: "Este salão possui uma assinatura manual ativa. Para ativar a recorrência, use checkoutPurpose: 'activate_recurring'." 
        });
      }
    } else {
      // Salão inexistente
      if (checkoutPurpose !== "new_subscription") {
        return res.status(400).json({ error: "Para novos salões, o checkoutPurpose deve ser 'new_subscription'." });
      }

      const allowedPlansForNew = ["start", "performance", "network", "enterprise"];
      if (!allowedPlansForNew.includes(planId)) {
        return res.status(400).json({ error: "O plano solicitado não é permitido para novas inscrições." });
      }
    }

    let legacyBusinessType = salonData?.businessType || 'salon';
    if (businessSegment === 'Barbearia') legacyBusinessType = 'barbershop';
    else if (businessSegment === 'Clínica de Estética') legacyBusinessType = 'clinic';

    const now = Date.now();
    const finalEmail = (email || salonData?.ownerEmail || "").trim().toLowerCase();

    // Fields to save initially
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
      updatedAt: now,
    };
    
    // We do NOT modify definitive plan/billingProvider/status fields here unless they are not set.
    if (salonDoc.exists) {
      if (!salonData?.plan) mergedSalonData.plan = "start";
      if (!salonData?.subscriptionStatus) mergedSalonData.subscriptionStatus = "pending";
      if (!salonData?.activationStatus) mergedSalonData.activationStatus = "pending";
      if (typeof salonData?.isActive !== "boolean") mergedSalonData.isActive = false;
      if (!salonData?.createdAt) mergedSalonData.createdAt = now;
    }

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
        default: 
            return res.status(400).json({ error: "O plano especificado não possui oferta configurada." });
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
      const simulatedCheckoutUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard/assinatura?simulated_checkout=true&order_id=${simulatedOrderId}`;

      const simulatedData = {
        ...mergedSalonData,
        homologationCustomerId: "cus_simulated_dev",
        homologationOrderId: simulatedOrderId,
        homologationSubscriptionId: "sub_simulated_dev",
        homologationCheckoutUrl: simulatedCheckoutUrl,
        homologationOfferId: offerId || "off_simulated",
        pendingPlan: planId,
        pendingOfferId: offerId,
        pendingCheckoutUrl: simulatedCheckoutUrl,
        pendingCheckoutEmail: finalEmail,
        pendingRequestedAt: Date.now(),
        pendingCheckoutPurpose: checkoutPurpose,
        pendingBillingActivation: true,
        updatedAt: Date.now(),
      };
      
      if (salonDoc.exists) {
        await salonRef.set(simulatedData, { merge: true });
      } else {
        await adminDb.collection("onboarding").doc(salonId).set(simulatedData);
      }

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
      return res.status(503).json({
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
      pendingPlan: planId,
      pendingOfferId: offerId,
      pendingCheckoutUrl: checkoutUrl,
      pendingCheckoutEmail: checkoutEmail,
      pendingRequestedAt: Date.now(),
      pendingCheckoutPurpose: checkoutPurpose,
      pendingBillingActivation: true,
      updatedAt: Date.now(),
    };

    if (salonDoc.exists) {
      await salonRef.set(finalData, { merge: true });
    } else {
      await adminDb.collection("onboarding").doc(salonId).set(finalData);
    }

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

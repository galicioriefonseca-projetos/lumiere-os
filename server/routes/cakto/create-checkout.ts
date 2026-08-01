import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, isFirebaseAdminCredentialError } from "../../shared/firebaseAdmin.js";
import { sendCheckoutEmail } from "../../shared/email.js";
import { verifyIdToken, canManageBilling } from "../../shared/auth.js";

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
    if (typeof salonId !== "string" || !/^[A-Za-z0-9_-]{3,128}$/.test(salonId)) {
      return res.status(400).json({ error: "salonId inválido." });
    }
    if (email && (typeof email !== "string" || email.length > 254)) {
      return res.status(400).json({ error: "E-mail de faturamento inválido." });
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
      if (isFirebaseAdminCredentialError(authErr)) {
        throw authErr;
      }
      console.error("[Cakto Checkout Serverless] Erro de autenticação:", authErr);
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    const authenticatedEmail = String(user.email || "").trim().toLowerCase();
    if (!authenticatedEmail) {
      return res.status(400).json({ error: "A conta autenticada não possui e-mail válido." });
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
      const submittedEmail = String(email || "").trim().toLowerCase();
      if (submittedEmail && submittedEmail !== authenticatedEmail) {
        return res.status(400).json({ error: "O e-mail informado não corresponde à conta autenticada." });
      }
      if (!ownerName || !salonName || !phone || !city || !state || !businessSegment || !estimatedProfessionals) {
        return res.status(400).json({ error: "Dados obrigatórios do onboarding estão incompletos." });
      }
    }

    // Verificar se já existe onboarding/{salonId} e se pertence a outro usuário
    const onboardingRef = adminDb.collection("onboarding").doc(salonId);
    const onboardingSnap = await onboardingRef.get();
    if (!salonDoc.exists && onboardingSnap.exists) {
      const obData = onboardingSnap.data();
      const authResult = await canManageBilling(user, salonId, salonData);
      const isPlatformAdmin = authResult.role === "platform_admin";
      if (obData?.ownerId !== user.uid && !isPlatformAdmin) {
        return res.status(403).json({ error: "Este onboarding pertence a outro usuário." });
      }
    }

    const now = Date.now();
    let checkoutEmail = "";
    if (salonDoc.exists) {
      if (salonData?.billingEmail) {
        checkoutEmail = salonData.billingEmail;
      } else if (email && typeof email === "string" && email.includes("@")) {
        checkoutEmail = email;
      } else if (salonData?.ownerEmail) {
        checkoutEmail = salonData.ownerEmail;
      } else {
        checkoutEmail = user.email || "";
      }
    } else {
      checkoutEmail = authenticatedEmail;
    }
    checkoutEmail = checkoutEmail.trim().toLowerCase();

    // Dados de Onboarding (salão inexistente)
    let onboardingData: any = null;
    if (!salonDoc.exists) {
      const createdNow = onboardingSnap.exists ? (onboardingSnap.data()?.createdAt || now) : now;
      let legacyBusinessType = 'salon';
      if (businessSegment === 'Barbearia') legacyBusinessType = 'barbershop';
      else if (businessSegment === 'Clínica de Estética') legacyBusinessType = 'clinic';

      const onboardingEmail = authenticatedEmail;

      onboardingData = {
        id: salonId,
        name: salonName || "LumièreOS Salon",
        ownerEmail: onboardingEmail,
        ownerName: ownerName || "",
        phone: phone || "",
        city: city || "",
        state: state || "",
        businessType: legacyBusinessType,
        businessSegment: businessSegment || "",
        estimatedProfessionals: estimatedProfessionals || "",
        ownerId: user.uid,
        createdBy: user.uid,
        createdAt: createdNow,
        updatedAt: now,
        // Campos pending*
        pendingPlan: planId,
        pendingOfferId: "", // será preenchido após carregar as ofertas
        pendingCheckoutUrl: "", // será preenchido após gerar
        pendingCheckoutEmail: onboardingEmail,
        pendingRequestedAt: now,
        pendingCheckoutPurpose: checkoutPurpose,
        pendingBillingActivation: true,
      };
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
      if (isFirebaseAdminCredentialError(err)) {
        throw err;
      }
      console.error("[Cakto Checkout Serverless] Erro ao carregar configurações dinâmicas:", err);
      return res.status(500).json({ error: "Erro ao carregar configurações de pagamento." });
    }

    if (!offerId) {
      return res.status(400).json({ error: "Oferta não configurada para o plano informado." });
    }

    if (onboardingData) {
      onboardingData.pendingOfferId = offerId;
    }

    const hasCaktoCredentials = !!(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET);
    const isProduction = process.env.NODE_ENV === "production";
    const sandboxRequested = process.env.CAKTO_SANDBOX_MODE === "true" || !!process.env.FIRESTORE_EMULATOR_HOST;
    const isSimulationAllowed = !isProduction && sandboxRequested;

    if (!hasCaktoCredentials && !isSimulationAllowed) {
      return res.status(503).json({
        error: "Credenciais de faturamento não configuradas.",
        code: "CAKTO_NOT_CONFIGURED"
      });
    }

    const useSimulation = isSimulationAllowed;

    // 1. Em desenvolvimento sem credenciais ou em sandbox mode explícito, permitir simulação
    if (useSimulation) {
      console.warn("[Cakto Checkout Serverless] Aviso: Usando simulação.");
      const simulatedOrderId = "ord_" + Math.random().toString(36).substring(2, 11).toUpperCase();
      const simulatedCheckoutUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard/assinatura?simulated_checkout=true&order_id=${simulatedOrderId}`;

      if (salonDoc.exists) {
        const simulatedData = {
          pendingPlan: planId,
          pendingOfferId: offerId,
          pendingCheckoutUrl: simulatedCheckoutUrl,
          pendingCheckoutEmail: checkoutEmail,
          pendingRequestedAt: now,
          pendingCheckoutPurpose: checkoutPurpose,
          pendingBillingActivation: true,
          updatedAt: now,
          homologationCustomerId: "cus_simulated_dev",
          homologationOrderId: simulatedOrderId,
          homologationSubscriptionId: "sub_simulated_dev",
          homologationCheckoutUrl: simulatedCheckoutUrl,
          homologationOfferId: offerId || "off_simulated"
        };
        await salonRef.set(simulatedData, { merge: true });
      } else {
        onboardingData.pendingCheckoutUrl = simulatedCheckoutUrl;
        onboardingData.homologationCustomerId = "cus_simulated_dev";
        onboardingData.homologationOrderId = simulatedOrderId;
        onboardingData.homologationSubscriptionId = "sub_simulated_dev";
        onboardingData.homologationCheckoutUrl = simulatedCheckoutUrl;
        onboardingData.homologationOfferId = offerId || "off_simulated";
        await onboardingRef.set(onboardingData);
      }

      return res.status(200).json({
        success: true,
        checkoutUrl: simulatedCheckoutUrl,
        orderId: simulatedOrderId,
        subscriptionId: "sub_simulated_dev",
        simulated: true
      });
    }

    // URL de checkout estática
    const params = new URLSearchParams({
      name: ownerName || salonData?.ownerName || (salonDoc.exists ? salonData?.name : (salonName || "Cliente")),
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

    if (salonDoc.exists) {
      const finalData = {
        pendingPlan: planId,
        pendingOfferId: offerId,
        pendingCheckoutUrl: checkoutUrl,
        pendingCheckoutEmail: checkoutEmail,
        pendingRequestedAt: now,
        pendingCheckoutPurpose: checkoutPurpose,
        pendingBillingActivation: true,
        updatedAt: now,
      };
      await salonRef.set(finalData, { merge: true });
    } else {
      onboardingData.pendingCheckoutUrl = checkoutUrl;
      await onboardingRef.set(onboardingData);
    }

    console.log(`[Cakto Checkout Serverless] URL de checkout montada e salão registrado para ID: ${salonId}`);

    try {
      await sendCheckoutEmail({
        to: checkoutEmail,
        ownerName: ownerName || salonData?.ownerName || "Cliente",
        checkoutUrl,
        plan: planId
      });
    } catch (e) {
      console.error("[Cakto Checkout Serverless] Erro ao enviar email com link de checkout:", e);
    }
    return res.status(200).json({
      success: true,
      checkoutUrl,
    });

  } catch (err: any) {
    if (isFirebaseAdminCredentialError(err)) {
      console.error("[LumièreOS SERVER ERROR] Firebase Admin credential error caught:", err);
      return res.status(503).json({
        error: "O serviço de faturamento está temporariamente indisponível. Nossa equipe técnica já pode verificar a configuração do servidor.",
        code: "FIREBASE_ADMIN_AUTH_FAILED"
      });
    }
    console.error("[Cakto Checkout Serverless] Falha ao processar requisição:", err);
    return res.status(500).json({ error: "Falha ao iniciar faturamento.", code: "CHECKOUT_START_FAILED" });
  }
}

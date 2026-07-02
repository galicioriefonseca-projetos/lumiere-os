import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin";
import { verifyIdToken, canManageBilling } from "../_shared/auth";

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
  console.log(`[Cakto API Serverless Secure Log] CAKTO_API_URL: ${apiUrl}`);
  console.log(`[Cakto API Serverless Secure Log] CAKTO_CLIENT_ID configurado: ${!!clientId}`);
  console.log(`[Cakto API Serverless Secure Log] CAKTO_CLIENT_SECRET configurado: ${!!clientSecret}`);

  if (!clientId || !clientSecret) {
    throw new Error("CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no servidor.");
  }

  if (cachedCaktoToken && cachedCaktoToken.expiresAt > Date.now()) {
    return cachedCaktoToken.token;
  }

  console.log("[Cakto API Serverless] Solicitando novo token de acesso OAuth2...");
  const endpointsToTry = [
    `${apiUrl}/oauth/token`,
    `${apiUrl}/v1/oauth/token`,
  ];

  let lastError: any = null;
  for (const url of endpointsToTry) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      console.log(`[Cakto API Serverless Secure Log] Status HTTP para obter token OAuth2 de ${url}: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        if (data && data.access_token) {
          const expiresIn = (data.expires_in || 3600) * 1000;
          cachedCaktoToken = {
            token: data.access_token,
            expiresAt: Date.now() + expiresIn - 60000
          };
          console.log("[Cakto API Serverless] Token de acesso obtido com sucesso!");
          return data.access_token;
        }
      } else {
        const text = await response.text();
        console.warn(`[Cakto API Serverless] Falha na tentativa OAuth2 para ${url}:`, text);
      }
    } catch (err) {
      console.warn(`[Cakto API Serverless] Erro na tentativa OAuth2 para ${url}:`, err);
      lastError = err;
    }
  }

  throw new Error(lastError?.message || "Falha ao autenticar com a API Cakto (OAuth2). Verifique as chaves de Client ID e Client Secret.");
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
    let productId = "";
    try {
      const sData = await getCaktoSettingsCached();
      productId = sData.productId || "";
      switch (planId) {
        case "start":
          offerId = sData.founderOfferId || "";
          break;
        case "studio":
          offerId = sData.studioOfferId || "";
          break;
        case "performance":
          offerId = sData.performanceOfferId || "";
          break;
        case "network":
          offerId = sData.networkOfferId || "";
          break;
        case "founder":
          offerId = sData.founderOfferId || "";
          break;
        default:
          offerId = sData.founderOfferId || "";
          break;
      }
    } catch (err) {
      console.error("[Cakto Checkout Serverless] Erro ao carregar configurações dinâmicas:", err);
    }

    const isProduction = process.env.NODE_ENV === "production";
    const hasCaktoCredentials = !!(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET);

    console.log("[Cakto Checkout Serverless Secure Log] Iniciando checkout:");
    console.log(`[Cakto Checkout Serverless Secure Log] CAKTO_CLIENT_ID existe: ${!!process.env.CAKTO_CLIENT_ID}`);
    console.log(`[Cakto Checkout Serverless Secure Log] CAKTO_CLIENT_SECRET existe: ${!!process.env.CAKTO_CLIENT_SECRET}`);
    console.log(`[Cakto Checkout Serverless Secure Log] offerId: ${offerId}`);

    // Em produção, as credenciais de servidor são estritamente obrigatórias
    if (isProduction && !hasCaktoCredentials) {
      console.error("[Cakto Checkout Serverless] Erro crítico: Credenciais da Cakto ausentes no ambiente de produção.");
      return res.status(500).json({
        error: "Erro crítico de segurança: A integração com a Cakto não está configurada corretamente para o ambiente de produção. Faltam as credenciais CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET no servidor de produção."
      });
    }

    // Permitir simulação somente se não estiver em produção e faltarem credenciais
    if (!isProduction && !hasCaktoCredentials) {
      console.warn("[Cakto Checkout Serverless] Aviso: Credenciais ausentes. Usando modo de simulação...");
      const simulatedOrderId = "ord_" + Math.random().toString(36).substring(2, 11).toUpperCase();
      const simulatedCheckoutUrl = `${process.env.APP_URL || "http://localhost:3000"}/dashboard/faturamento?simulated_checkout=true&order_id=${simulatedOrderId}`;

      const simulatedData = {
        billingProvider: "cakto",
        caktoCustomerId: "cus_simulated_dev",
        caktoOrderId: simulatedOrderId,
        caktoSubscriptionId: "sub_simulated_dev",
        caktoCheckoutUrl: simulatedCheckoutUrl,
        caktoOfferId: offerId || "off_simulated",
        subscriptionStatus: "pending",
        paymentStatus: "pending",
        nextBillingDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now(),
      };

      await salonRef.update(simulatedData);

      return res.status(200).json({
        success: true,
        checkoutUrl: simulatedCheckoutUrl,
        orderId: simulatedOrderId,
        subscriptionId: "sub_simulated_dev",
        simulated: true
      });
    }

    const accessToken = await getCaktoAccessToken();
    const apiUrl = process.env.CAKTO_API_URL || "https://api.cakto.com.br";

    const payload = {
      product_id: productId,
      offer_id: offerId,
      external_id: salonId,
      customer: {
        name: salonData?.ownerName || salonData?.name || "Cliente LumièreOS",
        email: email || salonData?.ownerEmail || user.email || "",
        phone: salonData?.phone || "",
      },
      redirect_url: `${process.env.APP_URL || "http://localhost:3000"}/dashboard/faturamento`,
      metadata: {
        salonId: salonId,
        planId: planId,
      }
    };

    console.log(`[Cakto Checkout Serverless] Enviando requisição para ${apiUrl}/v1/checkouts...`);
    const response = await fetch(`${apiUrl}/v1/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[Cakto Checkout Serverless Secure Log] Status HTTP: ${response.status}`);

    let checkoutData: any;
    const text = await response.text();
    try {
      checkoutData = JSON.parse(text);
    } catch (e) {
      throw new Error(`Resposta inválida da API Cakto: ${text}`);
    }

    if (!response.ok) {
      throw new Error(checkoutData?.message || `Erro da Cakto (${response.status}): ${text}`);
    }

    const checkoutUrl = checkoutData.checkout_url || checkoutData.payment_url || checkoutData.url || checkoutData.data?.checkout_url || checkoutData.data?.url;
    const orderId = checkoutData.order_id || checkoutData.id || checkoutData.data?.order_id || checkoutData.data?.id || `ord_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    const customerId = checkoutData.customer_id || checkoutData.customer?.id || checkoutData.data?.customer_id || "cus_cakto";
    const subscriptionId = checkoutData.subscription_id || checkoutData.subscription?.id || checkoutData.data?.subscription_id || `sub_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    if (!checkoutUrl) {
      throw new Error("A API do Cakto não retornou uma URL de checkout válida.");
    }

    await salonRef.update({
      billingProvider: "cakto",
      caktoCustomerId: customerId,
      caktoOrderId: orderId,
      caktoSubscriptionId: subscriptionId,
      caktoCheckoutUrl: checkoutUrl,
      caktoOfferId: offerId,
      subscriptionStatus: "pending",
      paymentStatus: "pending",
      nextBillingDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    });

    console.log(`[Cakto Checkout Serverless] Checkout criado para o salão ${salonId}: ${orderId}`);
    return res.status(200).json({
      success: true,
      checkoutUrl,
      orderId,
      subscriptionId,
    });

  } catch (err: any) {
    console.error("[Cakto Checkout Serverless] Falha ao processar requisição:", err);
    return res.status(500).json({ error: err.message || "Falha ao iniciar faturamento via Cakto." });
  }
}

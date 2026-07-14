import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { getFirebaseAdmin, getAdminDb, getAdminAuth, getAdminMessaging } from "./firebaseAdmin";


// Carregar variáveis de ambiente
dotenv.config();

console.log("[Lumière Server] Iniciando...");
console.log("[Lumière Server] NODE_ENV:", process.env.NODE_ENV);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware básico JSON
  app.use(express.json());

  // Habilitar CORS de forma nativa e segura
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  // Rota de Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "online", timestamp: Date.now(), service: "Lumiere Backend API" });
  });

  // ==========================================
  // INTEGRAÇÃO DE BACKEND SEGURO ASAAS BILLING
  // ==========================================

  // Helper de requisições seguras para a API do Asaas no backend (nunca expõe as chaves no cliente)
  async function asaasRequest(method: string, endpoint: string, body?: any) {
    const apiKey = process.env.ASAAS_API_KEY;
    const baseUrl = process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3";

    if (!apiKey) {
      throw new Error("Chave de API do Asaas (ASAAS_API_KEY) não configurada no servidor.");
    }

    const url = `${baseUrl}${endpoint}`;
    
    // --- INÍCIO LOG TEMPORÁRIO ---
    const maskedKey = apiKey.substring(0, 12) + "*".repeat(Math.max(0, apiKey.length - 12));
    console.log(`[Diagnostic Log] ASAAS_API_URL=${baseUrl}`);
    console.log(`[Diagnostic Log] ASAAS_API_KEY=${maskedKey}`);
    console.log(`[Diagnostic Log] URL final chamada: ${method} ${url}`);
    // --- FIM LOG TEMPORÁRIO ---
    
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();

    // --- INÍCIO LOG RESPOSTA TEMPORÁRIO ---
    console.log(`[Diagnostic Log] HTTP status retornado pelo Asaas: ${response.status}`);
    if (!response.ok) {
      console.log(`[Diagnostic Log] Corpo bruto (response.text()): ${text}`);
    }
    // --- FIM LOG RESPOSTA TEMPORÁRIO ---

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Resposta HTTP do Asaas inválida ou malformada: ${text}`);
    }

    if (!response.ok) {
      const errorMsg = data?.errors?.[0]?.description || data?.message || text;
      throw new Error(`Erro na API do Asaas (${response.status}): ${errorMsg}`);
    }

    return data;
  }

  // Middleware de autenticação segura para as rotas Asaas
  const authenticateRequest = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Autenticação requerida (Token ausente)." });
      }
      const token = authHeader.split("Bearer ")[1];
      const adminAuth = getAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (err: any) {
      console.error("[Asaas Auth] Erro de autenticação:", err);
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }
  };

  // Função auxiliar para verificar as permissões de gerenciamento de faturamento do salão
  async function canManageBilling(user: any, salonId: string, salonData: any): Promise<{ authorized: boolean; role?: string; reason?: string }> {
    const uid = user?.uid;
    const email = user?.email;

    if (!uid) {
      return { authorized: false, reason: "ID de usuário ausente." };
    }

    // 1. Proprietário direto do salão no Firestore (salonData.ownerId)
    if (salonData?.ownerId === uid) {
      return { authorized: true, role: "owner" };
    }

    // 2. Platform Admin via e-mail configurado ou na coleção platformAdmins
    const platformAdminEmail = process.env.VITE_PLATFORM_ADMIN_EMAIL || process.env.PLATFORM_ADMIN_EMAIL || "admin@lumiereos.com";
    if (email && (email === platformAdminEmail || email === "galicioriefonseca@gmail.com")) {
      return { authorized: true, role: "platform_admin" };
    }

    const adminDb = getAdminDb();
    
    try {
      const platformAdminSnap = await adminDb.collection("platformAdmins").doc(uid).get();
      if (platformAdminSnap.exists) {
        return { authorized: true, role: "platform_admin" };
      }
    } catch (err) {
      console.warn(`[Billing Auth] Erro ao consultar platformAdmins/${uid}:`, err);
    }

    // 3. Usuário registrado com role autorizada ("owner", "admin", "manager") associada ao salão correspondente
    try {
      const userSnap = await adminDb.collection("users").doc(uid).get();
      if (userSnap.exists) {
        const uData = userSnap.data();
        const userSalonId = uData?.salonId;
        const userRole = uData?.role;

        if (userSalonId === salonId) {
          const allowedRoles = ["owner", "admin", "manager"];
          if (allowedRoles.includes(userRole)) {
            return { authorized: true, role: userRole };
          } else {
            return { authorized: false, role: userRole, reason: `Seu perfil (${userRole}) não possui permissão de faturamento.` };
          }
        }
      }
    } catch (err) {
      console.error(`[Billing Auth] Erro ao consultar documento do usuário users/${uid}:`, err);
    }

    return { authorized: false, reason: "Você não tem permissão para gerenciar o faturamento deste salão." };
  }
  // Endpoint de Webhook de faturamento e sincronização do Asaas
  app.post("/api/asaas/webhook", async (req, res) => {
    try {
      const receivedToken = req.headers["asaas-access-token"];
      const expectedToken = process.env.ASAAS_WEBHOOK_SECRET;

      if (!expectedToken || receivedToken !== expectedToken) {
        console.warn("[Asaas Webhook] Assinatura/token de webhook inválido.");
        return res.status(401).json({ error: "Chave secreta de webhook inválida." });
      }

      const { event, payment, subscription } = req.body;
      console.log(`[Asaas Webhook] Evento recebido: ${event}`);

      let customerId = payment?.customer || subscription?.customer;
      let subscriptionId = payment?.subscription || subscription?.id;

      if (!customerId) {
        console.warn("[Asaas Webhook] Sem ID do cliente no payload recebido.");
        return res.status(200).json({ received: true, info: "Sem ID do cliente, ignorando." });
      }

      const adminDb = getAdminDb();
      // Localizar o salão no Firestore pelo asaasCustomerId
      let salonSnapshot = await adminDb.collection("salons")
        .where("asaasCustomerId", "==", customerId)
        .limit(1)
        .get();

      // Fallback: Localizar pelo asaasSubscriptionId se a busca anterior falhar
      if (salonSnapshot.empty && subscriptionId) {
        salonSnapshot = await adminDb.collection("salons")
          .where("asaasSubscriptionId", "==", subscriptionId)
          .limit(1)
          .get();
      }

      if (salonSnapshot.empty) {
        console.warn(`[Asaas Webhook] Salão não localizado para customerId ${customerId} ou subscriptionId ${subscriptionId}`);
        return res.status(200).json({ received: true, info: "Salão correspondente não localizado." });
      }

      const salonDoc = salonSnapshot.docs[0];
      const salonRef = salonDoc.ref;
      const salonData = salonDoc.data();

      // Proteção contra webhook duplicado (idempotência avançada de processamento de evento):
      // Se o último evento e ID de pagamento salvos forem idênticos, evitamos processar novamente.
      if (
        salonData?.asaasLastEvent === event && 
        payment?.id && 
        salonData?.asaasLastPaymentId === payment.id
      ) {
        console.log(`[Asaas Webhook] Evento duplicado já processado anteriormente para o pagamento ${payment.id}. Ignorando.`);
        return res.status(200).json({ success: true, info: "Evento duplicado já processado." });
      }

      const updatePayload: any = {
        updatedAt: Date.now(),
        asaasLastEvent: event,
      };

      if (payment?.id) {
        updatePayload.asaasLastPaymentId = payment.id;
      }

      switch (event) {
        case "PAYMENT_CREATED":
          updatePayload.paymentStatus = "pending";
          break;

        case "PAYMENT_CONFIRMED":
        case "PAYMENT_RECEIVED":
          updatePayload.paymentStatus = "paid";
          updatePayload.subscriptionStatus = "active";
          updatePayload.lastPaymentAt = Date.now();
          updatePayload.lastPaymentAmount = payment.value;
          updatePayload.lastPaymentMethod = payment.billingType;
          if (payment.dueDate) {
            updatePayload.nextBillingDate = new Date(payment.dueDate).getTime();
          }
          break;

        case "PAYMENT_OVERDUE":
          updatePayload.paymentStatus = "overdue";
          updatePayload.subscriptionStatus = "overdue";
          break;

        case "PAYMENT_DELETED":
          updatePayload.paymentStatus = "canceled";
          break;

        case "SUBSCRIPTION_CREATED":
          updatePayload.asaasSubscriptionId = subscription.id;
          updatePayload.subscriptionStatus = subscription.status === "ACTIVE" ? "active" : "trial";
          if (subscription.nextDueDate) {
            updatePayload.nextBillingDate = new Date(subscription.nextDueDate).getTime();
          }
          break;

        case "SUBSCRIPTION_UPDATED":
          if (subscription.status === "ACTIVE") {
            updatePayload.subscriptionStatus = "active";
          } else if (subscription.status === "OVERDUE") {
            updatePayload.subscriptionStatus = "overdue";
          } else if (subscription.status === "INACTIVE" || subscription.status === "CANCELED" || subscription.status === "EXPIRED") {
            updatePayload.subscriptionStatus = "canceled";
          }
          if (subscription.nextDueDate) {
            updatePayload.nextBillingDate = new Date(subscription.nextDueDate).getTime();
          }
          break;

        case "SUBSCRIPTION_DELETED":
          updatePayload.subscriptionStatus = "canceled";
          break;

        default:
          console.log(`[Asaas Webhook] Evento recebido não necessita de tratamento direto: ${event}`);
          break;
      }

      // Persistir mutações de faturamento diretamente no Firestore usando privilégios admin
      await salonRef.update(updatePayload);
      console.log(`[Asaas Webhook] Sincronização concluída com sucesso para o salão ${salonDoc.id} (Evento: ${event})`);

      return res.status(200).json({ success: true, eventProcessed: event });
    } catch (err: any) {
      console.error("[Asaas Webhook] Falha ao processar evento de webhook do Asaas:", err);
      return res.status(500).json({ error: err.message || "Erro interno no servidor de webhook." });
    }
  });

  // ==========================================
  // INTEGRAÇÃO DE BACKEND SEGURO CAKTO BILLING
  // ==========================================

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
  const CAKTO_SETTINGS_CACHE_TTL = 5 * 60 * 1000; // Cache por 5 minutos para otimizar leituras no Firestore

  async function getCaktoSettingsCached(): Promise<CaktoSettings> {
    if (cachedCaktoSettings && cachedCaktoSettings.expiresAt > Date.now()) {
      console.log("[Cakto Settings Cache] Utilizando configurações em cache do Firestore.");
      return cachedCaktoSettings.data;
    }

    console.log("[Cakto Settings Cache] Sem cache válido. Buscando configurações diretamente do Firestore...");
    try {
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
    } catch (err) {
      console.error("[Cakto Settings Cache] Erro ao buscar dados do Firestore, retornando fallback vazio:", err);
      return {
        productId: "",
        startOfferId: "",
        founderOfferId: "",
        performanceOfferId: "",
        networkOfferId: "",
        enterpriseOfferId: ""
      };
    }
  }

  function invalidateCaktoSettingsCache(newData?: CaktoSettings) {
    if (newData) {
      cachedCaktoSettings = {
        data: newData,
        expiresAt: Date.now() + CAKTO_SETTINGS_CACHE_TTL
      };
      console.log("[Cakto Settings Cache] Cache atualizado de forma síncrona com os novos dados gravados.");
    } else {
      cachedCaktoSettings = null;
      console.log("[Cakto Settings Cache] Cache invalidado com sucesso.");
    }
  }

  function getCaktoApiBaseUrl() {
    const raw = process.env.CAKTO_API_URL || "https://api.cakto.com.br";
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  }

  let cachedCaktoToken: { token: string; expiresAt: number } | null = null;

  async function getCaktoAccessToken(): Promise<string> {
    const clientId = process.env.CAKTO_CLIENT_ID;
    const clientSecret = process.env.CAKTO_CLIENT_SECRET;
    const apiUrl = getCaktoApiBaseUrl();

    // Secure Log - Never log actual values of clientId/clientSecret, only whether they exist
    console.log("[Cakto API Secure Log] getCaktoAccessToken chamado.");
    console.log(`[Cakto API Secure Log] CAKTO_API_URL: ${apiUrl}`);
    console.log(`[Cakto API Secure Log] CAKTO_CLIENT_ID configurado: ${!!clientId}`);
    console.log(`[Cakto API Secure Log] CAKTO_CLIENT_SECRET configurado: ${!!clientSecret}`);

    if (!clientId || !clientSecret) {
      throw new Error("CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no servidor.");
    }

    if (cachedCaktoToken && cachedCaktoToken.expiresAt > Date.now()) {
      return cachedCaktoToken.token;
    }

    console.log("[Cakto API] Solicitando novo token de acesso OAuth2...");
    const url = `${apiUrl}/public_api/token/`;

    try {
      console.log(`[Cakto API Secure Log] Obtendo token de ${url} via application/x-www-form-urlencoded...`);
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

      const responseStatus = response.status;
      const text = await response.text();
      const safeText = text
        .replace(new RegExp(clientSecret, "g"), "[REDACTED_SECRET]")
        .replace(new RegExp(clientId, "g"), "[REDACTED_CLIENT_ID]");

      console.log(`[Cakto API Secure Log] URL: ${url} | Status: ${responseStatus} | Resposta: ${safeText}`);

      if (response.ok) {
        const data = JSON.parse(text);
        if (data && data.access_token) {
          const expiresIn = (data.expires_in || 3600) * 1000;
          cachedCaktoToken = {
            token: data.access_token,
            expiresAt: Date.now() + expiresIn - 60000
          };
          console.log("[Cakto API] Token de acesso obtido com sucesso!");
          return data.access_token;
        }
      }
      throw new Error(`Status: ${responseStatus} | Resposta: ${safeText}`);
    } catch (err: any) {
      console.warn(`[Cakto API] Erro ao obter token para ${url}:`, err);
      throw new Error(`Falha ao autenticar com a API Cakto (OAuth2). Detalhes: ${err.message}`);
    }
  }

  async function isPlatformAdminUser(user: any): Promise<boolean> {
    if (!user || !user.uid) return false;
    const email = user.email;
    const uid = user.uid;
    const platformAdminEmail = process.env.VITE_PLATFORM_ADMIN_EMAIL || process.env.PLATFORM_ADMIN_EMAIL || "admin@lumiereos.com";
    if (email && email === platformAdminEmail) {
      return true;
    }
    const adminDb = getAdminDb();
    try {
      const platformAdminSnap = await adminDb.collection("platformAdmins").doc(uid).get();
      if (platformAdminSnap.exists) {
        return true;
      }
      const userSnap = await adminDb.collection("users").doc(uid).get();
      if (userSnap.exists && userSnap.data()?.role === "platform_admin") {
        return true;
      }
    } catch (err) {
      console.warn(`[Cakto Admin Check] Erro ao consultar privilégios de plataforma para ${uid}:`, err);
    }
    return false;
  }

  // Endpoints para gerenciar configurações dinâmicas da Cakto no Firestore (Master Panel)
  app.get("/api/cakto/settings", authenticateRequest, async (req, res) => {
    try {
      const user = (req as any).user;
      const isPlatformAdmin = await isPlatformAdminUser(user);
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: "Acesso restrito a administradores da plataforma." });
      }

      const settings = await getCaktoSettingsCached();
      return res.json(settings);
    } catch (err: any) {
      console.error("[Cakto Settings API] Erro ao obter configurações:", err);
      return res.status(500).json({ error: err.message || "Erro interno do servidor." });
    }
  });

  app.post("/api/cakto/settings", authenticateRequest, async (req, res) => {
    try {
      const user = (req as any).user;
      const isPlatformAdmin = await isPlatformAdminUser(user);
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: "Acesso restrito a administradores da plataforma." });
      }

      const { productId, startOfferId, founderOfferId, performanceOfferId, networkOfferId, enterpriseOfferId } = req.body;

      const adminDb = getAdminDb();
      const docRef = adminDb.collection("settings").doc("cakto");

      const updatedSettings = {
        productId: productId || "",
        startOfferId: startOfferId || "",
        founderOfferId: founderOfferId || "",
        performanceOfferId: performanceOfferId || "",
        networkOfferId: networkOfferId || "",
        enterpriseOfferId: enterpriseOfferId || "",
        updatedAt: Date.now()
      };

      await docRef.set(updatedSettings, { merge: true });
      invalidateCaktoSettingsCache(updatedSettings);
      console.log("[Cakto Settings API] Configurações salvas com sucesso por", user.email);

      return res.json({ success: true, settings: updatedSettings });
    } catch (err: any) {
      console.error("[Cakto Settings API] Erro ao salvar configurações:", err);
      return res.status(500).json({ error: err.message || "Erro interno do servidor." });
    }
  });

  app.post("/api/cakto/sync-products", authenticateRequest, async (req, res) => {
    try {
      const user = (req as any).user;
      const isPlatformAdmin = await isPlatformAdminUser(user);
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: "Acesso restrito a administradores da plataforma." });
      }

      const accessToken = await getCaktoAccessToken();
      const apiUrl = getCaktoApiBaseUrl();

      const adminDb = getAdminDb();
      const docRef = adminDb.collection("settings").doc("cakto");
      const sData = await getCaktoSettingsCached();

      let productId = sData.productId || "";

      if (!productId) {
        console.log("[Cakto Sync Express] Buscando produto 'LumièreOS'...");
        const productsRes = await fetch(`${apiUrl}/public_api/products/`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const products = Array.isArray(productsData) ? productsData : productsData.results || [];
          const targetProduct = products.find((p: any) => {
            const name = String(p.name || p.title || "").toLowerCase();
            return name.includes("lumièreos") || name.includes("lumiereos");
          });

          if (targetProduct) {
            productId = targetProduct.id;
            console.log(`[Cakto Sync Express] Produto encontrado de forma automática: ${productId}`);
          }
        }
      }

      if (!productId) {
        return res.status(400).json({ error: "Product ID não configurado e nenhum produto 'LumièreOS' foi localizado na Cakto." });
      }

      console.log(`[Cakto Sync Express] Buscando checkouts para o produto ${productId}...`);
      const checkoutsRes = await fetch(`${apiUrl}/public_api/products/${productId}/checkouts/`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!checkoutsRes.ok) {
        return res.status(checkoutsRes.status).json({ error: `Falha ao listar checkouts. Status: ${checkoutsRes.status}` });
      }

      const checkoutsData = await checkoutsRes.json();
      const checkouts = Array.isArray(checkoutsData) ? checkoutsData : checkoutsData.results || [];

      let startOfferId = sData.startOfferId || "";
      let founderOfferId = sData.founderOfferId || "";
      let performanceOfferId = sData.performanceOfferId || "";
      let networkOfferId = sData.networkOfferId || "";
      let enterpriseOfferId = sData.enterpriseOfferId || "";

      for (const item of checkouts) {
        const checkoutId = item.id;
        if (!checkoutId) continue;

        try {
          const detailRes = await fetch(`${apiUrl}/public_api/products/${productId}/checkouts/${checkoutId}/`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          });

          if (detailRes.ok) {
            const checkout = await detailRes.json();

            // REQUIREMENT #1: faça um console.log(JSON.stringify(checkout, null, 2)) antes de extrair o Offer ID
            console.log(JSON.stringify(checkout, null, 2));

            let offerId = "";
            if (checkout.offer_id) offerId = String(checkout.offer_id);
            else if (checkout.offerId) offerId = String(checkout.offerId);
            else if (checkout.offers) {
              if (Array.isArray(checkout.offers) && checkout.offers.length > 0) {
                const first = checkout.offers[0];
                offerId = String(typeof first === "object" ? (first.id || first.offer_id || first.offerId || "") : first);
              } else if (typeof checkout.offers === "object") {
                offerId = String(checkout.offers.id || checkout.offers.offer_id || checkout.offers.offerId || "");
              } else {
                offerId = String(checkout.offers);
              }
            } else if (checkout.default_offer_id) {
              offerId = String(checkout.default_offer_id);
            }

            if (!offerId) continue;

            const name = String(checkout.name || checkout.title || "").toLowerCase();

            if (name.includes("start")) {
              startOfferId = offerId;
            } else if (name.includes("founder") || name.includes("pioneiro")) {
              founderOfferId = offerId;
            } else if (name.includes("performance")) {
              performanceOfferId = offerId;
            } else if (name.includes("network")) {
              networkOfferId = offerId;
            } else if (name.includes("enterprise")) {
              enterpriseOfferId = offerId;
            }
          }
        } catch (errDetail) {
          console.error(`[Cakto Sync Express] Erro no checkout ${checkoutId}:`, errDetail);
        }
      }

      const updatedSettings = {
        productId,
        startOfferId,
        founderOfferId,
        performanceOfferId,
        networkOfferId,
        enterpriseOfferId,
        updatedAt: Date.now()
      };

      await docRef.set(updatedSettings, { merge: true });
      invalidateCaktoSettingsCache(updatedSettings);

      return res.json({
        success: true,
        message: "Sincronização realizada com sucesso!",
        settings: updatedSettings
      });

    } catch (err: any) {
      console.error("[Cakto Sync Express Error] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro interno de sincronização." });
    }
  });

  app.post("/api/cakto/create-checkout", async (req, res) => {
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
        plan: salonData?.plan || "start", // Plano definitivo só é alterado por webhook
        subscriptionStatus: salonData?.subscriptionStatus || "pending",
        activationStatus: salonData?.activationStatus || "pending",
        isActive: salonData?.isActive || false,
        createdAt: salonData?.createdAt || now,
        updatedAt: now,
        billingProvider: "cakto",
      };

      const isProduction = process.env.NODE_ENV === "production";
      const hasCaktoCredentials = !!(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET);

      // Carregar configurações dinâmicas da Cakto no Firestore usando o Cache do Servidor
      let offerId = "";
      let productId = "";
      try {
        const sData = await getCaktoSettingsCached();
        productId = sData.productId || "";
        switch (planId) {
          case 'start':
            offerId = sData.startOfferId || "";
            break;
          case 'founder':
            offerId = sData.founderOfferId || "";
            break;
          case 'performance':
            offerId = sData.performanceOfferId || "";
            break;
          case 'network':
            offerId = sData.networkOfferId || "";
            break;
          case 'enterprise':
            offerId = sData.enterpriseOfferId || "";
            break;
          default:
            offerId = "";
            break;
        }

        if (!offerId && isProduction) {
          throw new Error(`A oferta para o plano '${planId}' não está configurada no painel.`);
        }
      } catch (err) {
        console.error("[Cakto API] Erro ao carregar configurações dinâmicas usando cache do Firestore:", err);
      }

      // Secure Logging (regras de Sprint de Segurança):
      console.log("[Cakto API Secure Log] Iniciando criação de checkout público:");
      console.log(`[Cakto API Secure Log] CAKTO_API_URL: ${getCaktoApiBaseUrl()}`);
      console.log(`[Cakto API Secure Log] CAKTO_CLIENT_ID existe: ${!!process.env.CAKTO_CLIENT_ID}`);
      console.log(`[Cakto API Secure Log] CAKTO_CLIENT_SECRET existe: ${!!process.env.CAKTO_CLIENT_SECRET}`);
      console.log(`[Cakto API Secure Log] offerId usado: ${offerId}`);


      // 1. Remover modo simulado em produção. Se faltar CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET em produção, retornar erro 503 claro.
      if (isProduction && !hasCaktoCredentials) {
        console.error("[Cakto API Secure Log] Erro Crítico: Credenciais da Cakto ausentes no ambiente de produção.");
        return res.status(503).json({
          error: "Faturamento temporariamente indisponível."
        });
      }

      // 2. Permitir simulação somente se NODE_ENV !== "production".
      if (!isProduction && !hasCaktoCredentials) {
        console.warn("[Cakto Server] Aviso: Credenciais do Cakto ausentes. Usando modo de simulação em ambiente de desenvolvimento/homologação.");
        const simulatedOrderId = "ord_homolog_" + Math.random().toString(36).substring(2, 11).toUpperCase();
        const simulatedCheckoutUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard/faturamento?simulated_checkout=true&order_id=${simulatedOrderId}`;

        const simulatedData = {
          ...mergedSalonData,
          homologationCustomerId: "cus_simulated_dev",
          homologationOrderId: simulatedOrderId,
          homologationSubscriptionId: "sub_simulated_dev",
          homologationCheckoutUrl: simulatedCheckoutUrl,
          homologationOfferId: offerId || "off_simulated",
          homologationUpdatedAt: Date.now(),
        };

        await salonRef.set(simulatedData, { merge: true });

        return res.json({
          success: true,
          checkoutUrl: simulatedCheckoutUrl,
          orderId: simulatedOrderId,
          subscriptionId: "sub_simulated_dev",
          simulated: true
        });
      }

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

      const finalData = {
        ...mergedSalonData,
        billingProvider: "cakto",
        caktoOfferId: offerId,
        caktoCheckoutUrl: checkoutUrl,
        caktoCheckoutEmail: checkoutEmail,
        subscriptionStatus: salonData?.subscriptionStatus || "pending",
        paymentStatus: salonData?.paymentStatus || "pending",
        updatedAt: Date.now(),
      };

      await salonRef.set(finalData, { merge: true });

      console.log(`[Cakto Checkout] URL de checkout montada e salão registrado para o salão ${salonId}`);
      return res.json({
        success: true,
        checkoutUrl,
      });

    } catch (err: any) {
      console.error("[Cakto Checkout] Erro ao criar checkout:", err);
      return res.status(500).json({ error: err.message || "Falha ao iniciar faturamento via Cakto." });
    }
  });

  // Helper reutilizável para processar webhook da Cakto (Evitando duplicação de lógica)
  async function processCaktoWebhookPayload(bodyData: any, skipTokenValidation: boolean = false) {
    // Extrair metadados, suportando serialização em string
    let metadataObj = bodyData.metadata;
    if (typeof metadataObj === "string") {
      try {
        metadataObj = JSON.parse(metadataObj);
      } catch (e) {
        metadataObj = {};
      }
    }

    // Extrair propriedades relevantes de forma tolerante a falhas
    const eventName = bodyData.event || bodyData.eventType || bodyData.status || bodyData.event_type || "purchase_approved";
    const orderId = bodyData.order_id || bodyData.orderId || bodyData.id;
    const subscriptionId = bodyData.subscription_id || bodyData.subscriptionId;
    const customerId = bodyData.customer_id || bodyData.customerId || bodyData.customer?.id;
    const salonId = bodyData.external_id || bodyData.externalId || metadataObj?.salonId;
    const customerEmail = String(bodyData.customer?.email || bodyData.customerEmail || metadataObj?.email || "").trim().toLowerCase();
    const offerId = String(bodyData.offer_id || bodyData.offerId || bodyData.checkout_offer_id || "").trim();

    const isTestEvent = !orderId && !subscriptionId && !salonId && !customerEmail;
    if (isTestEvent) {
      console.log("[Cakto Webhook Helper] Recebido evento genérico de teste/ping da Cakto.");
      return {
        success: true,
        info: "Webhook de teste/ping recebido com sucesso.",
        testEvent: true,
        salonFound: false
      };
    }

    const adminDb = getAdminDb();
    let salonRef = null;
    let salonDoc = null;

    // 4. Correlação do salão:
    // a. Tentar localizar pelo salonId direto (external_id / externalId / metadata.salonId)
    if (salonId) {
      salonRef = adminDb.collection("salons").doc(String(salonId));
      salonDoc = await salonRef.get();
    }

    // b. Se não encontrado, buscar por caktoSubscriptionId
    if ((!salonDoc || !salonDoc.exists) && subscriptionId) {
      const snapshot = await adminDb.collection("salons").where("caktoSubscriptionId", "==", String(subscriptionId)).limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    // c. Se ainda não encontrado, buscar por caktoOrderId
    if ((!salonDoc || !salonDoc.exists) && orderId) {
      const snapshot = await adminDb.collection("salons").where("caktoOrderId", "==", String(orderId)).limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    // d. Se ainda não encontrado, buscar por caktoOfferId + caktoCheckoutEmail
    if ((!salonDoc || !salonDoc.exists) && offerId && customerEmail) {
      const snapshot = await adminDb.collection("salons")
        .where("caktoOfferId", "==", offerId)
        .where("caktoCheckoutEmail", "==", customerEmail)
        .limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    // e. Se ainda não encontrado, buscar por e-mail normalizado do cliente (checkout ou owner email)
    if ((!salonDoc || !salonDoc.exists) && customerEmail) {
      const snapshot = await adminDb.collection("salons")
        .where("caktoCheckoutEmail", "==", customerEmail)
        .limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    if ((!salonDoc || !salonDoc.exists) && customerEmail) {
      const snapshot = await adminDb.collection("salons")
        .where("ownerEmail", "==", customerEmail)
        .limit(1).get();
      if (!snapshot.empty) {
        salonDoc = snapshot.docs[0];
        salonRef = salonDoc.ref;
      }
    }

    // 6. Adicionar logs seguros
    console.log(`[Cakto Webhook Helper Secure Log] Processando evento:
    - Evento: ${eventName}
    - Offer ID: ${offerId || "N/A"}
    - Order ID: ${orderId || "N/A"}
    - Subscription ID: ${subscriptionId || "N/A"}
    - Customer Email: ${customerEmail || "N/A"}
    - Salon ID: ${salonId || "N/A"}
    - Salão Encontrado no Firestore: ${!!(salonDoc && salonDoc.exists)} (${salonDoc?.id || "N/A"})`);

    if (!salonDoc || !salonDoc.exists || !salonRef) {
      console.warn(`[Cakto Webhook Helper] Salão correspondente não localizado para os parâmetros informados.`);
      return {
        success: true,
        info: "Salão correspondente não localizado. Evento tratado com sucesso como caso de teste/integração.",
        salonFound: false
      };
    }

    const salonData = salonDoc.data();
    const eventId = bodyData.event_id || bodyData.eventId || `${eventName}_${orderId || "test"}_${Date.now()}`;

    // Evitar processamento de eventos duplicados se não for um teste simulado
    if (!skipTokenValidation && salonData?.caktoLastEventId === eventId) {
      console.log(`[Cakto Webhook Helper] Evento duplicado já processado anteriormente: ${eventId}. Ignorando.`);
      return {
        success: true,
        info: "Evento duplicado já processado.",
        salonFound: true,
        salonId: salonDoc.id,
        plan: salonData?.plan || "start",
        status: salonData?.subscriptionStatus || "active",
        firestorePath: `salons/${salonDoc.id}`
      };
    }

    // Carregar configurações de ofertas para mapear o plano correto
    const sData = await getCaktoSettingsCached();
    let mappedPlan = null;
    if (offerId) {
      const offId = offerId.trim();
      if (sData.startOfferId && sData.startOfferId.trim() === offId) mappedPlan = "start";
      else if (sData.founderOfferId && sData.founderOfferId.trim() === offId) mappedPlan = "founder";
      else if (sData.performanceOfferId && sData.performanceOfferId.trim() === offId) mappedPlan = "performance";
      else if (sData.networkOfferId && sData.networkOfferId.trim() === offId) mappedPlan = "network";
      else if (sData.enterpriseOfferId && sData.enterpriseOfferId.trim() === offId) mappedPlan = "enterprise";
    }

    // Fallback baseado em nome do checkout
    if (!mappedPlan) {
      const checkoutName = String(bodyData.checkout_name || bodyData.name || "").toLowerCase();
      if (checkoutName.includes("start")) mappedPlan = "start";
      else if (checkoutName.includes("founder") || checkoutName.includes("pioneiro")) mappedPlan = "founder";
      else if (checkoutName.includes("performance")) mappedPlan = "performance";
      else if (checkoutName.includes("network")) mappedPlan = "network";
      else if (checkoutName.includes("enterprise")) mappedPlan = "enterprise";
    }

    const updatePayload: any = {
      billingProvider: skipTokenValidation ? "homologation" : "cakto",
      updatedAt: Date.now(),
    };
    
    if (skipTokenValidation) {
      updatePayload.homologationLastEventId = eventId;
      updatePayload.homologationLastEvent = eventName;
      if (orderId) updatePayload.homologationOrderId = String(orderId);
      if (subscriptionId) updatePayload.homologationSubscriptionId = String(subscriptionId);
      if (customerId) updatePayload.homologationCustomerId = String(customerId);
      if (offerId) updatePayload.homologationOfferId = offerId;
    } else {
      updatePayload.caktoLastEventId = eventId;
      updatePayload.caktoLastEvent = eventName;
      if (orderId) updatePayload.caktoOrderId = String(orderId);
      if (subscriptionId) updatePayload.caktoSubscriptionId = String(subscriptionId);
      if (customerId) updatePayload.caktoCustomerId = String(customerId);
      if (offerId) updatePayload.caktoOfferId = offerId;
    }

    const ev = String(eventName).toLowerCase();

    // Regras de Status conforme especificado
    if (ev === "purchase_approved" || ev === "subscription_renewed" || ev.includes("approved") || ev.includes("paid") || ev === "active") {
      // 1. Ao receber evento aprovado/renovado:
      updatePayload.subscriptionStatus = "active";
      updatePayload.caktoPaymentStatus = "paid";
      updatePayload.paymentStatus = "paid";
      updatePayload.plan = mappedPlan || salonData?.plan || "start";
      
      const periodEnd = bodyData.current_period_end || bodyData.next_billing_date || bodyData.nextBillingDate;
      let nextBillingDate = periodEnd ? new Date(periodEnd).getTime() : (Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (isNaN(nextBillingDate)) {
        nextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      }
      updatePayload.nextBillingDate = nextBillingDate;
      if (periodEnd) {
        updatePayload.currentPeriodEnd = periodEnd;
      }
      updatePayload.lastPaymentAt = Date.now();
      updatePayload.lastPaymentAmount = bodyData.amount || bodyData.value || bodyData.price || 0;

    } else if (ev === "subscription_canceled" || ev === "refund" || ev === "chargeback" || ev.includes("cancel") || ev.includes("refund") || ev.includes("chargeback")) {
      // 2. Ao receber cancelado/refund/chargeback:
      updatePayload.subscriptionStatus = "canceled";
      updatePayload.caktoPaymentStatus = "canceled";
      updatePayload.paymentStatus = "canceled";

    } else if (ev === "purchase_refused" || ev === "subscription_renewal_refused" || ev.includes("refused") || ev.includes("failed") || ev.includes("rejected") || ev.includes("overdue")) {
      // 3. Ao receber recusado/inadimplente:
      updatePayload.subscriptionStatus = "overdue";
      updatePayload.caktoPaymentStatus = "refused";
      updatePayload.paymentStatus = "overdue";

    } else if (ev === "subscription_created" || ev.includes("trial") || ev.includes("created")) {
      // Criação de assinatura
      if (salonData?.subscriptionStatus !== "active") {
        updatePayload.subscriptionStatus = "pending";
        updatePayload.caktoPaymentStatus = "pending";
        updatePayload.paymentStatus = "pending";
      }
    }

    await salonRef.update(updatePayload);
    console.log(`[Cakto Webhook Helper] Sincronização concluída com sucesso para o salão ${salonDoc.id} (Evento: ${eventName})`);

    return {
      success: true,
      salonUpdated: true,
      plan: updatePayload.plan || salonData?.plan || "start",
      status: updatePayload.subscriptionStatus || salonData?.subscriptionStatus || "active",
      firestorePath: `salons/${salonDoc.id}`
    };
  }

  app.post("/api/cakto/webhook", async (req, res) => {
    try {
      // 1. Obter e validar o token/assinatura do webhook de forma robusta
      let receivedToken =
        req.headers["x-cakto-token"] ||
        req.headers["cakto-token"] ||
        req.headers["authorization"] ||
        req.headers["x-cakto-signature"] ||
        req.headers["cakto-signature"] ||
        req.body?.secret ||
        req.body?.token ||
        req.body?.signature;

      if (typeof receivedToken === "string" && receivedToken.startsWith("Bearer ")) {
        receivedToken = receivedToken.substring(7);
      }

      const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;

      if (expectedSecret && receivedToken !== expectedSecret) {
        console.warn("[Cakto Webhook] Token ou assinatura de webhook inválida.");
        return res.status(401).json({ error: "Assinatura inválida de webhook." });
      }

      // 2. Normalizar a estrutura do corpo da requisição (lida com dados simples ou agrupados/data array)
      let bodyData = req.body || {};
      if (bodyData.data) {
        if (Array.isArray(bodyData.data)) {
          if (bodyData.data.length > 0) {
            bodyData = { ...bodyData, ...bodyData.data[0] };
          }
        } else if (typeof bodyData.data === "object") {
          bodyData = { ...bodyData, ...bodyData.data };
        }
      }

      const result = await processCaktoWebhookPayload(bodyData, false);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Cakto Webhook Error] Falha de processamento:", err);
      return res.status(500).json({ error: err.message || "Erro interno no processamento do webhook." });
    }
  });

  // ROTA DE HOMOLOGAÇÃO / TESTE DO WEBHOOK CAKTO (Apenas para Platform Admins)
  app.post("/api/cakto/webhook-test", authenticateRequest, async (req, res) => {
    try {
      const user = (req as any).user;
      const isPlatformAdmin = await isPlatformAdminUser(user);

      if (!isPlatformAdmin) {
        console.warn(`[Cakto Webhook Test] Usuário ${user.uid} tentou acessar endpoint de homologação sem ser platform_admin.`);
        return res.status(403).json({ error: "Acesso negado. Apenas Platform Admins podem realizar homologação do webhook." });
      }

      const { salonId, offerId, subscriptionId, orderId, event } = req.body;

      if (!salonId) {
        return res.status(400).json({ error: "O parâmetro salonId é obrigatório." });
      }

      const allowedEvents = [
        "purchase_approved",
        "subscription_created",
        "subscription_renewed",
        "subscription_canceled",
        "purchase_refused",
        "subscription_renewal_refused",
        "refund",
        "chargeback"
      ];

      if (!event || !allowedEvents.includes(event)) {
        return res.status(400).json({ error: `O evento informado é inválido ou não suportado. Eventos válidos: ${allowedEvents.join(", ")}` });
      }

      const adminDb = getAdminDb();
      const salonSnap = await adminDb.collection("salons").doc(String(salonId)).get();

      if (!salonSnap.exists) {
        return res.status(404).json({ error: `Salão com ID ${salonId} não encontrado no Firestore.` });
      }

      const salonData = salonSnap.data();
      const customerEmail = salonData?.ownerEmail || salonData?.caktoCheckoutEmail || "homologation_test@lumiereos.com";

      // Simular exatamente o payload enviado pela Cakto
      const simulatedPayload = {
        event: event,
        order_id: orderId || `ord_homolog_${Date.now()}`,
        subscription_id: subscriptionId || `sub_homolog_${Date.now()}`,
        offer_id: offerId || salonData?.caktoOfferId || "off_homolog_default",
        external_id: String(salonId),
        customer: {
          email: customerEmail,
          name: salonData?.ownerName || "Cliente Homologação"
        },
        amount: 149.90,
        event_id: `ev_${event}_test_${Date.now()}`
      };

      console.log(`[Cakto Webhook Test] Iniciando simulação de evento '${event}' para o salão ${salonId}...`);

      // Chamar a MESMA função utilizada pelo webhook oficial, pulando a validação de token
      const result = await processCaktoWebhookPayload(simulatedPayload, true);

      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[Cakto Webhook Test Error] Falha de processamento:", err);
      return res.status(500).json({ error: err.message || "Erro interno no processamento do teste de webhook." });
    }
  });

  app.get("/api/cakto/subscription-status", authenticateRequest, async (req, res) => {
    try {
      const { salonId } = req.query;
      if (!salonId) {
        return res.status(400).json({ error: "O parâmetro salonId é obrigatório." });
      }

      const user = (req as any).user;
      const adminDb = getAdminDb();
      const salonDoc = await adminDb.collection("salons").doc(String(salonId)).get();

      if (!salonDoc.exists) {
        return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
      }

      const salonData = salonDoc.data();

      const authResult = await canManageBilling(user, String(salonId), salonData);
      if (!authResult.authorized) {
        return res.status(403).json({ error: authResult.reason || "Não autorizado." });
      }

      return res.json({
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
        updatedAt: salonData?.updatedAt || null,
      });
    } catch (err: any) {
      console.error("[Cakto Status] Erro ao obter status da assinatura:", err);
      return res.status(500).json({ error: err.message || "Erro interno ao obter status." });
    }
  });

  // GET /api/cakto/real-subscription - Consulta a assinatura real na API Cakto
  app.get("/api/cakto/real-subscription", authenticateRequest, async (req, res) => {
    try {
      const { salonId } = req.query;
      if (!salonId) {
        return res.status(400).json({ error: "O parâmetro salonId é obrigatório." });
      }

      const user = (req as any).user;
      const adminDb = getAdminDb();
      const salonDoc = await adminDb.collection("salons").doc(String(salonId)).get();

      if (!salonDoc.exists) {
        return res.status(404).json({ error: "Salão não encontrado." });
      }

      const salonData = salonDoc.data();

      // Autorização
      const authResult = await canManageBilling(user, String(salonId), salonData);
      if (!authResult.authorized) {
        return res.status(403).json({ error: authResult.reason || "Não autorizado." });
      }

      const subscriptionId = salonData?.caktoSubscriptionId;
      if (!subscriptionId) {
        return res.status(400).json({ error: "Nenhuma assinatura Cakto configurada para este salão." });
      }

      // Proteger contra IDs simulados / homologados
      const isHomolog = subscriptionId.toLowerCase().includes("homolog") || 
                        subscriptionId.toLowerCase().includes("simulated") || 
                        subscriptionId === "sub_simulated_dev";
      if (isHomolog) {
        // Se for Platform Admin (por exemplo, galicioriefonseca@gmail.com ou role de admin), retornamos dados simulados com sucesso para permitir testes e desenvolvimento.
        // Clientes reais nunca visualizam dados simulados.
        const isUserPlatformAdmin = user.email === "galicioriefonseca@gmail.com" || authResult.role === "platform_admin";
        if (isUserPlatformAdmin) {
          return res.json({
            status: "active",
            amount: 297.00,
            paymentMethod: salonData?.paymentMethod || "credit_card",
            next_payment_date: "2026-08-05T12:00:00.000Z",
            offer: "offer_founder_297",
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
      const caktoUrl = `${apiUrl}/public_api/subscriptions/${subscriptionId}/`;

      console.log(`[Cakto Real Sub] Chamando API Cakto: GET ${caktoUrl}`);
      const response = await fetch(caktoUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Cakto Real Sub] Erro na API Cakto (${response.status}):`, errText);
        return res.status(response.status).json({ 
          error: `Erro ao obter detalhes da assinatura na API Cakto: ${errText}` 
        });
      }

      const caktoSub = await response.json();
      console.log(`[Cakto Real Sub] Resposta da API Cakto para ${subscriptionId}:`, JSON.stringify(caktoSub, null, 2));

      const status = caktoSub.status || caktoSub.subscriptionStatus || "unknown";
      const amount = caktoSub.amount || caktoSub.value || 0;
      const paymentMethod = caktoSub.paymentMethod || caktoSub.payment_method || caktoSub.billingType || "credit_card";
      const next_payment_date = caktoSub.next_payment_date || caktoSub.next_billing_date || caktoSub.nextBillingDate || null;
      const offer = caktoSub.offer || caktoSub.offer_id || caktoSub.offerId || null;
      const recurrence_period = caktoSub.recurrence_period || caktoSub.recurrencePeriod || "monthly";

      return res.json({
        status,
        amount,
        paymentMethod,
        next_payment_date,
        offer,
        recurrence_period
      });
    } catch (err: any) {
      console.error("[Cakto Real Sub] Erro ao obter assinatura real:", err);
      return res.status(500).json({ error: err.message || "Erro interno ao consultar assinatura real na Cakto." });
    }
  });

  // POST /api/cakto/update-payment-method - Atualiza o método de pagamento futuro
  app.post("/api/cakto/update-payment-method", authenticateRequest, async (req, res) => {
    try {
      const { salonId, paymentMethod } = req.body;
      if (!salonId || !paymentMethod) {
        return res.status(400).json({ error: "Os campos salonId e paymentMethod são obrigatórios." });
      }

      const allowedMethods = ["credit_card", "pix_automatic", "pix", "boleto"];
      if (!allowedMethods.includes(paymentMethod)) {
        return res.status(400).json({ error: "Método de pagamento não permitido." });
      }

      const user = (req as any).user;
      const adminDb = getAdminDb();
      const salonRef = adminDb.collection("salons").doc(String(salonId));
      const salonDoc = await salonRef.get();

      if (!salonDoc.exists) {
        return res.status(404).json({ error: "Salão não encontrado." });
      }

      const salonData = salonDoc.data();

      // Autorização
      const authResult = await canManageBilling(user, String(salonId), salonData);
      if (!authResult.authorized) {
        return res.status(403).json({ error: authResult.reason || "Não autorizado." });
      }

      const subscriptionId = salonData?.caktoSubscriptionId;
      if (!subscriptionId) {
        return res.status(400).json({ error: "Nenhuma assinatura Cakto configurada para este salão." });
      }

      // Proteger contra IDs simulados / homologados
      const isHomolog = subscriptionId.toLowerCase().includes("homolog") || 
                        subscriptionId.toLowerCase().includes("simulated") || 
                        subscriptionId === "sub_simulated_dev";
      
      const isUserPlatformAdmin = user.email === "galicioriefonseca@gmail.com" || authResult.role === "platform_admin";

      if (isHomolog && !isUserPlatformAdmin) {
        return res.status(400).json({ error: "Operação não permitida: Assinatura de homologação/simulada detectada." });
      }

      let realStatus = "active";
      let realNextBillingDate = "2026-08-05T12:00:00.000Z";
      let apiUpdated = false;
      let authorizationUrl = "";

      if (!isHomolog) {
        // Consulta de assinatura real na API Cakto para validações de proteção
        const accessToken = await getCaktoAccessToken();
        const apiUrl = getCaktoApiBaseUrl();
        const caktoUrl = `${apiUrl}/public_api/subscriptions/${subscriptionId}/`;

        const response = await fetch(caktoUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ 
            error: `Erro ao validar assinatura real na Cakto: ${errText}` 
          });
        }

        const realSub = await response.json();
        realStatus = realSub.status || realSub.subscriptionStatus || "unknown";
        realNextBillingDate = realSub.next_payment_date || realSub.next_billing_date || realSub.nextBillingDate || null;

        // Proteções obrigatórias
        if (realStatus === 'canceled' || realStatus === 'cancelled') {
          return res.status(400).json({ error: "Bloqueado: A assinatura está cancelada na Cakto." });
        }
        if (realStatus === 'overdue' || realStatus === 'unpaid') {
          return res.status(400).json({ error: "Bloqueado: A assinatura possui cobranças vencidas ou pendentes." });
        }
        if (!realNextBillingDate) {
          return res.status(400).json({ error: "Bloqueado: Não há data de vencimento (next_payment_date) futura configurada." });
        }

        // Tratar método de pagamento Cartão de Crédito
        if (paymentMethod === "credit_card") {
          return res.json({
            success: false,
            requiresSupport: true,
            message: "Para sua total segurança (PCI-DSS), a alteração do cartão de crédito de assinaturas ativas deve ser feita por link de atualização criptografado. Registramos sua solicitação e nossa equipe financeira enviará as instruções para " + (user.email || "seu e-mail de cadastro") + " para concluir de forma assistida pela Cakto."
          });
        }

        // Atualizar método na API Cakto se for Pix/Boleto ou Pix Automático
        const caktoMethodMap: Record<string, string> = {
          pix_automatic: "pix_automatic",
          pix: "pix",
          boleto: "boleto"
        };
        const targetCaktoMethod = caktoMethodMap[paymentMethod] || paymentMethod;

        try {
          console.log(`[Cakto API] PATCH atualizando método para ${targetCaktoMethod}`);
          const updateRes = await fetch(caktoUrl, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              payment_method: targetCaktoMethod
            })
          });

          if (updateRes.ok) {
            apiUpdated = true;
            const updateData = await updateRes.json();
            authorizationUrl = updateData.authorization_url || updateData.authorizationUrl || "";
          }
        } catch (apiErr) {
          console.warn("[Cakto API] Falha na chamada da API Cakto para atualizar método:", apiErr);
        }
      } else {
        // Se for homologação e Platform Admin, tratamos as validações de simulação locais
        if (paymentMethod === "credit_card") {
          return res.json({
            success: false,
            requiresSupport: true,
            message: "[Simulação] Para sua total segurança (PCI-DSS), a alteração do cartão de crédito de assinaturas ativas deve ser feita por link de atualização criptografado. Registramos sua solicitação e nossa equipe financeira enviará as instruções para " + (user.email || "seu e-mail de cadastro") + " para concluir de forma assistida pela Cakto."
          });
        }
        apiUpdated = true;
      }

      // Gerar simulação de URL de autorização caso seja Pix Automático e a API não retorne link direto
      if (paymentMethod === "pix_automatic" && !authorizationUrl) {
        authorizationUrl = `https://pay.cakto.com.br/pix-automatic-auth?sub=${subscriptionId}&callback=${encodeURIComponent("https://lumiereos.com/dashboard/subscription")}`;
      }

      // Atualizar Firestore preservando todos os dados da assinatura (sem novas assinaturas, pedidos ou cobranças)
      const updates: any = {
        paymentMethod: paymentMethod,
        updatedAt: Date.now()
      };

      // Mapear provedores do sistema dependendo do tipo de cobrança
      if (paymentMethod === "pix_automatic") {
        updates.billingProvider = "cakto";
        updates.billingMode = "recurring_card"; // recorrente
      } else if (paymentMethod === "pix") {
        updates.billingProvider = "manual_pix";
        updates.billingMode = "manual_pix";
      } else if (paymentMethod === "boleto") {
        updates.billingProvider = "manual_pix"; // Usa motor de faturamento manual
        updates.billingMode = "manual_pix";
      }

      await salonRef.update(updates);

      // Registrar histórico
      const historyRef = salonRef.collection("billingHistory").doc();
      await historyRef.set({
        id: historyRef.id,
        eventType: "payment_method_updated",
        title: "Forma de Pagamento Autorizada",
        description: `Autorizada com sucesso a forma de pagamento futura para: ${
          paymentMethod === "pix_automatic" ? "Pix Automático" : paymentMethod === "pix" ? "Pix manual" : "Boleto manual"
        }. A próxima cobrança de R$ 297,00 ocorrerá somente no dia ${new Date(realNextBillingDate).toLocaleDateString("pt-BR")}.`,
        paymentMethod: paymentMethod,
        timestamp: Date.now(),
        recordedBy: user.email || "Cliente"
      });

      return res.json({
        success: true,
        message: `Método de pagamento futuro atualizado com sucesso para ${
          paymentMethod === "pix_automatic" ? "Pix Automático" : paymentMethod === "pix" ? "Pix manual" : "Boleto manual"
        }.`,
        authorizationUrl: authorizationUrl || null
      });

    } catch (err: any) {
      console.error("[Cakto Payment Method] Erro ao atualizar forma de pagamento:", err);
      return res.status(500).json({ error: err.message || "Erro interno ao atualizar método de pagamento." });
    }
  });

  // Proxy de autenticação robusto para contornar bloqueios de rede do cliente (Ex: Safari standalone, carrier / DNS firewall)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      }

      const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Chave de acesso do Firebase não configurada no servidor." });
      }

      // 1. Chamar REST API da Google Identity Toolkit para autenticar as credenciais do usuário
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.warn("[PlatformAuthProxy] Erro ao autenticar via REST API:", data);
        const errMessage = data?.error?.message || "Erro desconhecido na autenticação.";
        
        // Mapeamento idêntico aos códigos de erro convencionais do Firebase Auth para continuidade de UX
        let code = "auth/unknown";
        if (errMessage === "INVALID_PASSWORD" || errMessage === "INVALID_CREDENTIAL" || errMessage === "EMAIL_NOT_FOUND") {
          code = "auth/invalid-credential";
        } else if (errMessage === "USER_DISABLED") {
          code = "auth/user-disabled";
        } else if (errMessage === "TOO_MANY_ATTEMPTS_TRY_LATER") {
          code = "auth/too-many-requests";
        }

        return res.status(response.status).json({
          error: errMessage,
          code,
        });
      }

      // 2. Gerar Custom Token nativo usando o Admin SDK para autenticação segura do cliente local
      const uid = data.localId;
      const adminAuth = getAdminAuth();
      const customToken = await adminAuth.createCustomToken(uid);

      console.log(`[PlatformAuthProxy] Login proxy bem-sucedido para o UID: ${uid}`);
      return res.json({
        customToken,
        uid,
      });
    } catch (err: any) {
      console.error("[PlatformAuthProxy] Erro crítico no proxy de autenticação:", err);
      return res.status(500).json({
        error: err?.message || "Falha crítica no servidor durante o proxy de autenticação.",
      });
    }
  });

  // Rota de envio de Notificações Push via Firebase Cloud Messaging para Profissionais
  app.post("/api/send-appointment-push", async (req, res) => {
    try {
      const { salonId, appointmentId, professionalId, clientName, serviceName, date, time, action } = req.body;
      
      if (!salonId || !professionalId) {
        return res.status(400).json({ error: "salonId e professionalId são obrigatórios." });
      }

      console.log(`[Push Notification Backend] Enviando alerta para o profissional ${professionalId} no salão ${salonId}...`);

      const adminDb = getAdminDb();
      let uniqueTokens: string[] = [];

      // 1. Procurar tokens FCM no cadastro do profissional do salão
      try {
        const proDocRef = adminDb.collection("salons").doc(salonId).collection("professionals").doc(professionalId);
        const proDoc = await proDocRef.get();
        if (proDoc.exists) {
          const data = proDoc.data();
          if (data?.fcmToken) uniqueTokens.push(data.fcmToken);
          if (Array.isArray(data?.fcmTokens)) {
            uniqueTokens = [...uniqueTokens, ...data.fcmTokens];
          }
        }
      } catch (err) {
        console.warn("[Push Notification Backend] Falha ao ler documento do profissional do salão:", err);
      }

      // 2. Procurar tokens FCM no cadastro global '/users'
      try {
        const userDocRef = adminDb.collection("users").doc(professionalId);
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
          const data = userDoc.data();
          if (data?.fcmToken) uniqueTokens.push(data.fcmToken);
          if (Array.isArray(data?.fcmTokens)) {
            uniqueTokens = [...uniqueTokens, ...data.fcmTokens];
          }
        }
      } catch (err) {
        console.warn("[Push Notification Backend] Falha ao ler documento global do usuário:", err);
      }

      // Filtrar e desduplicar tokens nulos ou vazios
      const activeTokens = Array.from(new Set(uniqueTokens.filter(t => typeof t === "string" && t.trim().length > 0)));

      if (activeTokens.length === 0) {
        console.log(`[Push Notification Backend] Nenhum token registrado para o profissional ${professionalId}.`);
        return res.json({ success: false, reason: "no_registered_tokens_found" });
      }

      console.log(`[Push Notification Backend] Disparando para ${activeTokens.length} tokens ativos...`);

      const title = action === "cancel" 
        ? "Agendamento Cancelado 🛑" 
        : "Novo Agendamento Confirmado! 📅";
      const body = action === "cancel"
        ? `${clientName || "Cliente"} cancelou o serviço de ${serviceName || "Atendimento"} do dia ${date || ""} às ${time || ""}.`
        : `${clientName || "Cliente"} agendou ${serviceName || "Atendimento"} para o dia ${date || ""} às ${time || ""}.`;

      const payload = {
        title,
        body,
      };

      const messaging = getAdminMessaging();

      // Envia notificação por token de forma concorrente e resiliente
      const sendPromises = activeTokens.map((token) => 
        messaging.send({
          token,
          notification: payload,
          data: {
            appointmentId: appointmentId || "",
            click_action: "/dashboard?tab=agenda",
          },
          webpush: {
            notification: {
              badge: "/icons/icon-192x192.png",
              icon: "/icons/icon-192x192.png",
            }
          }
        }).catch((err: any) => {
          console.warn(`[Push Notification Backend] Falha ao disparar para o token ${token.substring(0, 8)}...:`, err);
          return null;
        })
      );

      await Promise.all(sendPromises);

      return res.json({ success: true, tokensNotifiedCount: activeTokens.length });
    } catch (error: any) {
      console.error("[Push Notification Backend] Erro crítico ao processar push notification:", error);
      return res.status(500).json({ error: error?.message || "Erro crítico no servidor de push" });
    }
  });


  // Helper to isolate Developer API Key authentication by unsetting GCP ADC environment variables temporarily
  async function withDeveloperAuth<T>(apiKey: string, fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
    const prevCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const prevGcloudProject = process.env.GOOGLE_GCLOUD_PROJECT;
    const prevCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    const prevGcloudProj = process.env.GCLOUD_PROJECT;
    const prevGcpProject = process.env.GCP_PROJECT;
    const prevMetadataHost = process.env.GCP_METADATA_HOST;
    const prevDetectMetadata = process.env.DETECT_GCP_METADATA;

    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_GCLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    
    // Setting these values ensures google-auth-library falls back and doesn't attempt to contact GCP Metadata Server or authenticate via default credentials
    process.env.GCP_METADATA_HOST = "localhost";
    process.env.DETECT_GCP_METADATA = "false";

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
            'Authorization': '', // Prevent/clear automatic attachment of GCP bearer tokens by the runtime
          },
        },
      });
      return await fn(ai);
    } finally {
      if (prevCredentials) process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCredentials;
      if (prevGcloudProject) process.env.GOOGLE_GCLOUD_PROJECT = prevGcloudProject;
      if (prevCloudProject) process.env.GOOGLE_CLOUD_PROJECT = prevCloudProject;
      if (prevGcloudProj) process.env.GCLOUD_PROJECT = prevGcloudProj;
      if (prevGcpProject) process.env.GCP_PROJECT = prevGcpProject;
      
      if (prevMetadataHost) {
        process.env.GCP_METADATA_HOST = prevMetadataHost;
      } else {
        delete process.env.GCP_METADATA_HOST;
      }

      if (prevDetectMetadata) {
        process.env.DETECT_GCP_METADATA = prevDetectMetadata;
      } else {
        delete process.env.DETECT_GCP_METADATA;
      }
    }
  }

  // API Route para o Gemini Insights (Mantendo funcionalidades existentes do LumièreOS)
  app.post("/api/gemini-insight", async (req, res) => {
    try {
      const {
        salonName,
        businessTypeTranslated,
        monthlyCount,
        checklistPct,
        goalPercentage,
        goalCurrent,
        goalTarget,
        professionalsCount,
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
        return res.json({ 
          text: "Inteligência Artificial Pausada: Por favor, adicione sua própria 'GEMINI_API_KEY' nas configurações (Settings) e reinicie o servidor para habilitar os insights gerados por IA."
        });
      }

      const text = await withDeveloperAuth(apiKey, async (ai) => {
        const prompt = `Você é um consultor especialista sênior em gestão de negócios para salões e clínicas de beleza parceiros do LumièreOS. 
Analise os seguintes indicadores de desempenho do estabelecimento "${salonName || 'Nosso Salão'}" (${businessTypeTranslated || 'Salão de Beleza'}) e gere um insight executivo personalizado de alto nível com um olhar cirúrgico:

Agendamentos este mês: ${monthlyCount || 0}
Uso/Aderência do Checklist Operacional Diário: ${checklistPct || 0}% de conformidade hoje.
Meta de faturamento do mês: ${goalPercentage || 0}% atingida (Atual: R$ ${(goalCurrent || 0).toLocaleString('pt-BR')} de uma meta planejada de R$ ${(goalTarget || 0).toLocaleString('pt-BR')}).
Membros ativos na equipe: ${professionalsCount || 0} profissionais cadastrados.

Gere um diagnóstico analítico em exatamente 2 ou 3 frases. Seja direto, motivador e encorajador, porém prático e profissional.
Foque em destacar um ponto positivo e propor uma sugestão estratégica cirúrgica de melhoria imediata usando linguagens do mercado ou práticas premium de atendimento.
Use sempre o tom em português (do Brasil). Não use saudações introdutórias como "Olá" ou "Com base nos dados", vá direto para a análise executiva.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        if (response && response.text) {
          return response.text.trim();
        } else {
          throw new Error('Retorno vazio da inteligência artificial.');
        }
      });

      return res.json({ text });
    } catch (err: any) {
      console.error('Erro ao gerar insights do Gemini no servidor:', err);
      return res.status(500).json({
        error: err?.message || 'Falha de comunicação com o servidor Lumière AI. Tente novamente em instantes.'
      });
    }
  });

  // API Route para o Gemini Insights de Equipe
  app.post("/api/gemini-team-insight", async (req, res) => {
    try {
      const {
        salonName,
        businessTypeTranslated,
        professionalsCount,
        rolesSummary,
        recentEvaluations
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
         return res.json({ 
          text: "Inteligência Artificial Pausada: O serviço de mentoria inteligente de equipe requer a configuração de uma 'GEMINI_API_KEY' válida nas configurações (Settings)."
        });
      }

      const text = await withDeveloperAuth(apiKey, async (ai) => {
        const prompt = `Você é um mentor especialista em liderança e gestão de equipes de alta performance para salões de beleza e clínicas de estética parceiros do LumièreOS. 
Analise a composição atual da equipe do estabelecimento "${salonName || 'Nosso Salão'}" (${businessTypeTranslated || 'Salão de Beleza'}) e gere um insight executivo personalizado focado EXCLUSIVAMENTE em melhorar o desempenho da equipe:

Tamanho da equipe: ${professionalsCount || 0} membros ativos.
Resumo das funções: ${rolesSummary || 'Não informado'}
Desempenho recente nas avaliações diárias (Checklist Operacional): ${recentEvaluations || 'Não informado'}

Gere uma sugestão de desenvolvimento e estratégia de gestão de equipe in exatamente 2 ou 3 frases. Seja direto, motivador e encorajador, porém extremamente prático.
Foque em propor uma ação prática para aumentar a produtividade, a harmonia ou o engajamento da equipe, utilizando linguagem do mercado premium. 
Use tom em português (do Brasil). Vá direto para a análise executiva.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        if (response && response.text) {
          return response.text.trim();
        } else {
          throw new Error('Retorno vazio da IA.');
        }
      });

      return res.json({ text });
    } catch (err: any) {
      console.error('Erro ao gerar insights de equipe do Gemini:', err);
      return res.status(500).json({
        error: err?.message || 'Falha de comunicação com o servidor Lumière AI.'
      });
    }
  });

  // API Route para o Parser de Catálogos de Serviço e Produtos em PDF com IA
  app.post("/api/parse-catalog-pdf", async (req, res) => {
    try {
      const { pdfBase64, salonName } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: "O arquivo PDF (Base64) é obrigatório." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
        return res.status(400).json({ 
          error: "Inteligência Artificial Não Configurada: Para importar catálogos em formato PDF, configure sua 'GEMINI_API_KEY' na aba Secrets (Configurações)."
        });
      }

      const result = await withDeveloperAuth(apiKey, async (ai) => {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            {
              inlineData: {
                data: pdfBase64.split(',').pop(), // remove data URI headers
                mimeType: "application/pdf"
              }
            },
            {
              text: `Analise o arquivo PDF de catálogo ou tabela de preços do estabelecimento "${salonName || 'Cliente'}". 
Identifique e extraia TODOS os serviços (cortes, colorações, tratamentos) e produtos (shampoo, escova, máscara, cremes home care) contidos nele.

Regras de Extração e Conversão de Campos:
1. "name": Nome claro do serviço ou produto (ex: "Corte Feminino", "Shampoo L'Oréal Liss Unlimited").
2. "category": Categoria elegante em português, por ex: "Cabelo", "Unha", "Cílios", "Sobrancelhas", "Massagem", "Maquiagem", "Estética", "Venda de Produtos", "Shampoo & Condicionador", "Finalizadores", "Cuidado Facial".
3. "price": Preço como número decimal positivo. Se for sob consulta/grátis, retorne 0. Se expressar uma variação (Ex: de R$ 150 a R$ 200), defina o valor médio ou mínimo.
4. "priceType": Identifique se o preço é "fixed" (preço fixo), "from" (a partir de) ou "variable" (sob avaliação/variável). Se o texto contiver "a partir de", comece com "from". Se não disser o preço, use "variable".
5. "type": Classifique detalhadamente entre "service" (serviço prestado no salão) ou "product" (produto físico de revenda).
6. "durationMinutes": Duração em minutos lógicos para serviços (Exemplo: Manicure = 45, Corte = 60, Escova = 60, Tintura = 90). Caso seja classificado como "product", "durationMinutes" deve ser obrigatoriamente 0.
7. "description": Breve descrição refinada de uma frase para o cliente.

Retorne estritamente o JSON estruturado em conformidade com o schema.`
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                items: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "STRING" },
                      category: { type: "STRING" },
                      price: { type: "NUMBER" },
                      type: { type: "STRING", description: "logical 'service' or 'product'" },
                      priceType: { type: "STRING", description: "logical 'fixed', 'from', 'variable'" },
                      durationMinutes: { type: "INTEGER", description: "Logical time, or 0 if product" },
                      description: { type: "STRING" }
                    },
                    required: ["name", "category", "price", "type", "priceType", "durationMinutes"]
                  }
                }
              },
              required: ["items"]
            }
          }
        });

        if (response && response.text) {
          return JSON.parse(response.text.trim());
        } else {
          throw new Error('Retorno sem conteúdo do serviço Lumière AI.');
        }
      });

      return res.json(result);
    } catch (err: any) {
      console.error('Erro ao processar catálogo pelo Gemini PDF Reader:', err);
      return res.status(500).json({
        error: err?.message || 'Falha de processamento via Inteligência Artificial.'
      });
    }
  });

  // API Route para o Chatbot Inteligente Lumière AI
  app.post("/api/gemini-chat", async (req, res) => {
    try {
      const {
        message,
        history,
        salonName,
        businessType,
        salonPlan,
        userName,
        userRole
      } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Sua mensagem é obrigatória." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
        return res.json({ 
          text: "Inteligência Artificial Pausada: Por favor, adicione sua própria 'GEMINI_API_KEY' nas configurações (Settings) do LumièreOS e reinicie o servidor do aplicativo para ativar o bate-papo."
        });
      }

      const text = await withDeveloperAuth(apiKey, async (ai) => {
        const systemInstruction = `Você é o Lumière Assistant, um chatbot de inteligência artificial de elite e consultor de alta performance integrado ao LumiereOS — o SaaS premium de gestão de salões de beleza e clínicas de estética.
Seu objetivo é ajudar proprietários, gerentes e profissionais a elevar o nível de seus negócios, melhorar a liderança de equipe, otimizar rotinas de abertura/fechamento com checklists (Módulo Operacional), aumentar vendas, reajustar comissões de forma justa, fidelizar clientes e organizar agendamentos.

Informações sobre o contexto atual do usuário:
- Salão/Estabelecimento: ${salonName || 'Nosso Salão'}
- Tipo de Negócio: ${businessType || 'Salão de beleza/clínica'}
- Plano LumiereOS do Salão: ${salonPlan || 'Performance'}
- Usuário que está falando com você: ${userName || 'Colaborador'} (Função no salão: ${userRole || 'Profissional'})

Instruções de Resposta:
1. Responda em Português do Brasil com um tom extremamente elegante, profissional, empático, encorajador e focado em alta-performance. Seu estilo é o de um mentor executivo de salões de beleza de prestígio.
2. Seja direto e estruturado nas respostas. Use listas de tópicos (bullets) para ideias de ação prática.
3. Não use saudações robotizadas longas ou textão desnecessário. Tente dar conselhos práticos que possam ser aplicados hoje mesmo.
4. Jamais invente dados confidenciais do LumiereOS ou finja que tem acesso a dados confidenciais que não foram compartilhados.
5. Formate suas respostas para Markdown simples (use negritos, bullets, e quebras de linha limpas), mas não use blocos de código grandes desnecessariamente.`;

        // Map incoming history list to Gemini's expected array of Content { role: "user" | "model", parts: [{ text: "..." }] }
        const formattedContents = [
          ...(history || []).map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content || msg.text || '' }]
          })),
          {
            role: 'user',
            parts: [{ text: message }]
          }
        ];

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: formattedContents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
          }
        });

        if (response && response.text) {
          return response.text.trim();
        } else {
          throw new Error('Sem resposta gerada pelo servidor do Lumière AI.');
        }
      });

      return res.json({ text });
    } catch (err: any) {
      console.error('Erro no Lumière AI Chatbot:', err);
      return res.status(500).json({
        error: err?.message || 'Falha de comunicação no barramento Lumière AI. Tente novamente.'
      });
    }
  });

  // Middleware para rotas de API não encontradas (retorna JSON 404 em vez de HTML)
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.originalUrl}` });
  });

  // Configuração do Vite middleware ou arquivos estáticos dependendo do ambiente
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback de SPA para desenvolvimento: Serve o index.html transformado pelo Vite em qualquer rota indefinida
    app.use("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api") || req.originalUrl.includes(".")) {
        return next();
      }
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        // Transforma o index.html injetando as rotas dinâmicas do cliente e as referências do Vite
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    // Servir arquivos de build em produção
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith("/api")) {
        return res.status(404).json({ error: "Endpoint de API não encontrado." });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Lumière Server] Servidor executando em http://localhost:${PORT}`);
  });
}

startServer();

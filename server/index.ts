
import caktoSettingsHandler from "../api/cakto/settings.js";
import caktoSyncProductsHandler from "../api/cakto/sync-products.js";
import caktoCreateCheckoutHandler from "../api/cakto/create-checkout.js";
import caktoWebhookHandler from "../api/cakto/webhook.js";
import caktoWebhookTestHandler from "../api/cakto/webhook-test.js";
import caktoSubscriptionStatusHandler from "../api/cakto/subscription-status.js";
import caktoRealSubscriptionHandler from "../api/cakto/real-subscription.js";
import caktoUpdatePaymentMethodHandler from "../api/cakto/update-payment-method.js";
import caktoChangePlanHandler from "../api/cakto/change-plan.js";

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

  async function resolvePlatformAdmin(user: any, adminDb: any): Promise<boolean> {
    if (!user || !user.uid) return false;

    // 1. Custom Claims
    if (user.role === "platform_admin") return true;
    if (user.platform_admin === true) return true;

    // 2. platformAdmins/{uid}
    try {
      const platformAdminSnap = await adminDb.collection("platformAdmins").doc(user.uid).get();
      if (platformAdminSnap.exists) return true;
    } catch (err) {
      console.warn(`[Platform Admin Check] Erro ao consultar platformAdmins/${user.uid}:`, err);
    }

    // 3. users/{uid}.role === "platform_admin"
    try {
      const userSnap = await adminDb.collection("users").doc(user.uid).get();
      if (userSnap.exists && userSnap.data()?.role === "platform_admin") {
        return true;
      }
    } catch (err) {
      console.warn(`[Platform Admin Check] Erro ao consultar users/${user.uid}:`, err);
    }

    // 4. Fallback PLATFORM_ADMIN_EMAIL (sem VITE_*)
    const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL;
    if (user.email && platformAdminEmail && user.email === platformAdminEmail) {
      return true;
    }

    return false;
  }

  // Função auxiliar para verificar as permissões de gerenciamento de faturamento do salão
  async function canManageBilling(user: any, salonId: string, salonData: any): Promise<{ authorized: boolean; role?: string; reason?: string }> {
    const uid = user?.uid;

    if (!uid) {
      return { authorized: false, reason: "ID de usuário ausente." };
    }

    const adminDb = getAdminDb();

    // 1. Primeiro resolve platform admin globalmente
    const platformAdmin = await resolvePlatformAdmin(user, adminDb);
    if (platformAdmin) {
      return { authorized: true, role: "platform_admin" };
    }

    // 2. Proprietário direto do salão no Firestore (salonData.ownerId)
    if (salonData?.ownerId === uid) {
      return { authorized: true, role: "owner" };
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
    const adminDb = getAdminDb();
    return resolvePlatformAdmin(user, adminDb);
  }

  // Endpoints para gerenciar configurações dinâmicas da Cakto no Firestore (Master Panel)
  
  app.get("/api/cakto/settings", (req, res) => caktoSettingsHandler(req as any, res as any));
  app.post("/api/cakto/settings", (req, res) => caktoSettingsHandler(req as any, res as any));
  app.post("/api/cakto/sync-products", (req, res) => caktoSyncProductsHandler(req as any, res as any));
  app.post("/api/cakto/create-checkout", (req, res) => caktoCreateCheckoutHandler(req as any, res as any));
  app.post("/api/cakto/webhook", (req, res) => caktoWebhookHandler(req as any, res as any));
  app.post("/api/cakto/webhook-test", (req, res) => caktoWebhookTestHandler(req as any, res as any));
  app.get("/api/cakto/subscription-status", (req, res) => caktoSubscriptionStatusHandler(req as any, res as any));
  app.get("/api/cakto/real-subscription", (req, res) => caktoRealSubscriptionHandler(req as any, res as any));
  app.post("/api/cakto/update-payment-method", (req, res) => caktoUpdatePaymentMethodHandler(req as any, res as any));
  app.post("/api/cakto/change-plan", (req, res) => caktoChangePlanHandler(req as any, res as any));

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

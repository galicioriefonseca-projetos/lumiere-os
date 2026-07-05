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
    if (email && email === platformAdminEmail) {
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

  // Rota para criação de Cliente no Asaas
  app.post("/api/asaas/create-customer", authenticateRequest, async (req, res) => {
    try {
      const { salonId, name, email, phone, document } = req.body;
      if (!salonId || !name || !document) {
        return res.status(400).json({ error: "salonId, name e document (CPF/CNPJ) são campos obrigatórios." });
      }

      const user = (req as any).user;
      const adminDb = getAdminDb();
      const salonRef = adminDb.collection("salons").doc(salonId);
      const salonDoc = await salonRef.get();

      if (!salonDoc.exists) {
        return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
      }

      const salonData = salonDoc.data();

      // Garantia contra Acesso Cruzado / Invasão de Faturamento:
      const authResult = await canManageBilling(user, salonId, salonData);
      console.log(`[Asaas Auth Log] UID: ${user.uid} | Salon: ${salonId} | Role: ${authResult.role || "Nenhuma/Não-cadastrada"} | Autorizado: ${authResult.authorized}`);
      if (!authResult.authorized) {
        return res.status(403).json({ error: authResult.reason || "Você não tem permissão para gerenciar o faturamento deste salão." });
      }

      // Idempotência básica: usar asaasCustomerId existente se já estiver associado ao salão
      if (salonData?.asaasCustomerId) {
        console.log(`[Asaas Customer] Salão ${salonId} já possui cliente Asaas associado: ${salonData.asaasCustomerId}`);
        return res.json({
          id: salonData.asaasCustomerId,
          externalId: salonData.asaasCustomerId,
          salonId,
          name: salonData.ownerName || name,
          email: salonData.ownerEmail || email,
          phone: salonData.phone || phone,
          document: salonData.document || document,
          createdAt: new Date(salonData.createdAt || Date.now()),
          updatedAt: new Date(),
        });
      }

      // Se não houver, cria um novo no Asaas
      const payload = {
        name,
        email,
        phone,
        mobilePhone: phone,
        cpfCnpj: document.replace(/\D/g, ""), // Limpa caracteres não numéricos do documento
        externalReference: salonId,
        notificationDisabled: true, // silenciar alertas automáticos via e-mail direto do painel Asaas
      };

      const asaasCustomer = await asaasRequest("POST", "/customers", payload);
      
      // Atualizar o documento do salão no Firestore com o ID recém-criado
      await salonRef.update({
        asaasCustomerId: asaasCustomer.id,
        updatedAt: Date.now(),
      });

      console.log(`[Asaas Customer] Cliente criado com sucesso para o salão ${salonId}: ${asaasCustomer.id}`);
      return res.json({
        id: asaasCustomer.id,
        externalId: asaasCustomer.id,
        salonId,
        name: asaasCustomer.name,
        email: asaasCustomer.email,
        phone: asaasCustomer.phone,
        document: asaasCustomer.cpfCnpj,
        createdAt: new Date(asaasCustomer.dateCreated),
        updatedAt: new Date(),
      });
    } catch (err: any) {
      console.error("[Asaas Customer] Erro ao criar cliente:", err);
      return res.status(500).json({ error: err.message || "Falha ao criar cliente no Asaas." });
    }
  });

  // Rota para criação de Assinatura Recorrente no Asaas (inclui trial de 7 dias)
  app.post("/api/asaas/create-subscription", authenticateRequest, async (req, res) => {
    try {
      const { salonId, customerId, planId, paymentMethod } = req.body;
      if (!salonId || !customerId || !planId) {
        return res.status(400).json({ error: "salonId, customerId e planId são obrigatórios." });
      }

      const user = (req as any).user;
      const adminDb = getAdminDb();
      const salonRef = adminDb.collection("salons").doc(salonId);
      const salonDoc = await salonRef.get();

      if (!salonDoc.exists) {
        return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
      }

      const salonData = salonDoc.data();

      // Garantia contra Acesso Cruzado / Invasão de Faturamento:
      const authResult = await canManageBilling(user, salonId, salonData);
      console.log(`[Asaas Auth Log] UID: ${user.uid} | Salon: ${salonId} | Role: ${authResult.role || "Nenhuma/Não-cadastrada"} | Autorizado: ${authResult.authorized}`);
      if (!authResult.authorized) {
        return res.status(403).json({ error: authResult.reason || "Você não tem permissão para gerenciar o faturamento deste salão." });
      }

      // Idempotência básica: usar asaasSubscriptionId existente para evitar duplicar cobranças recorrentes
      if (salonData?.asaasSubscriptionId) {
        console.log(`[Asaas Subscription] Salão ${salonId} já possui assinatura ativa no Asaas: ${salonData.asaasSubscriptionId}`);
        return res.json({
          id: salonData.asaasSubscriptionId,
          externalId: salonData.asaasSubscriptionId,
          salonId,
          customerId,
          planId,
          status: salonData.subscriptionStatus || "active",
          price: salonData.lastPaymentAmount || 0,
          paymentMethod: paymentMethod || "credit_card",
          interval: "monthly",
          createdAt: new Date(salonData.createdAt),
          updatedAt: new Date(),
        });
      }

      // Mapeamento elegante de valores baseado nos planos cadastrados (Suporta Asaas ou Mercado Pago legado)
      const planPrices: Record<string, number> = {
        start: Number(process.env.ASAAS_PLAN_START_AMOUNT) || Number(process.env.MP_PLAN_START_AMOUNT) || 197,
        studio: Number(process.env.ASAAS_PLAN_STUDIO_AMOUNT) || Number(process.env.MP_PLAN_STUDIO_AMOUNT) || 397,
        performance: Number(process.env.ASAAS_PLAN_PERFORMANCE_AMOUNT) || Number(process.env.MP_PLAN_PERFORMANCE_AMOUNT) || 697,
        network: Number(process.env.ASAAS_PLAN_NETWORK_AMOUNT) || Number(process.env.MP_PLAN_NETWORK_AMOUNT) || 1497,
        founder: Number(process.env.ASAAS_PLAN_FOUNDER_AMOUNT) || Number(process.env.MP_PLAN_FOUNDER_AMOUNT) || 297,
      };

      const value = planPrices[planId] || 197;
      
      // Configurar trial de 7 dias: primeira cobrança real será daqui a 7 dias
      const trialDays = 7;
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      const nextDueDateStr = trialEndDate.toISOString().split("T")[0];

      const methodMapping: Record<string, string> = {
        credit_card: "CREDIT_CARD",
        pix: "PIX",
        boleto: "BOLETO",
      };
      const billingType = methodMapping[paymentMethod] || "CREDIT_CARD";

      const subscriptionPayload = {
        customer: customerId,
        billingType,
        value,
        nextDueDate: nextDueDateStr,
        cycle: "MONTHLY",
        description: `Assinatura LumièreOS - Plano ${planId.toUpperCase()}`,
        externalReference: salonId,
      };

      const asaasSubscription = await asaasRequest("POST", "/subscriptions", subscriptionPayload);

      // Obter de forma segura o link de checkout do primeiro ciclo pendente
      let checkoutUrl = "";
      try {
        const paymentsResponse = await asaasRequest("GET", `/payments?subscription=${asaasSubscription.id}`);
        if (paymentsResponse.data && paymentsResponse.data.length > 0) {
          checkoutUrl = paymentsResponse.data[0].invoiceUrl;
        }
      } catch (err) {
        console.warn("[Asaas Subscription] Erro ao carregar link de checkout para a assinatura recém-criada:", err);
      }

      // Atualizar dados no Firestore
      await salonRef.update({
        billingProvider: "asaas",
        billingMode: billingType === "CREDIT_CARD" ? "recurring_card" : "manual_pix",
        asaasSubscriptionId: asaasSubscription.id,
        asaasCheckoutUrl: checkoutUrl || null,
        subscriptionStatus: "trial",
        paymentStatus: "pending",
        nextBillingDate: trialEndDate.getTime(),
        updatedAt: Date.now(),
      });

      console.log(`[Asaas Subscription] Assinatura criada com sucesso para o salão ${salonId}: ${asaasSubscription.id}`);
      return res.json({
        id: asaasSubscription.id,
        externalId: asaasSubscription.id,
        salonId,
        customerId,
        planId,
        status: "trial",
        price: value,
        paymentMethod: paymentMethod || "credit_card",
        interval: "monthly",
        trialDays,
        trialEnd: trialEndDate,
        nextDueDate: trialEndDate,
        createdAt: new Date(asaasSubscription.dateCreated),
        updatedAt: new Date(),
      });
    } catch (err: any) {
      console.error("[Asaas Subscription] Erro ao criar assinatura:", err);
      return res.status(500).json({ error: err.message || "Falha ao criar assinatura no Asaas." });
    }
  });

  // Rota para criação de Taxa de Implementação Única no Asaas
  app.post("/api/asaas/create-implementation-fee", authenticateRequest, async (req, res) => {
    try {
      const { salonId, customerId, amount } = req.body;
      if (!salonId || !customerId || !amount) {
        return res.status(400).json({ error: "salonId, customerId e amount são campos obrigatórios." });
      }

      const user = (req as any).user;
      const adminDb = getAdminDb();
      const salonRef = adminDb.collection("salons").doc(salonId);
      const salonDoc = await salonRef.get();

      if (!salonDoc.exists) {
        return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
      }

      const salonData = salonDoc.data();

      // Garantia contra Acesso Cruzado / Invasão de Faturamento:
      const authResult = await canManageBilling(user, salonId, salonData);
      console.log(`[Asaas Auth Log] UID: ${user.uid} | Salon: ${salonId} | Role: ${authResult.role || "Nenhuma/Não-cadastrada"} | Autorizado: ${authResult.authorized}`);
      if (!authResult.authorized) {
        return res.status(403).json({ error: authResult.reason || "Você não tem permissão para gerenciar o faturamento deste salão." });
      }

      const externalRef = `${salonId}_implementation_fee`;

      // Idempotência básica: verificar se já existe uma cobrança de taxa de implantação ativa no Asaas
      try {
        const existingPayments = await asaasRequest("GET", `/payments?externalReference=${externalRef}`);
        if (existingPayments.data && existingPayments.data.length > 0) {
          const payment = existingPayments.data[0];
          console.log(`[Asaas Fee] Taxa de implantação já existente localizada: ${payment.id}`);
          return res.json({
            id: payment.id,
            invoiceUrl: payment.invoiceUrl,
            status: payment.status,
            amount: payment.value,
          });
        }
      } catch (err) {
        console.warn("[Asaas Fee] Não foi possível verificar idempotência de pagamentos no Asaas:", err);
      }

      // Definir vencimento amanhã para facilidade do cliente
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      const dueDateStr = dueDate.toISOString().split("T")[0];

      const feePayload = {
        customer: customerId,
        billingType: "UNDEFINED", // Permite escolher qualquer método no checkout do Asaas
        value: Number(amount),
        dueDate: dueDateStr,
        description: "Taxa única de implantação e configuração LumièreOS",
        externalReference: externalRef,
      };

      const asaasPayment = await asaasRequest("POST", "/payments", feePayload);

      console.log(`[Asaas Fee] Taxa de implantação criada com sucesso para o salão ${salonId}: ${asaasPayment.id}`);
      return res.json({
        id: asaasPayment.id,
        invoiceUrl: asaasPayment.invoiceUrl,
        status: asaasPayment.status,
        amount: asaasPayment.value,
      });
    } catch (err: any) {
      console.error("[Asaas Fee] Erro ao criar taxa de implantação:", err);
      return res.status(500).json({ error: err.message || "Falha ao criar taxa de implantação no Asaas." });
    }
  });

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
    founderOfferId: string;
    studioOfferId: string;
    performanceOfferId: string;
    networkOfferId: string;
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
    } catch (err) {
      console.error("[Cakto Settings Cache] Erro ao buscar dados do Firestore, retornando fallback vazio:", err);
      return {
        productId: "",
        founderOfferId: "",
        studioOfferId: "",
        performanceOfferId: "",
        networkOfferId: ""
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

  let cachedCaktoToken: { token: string; expiresAt: number } | null = null;

  async function getCaktoAccessToken(): Promise<string> {
    const clientId = process.env.CAKTO_CLIENT_ID;
    const clientSecret = process.env.CAKTO_CLIENT_SECRET;
    const apiUrl = process.env.CAKTO_API_URL || "https://api.cakto.com.br";

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
    const endpointsToTry = [
      `${apiUrl}/oauth/token`,
      `${apiUrl}/v1/oauth/token`,
    ];

    let lastErrorDetail = "";

    for (const url of endpointsToTry) {
      // 1. Tentar Form Urlencoded com client_id e client_secret no body (Standard OAuth2)
      try {
        console.log(`[Cakto API Secure Log] Tentando obter token de ${url} via application/x-www-form-urlencoded (Body params)...`);
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
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

        console.log(`[Cakto API Secure Log] URL: ${url} (urlencoded_body) | Status: ${responseStatus} | Resposta: ${safeText}`);

        if (response.ok) {
          const data = JSON.parse(text);
          if (data && data.access_token) {
            const expiresIn = (data.expires_in || 3600) * 1000;
            cachedCaktoToken = {
              token: data.access_token,
              expiresAt: Date.now() + expiresIn - 60000
            };
            console.log("[Cakto API] Token de acesso obtido com sucesso via urlencoded_body!");
            return data.access_token;
          }
        } else {
          lastErrorDetail = `URL: ${url} (urlencoded_body) | Status: ${responseStatus} | Resposta: ${safeText}`;
        }
      } catch (err: any) {
        console.warn(`[Cakto API] Erro na tentativa urlencoded_body para ${url}:`, err);
        lastErrorDetail = `URL: ${url} (urlencoded_body) | Erro: ${err.message}`;
      }

      // 2. Tentar Form Urlencoded com Basic Auth Header
      try {
        console.log(`[Cakto API Secure Log] Tentando obter token de ${url} via application/x-www-form-urlencoded (Basic Auth header)...`);
        const base64Credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${base64Credentials}`,
          },
          body: params.toString(),
        });

        const responseStatus = response.status;
        const text = await response.text();
        const safeText = text
          .replace(new RegExp(clientSecret, "g"), "[REDACTED_SECRET]")
          .replace(new RegExp(clientId, "g"), "[REDACTED_CLIENT_ID]");

        console.log(`[Cakto API Secure Log] URL: ${url} (urlencoded_basic) | Status: ${responseStatus} | Resposta: ${safeText}`);

        if (response.ok) {
          const data = JSON.parse(text);
          if (data && data.access_token) {
            const expiresIn = (data.expires_in || 3600) * 1000;
            cachedCaktoToken = {
              token: data.access_token,
              expiresAt: Date.now() + expiresIn - 60000
            };
            console.log("[Cakto API] Token de acesso obtido com sucesso via urlencoded_basic!");
            return data.access_token;
          }
        } else {
          lastErrorDetail = `URL: ${url} (urlencoded_basic) | Status: ${responseStatus} | Resposta: ${safeText}`;
        }
      } catch (err: any) {
        console.warn(`[Cakto API] Erro na tentativa urlencoded_basic para ${url}:`, err);
        lastErrorDetail = `URL: ${url} (urlencoded_basic) | Erro: ${err.message}`;
      }

      // 3. Tentar JSON Body (fallback anterior)
      try {
        console.log(`[Cakto API Secure Log] Tentando obter token de ${url} via application/json (JSON Body)...`);
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });

        const responseStatus = response.status;
        const text = await response.text();
        const safeText = text
          .replace(new RegExp(clientSecret, "g"), "[REDACTED_SECRET]")
          .replace(new RegExp(clientId, "g"), "[REDACTED_CLIENT_ID]");

        console.log(`[Cakto API Secure Log] URL: ${url} (json) | Status: ${responseStatus} | Resposta: ${safeText}`);

        if (response.ok) {
          const data = JSON.parse(text);
          if (data && data.access_token) {
            const expiresIn = (data.expires_in || 3600) * 1000;
            cachedCaktoToken = {
              token: data.access_token,
              expiresAt: Date.now() + expiresIn - 60000
            };
            console.log("[Cakto API] Token de acesso obtido com sucesso via json!");
            return data.access_token;
          }
        } else {
          lastErrorDetail = `URL: ${url} (json) | Status: ${responseStatus} | Resposta: ${safeText}`;
        }
      } catch (err: any) {
        console.warn(`[Cakto API] Erro na tentativa json para ${url}:`, err);
        lastErrorDetail = `URL: ${url} (json) | Erro: ${err.message}`;
      }
    }

    throw new Error(`Falha ao autenticar com a API Cakto (OAuth2). Detalhes: ${lastErrorDetail}`);
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

      const { productId, founderOfferId, studioOfferId, performanceOfferId, networkOfferId } = req.body;

      const adminDb = getAdminDb();
      const docRef = adminDb.collection("settings").doc("cakto");

      const updatedSettings = {
        productId: productId || "",
        founderOfferId: founderOfferId || "",
        studioOfferId: studioOfferId || "",
        performanceOfferId: performanceOfferId || "",
        networkOfferId: networkOfferId || "",
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

      const clientId = process.env.CAKTO_CLIENT_ID;
      const clientSecret = process.env.CAKTO_CLIENT_SECRET;
      const apiUrl = process.env.CAKTO_API_URL || "https://api.cakto.com.br";

      console.log("[Cakto Sync Express] Iniciando sincronização automática de produtos...");
      if (!clientId || !clientSecret) {
        return res.status(400).json({
          error: "CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no servidor."
        });
      }

      // 1. Obter token da Cakto (Usa a função getCaktoAccessToken já existente no Express!)
      let accessToken;
      try {
        accessToken = await getCaktoAccessToken();
      } catch (authErr: any) {
        return res.status(502).json({
          error: `Falha na autenticação com a API Cakto (status 400 ou 502): ${authErr.message}`
        });
      }

      // 2. Listar produtos
      console.log("[Cakto Sync Express] Listando produtos...");
      const productsRes = await fetch(`${apiUrl}/public_api/products/`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!productsRes.ok) {
        const errText = await productsRes.text();
        return res.status(502).json({ error: `Falha ao listar produtos na Cakto: ${errText}` });
      }

      const productsData = await productsRes.json();
      const products = Array.isArray(productsData) ? productsData : (productsData?.data || productsData?.results || []);

      // 3. Procurar produto cujo nome contenha "LumièreOS" ou "LumiereOS"
      const targetProduct = products.find((p: any) => {
        const name = String(p.name || p.title || "").toLowerCase();
        return name.includes("lumièreos") || name.includes("lumiereos");
      });

      if (!targetProduct) {
        return res.status(404).json({
          error: "Nenhum produto contendo 'LumièreOS' ou 'LumiereOS' foi localizado na sua conta da Cakto."
        });
      }

      const productId = String(targetProduct.id || targetProduct.productId || "");
      if (!productId) {
        return res.status(502).json({ error: "ID do produto LumièreOS não encontrado no payload da Cakto." });
      }

      // 4. Listar checkouts do produto
      console.log(`[Cakto Sync Express] Listando checkouts para o produto ${productId}...`);
      const checkoutsRes = await fetch(`${apiUrl}/public_api/products/${productId}/checkouts/`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!checkoutsRes.ok) {
        const errText = await checkoutsRes.text();
        return res.status(502).json({ error: `Falha ao listar checkouts para o produto ${productId}: ${errText}` });
      }

      const checkoutsData = await checkoutsRes.json();
      const checkouts = Array.isArray(checkoutsData) ? checkoutsData : (checkoutsData?.data || checkoutsData?.results || []);

      if (checkouts.length === 0) {
        return res.status(404).json({
          error: `Nenhum checkout configurado para o produto '${targetProduct.name || "LumièreOS"}' (ID: ${productId}) na Cakto.`
        });
      }

      // Helper inline para extrair offerId
      const extractOfferIdLocal = (details: any): string => {
        if (!details) return "";
        if (details.offer_id) return String(details.offer_id);
        if (details.offerId) return String(details.offerId);
        if (details.offers) {
          if (Array.isArray(details.offers)) {
            if (details.offers.length > 0) {
              const first = details.offers[0];
              if (first && typeof first === "object") {
                return String(first.id || first.offer_id || first.offerId || "");
              }
              return String(first);
            }
          } else if (typeof details.offers === "object") {
            return String(details.offers.id || details.offers.offer_id || details.offers.offerId || "");
          } else {
            return String(details.offers);
          }
        }
        if (details.default_offer_id) return String(details.default_offer_id);
        return "";
      };

      // 5. Obter detalhes de cada checkout para extrair offerId e mapear por plano
      let founderOfferId = "";
      let studioOfferId = "";
      let performanceOfferId = "";
      let networkOfferId = "";

      const checkoutsWithDetails = [];
      for (const checkout of checkouts) {
        const checkoutId = checkout.id || checkout.checkoutId || "";
        if (!checkoutId) continue;
        
        try {
          const detailRes = await fetch(`${apiUrl}/public_api/products/${productId}/checkouts/${checkoutId}/`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          });
          
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            checkoutsWithDetails.push({
              id: checkoutId,
              name: String(detailData.name || checkout.name || detailData.title || checkout.title || ""),
              details: detailData
            });
          }
        } catch (err) {
          console.warn(`[Cakto Sync Express] Erro ao buscar detalhes do checkout ${checkoutId}:`, err);
        }
      }

      // Mapear por nome
      for (const item of checkoutsWithDetails) {
        const offerId = extractOfferIdLocal(item.details);
        if (!offerId) continue;
        
        const nameLower = item.name.toLowerCase();
        if (nameLower.includes("founder")) {
          founderOfferId = offerId;
        } else if (nameLower.includes("studio")) {
          studioOfferId = offerId;
        } else if (nameLower.includes("performance")) {
          performanceOfferId = offerId;
        } else if (nameLower.includes("network")) {
          networkOfferId = offerId;
        }
      }

      // Fallback: Obter o primeiro checkout com offerId válido
      const defaultItem = checkoutsWithDetails.find(item => {
        const d = item.details;
        return d.is_default || d.default || d.is_active;
      }) || checkoutsWithDetails[0];

      const fallbackOfferId = defaultItem ? extractOfferIdLocal(defaultItem.details) : "";

      if (!fallbackOfferId) {
        return res.status(502).json({
          error: "Não foi possível extrair nenhum Offer ID válido dos checkouts da Cakto para servir como fallback."
        });
      }

      if (!founderOfferId) founderOfferId = fallbackOfferId;
      if (!studioOfferId) studioOfferId = fallbackOfferId;
      if (!performanceOfferId) performanceOfferId = fallbackOfferId;
      if (!networkOfferId) networkOfferId = fallbackOfferId;

      // 6. Salvar no Firestore
      const adminDb = getAdminDb();
      const docRef = adminDb.collection("settings").doc("cakto");

      const syncData = {
        productId,
        founderOfferId,
        studioOfferId,
        performanceOfferId,
        networkOfferId,
        updatedAt: Date.now()
      };

      await docRef.set(syncData, { merge: true });
      invalidateCaktoSettingsCache(syncData);
      console.log(`[Cakto Sync Express] Sincronização concluída com sucesso por ${user.email}.`);

      return res.status(200).json({
        success: true,
        message: "Sincronização realizada com sucesso!",
        settings: syncData,
        productName: targetProduct.name || "LumièreOS"
      });

    } catch (err: any) {
      console.error("[Cakto Sync Express] Erro crítico:", err);
      return res.status(500).json({ error: err.message || "Erro interno do servidor." });
    }
  });

  app.post("/api/cakto/create-checkout", authenticateRequest, async (req, res) => {
    try {
      const { salonId, planId, paymentMethod, email } = req.body;
      if (!salonId || !planId) {
        return res.status(400).json({ error: "salonId e planId são campos obrigatórios." });
      }

      const user = (req as any).user;
      const adminDb = getAdminDb();
      const salonRef = adminDb.collection("salons").doc(salonId);
      const salonDoc = await salonRef.get();

      if (!salonDoc.exists) {
        return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
      }

      const salonData = salonDoc.data();

      const authResult = await canManageBilling(user, salonId, salonData);
      console.log(`[Cakto Auth Log] UID: ${user.uid} | Salon: ${salonId} | Autorizado: ${authResult.authorized}`);
      if (!authResult.authorized) {
        return res.status(403).json({ error: authResult.reason || "Você não tem permissão para gerenciar o faturamento deste salão." });
      }

      // Carregar configurações dinâmicas da Cakto no Firestore usando o Cache do Servidor
      let offerId = "";
      let productId = "";
      try {
        const sData = await getCaktoSettingsCached();
        productId = sData.productId || "";
        switch (planId) {
          case 'start':
            offerId = sData.founderOfferId || "";
            break;
          case 'studio':
            offerId = sData.studioOfferId || "";
            break;
          case 'performance':
            offerId = sData.performanceOfferId || "";
            break;
          case 'network':
            offerId = sData.networkOfferId || "";
            break;
          case 'founder':
            offerId = sData.founderOfferId || "";
            break;
          default:
            offerId = sData.founderOfferId || "";
            break;
        }
      } catch (err) {
        console.error("[Cakto API] Erro ao carregar configurações dinâmicas usando cache do Firestore:", err);
      }

      const isProduction = process.env.NODE_ENV === "production";
      const hasCaktoCredentials = !!(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET);

      // Secure Logging (regras de Sprint de Segurança):
      console.log("[Cakto API Secure Log] Iniciando criação de checkout:");
      console.log(`[Cakto API Secure Log] CAKTO_API_URL: ${process.env.CAKTO_API_URL || "https://api.cakto.com.br"}`);
      console.log(`[Cakto API Secure Log] CAKTO_CLIENT_ID existe: ${!!process.env.CAKTO_CLIENT_ID}`);
      console.log(`[Cakto API Secure Log] CAKTO_CLIENT_SECRET existe: ${!!process.env.CAKTO_CLIENT_SECRET}`);
      console.log(`[Cakto API Secure Log] offerId usado: ${offerId}`);


      // 1. Remover modo simulado em produção. Se faltar CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET em produção, retornar erro 500 claro.
      if (isProduction && !hasCaktoCredentials) {
        console.error("[Cakto API Secure Log] Erro Crítico: Credenciais da Cakto ausentes no ambiente de produção.");
        return res.status(500).json({
          error: "Erro crítico de segurança: A integração com a Cakto não está configurada corretamente para o ambiente de produção. Faltam as credenciais CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET no servidor de produção."
        });
      }

      // 2. Permitir simulação somente se NODE_ENV !== "production".
      if (!isProduction && !hasCaktoCredentials) {
        console.warn("[Cakto Server] Aviso: Credenciais do Cakto ausentes. Usando modo de simulação em ambiente de desenvolvimento/homologação.");
        const simulatedOrderId = "ord_" + Math.random().toString(36).substring(2, 11).toUpperCase();
        const simulatedCheckoutUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard/faturamento?simulated_checkout=true&order_id=${simulatedOrderId}`;

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

        return res.json({
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
        redirect_url: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard/faturamento`,
        metadata: {
          salonId: salonId,
          planId: planId,
        }
      };

      console.log(`[Cakto API] Enviando requisição de checkout para ${apiUrl}/v1/checkouts...`);
      const response = await fetch(`${apiUrl}/v1/checkouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      // Secure Logging para HTTP status da Cakto
      console.log(`[Cakto API Secure Log] Status HTTP da requisição para v1/checkouts: ${response.status}`);

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

      console.log(`[Cakto Checkout] Checkout gerado e salvo para o salão ${salonId}: ${orderId}`);
      return res.json({
        success: true,
        checkoutUrl,
        orderId,
        subscriptionId,
      });

    } catch (err: any) {
      console.error("[Cakto Checkout] Erro ao criar checkout:", err);
      return res.status(500).json({ error: err.message || "Falha ao iniciar faturamento via Cakto." });
    }
  });

  app.post("/api/cakto/webhook", async (req, res) => {
    try {
      const receivedToken = req.headers["x-cakto-token"] || req.headers["cakto-token"] || req.headers["authorization"] || req.headers["x-cakto-signature"] || req.headers["cakto-signature"];
      const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;

      if (expectedSecret && receivedToken !== expectedSecret) {
        console.warn("[Cakto Webhook] Token ou assinatura de webhook inválida.");
        return res.status(401).json({ error: "Assinatura inválida de webhook." });
      }

      const eventName = req.body.event || req.body.eventType || req.body.status || "payment.approved";
      const orderId = req.body.order_id || req.body.orderId || req.body.data?.order_id || req.body.id;
      const subscriptionId = req.body.subscription_id || req.body.subscriptionId || req.body.data?.subscription_id;
      const customerId = req.body.customer_id || req.body.customerId || req.body.data?.customer_id || req.body.customer?.id;
      const salonId = req.body.external_id || req.body.externalId || req.body.metadata?.salonId || req.body.data?.metadata?.salonId || req.body.data?.external_id;

      console.log(`[Cakto Webhook] Evento recebido: ${eventName} para Order ID: ${orderId}, Salon: ${salonId}`);

      const adminDb = getAdminDb();
      let salonRef = null;
      let salonDoc = null;

      if (salonId) {
        salonRef = adminDb.collection("salons").doc(salonId);
        salonDoc = await salonRef.get();
      }

      if ((!salonDoc || !salonDoc.exists) && orderId) {
        const snapshot = await adminDb.collection("salons").where("caktoOrderId", "==", orderId).limit(1).get();
        if (!snapshot.empty) {
          salonDoc = snapshot.docs[0];
          salonRef = salonDoc.ref;
        }
      }

      if ((!salonDoc || !salonDoc.exists) && subscriptionId) {
        const snapshot = await adminDb.collection("salons").where("caktoSubscriptionId", "==", subscriptionId).limit(1).get();
        if (!snapshot.empty) {
          salonDoc = snapshot.docs[0];
          salonRef = salonDoc.ref;
        }
      }

      if (!salonDoc || !salonDoc.exists) {
        console.warn(`[Cakto Webhook] Salão não localizado para orderId ${orderId} ou subscriptionId ${subscriptionId}`);
        return res.status(200).json({ received: true, info: "Salão correspondente não localizado." });
      }

      const salonData = salonDoc.data();

      const eventId = req.body.id || req.body.event_id || `${eventName}_${orderId}_${Date.now()}`;
      if (salonData?.caktoLastEventId === eventId) {
        console.log(`[Cakto Webhook] Evento duplicado já processado: ${eventId}. Ignorando.`);
        return res.status(200).json({ success: true, info: "Evento duplicado já processado." });
      }

      const updatePayload: any = {
        billingProvider: "cakto",
        updatedAt: Date.now(),
        caktoLastEventId: eventId,
        caktoLastEvent: eventName,
      };

      if (orderId) updatePayload.caktoOrderId = orderId;
      if (subscriptionId) updatePayload.caktoSubscriptionId = subscriptionId;
      if (customerId) updatePayload.caktoCustomerId = customerId;

      const ev = String(eventName).toLowerCase();

      if (ev.includes("approved") || ev.includes("paid") || ev.includes("success") || ev.includes("completed") || ev === "active") {
        updatePayload.paymentStatus = "paid";
        updatePayload.subscriptionStatus = "active";
        updatePayload.lastPaymentAt = Date.now();
        updatePayload.lastPaymentAmount = req.body.amount || req.body.value || req.body.data?.amount || 0;
        updatePayload.nextBillingDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      } else if (ev.includes("overdue") || ev.includes("failed") || ev.includes("rejected")) {
        updatePayload.paymentStatus = "overdue";
        updatePayload.subscriptionStatus = "overdue";
      } else if (ev.includes("cancel") || ev.includes("deleted") || ev.includes("refunded")) {
        updatePayload.paymentStatus = "canceled";
        updatePayload.subscriptionStatus = "canceled";
      } else if (ev.includes("trial") || ev.includes("created")) {
        updatePayload.paymentStatus = "pending";
        updatePayload.subscriptionStatus = "trial";
      }

      await salonRef.update(updatePayload);
      console.log(`[Cakto Webhook] Sincronização concluída com sucesso para o salão ${salonDoc.id} (Evento: ${eventName})`);

      return res.status(200).json({ success: true, eventProcessed: eventName });
    } catch (err: any) {
      console.error("[Cakto Webhook] Falha ao processar evento de webhook da Cakto:", err);
      return res.status(500).json({ error: err.message || "Erro interno no servidor de webhook." });
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
Uso/Aderência do Checklist Operacional Diário Essenza: ${checklistPct || 0}% de conformidade hoje.
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
Desempenho recente nas avaliações diárias (Checklist Essenza): ${recentEvaluations || 'Não informado'}

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
Seu objetivo é ajudar proprietários, gerentes e profissionais a elevar o nível de seus negócios, melhorar a liderança de equipe, otimizar rotinas de abertura/fechamento com checklists (Módulo Essenza), aumentar vendas, reajustar comissões de forma justa, fidelizar clientes e organizar agendamentos.

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

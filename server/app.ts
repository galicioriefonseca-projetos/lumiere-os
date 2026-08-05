
import resolveInviteHandler from "./routes/invites/resolve.js";
import acceptInviteHandler from "./routes/invites/accept.js";
import asaasSettingsHandler from "./routes/billing/settings.js";
import asaasTestConnectionHandler from "./routes/billing/test-connection.js";
import asaasCreateCheckoutHandler from "./routes/billing/create-checkout.js";
import asaasWebhookHandler from "./routes/billing/webhook.js";
import asaasChangePlanHandler from "./routes/billing/change-plan.js";
import asaasUpdatePaymentMethodHandler from "./routes/billing/update-payment-method.js";
import asaasRealSubscriptionHandler from "./routes/billing/real-subscription.js";
import asaasSubscriptionStatusHandler from "./routes/billing/subscription-status.js";

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { getFirebaseAdmin, getAdminDb, getAdminAuth, getAdminMessaging } from "./firebaseAdmin.js";


// Carregar variáveis de ambiente
dotenv.config();

console.log("[Lumière Server] Iniciando...");
import { env } from "./config/env.js";

console.log("[Lumière Server] NODE_ENV:", env.app.env);



const app = express();

export default app;

  
  

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
  // AUTENTICAÇÃO E PERMISSÕES DE FATURAMENTO
  // ==========================================

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
    const platformAdminEmail = env.app.platformAdminEmail;
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


  async function isPlatformAdminUser(user: any): Promise<boolean> {
    const adminDb = getAdminDb();
    return resolvePlatformAdmin(user, adminDb);
  }

  // Billing / Asaas endpoints
  app.get("/api/billing/settings", (req, res) => asaasSettingsHandler(req as any, res as any));
  app.post("/api/billing/settings", (req, res) => asaasSettingsHandler(req as any, res as any));
  app.post("/api/billing/test-connection", (req, res) => asaasTestConnectionHandler(req as any, res as any));
  app.post("/api/billing/create-checkout", (req, res) => asaasCreateCheckoutHandler(req as any, res as any));
  app.post("/api/billing/webhook", (req, res) => asaasWebhookHandler(req as any, res as any));
  app.post("/api/billing/change-plan", (req, res) => asaasChangePlanHandler(req as any, res as any));
  app.post("/api/billing/update-payment-method", (req, res) => asaasUpdatePaymentMethodHandler(req as any, res as any));
  app.get("/api/billing/real-subscription", (req, res) => asaasRealSubscriptionHandler(req as any, res as any));
  app.get("/api/billing/subscription-status", (req, res) => asaasSubscriptionStatusHandler(req as any, res as any));

  app.get("/api/invites/resolve", (req, res) => resolveInviteHandler(req as any, res as any));
  app.post("/api/invites/accept", (req, res) => acceptInviteHandler(req as any, res as any));

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      }

      const apiKey = env.firebase.apiKey;
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
        const errMessage = data?.error?.message || "Erro desconhecido na autenticação.";
        console.warn("[PlatformAuthProxy] Erro ao autenticar via REST API:", errMessage);
        
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
          console.warn(`[Push Notification Backend] Falha ao disparar para um token:`, err);
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

      const apiKey = env.gemini.apiKey;
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

      const apiKey = env.gemini.apiKey;
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

      const apiKey = env.gemini.apiKey;
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

      const apiKey = env.gemini.apiKey;
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

  
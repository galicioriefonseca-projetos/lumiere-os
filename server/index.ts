import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { getFirebaseAdmin, getAdminDb, getAdminAuth } from "./firebaseAdmin";
import createSubscription from "../api/mercadopago/create-subscription";
import webhookMP from "../api/mercadopago/webhook";
import healthMP from "../api/mercadopago/health";

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

  // Rotas Mercado Pago (montadas dinamicamente para compatibilidade local)
  app.post("/api/mercadopago/create-subscription", createSubscription);
  app.post("/api/mercadopago/webhook", webhookMP);
  app.get("/api/mercadopago/health", healthMP);

  // Helper to isolate Developer API Key authentication by unsetting GCP ADC environment variables temporarily
  async function withDeveloperAuth<T>(apiKey: string, fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
    const prevCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const prevGcloudProject = process.env.GOOGLE_GCLOUD_PROJECT;
    const prevCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    const prevGcloudProj = process.env.GCLOUD_PROJECT;
    const prevGcpProject = process.env.GCP_PROJECT;

    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_GCLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GCP_PROJECT;

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
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
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Lumière Server] Servidor executando em http://localhost:${PORT}`);
  });
}

startServer();

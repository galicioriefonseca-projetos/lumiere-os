import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Importar manipuladores de API do Stripe unificados
import createCheckoutSession from "../api/stripe/create-checkout-session";
import createPortalSession from "../api/stripe/create-portal-session";
import stripeWebhook from "../api/stripe/webhook";
import geminiInsight from "../api/gemini-insight";

// Carregar variáveis de ambiente
dotenv.config();

// Inicialização Preguiçosa do Firebase Admin SDK para prevenir travamentos se ausente
let adminApp: any = null;
const getFirebaseAdmin = () => {
  if (!adminApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn("[Lumiere System] Aviso: Configurações do Firebase Admin SDK ausentes ou incompletas no .env do servidor.");
      throw new Error("O Firebase Admin SDK não foi devidamente configurado nas variáveis de ambiente.");
    }

    try {
      const firebaseAdmin = (admin as any).default || admin;
      const apps = firebaseAdmin.apps || [];
      if (apps.length > 0) {
        adminApp = apps[0];
      } else {
        adminApp = firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, "\n"),
          }),
        });
      }
    } catch (err: any) {
      console.error("Erro ao inicializar Firebase Admin:", err);
      throw err;
    }
  }
  return adminApp;
};

const getAdminDb = () => {
  const appInstance = getFirebaseAdmin();
  const firebaseAdmin = (admin as any).default || admin;
  return firebaseAdmin.firestore(appInstance);
};

// Inicialização Preguiçosa do Stripe para prevenir travamentos se ausente
let stripeInstance: Stripe | null = null;
const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY não foi configurada no ambiente do servidor.");
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2023-10-16" as any,
    });
  }
  return stripeInstance;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware básicos (evitando express.json() no webhook para preservar o raw body do Stripe)
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/stripe/webhook") {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

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

  // Rota de Health Check do Stripe para diagnóstico seguro no preview/deploy
  app.get("/api/stripe/health", (req, res) => {
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
    const firebaseAdminConfigured = !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );
    const hasFounderPrice = !!process.env.STRIPE_PRICE_FOUNDER;
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    res.json({
      ok: stripeConfigured && firebaseAdminConfigured,
      stripeConfigured,
      firebaseAdminConfigured,
      hasFounderPrice,
      appUrl
    });
  });

  // API Route para o Gemini Insights
  app.post("/api/gemini-insight", geminiInsight);

  // Endpoints do Stripe Unificados

  // 1. Criar Checkout Session para assinatura
  app.post("/api/stripe/create-checkout-session", createCheckoutSession);

  // 2. Criar Portal Session para Gerenciamento
  app.post("/api/stripe/create-portal-session", createPortalSession);

  // 3. Webhook de Processamento e Sincronização em Tempo Real (Stripe)
  app.post("/api/stripe/webhook", stripeWebhook);

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

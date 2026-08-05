
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
import { authRoutes } from "./routes/auth.js";
import { pushRoutes } from "./routes/push.js";
import { aiRoutes } from "./routes/ai.js";
import { getFirebaseAdmin, getAdminDb, getAdminAuth, getAdminMessaging } from "./firebaseAdmin.js";


// Carregar variáveis de ambiente
dotenv.config();

console.log("[Lumière Server] Iniciando...");
import { env } from "./config/env.js";
import { publicLimiter, authLimiter, billingLimiter, aiLimiter, adminLimiter } from "./middleware/rateLimiter.js";

console.log("[Lumière Server] NODE_ENV:", env.app.env);



const app = express();

// Trust Vercel Proxy to get the real client IP
app.set("trust proxy", 1);

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
  app.use("/api/auth", authRoutes);
  app.use("/api", pushRoutes);
  app.use("/api", aiRoutes);

  app.get("/api/health", publicLimiter, (req, res) => {
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
  app.get("/api/billing/settings", adminLimiter, (req, res) => asaasSettingsHandler(req as any, res as any));
  app.post("/api/billing/settings", adminLimiter, (req, res) => asaasSettingsHandler(req as any, res as any));
  app.post("/api/billing/test-connection", adminLimiter, (req, res) => asaasTestConnectionHandler(req as any, res as any));
  app.post("/api/billing/create-checkout", billingLimiter, (req, res) => asaasCreateCheckoutHandler(req as any, res as any));
  app.post("/api/billing/webhook", (req, res) => asaasWebhookHandler(req as any, res as any));
  app.post("/api/billing/change-plan", billingLimiter, (req, res) => asaasChangePlanHandler(req as any, res as any));
  app.post("/api/billing/update-payment-method", billingLimiter, (req, res) => asaasUpdatePaymentMethodHandler(req as any, res as any));
  app.get("/api/billing/real-subscription", billingLimiter, (req, res) => asaasRealSubscriptionHandler(req as any, res as any));
  app.get("/api/billing/subscription-status", billingLimiter, (req, res) => asaasSubscriptionStatusHandler(req as any, res as any));

  app.get("/api/invites/resolve", publicLimiter, (req, res) => resolveInviteHandler(req as any, res as any));
  app.post("/api/invites/accept", publicLimiter, (req, res) => acceptInviteHandler(req as any, res as any));

  // Rota de envio de Notificações Push via Firebase Cloud Messaging para Profissionais
  // Helper to isolate Developer API Key authentication by unsetting GCP ADC environment variables temporarily
  // Middleware para rotas de API não encontradas (retorna JSON 404 em vez de HTML)
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.originalUrl}` });
  });

  
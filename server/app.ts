import resolveInviteHandler from "./routes/invites/resolve.js";
import acceptInviteHandler from "./routes/invites/accept.js";
import asaasSettingsHandler from "./routes/billing/settings.js";
import asaasTestConnectionHandler from "./routes/billing/test-connection.js";
import asaasCreateCheckoutHandler from "./routes/billing/create-checkout.js";
import asaasCustomerDataHandler from "./routes/billing/customer-data.js";
import asaasWebhookHandler from "./routes/billing/webhook.js";
import asaasChangePlanHandler from "./routes/billing/change-plan.js";
import asaasChangeCycleHandler from "./routes/billing/change-cycle.js";
import asaasUpdatePaymentMethodHandler from "./routes/billing/update-payment-method.js";
import asaasRealSubscriptionHandler from "./routes/billing/real-subscription.js";
import asaasSubscriptionStatusHandler from "./routes/billing/subscription-status.js";
import seedDemoSalonHandler from "./routes/admin/seed-demo-salon.js";

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

// Rotas principais
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
  if (user.role === "platform_admin") return true;
  if (user.platform_admin === true) return true;

  try {
    const platformAdminSnap = await adminDb.collection("platformAdmins").doc(user.uid).get();
    if (platformAdminSnap.exists) return true;
  } catch (err) {
    console.warn(`[Platform Admin Check] Erro ao consultar platformAdmins/${user.uid}:`, err);
  }

  try {
    const userSnap = await adminDb.collection("users").doc(user.uid).get();
    if (userSnap.exists && userSnap.data()?.role === "platform_admin") return true;
  } catch (err) {
    console.warn(`[Platform Admin Check] Erro ao consultar users/${user.uid}:`, err);
  }

  const platformAdminEmail = env.app.platformAdminEmail;
  if (user.email && platformAdminEmail && user.email === platformAdminEmail) return true;
  return false;
}

async function canManageBilling(user: any, salonId: string, salonData: any): Promise<{ authorized: boolean; role?: string; reason?: string }> {
  const uid = user?.uid;
  if (!uid) return { authorized: false, reason: "ID de usuário ausente." };

  const adminDb = getAdminDb();
  const platformAdmin = await resolvePlatformAdmin(user, adminDb);
  if (platformAdmin) return { authorized: true, role: "platform_admin" };

  if (salonData?.ownerId === uid) return { authorized: true, role: "owner" };

  try {
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (userSnap.exists) {
      const uData = userSnap.data();
      const userSalonId = uData?.salonId;
      const userRole = uData?.role;
      if (userSalonId === salonId) {
        const allowedRoles = ["owner", "admin", "manager"];
        if (allowedRoles.includes(userRole)) return { authorized: true, role: userRole };
        return { authorized: false, role: userRole, reason: `Seu perfil (${userRole}) não possui permissão de faturamento.` };
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
app.get("/api/billing/customer-data", billingLimiter, (req, res) => asaasCustomerDataHandler(req as any, res as any));
app.post("/api/billing/customer-data", billingLimiter, (req, res) => asaasCustomerDataHandler(req as any, res as any));
app.post("/api/billing/webhook", (req, res) => asaasWebhookHandler(req as any, res as any));
app.post("/api/billing/change-plan", billingLimiter, (req, res) => asaasChangePlanHandler(req as any, res as any));
app.post("/api/billing/change-cycle", billingLimiter, (req, res) => asaasChangeCycleHandler(req as any, res as any));
app.post("/api/billing/update-payment-method", billingLimiter, (req, res) => asaasUpdatePaymentMethodHandler(req as any, res as any));
app.get("/api/billing/real-subscription", billingLimiter, (req, res) => asaasRealSubscriptionHandler(req as any, res as any));
app.get("/api/billing/subscription-status", billingLimiter, (req, res) => asaasSubscriptionStatusHandler(req as any, res as any));

// Administração de dados fictícios da conta Lumiere Beauty
app.post("/api/admin/seed-demo-salon", adminLimiter, (req, res) => seedDemoSalonHandler(req as any, res as any));

app.get("/api/invites/resolve", publicLimiter, (req, res) => resolveInviteHandler(req as any, res as any));
app.post("/api/invites/accept", publicLimiter, (req, res) => acceptInviteHandler(req as any, res as any));

// Middleware para rotas de API não encontradas
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.originalUrl}` });
});

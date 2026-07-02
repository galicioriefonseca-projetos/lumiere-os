import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin";
import { verifyIdToken } from "../_shared/auth";

interface CaktoSettings {
  productId: string;
  founderOfferId: string;
  studioOfferId: string;
  performanceOfferId: string;
  networkOfferId: string;
  updatedAt?: number;
}

let cachedCaktoSettings: { data: CaktoSettings; expiresAt: number } | null = null;
const CAKTO_SETTINGS_CACHE_TTL = 5 * 60 * 1000; // Cache de 5 minutos

async function getCaktoSettingsCached(): Promise<CaktoSettings> {
  if (cachedCaktoSettings && cachedCaktoSettings.expiresAt > Date.now()) {
    console.log("[Cakto Settings Serverless Cache] Utilizando configurações em cache.");
    return cachedCaktoSettings.data;
  }

  console.log("[Cakto Settings Serverless Cache] Buscando do Firestore...");
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
    console.warn(`[Cakto Admin Check Serverless] Erro ao consultar privilégios para ${uid}:`, err);
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    // 2. Autorização
    const isPlatformAdmin = await isPlatformAdminUser(user);
    if (!isPlatformAdmin) {
      return res.status(403).json({ error: "Acesso restrito a administradores da plataforma." });
    }

    if (req.method === "GET") {
      const settings = await getCaktoSettingsCached();
      return res.status(200).json(settings);
    } else {
      const { productId, founderOfferId, studioOfferId, performanceOfferId, networkOfferId } = req.body || {};

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
      
      // Atualizar cache síncronamente na instância ativa
      cachedCaktoSettings = {
        data: updatedSettings,
        expiresAt: Date.now() + CAKTO_SETTINGS_CACHE_TTL
      };

      console.log(`[Cakto Settings Serverless API] Configurações salvas com sucesso por ${user.email}`);
      return res.status(200).json({ success: true, settings: updatedSettings });
    }
  } catch (err: any) {
    console.error("[Cakto Settings Serverless API] Erro no manipulador:", err);
    return res.status(500).json({ error: err.message || "Erro interno do servidor." });
  }
}

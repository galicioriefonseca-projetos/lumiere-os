import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

let adminApp: App | null = null;

export const getFirebaseAdmin = (): App => {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId) {
    throw new Error("[LumièreOS] FIREBASE_PROJECT_ID ausente. Configure esta variável na Vercel.");
  }
  if (!clientEmail) {
    throw new Error("[LumièreOS] FIREBASE_CLIENT_EMAIL ausente. Configure esta variável na Vercel.");
  }
  if (!privateKey) {
    throw new Error("[LumièreOS] FIREBASE_PRIVATE_KEY ausente. Configure esta variável na Vercel.");
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const normalizedKey = privateKey.replace(/\\n/g, "\n").trim();

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: normalizedKey,
    }),
  });

  console.log(`[LumièreOS] Firebase Admin inicializado. Project: ${projectId}`);
  return adminApp;
};

export const getAdminDb = () => getFirestore(getFirebaseAdmin());
export const getAdminAuth = () => getAuth(getFirebaseAdmin());
export const getAdminMessaging = () => getMessaging(getFirebaseAdmin());

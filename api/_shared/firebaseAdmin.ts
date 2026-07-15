import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

let adminApp: App | null = null;

export const isFirebaseAdminCredentialError = (error: any): boolean => {
  if (!error) return false;
  if (error.code === 16 || error.code === "16") return true;
  const msg = String(error.message || "").toLowerCase();
  const code = String(error.code || "").toLowerCase();
  const stack = String(error.stack || "").toLowerCase();
  const strErr = String(error).toLowerCase();

  const checks = [
    "16",
    "unauthenticated",
    "invalid authentication credentials",
    "invalid_grant",
    "invalid jwt signature",
    "service account credentials",
    "firebase_project_id",
    "firebase_client_email",
    "firebase_private_key",
    "lumièreos internal log"
  ];

  return checks.some(check => 
    msg.includes(check) || 
    code.includes(check) || 
    stack.includes(check) || 
    strErr.includes(check)
  );
};

export const getFirebaseAdmin = (): App => {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || projectId.trim() === "") {
    throw new Error("[LumièreOS Internal Log] FIREBASE_PROJECT_ID is empty.");
  }
  if (!clientEmail || !clientEmail.includes("@") || !clientEmail.includes("iam.gserviceaccount.com")) {
    throw new Error("[LumièreOS Internal Log] FIREBASE_CLIENT_EMAIL is invalid.");
  }
  if (!privateKey || !privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw new Error("[LumièreOS Internal Log] FIREBASE_PRIVATE_KEY is invalid (missing markers).");
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

import * as admin from 'firebase-admin';
import Stripe from 'stripe';

let adminApp: any = null;

export const getFirebaseAdmin = () => {
  const firebaseAdmin = (admin as any).default || admin;
  
  // Usar getApp() com nome fixo em vez de depender de apps.length
  const APP_NAME = 'lumiere-admin';
  try {
    return firebaseAdmin.app(APP_NAME);
  } catch {
    // App não existe ainda, inicializar
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error("O Firebase Admin SDK não foi devidamente configurado nas variáveis de ambiente.");
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  return firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  }, APP_NAME);
};

export const getAdminDb = () => {
  const appInstance = getFirebaseAdmin();
  const firebaseAdmin = (admin as any).default || admin;
  return firebaseAdmin.firestore(appInstance);
};

export const getAdminAuth = () => {
  const appInstance = getFirebaseAdmin();
  const firebaseAdmin = (admin as any).default || admin;
  return firebaseAdmin.auth(appInstance);
};

let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY não foi configurada no ambiente.");
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }
  return stripeInstance;
};

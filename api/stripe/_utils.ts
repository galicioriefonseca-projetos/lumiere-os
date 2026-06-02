import * as admin from 'firebase-admin';
import Stripe from 'stripe';

let adminApp: any = null;

export const getFirebaseAdmin = () => {
  if (!adminApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
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

export const getAdminDb = () => {
  const appInstance = getFirebaseAdmin();
  const firebaseAdmin = (admin as any).default || admin;
  return firebaseAdmin.firestore(appInstance);
};

let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY não foi configurada no ambiente.");
    }
    stripeInstance = new Stripe(secretKey, {
      // Atualizado para uma versão segura e recente da API Stripe ("2024-12-18.acacia")
      apiVersion: "2024-12-18.acacia" as any,
    });
  }
  return stripeInstance;
};

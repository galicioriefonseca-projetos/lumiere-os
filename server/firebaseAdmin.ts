import * as admin from 'firebase-admin';

let adminApp: any = null;

export const getFirebaseAdmin = () => {
  if (!adminApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    try {
      const firebaseAdmin = (admin as any).default || admin;
      const apps = firebaseAdmin.apps || [];
      if (apps.length > 0) {
        adminApp = apps[0];
      } else {
        if (projectId && clientEmail && privateKey) {
          adminApp = firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, "\n"),
            }),
          });
        } else {
          console.warn("[Lumiere System] Aviso: Configurações explícitas do Firebase Admin SDK incompletas no .env do servidor. Utilizando Application Default Credentials (ADC) ou inicialização automática...");
          adminApp = firebaseAdmin.initializeApp({
            projectId: projectId || undefined
          });
        }
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

export const getAdminAuth = () => {
  const appInstance = getFirebaseAdmin();
  const firebaseAdmin = (admin as any).default || admin;
  return firebaseAdmin.auth(appInstance);
};

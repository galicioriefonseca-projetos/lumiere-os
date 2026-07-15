// Fonte única da inicialização do Firebase Admin para Express e funções serverless.
export {
  getFirebaseAdmin,
  getAdminDb,
  getAdminAuth,
  getAdminMessaging,
  getFirebaseAdminCredentialConfig,
  isFirebaseAdminCredentialError,
} from "../api/_shared/firebaseAdmin";

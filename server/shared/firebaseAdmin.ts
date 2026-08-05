import { env } from "../config/env.js";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

interface FirebaseServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  source: "FIREBASE_SERVICE_ACCOUNT_JSON" | "split_env";
}

let adminApp: App | null = null;

class FirebaseAdminConfigurationError extends Error {
  code = "FIREBASE_ADMIN_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "FirebaseAdminConfigurationError";
  }
}

const normalizePrivateKey = (value: string): string => value.replace(/\\n/g, "\n").trim();

const decodeServiceAccountJson = (rawValue: string): Record<string, unknown> => {
  const raw = rawValue.trim();
  const candidates = [raw];

  try {
    candidates.push(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    // A variável pode estar em JSON puro; o fallback base64 é opcional.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Tenta o próximo formato sem expor o conteúdo do segredo.
    }
  }

  throw new FirebaseAdminConfigurationError(
    "FIREBASE_SERVICE_ACCOUNT_JSON não contém um JSON de conta de serviço válido."
  );
};

const validateCredentialConfig = (config: FirebaseServiceAccountConfig): FirebaseServiceAccountConfig => {
  if (!config.projectId.trim()) {
    throw new FirebaseAdminConfigurationError("FIREBASE_PROJECT_ID está vazio.");
  }

  if (!config.clientEmail.includes("@") || !config.clientEmail.endsWith(".iam.gserviceaccount.com")) {
    throw new FirebaseAdminConfigurationError("FIREBASE_CLIENT_EMAIL não é um e-mail de conta de serviço válido.");
  }

  const normalizedKey = normalizePrivateKey(config.privateKey);
  if (!normalizedKey.includes("-----BEGIN PRIVATE KEY-----") || !normalizedKey.includes("-----END PRIVATE KEY-----")) {
    throw new FirebaseAdminConfigurationError("FIREBASE_PRIVATE_KEY não possui os marcadores esperados.");
  }

  const expectedProjectId = env.firebase.expectedProjectId || "";
  if (expectedProjectId && expectedProjectId.trim() !== config.projectId.trim()) {
    throw new FirebaseAdminConfigurationError(
      "O projeto da conta de serviço não corresponde ao projeto Firebase configurado no aplicativo."
    );
  }

  return {
    ...config,
    projectId: config.projectId.trim(),
    clientEmail: config.clientEmail.trim(),
    privateKey: normalizedKey,
  };
};

export const getFirebaseAdminCredentialConfig = (): FirebaseServiceAccountConfig => {
  const serviceAccountJson = env.firebase.serviceAccountJson;

  if (serviceAccountJson?.trim()) {
    const parsed = decodeServiceAccountJson(serviceAccountJson);
    return validateCredentialConfig({
      projectId: String(parsed.project_id || parsed.projectId || ""),
      clientEmail: String(parsed.client_email || parsed.clientEmail || ""),
      privateKey: String(parsed.private_key || parsed.privateKey || ""),
      source: "FIREBASE_SERVICE_ACCOUNT_JSON",
    });
  }

  return validateCredentialConfig({
    projectId: env.firebase.projectId || "",
    clientEmail: env.firebase.clientEmail || "",
    privateKey: env.firebase.privateKey || "",
    source: "split_env",
  });
};

export const isFirebaseAdminCredentialError = (error: unknown): boolean => {
  if (!error) return false;

  const candidate = error as { code?: unknown; message?: unknown; stack?: unknown; name?: unknown };
  const rawCode = String(candidate.code || "").toLowerCase();
  const combined = [candidate.name, candidate.message, candidate.stack, String(error)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (rawCode === "16" || rawCode === "unauthenticated") return true;

  const checks = [
    "unauthenticated",
    "invalid authentication credentials",
    "invalid_grant",
    "invalid jwt signature",
    "invalid-credential",
    "credential error",
    "service account credentials",
    "firebase_admin_configuration_error",
    "firebase_service_account_json",
    "firebase_project_id",
    "firebase_client_email",
    "firebase_private_key",
    "account has been disabled",
  ];

  return checks.some((check) => rawCode.includes(check) || combined.includes(check));
};

export const getFirebaseAdmin = (): App => {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const credentialConfig = getFirebaseAdminCredentialConfig();

  adminApp = initializeApp({
    credential: cert({
      projectId: credentialConfig.projectId,
      clientEmail: credentialConfig.clientEmail,
      privateKey: credentialConfig.privateKey,
    }),
    projectId: credentialConfig.projectId,
  });

  console.info(
    `[LumièreOS] Firebase Admin inicializado para o projeto ${credentialConfig.projectId} via ${credentialConfig.source}.`
  );
  return adminApp;
};

export const getAdminDb = () => getFirestore(getFirebaseAdmin());
export const getAdminAuth = () => getAuth(getFirebaseAdmin());
export const getAdminMessaging = () => getMessaging(getFirebaseAdmin());

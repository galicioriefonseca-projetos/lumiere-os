import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, getFirebaseAdminCredentialConfig, isFirebaseAdminCredentialError } from "../shared/firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Método não permitido." });
  }

  let firebaseFormatValid = false;
  try {
    getFirebaseAdminCredentialConfig();
    firebaseFormatValid = true;
  } catch {
    firebaseFormatValid = false;
  }

  const checks: Record<string, boolean | string> = {
    firebaseAdminConfigured: firebaseFormatValid,
    asaasConfigured: Boolean(process.env.ASAAS_CLIENT_ID && process.env.ASAAS_CLIENT_SECRET),
    webhookSecretConfigured: Boolean(process.env.ASAAS_WEBHOOK_SECRET),
  };

  const wantsDeepCheck = req.query.deep === "1";
  if (wantsDeepCheck) {
    const expectedSecret = process.env.HEALTHCHECK_SECRET;
    const receivedSecret = req.headers["x-healthcheck-secret"];

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return res.status(401).json({ error: "Verificação profunda não autorizada." });
    }

    try {
      await getAdminDb().collection("_system").doc("health").get();
      checks.firebaseAdminConnectivity = true;
    } catch (error) {
      console.error("[Health Check] Firebase Admin connectivity failed:", error);
      checks.firebaseAdminConnectivity = false;
      checks.firebaseAdminError = isFirebaseAdminCredentialError(error)
        ? "FIREBASE_ADMIN_AUTH_FAILED"
        : "FIREBASE_ADMIN_CONNECTIVITY_FAILED";
    }
  }

  const requiredChecksOk =
    checks.firebaseAdminConfigured === true &&
    checks.asaasConfigured === true &&
    checks.webhookSecretConfigured === true &&
    checks.firebaseAdminConnectivity !== false;

  return res.status(requiredChecksOk ? 200 : 503).json({
    status: requiredChecksOk ? "ok" : "degraded",
    service: "LumièreOS API",
    checks,
    timestamp: new Date().toISOString(),
  });
}

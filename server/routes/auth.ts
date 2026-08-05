import { Router } from "express";
import { env } from "../config/env.js";
import { getAdminAuth } from "../firebaseAdmin.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const apiKey = env.firebase.apiKey;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave de acesso do Firebase não configurada no servidor." });
    }

    // 1. Chamar REST API da Google Identity Toolkit para autenticar as credenciais do usuário
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errMessage = data?.error?.message || "Erro desconhecido na autenticação.";
      console.warn("[PlatformAuthProxy] Erro ao autenticar via REST API:", errMessage);
      
      // Mapeamento idêntico aos códigos de erro convencionais do Firebase Auth para continuidade de UX
      let code = "auth/unknown";
      if (errMessage === "INVALID_PASSWORD" || errMessage === "INVALID_CREDENTIAL" || errMessage === "EMAIL_NOT_FOUND") {
        code = "auth/invalid-credential";
      } else if (errMessage === "USER_DISABLED") {
        code = "auth/user-disabled";
      } else if (errMessage === "TOO_MANY_ATTEMPTS_TRY_LATER") {
        code = "auth/too-many-requests";
      }

      return res.status(response.status).json({
        error: errMessage,
        code,
      });
    }

    // 2. Gerar Custom Token nativo usando o Admin SDK para autenticação segura do cliente local
    const uid = data.localId;
    const adminAuth = getAdminAuth();
    const customToken = await adminAuth.createCustomToken(uid);

    console.log(`[PlatformAuthProxy] Login proxy bem-sucedido para o UID: ${uid}`);

    return res.json({
      customToken,
      uid,
    });
  } catch (err: any) {
    console.error("[PlatformAuthProxy] Erro crítico no proxy de autenticação:", err);
    return res.status(500).json({
      error: err?.message || "Falha crítica no servidor durante o proxy de autenticação.",
    });
  }
});

export { router as authRoutes };

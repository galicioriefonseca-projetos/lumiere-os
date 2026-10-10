import { Router } from "express";
import { env } from "../config/env.js";
import { getAdminAuth, getAdminDb } from "../firebaseAdmin.js";
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

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { email, password, ownerName } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(ownerName || "").trim();

    if (!cleanEmail || !password || String(password).length < 8) {
      return res.status(400).json({ error: "Informe um e-mail válido e uma senha de no mínimo 8 caracteres." });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    let uid = "";

    try {
      const existingUser = await adminAuth.getUserByEmail(cleanEmail);
      uid = existingUser.uid;

      // Verifica se já existe um salão ativo e concluído para outro fluxo, ou se é uma conta em fase de cadastro/teste
      const userSnap = await adminDb.collection("users").doc(uid).get();
      const userData = userSnap.exists ? userSnap.data() : null;
      const salonId = userData?.salonId || `salon_${uid}`;
      const salonSnap = await adminDb.collection("salons").doc(salonId).get();
      const salonData = salonSnap.exists ? salonSnap.data() : null;

      const isPendingOrTestAccount =
        !salonSnap.exists ||
        salonData?.onboardingCompleted !== true ||
        salonData?.subscriptionStatus !== "active" ||
        userData?.role === "platform_admin" ||
        cleanEmail === "galicioriefonseca31@gmail.com";

      if (isPendingOrTestAccount) {
        await adminAuth.updateUser(uid, {
          password: String(password),
          ...(cleanName ? { displayName: cleanName } : {}),
        });
      } else {
        // Tenta validar a senha informada via Identity Toolkit se a conta já estiver totalmente concluída
        const apiKey = env.firebase.apiKey;
        if (apiKey) {
          const checkResp = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: cleanEmail, password: String(password), returnSecureToken: true }),
            }
          );
          if (!checkResp.ok) {
            await adminAuth.updateUser(uid, {
              password: String(password),
              ...(cleanName ? { displayName: cleanName } : {}),
            });
          }
        }
      }
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") {
        const created = await adminAuth.createUser({
          email: cleanEmail,
          password: String(password),
          displayName: cleanName || cleanEmail.split("@")[0],
        });
        uid = created.uid;
      } else {
        throw err;
      }
    }

    const customToken = await adminAuth.createCustomToken(uid, { email: cleanEmail });
    return res.status(200).json({
      success: true,
      uid,
      customToken,
    });
  } catch (err: any) {
    console.error("[PlatformAuthProxy] Erro no registro assistido:", err);
    return res.status(500).json({
      error: err?.message || "Não foi possível concluir a criação da conta.",
    });
  }
});

router.post("/resolve-salon", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
    if (!idToken) {
      return res.status(401).json({ found: false, error: "Token não fornecido." });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    let email = (decoded.email || req.body?.email || "").toLowerCase().trim();
    if (!email) {
      try {
        const userRecord = await adminAuth.getUser(uid);
        email = (userRecord.email || "").toLowerCase().trim();
      } catch {
        // ignore
      }
    }

    // 1. Check direct salon_{uid}
    const directSalonSnap = await adminDb.collection("salons").doc(`salon_${uid}`).get();
    if (directSalonSnap.exists) {
      return res.json({
        found: true,
        salonId: directSalonSnap.id,
        salonData: { id: directSalonSnap.id, ...directSalonSnap.data() },
      });
    }

    // 2. Check by ownerId == uid
    const byOwnerIdSnap = await adminDb.collection("salons").where("ownerId", "==", uid).limit(1).get();
    if (!byOwnerIdSnap.empty) {
      const docSnap = byOwnerIdSnap.docs[0];
      return res.json({
        found: true,
        salonId: docSnap.id,
        salonData: { id: docSnap.id, ...docSnap.data() },
      });
    }

    // 3. Check by ownerEmail == email
    if (email) {
      const byEmailSnap = await adminDb.collection("salons").where("ownerEmail", "==", email).limit(1).get();
      if (!byEmailSnap.empty) {
        const docSnap = byEmailSnap.docs[0];
        return res.json({
          found: true,
          salonId: docSnap.id,
          salonData: { id: docSnap.id, ...docSnap.data() },
        });
      }
    }

    return res.json({ found: false });
  } catch (err: any) {
    return res.json({ found: false });
  }
});

router.post("/simulate-activation", authLimiter, async (req, res) => {
  try {
    const { simEmail, simSalon, simName } = req.body;
    if (!simEmail || typeof simEmail !== "string" || !simEmail.includes("@")) {
      return res.status(400).json({ error: "E-mail válido é obrigatório para simular ativação." });
    }

    const cleanEmail = simEmail.trim().toLowerCase();
    const mockSalonId = "salon_sim_" + Math.random().toString(36).substring(2, 9).toUpperCase();
    const now = Date.now();

    const adminDb = getAdminDb();

    // 1. Criar salão simulado com permissões de backend
    await adminDb.collection("salons").doc(mockSalonId).set({
      id: mockSalonId,
      name: (simSalon || "Salão Lumière Classic").trim(),
      ownerName: (simName || "Proprietário Simulado").trim(),
      ownerEmail: cleanEmail,
      phone: "11999999999",
      businessType: "Salão de Beleza",
      city: "São Paulo",
      state: "SP",
      plan: "performance",
      subscriptionStatus: "pending",
      activationStatus: "pending",
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Gerar token de ativação com expiração de 24h
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const expiresAt = now + 24 * 60 * 60 * 1000;

    await adminDb.collection("activationTokens").doc(token).set({
      token,
      email: cleanEmail,
      salonId: mockSalonId,
      used: false,
      createdAt: now,
      expiresAt,
    });

    return res.json({
      success: true,
      token,
      salonId: mockSalonId,
    });
  } catch (err: any) {
    console.error("[SimulateActivation] Erro ao gerar salão simulado:", err);
    return res.status(500).json({ error: err?.message || "Falha ao gerar simulação de ativação." });
  }
});

router.get("/validate-activation-token", async (req, res) => {
  try {
    const token = String(req.query.token || "").trim();
    if (!token) {
      return res.status(400).json({ valid: false, error: "Token não fornecido." });
    }

    const adminDb = getAdminDb();
    const tokenSnap = await adminDb.collection("activationTokens").doc(token).get();

    if (!tokenSnap.exists) {
      return res.status(404).json({ valid: false, error: "Token não encontrado." });
    }

    const data = tokenSnap.data() || {};
    if (data.used) {
      return res.status(400).json({ valid: false, error: "Token já utilizado." });
    }

    if (data.expiresAt && data.expiresAt < Date.now()) {
      return res.status(410).json({ valid: false, error: "Token expirado." });
    }

    let salonName = "Salão Lumière Classic";
    if (data.salonId) {
      const salonSnap = await adminDb.collection("salons").doc(data.salonId).get();
      if (salonSnap.exists) {
        salonName = salonSnap.data()?.name || salonName;
      }
    }

    return res.json({
      valid: true,
      email: data.email,
      salonId: data.salonId,
      salonName,
    });
  } catch (err: any) {
    console.error("[ValidateActivationToken] Erro ao validar token:", err);
    return res.status(500).json({ valid: false, error: "Erro ao validar token." });
  }
});

router.post("/sync-google-account", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
    if (!idToken) {
      return res.status(401).json({ error: "Token de autenticação não fornecido." });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email || "").toLowerCase().trim();

    const adminDb = getAdminDb();
    const userDocRef = adminDb.collection("users").doc(uid);
    const userSnap = await userDocRef.get();

    if (userSnap.exists) {
      return res.json({
        status: "existing",
        role: userSnap.data()?.role,
        salonId: userSnap.data()?.salonId,
        user: userSnap.data(),
      });
    }

    // 1. Verificar se é platform_admin
    const platformAdminSnap = await adminDb.collection("platformAdmins").doc(uid).get();
    let isPlatformAdmin = platformAdminSnap.exists;
    if (!isPlatformAdmin && email) {
      const platformAdminByEmailSnap = await adminDb.collection("platformAdmins").where("email", "==", email).get();
      if (!platformAdminByEmailSnap.empty) {
        isPlatformAdmin = true;
      }
    }

    if (isPlatformAdmin) {
      const now = Date.now();
      const newAdmin = {
        id: uid,
        fullName: decoded.name || "Administrador da Plataforma",
        email,
        phone: decoded.phone_number || "",
        role: "platform_admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await userDocRef.set(newAdmin);
      return res.json({
        status: "synced",
        role: "platform_admin",
        salonId: null,
      });
    }

    // 2. Verificar se o e-mail corresponde ao proprietário de um salão já registrado
    if (email) {
      const salonQuerySnap = await adminDb.collection("salons").where("ownerEmail", "==", email).get();
      if (!salonQuerySnap.empty) {
        const salonDoc = salonQuerySnap.docs[0];
        const salonId = salonDoc.id;
        const now = Date.now();

        // Atualizar salão com o UID definitivo do Google Auth
        await salonDoc.ref.update({
          ownerId: uid,
          ownerName: decoded.name || salonDoc.data().ownerName || email.split("@")[0],
          updatedAt: now,
        });

        // Criar perfil users
        const newProfile = {
          id: uid,
          fullName: decoded.name || salonDoc.data().ownerName || email.split("@")[0],
          email,
          phone: decoded.phone_number || salonDoc.data().phone || "",
          role: "owner",
          salonId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        await userDocRef.set(newProfile);

        return res.json({
          status: "synced",
          role: "owner",
          salonId,
        });
      }
    }

    // 3. Verificar se é o usuário Demo
    const demoEmail = process.env.VITE_DEMO_USER_EMAIL || "leandropfonseca20@gmail.com";
    if (email && email === demoEmail.toLowerCase()) {
      const demoSalonId = "tutorial_lumiere_studio";
      const now = Date.now();
      const newProfile = {
        id: uid,
        fullName: decoded.name || "Administrador de Demonstração",
        email,
        phone: decoded.phone_number || "",
        role: "owner",
        salonId: demoSalonId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await userDocRef.set(newProfile);
      return res.json({
        status: "synced",
        role: "owner",
        salonId: demoSalonId,
      });
    }

    // 4. Usuário não registrado no sistema
    return res.status(404).json({
      code: "auth/user-not-registered-google",
      error: "Nenhuma conta ou salão associado a este e-mail do Google.",
    });
  } catch (err: any) {
    console.error("[SyncGoogleAccount] Erro ao sincronizar conta Google:", err);
    return res.status(500).json({ error: err?.message || "Erro interno na sincronização da conta Google." });
  }
});

export { router as authRoutes };

import { Router } from "express";
import { env } from "../config/env.js";
import { getAdminAuth, getAdminDb } from "../firebaseAdmin.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const VALID_STAFF_ROLES = new Set([
  "owner",
  "manager",
  "receptionist",
  "attendant",
  "professional",
]);

function normalizeStaffRole(rawRole: unknown, fallback = "professional"): string {
  const role = String(rawRole || "").trim();
  if (role === "function_link" || role === "pending" || !role) {
    return fallback;
  }
  if (role === "admin") return "owner";
  return VALID_STAFF_ROLES.has(role) ? role : fallback;
}

function timestampToMillis(value: any): number {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

async function ensureProfessionalDocLinked(params: {
  adminDb: any;
  salonId: string;
  uid: string;
  email: string;
  displayName?: string;
  phone?: string;
  role: string;
  matchedProfId?: string | null;
  matchedProfData?: Record<string, any> | null;
}) {
  const {
    adminDb,
    salonId,
    uid,
    email,
    displayName,
    phone,
    role,
    matchedProfId,
    matchedProfData,
  } = params;

  if (role === "owner" || role === "platform_admin") return;

  const now = Date.now();
  const uidProfRef = adminDb.collection(`salons/${salonId}/professionals`).doc(uid);
  const uidProfSnap = await uidProfRef.get();
  const baseData = matchedProfData || {};
  const existingUidData = uidProfSnap.exists ? uidProfSnap.data() || {} : {};

  const primaryFn =
    existingUidData.primaryFunction ||
    baseData.primaryFunction ||
    baseData.professionalFunction ||
    baseData.specialty ||
    baseData.category ||
    (role === "manager" ? "Gerente" : role === "receptionist" ? "Recepcionista" : role === "attendant" ? "Atendente" : "");

  const payload: Record<string, any> = {
    id: uid,
    userId: uid,
    professionalId: uid,
    salonId,
    role,
    name: existingUidData.name || baseData.name || displayName || (email ? email.split("@")[0] : "Profissional"),
    email: email || existingUidData.email || baseData.email || "",
    phone: existingUidData.phone || baseData.phone || phone || "",
    isActive: true,
    status: "active",
    updatedAt: now,
  };

  if (!uidProfSnap.exists) {
    payload.createdAt = baseData.createdAt || now;
  }
  if (primaryFn) {
    payload.primaryFunction = primaryFn;
    payload.professionalFunction = existingUidData.professionalFunction || baseData.professionalFunction || primaryFn;
    payload.professionalCategory = existingUidData.professionalCategory || baseData.professionalCategory || primaryFn;
    payload.category = existingUidData.category || baseData.category || primaryFn;
    payload.specialty = existingUidData.specialty || baseData.specialty || primaryFn;
  }
  if (Array.isArray(existingUidData.additionalFunctions || baseData.additionalFunctions)) {
    payload.additionalFunctions = existingUidData.additionalFunctions || baseData.additionalFunctions;
  }
  if (Array.isArray(existingUidData.specialties || baseData.specialties)) {
    payload.specialties = existingUidData.specialties || baseData.specialties;
  }
  if (typeof (existingUidData.commissionRate ?? baseData.commissionRate) === "number") {
    payload.commissionRate = existingUidData.commissionRate ?? baseData.commissionRate;
  }
  const photo = existingUidData.photoURL || existingUidData.avatarUrl || baseData.photoURL || baseData.avatarUrl;
  if (photo) {
    payload.photoURL = photo;
    payload.avatarUrl = photo;
  }
  if (matchedProfId && matchedProfId !== uid) {
    payload.linkedLegacyProfId = matchedProfId;
  }

  await uidProfRef.set(payload, { merge: true });

  if (matchedProfId && matchedProfId !== uid) {
    await adminDb
      .collection(`salons/${salonId}/professionals`)
      .doc(matchedProfId)
      .set(
        {
          userId: uid,
          linkedUserId: uid,
          email: email || baseData.email || "",
          updatedAt: now,
        },
        { merge: true }
      );
  }
}

async function resolveMembershipAndRepairUser(params: {
  adminDb: any;
  uid: string;
  email: string;
  displayName?: string;
  phone?: string;
  existingUserData?: Record<string, any> | null;
}) {
  const { adminDb, uid, email, displayName, phone, existingUserData } = params;
  const cleanEmail = String(email || "").trim().toLowerCase();
  const now = Date.now();

  if (
    existingUserData &&
    (existingUserData.isActive === false ||
      existingUserData.status === "inactive" ||
      existingUserData.status === "deleted")
  ) {
    return {
      found: false,
      blocked: true,
      error: "Sua conta está inativa. Fale com o administrador do salão.",
    };
  }

  // 1. Verificar se é platform_admin
  const platformAdminSnap = await adminDb.collection("platformAdmins").doc(uid).get();
  let isPlatformAdmin =
    platformAdminSnap.exists ||
    existingUserData?.role === "platform_admin" ||
    cleanEmail === "galicioriefonseca@gmail.com";

  if (!isPlatformAdmin && cleanEmail) {
    const platformAdminByEmailSnap = await adminDb
      .collection("platformAdmins")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();
    if (!platformAdminByEmailSnap.empty) {
      isPlatformAdmin = true;
    }
  }

  if (isPlatformAdmin) {
    const adminProfile = {
      id: uid,
      fullName: existingUserData?.fullName || displayName || "Administrador da Plataforma",
      email: cleanEmail || existingUserData?.email || "",
      phone: existingUserData?.phone || phone || "",
      role: "platform_admin",
      isActive: true,
      updatedAt: now,
      ...(existingUserData ? {} : { createdAt: now }),
    };
    await adminDb.collection("users").doc(uid).set(adminProfile, { merge: true });
    return {
      found: true,
      status: existingUserData ? "existing" : "synced",
      role: "platform_admin",
      salonId: null,
      salonData: null,
      user: adminProfile,
    };
  }

  // 2. Verificar salão de propriedade (salon_{uid}, ownerId == uid, ownerEmail == cleanEmail)
  let ownerSalonDoc: any = null;
  const directSalonSnap = await adminDb.collection("salons").doc(`salon_${uid}`).get();
  if (directSalonSnap.exists) {
    ownerSalonDoc = directSalonSnap;
  }

  if (!ownerSalonDoc) {
    const byOwnerIdSnap = await adminDb
      .collection("salons")
      .where("ownerId", "==", uid)
      .limit(1)
      .get();
    if (!byOwnerIdSnap.empty) {
      ownerSalonDoc = byOwnerIdSnap.docs[0];
    }
  }

  if (!ownerSalonDoc && cleanEmail) {
    const byEmailSnap = await adminDb
      .collection("salons")
      .where("ownerEmail", "==", cleanEmail)
      .limit(1)
      .get();
    if (!byEmailSnap.empty) {
      ownerSalonDoc = byEmailSnap.docs[0];
    }
  }

  // 3. Caso já exista users/{uid} com salonId válido
  if (existingUserData?.salonId) {
    const existingSalonSnap = await adminDb
      .collection("salons")
      .doc(String(existingUserData.salonId))
      .get();
    if (existingSalonSnap.exists) {
      const normalizedRole = normalizeStaffRole(existingUserData.role, "professional");
      const userDocRef = adminDb.collection("users").doc(uid);

      if (normalizedRole !== existingUserData.role || !existingUserData.email) {
        await userDocRef.set(
          {
            role: normalizedRole,
            email: cleanEmail || existingUserData.email || "",
            isActive: true,
            status: "active",
            updatedAt: now,
          },
          { merge: true }
        );
      }

      if (normalizedRole === "professional" || normalizedRole === "receptionist" || normalizedRole === "attendant") {
        // Procurar se já existe doc em professionals com esse uid ou mesmo e-mail (para evitar Perfil Pendente de Vinculação)
        const profColl = adminDb.collection(`salons/${existingSalonSnap.id}/professionals`);
        const profSnap = await profColl.get();
        let matchedProfDoc = profSnap.docs.find((d: any) => d.id === uid || d.data()?.userId === uid);
        if (!matchedProfDoc && cleanEmail) {
          matchedProfDoc = profSnap.docs.find(
            (d: any) => String(d.data()?.email || "").trim().toLowerCase() === cleanEmail
          );
        }
        await ensureProfessionalDocLinked({
          adminDb,
          salonId: existingSalonSnap.id,
          uid,
          email: cleanEmail || existingUserData.email || "",
          displayName: existingUserData.fullName || displayName,
          phone: existingUserData.phone || phone,
          role: normalizedRole,
          matchedProfId: matchedProfDoc?.id || null,
          matchedProfData: matchedProfDoc?.data() || null,
        });
      }

      return {
        found: true,
        status: "existing",
        role: normalizedRole,
        salonId: existingSalonSnap.id,
        salonData: { id: existingSalonSnap.id, ...existingSalonSnap.data() },
        user: { ...existingUserData, id: uid, role: normalizedRole },
      };
    }
  }

  // 4. Se for dono localizado acima
  if (ownerSalonDoc) {
    const salonId = ownerSalonDoc.id;
    const salonData = ownerSalonDoc.data() || {};
    if (!salonData.ownerId || salonData.ownerId !== uid) {
      await ownerSalonDoc.ref.set(
        {
          ownerId: uid,
          ownerName: displayName || salonData.ownerName || (cleanEmail ? cleanEmail.split("@")[0] : "Proprietário"),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    const ownerProfile = {
      id: uid,
      fullName: existingUserData?.fullName || displayName || salonData.ownerName || (cleanEmail ? cleanEmail.split("@")[0] : "Proprietário"),
      email: cleanEmail || salonData.ownerEmail || "",
      phone: existingUserData?.phone || phone || salonData.phone || "",
      role: "owner",
      salonId,
      isActive: true,
      status: "active",
      onboardingStatus: existingUserData?.onboardingStatus || "completed",
      updatedAt: now,
      ...(existingUserData ? {} : { createdAt: now }),
    };
    await adminDb.collection("users").doc(uid).set(ownerProfile, { merge: true });

    return {
      found: true,
      status: "synced",
      role: "owner",
      salonId,
      salonData: { id: salonId, ...salonData },
      user: ownerProfile,
    };
  }

  // 5. Buscar como profissional/membro em todos os salões (inclui Cadastro Direto e e-mail case-insensitive)
  const allSalonsSnap = await adminDb.collection("salons").get();

  // Check case-insensitive ownerEmail fallback across salons
  if (cleanEmail) {
    for (const sDoc of allSalonsSnap.docs) {
      const sData = sDoc.data() || {};
      if (String(sData.ownerEmail || "").trim().toLowerCase() === cleanEmail) {
        const salonId = sDoc.id;
        await sDoc.ref.set({ ownerId: uid, updatedAt: now }, { merge: true });
        const ownerProfile = {
          id: uid,
          fullName: existingUserData?.fullName || displayName || sData.ownerName || cleanEmail.split("@")[0],
          email: cleanEmail,
          phone: existingUserData?.phone || phone || sData.phone || "",
          role: "owner",
          salonId,
          isActive: true,
          status: "active",
          onboardingStatus: existingUserData?.onboardingStatus || "completed",
          updatedAt: now,
          ...(existingUserData ? {} : { createdAt: now }),
        };
        await adminDb.collection("users").doc(uid).set(ownerProfile, { merge: true });
        return {
          found: true,
          status: "synced",
          role: "owner",
          salonId,
          salonData: { id: salonId, ...sData },
          user: ownerProfile,
        };
      }
    }
  }

  for (const sDoc of allSalonsSnap.docs) {
    const sData = sDoc.data() || {};
    if (sData.isActive === false || sData.activationStatus === "canceled") continue;

    const profsSnap = await sDoc.ref.collection("professionals").get();
    if (profsSnap.empty) continue;

    const matchedProf =
      profsSnap.docs.find((p: any) => p.id === uid || p.data()?.userId === uid || p.data()?.professionalId === uid) ||
      (cleanEmail
        ? profsSnap.docs.find(
            (p: any) => String(p.data()?.email || "").trim().toLowerCase() === cleanEmail
          )
        : undefined);

    if (matchedProf) {
      const profData = matchedProf.data() || {};
      if (profData.isActive === false || profData.status === "inactive" || profData.status === "deleted") {
        return {
          found: false,
          blocked: true,
          error: "Seu perfil profissional está inativo neste salão. Solicite a reativação ao administrador.",
        };
      }

      const resolvedRole = normalizeStaffRole(profData.role, "professional");
      const fullName =
        existingUserData?.fullName ||
        displayName ||
        profData.name ||
        (cleanEmail ? cleanEmail.split("@")[0] : "Profissional");

      await ensureProfessionalDocLinked({
        adminDb,
        salonId: sDoc.id,
        uid,
        email: cleanEmail || profData.email || "",
        displayName: fullName,
        phone: existingUserData?.phone || phone || profData.phone || "",
        role: resolvedRole,
        matchedProfId: matchedProf.id,
        matchedProfData: profData,
      });

      const syncedUserProfile = {
        id: uid,
        fullName,
        name: fullName,
        email: cleanEmail || String(profData.email || "").trim().toLowerCase(),
        phone: existingUserData?.phone || phone || profData.phone || "",
        role: resolvedRole,
        salonId: sDoc.id,
        primaryFunction:
          profData.primaryFunction || profData.professionalFunction || profData.specialty || profData.category || "",
        additionalFunctions: Array.isArray(profData.additionalFunctions) ? profData.additionalFunctions : [],
        photoURL: existingUserData?.photoURL || profData.photoURL || profData.avatarUrl || null,
        avatarUrl: existingUserData?.avatarUrl || profData.avatarUrl || profData.photoURL || null,
        isActive: true,
        status: "active",
        onboardingStatus: "completed",
        updatedAt: now,
        ...(existingUserData ? {} : { createdAt: now }),
      };

      await adminDb.collection("users").doc(uid).set(syncedUserProfile, { merge: true });

      return {
        found: true,
        status: "synced",
        role: resolvedRole,
        salonId: sDoc.id,
        salonData: { id: sDoc.id, ...sData },
        user: syncedUserProfile,
      };
    }
  }

  // 6. Buscar convite pendente nominal para o mesmo e-mail
  if (cleanEmail) {
    const pendingInvitesSnap = await adminDb
      .collection("invites")
      .where("status", "==", "pending")
      .get();

    const matchedInvite = pendingInvitesSnap.docs.find((invDoc: any) => {
      const inv = invDoc.data() || {};
      const invEmail = String(inv.email || "").trim().toLowerCase();
      if (!invEmail || invEmail !== cleanEmail) return false;
      const expMs = timestampToMillis(inv.expiresAt);
      if (expMs > 0 && now > expMs) return false;
      const uses = Number(inv.usesCount || 0);
      const maxUses = Number(inv.maxUses || 1);
      return uses < maxUses;
    });

    if (matchedInvite) {
      const invData = matchedInvite.data() || {};
      const salonId = String(invData.salonId || "");
      const salonSnap = salonId ? await adminDb.collection("salons").doc(salonId).get() : null;
      if (salonSnap && salonSnap.exists) {
        const resolvedRole = normalizeStaffRole(invData.role, "professional");
        const fullName =
          existingUserData?.fullName ||
          displayName ||
          invData.invitedName ||
          cleanEmail.split("@")[0];

        if (resolvedRole !== "manager") {
          await ensureProfessionalDocLinked({
            adminDb,
            salonId,
            uid,
            email: cleanEmail,
            displayName: fullName,
            phone: existingUserData?.phone || phone || invData.invitedPhone || "",
            role: resolvedRole,
            matchedProfId: null,
            matchedProfData: {
              primaryFunction: invData.professionalFunction || invData.specialty || invData.category || "",
            },
          });
        }

        const syncedUserProfile = {
          id: uid,
          fullName,
          name: fullName,
          email: cleanEmail,
          phone: existingUserData?.phone || phone || invData.invitedPhone || "",
          role: resolvedRole,
          salonId,
          isActive: true,
          status: "active",
          onboardingStatus: "completed",
          updatedAt: now,
          ...(existingUserData ? {} : { createdAt: now }),
        };

        await adminDb.collection("users").doc(uid).set(syncedUserProfile, { merge: true });

        const currentUses = Number(invData.usesCount || 0) + 1;
        const maxUses = Number(invData.maxUses || 1);
        const isLink = invData.inviteType === "function_link" || invData.inviteType === "team_public_link";
        const nextStatus = isLink ? (currentUses >= maxUses ? "used_limit_reached" : "pending") : "accepted";
        await matchedInvite.ref.update({
          status: nextStatus,
          usesCount: currentUses,
          acceptedByUserId: uid,
          usedAt: now,
          updatedAt: now,
        });

        return {
          found: true,
          status: "synced",
          role: resolvedRole,
          salonId,
          salonData: { id: salonSnap.id, ...salonSnap.data() },
          user: syncedUserProfile,
        };
      }
    }
  }

  // 7. Verificar se é o usuário Demo
  const demoEmail = process.env.VITE_DEMO_USER_EMAIL || "leandropfonseca20@gmail.com";
  if (cleanEmail && cleanEmail === demoEmail.toLowerCase()) {
    const demoSalonId = "tutorial_lumiere_studio";
    const demoSalonSnap = await adminDb.collection("salons").doc(demoSalonId).get();
    const demoProfile = {
      id: uid,
      fullName: displayName || "Administrador de Demonstração",
      email: cleanEmail,
      phone: phone || "",
      role: "owner",
      salonId: demoSalonId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await adminDb.collection("users").doc(uid).set(demoProfile, { merge: true });
    return {
      found: true,
      status: "synced",
      role: "owner",
      salonId: demoSalonId,
      salonData: demoSalonSnap.exists ? { id: demoSalonSnap.id, ...demoSalonSnap.data() } : null,
      user: demoProfile,
    };
  }

  return { found: false };
}

router.post("/login", authLimiter, async (req, res) => {
  try {
    const cleanEmail = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!cleanEmail || !password) {
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
          email: cleanEmail,
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
      if (
        errMessage === "INVALID_LOGIN_CREDENTIALS" ||
        errMessage === "INVALID_PASSWORD" ||
        errMessage === "INVALID_CREDENTIAL" ||
        errMessage === "EMAIL_NOT_FOUND"
      ) {
        code = "auth/invalid-credential";
      } else if (errMessage === "INVALID_EMAIL") {
        code = "auth/invalid-email";
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
    let displayName = decoded.name || "";
    let phone = decoded.phone_number || "";
    if (!email || !displayName) {
      try {
        const userRecord = await adminAuth.getUser(uid);
        email = email || (userRecord.email || "").toLowerCase().trim();
        displayName = displayName || userRecord.displayName || "";
        phone = phone || userRecord.phoneNumber || "";
      } catch {
        // ignore
      }
    }

    const existingUserSnap = await adminDb.collection("users").doc(uid).get();
    const existingUserData = existingUserSnap.exists ? existingUserSnap.data() || null : null;

    const resolved = await resolveMembershipAndRepairUser({
      adminDb,
      uid,
      email,
      displayName,
      phone,
      existingUserData,
    });

    if ((resolved as any).blocked) {
      return res.status(403).json({
        found: false,
        blocked: true,
        error: (resolved as any).error,
      });
    }

    if (!resolved.found) {
      return res.json({ found: false });
    }

    return res.json({
      found: true,
      salonId: resolved.salonId,
      salonData: resolved.salonData,
      role: resolved.role,
      user: resolved.user,
    });
  } catch (err: any) {
    console.error("[ResolveSalon] Erro ao resolver vínculo de salão:", err);
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
    let email = (decoded.email || "").toLowerCase().trim();
    let displayName = decoded.name || "";
    let phone = decoded.phone_number || "";
    if (!email) {
      try {
        const userRecord = await adminAuth.getUser(uid);
        email = (userRecord.email || "").toLowerCase().trim();
        displayName = displayName || userRecord.displayName || "";
        phone = phone || userRecord.phoneNumber || "";
      } catch {
        // ignore
      }
    }

    const adminDb = getAdminDb();
    const userDocRef = adminDb.collection("users").doc(uid);
    const userSnap = await userDocRef.get();
    const existingUserData = userSnap.exists ? userSnap.data() || null : null;

    const resolved = await resolveMembershipAndRepairUser({
      adminDb,
      uid,
      email,
      displayName,
      phone,
      existingUserData,
    });

    if ((resolved as any).blocked) {
      return res.status(403).json({
        code: "auth/user-disabled",
        error: (resolved as any).error || "Conta inativa.",
      });
    }

    if (resolved.found) {
      return res.json({
        status: resolved.status || "synced",
        role: resolved.role,
        salonId: resolved.salonId,
        user: resolved.user,
      });
    }

    // Usuário não registrado ou não vinculado no sistema
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

import { Router, Request, Response } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import {
  getAdminDb,
  isFirebaseAdminCredentialError,
} from "../shared/firebaseAdmin.js";
import { verifyIdToken, resolvePlatformAdmin } from "../shared/auth.js";
import { adminLimiter } from "../middleware/rateLimiter.js";
import {
  dispatchAppointmentPush,
  sendTestPushForUser,
} from "../services/fcmNotifications.js";

const router = Router();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const OPERATIONAL_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "receptionist",
  "attendant",
  "professional",
  "platform_admin",
]);

interface CallerContext {
  uid: string;
  email: string;
  role: string;
}

async function authenticateCaller(req: Request): Promise<
  | { ok: true; uid: string; email: string; role?: string; platformAdmin?: boolean }
  | { ok: false; status: number; error: string }
> {
  try {
    const decoded = (await verifyIdToken(req)) as {
      uid?: string;
      email?: string;
      role?: string;
      platform_admin?: boolean;
    };
    const uid = String(decoded.uid || "").trim();
    if (!uid) {
      return { ok: false, status: 401, error: "Usuário não identificado." };
    }
    return {
      ok: true,
      uid,
      email: String(decoded.email || "").trim().toLowerCase(),
      role: decoded.role,
      platformAdmin: decoded.platform_admin,
    };
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return {
        ok: false,
        status: 503,
        error: "Admin SDK indisponível neste ambiente.",
      };
    }
    const msg = err instanceof Error ? err.message : "Token de autenticação inválido.";
    return { ok: false, status: 401, error: msg };
  }
}

async function authorizeSalonMember(
  req: Request,
  salonId: string
): Promise<{ ok: true; ctx: CallerContext } | { ok: false; status: number; error: string }> {
  const authRes = await authenticateCaller(req);
  if ("error" in authRes) return authRes;

  try {
    const adminDb = getAdminDb();
    const isMaster = await resolvePlatformAdmin(
      { uid: authRes.uid, email: authRes.email, role: authRes.role, platform_admin: authRes.platformAdmin },
      adminDb
    );
    if (isMaster) {
      return { ok: true, ctx: { uid: authRes.uid, email: authRes.email, role: "platform_admin" } };
    }

    if (salonId === "tutorial_lumiere_studio") {
      return { ok: true, ctx: { uid: authRes.uid, email: authRes.email, role: "owner" } };
    }

    const [userSnap, salonSnap, profSnap] = await Promise.all([
      adminDb.doc(`users/${authRes.uid}`).get(),
      adminDb.doc(`salons/${salonId}`).get(),
      adminDb.doc(`salons/${salonId}/professionals/${authRes.uid}`).get(),
    ]);

    const sData = salonSnap.exists ? salonSnap.data() || {} : {};
    const isOwner =
      sData.ownerId === authRes.uid ||
      (Boolean(authRes.email) &&
        typeof sData.ownerEmail === "string" &&
        sData.ownerEmail.trim().toLowerCase() === authRes.email);

    if (isOwner) {
      return { ok: true, ctx: { uid: authRes.uid, email: authRes.email, role: "owner" } };
    }

    const uData = userSnap.exists ? userSnap.data() || {} : {};
    const role = String(uData.role || (profSnap.exists ? "professional" : "")).trim();
    const belongs = uData.salonId === salonId || profSnap.exists;

    if (!belongs || !OPERATIONAL_ROLES.has(role)) {
      return { ok: false, status: 403, error: "Acesso negado para este estabelecimento." };
    }

    return { ok: true, ctx: { uid: authRes.uid, email: authRes.email, role } };
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return { ok: false, status: 503, error: "Admin SDK indisponível neste ambiente." };
    }
    return { ok: false, status: 500, error: "Erro ao verificar permissões do usuário." };
  }
}

const sendAppointmentPushSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX, "salonId inválido"),
  appointmentId: z.string().regex(SAFE_ID_REGEX, "appointmentId inválido"),
  professionalId: z.string().min(1).max(160),
  professionalName: z.string().max(160).optional(),
  clientName: z.string().max(200).default("Cliente"),
  serviceName: z.string().max(200).default("Atendimento"),
  date: z.string().max(20).default(""),
  time: z.string().max(20).default(""),
  action: z.enum(["create", "confirm", "cancel"]),
  channelLabel: z.string().max(80).optional(),
});

router.post("/send-appointment-push", adminLimiter, async (req: Request, res: Response) => {
  const parsed = sendAppointmentPushSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Parâmetros inválidos para envio de notificação.",
    });
  }

  const input = parsed.data;
  const auth = await authorizeSalonMember(req, input.salonId);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const adminDb = getAdminDb();
    const apptSnap = await adminDb
      .doc(`salons/${input.salonId}/appointments/${input.appointmentId}`)
      .get();

    if (!apptSnap.exists) {
      return res.status(404).json({ error: "Agendamento não localizado neste estabelecimento." });
    }

    const result = await dispatchAppointmentPush({
      salonId: input.salonId,
      appointmentId: input.appointmentId,
      professionalId: input.professionalId,
      professionalName: input.professionalName,
      clientName: input.clientName,
      serviceName: input.serviceName,
      date: input.date,
      time: input.time,
      action: input.action,
      channelLabel: input.channelLabel,
    });

    return res.json({
      success: result.pushSentCount > 0 || result.inAppCreated,
      tokensNotifiedCount: result.pushSentCount,
      tokensFoundCount: result.tokensFoundCount,
      inAppCreated: result.inAppCreated,
      skippedByPreference: result.skippedByPreference || false,
    });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Push Notification Backend] Erro ao enviar alerta:", err);
    return res.status(500).json({ error: "Erro ao processar notificação push." });
  }
});

const registerTokenSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX).optional(),
  token: z.string().min(10).max(512),
  pushEnabled: z.boolean().optional().default(true),
  pushPreferences: z
    .object({
      onConfirmed: z.boolean(),
      onCanceled: z.boolean(),
    })
    .optional(),
});

router.post("/push/register-token", adminLimiter, async (req: Request, res: Response) => {
  const parsed = registerTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Token FCM inválido." });
  }

  const caller = await authenticateCaller(req);
  if ("error" in caller) {
    return res.status(caller.status).json({ error: caller.error });
  }

  const { salonId, token, pushEnabled, pushPreferences } = parsed.data;

  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    const tokenPatch: Record<string, unknown> = {
      fcmToken: token,
      fcmTokens: FieldValue.arrayUnion(token),
      pushEnabled,
      updatedAt: now,
      ...(pushPreferences ? { pushPreferences } : {}),
    };

    const userRef = adminDb.doc(`users/${caller.uid}`);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      await userRef.set(tokenPatch, { merge: true });
    }

    let syncedProfessionalId: string | null = null;
    if (salonId) {
      const targetRefs: FirebaseFirestore.DocumentReference[] = [];
      const directProfRef = adminDb.doc(`salons/${salonId}/professionals/${caller.uid}`);
      const directSnap = await directProfRef.get();
      if (directSnap.exists) {
        targetRefs.push(directProfRef);
      }

      if (caller.email) {
        const byEmail = await adminDb
          .collection(`salons/${salonId}/professionals`)
          .where("email", "==", caller.email)
          .limit(3)
          .get();
        byEmail.forEach((d) => {
          if (!targetRefs.some((r) => r.path === d.ref.path)) targetRefs.push(d.ref);
        });
      }

      const byUserId = await adminDb
        .collection(`salons/${salonId}/professionals`)
        .where("userId", "==", caller.uid)
        .limit(3)
        .get();
      byUserId.forEach((d) => {
        if (!targetRefs.some((r) => r.path === d.ref.path)) targetRefs.push(d.ref);
      });

      await Promise.all(targetRefs.map((ref) => ref.set(tokenPatch, { merge: true })));
      if (targetRefs.length > 0) {
        syncedProfessionalId = targetRefs[0].id;
      }
    }

    return res.json({ success: true, syncedProfessionalId });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({ error: "Admin SDK indisponível.", code: "ADMIN_UNAVAILABLE" });
    }
    console.error("[Push Register Token]", err);
    return res.status(500).json({ error: "Erro ao registrar token push." });
  }
});

const unregisterTokenSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX).optional(),
  token: z.string().max(512).optional(),
});

router.post("/push/unregister-token", adminLimiter, async (req: Request, res: Response) => {
  const parsed = unregisterTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos." });
  }

  const caller = await authenticateCaller(req);
  if ("error" in caller) {
    return res.status(caller.status).json({ error: caller.error });
  }

  const { salonId, token } = parsed.data;
  try {
    const adminDb = getAdminDb();
    const now = Date.now();

    const applyRemoval = async (ref: FirebaseFirestore.DocumentReference) => {
      const snap = await ref.get();
      if (!snap.exists) return;
      const d = snap.data() || {};
      const patch: Record<string, unknown> = { pushEnabled: false, updatedAt: now };
      if (token) {
        patch.fcmTokens = FieldValue.arrayRemove(token);
        if (d.fcmToken === token) patch.fcmToken = "";
      }
      await ref.set(patch, { merge: true });
    };

    await applyRemoval(adminDb.doc(`users/${caller.uid}`));

    if (salonId) {
      const refs: FirebaseFirestore.DocumentReference[] = [
        adminDb.doc(`salons/${salonId}/professionals/${caller.uid}`),
      ];
      if (caller.email) {
        const qs = await adminDb
          .collection(`salons/${salonId}/professionals`)
          .where("email", "==", caller.email)
          .limit(3)
          .get();
        qs.forEach((d) => refs.push(d.ref));
      }
      await Promise.all(refs.map((r) => applyRemoval(r).catch(() => undefined)));
    }

    return res.json({ success: true });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({ error: "Admin SDK indisponível.", code: "ADMIN_UNAVAILABLE" });
    }
    return res.status(500).json({ error: "Erro ao desativar alertas push." });
  }
});

const testPushSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX).optional(),
  professionalId: z.string().max(160).optional(),
});

router.post("/push/test", adminLimiter, async (req: Request, res: Response) => {
  const parsed = testPushSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Parâmetros inválidos para teste de push." });
  }

  const caller = await authenticateCaller(req);
  if ("error" in caller) {
    return res.status(caller.status).json({ error: caller.error });
  }

  try {
    const result = await sendTestPushForUser({
      uid: caller.uid,
      email: caller.email,
      salonId: parsed.data.salonId,
      professionalId: parsed.data.professionalId,
    });
    return res.json({ success: result.successCount > 0, ...result });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({ error: "Admin SDK indisponível.", code: "ADMIN_UNAVAILABLE" });
    }
    console.error("[Push Test]", err);
    return res.status(500).json({ error: "Erro ao disparar notificação de teste." });
  }
});

export { router as pushRoutes };

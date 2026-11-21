import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import {
  getAdminDb,
  isFirebaseAdminCredentialError,
} from "../shared/firebaseAdmin.js";
import { dispatchAppointmentPush } from "../services/fcmNotifications.js";
import { verifyIdToken, resolvePlatformAdmin } from "../shared/auth.js";
import { adminLimiter, publicLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const SALON_MANAGEMENT_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "platform_admin",
]);

const SALON_OPERATIONAL_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "receptionist",
  "attendant",
  "professional",
  "platform_admin",
]);

interface LastWebhookEvent {
  timestamp: number;
  provider: string;
  phone: string;
  decision: "confirm" | "cancel";
  appointmentId: string;
  clientName: string;
  matched: boolean;
}

interface WhatsAppIntegrationConfig {
  enabled: boolean;
  phoneNumberId: string;
  wabaId?: string;
  accessToken?: string;
  defaultMessageTemplate?: string;
  webhookVerifyToken?: string;
  webhookSecret?: string;
  lastWebhookEvent?: LastWebhookEvent;
  updatedAt?: number;
  updatedBy?: string;
}

interface AuthContext {
  uid: string;
  email: string;
  role: string;
  isPlatformAdmin: boolean;
  isSalonOwner: boolean;
}

const DEFAULT_TEMPLATE =
  "Olá {cliente}! ✨ Aqui é do *{salao}*. Confirmamos seu atendimento de *{servico}* com *{profissional}* no dia *{data}* às *{hora}*?\n\nToque no link seguro para confirmar ou avisar com 1 clique:\n{link}";

function normalizeBrazilPhone(raw?: string | null): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function formatDateBR(ymd?: string): string {
  if (!ymd || typeof ymd !== "string") return "";
  const clean = ymd.substring(0, 10);
  const parts = clean.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean;
}

function safeTimingEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function resolvePublicOrigin(req: Request, requestedOrigin?: string): string {
  const candidates = [requestedOrigin, req.headers.origin, process.env.APP_URL];
  for (const item of candidates) {
    if (!item || typeof item !== "string") continue;
    try {
      const parsed = new URL(item);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed origin
    }
  }
  const host = req.get("host");
  if (host) {
    const proto = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    return `${proto}://${host}`;
  }
  return "https://lumiere-os.vercel.app";
}

async function authorizeSalonAccess(
  req: Request,
  salonId: string,
  allowedRoles: Set<string>
): Promise<{ ok: true; ctx: AuthContext } | { ok: false; status: number; error: string }> {
  let decoded: { uid?: string; email?: string; role?: string; platform_admin?: boolean };
  try {
    decoded = (await verifyIdToken(req)) as {
      uid?: string;
      email?: string;
      role?: string;
      platform_admin?: boolean;
    };
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return { ok: false, status: 503, error: "Serviço administrativo indisponível neste ambiente." };
    }
    const message = err instanceof Error ? err.message : "Token de autenticação inválido.";
    return { ok: false, status: 401, error: message };
  }

  const uid = String(decoded.uid || "").trim();
  const email = String(decoded.email || "").trim().toLowerCase();
  const adminDb = getAdminDb();

  const isMaster = await resolvePlatformAdmin(decoded, adminDb);
  if (isMaster) {
    return {
      ok: true,
      ctx: { uid, email, role: "platform_admin", isPlatformAdmin: true, isSalonOwner: true },
    };
  }

  if (salonId === "tutorial_lumiere_studio") {
    return {
      ok: true,
      ctx: { uid, email, role: "owner", isPlatformAdmin: false, isSalonOwner: true },
    };
  }

  const [userSnap, salonSnap, profSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("salons").doc(salonId).get(),
    adminDb.collection(`salons/${salonId}/professionals`).doc(uid).get(),
  ]);

  const sData = salonSnap.exists ? salonSnap.data() || {} : {};
  const isOwner =
    sData.ownerId === uid ||
    (Boolean(email) &&
      typeof sData.ownerEmail === "string" &&
      sData.ownerEmail.trim().toLowerCase() === email);

  if (isOwner) {
    return {
      ok: true,
      ctx: { uid, email, role: "owner", isPlatformAdmin: false, isSalonOwner: true },
    };
  }

  const uData = userSnap.exists ? userSnap.data() || {} : {};
  const userRole = String(uData.role || "").trim();
  const belongsToSalon =
    uData.salonId === salonId || profSnap.exists;

  if (!belongsToSalon) {
    return { ok: false, status: 403, error: "Acesso negado para este estabelecimento." };
  }

  const effectiveRole = userRole || (profSnap.exists ? "professional" : "");
  if (!allowedRoles.has(effectiveRole)) {
    return { ok: false, status: 403, error: "Seu perfil não tem permissão para esta operação." };
  }

  return {
    ok: true,
    ctx: { uid, email, role: effectiveRole, isPlatformAdmin: false, isSalonOwner: false },
  };
}

async function notifyAppointmentDecision(params: {
  salonId: string;
  appointmentId: string;
  professionalId?: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  decision: "confirm" | "cancel";
  channelLabel: string;
}): Promise<void> {
  await dispatchAppointmentPush({
    salonId: params.salonId,
    appointmentId: params.appointmentId,
    professionalId: params.professionalId,
    clientName: params.clientName,
    serviceName: params.serviceName,
    date: params.date,
    time: params.time,
    action: params.decision,
    channelLabel: params.channelLabel,
  });
}

// =====================================================
// 1. CONFIGURAÇÕES DE WHATSAPP CLOUD API POR SALÃO
// =====================================================

const whatsappSettingsQuerySchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
});

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function syncWebhookRoutingIndexes(
  adminDb: FirebaseFirestore.Firestore,
  salonId: string,
  verifyToken?: string,
  phoneNumberId?: string
): Promise<void> {
  const now = Date.now();
  const tasks: Array<Promise<unknown>> = [];
  if (verifyToken && verifyToken.trim()) {
    tasks.push(
      adminDb
        .collection("whatsappVerifyTokens")
        .doc(sha256Hex(verifyToken.trim()))
        .set({ salonId, verifyToken: verifyToken.trim(), updatedAt: now }, { merge: true })
        .catch(() => null)
    );
  }
  if (phoneNumberId && phoneNumberId.trim()) {
    tasks.push(
      adminDb
        .collection("whatsappPhoneRoutes")
        .doc(sha256Hex(phoneNumberId.trim()))
        .set({ salonId, phoneNumberId: phoneNumberId.trim(), updatedAt: now }, { merge: true })
        .catch(() => null)
    );
  }
  await Promise.all(tasks);
}

router.get("/whatsapp-settings", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = whatsappSettingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "salonId inválido." });
    }

    const { salonId } = parsed.data;
    const auth = await authorizeSalonAccess(req, salonId, SALON_MANAGEMENT_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const adminDb = getAdminDb();
    const docSnap = await adminDb
      .collection(`salons/${salonId}/integrations`)
      .doc("whatsapp")
      .get();

    const data = docSnap.exists ? (docSnap.data() as Partial<WhatsAppIntegrationConfig>) : {};
    const rawToken = typeof data.accessToken === "string" ? data.accessToken : "";
    const maskedAccessToken =
      rawToken.length > 10
        ? `${rawToken.slice(0, 6)}••••••${rawToken.slice(-4)}`
        : rawToken
          ? "••••••••"
          : "";

    const rawSecret = typeof data.webhookSecret === "string" ? data.webhookSecret : "";
    const maskedWebhookSecret =
      rawSecret.length > 6
        ? `${rawSecret.slice(0, 3)}••••${rawSecret.slice(-2)}`
        : rawSecret
          ? "••••••"
          : "";

    const effectiveVerifyToken =
      data.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || `lumiere_${salonId.slice(0, 8)}`;

    // Ensure O(1) lookup docs stay synced when opening settings
    await syncWebhookRoutingIndexes(adminDb, salonId, effectiveVerifyToken, data.phoneNumberId);

    return res.json({
      enabled: Boolean(data.enabled),
      phoneNumberId: data.phoneNumberId || "",
      wabaId: data.wabaId || "",
      hasAccessToken: Boolean(rawToken),
      maskedAccessToken,
      hasWebhookSecret: Boolean(rawSecret),
      maskedWebhookSecret,
      defaultMessageTemplate: data.defaultMessageTemplate || DEFAULT_TEMPLATE,
      webhookVerifyToken: effectiveVerifyToken,
      lastWebhookEvent: data.lastWebhookEvent || null,
    });
  } catch (err) {
    console.error("[WhatsApp Settings GET]", err);
    return res.status(500).json({ error: "Erro ao carregar configurações de WhatsApp." });
  }
});

const whatsappSettingsBodySchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  enabled: z.boolean(),
  phoneNumberId: z.string().trim().max(120).optional().default(""),
  wabaId: z.string().trim().max(120).optional().default(""),
  accessToken: z.string().trim().max(1000).optional(),
  webhookSecret: z.string().trim().max(256).optional(),
  defaultMessageTemplate: z.string().trim().min(10).max(1200).optional(),
  webhookVerifyToken: z.string().trim().max(120).optional(),
});

router.post("/whatsapp-settings", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = whatsappSettingsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados de configuração inválidos." });
    }

    const {
      salonId,
      enabled,
      phoneNumberId,
      wabaId,
      accessToken,
      webhookSecret,
      defaultMessageTemplate,
      webhookVerifyToken,
    } = parsed.data;

    const auth = await authorizeSalonAccess(req, salonId, SALON_MANAGEMENT_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const adminDb = getAdminDb();
    const docRef = adminDb.collection(`salons/${salonId}/integrations`).doc("whatsapp");
    const existingSnap = await docRef.get();
    const existing = existingSnap.exists ? (existingSnap.data() as Partial<WhatsAppIntegrationConfig>) : {};

    const finalToken =
      accessToken && accessToken.length > 0 ? accessToken : existing.accessToken || "";
    const finalWebhookSecret =
      webhookSecret !== undefined && webhookSecret.length > 0
        ? webhookSecret
        : existing.webhookSecret || "";

    if (enabled && (!phoneNumberId || !finalToken)) {
      return res.status(400).json({
        error: "Para ativar a API oficial do WhatsApp, informe o Phone Number ID e o Token de Acesso.",
      });
    }

    const verifyTokenToSave =
      webhookVerifyToken || existing.webhookVerifyToken || `lumiere_${salonId.slice(0, 8)}`;

    await docRef.set(
      {
        enabled,
        phoneNumberId,
        wabaId: wabaId || "",
        accessToken: finalToken,
        webhookSecret: finalWebhookSecret,
        defaultMessageTemplate: defaultMessageTemplate || existing.defaultMessageTemplate || DEFAULT_TEMPLATE,
        webhookVerifyToken: verifyTokenToSave,
        updatedAt: Date.now(),
        updatedBy: auth.ctx.uid,
      },
      { merge: true }
    );

    await syncWebhookRoutingIndexes(adminDb, salonId, verifyTokenToSave, phoneNumberId);

    return res.json({
      success: true,
      enabled,
      hasAccessToken: Boolean(finalToken),
      hasWebhookSecret: Boolean(finalWebhookSecret),
      webhookVerifyToken: verifyTokenToSave,
    });
  } catch (err) {
    console.error("[WhatsApp Settings POST]", err);
    return res.status(500).json({ error: "Erro ao salvar configurações de WhatsApp." });
  }
});

// =====================================================
// 2. ENVIAR CONFIRMAÇÃO DE HORÁRIO VIA WHATSAPP (API OU LINK)
// =====================================================

const sendConfirmationSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  appointmentId: z.string().regex(SAFE_ID_REGEX),
  origin: z.string().url().optional(),
});

router.post("/send-whatsapp-confirmation", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = sendConfirmationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parâmetros inválidos para envio de confirmação." });
    }

    const { salonId, appointmentId, origin } = parsed.data;
    const auth = await authorizeSalonAccess(req, salonId, SALON_OPERATIONAL_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const adminDb = getAdminDb();
    const apptRef = adminDb.doc(`salons/${salonId}/appointments/${appointmentId}`);
    const [apptSnap, salonSnap, waSnap] = await Promise.all([
      apptRef.get(),
      adminDb.doc(`salons/${salonId}`).get(),
      adminDb.doc(`salons/${salonId}/integrations/whatsapp`).get(),
    ]);

    if (!apptSnap.exists) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    const apptData = apptSnap.data() || {};
    if (apptData.isBlock || apptData.status === "blocked") {
      return res.status(400).json({ error: "Bloqueios de horário não aceitam confirmação de cliente." });
    }
    if (apptData.status === "canceled" || apptData.status === "completed") {
      return res.status(400).json({ error: "Não é possível solicitar confirmação para agendamentos concluídos ou cancelados." });
    }

    let rawPhone = String(apptData.clientPhone || "").trim();
    if (!rawPhone && apptData.clientId && apptData.clientId !== "consumidor-final" && apptData.clientId !== "manual") {
      const clientSnap = await adminDb.doc(`salons/${salonId}/clients/${apptData.clientId}`).get();
      if (clientSnap.exists) {
        rawPhone = String(clientSnap.data()?.phone || "").trim();
      }
    }

    const cleanPhone = normalizeBrazilPhone(rawPhone);
    const salonName = String(salonSnap.data()?.name || "LumièreOS");
    const confirmToken =
      typeof apptData.confirmToken === "string" && apptData.confirmToken.length >= 16
        ? apptData.confirmToken
        : crypto.randomBytes(16).toString("hex");

    const baseOrigin = resolvePublicOrigin(req, origin);
    const confirmUrl = `${baseOrigin}/confirmar-agendamento?salon=${encodeURIComponent(
      salonId
    )}&id=${encodeURIComponent(appointmentId)}&token=${encodeURIComponent(confirmToken)}`;

    const waConfig = waSnap.exists ? (waSnap.data() as Partial<WhatsAppIntegrationConfig>) : {};
    const template = waConfig.defaultMessageTemplate || DEFAULT_TEMPLATE;
    const firstName = String(apptData.clientName || "Cliente").trim().split(/\s+/)[0] || "Cliente";

    const messageText = template
      .replace(/\{cliente\}/g, firstName)
      .replace(/\{cliente_completo\}/g, String(apptData.clientName || "Cliente"))
      .replace(/\{salao\}/g, salonName)
      .replace(/\{servico\}/g, String(apptData.serviceName || "Atendimento"))
      .replace(/\{profissional\}/g, String(apptData.professionalName || "Nossa equipe"))
      .replace(/\{data\}/g, formatDateBR(apptData.date))
      .replace(/\{hora\}/g, String(apptData.time || ""))
      .replace(/\{link\}/g, confirmUrl);

    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    const now = Date.now();
    let sentViaCloudApi = false;
    let cloudApiError: string | undefined;
    let whatsappMessageId: string | undefined;

    if (waConfig.enabled && waConfig.phoneNumberId && waConfig.accessToken && cleanPhone) {
      try {
        const graphUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
          waConfig.phoneNumberId
        )}/messages`;

        const interactivePayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "interactive",
          interactive: {
            type: "button",
            header: {
              type: "text",
              text: salonName.slice(0, 60),
            },
            body: {
              text: `Olá ${firstName}! Confirmamos seu horário de ${apptData.serviceName || "atendimento"} com ${
                apptData.professionalName || "nossa equipe"
              } para o dia ${formatDateBR(apptData.date)} às ${apptData.time}?\n\nVocê também pode confirmar pelo link: ${confirmUrl}`.slice(
                0,
                1024
              ),
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: `CONFIRM_APPT|${salonId}|${appointmentId}|${confirmToken}`,
                    title: "Confirmar horário",
                  },
                },
                {
                  type: "reply",
                  reply: {
                    id: `CANCEL_APPT|${salonId}|${appointmentId}|${confirmToken}`,
                    title: "Cancelar",
                  },
                },
              ],
            },
          },
        };

        const graphRes = await fetch(graphUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waConfig.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(interactivePayload),
        });

        const graphJson = (await graphRes.json().catch(() => ({}))) as {
          messages?: Array<{ id?: string }>;
          error?: { message?: string };
        };

        if (graphRes.ok && graphJson.messages?.[0]?.id) {
          sentViaCloudApi = true;
          whatsappMessageId = graphJson.messages[0].id;
        } else {
          cloudApiError = graphJson.error?.message || "A API do WhatsApp retornou falha no disparo direto.";
        }
      } catch (apiErr: unknown) {
        cloudApiError = apiErr instanceof Error ? apiErr.message : "Erro ao contatar WhatsApp Cloud API.";
      }
    }

    await apptRef.set(
      {
        confirmToken,
        confirmationStatus:
          apptData.status === "confirmed" ? "confirmed_by_client" : "awaiting_client",
        whatsappSentAt: now,
        confirmationChannel: sentViaCloudApi ? "whatsapp_cloud" : "whatsapp_link",
        ...(whatsappMessageId ? { whatsappMessageId } : {}),
        ...(rawPhone && !apptData.clientPhone ? { clientPhone: rawPhone } : {}),
        updatedAt: now,
      },
      { merge: true }
    );

    return res.json({
      success: true,
      mode: sentViaCloudApi ? "whatsapp_cloud" : "wa_link",
      sentViaCloudApi,
      cloudApiError,
      whatsappUrl,
      confirmUrl,
      messageText,
      phoneFound: Boolean(cleanPhone),
    });
  } catch (err) {
    console.error("[Appointments Send WhatsApp Confirmation]", err);
    return res.status(500).json({ error: "Erro ao preparar confirmação via WhatsApp." });
  }
});

// =====================================================
// 3. ATUALIZAÇÃO DE STATUS AUTHENTICADA (SUPORTE PROFISSIONAL & RECEPÇÃO)
// =====================================================

const updateStatusSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  appointmentId: z.string().regex(SAFE_ID_REGEX),
  status: z.enum([
    "scheduled",
    "confirmed",
    "waiting",
    "in_service",
    "completed",
    "canceled",
    "no_show",
    "blocked",
  ]),
});

router.post("/update-status", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parâmetros de status inválidos." });
    }

    const { salonId, appointmentId, status } = parsed.data;
    const auth = await authorizeSalonAccess(req, salonId, SALON_OPERATIONAL_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const adminDb = getAdminDb();
    const apptRef = adminDb.doc(`salons/${salonId}/appointments/${appointmentId}`);
    const apptSnap = await apptRef.get();
    if (!apptSnap.exists) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    const apptData = apptSnap.data() || {};
    if (auth.ctx.role === "professional") {
      const ownProSnap = await adminDb
        .collection(`salons/${salonId}/professionals`)
        .where("email", "==", auth.ctx.email)
        .limit(3)
        .get()
        .catch(() => null);
      const allowedProfIds = new Set<string>([auth.ctx.uid]);
      ownProSnap?.forEach((d) => allowedProfIds.add(d.id));
      if (!allowedProfIds.has(String(apptData.professionalId || ""))) {
        return res.status(403).json({ error: "Você só pode alterar o status dos seus próprios atendimentos." });
      }
    }

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status,
      updatedAt: now,
    };
    if (status === "confirmed") {
      patch.confirmationStatus = "confirmed_by_client";
      patch.confirmedAt = now;
      patch.confirmationChannel = apptData.confirmationChannel || "manual";
    } else if (status === "canceled") {
      patch.canceledAt = now;
    }

    await apptRef.set(patch, { merge: true });

    if (status === "confirmed" || status === "canceled") {
      await dispatchAppointmentPush({
        salonId,
        appointmentId,
        professionalId: apptData.professionalId ? String(apptData.professionalId) : undefined,
        professionalName: apptData.professionalName ? String(apptData.professionalName) : undefined,
        clientName: String(apptData.clientName || "Cliente"),
        serviceName: String(apptData.serviceName || "Atendimento"),
        date: String(apptData.date || ""),
        time: String(apptData.time || ""),
        action: status === "confirmed" ? "confirm" : "cancel",
      }).catch(() => undefined);
    }

    return res.json({ success: true, status });
  } catch (err) {
    console.error("[Appointments Update Status]", err);
    return res.status(500).json({ error: "Erro ao atualizar status do agendamento." });
  }
});

// =====================================================
// 4. LINK PÚBLICO DE CONFIRMAÇÃO DO CLIENTE (SEM LOGIN)
// =====================================================

const publicConfirmQuerySchema = z.object({
  salon: z.string().regex(SAFE_ID_REGEX),
  id: z.string().regex(SAFE_ID_REGEX),
  token: z.string().min(12).max(128),
});

router.get("/public/confirm-info", publicLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = publicConfirmQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Link de confirmação inválido ou incompleto." });
    }

    const { salon: salonId, id: appointmentId, token } = parsed.data;
    const adminDb = getAdminDb();

    const [apptSnap, salonSnap] = await Promise.all([
      adminDb.doc(`salons/${salonId}/appointments/${appointmentId}`).get(),
      adminDb.doc(`salons/${salonId}`).get(),
    ]);

    if (!apptSnap.exists || !salonSnap.exists) {
      return res.status(404).json({ error: "Agendamento não localizado." });
    }

    const appt = apptSnap.data() || {};
    const storedToken = String(appt.confirmToken || "");
    if (!storedToken || !safeTimingEqual(storedToken, token)) {
      return res.status(403).json({ error: "Token de confirmação expirado ou inválido." });
    }

    const salon = salonSnap.data() || {};
    const clientFirstName = String(appt.clientName || "Cliente").trim().split(/\s+/)[0] || "Cliente";

    return res.json({
      salonId,
      appointmentId,
      salonName: String(salon.name || "LumièreOS"),
      salonPhone: String(salon.phone || ""),
      salonAddress: [salon.address, salon.city, salon.state].filter(Boolean).join(" • "),
      clientFirstName,
      serviceName: String(appt.serviceName || "Atendimento"),
      professionalName: String(appt.professionalName || "Profissional"),
      date: String(appt.date || ""),
      time: String(appt.time || ""),
      durationMinutes: Number(appt.serviceDuration) || 45,
      price: typeof appt.price === "number" ? appt.price : null,
      status: String(appt.status || "scheduled"),
      confirmationStatus: String(appt.confirmationStatus || "awaiting_client"),
      confirmedAt: appt.confirmedAt || null,
    });
  } catch (err) {
    console.error("[Public Confirm Info]", err);
    return res.status(500).json({ error: "Erro ao carregar dados da confirmação." });
  }
});

const publicRespondBodySchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  appointmentId: z.string().regex(SAFE_ID_REGEX),
  token: z.string().min(12).max(128),
  decision: z.enum(["confirm", "cancel"]),
  reason: z.string().trim().max(300).optional(),
});

router.post("/public/respond", publicLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = publicRespondBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados de confirmação inválidos." });
    }

    const { salonId, appointmentId, token, decision, reason } = parsed.data;
    const adminDb = getAdminDb();
    const apptRef = adminDb.doc(`salons/${salonId}/appointments/${appointmentId}`);
    const apptSnap = await apptRef.get();

    if (!apptSnap.exists) {
      return res.status(404).json({ error: "Agendamento não localizado." });
    }

    const appt = apptSnap.data() || {};
    const storedToken = String(appt.confirmToken || "");
    if (!storedToken || !safeTimingEqual(storedToken, token)) {
      return res.status(403).json({ error: "Token de confirmação inválido." });
    }

    if (appt.status === "completed" || appt.status === "blocked") {
      return res.status(400).json({ error: "Este atendimento já foi finalizado e não pode ser alterado." });
    }

    const now = Date.now();
    const nextStatus = decision === "confirm" ? "confirmed" : "canceled";
    const nextConfirmationStatus =
      decision === "confirm" ? "confirmed_by_client" : "declined_by_client";

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      confirmationStatus: nextConfirmationStatus,
      confirmationChannel: "public_link",
      updatedAt: now,
    };

    if (decision === "confirm") {
      updatePayload.confirmedAt = now;
    } else {
      updatePayload.canceledAt = now;
      if (reason) {
        updatePayload.notes = appt.notes
          ? `${appt.notes}\n[Cancelado pelo cliente]: ${reason}`
          : `[Cancelado pelo cliente]: ${reason}`;
      }
    }

    await apptRef.set(updatePayload, { merge: true });

    await notifyAppointmentDecision({
      salonId,
      appointmentId,
      professionalId: appt.professionalId ? String(appt.professionalId) : undefined,
      clientName: String(appt.clientName || "Cliente"),
      serviceName: String(appt.serviceName || "Atendimento"),
      date: String(appt.date || ""),
      time: String(appt.time || ""),
      decision,
      channelLabel: "WhatsApp / Link",
    });

    return res.json({
      success: true,
      status: nextStatus,
      confirmationStatus: nextConfirmationStatus,
      confirmedAt: decision === "confirm" ? now : null,
    });
  } catch (err) {
    console.error("[Public Confirm Respond]", err);
    return res.status(500).json({ error: "Erro ao registrar sua resposta." });
  }
});

// =====================================================
// 5. WEBHOOK WHATSAPP (META CLOUD API / EVOLUTION / Z-API / TWILIO)
// =====================================================

function classifyWhatsAppReply(rawText: string): "confirm" | "cancel" | null {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return null;
  if (trimmed.includes("👍") || trimmed.includes("✅")) return "confirm";
  if (trimmed.includes("❌") || trimmed.includes("👎")) return "cancel";

  const normalized = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  const confirmPhrases = new Set([
    "SIM",
    "S",
    "CONFIRMO",
    "CONFIRMAR",
    "CONFIRMADO",
    "CONFIRMADA",
    "CONFIRMAR HORARIO",
    "OK",
    "CERTO",
    "FECHADO",
    "PODE CONFIRMAR",
    "ESTOU INDO",
    "VOU",
    "VOU SIM",
    "1",
    "YES",
    "CONFIRM",
  ]);
  const cancelPhrases = new Set([
    "NAO",
    "N",
    "CANCELAR",
    "CANCELA",
    "CANCELADO",
    "DESMARCAR",
    "DESMARCA",
    "REMARCAR",
    "NAO VOU",
    "NAO POSSO",
    "2",
    "NO",
    "CANCEL",
  ]);

  if (confirmPhrases.has(normalized)) return "confirm";
  if (cancelPhrases.has(normalized)) return "cancel";
  if (normalized.startsWith("CONFIRMO ")) return "confirm";
  if (normalized.startsWith("CANCELO ") || normalized.startsWith("QUERO CANCELAR")) return "cancel";
  return null;
}

async function resolveSalonIdForVerifyToken(
  adminDb: FirebaseFirestore.Firestore,
  verifyToken: string,
  preferredSalonId?: string
): Promise<string | null> {
  if (preferredSalonId && SAFE_ID_REGEX.test(preferredSalonId)) {
    const snap = await adminDb
      .doc(`salons/${preferredSalonId}/integrations/whatsapp`)
      .get()
      .catch(() => null);
    const stored = String(snap?.data()?.webhookVerifyToken || `lumiere_${preferredSalonId.slice(0, 8)}`);
    if (safeTimingEqual(stored, verifyToken)) {
      return preferredSalonId;
    }
  }

  const indexSnap = await adminDb
    .collection("whatsappVerifyTokens")
    .doc(sha256Hex(verifyToken))
    .get()
    .catch(() => null);
  if (indexSnap?.exists && indexSnap.data()?.salonId) {
    return String(indexSnap.data()?.salonId);
  }

  const salonsSnap = await adminDb.collection("salons").limit(100).get().catch(() => null);
  if (salonsSnap) {
    for (const sDoc of salonsSnap.docs) {
      const waSnap = await adminDb
        .doc(`salons/${sDoc.id}/integrations/whatsapp`)
        .get()
        .catch(() => null);
      const tokenVal = String(waSnap?.data()?.webhookVerifyToken || "");
      if (tokenVal && safeTimingEqual(tokenVal, verifyToken)) {
        await syncWebhookRoutingIndexes(adminDb, sDoc.id, tokenVal, waSnap?.data()?.phoneNumberId);
        return sDoc.id;
      }
    }
  }

  return null;
}

async function resolveSalonIdForPhoneNumberId(
  adminDb: FirebaseFirestore.Firestore,
  phoneNumberId?: string,
  preferredSalonId?: string
): Promise<string | null> {
  if (preferredSalonId && SAFE_ID_REGEX.test(preferredSalonId)) {
    return preferredSalonId;
  }
  if (!phoneNumberId) return null;

  const routeSnap = await adminDb
    .collection("whatsappPhoneRoutes")
    .doc(sha256Hex(phoneNumberId))
    .get()
    .catch(() => null);
  if (routeSnap?.exists && routeSnap.data()?.salonId) {
    return String(routeSnap.data()?.salonId);
  }

  const salonsSnap = await adminDb.collection("salons").limit(100).get().catch(() => null);
  if (salonsSnap) {
    for (const sDoc of salonsSnap.docs) {
      const waSnap = await adminDb
        .doc(`salons/${sDoc.id}/integrations/whatsapp`)
        .get()
        .catch(() => null);
      if (waSnap?.data()?.phoneNumberId === phoneNumberId) {
        await syncWebhookRoutingIndexes(
          adminDb,
          sDoc.id,
          waSnap.data()?.webhookVerifyToken,
          phoneNumberId
        );
        return sDoc.id;
      }
    }
  }

  return null;
}

function getYesterdayYmdLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function matchAppointmentByPhone(
  adminDb: FirebaseFirestore.Firestore,
  salonId: string,
  senderDigits: string
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  if (!senderDigits) return null;
  const senderLast8 = senderDigits.slice(-8);

  const phonesMatch = (candidateDigits: string) =>
    Boolean(candidateDigits) &&
    (candidateDigits === senderDigits || candidateDigits.slice(-8) === senderLast8);

  // 1) Prioridade: agendamentos aguardando confirmação do cliente via WhatsApp
  const awaitingSnap = await adminDb
    .collection(`salons/${salonId}/appointments`)
    .where("confirmationStatus", "==", "awaiting_client")
    .limit(50)
    .get()
    .catch(() => null);

  let matchedDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let latestSentAt = -1;

  if (awaitingSnap && !awaitingSnap.empty) {
    for (const docSnap of awaitingSnap.docs) {
      const d = docSnap.data();
      let apptDigits = normalizeBrazilPhone(String(d.clientPhone || ""));
      if (!apptDigits && d.clientId && d.clientId !== "consumidor-final" && d.clientId !== "manual") {
        const cSnap = await adminDb
          .doc(`salons/${salonId}/clients/${d.clientId}`)
          .get()
          .catch(() => null);
        apptDigits = normalizeBrazilPhone(String(cSnap?.data()?.phone || ""));
      }
      if (phonesMatch(apptDigits)) {
        const sentAt = Number(d.whatsappSentAt || d.updatedAt || 0);
        if (sentAt >= latestSentAt) {
          latestSentAt = sentAt;
          matchedDoc = docSnap;
        }
      }
    }
    if (matchedDoc) return matchedDoc;
  }

  // 2) Fallback: agendamentos 'scheduled' futuros/recentes com o mesmo telefone do cliente
  const minDate = getYesterdayYmdLocal();
  const scheduledSnap = await adminDb
    .collection(`salons/${salonId}/appointments`)
    .where("status", "==", "scheduled")
    .limit(100)
    .get()
    .catch(() => null);

  if (scheduledSnap && !scheduledSnap.empty) {
    const candidates: Array<{ doc: FirebaseFirestore.QueryDocumentSnapshot; key: string }> = [];
    for (const docSnap of scheduledSnap.docs) {
      const d = docSnap.data();
      if (d.isBlock) continue;
      const appDate = String(d.date || "").substring(0, 10);
      if (appDate && appDate < minDate) continue;

      let apptDigits = normalizeBrazilPhone(String(d.clientPhone || ""));
      if (!apptDigits && d.clientId && d.clientId !== "consumidor-final" && d.clientId !== "manual") {
        const cSnap = await adminDb
          .doc(`salons/${salonId}/clients/${d.clientId}`)
          .get()
          .catch(() => null);
        apptDigits = normalizeBrazilPhone(String(cSnap?.data()?.phone || ""));
      }
      if (phonesMatch(apptDigits)) {
        candidates.push({ doc: docSnap, key: `${appDate}T${String(d.time || "00:00")}` });
      }
    }
    candidates.sort((a, b) => a.key.localeCompare(b.key));
    if (candidates.length > 0) {
      return candidates[0].doc;
    }
  }

  return null;
}

async function applyWebhookAppointmentDecision(params: {
  adminDb: FirebaseFirestore.Firestore;
  salonId: string;
  apptRef: FirebaseFirestore.DocumentReference;
  apptData: FirebaseFirestore.DocumentData;
  decision: "confirm" | "cancel";
  channel: string;
  provider: string;
  senderPhone: string;
}): Promise<void> {
  const { adminDb, salonId, apptRef, apptData, decision, channel, provider, senderPhone } = params;
  const now = Date.now();
  const nextStatus = decision === "confirm" ? "confirmed" : "canceled";
  const nextConfStatus = decision === "confirm" ? "confirmed_by_client" : "declined_by_client";

  await apptRef.set(
    {
      status: nextStatus,
      confirmationStatus: nextConfStatus,
      confirmationChannel: channel,
      ...(decision === "confirm" ? { confirmedAt: now } : { canceledAt: now }),
      updatedAt: now,
    },
    { merge: true }
  );

  await adminDb
    .doc(`salons/${salonId}/integrations/whatsapp`)
    .set(
      {
        lastWebhookEvent: {
          timestamp: now,
          provider,
          phone: senderPhone || String(apptData.clientPhone || ""),
          decision,
          appointmentId: apptRef.id,
          clientName: String(apptData.clientName || "Cliente"),
          matched: true,
        },
      },
      { merge: true }
    )
    .catch(() => null);

  await notifyAppointmentDecision({
    salonId,
    appointmentId: apptRef.id,
    professionalId: apptData.professionalId ? String(apptData.professionalId) : undefined,
    clientName: String(apptData.clientName || "Cliente"),
    serviceName: String(apptData.serviceName || "Atendimento"),
    date: String(apptData.date || ""),
    time: String(apptData.time || ""),
    decision,
    channelLabel: provider,
  });
}

async function handleWebhookVerification(req: Request, res: Response) {
  try {
    const mode = String(req.query["hub.mode"] || "");
    const verifyToken = String(req.query["hub.verify_token"] || "");
    const challenge = String(req.query["hub.challenge"] || "");
    const preferredSalonId =
      (typeof req.params.salonId === "string" && req.params.salonId) ||
      (typeof req.query.salonId === "string" && req.query.salonId) ||
      undefined;

    if (mode !== "subscribe" || !verifyToken) {
      return res.status(403).send("Forbidden");
    }

    if (
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
      safeTimingEqual(verifyToken, process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
    ) {
      return res.status(200).send(challenge);
    }

    const adminDb = getAdminDb();
    const matchedSalonId = await resolveSalonIdForVerifyToken(
      adminDb,
      verifyToken,
      preferredSalonId
    );
    if (matchedSalonId) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Verification token mismatch");
  } catch (err) {
    console.error("[WhatsApp Webhook GET]", err);
    return res.status(500).send("Error");
  }
}

router.get("/whatsapp-webhook", handleWebhookVerification);
router.get("/whatsapp-webhook/:salonId", handleWebhookVerification);

interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
          };
          button?: { payload?: string; text?: string };
        }>;
      };
    }>;
  }>;
  // Evolution API / Z-API / Twilio / Generic formats
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      buttonsResponseMessage?: { selectedButtonId?: string; selectedDisplayText?: string };
      templateButtonReplyMessage?: { selectedId?: string; selectedDisplayText?: string };
    };
  };
  fromMe?: boolean;
  phone?: string;
  text?: { message?: string } | string;
  message?: string;
  buttonsResponseMessage?: { buttonId?: string; message?: string };
  From?: string;
  Body?: string;
  ButtonPayload?: string;
  salonId?: string;
  appointmentId?: string;
  buttonId?: string;
  decision?: string;
}

interface NormalizedIncomingEvent {
  provider: string;
  phoneNumberId?: string;
  senderPhone: string;
  buttonId: string;
  textBody: string;
  explicitSalonId?: string;
  explicitAppointmentId?: string;
  explicitDecision?: "confirm" | "cancel";
}

function extractWebhookEvents(body: MetaWebhookBody, paramSalonId?: string): NormalizedIncomingEvent[] {
  const events: NormalizedIncomingEvent[] = [];

  // 1. Meta WhatsApp Cloud API
  if (Array.isArray(body.entry) && body.entry.length > 0) {
    for (const entry of body.entry) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        const messages = Array.isArray(value?.messages) ? value.messages : [];
        for (const msg of messages) {
          events.push({
            provider: "WhatsApp Oficial",
            phoneNumberId,
            senderPhone: String(msg.from || ""),
            buttonId: String(msg.interactive?.button_reply?.id || msg.button?.payload || ""),
            textBody: String(
              msg.text?.body || msg.interactive?.button_reply?.title || msg.button?.text || ""
            ),
            explicitSalonId: paramSalonId,
          });
        }
      }
    }
    return events;
  }

  // 2. Evolution API (messages.upsert)
  if (body.data?.key && body.data.key.fromMe !== true) {
    const jid = String(body.data.key.remoteJid || "");
    const senderDigits = jid.split("@")[0] || "";
    const msg = body.data.message || {};
    events.push({
      provider: "WhatsApp (Evolution)",
      senderPhone: senderDigits,
      buttonId: String(
        msg.buttonsResponseMessage?.selectedButtonId ||
          msg.templateButtonReplyMessage?.selectedId ||
          ""
      ),
      textBody: String(
        msg.conversation ||
          msg.extendedTextMessage?.text ||
          msg.buttonsResponseMessage?.selectedDisplayText ||
          msg.templateButtonReplyMessage?.selectedDisplayText ||
          ""
      ),
      explicitSalonId: paramSalonId || body.salonId,
    });
    return events;
  }

  // 3. Z-API
  if (body.phone && body.fromMe !== true) {
    const zText =
      typeof body.text === "object" && body.text !== null
        ? String(body.text.message || "")
        : typeof body.text === "string"
          ? body.text
          : "";
    events.push({
      provider: "WhatsApp (Z-API)",
      senderPhone: String(body.phone),
      buttonId: String(body.buttonsResponseMessage?.buttonId || body.buttonId || ""),
      textBody: zText || String(body.buttonsResponseMessage?.message || body.message || ""),
      explicitSalonId: paramSalonId || body.salonId,
    });
    return events;
  }

  // 4. Twilio WhatsApp or Generic JSON Webhook
  if (body.From || body.phone || body.buttonId || body.appointmentId || body.message || body.Body) {
    const rawFrom = String(body.From || body.phone || "").replace(/^whatsapp:/i, "");
    const explicitDec =
      body.decision === "confirm" || body.decision === "cancel" ? body.decision : undefined;
    events.push({
      provider: body.From ? "WhatsApp (Twilio)" : "WhatsApp Webhook",
      senderPhone: rawFrom,
      buttonId: String(body.ButtonPayload || body.buttonId || ""),
      textBody: String(body.Body || body.message || (typeof body.text === "string" ? body.text : "")),
      explicitSalonId: paramSalonId || body.salonId,
      explicitAppointmentId: body.appointmentId,
      explicitDecision: explicitDec,
    });
  }

  return events;
}

async function validateSalonWebhookSecretIfConfigured(
  adminDb: FirebaseFirestore.Firestore,
  salonId: string,
  req: Request
): Promise<boolean> {
  const waSnap = await adminDb
    .doc(`salons/${salonId}/integrations/whatsapp`)
    .get()
    .catch(() => null);
  const configuredSecret = String(waSnap?.data()?.webhookSecret || "").trim();
  if (!configuredSecret) return true;

  const providedSecret = String(
    req.headers["x-webhook-secret"] || req.query.secret || req.query.token || ""
  ).trim();
  if (providedSecret && safeTimingEqual(providedSecret, configuredSecret)) {
    return true;
  }

  // Also allow Meta Hub signature if computed over JSON body
  const hubSig = String(req.headers["x-hub-signature-256"] || "").trim();
  if (hubSig.startsWith("sha256=")) {
    const expected =
      "sha256=" +
      crypto
        .createHmac("sha256", configuredSecret)
        .update(JSON.stringify(req.body || {}))
        .digest("hex");
    if (safeTimingEqual(hubSig, expected)) return true;
  }

  return false;
}

async function handleWebhookEvents(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as MetaWebhookBody;
    const paramSalonId =
      typeof req.params.salonId === "string" && SAFE_ID_REGEX.test(req.params.salonId)
        ? req.params.salonId
        : typeof req.query.salonId === "string" && SAFE_ID_REGEX.test(req.query.salonId)
          ? req.query.salonId
          : undefined;

    const adminDb = getAdminDb();
    const events = extractWebhookEvents(body, paramSalonId);
    const updatedAppointments: Array<{ salonId: string; appointmentId: string; status: string }> = [];

    for (const ev of events) {
      // A. Botão interativo com token embutido: CONFIRM_APPT|salonId|appointmentId|token
      if (
        ev.buttonId.startsWith("CONFIRM_APPT|") ||
        ev.buttonId.startsWith("CANCEL_APPT|")
      ) {
        const parts = ev.buttonId.split("|");
        if (parts.length === 4) {
          const [actionPrefix, salonId, appointmentId, token] = parts;
          if (!SAFE_ID_REGEX.test(salonId) || !SAFE_ID_REGEX.test(appointmentId)) {
            continue;
          }
          const apptRef = adminDb.doc(`salons/${salonId}/appointments/${appointmentId}`);
          const apptSnap = await apptRef.get();
          if (!apptSnap.exists) continue;
          const appt = apptSnap.data() || {};
          const storedToken = String(appt.confirmToken || "");
          if (!storedToken || !safeTimingEqual(storedToken, token)) continue;
          if (appt.status === "completed" || appt.status === "blocked") continue;

          const decision = actionPrefix === "CONFIRM_APPT" ? "confirm" : "cancel";
          await applyWebhookAppointmentDecision({
            adminDb,
            salonId,
            apptRef,
            apptData: appt,
            decision,
            channel: "whatsapp_cloud",
            provider: ev.provider,
            senderPhone: normalizeBrazilPhone(ev.senderPhone),
          });
          updatedAppointments.push({
            salonId,
            appointmentId,
            status: decision === "confirm" ? "confirmed" : "canceled",
          });
        }
        continue;
      }

      // B. Resposta por texto ("SIM", "CONFIRMO", "NAO", "CANCELAR") ou payload explícito
      const decision = ev.explicitDecision || classifyWhatsAppReply(ev.textBody);
      if (!decision) continue;

      const resolvedSalonId = await resolveSalonIdForPhoneNumberId(
        adminDb,
        ev.phoneNumberId,
        ev.explicitSalonId
      );
      if (!resolvedSalonId) continue;

      const secretOk = await validateSalonWebhookSecretIfConfigured(adminDb, resolvedSalonId, req);
      if (!secretOk) continue;

      let matchedDoc: FirebaseFirestore.DocumentSnapshot | null = null;

      if (ev.explicitAppointmentId && SAFE_ID_REGEX.test(ev.explicitAppointmentId)) {
        const directSnap = await adminDb
          .doc(`salons/${resolvedSalonId}/appointments/${ev.explicitAppointmentId}`)
          .get();
        if (directSnap.exists) matchedDoc = directSnap;
      } else {
        const senderDigits = normalizeBrazilPhone(ev.senderPhone);
        matchedDoc = await matchAppointmentByPhone(adminDb, resolvedSalonId, senderDigits);
      }

      if (matchedDoc && matchedDoc.exists) {
        const d = matchedDoc.data() || {};
        if (d.status === "completed" || d.status === "blocked") continue;

        await applyWebhookAppointmentDecision({
          adminDb,
          salonId: resolvedSalonId,
          apptRef: matchedDoc.ref,
          apptData: d,
          decision,
          channel: ev.phoneNumberId ? "whatsapp_cloud" : "whatsapp_webhook",
          provider: ev.provider,
          senderPhone: normalizeBrazilPhone(ev.senderPhone),
        });
        updatedAppointments.push({
          salonId: resolvedSalonId,
          appointmentId: matchedDoc.id,
          status: decision === "confirm" ? "confirmed" : "canceled",
        });
      }
    }

    return res.status(200).json({
      received: true,
      processedCount: updatedAppointments.length,
      updatedAppointments,
    });
  } catch (err) {
    console.error("[WhatsApp Webhook POST]", err);
    return res.status(200).json({ received: true, processedCount: 0, updatedAppointments: [] });
  }
}

router.post("/whatsapp-webhook", handleWebhookEvents);
router.post("/whatsapp-webhook/:salonId", handleWebhookEvents);

// =====================================================
// 6. SIMULAÇÃO AUTENTICADA DO WEBHOOK PARA TESTE EM TEMPO REAL
// =====================================================

const testWebhookSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  appointmentId: z.string().regex(SAFE_ID_REGEX).optional(),
  decision: z.enum(["confirm", "cancel"]).optional().default("confirm"),
});

router.post("/test-whatsapp-webhook", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = testWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parâmetros inválidos para simulação do webhook." });
    }

    const { salonId, appointmentId, decision } = parsed.data;
    const auth = await authorizeSalonAccess(req, salonId, SALON_OPERATIONAL_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const adminDb = getAdminDb();
    let targetDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    if (appointmentId) {
      const snap = await adminDb.doc(`salons/${salonId}/appointments/${appointmentId}`).get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }
      targetDoc = snap;
    } else {
      const snap = await adminDb
        .collection(`salons/${salonId}/appointments`)
        .where("status", "==", "scheduled")
        .limit(20)
        .get();
      const nonBlocks = snap.docs.filter((d) => !d.data()?.isBlock);
      if (nonBlocks.length > 0) {
        nonBlocks.sort((a, b) => {
          const ka = `${a.data()?.date || ""}T${a.data()?.time || "00:00"}`;
          const kb = `${b.data()?.date || ""}T${b.data()?.time || "00:00"}`;
          return ka.localeCompare(kb);
        });
        targetDoc = nonBlocks[0];
      }
    }

    if (!targetDoc) {
      return res.status(404).json({
        error: "Nenhum agendamento com status 'Agendado' encontrado para simular a confirmação.",
      });
    }

    const appt = targetDoc.data() || {};
    if (appt.status === "completed" || appt.status === "blocked") {
      return res.status(400).json({
        error: "Agendamentos concluídos ou bloqueios não podem receber confirmação.",
      });
    }

    await applyWebhookAppointmentDecision({
      adminDb,
      salonId,
      apptRef: targetDoc.ref,
      apptData: appt,
      decision,
      channel: "whatsapp_cloud",
      provider: "Webhook WhatsApp (Teste)",
      senderPhone: normalizeBrazilPhone(String(appt.clientPhone || "")),
    });

    return res.json({
      success: true,
      appointmentId: targetDoc.id,
      clientName: String(appt.clientName || "Cliente"),
      status: decision === "confirm" ? "confirmed" : "canceled",
    });
  } catch (err) {
    console.error("[Test WhatsApp Webhook]", err);
    return res.status(500).json({ error: "Erro ao executar simulação do webhook." });
  }
});

export { router as appointmentsRoutes };

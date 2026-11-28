import { Router, Request, Response } from "express";
import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env.js";
import { getAdminDb, isFirebaseAdminCredentialError } from "../shared/firebaseAdmin.js";
import { resolvePlatformAdmin, verifyIdToken } from "../shared/auth.js";
import { adminLimiter, aiLimiter } from "../middleware/rateLimiter.js";
import { formatBrazilPhoneE164 } from "../services/crmWebhookSync.js";

const router = Router();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const FRONT_DESK_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "receptionist",
  "attendant",
  "platform_admin",
]);

function phoneTail(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

async function authorizeSalon(req: Request, salonId: string) {
  const decoded = await verifyIdToken(req);
  const adminDb = getAdminDb();

  if (!SAFE_ID_REGEX.test(salonId)) {
    throw { status: 400, message: "salonId inválido." };
  }

  const salonSnap = await adminDb.doc(`salons/${salonId}`).get();
  if (!salonSnap.exists) {
    throw { status: 404, message: "Salão não encontrado." };
  }

  const isPlatform = await resolvePlatformAdmin(decoded, adminDb);
  if (isPlatform) {
    return { adminDb, uid: decoded.uid, role: "platform_admin", salonData: salonSnap.data() };
  }

  if (salonSnap.data()?.ownerId === decoded.uid) {
    return { adminDb, uid: decoded.uid, role: "owner", salonData: salonSnap.data() };
  }

  const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
  const uData = userSnap.data();
  if (
    uData?.salonId === salonId &&
    FRONT_DESK_ROLES.has(String(uData?.role || "").toLowerCase())
  ) {
    return { adminDb, uid: decoded.uid, role: String(uData.role), salonData: salonSnap.data() };
  }

  throw { status: 403, message: "Sem permissão operacional para acessar o CRM deste salão." };
}

async function withDeveloperAuth<T>(
  apiKey: string,
  fn: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
  const prevCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const prevGcloudProject = process.env.GOOGLE_GCLOUD_PROJECT;
  const prevCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const prevGcloudProj = process.env.GCLOUD_PROJECT;
  const prevGcpProject = process.env.GCP_PROJECT;
  const prevMetadataHost = process.env.GCP_METADATA_HOST;
  const prevDetectMetadata = process.env.DETECT_GCP_METADATA;

  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_GCLOUD_PROJECT;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.GCP_PROJECT;

  process.env.GCP_METADATA_HOST = "localhost";
  process.env.DETECT_GCP_METADATA = "false";

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
          Authorization: "",
        },
      },
    });
    return await fn(ai);
  } finally {
    if (prevCredentials) process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCredentials;
    if (prevGcloudProject) process.env.GOOGLE_GCLOUD_PROJECT = prevGcloudProject;
    if (prevCloudProject) process.env.GOOGLE_CLOUD_PROJECT = prevCloudProject;
    if (prevGcloudProj) process.env.GCLOUD_PROJECT = prevGcloudProj;
    if (prevGcpProject) process.env.GCP_PROJECT = prevGcpProject;
    if (prevMetadataHost) process.env.GCP_METADATA_HOST = prevMetadataHost;
    else delete process.env.GCP_METADATA_HOST;
    if (prevDetectMetadata) process.env.DETECT_GCP_METADATA = prevDetectMetadata;
    else delete process.env.DETECT_GCP_METADATA;
  }
}

async function sendWhatsAppCloudText(
  phoneNumberId: string,
  accessToken: string,
  toPhone: string,
  textBody: string
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toPhone,
          type: "text",
          text: { body: textBody },
        }),
      }
    );
    const json = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      return { ok: false, error: json.error?.message || `HTTP ${response.status}` };
    }
    return { ok: true, waMessageId: json.messages?.[0]?.id };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro de rede Cloud API." };
  }
}

// =====================================================
// 1. SEND MESSAGE VIA CLOUD API OR LINK + SLA TRACKING
// =====================================================

const sendMessageSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  conversationId: z.string().regex(SAFE_ID_REGEX),
  body: z.string().min(1).max(4000),
  attendantId: z.string().optional(),
  attendantName: z.string().optional(),
  useSignature: z.boolean().optional(),
  senderType: z.enum(["attendant", "ai"]).optional(),
});

router.post("/messages/send", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido.", details: parsed.error.flatten() });
    }

    const { salonId, conversationId, body, attendantId, attendantName, useSignature, senderType } =
      parsed.data;

    const { adminDb, uid } = await authorizeSalon(req, salonId);
    const convRef = adminDb.doc(`salons/${salonId}/crmConversations/${conversationId}`);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
      return res.status(404).json({ error: "Conversa não encontrada." });
    }
    const convData = convSnap.data() || {};

    const cleanPhone = formatBrazilPhoneE164(String(convData.clientPhone || ""));
    const finalSenderType = senderType || "attendant";
    const resolvedName = attendantName?.trim() || "Equipe";
    const formattedBody =
      useSignature && finalSenderType === "attendant"
        ? `*${resolvedName}:*\n${body.trim()}`
        : body.trim();

    let sentViaCloudApi = false;
    let waMessageId: string | undefined;
    let cloudApiError: string | undefined;

    const waSnap = await adminDb.doc(`salons/${salonId}/integrations/whatsapp`).get();
    const waConfig = waSnap.exists ? waSnap.data() : null;
    if (waConfig?.enabled && waConfig?.phoneNumberId && waConfig?.accessToken && cleanPhone) {
      const cloudRes = await sendWhatsAppCloudText(
        String(waConfig.phoneNumberId),
        String(waConfig.accessToken),
        cleanPhone,
        formattedBody
      );
      sentViaCloudApi = cloudRes.ok;
      waMessageId = cloudRes.waMessageId;
      cloudApiError = cloudRes.error;
    }

    const now = Date.now();
    const msgRef = adminDb
      .collection(`salons/${salonId}/crmConversations/${conversationId}/messages`)
      .doc();

    await msgRef.set({
      id: msgRef.id,
      conversationId,
      direction: "outbound",
      senderType: finalSenderType,
      senderId: attendantId || uid,
      senderName: finalSenderType === "ai" ? "Lumi IA" : resolvedName,
      body: formattedBody,
      mediaType: "text",
      deliveryStatus: sentViaCloudApi ? "sent" : "queued",
      ...(waMessageId ? { waMessageId } : {}),
      createdAt: now,
    });

    // Compute SLA firstResponseMs if this is the first response after lastInboundAt
    const firstResponseMs =
      !convData.firstResponseAt && convData.lastInboundAt
        ? Math.max(1000, now - Number(convData.lastInboundAt))
        : Number(convData.firstResponseMs || 0);

    await convRef.set(
      {
        status: "in_service",
        handlingMode: finalSenderType === "ai" ? "ai" : "human",
        assignedAttendantId: convData.assignedAttendantId || attendantId || uid,
        assignedAttendantName: convData.assignedAttendantName || resolvedName,
        unreadCount: 0,
        lastMessageText: body.trim().slice(0, 500),
        lastMessageAt: now,
        lastMessageDirection: "outbound",
        ...(convData.firstResponseAt ? {} : { firstResponseAt: now, firstResponseMs }),
        updatedAt: now,
      },
      { merge: true }
    );

    if (convData.opportunityId) {
      const oppRef = adminDb.doc(
        `salons/${salonId}/crmOpportunities/${String(convData.opportunityId)}`
      );
      const oppSnap = await oppRef.get();
      const oppStage = oppSnap.data()?.stage;
      await oppRef.set(
        {
          waitingSince: 0,
          ...(oppStage === "awaiting_reply" ? { stage: "in_service" } : {}),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    const waLink = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedBody)}`
      : "";

    return res.json({
      success: true,
      mode: sentViaCloudApi ? "whatsapp_cloud" : "wa_link",
      sentViaCloudApi,
      waLink,
      cloudApiError,
    });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        code: "ADMIN_UNAVAILABLE",
        error: "Firebase Admin indisponível no sandbox local.",
      });
    }
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Erro ao enviar mensagem.";
    return res.status(status).json({ error: message });
  }
});

// =====================================================
// 2. LUMI IA COPILOT FOR CRM (@google/genai)
// =====================================================

const aiAssistSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  clientName: z.string().min(1).max(160),
  clientVisitsCount: z.number().min(0).default(0),
  action: z.enum(["suggest_reply", "qualify_opportunity", "recovery_draft"]),
  transcript: z
    .array(
      z.object({
        direction: z.enum(["inbound", "outbound", "system"]),
        body: z.string(),
      })
    )
    .max(20),
  tone: z.enum(["acolhedor", "sofisticado", "objetivo"]).optional(),
  customInstructions: z.string().max(1500).optional(),
  opportunityId: z.string().optional(),
});

router.post("/ai/assist", aiLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = aiAssistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parâmetros inválidos para a Lumi IA." });
    }

    const apiKey = env.gemini.apiKey;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
      return res.status(503).json({
        code: "GEMINI_NOT_CONFIGURED",
        error:
          "GEMINI_API_KEY não configurada no servidor. Configure a chave para habilitar o Copiloto Lumi IA.",
      });
    }

    const { salonId, clientName, clientVisitsCount, action, transcript, tone, customInstructions, opportunityId } =
      parsed.data;

    const { adminDb, salonData } = await authorizeSalon(req, salonId);

    // Fetch real active services from Firestore so AI never invents services or prices
    const servicesSnap = await adminDb
      .collection(`salons/${salonId}/services`)
      .limit(80)
      .get();
    const serviceCatalog = servicesSnap.docs
      .map((d) => d.data())
      .filter((s) => s.active !== false)
      .map((s) => `- ${s.name}: R$ ${Number(s.price || 0).toFixed(2)}`)
      .join("\n");

    const settingsSnap = await adminDb.doc(`salons/${salonId}/crmSettings/config`).get();
    const aiSettings = settingsSnap.exists ? settingsSnap.data()?.aiConfig : null;

    const resolvedTone = tone || aiSettings?.tone || "sofisticado";
    const resolvedInstructions =
      customInstructions || aiSettings?.qualificationInstructions || "";
    const agentName = aiSettings?.agentName || "Lumi";

    const conversationText = transcript
      .map((m) =>
        `${m.direction === "inbound" ? clientName : m.direction === "outbound" ? "Salão" : "Sistema"}: ${m.body}`
      )
      .join("\n");

    const actionGoal =
      action === "recovery_draft"
        ? "Crie uma mensagem elegante e breve de retomada (follow-up) no WhatsApp para reativar o interesse deste contato sem parecer robótico."
        : action === "qualify_opportunity"
          ? "Qualifique a conversa identificando o serviço mais provável do catálogo, estime o valor realista em reais e recomende a etapa do funil."
          : "Sugira a melhor próxima resposta pronta para ser enviada no WhatsApp pela equipe do salão.";

    const prompt = `Você é ${agentName}, copiloto comercial do salão "${String(salonData?.name || "Lumière Atelier")}".
Tom de voz obrigatório: ${resolvedTone}.
Instruções específicas do salão: ${resolvedInstructions || "Atendimento humano, acolhedor e elegante."}

Cliente: ${clientName} (visitas recentes registradas: ${clientVisitsCount})
Objetivo da ação (${action}): ${actionGoal}

Catálogo REAL de serviços (nunca invente valores fora desta lista; se não houver menção, retorne estimatedValue 0):
${serviceCatalog || "Nenhum serviço cadastrado no catálogo."}

Histórico recente da conversa:
${conversationText || "Sem mensagens prévias."}

Responda estritamente no JSON estruturado solicitado.`;

    const resultJson = await withDeveloperAuth(apiKey, async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedReply: { type: Type.STRING },
              detectedService: { type: Type.STRING },
              estimatedValue: { type: Type.NUMBER },
              recommendedStage: {
                type: Type.STRING,
                enum: ["awaiting_reply", "in_service", "interested", "scheduled", "lost", "other"],
              },
              handoffRecommended: { type: Type.BOOLEAN },
              intentSummary: { type: Type.STRING },
            },
            required: [
              "suggestedReply",
              "detectedService",
              "estimatedValue",
              "recommendedStage",
              "handoffRecommended",
              "intentSummary",
            ],
          },
        },
      });
      return JSON.parse(response.text || "{}");
    });

    if (opportunityId && SAFE_ID_REGEX.test(opportunityId)) {
      const oppRef = adminDb.doc(`salons/${salonId}/crmOpportunities/${opportunityId}`);
      const oppSnap = await oppRef.get();
      if (oppSnap.exists) {
        const updatePayload: Record<string, unknown> = {
          updatedAt: Date.now(),
        };
        if (resultJson.detectedService) {
          updatePayload.serviceInterest = String(resultJson.detectedService);
        }
        if (typeof resultJson.estimatedValue === "number" && resultJson.estimatedValue > 0) {
          updatePayload.estimatedValue = resultJson.estimatedValue;
          updatePayload.valueSource = "ai";
        }
        await oppRef.set(updatePayload, { merge: true });
      }
    }

    return res.json({
      success: true,
      suggestedReply: String(resultJson.suggestedReply || ""),
      detectedService: String(resultJson.detectedService || ""),
      estimatedValue: Number(resultJson.estimatedValue || 0),
      recommendedStage: resultJson.recommendedStage || "in_service",
      handoffRecommended: Boolean(resultJson.handoffRecommended),
      intentSummary: String(resultJson.intentSummary || ""),
    });
  } catch (err: unknown) {
    console.error("[CRM AI Assist Error]", err);
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Erro ao consultar Gemini.";
    return res.status(status).json({ error: message });
  }
});

// =====================================================
// 3. CAMPAIGN AUDIENCE EVALUATION & SAFE DISPATCH
// =====================================================

const evaluateSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  campaignType: z.enum([
    "confirmation",
    "birthday",
    "service_return",
    "inactive_clients",
    "post_service_csat",
    "promotion",
  ]),
  messageTemplate: z.string().min(1),
  dailyLimit: z.number().min(1).max(500).default(50),
  inactiveMonths: z.number().min(1).max(24).default(3),
  defaultReturnDays: z.number().min(1).max(365).default(45),
  promoServiceName: z.string().max(160).optional(),
});

router.post("/campaigns/evaluate", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = evaluateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parâmetros inválidos para avaliação." });
    }
    const {
      salonId,
      campaignType,
      messageTemplate,
      dailyLimit,
      inactiveMonths,
      defaultReturnDays,
      promoServiceName,
    } = parsed.data;

    const { adminDb, salonData } = await authorizeSalon(req, salonId);
    const salonName = String(salonData?.name || "Nosso Salão");

    const [clientsSnap, apptsSnap] = await Promise.all([
      adminDb.collection(`salons/${salonId}/clients`).limit(500).get(),
      adminDb.collection(`salons/${salonId}/appointments`).limit(800).get(),
    ]);

    const clients = clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<
      Record<string, unknown> & { id: string }
    >;
    const appointments = apptsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<
      Record<string, unknown> & { id: string }
    >;

    const today = new Date();
    const todayYmd = today.toISOString().slice(0, 10);
    const tomorrowYmd = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const currentMonth = todayYmd.slice(5, 7);

    const renderMsg = (cName: string, service?: string, date?: string, time?: string) => {
      const first = cName.trim().split(/\s+/)[0] || "Cliente";
      return messageTemplate
        .replace(/\{cliente\}/g, first)
        .replace(/\{cliente_completo\}/g, cName)
        .replace(/\{salao\}/g, salonName)
        .replace(/\{servico\}/g, service || "seu atendimento")
        .replace(/\{data\}/g, date || "")
        .replace(/\{hora\}/g, time || "");
    };

    const candidates: Array<{
      clientId: string;
      clientName: string;
      clientPhone: string;
      reason: string;
      renderedMessage: string;
      eligible: boolean;
      blockedReason?: string;
    }> = [];

    if (campaignType === "confirmation") {
      appointments
        .filter(
          (a) =>
            !a.isBlock &&
            (a.date === todayYmd || a.date === tomorrowYmd) &&
            a.status === "scheduled"
        )
        .forEach((a) => {
          const client = clients.find((c) => c.id === a.clientId);
          const phone = String(a.clientPhone || client?.phone || "");
          const dateBr = String(a.date || "").split("-").reverse().join("/");
          const cName = String(a.clientName || "Cliente");
          candidates.push({
            clientId: String(a.clientId || a.id),
            clientName: cName,
            clientPhone: phone,
            reason: `Horário ${dateBr} às ${String(a.time || "")}`,
            renderedMessage: renderMsg(cName, String(a.serviceName || ""), dateBr, String(a.time || "")),
            eligible: Boolean(phone),
            blockedReason: phone ? undefined : "Sem WhatsApp cadastrado",
          });
        });
    } else if (campaignType === "birthday") {
      clients
        .filter(
          (c) =>
            !c.deletedAt &&
            !c.archived &&
            String(c.birthDate || "").slice(5, 7) === currentMonth
        )
        .forEach((c) => {
          const bDate = String(c.birthDate || "");
          const cName = String(c.name || "Cliente");
          const phone = String(c.phone || "");
          candidates.push({
            clientId: c.id,
            clientName: cName,
            clientPhone: phone,
            reason: `Aniversário ${bDate.slice(8, 10)}/${bDate.slice(5, 7)}`,
            renderedMessage: renderMsg(cName),
            eligible: Boolean(phone),
            blockedReason: phone ? undefined : "Sem WhatsApp cadastrado",
          });
        });
    } else if (campaignType === "post_service_csat") {
      appointments
        .filter((a) => !a.isBlock && a.status === "completed")
        .slice(0, dailyLimit)
        .forEach((a) => {
          const client = clients.find((c) => c.id === a.clientId);
          const phone = String(a.clientPhone || client?.phone || "");
          const cName = String(a.clientName || "Cliente");
          candidates.push({
            clientId: String(a.clientId || a.id),
            clientName: cName,
            clientPhone: phone,
            reason: `Concluiu ${String(a.serviceName || "")}`,
            renderedMessage: renderMsg(cName, String(a.serviceName || "")),
            eligible: Boolean(phone),
            blockedReason: phone ? undefined : "Sem telefone",
          });
        });
    } else if (campaignType === "promotion") {
      const nextWeekYmd = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
      clients
        .filter((c) => !c.deletedAt && !c.archived)
        .forEach((c) => {
          const cName = String(c.name || "Cliente");
          const phone = String(c.phone || "");
          const hasUpcoming = appointments.some(
            (a) =>
              a.clientId === c.id &&
              String(a.date || "") >= todayYmd &&
              String(a.date || "") <= nextWeekYmd &&
              a.status !== "canceled" &&
              a.status !== "no_show"
          );
          const lastCompleted = appointments
            .filter((a) => a.clientId === c.id && a.status === "completed")
            .sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")))[0];
          candidates.push({
            clientId: c.id,
            clientName: cName,
            clientPhone: phone,
            reason: promoServiceName ? `Oferta: ${promoServiceName}` : "Base ativa elegível",
            renderedMessage: renderMsg(
              cName,
              promoServiceName || String(lastCompleted?.serviceName || "nossos serviços")
            ),
            eligible: Boolean(phone) && !hasUpcoming,
            blockedReason: !phone ? "Sem WhatsApp" : hasUpcoming ? "Já possui horário próximo" : undefined,
          });
        });
    } else {
      const minDays =
        campaignType === "inactive_clients" ? inactiveMonths * 30 : Math.max(7, defaultReturnDays - 8);
      clients
        .filter((c) => !c.deletedAt && !c.archived)
        .forEach((c) => {
          const cName = String(c.name || "Cliente");
          const phone = String(c.phone || "");
          const completed = appointments
            .filter((a) => a.clientId === c.id && a.status === "completed")
            .sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
          const hasFuture = appointments.some(
            (a) =>
              a.clientId === c.id &&
              String(a.date || "") >= todayYmd &&
              a.status !== "canceled" &&
              a.status !== "no_show"
          );
          const refDate = String(
            completed[0]?.date ||
              new Date(Number(c.createdAt || today.getTime())).toISOString().slice(0, 10)
          );
          const elapsedDays = Math.round(
            (today.getTime() - new Date(`${refDate}T12:00:00`).getTime()) / 86400000
          );
          if (elapsedDays < minDays) return;
          candidates.push({
            clientId: c.id,
            clientName: cName,
            clientPhone: phone,
            reason: `Última visita há ${elapsedDays} dias`,
            renderedMessage: renderMsg(cName, String(completed[0]?.serviceName || "")),
            eligible: Boolean(phone) && !hasFuture,
            blockedReason: !phone ? "Sem WhatsApp" : hasFuture ? "Já possui horário futuro" : undefined,
          });
        });
    }

    const eligibleCount = candidates.filter((c) => c.eligible).length;
    return res.json({
      success: true,
      totalEvaluated: candidates.length,
      eligibleCount,
      estimatedDaysToClear: eligibleCount > 0 ? Math.max(1, Math.ceil(eligibleCount / dailyLimit)) : 0,
      candidates: candidates.slice(0, dailyLimit),
    });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        code: "ADMIN_UNAVAILABLE",
        error: "Firebase Admin indisponível no sandbox local.",
      });
    }
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Erro ao avaliar público.";
    return res.status(status).json({ error: message });
  }
});

const dispatchSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  campaignId: z.string().regex(SAFE_ID_REGEX),
  campaignType: z.enum([
    "confirmation",
    "birthday",
    "service_return",
    "inactive_clients",
    "post_service_csat",
    "promotion",
  ]),
  recipients: z
    .array(
      z.object({
        clientId: z.string().optional(),
        clientName: z.string(),
        clientPhone: z.string(),
        renderedMessage: z.string(),
      })
    )
    .max(50),
});

router.post("/campaigns/dispatch", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = dispatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload de disparo inválido." });
    }
    const { salonId, campaignId, campaignType, recipients } = parsed.data;
    const { adminDb } = await authorizeSalon(req, salonId);

    const waSnap = await adminDb.doc(`salons/${salonId}/integrations/whatsapp`).get();
    const waConfig = waSnap.exists ? waSnap.data() : null;
    const cloudEnabled = Boolean(
      waConfig?.enabled && waConfig?.phoneNumberId && waConfig?.accessToken
    );

    const now = Date.now();
    let sentCloudCount = 0;
    const waLinks: Array<{ clientName: string; waLink: string }> = [];

    for (const recipient of recipients) {
      const cleanPhone = formatBrazilPhoneE164(recipient.clientPhone);
      if (!cleanPhone) continue;

      let status: "sent" | "failed" = "sent";
      let statusReason = "Registrado via fila do CRM";

      if (cloudEnabled) {
        const cloudRes = await sendWhatsAppCloudText(
          String(waConfig!.phoneNumberId),
          String(waConfig!.accessToken),
          cleanPhone,
          recipient.renderedMessage
        );
        if (cloudRes.ok) {
          sentCloudCount += 1;
          statusReason = "Enviado via WhatsApp Cloud API";
        } else {
          status = "failed";
          statusReason = cloudRes.error || "Falha na Cloud API";
        }
      } else {
        waLinks.push({
          clientName: recipient.clientName,
          waLink: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(recipient.renderedMessage)}`,
        });
      }

      const dispRef = adminDb.collection(`salons/${salonId}/crmCampaignDispatches`).doc();
      await dispRef.set({
        id: dispRef.id,
        campaignId,
        campaignType,
        clientId: recipient.clientId || "",
        clientName: recipient.clientName,
        clientPhone: cleanPhone,
        status,
        statusReason,
        renderedMessage: recipient.renderedMessage,
        dispatchedAt: now,
        createdAt: now,
      });

      // Optionally sync conversation tail match
      const pTail = phoneTail(cleanPhone);
      if (pTail) {
        const convRef = adminDb.doc(`salons/${salonId}/crmConversations/wa_${pTail}`);
        const convSnap = await convRef.get();
        if (convSnap.exists) {
          await adminDb
            .collection(`salons/${salonId}/crmConversations/wa_${pTail}/messages`)
            .doc()
            .set({
              direction: "outbound",
              senderType: "system",
              senderName: `Campanha (${campaignType})`,
              body: recipient.renderedMessage,
              mediaType: "text",
              deliveryStatus: cloudEnabled && status === "sent" ? "sent" : "queued",
              createdAt: now,
            });
        }
      }
    }

    const campRef = adminDb.doc(`salons/${salonId}/crmCampaigns/${campaignId}`);
    const campSnap = await campRef.get();
    const prevMetrics = campSnap.exists ? campSnap.data()?.metrics || {} : {};
    await campRef.set(
      {
        lastRunAt: now,
        updatedAt: now,
        metrics: {
          ...prevMetrics,
          sentCount: Number(prevMetrics.sentCount || 0) + recipients.length,
          deliveredCount: Number(prevMetrics.deliveredCount || 0) + recipients.length,
        },
      },
      { merge: true }
    );

    return res.json({
      success: true,
      dispatchedCount: recipients.length,
      sentCloudCount,
      queuedWaLinksCount: waLinks.length,
      waLinks: waLinks.slice(0, 10),
    });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        code: "ADMIN_UNAVAILABLE",
        error: "Firebase Admin indisponível no sandbox local.",
      });
    }
    const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 500;
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Erro ao disparar campanha.";
    return res.status(status).json({ error: message });
  }
});

export { router as crmRoutes };

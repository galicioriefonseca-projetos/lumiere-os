import { Router, Request, Response } from "express";
import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env.js";
import {
  getAdminDb,
  isFirebaseAdminCredentialError,
} from "../shared/firebaseAdmin.js";
import { resolvePlatformAdmin, verifyIdToken } from "../shared/auth.js";
import { adminLimiter, aiLimiter } from "../middleware/rateLimiter.js";
import { formatBrazilPhoneE164 } from "../services/crmWebhookSync.js";

const router = Router();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const SALON_OPERATIONAL_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "receptionist",
  "attendant",
  "platform_admin",
]);

const SALON_MANAGEMENT_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "platform_admin",
]);

interface AuthContext {
  uid: string;
  email: string;
  role: string;
  isPlatformAdmin: boolean;
}

async function authorizeSalon(
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
      return {
        ok: false,
        status: 503,
        error: "Serviço administrativo indisponível neste ambiente.",
      };
    }
    const msg = err instanceof Error ? err.message : "Token de autenticação inválido.";
    return { ok: false, status: 401, error: msg };
  }

  const uid = String(decoded.uid || "").trim();
  const email = String(decoded.email || "").trim().toLowerCase();
  const adminDb = getAdminDb();

  const isMaster = await resolvePlatformAdmin(decoded, adminDb);
  if (isMaster) {
    return {
      ok: true,
      ctx: { uid, email, role: "platform_admin", isPlatformAdmin: true },
    };
  }

  if (salonId === "tutorial_lumiere_studio") {
    return {
      ok: true,
      ctx: { uid, email, role: "owner", isPlatformAdmin: false },
    };
  }

  const [userSnap, salonSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("salons").doc(salonId).get(),
  ]);

  const sData = salonSnap.exists ? salonSnap.data() || {} : {};
  const isOwner =
    sData.ownerId === uid ||
    (Boolean(email) &&
      typeof sData.ownerEmail === "string" &&
      sData.ownerEmail.trim().toLowerCase() === email);

  if (isOwner) {
    return { ok: true, ctx: { uid, email, role: "owner", isPlatformAdmin: false } };
  }

  const uData = userSnap.exists ? userSnap.data() || {} : {};
  const userRole = String(uData.role || "").trim();
  if (uData.salonId !== salonId || !allowedRoles.has(userRole)) {
    return {
      ok: false,
      status: 403,
      error: "Seu perfil não possui permissão para esta operação no CRM.",
    };
  }

  return { ok: true, ctx: { uid, email, role: userRole, isPlatformAdmin: false } };
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
    if (prevMetadataHost) {
      process.env.GCP_METADATA_HOST = prevMetadataHost;
    } else {
      delete process.env.GCP_METADATA_HOST;
    }
    if (prevDetectMetadata) {
      process.env.DETECT_GCP_METADATA = prevDetectMetadata;
    } else {
      delete process.env.DETECT_GCP_METADATA;
    }
  }
}

async function dispatchWhatsAppText(
  adminDb: FirebaseFirestore.Firestore,
  salonId: string,
  rawPhone: string,
  messageBody: string
): Promise<{
  mode: "whatsapp_cloud" | "wa_link";
  sentViaCloudApi: boolean;
  waLink: string;
  waMessageId?: string;
  cloudApiError?: string;
}> {
  const cleanPhone = formatBrazilPhoneE164(rawPhone);
  const waLink = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageBody)}`
    : `https://wa.me/?text=${encodeURIComponent(messageBody)}`;

  const waSnap = await adminDb
    .doc(`salons/${salonId}/integrations/whatsapp`)
    .get()
    .catch(() => null);

  const waConfig = waSnap?.exists ? waSnap.data() || {} : {};
  if (
    Boolean(waConfig.enabled) &&
    typeof waConfig.phoneNumberId === "string" &&
    waConfig.phoneNumberId.trim() &&
    typeof waConfig.accessToken === "string" &&
    waConfig.accessToken.trim() &&
    cleanPhone
  ) {
    try {
      const graphUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
        waConfig.phoneNumberId.trim()
      )}/messages`;

      const graphRes = await fetch(graphUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${waConfig.accessToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { body: messageBody.slice(0, 4096) },
        }),
      });

      const graphJson = (await graphRes.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };

      if (graphRes.ok && graphJson.messages?.[0]?.id) {
        return {
          mode: "whatsapp_cloud",
          sentViaCloudApi: true,
          waLink,
          waMessageId: graphJson.messages[0].id,
        };
      }
      return {
        mode: "wa_link",
        sentViaCloudApi: false,
        waLink,
        cloudApiError: graphJson.error?.message || "Falha ao enviar via WhatsApp Cloud API.",
      };
    } catch (err: unknown) {
      return {
        mode: "wa_link",
        sentViaCloudApi: false,
        waLink,
        cloudApiError: err instanceof Error ? err.message : "Erro de rede na WhatsApp Cloud API.",
      };
    }
  }

  return {
    mode: "wa_link",
    sentViaCloudApi: false,
    waLink,
  };
}

// =====================================================
// 1. ENVIAR MENSAGEM NO CHAT DO CRM
// =====================================================

const sendMessageSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  conversationId: z.string().regex(SAFE_ID_REGEX),
  body: z.string().trim().min(1).max(4000),
  attendantId: z.string().max(128).optional(),
  attendantName: z.string().max(120).optional(),
  useSignature: z.boolean().optional(),
  senderType: z.enum(["attendant", "ai"]).optional().default("attendant"),
});

router.post("/messages/send", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos para envio de mensagem." });
    }

    const {
      salonId,
      conversationId,
      body,
      attendantId,
      attendantName,
      useSignature,
      senderType,
    } = parsed.data;

    const auth = await authorizeSalon(req, salonId, SALON_OPERATIONAL_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const adminDb = getAdminDb();
    const convRef = adminDb.doc(`salons/${salonId}/crmConversations/${conversationId}`);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
      return res.status(404).json({ error: "Conversa não encontrada." });
    }

    const conv = convSnap.data() || {};
    const finalName = (attendantName || auth.ctx.email || "Atendente").trim();
    const formattedBody = useSignature && senderType === "attendant"
      ? `*${finalName}:*\n${body}`
      : body;

    const waResult = await dispatchWhatsAppText(
      adminDb,
      salonId,
      String(conv.clientPhone || ""),
      formattedBody
    );

    const now = Date.now();
    const msgRef = convRef.collection("messages").doc();
    await msgRef.set({
      id: msgRef.id,
      conversationId,
      direction: "outbound",
      senderType,
      senderId: attendantId || auth.ctx.uid,
      senderName: senderType === "ai" ? "Lumi IA" : finalName,
      body: formattedBody,
      mediaType: "text",
      deliveryStatus: waResult.sentViaCloudApi ? "sent" : "queued",
      ...(waResult.waMessageId ? { waMessageId: waResult.waMessageId } : {}),
      createdAt: now,
    });

    const firstResponseMs =
      !conv.firstResponseAt && conv.lastInboundAt
        ? Math.max(1000, now - Number(conv.lastInboundAt))
        : conv.firstResponseMs;

    await convRef.set(
      {
        status: "in_service",
        handlingMode: senderType === "ai" ? "ai" : "human",
        assignedAttendantId: conv.assignedAttendantId || attendantId || auth.ctx.uid,
        assignedAttendantName: conv.assignedAttendantName || finalName,
        unreadCount: 0,
        lastMessageText: body.slice(0, 500),
        lastMessageAt: now,
        lastMessageDirection: "outbound",
        ...(conv.firstResponseAt ? {} : { firstResponseAt: now }),
        ...(typeof firstResponseMs === "number" ? { firstResponseMs } : {}),
        updatedAt: now,
      },
      { merge: true }
    );

    if (conv.opportunityId) {
      const oppRef = adminDb.doc(`salons/${salonId}/crmOpportunities/${String(conv.opportunityId)}`);
      const oppSnap = await oppRef.get().catch(() => null);
      if (oppSnap?.exists) {
        const oppData = oppSnap.data() || {};
        await oppRef.set(
          {
            waitingSince: null,
            stage: oppData.stage === "awaiting_reply" ? "in_service" : oppData.stage,
            assignedAttendantId: oppData.assignedAttendantId || attendantId || auth.ctx.uid,
            assignedAttendantName: oppData.assignedAttendantName || finalName,
            updatedAt: now,
          },
          { merge: true }
        );
      }
    }

    return res.json({
      success: true,
      messageId: msgRef.id,
      mode: waResult.mode,
      sentViaCloudApi: waResult.sentViaCloudApi,
      waLink: waResult.waLink,
      cloudApiError: waResult.cloudApiError,
    });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({ error: "Admin SDK indisponível.", code: "ADMIN_UNAVAILABLE" });
    }
    console.error("[CRM Send Message]", err);
    return res.status(500).json({ error: "Falha ao registrar envio da mensagem." });
  }
});

// =====================================================
// 2. LUMI IA COPILOTO & QUALIFICAÇÃO (GEMINI API)
// =====================================================

const aiAssistSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  clientName: z.string().max(160).optional().default("Cliente"),
  clientVisitsCount: z.number().int().min(0).max(9999).optional().default(0),
  action: z.enum(["suggest_reply", "qualify_opportunity", "recovery_draft"]).default("suggest_reply"),
  transcript: z
    .array(
      z.object({
        direction: z.enum(["inbound", "outbound", "system"]),
        body: z.string().max(2000),
      })
    )
    .max(30),
  tone: z.enum(["acolhedor", "sofisticado", "objetivo"]).optional(),
  customInstructions: z.string().max(1500).optional(),
  opportunityId: z.string().regex(SAFE_ID_REGEX).optional(),
});

router.post("/ai/assist", aiLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = aiAssistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parâmetros inválidos para assistência Lumi IA." });
    }

    const apiKey = env.gemini.apiKey;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
      return res.status(503).json({
        error:
          "Chave GEMINI_API_KEY não configurada no ambiente. Configure nas definições do projeto para ativar a Lumi IA.",
        code: "GEMINI_NOT_CONFIGURED",
      });
    }

    const {
      salonId,
      clientName,
      clientVisitsCount,
      action,
      transcript,
      tone,
      customInstructions,
      opportunityId,
    } = parsed.data;

    const auth = await authorizeSalon(req, salonId, SALON_OPERATIONAL_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    let salonName = "Nosso Salão";
    let catalogText = "Nenhum serviço cadastrado no momento.";
    let aiSettingsTone = tone || "sofisticado";
    let aiInstructions = customInstructions || "";

    try {
      const adminDb = getAdminDb();
      const [salonSnap, servicesSnap, settingsSnap] = await Promise.all([
        adminDb.doc(`salons/${salonId}`).get(),
        adminDb.collection(`salons/${salonId}/services`).limit(45).get(),
        adminDb.doc(`salons/${salonId}/crmSettings/config`).get(),
      ]);

      if (salonSnap.exists) {
        salonName = String(salonSnap.data()?.name || salonName);
      }

      if (!servicesSnap.empty) {
        const lines: string[] = [];
        servicesSnap.forEach((docSnap) => {
          const s = docSnap.data();
          if (s.isActive === false || s.type === "product") return;
          const priceLabel =
            s.priceType === "from"
              ? `a partir de R$ ${Number(s.price || 0).toFixed(0)}`
              : s.priceType === "variable"
                ? `sob avaliação (ref. R$ ${Number(s.price || 0).toFixed(0)})`
                : `R$ ${Number(s.price || 0).toFixed(0)}`;
          lines.push(`- ${s.name} (${s.category || "Serviço"}): ${priceLabel}, ~${s.durationMinutes || 60}min`);
        });
        if (lines.length > 0) {
          catalogText = lines.slice(0, 35).join("\n");
        }
      }

      if (settingsSnap.exists) {
        const cfg = settingsSnap.data()?.aiConfig || {};
        if (!tone && cfg.tone) aiSettingsTone = cfg.tone;
        if (!customInstructions && cfg.qualificationInstructions) {
          aiInstructions = String(cfg.qualificationInstructions);
        }
      }
    } catch {
      // If Admin SDK is unavailable in local dev, proceed with safe defaults
    }

    const transcriptText =
      transcript.length > 0
        ? transcript
            .map((m) => `${m.direction === "inbound" ? "Cliente" : "Salão"}: ${m.body}`)
            .join("\n")
        : "(Conversa recém-iniciada sem mensagens anteriores)";

    const actionObjective =
      action === "recovery_draft"
        ? "A conversa esfriou ou perdeu tração. Crie uma mensagem curta e elegante de reengajamento para WhatsApp convidando a cliente a escolher um horário esta semana."
        : action === "qualify_opportunity"
          ? "Analise o histórico da conversa, identifique o serviço desejado, estime o valor em R$ com base no catálogo e sugira o próximo passo."
          : "Sugira a próxima resposta ideal para enviar no WhatsApp da cliente, respondendo às dúvidas com clareza, citando valores reais do catálogo quando aplicável e conduzindo para o agendamento.";

    const aiResponse = await withDeveloperAuth(apiKey, async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Estabelecimento: ${salonName}
Cliente: ${clientName} (${clientVisitsCount} visita(s) anteriores registradas)
Tom de comunicação: ${aiSettingsTone}
Instruções adicionais do salão: ${aiInstructions || "Atender com gentileza, clareza e foco em agendamento."}

Catálogo real de serviços disponíveis:
${catalogText}

Histórico recente do WhatsApp:
${transcriptText}

Tarefa: ${actionObjective}`,
        config: {
          systemInstruction:
            "Você é Lumi, especialista em conversão e recepção de alto padrão para negócios de beleza no WhatsApp. Nunca invente preços que contradigam o catálogo informado. Escreva mensagens naturais para WhatsApp em Português do Brasil (sem markdown complexo, no máximo *negrito* pontual e parágrafos curtos).",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedReply: {
                type: Type.STRING,
                description: "Mensagem pronta para enviar no WhatsApp da cliente.",
              },
              detectedService: {
                type: Type.STRING,
                description: "Nome do serviço identificado no diálogo ou vazio se indefinido.",
              },
              estimatedValue: {
                type: Type.NUMBER,
                description: "Valor estimado em reais (R$) com base no catálogo, 0 se indisponível.",
              },
              recommendedStage: {
                type: Type.STRING,
                description: "Uma de: awaiting_reply, in_service, interested, scheduled, lost, other",
              },
              handoffRecommended: {
                type: Type.BOOLEAN,
                description: "True se a cliente pediu humano, reclamou, negociou preço complexo ou requer avaliação presencial.",
              },
              intentSummary: {
                type: Type.STRING,
                description: "Resumo de 1 frase do objetivo atual da cliente.",
              },
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

      const raw = (response.text ?? "{}").trim();
      return JSON.parse(raw) as {
        suggestedReply: string;
        detectedService: string;
        estimatedValue: number;
        recommendedStage: string;
        handoffRecommended: boolean;
        intentSummary: string;
      };
    });

    if (opportunityId && aiResponse.estimatedValue > 0) {
      try {
        const adminDb = getAdminDb();
        await adminDb
          .doc(`salons/${salonId}/crmOpportunities/${opportunityId}`)
          .set(
            {
              estimatedValue: Math.round(Number(aiResponse.estimatedValue)),
              valueSource: "ai",
              ...(aiResponse.detectedService ? { serviceInterest: aiResponse.detectedService } : {}),
              updatedAt: Date.now(),
            },
            { merge: true }
          );
      } catch {
        // Non-blocking
      }
    }

    return res.json({
      success: true,
      ...aiResponse,
    });
  } catch (err: unknown) {
    console.error("[CRM AI Assist]", err);
    const message = err instanceof Error ? err.message : "Erro ao consultar Lumi IA.";
    return res.status(500).json({ error: message });
  }
});

// =====================================================
// 3. CAMPANHAS AUTOMÁTICAS (AUDIÊNCIA & DISPARO SEGURO)
// =====================================================

const evaluateCampaignSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  campaignType: z.enum([
    "confirmation",
    "birthday",
    "service_return",
    "inactive_clients",
    "post_service_csat",
  ]),
  messageTemplate: z.string().min(1).max(2000),
  dailyLimit: z.number().int().min(1).max(200).optional().default(50),
  inactiveMonths: z.number().int().min(1).max(24).optional().default(3),
  defaultReturnDays: z.number().int().min(7).max(180).optional().default(45),
});

function renderCampaignTemplate(
  template: string,
  vars: { cliente: string; salao: string; servico?: string; data?: string; hora?: string }
): string {
  const firstName = vars.cliente.trim().split(/\s+/)[0] || "Cliente";
  return template
    .replace(/\{cliente\}/g, firstName)
    .replace(/\{cliente_completo\}/g, vars.cliente)
    .replace(/\{salao\}/g, vars.salao)
    .replace(/\{servico\}/g, vars.servico || "seu procedimento")
    .replace(/\{data\}/g, vars.data || "em breve")
    .replace(/\{hora\}/g, vars.hora || "");
}

function daysBetween(dateYmdA: string, dateYmdB: string): number {
  const tA = new Date(`${dateYmdA}T12:00:00`).getTime();
  const tB = new Date(`${dateYmdB}T12:00:00`).getTime();
  if (Number.isNaN(tA) || Number.isNaN(tB)) return 0;
  return Math.round((tB - tA) / (1000 * 60 * 60 * 24));
}

router.post("/campaigns/evaluate", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = evaluateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parâmetros inválidos para avaliação de campanha." });
    }

    const { salonId, campaignType, messageTemplate, dailyLimit, inactiveMonths, defaultReturnDays } =
      parsed.data;

    const auth = await authorizeSalon(req, salonId, SALON_MANAGEMENT_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const adminDb = getAdminDb();
    const [salonSnap, clientsSnap, apptsSnap] = await Promise.all([
      adminDb.doc(`salons/${salonId}`).get(),
      adminDb.collection(`salons/${salonId}/clients`).limit(500).get(),
      adminDb.collection(`salons/${salonId}/appointments`).limit(800).get(),
    ]);

    const salonName = String(salonSnap.data()?.name || "Lumière Studio");
    const today = new Date();
    const todayYmd = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
    const currentMonthDay = todayYmd.slice(5, 10); // MM-DD

    interface Candidate {
      clientId: string;
      clientName: string;
      clientPhone: string;
      reason: string;
      renderedMessage: string;
      eligible: boolean;
      blockedReason?: string;
    }

    const candidates: Candidate[] = [];
    const clientsMap = new Map<string, FirebaseFirestore.DocumentData>();
    clientsSnap.forEach((docSnap) => {
      const c = docSnap.data();
      if (!c.deletedAt && !c.archived && c.status !== "inactive") {
        clientsMap.set(docSnap.id, { id: docSnap.id, ...c });
      }
    });

    const apptsByClient = new Map<string, Array<FirebaseFirestore.DocumentData & { id: string }>>();
    const allAppts: Array<FirebaseFirestore.DocumentData & { id: string }> = [];
    apptsSnap.forEach((docSnap) => {
      const a = { id: docSnap.id, ...docSnap.data() } as FirebaseFirestore.DocumentData & { id: string };
      if (a.isBlock || a.status === "blocked") return;
      allAppts.push(a);
      const cId = String(a.clientId || "");
      if (cId) {
        const list = apptsByClient.get(cId) || [];
        list.push(a);
        apptsByClient.set(cId, list);
      }
    });

    const hasFutureBookingWithinDays = (clientId: string, maxDays: number): boolean => {
      const list = apptsByClient.get(clientId) || [];
      return list.some((a) => {
        if (a.status === "canceled" || a.status === "no_show") return false;
        const d = String(a.date || "").slice(0, 10);
        if (!d || d < todayYmd) return false;
        return daysBetween(todayYmd, d) <= maxDays;
      });
    };

    if (campaignType === "confirmation") {
      allAppts
        .filter((a) => (a.date === todayYmd || a.date === tomorrow) && a.status === "scheduled")
        .slice(0, dailyLimit)
        .forEach((a) => {
          const client = clientsMap.get(String(a.clientId || ""));
          const phone = String(a.clientPhone || client?.phone || "").trim();
          const dateBr = String(a.date || "").split("-").reverse().join("/");
          candidates.push({
            clientId: String(a.clientId || a.id),
            clientName: String(a.clientName || "Cliente"),
            clientPhone: phone,
            reason: `Atendimento ${dateBr} às ${a.time || ""}`,
            renderedMessage: renderCampaignTemplate(messageTemplate, {
              cliente: String(a.clientName || "Cliente"),
              salao: salonName,
              servico: String(a.serviceName || "Atendimento"),
              data: dateBr,
              hora: String(a.time || ""),
            }),
            eligible: Boolean(phone),
            blockedReason: phone ? undefined : "Sem telefone cadastrado",
          });
        });
    } else if (campaignType === "birthday") {
      clientsMap.forEach((c, cid) => {
        const bday = String(c.birthDate || "").trim();
        if (!bday || bday.length < 10) return;
        const bMonthDay = bday.slice(5, 10);
        const sameMonth = bMonthDay.slice(0, 2) === currentMonthDay.slice(0, 2);
        if (!sameMonth) return;
        const phone = String(c.phone || "").trim();
        candidates.push({
          clientId: cid,
          clientName: String(c.name || "Cliente"),
          clientPhone: phone,
          reason:
            bMonthDay === currentMonthDay
              ? "Aniversariante de hoje"
              : `Aniversário dia ${bday.slice(8, 10)}/${bday.slice(5, 7)}`,
          renderedMessage: renderCampaignTemplate(messageTemplate, {
            cliente: String(c.name || "Cliente"),
            salao: salonName,
          }),
          eligible: Boolean(phone),
          blockedReason: phone ? undefined : "Sem WhatsApp",
        });
      });
    } else if (campaignType === "service_return") {
      clientsMap.forEach((c, cid) => {
        const list = (apptsByClient.get(cid) || [])
          .filter((a) => a.status === "completed")
          .sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
        const last = list[0];
        if (!last?.date) return;
        const elapsed = daysBetween(String(last.date).slice(0, 10), todayYmd);
        if (elapsed < defaultReturnDays - 8) return;
        const phone = String(c.phone || "").trim();
        const future = hasFutureBookingWithinDays(cid, 90);
        candidates.push({
          clientId: cid,
          clientName: String(c.name || "Cliente"),
          clientPhone: phone,
          reason: `Último serviço (${last.serviceName || "Atendimento"}) há ${elapsed} dias`,
          renderedMessage: renderCampaignTemplate(messageTemplate, {
            cliente: String(c.name || "Cliente"),
            salao: salonName,
            servico: String(last.serviceName || "seu tratamento"),
          }),
          eligible: Boolean(phone) && !future,
          blockedReason: !phone
            ? "Sem WhatsApp"
            : future
              ? "Já possui horário marcado nos próximos 90 dias"
              : undefined,
        });
      });
    } else if (campaignType === "inactive_clients") {
      const minInactiveDays = inactiveMonths * 30;
      clientsMap.forEach((c, cid) => {
        const list = (apptsByClient.get(cid) || [])
          .filter((a) => a.status === "completed")
          .sort((x, y) => String(y.date || "").localeCompare(String(x.date || "")));
        const lastDate = String(list[0]?.date || "").slice(0, 10);
        const lastFallback = c.createdAt
          ? new Date(Number(c.createdAt)).toISOString().slice(0, 10)
          : todayYmd;
        const refDate = lastDate || lastFallback;
        const elapsed = daysBetween(refDate, todayYmd);
        if (elapsed < minInactiveDays) return;
        const phone = String(c.phone || "").trim();
        const future = hasFutureBookingWithinDays(cid, 90);
        candidates.push({
          clientId: cid,
          clientName: String(c.name || "Cliente"),
          clientPhone: phone,
          reason: `Sem visitas há ${Math.round(elapsed / 30)} mês(es)`,
          renderedMessage: renderCampaignTemplate(messageTemplate, {
            cliente: String(c.name || "Cliente"),
            salao: salonName,
            servico: String(list[0]?.serviceName || "um atendimento especial"),
          }),
          eligible: Boolean(phone) && !future,
          blockedReason: !phone ? "Sem WhatsApp" : future ? "Possui agendamento futuro" : undefined,
        });
      });
    } else if (campaignType === "post_service_csat") {
      allAppts
        .filter((a) => a.status === "completed" && daysBetween(String(a.date || "").slice(0, 10), todayYmd) <= 3)
        .slice(0, dailyLimit)
        .forEach((a) => {
          const client = clientsMap.get(String(a.clientId || ""));
          const phone = String(a.clientPhone || client?.phone || "").trim();
          candidates.push({
            clientId: String(a.clientId || a.id),
            clientName: String(a.clientName || "Cliente"),
            clientPhone: phone,
            reason: `Concluiu ${a.serviceName || "atendimento"} em ${String(a.date || "").split("-").reverse().join("/")}`,
            renderedMessage: renderCampaignTemplate(messageTemplate, {
              cliente: String(a.clientName || "Cliente"),
              salao: salonName,
              servico: String(a.serviceName || "atendimento"),
            }),
            eligible: Boolean(phone),
            blockedReason: phone ? undefined : "Sem telefone",
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
      return res.status(503).json({ error: "Admin SDK indisponível.", code: "ADMIN_UNAVAILABLE" });
    }
    console.error("[CRM Campaign Evaluate]", err);
    return res.status(500).json({ error: "Erro ao calcular audiência da campanha." });
  }
});

const dispatchCampaignSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  campaignId: z.string().regex(SAFE_ID_REGEX),
  campaignType: z.enum([
    "confirmation",
    "birthday",
    "service_return",
    "inactive_clients",
    "post_service_csat",
  ]),
  recipients: z
    .array(
      z.object({
        clientId: z.string().max(128).optional(),
        clientName: z.string().min(1).max(160),
        clientPhone: z.string().min(6).max(40),
        renderedMessage: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(50),
});

router.post("/campaigns/dispatch", adminLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = dispatchCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Lista de destinatários inválida." });
    }

    const { salonId, campaignId, campaignType, recipients } = parsed.data;
    const auth = await authorizeSalon(req, salonId, SALON_MANAGEMENT_ROLES);
    if ("error" in auth) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const adminDb = getAdminDb();
    const now = Date.now();
    let sentCloudCount = 0;
    let queuedWaLinksCount = 0;
    const waLinks: Array<{ clientName: string; waLink: string }> = [];

    for (const r of recipients) {
      const result = await dispatchWhatsAppText(adminDb, salonId, r.clientPhone, r.renderedMessage);
      if (result.sentViaCloudApi) {
        sentCloudCount++;
      } else {
        queuedWaLinksCount++;
        waLinks.push({ clientName: r.clientName, waLink: result.waLink });
      }

      const dispatchRef = adminDb.collection(`salons/${salonId}/crmCampaignDispatches`).doc();
      await dispatchRef.set({
        id: dispatchRef.id,
        campaignId,
        campaignType,
        clientId: r.clientId || "",
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        status: "sent",
        statusReason: result.sentViaCloudApi ? "Enviado via WhatsApp Cloud API" : "Pronto via WhatsApp Link",
        renderedMessage: r.renderedMessage,
        dispatchedAt: now,
        createdAt: now,
      });
    }

    const campaignRef = adminDb.doc(`salons/${salonId}/crmCampaigns/${campaignId}`);
    const campaignSnap = await campaignRef.get().catch(() => null);
    const prevMetrics = campaignSnap?.data()?.metrics || {};
    await campaignRef.set(
      {
        lastRunAt: now,
        updatedAt: now,
        metrics: {
          sentCount: Number(prevMetrics.sentCount || 0) + recipients.length,
          deliveredCount: Number(prevMetrics.deliveredCount || 0) + recipients.length,
          repliedCount: Number(prevMetrics.repliedCount || 0),
          convertedBookings: Number(prevMetrics.convertedBookings || 0),
          recoveredRevenue: Number(prevMetrics.recoveredRevenue || 0),
          csatSum: Number(prevMetrics.csatSum || 0),
          csatCount: Number(prevMetrics.csatCount || 0),
        },
      },
      { merge: true }
    );

    return res.json({
      success: true,
      dispatchedCount: recipients.length,
      sentCloudCount,
      queuedWaLinksCount,
      waLinks: waLinks.slice(0, 10),
    });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({ error: "Admin SDK indisponível.", code: "ADMIN_UNAVAILABLE" });
    }
    console.error("[CRM Campaign Dispatch]", err);
    return res.status(500).json({ error: "Falha ao executar disparos da campanha." });
  }
});

export { router as crmRoutes };

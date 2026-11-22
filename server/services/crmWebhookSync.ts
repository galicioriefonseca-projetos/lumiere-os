import type { Firestore } from "firebase-admin/firestore";

function normalizeDigits(raw?: string | null): string {
  return String(raw || "").replace(/\D/g, "");
}

function normalizePhoneKey(raw?: string | null): string {
  const digits = normalizeDigits(raw);
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits.length >= 8 ? digits : "";
}

export function formatBrazilPhoneE164(raw?: string | null): string {
  const digits = normalizeDigits(raw);
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export interface InboundCrmSyncInput {
  salonId: string;
  senderPhone: string;
  senderName?: string;
  textBody: string;
  origin?: "receptivo" | "confirmacao" | "marketing" | "attendant";
  linkedAppointmentId?: string;
  linkedAppointmentDate?: string;
  linkedAppointmentTime?: string;
  linkedAppointmentPrice?: number;
  linkedAppointmentService?: string;
}

export async function recordInboundWhatsAppToCrm(
  adminDb: Firestore,
  input: InboundCrmSyncInput
): Promise<{ conversationId: string; opportunityId: string }> {
  const now = Date.now();
  const cleanDigits = formatBrazilPhoneE164(input.senderPhone);
  const phoneKey = normalizePhoneKey(input.senderPhone);
  const convId = phoneKey ? `wa_${phoneKey}` : `wa_${now}`;

  const convRef = adminDb.doc(`salons/${input.salonId}/crmConversations/${convId}`);
  const convSnap = await convRef.get().catch(() => null);
  const existingConv = convSnap?.exists ? convSnap.data() || {} : null;

  // Try matching a client by phone if not yet linked
  let matchedClientId = String(existingConv?.clientId || "");
  let matchedClientName = String(existingConv?.clientName || input.senderName || "");
  if (!matchedClientId && phoneKey) {
    const clientsSnap = await adminDb
      .collection(`salons/${input.salonId}/clients`)
      .limit(300)
      .get()
      .catch(() => null);
    if (clientsSnap && !clientsSnap.empty) {
      for (const cDoc of clientsSnap.docs) {
        const cData = cDoc.data();
        if (cData.deletedAt || cData.archived) continue;
        const cKey = normalizePhoneKey(String(cData.phone || ""));
        const cSecKey = normalizePhoneKey(String(cData.secondaryPhone || ""));
        if (
          (cKey && (cKey === phoneKey || cKey.slice(-8) === phoneKey.slice(-8))) ||
          (cSecKey && (cSecKey === phoneKey || cSecKey.slice(-8) === phoneKey.slice(-8)))
        ) {
          matchedClientId = cDoc.id;
          matchedClientName = String(cData.name || matchedClientName || "Contato WhatsApp");
          break;
        }
      }
    }
  }

  const displayName = matchedClientName || input.senderName || (cleanDigits ? `+${cleanDigits}` : "Cliente WhatsApp");
  const displayPhone = cleanDigits || input.senderPhone;

  // Ensure an active opportunity exists or create one
  let opportunityId = String(existingConv?.opportunityId || "");
  let opportunityNumber = Number(existingConv?.opportunityNumber || 0);

  if (!opportunityId) {
    const oppRef = adminDb.collection(`salons/${input.salonId}/crmOpportunities`).doc();
    opportunityId = oppRef.id;
    opportunityNumber = Math.floor(1000 + (now % 8999));

    await oppRef.set({
      id: oppRef.id,
      opportunityNumber,
      conversationId: convId,
      clientId: matchedClientId || "",
      clientName: displayName,
      clientPhone: displayPhone,
      stage: input.linkedAppointmentId ? "scheduled" : "awaiting_reply",
      origin: input.origin || (input.linkedAppointmentId ? "confirmacao" : "receptivo"),
      estimatedValue: Number(input.linkedAppointmentPrice || 0),
      valueSource: input.linkedAppointmentPrice ? "appointment" : "ai",
      serviceInterest: input.linkedAppointmentService || "",
      linkedAppointmentId: input.linkedAppointmentId || "",
      linkedAppointmentDate: input.linkedAppointmentDate || "",
      linkedAppointmentTime: input.linkedAppointmentTime || "",
      waitingSince: now,
      notes: [],
      history: [
        {
          id: `hist_${now}`,
          action: "created",
          detail: "Oportunidade aberta automaticamente via WhatsApp",
          actorName: "Webhook WhatsApp",
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const oppPatch: Record<string, unknown> = {
      waitingSince: now,
      updatedAt: now,
    };
    if (matchedClientId) oppPatch.clientId = matchedClientId;
    if (matchedClientName) oppPatch.clientName = matchedClientName;
    if (input.linkedAppointmentId) {
      oppPatch.linkedAppointmentId = input.linkedAppointmentId;
      oppPatch.linkedAppointmentDate = input.linkedAppointmentDate || "";
      oppPatch.linkedAppointmentTime = input.linkedAppointmentTime || "";
      if (input.linkedAppointmentPrice) {
        oppPatch.estimatedValue = input.linkedAppointmentPrice;
        oppPatch.valueSource = "appointment";
      }
      oppPatch.stage = "scheduled";
    }
    await adminDb
      .doc(`salons/${input.salonId}/crmOpportunities/${opportunityId}`)
      .set(oppPatch, { merge: true });
  }

  // Upsert conversation
  await convRef.set(
    {
      id: convId,
      salonId: input.salonId,
      clientId: matchedClientId || "",
      clientName: displayName,
      clientPhone: displayPhone,
      channel: "whatsapp",
      status: "awaiting_reply",
      handlingMode: existingConv?.handlingMode || "handoff",
      aiPausedForClient: Boolean(existingConv?.aiPausedForClient),
      isPinned: Boolean(existingConv?.isPinned),
      unreadCount: Number(existingConv?.unreadCount || 0) + 1,
      lastMessageText: input.textBody.slice(0, 500),
      lastMessageAt: now,
      lastMessageDirection: "inbound",
      lastInboundAt: now,
      origin: existingConv?.origin || input.origin || "receptivo",
      opportunityId,
      opportunityNumber,
      createdAt: existingConv?.createdAt || now,
      updatedAt: now,
    },
    { merge: true }
  );

  // Append message doc
  const msgRef = convRef.collection("messages").doc();
  await msgRef.set({
    id: msgRef.id,
    conversationId: convId,
    direction: "inbound",
    senderType: "client",
    senderName: displayName,
    body: input.textBody,
    mediaType: "text",
    deliveryStatus: "delivered",
    createdAt: now,
  });

  return { conversationId: convId, opportunityId };
}

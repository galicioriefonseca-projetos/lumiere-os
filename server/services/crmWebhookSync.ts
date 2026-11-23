import type { Firestore } from "firebase-admin/firestore";

export function formatBrazilPhoneE164(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function phoneKey(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

export interface InboundWhatsAppCrmPayload {
  salonId: string;
  senderPhone: string;
  senderName?: string;
  textBody: string;
  waMessageId?: string;
  origin?: "receptivo" | "confirmacao" | "marketing" | "attendant";
  linkedAppointmentId?: string;
  linkedAppointmentDate?: string;
  linkedAppointmentTime?: string;
  linkedAppointmentPrice?: number;
  linkedAppointmentService?: string;
}

export async function recordInboundWhatsAppToCrm(
  adminDb: Firestore,
  payload: InboundWhatsAppCrmPayload
): Promise<{ conversationId: string; opportunityId: string }> {
  const now = Date.now();
  const normalizedPhone = formatBrazilPhoneE164(payload.senderPhone) || payload.senderPhone.trim();
  const pKey = phoneKey(normalizedPhone);
  const convId = pKey ? `wa_${pKey}` : `wa_${now}`;

  // Auto-match existing salon client by phone tail
  let matchedClientId = "";
  let matchedClientName = payload.senderName?.trim() || "";
  let matchedClientEmail = "";

  if (pKey) {
    const clientsSnap = await adminDb
      .collection(`salons/${payload.salonId}/clients`)
      .limit(400)
      .get();
    for (const cDoc of clientsSnap.docs) {
      const cData = cDoc.data();
      if (cData.deletedAt) continue;
      if (phoneKey(String(cData.phone || "")) === pKey) {
        matchedClientId = cDoc.id;
        matchedClientName = String(cData.name || matchedClientName || "Cliente WhatsApp");
        matchedClientEmail = String(cData.email || "");
        break;
      }
    }
  }

  const displayName = matchedClientName || `Contato ${normalizedPhone.slice(-4) || "WhatsApp"}`;
  const convRef = adminDb.doc(`salons/${payload.salonId}/crmConversations/${convId}`);
  const convSnap = await convRef.get();
  const existingConv = convSnap.exists ? convSnap.data() : null;

  let opportunityId = String(existingConv?.opportunityId || "");
  let opportunityNumber = Number(existingConv?.opportunityNumber || 0);

  if (!opportunityId) {
    const oppRef = adminDb.collection(`salons/${payload.salonId}/crmOpportunities`).doc();
    opportunityId = oppRef.id;
    opportunityNumber = Math.floor(1000 + (now % 8999));

    await oppRef.set({
      id: opportunityId,
      opportunityNumber,
      conversationId: convId,
      clientId: matchedClientId,
      clientName: displayName,
      clientPhone: normalizedPhone,
      stage: payload.linkedAppointmentId ? "scheduled" : "awaiting_reply",
      origin: payload.origin || "receptivo",
      assignedAttendantId: "",
      assignedAttendantName: "",
      estimatedValue: Number(payload.linkedAppointmentPrice || 0),
      valueSource: payload.linkedAppointmentPrice ? "appointment" : "ai",
      serviceInterest: payload.linkedAppointmentService || "",
      linkedAppointmentId: payload.linkedAppointmentId || "",
      linkedAppointmentDate: payload.linkedAppointmentDate || "",
      linkedAppointmentTime: payload.linkedAppointmentTime || "",
      waitingSince: payload.linkedAppointmentId ? 0 : now,
      notes: [],
      history: [
        {
          id: `hist_${now}`,
          action: "inbound_created",
          detail: `Oportunidade #${opportunityNumber} criada via WhatsApp`,
          actorName: "Webhook WhatsApp",
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await adminDb.doc(`salons/${payload.salonId}/crmOpportunities/${opportunityId}`).set(
      {
        ...(matchedClientId ? { clientId: matchedClientId, clientName: displayName } : {}),
        ...(payload.linkedAppointmentId
          ? {
              stage: "scheduled",
              linkedAppointmentId: payload.linkedAppointmentId,
              linkedAppointmentDate: payload.linkedAppointmentDate || "",
              linkedAppointmentTime: payload.linkedAppointmentTime || "",
              estimatedValue: Number(payload.linkedAppointmentPrice || 0),
              valueSource: "appointment",
              waitingSince: 0,
            }
          : {
              stage: "awaiting_reply",
              waitingSince: now,
            }),
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await convRef.set(
    {
      id: convId,
      salonId: payload.salonId,
      clientId: matchedClientId || existingConv?.clientId || "",
      clientName: existingConv?.clientName || displayName,
      clientPhone: normalizedPhone,
      clientEmail: matchedClientEmail || existingConv?.clientEmail || "",
      channel: "whatsapp",
      status: "awaiting_reply",
      handlingMode: existingConv?.handlingMode || "ai",
      assignedAttendantId: existingConv?.assignedAttendantId || "",
      assignedAttendantName: existingConv?.assignedAttendantName || "",
      aiPausedForClient: Boolean(existingConv?.aiPausedForClient),
      isPinned: Boolean(existingConv?.isPinned),
      unreadCount: Number(existingConv?.unreadCount || 0) + 1,
      lastMessageText: payload.textBody.slice(0, 500),
      lastMessageAt: now,
      lastMessageDirection: "inbound",
      lastInboundAt: now,
      origin: existingConv?.origin || payload.origin || "receptivo",
      opportunityId,
      opportunityNumber,
      createdAt: Number(existingConv?.createdAt || now),
      updatedAt: now,
    },
    { merge: true }
  );

  const msgRef = adminDb
    .collection(`salons/${payload.salonId}/crmConversations/${convId}/messages`)
    .doc();

  await msgRef.set({
    id: msgRef.id,
    conversationId: convId,
    direction: "inbound",
    senderType: "client",
    senderId: matchedClientId || normalizedPhone,
    senderName: displayName,
    body: payload.textBody,
    mediaType: "text",
    deliveryStatus: "delivered",
    ...(payload.waMessageId ? { waMessageId: payload.waMessageId } : {}),
    createdAt: now,
  });

  return { conversationId: convId, opportunityId };
}

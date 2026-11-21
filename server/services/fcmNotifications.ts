import { FieldValue } from "firebase-admin/firestore";
import {
  getAdminDb,
  getAdminMessaging,
  isFirebaseAdminCredentialError,
} from "../shared/firebaseAdmin.js";

export type AppointmentPushAction = "confirm" | "cancel" | "create";

export interface DispatchAppointmentPushParams {
  salonId: string;
  appointmentId: string;
  professionalId?: string;
  professionalName?: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  action: AppointmentPushAction;
  channelLabel?: string;
  skipInAppNotification?: boolean;
}

export interface DispatchAppointmentPushResult {
  inAppCreated: boolean;
  pushSentCount: number;
  pushFailedCount: number;
  tokensFoundCount: number;
  skippedByPreference?: boolean;
  adminUnavailable?: boolean;
}

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function formatDateBR(ymd?: string): string {
  if (!ymd || typeof ymd !== "string") return "";
  const clean = ymd.substring(0, 10);
  const parts = clean.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean;
}

function collectTokensFromDoc(
  docSnap: FirebaseFirestore.DocumentSnapshot | null | undefined,
  tokenSources: Map<string, FirebaseFirestore.DocumentReference[]>
) {
  if (!docSnap || !docSnap.exists) return;
  const data = docSnap.data() || {};
  const found: string[] = [];
  if (typeof data.fcmToken === "string" && data.fcmToken.trim()) {
    found.push(data.fcmToken.trim());
  }
  if (Array.isArray(data.fcmTokens)) {
    for (const raw of data.fcmTokens) {
      if (typeof raw === "string" && raw.trim()) {
        found.push(raw.trim());
      }
    }
  }
  for (const token of found) {
    const refs = tokenSources.get(token) || [];
    if (!refs.some((r) => r.path === docSnap.ref.path)) {
      refs.push(docSnap.ref);
    }
    tokenSources.set(token, refs);
  }
}

async function pruneDeadToken(
  token: string,
  refs: FirebaseFirestore.DocumentReference[]
): Promise<void> {
  await Promise.all(
    refs.map(async (ref) => {
      try {
        const snap = await ref.get();
        if (!snap.exists) return;
        const data = snap.data() || {};
        const patch: Record<string, unknown> = {
          fcmTokens: FieldValue.arrayRemove(token),
        };
        if (data.fcmToken === token) {
          const remaining = Array.isArray(data.fcmTokens)
            ? data.fcmTokens.filter((t: unknown) => typeof t === "string" && t !== token)
            : [];
          patch.fcmToken = remaining[0] || "";
        }
        await ref.set(patch, { merge: true });
      } catch {
        // Non-blocking cleanup
      }
    })
  );
}

async function resolveProfessionalTargets(
  adminDb: FirebaseFirestore.Firestore,
  salonId: string,
  professionalId: string,
  action: AppointmentPushAction
): Promise<{
  tokenSources: Map<string, FirebaseFirestore.DocumentReference[]>;
  disabledByPreference: boolean;
}> {
  const tokenSources = new Map<string, FirebaseFirestore.DocumentReference[]>();
  const [proSnap, directUserSnap] = await Promise.all([
    adminDb.doc(`salons/${salonId}/professionals/${professionalId}`).get().catch(() => null),
    adminDb.doc(`users/${professionalId}`).get().catch(() => null),
  ]);

  let pushEnabled = true;
  let onConfirmed = true;
  let onCanceled = true;
  const candidateUserIds = new Set<string>([professionalId]);
  const candidateEmails = new Set<string>();

  for (const snap of [proSnap, directUserSnap]) {
    if (!snap || !snap.exists) continue;
    const d = snap.data() || {};
    if (d.pushEnabled === false) pushEnabled = false;
    if (d.pushPreferences && typeof d.pushPreferences === "object") {
      const prefs = d.pushPreferences as { onConfirmed?: unknown; onCanceled?: unknown };
      if (prefs.onConfirmed === false) onConfirmed = false;
      if (prefs.onCanceled === false) onCanceled = false;
    }
    if (typeof d.userId === "string" && d.userId.trim()) candidateUserIds.add(d.userId.trim());
    if (typeof d.professionalId === "string" && d.professionalId.trim()) {
      candidateUserIds.add(d.professionalId.trim());
    }
    if (typeof d.email === "string" && d.email.trim()) {
      candidateEmails.add(d.email.trim().toLowerCase());
      candidateEmails.add(d.email.trim());
    }
    collectTokensFromDoc(snap, tokenSources);
  }

  if (!pushEnabled) {
    return { tokenSources: new Map(), disabledByPreference: true };
  }
  if ((action === "confirm" || action === "create") && !onConfirmed) {
    return { tokenSources: new Map(), disabledByPreference: true };
  }
  if (action === "cancel" && !onCanceled) {
    return { tokenSources: new Map(), disabledByPreference: true };
  }

  // Lookup any additional linked user docs & email matches
  const extraLookups: Array<Promise<void>> = [];

  for (const uid of candidateUserIds) {
    if (uid === professionalId) continue;
    extraLookups.push(
      adminDb
        .doc(`users/${uid}`)
        .get()
        .then((s) => collectTokensFromDoc(s, tokenSources))
        .catch(() => undefined)
    );
  }

  for (const em of candidateEmails) {
    extraLookups.push(
      adminDb
        .collection("users")
        .where("email", "==", em)
        .limit(3)
        .get()
        .then((qs) => {
          qs.forEach((docSnap) => {
            const d = docSnap.data() || {};
            if (d.pushEnabled !== false) {
              collectTokensFromDoc(docSnap, tokenSources);
            }
          });
        })
        .catch(() => undefined)
    );
  }

  await Promise.all(extraLookups);
  return { tokenSources, disabledByPreference: false };
}

export function buildAppointmentPushCopy(params: {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  action: AppointmentPushAction;
  channelLabel?: string;
}): { title: string; body: string; notifType: "appointment_confirmed" | "appointment_canceled" | "appointment_created" } {
  const dateLabel = formatDateBR(params.date);
  const when = [dateLabel, params.time ? `às ${params.time}` : ""].filter(Boolean).join(" ");
  const svc = params.serviceName || "Atendimento";
  const cli = params.clientName || "Cliente";
  const channelSuffix = params.channelLabel ? ` (${params.channelLabel})` : "";

  if (params.action === "cancel") {
    return {
      notifType: "appointment_canceled",
      title: `Agendamento Cancelado${channelSuffix}`,
      body: `${cli} cancelou ${svc}${when ? ` em ${when}` : ""}.`,
    };
  }
  if (params.action === "create") {
    return {
      notifType: "appointment_created",
      title: `Novo Agendamento na Agenda${channelSuffix}`,
      body: `${cli} agendou ${svc}${when ? ` para ${when}` : ""}.`,
    };
  }
  return {
    notifType: "appointment_confirmed",
    title: `Agendamento Confirmado!${channelSuffix}`,
    body: `${cli} confirmou ${svc}${when ? ` para ${when}` : ""}.`,
  };
}

export async function dispatchAppointmentPush(
  params: DispatchAppointmentPushParams
): Promise<DispatchAppointmentPushResult> {
  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    const { title, body, notifType } = buildAppointmentPushCopy(params);

    let tokensFoundCount = 0;
    let pushSentCount = 0;
    let pushFailedCount = 0;
    let skippedByPreference = false;

    if (params.professionalId && params.professionalId !== "bloqueio") {
      const resolved = await resolveProfessionalTargets(
        adminDb,
        params.salonId,
        params.professionalId,
        params.action
      );
      skippedByPreference = resolved.disabledByPreference;
      tokensFoundCount = resolved.tokenSources.size;

      if (!skippedByPreference && tokensFoundCount > 0) {
        const messaging = getAdminMessaging();
        const entries = Array.from(resolved.tokenSources.entries());

        await Promise.all(
          entries.map(async ([token, refs]) => {
            try {
              await messaging.send({
                token,
                notification: { title, body },
                data: {
                  type: notifType,
                  salonId: params.salonId,
                  appointmentId: params.appointmentId,
                  professionalId: params.professionalId || "",
                  action: params.action,
                  title,
                  body,
                  click_action: "/dashboard/agendamentos",
                },
                webpush: {
                  headers: { Urgency: "high" },
                  notification: {
                    title,
                    body,
                    icon: "/icons/icon-192x192.png",
                    badge: "/icons/icon-192x192.png",
                    tag: `lumiere-appt-${params.appointmentId}`,
                    renotify: true,
                  },
                  fcmOptions: {
                    link: "/dashboard/agendamentos",
                  },
                },
              });
              pushSentCount += 1;
            } catch (err: unknown) {
              pushFailedCount += 1;
              const errCode =
                typeof err === "object" && err !== null && "code" in err
                  ? String((err as { code?: unknown }).code || "")
                  : "";
              if (DEAD_TOKEN_CODES.has(errCode)) {
                await pruneDeadToken(token, refs);
              }
            }
          })
        );
      }
    }

    let inAppCreated = false;
    if (!params.skipInAppNotification) {
      try {
        const notifRef = adminDb.collection(`salons/${params.salonId}/notifications`).doc();
        await notifRef.set({
          id: notifRef.id,
          type: notifType,
          title,
          message: body,
          appointmentId: params.appointmentId,
          professionalId: params.professionalId || "",
          professionalName: params.professionalName || "",
          clientName: params.clientName || "",
          date: params.date || "",
          time: params.time || "",
          actionUrl: "/dashboard/agendamentos",
          pushDispatched: pushSentCount > 0,
          pushTokensCount: tokensFoundCount,
          read: false,
          createdAt: now,
        });
        inAppCreated = true;
      } catch (err) {
        console.warn("[FCM Service] Falha ao gravar notificação interna:", err);
      }
    }

    return {
      inAppCreated,
      pushSentCount,
      pushFailedCount,
      tokensFoundCount,
      skippedByPreference,
    };
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return {
        inAppCreated: false,
        pushSentCount: 0,
        pushFailedCount: 0,
        tokensFoundCount: 0,
        adminUnavailable: true,
      };
    }
    throw err;
  }
}

export async function sendTestPushForUser(params: {
  uid: string;
  email?: string;
  salonId?: string;
  professionalId?: string;
}): Promise<{
  tokensCount: number;
  successCount: number;
  failureCount: number;
  errors: string[];
}> {
  const adminDb = getAdminDb();
  const tokenSources = new Map<string, FirebaseFirestore.DocumentReference[]>();

  const userSnap = await adminDb.doc(`users/${params.uid}`).get().catch(() => null);
  collectTokensFromDoc(userSnap, tokenSources);

  if (params.salonId) {
    const proIds = Array.from(new Set([params.professionalId, params.uid].filter(Boolean) as string[]));
    for (const pid of proIds) {
      const pSnap = await adminDb
        .doc(`salons/${params.salonId}/professionals/${pid}`)
        .get()
        .catch(() => null);
      collectTokensFromDoc(pSnap, tokenSources);
    }
    if (params.email) {
      const qs = await adminDb
        .collection(`salons/${params.salonId}/professionals`)
        .where("email", "==", params.email)
        .limit(3)
        .get()
        .catch(() => null);
      qs?.forEach((d) => collectTokensFromDoc(d, tokenSources));
    }
  }

  const tokensCount = tokenSources.size;
  if (tokensCount === 0) {
    return { tokensCount: 0, successCount: 0, failureCount: 0, errors: [] };
  }

  const messaging = getAdminMessaging();
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  const title = "Alerta Push Ativo · LumièreOS";
  const body =
    "Configuração validada! Você receberá alertas instantâneos de confirmações e cancelamentos.";

  await Promise.all(
    Array.from(tokenSources.entries()).map(async ([token, refs]) => {
      try {
        await messaging.send({
          token,
          notification: { title, body },
          data: {
            type: "system",
            salonId: params.salonId || "",
            click_action: "/dashboard/agendamentos",
          },
          webpush: {
            headers: { Urgency: "high" },
            notification: {
              title,
              body,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              tag: "lumiere-test-push",
            },
            fcmOptions: { link: "/dashboard/agendamentos" },
          },
        });
        successCount += 1;
      } catch (err: unknown) {
        failureCount += 1;
        const code =
          typeof err === "object" && err !== null && "code" in err
            ? String((err as { code?: unknown }).code || "")
            : "unknown_error";
        errors.push(code);
        if (DEAD_TOKEN_CODES.has(code)) {
          await pruneDeadToken(token, refs);
        }
      }
    })
  );

  if (params.salonId) {
    try {
      const notifRef = adminDb.collection(`salons/${params.salonId}/notifications`).doc();
      await notifRef.set({
        id: notifRef.id,
        type: "system",
        title,
        message: body,
        professionalId: params.professionalId || params.uid,
        actionUrl: "/dashboard/agendamentos",
        pushDispatched: successCount > 0,
        pushTokensCount: tokensCount,
        read: false,
        createdAt: Date.now(),
      });
    } catch {
      // Non-blocking
    }
  }

  return { tokensCount, successCount, failureCount, errors };
}

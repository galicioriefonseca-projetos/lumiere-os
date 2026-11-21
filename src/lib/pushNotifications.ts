import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  deleteToken,
} from 'firebase/messaging';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { app, auth, db } from '@/lib/firebase';
import firebaseConfigFallback from '../../firebase-applet-config.json';
import { toast } from 'sonner';

export interface PushRegistrationResult {
  success: boolean;
  token: string | null;
  permission: NotificationPermission | 'unsupported';
  vapidMissing?: boolean;
  errorReason?: string;
}

function getResolvedFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFallback?.apiKey || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFallback?.authDomain || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFallback?.projectId || '',
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFallback?.storageBucket || '',
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      firebaseConfigFallback?.messagingSenderId ||
      '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigFallback?.appId || '',
  };
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return null;
  }
}

async function saveTokenClientFallback(
  salonId: string,
  userId: string,
  token: string,
  targetProfessionalId?: string
): Promise<void> {
  if (!db || !userId) return;

  const now = Date.now();
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    await updateDoc(userRef, {
      fcmToken: token,
      fcmTokens: arrayUnion(token),
      pushEnabled: true,
      updatedAt: now,
    }).catch(() => undefined);
  }

  if (salonId) {
    const proIds = Array.from(new Set([targetProfessionalId, userId].filter(Boolean) as string[]));
    for (const pid of proIds) {
      const pRef = doc(db, `salons/${salonId}/professionals`, pid);
      const pSnap = await getDoc(pRef).catch(() => null);
      if (pSnap?.exists()) {
        await updateDoc(pRef, {
          fcmToken: token,
          fcmTokens: arrayUnion(token),
          pushEnabled: true,
          updatedAt: now,
        }).catch(() => undefined);
      }
    }

    const email = auth?.currentUser?.email;
    if (email) {
      const qEmail = query(
        collection(db, `salons/${salonId}/professionals`),
        where('email', '==', email)
      );
      const snap = await getDocs(qEmail).catch(() => null);
      snap?.forEach((d) => {
        updateDoc(d.ref, {
          fcmToken: token,
          fcmTokens: arrayUnion(token),
          pushEnabled: true,
          updatedAt: now,
        }).catch(() => undefined);
      });
    }
  }
}

async function persistTokenOnServer(
  salonId: string,
  userId: string,
  token: string,
  targetProfessionalId?: string
): Promise<void> {
  const headers = await getAuthHeaders();
  if (headers) {
    try {
      const res = await fetch('/api/push/register-token', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          salonId: salonId || undefined,
          token,
          pushEnabled: true,
        }),
      });
      if (res.ok) return;
    } catch {
      // Fallback below
    }
  }
  await saveTokenClientFallback(salonId, userId, token, targetProfessionalId);
}

export async function registerPushNotificationsDetailed(
  salonId: string,
  userId: string,
  targetProfessionalId?: string
): Promise<PushRegistrationResult> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return {
      success: false,
      token: null,
      permission: 'unsupported',
      errorReason: 'Navegador sem suporte a Web Push.',
    };
  }

  const fcmSupported = await isSupported().catch(() => false);
  if (!fcmSupported) {
    return {
      success: false,
      token: null,
      permission: 'unsupported',
      errorReason: 'Firebase Cloud Messaging não suportado neste navegador.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        token: null,
        permission,
        errorReason: 'Permissão negada pelo usuário.',
      };
    }

    const cfg = getResolvedFirebaseConfig();
    if (!cfg.apiKey || !cfg.messagingSenderId || !app) {
      return {
        success: false,
        token: null,
        permission,
        errorReason: 'Configuração pública do Firebase ausente.',
      };
    }

    const swUrl =
      `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(cfg.apiKey)}` +
      `&authDomain=${encodeURIComponent(cfg.authDomain)}` +
      `&projectId=${encodeURIComponent(cfg.projectId)}` +
      `&storageBucket=${encodeURIComponent(cfg.storageBucket)}` +
      `&messagingSenderId=${encodeURIComponent(cfg.messagingSenderId)}` +
      `&appId=${encodeURIComponent(cfg.appId)}` +
      `&v=2`;

    const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() || undefined;

    if (!vapidKey) {
      return {
        success: false,
        token: null,
        permission,
        vapidMissing: true,
        errorReason:
          'Permissão concedida no navegador. Para gerar o token FCM em background, configure VITE_FIREBASE_VAPID_KEY nas variáveis do projeto.',
      };
    }

    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey,
    });

    if (!token) {
      return {
        success: false,
        token: null,
        permission,
        errorReason: 'Não foi possível gerar o token FCM deste dispositivo.',
      };
    }

    await persistTokenOnServer(salonId, userId, token, targetProfessionalId);

    return {
      success: true,
      token,
      permission,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar dispositivo FCM.';
    console.error('[Push Notification] Erro ao configurar FCM:', err);
    return {
      success: false,
      token: null,
      permission: Notification.permission,
      errorReason: message,
    };
  }
}

export async function requestAndRegisterNotificationPermission(
  salonId: string,
  userId: string,
  targetProfessionalId?: string
): Promise<string | null> {
  const result = await registerPushNotificationsDetailed(
    salonId,
    userId,
    targetProfessionalId
  );
  return result.token;
}

export async function unregisterPushNotifications(params: {
  salonId?: string;
  userId: string;
  professionalDocId?: string;
  currentToken?: string;
}): Promise<void> {
  try {
    const fcmSupported = await isSupported().catch(() => false);
    if (fcmSupported && app) {
      const messaging = getMessaging(app);
      await deleteToken(messaging).catch(() => undefined);
    }

    const headers = await getAuthHeaders();
    if (headers) {
      const res = await fetch('/api/push/unregister-token', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          salonId: params.salonId,
          token: params.currentToken,
        }),
      });
      if (res.ok) return;
    }

    if (db && params.userId) {
      const patch: Record<string, unknown> = {
        pushEnabled: false,
        updatedAt: Date.now(),
      };
      if (params.currentToken) {
        patch.fcmTokens = arrayRemove(params.currentToken);
      }
      await setDoc(doc(db, 'users', params.userId), patch, { merge: true }).catch(() => undefined);
      if (params.salonId && params.professionalDocId) {
        await setDoc(
          doc(db, `salons/${params.salonId}/professionals`, params.professionalDocId),
          patch,
          { merge: true }
        ).catch(() => undefined);
      }
    }
  } catch (err) {
    console.error('[Push Notification] Erro ao desativar push:', err);
  }
}

export async function sendTestPushApi(
  salonId?: string,
  professionalId?: string
): Promise<{
  success: boolean;
  tokensCount: number;
  successCount: number;
  failureCount: number;
  adminUnavailable?: boolean;
}> {
  const headers = await getAuthHeaders();
  if (!headers) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers,
    body: JSON.stringify({ salonId, professionalId }),
  });

  if (res.status === 503) {
    if (db && salonId) {
      const nRef = doc(collection(db, `salons/${salonId}/notifications`));
      await setDoc(nRef, {
        id: nRef.id,
        type: 'system',
        title: 'Alerta em Tempo Real Validado',
        message:
          'Notificações internas e alertas em primeiro plano estão ativos para este profissional.',
        professionalId: professionalId || auth?.currentUser?.uid || '',
        actionUrl: '/dashboard/agendamentos',
        pushDispatched: false,
        read: false,
        createdAt: Date.now(),
      });
    }
    return {
      success: true,
      tokensCount: 0,
      successCount: 0,
      failureCount: 0,
      adminUnavailable: true,
    };
  }

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    tokensCount?: number;
    successCount?: number;
    failureCount?: number;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || 'Falha ao enviar notificação de teste.');
  }

  return {
    success: Boolean(data.success),
    tokensCount: Number(data.tokensCount || 0),
    successCount: Number(data.successCount || 0),
    failureCount: Number(data.failureCount || 0),
  };
}

export function subscribeForegroundPushMessages(
  onNavigate?: (path: string) => void
): () => void {
  if (typeof window === 'undefined' || !app) return () => {};

  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  isSupported()
    .then((supported) => {
      if (!supported || cancelled || !app) return;
      const messaging = getMessaging(app);
      unsubscribe = onMessage(messaging, (payload) => {
        const title =
          payload.notification?.title ||
          payload.data?.title ||
          'Atualização na Agenda · LumièreOS';
        const body =
          payload.notification?.body ||
          payload.data?.body ||
          'Você recebeu um novo aviso de agendamento.';
        const action = payload.data?.action || '';
        const clickAction = payload.data?.click_action || '/dashboard/agendamentos';

        const toastAction = onNavigate
          ? {
              label: 'Ver Agenda',
              onClick: () => onNavigate(clickAction),
            }
          : undefined;

        if (action === 'cancel') {
          toast.error(title, { description: body, duration: 7000, action: toastAction });
        } else if (action === 'confirm') {
          toast.success(title, { description: body, duration: 7000, action: toastAction });
        } else {
          toast.info(title, { description: body, duration: 6000, action: toastAction });
        }
      });
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
}

function formatBrDate(ymd?: string): string {
  if (!ymd || typeof ymd !== 'string') return '';
  const clean = ymd.substring(0, 10);
  const parts = clean.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean;
}

export async function triggerAppointmentPushNotification(params: {
  salonId: string;
  appointmentId: string;
  professionalId: string;
  professionalName?: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  action: 'create' | 'confirm' | 'cancel';
  channelLabel?: string;
}): Promise<void> {
  if (!params.salonId || !params.appointmentId || !params.professionalId) return;

  try {
    const headers = await getAuthHeaders();
    if (!headers) return;

    const response = await fetch('/api/send-appointment-push', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (response.status === 503 && db) {
      // Fallback in-app notification when Admin SDK is unavailable in preview
      const when = [formatBrDate(params.date), params.time ? `às ${params.time}` : '']
        .filter(Boolean)
        .join(' ');
      const title =
        params.action === 'cancel'
          ? 'Agendamento Cancelado'
          : params.action === 'create'
            ? 'Novo Agendamento na Agenda'
            : 'Agendamento Confirmado!';
      const message =
        params.action === 'cancel'
          ? `${params.clientName} cancelou ${params.serviceName}${when ? ` em ${when}` : ''}.`
          : params.action === 'create'
            ? `${params.clientName} agendou ${params.serviceName}${when ? ` para ${when}` : ''}.`
            : `${params.clientName} confirmou ${params.serviceName}${when ? ` para ${when}` : ''}.`;

      const nRef = doc(collection(db, `salons/${params.salonId}/notifications`));
      await setDoc(nRef, {
        id: nRef.id,
        type:
          params.action === 'cancel'
            ? 'appointment_canceled'
            : params.action === 'create'
              ? 'appointment_created'
              : 'appointment_confirmed',
        title,
        message,
        appointmentId: params.appointmentId,
        professionalId: params.professionalId,
        professionalName: params.professionalName || '',
        clientName: params.clientName,
        date: params.date,
        time: params.time,
        actionUrl: '/dashboard/agendamentos',
        pushDispatched: false,
        read: false,
        createdAt: Date.now(),
      }).catch(() => undefined);
    }
  } catch (error) {
    console.error('[FCM Alert Client] Erro ao disparar push:', error);
  }
}

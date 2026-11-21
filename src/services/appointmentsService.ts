import { auth } from '@/lib/firebase';
import { Appointment, AppointmentStatus } from '@/types';

export interface AppointmentStatusMeta {
  key: AppointmentStatus;
  label: string;
  shortLabel: string;
  dotColor: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentHex: string;
}

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, AppointmentStatusMeta> = {
  scheduled: {
    key: 'scheduled',
    label: 'Agendado',
    shortLabel: 'Agendado',
    dotColor: 'bg-amber-500',
    cardBg: 'bg-amber-50/90',
    cardBorder: 'border-amber-300',
    cardText: 'text-amber-950',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    accentHex: '#D97706',
  },
  confirmed: {
    key: 'confirmed',
    label: 'Confirmado',
    shortLabel: 'Confirmado',
    dotColor: 'bg-emerald-500',
    cardBg: 'bg-emerald-50/95',
    cardBorder: 'border-emerald-400',
    cardText: 'text-emerald-950',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    accentHex: '#059669',
  },
  waiting: {
    key: 'waiting',
    label: 'Na Recepção',
    shortLabel: 'Aguardando',
    dotColor: 'bg-indigo-500',
    cardBg: 'bg-indigo-50/95',
    cardBorder: 'border-indigo-300',
    cardText: 'text-indigo-950',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-300',
    accentHex: '#4F46E5',
  },
  in_service: {
    key: 'in_service',
    label: 'Em Atendimento',
    shortLabel: 'Atendendo',
    dotColor: 'bg-sky-500',
    cardBg: 'bg-sky-50/95',
    cardBorder: 'border-sky-400',
    cardText: 'text-sky-950',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    badgeBorder: 'border-sky-300',
    accentHex: '#0284C7',
  },
  completed: {
    key: 'completed',
    label: 'Concluído',
    shortLabel: 'Concluído',
    dotColor: 'bg-teal-700',
    cardBg: 'bg-[#EEF5F1]',
    cardBorder: 'border-[#9CC3B0]',
    cardText: 'text-[#133A29]',
    badgeBg: 'bg-[#DCEEE4]',
    badgeText: 'text-[#164E38]',
    badgeBorder: 'border-[#9CC3B0]',
    accentHex: '#0F766E',
  },
  blocked: {
    key: 'blocked',
    label: 'Bloqueio',
    shortLabel: 'Bloqueio',
    dotColor: 'bg-stone-400',
    cardBg: 'bg-stone-100',
    cardBorder: 'border-stone-300',
    cardText: 'text-stone-700',
    badgeBg: 'bg-stone-200',
    badgeText: 'text-stone-700',
    badgeBorder: 'border-stone-300',
    accentHex: '#78716C',
  },
  canceled: {
    key: 'canceled',
    label: 'Cancelado',
    shortLabel: 'Cancelado',
    dotColor: 'bg-rose-500',
    cardBg: 'bg-rose-50/90',
    cardBorder: 'border-rose-300',
    cardText: 'text-rose-950',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-300',
    accentHex: '#E11D48',
  },
  no_show: {
    key: 'no_show',
    label: 'Não Compareceu',
    shortLabel: 'Faltou',
    dotColor: 'bg-orange-500',
    cardBg: 'bg-orange-50/90',
    cardBorder: 'border-orange-300',
    cardText: 'text-orange-950',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-300',
    accentHex: '#EA580C',
  },
};

export function getAppointmentStatusMeta(appOrStatus: Appointment | AppointmentStatus): AppointmentStatusMeta {
  if (typeof appOrStatus === 'string') {
    return APPOINTMENT_STATUS_META[appOrStatus] || APPOINTMENT_STATUS_META.scheduled;
  }
  if (appOrStatus.isBlock || appOrStatus.status === 'blocked') {
    return APPOINTMENT_STATUS_META.blocked;
  }
  return APPOINTMENT_STATUS_META[appOrStatus.status] || APPOINTMENT_STATUS_META.scheduled;
}

export function timeToMinutes(hhmm?: string): number {
  if (!hhmm || !hhmm.includes(':')) return 9 * 60;
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return 9 * 60;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface SendWhatsAppConfirmationResponse {
  success: boolean;
  mode: 'whatsapp_cloud' | 'wa_link';
  sentViaCloudApi: boolean;
  cloudApiError?: string;
  whatsappUrl: string;
  confirmUrl: string;
  messageText: string;
  phoneFound: boolean;
}

export interface LastWebhookEvent {
  timestamp: number;
  provider: string;
  phone: string;
  decision: 'confirm' | 'cancel';
  appointmentId: string;
  clientName: string;
  matched: boolean;
}

export interface WhatsAppSettingsData {
  enabled: boolean;
  phoneNumberId: string;
  wabaId: string;
  hasAccessToken: boolean;
  maskedAccessToken: string;
  hasWebhookSecret?: boolean;
  maskedWebhookSecret?: string;
  defaultMessageTemplate: string;
  webhookVerifyToken: string;
  lastWebhookEvent?: LastWebhookEvent | null;
}

export interface PublicConfirmInfo {
  salonId: string;
  appointmentId: string;
  salonName: string;
  salonPhone: string;
  salonAddress: string;
  clientFirstName: string;
  serviceName: string;
  professionalName: string;
  date: string;
  time: string;
  durationMinutes: number;
  price: number | null;
  status: AppointmentStatus;
  confirmationStatus: 'pending' | 'awaiting_client' | 'confirmed_by_client' | 'declined_by_client';
  confirmedAt: number | null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function sendWhatsAppConfirmation(
  salonId: string,
  appointmentId: string
): Promise<SendWhatsAppConfirmationResponse> {
  const headers = await getAuthHeaders();
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

  const res = await fetch('/api/appointments/send-whatsapp-confirmation', {
    method: 'POST',
    headers,
    body: JSON.stringify({ salonId, appointmentId, origin }),
  });

  const data = (await res.json().catch(() => ({}))) as SendWhatsAppConfirmationResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao solicitar confirmação pelo WhatsApp.');
  }
  return data;
}

export async function updateAppointmentStatusApi(
  salonId: string,
  appointmentId: string,
  status: AppointmentStatus
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/appointments/update-status', {
    method: 'POST',
    headers,
    body: JSON.stringify({ salonId, appointmentId, status }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao atualizar status do agendamento.');
  }
}

export async function getWhatsAppSettings(salonId: string): Promise<WhatsAppSettingsData> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/appointments/whatsapp-settings?salonId=${encodeURIComponent(salonId)}`, {
    headers,
  });
  const data = (await res.json().catch(() => ({}))) as WhatsAppSettingsData & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao carregar configurações de WhatsApp.');
  }
  return data;
}

export async function saveWhatsAppSettings(payload: {
  salonId: string;
  enabled: boolean;
  phoneNumberId: string;
  wabaId: string;
  accessToken?: string;
  webhookSecret?: string;
  defaultMessageTemplate: string;
  webhookVerifyToken?: string;
}): Promise<{ success: boolean; webhookVerifyToken: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/appointments/whatsapp-settings', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    webhookVerifyToken?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao salvar configurações de WhatsApp.');
  }
  return {
    success: Boolean(data.success),
    webhookVerifyToken: data.webhookVerifyToken || '',
  };
}

export async function testWhatsAppWebhookApi(
  salonId: string,
  appointmentId?: string,
  decision: 'confirm' | 'cancel' = 'confirm'
): Promise<{
  success: boolean;
  appointmentId: string;
  clientName: string;
  status: AppointmentStatus;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/appointments/test-whatsapp-webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify({ salonId, appointmentId, decision }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    appointmentId?: string;
    clientName?: string;
    status?: AppointmentStatus;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao simular recebimento do webhook.');
  }
  return {
    success: Boolean(data.success),
    appointmentId: data.appointmentId || '',
    clientName: data.clientName || 'Cliente',
    status: data.status || 'confirmed',
  };
}

export async function getPublicConfirmInfo(
  salonId: string,
  appointmentId: string,
  token: string
): Promise<PublicConfirmInfo> {
  const params = new URLSearchParams({ salon: salonId, id: appointmentId, token });
  const res = await fetch(`/api/appointments/public/confirm-info?${params.toString()}`);
  const data = (await res.json().catch(() => ({}))) as PublicConfirmInfo & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Não foi possível localizar este agendamento.');
  }
  return data;
}

export async function submitPublicConfirmation(payload: {
  salonId: string;
  appointmentId: string;
  token: string;
  decision: 'confirm' | 'cancel';
  reason?: string;
}): Promise<{
  success: boolean;
  status: AppointmentStatus;
  confirmationStatus: PublicConfirmInfo['confirmationStatus'];
}> {
  const res = await fetch('/api/appointments/public/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    status?: AppointmentStatus;
    confirmationStatus?: PublicConfirmInfo['confirmationStatus'];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao registrar confirmação.');
  }
  return {
    success: Boolean(data.success),
    status: data.status || 'confirmed',
    confirmationStatus: data.confirmationStatus || 'confirmed_by_client',
  };
}

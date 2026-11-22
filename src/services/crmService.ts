import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { OperationType, reportFirestoreListenerError } from '@/lib/firestoreError';
import { formatWhatsAppHref, normalizeDigits, normalizePhoneKey } from '@/services/clientsService';
import type {
  Appointment,
  Client,
  CrmAttendant,
  CrmCampaign,
  CrmCampaignDispatch,
  CrmCampaignType,
  CrmConversation,
  CrmFunnelStage,
  CrmMessage,
  CrmOpportunity,
  CrmOpportunityNote,
  CrmOrigin,
  CrmQuickReply,
  CrmSettings,
} from '@/types';

export const DEFAULT_CRM_SETTINGS: CrmSettings = {
  funnelRules: {
    awaitingReplyAlertHours: 24,
    inServiceStalledDays: 2,
    autoLostDays: 14,
    aiHandoffTimeoutMinutes: 15,
    reopenWindowDays: 7,
    autoEstimateWithAi: true,
    autoLinkClientByPhone: true,
  },
  teamRules: {
    requireSignature: true,
    privateConversations: false,
    autoAssignOnReply: true,
  },
  aiConfig: {
    enabled: true,
    agentName: 'Lumi',
    tone: 'sofisticado',
    greetingMessage:
      'Olá! ✨ Seja bem-vinda ao nosso atendimento. Como posso ajudar a cuidar do seu momento hoje?',
    qualificationInstructions:
      'Apresentar valores conforme nosso catálogo real, sugerir horários disponíveis e encaminhar para uma consultora quando houver dúvidas técnicas ou pedidos de avaliação personalizada.',
    handoffOnPriceObjection: true,
    handoffOnHumanRequest: true,
    workingHoursOnly: false,
  },
  updatedAt: 0,
};

export const DEFAULT_CRM_CAMPAIGNS: Array<Omit<CrmCampaign, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'confirmation',
    type: 'confirmation',
    title: 'Confirmação de Horário',
    description: 'Reduz faltas confirmando atendimentos agendados com link direto 1-clique.',
    enabled: true,
    messageTemplate:
      'Olá {cliente}! ✨ Passando para confirmar seu horário de {servico} no {salao} em {data} às {hora}. Podemos confirmar sua presença?',
    sendWindowStart: '09:00',
    sendWindowEnd: '19:00',
    dailyLimit: 80,
    config: {
      daysBefore: 1,
    },
    metrics: {
      sentCount: 0,
      deliveredCount: 0,
      repliedCount: 0,
      convertedBookings: 0,
      recoveredRevenue: 0,
      csatSum: 0,
      csatCount: 0,
    },
  },
  {
    id: 'birthday',
    type: 'birthday',
    title: 'Aniversariantes do Mês',
    description: 'Celebre o aniversário da cliente com um mimo exclusivo e convite para reserva.',
    enabled: false,
    messageTemplate:
      'Feliz aniversário, {cliente}! ✨ Toda a equipe do {salao} deseja um ciclo iluminado. Preparamos um mimo especial para você celebrar conosco esta semana!',
    sendWindowStart: '09:00',
    sendWindowEnd: '18:00',
    dailyLimit: 50,
    config: {
      birthdayTiming: 'on_day',
      birthdayDaysBefore: 3,
      activeRecentMonths: 12,
    },
    metrics: {
      sentCount: 0,
      deliveredCount: 0,
      repliedCount: 0,
      convertedBookings: 0,
      recoveredRevenue: 0,
      csatSum: 0,
      csatCount: 0,
    },
  },
  {
    id: 'service_return',
    type: 'service_return',
    title: 'Retorno de Manutenção',
    description: 'Lembra clientes no prazo ideal de manutenção de cor, corte, unhas ou estética.',
    enabled: false,
    messageTemplate:
      'Oi {cliente}! Tudo bem? Já está na hora ideal de renovar {servico} aqui no {salao}. Quer que eu veja os melhores horários desta semana para você?',
    sendWindowStart: '10:00',
    sendWindowEnd: '18:30',
    dailyLimit: 60,
    config: {
      defaultReturnDays: 45,
      blockBookedNextDays: 90,
    },
    metrics: {
      sentCount: 0,
      deliveredCount: 0,
      repliedCount: 0,
      convertedBookings: 0,
      recoveredRevenue: 0,
      csatSum: 0,
      csatCount: 0,
    },
  },
  {
    id: 'inactive_clients',
    type: 'inactive_clients',
    title: 'Reativação de Inativos',
    description: 'Resgata clientes sem visitas há meses com abordagem elegante e sem spam.',
    enabled: false,
    messageTemplate:
      'Olá {cliente}, sentimos sua falta por aqui no {salao}! ✨ Temos novidades especiais em {servico} e horários reservados esta semana. Vamos agendar seu retorno?',
    sendWindowStart: '10:00',
    sendWindowEnd: '18:00',
    dailyLimit: 50,
    config: {
      inactiveMonths: 3,
      blockBookedNextDays: 90,
    },
    metrics: {
      sentCount: 0,
      deliveredCount: 0,
      repliedCount: 0,
      convertedBookings: 0,
      recoveredRevenue: 0,
      csatSum: 0,
      csatCount: 0,
    },
  },
  {
    id: 'post_service_csat',
    type: 'post_service_csat',
    title: 'Pós-atendimento (CSAT)',
    description: 'Avalia a experiência de 1 a 5 estrelas logo após o atendimento e coleta feedback.',
    enabled: false,
    messageTemplate:
      'Oi {cliente}! Esperamos que tenha amado seu atendimento de {servico} no {salao}. De 1 a 5, qual nota você dá para a sua experiência hoje?',
    sendWindowStart: '09:30',
    sendWindowEnd: '20:00',
    dailyLimit: 80,
    config: {
      daysBefore: 1,
    },
    metrics: {
      sentCount: 0,
      deliveredCount: 0,
      repliedCount: 0,
      convertedBookings: 0,
      recoveredRevenue: 0,
      csatSum: 0,
      csatCount: 0,
    },
  },
];

export const DEFAULT_QUICK_REPLIES: Array<Omit<CrmQuickReply, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    shortcut: 'boasvindas',
    title: 'Boas-vindas Atelier',
    body: 'Olá! ✨ Seja muito bem-vinda! Para agilizar seu atendimento, qual procedimento e período do dia você prefere?',
    scope: 'salon',
    usageCount: 0,
  },
  {
    shortcut: 'endereco',
    title: 'Endereço e Estacionamento',
    body: 'Estamos esperando por você com todo conforto! Caso precise da localização exata ou indicação de estacionamento próximo, me avise que envio agora.',
    scope: 'salon',
    usageCount: 0,
  },
  {
    shortcut: 'pix',
    title: 'Sinal / Reserva via PIX',
    body: 'Para garantir a reserva exclusiva da sua cadeira, confirmamos com um sinal via PIX. Assim que concluir, me envie o comprovante por aqui para validarmos!',
    scope: 'salon',
    usageCount: 0,
  },
  {
    shortcut: 'reagendar',
    title: 'Opções de Reagendamento',
    body: 'Sem problemas! Vamos ajustar seu horário com carinho. Qual dia da semana e turno (manhã ou tarde) ficam melhores para você?',
    scope: 'salon',
    usageCount: 0,
  },
];

export const FUNNEL_STAGE_META: Record<
  CrmFunnelStage,
  { id: CrmFunnelStage; label: string; shortLabel: string; dotColor: string; accentClass: string }
> = {
  awaiting_reply: {
    id: 'awaiting_reply',
    label: 'Aguardando resposta',
    shortLabel: 'Aguardando',
    dotColor: '#D97706',
    accentClass: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  in_service: {
    id: 'in_service',
    label: 'Em atendimento',
    shortLabel: 'Atendendo',
    dotColor: '#0284C7',
    accentClass: 'text-sky-700 bg-sky-50 border-sky-200',
  },
  interested: {
    id: 'interested',
    label: 'Interessado',
    shortLabel: 'Interessado',
    dotColor: '#9F844A',
    accentClass: 'text-[#8A6D36] bg-[#F5F1E9] border-[#D8C79F]',
  },
  scheduled: {
    id: 'scheduled',
    label: 'Agendado',
    shortLabel: 'Agendado',
    dotColor: '#16A34A',
    accentClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  lost: {
    id: 'lost',
    label: 'Perdido',
    shortLabel: 'Perdido',
    dotColor: '#DC2626',
    accentClass: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  other: {
    id: 'other',
    label: 'Outros assuntos',
    shortLabel: 'Outros',
    dotColor: '#6B6B6B',
    accentClass: 'text-neutral-700 bg-neutral-100 border-neutral-200',
  },
};

export const ORIGIN_LABELS: Record<CrmOrigin, string> = {
  receptivo: 'Receptivo',
  confirmacao: 'Confirmação',
  marketing: 'Marketing',
  attendant: 'Atendente',
};

export const CLOSE_REASONS_BY_STAGE: Record<'scheduled' | 'lost' | 'other', string[]> = {
  scheduled: ['Agendou pela conversa', 'Agendou por outro canal', 'Remarcou'],
  lost: ['Sem retorno', 'Deixou para depois', 'Preço', 'Sem horário', 'Agendou em outro lugar', 'Outro'],
  other: ['Dúvida', 'Atraso/aviso', 'Cobrança', 'Fornecedor', 'Engano', 'Outro'],
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Faça login novamente.');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// =====================================================
// FIRESTORE REAL-TIME SUBSCRIPTIONS
// =====================================================

export function subscribeCrmConversations(
  salonId: string,
  onData: (items: CrmConversation[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(
    collection(db, `salons/${salonId}/crmConversations`),
    orderBy('lastMessageAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: CrmConversation[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CrmConversation);
      });
      list.sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return (b.lastMessageAt || 0) - (a.lastMessageAt || 0);
      });
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/crmConversations`);
      onError?.(err);
    }
  );
}

export function subscribeCrmMessages(
  salonId: string,
  conversationId: string,
  onData: (items: CrmMessage[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(
    collection(db, `salons/${salonId}/crmConversations/${conversationId}/messages`),
    orderBy('createdAt', 'asc'),
    limit(250)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: CrmMessage[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CrmMessage);
      });
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(
        err,
        OperationType.LIST,
        `salons/${salonId}/crmConversations/${conversationId}/messages`
      );
      onError?.(err);
    }
  );
}

export function subscribeCrmOpportunities(
  salonId: string,
  onData: (items: CrmOpportunity[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(
    collection(db, `salons/${salonId}/crmOpportunities`),
    orderBy('updatedAt', 'desc'),
    limit(300)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: CrmOpportunity[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CrmOpportunity);
      });
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/crmOpportunities`);
      onError?.(err);
    }
  );
}

export function subscribeCrmCampaigns(
  salonId: string,
  onData: (items: CrmCampaign[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, `salons/${salonId}/crmCampaigns`));
  return onSnapshot(
    q,
    (snap) => {
      const map = new Map<string, CrmCampaign>();
      snap.forEach((docSnap) => {
        map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as CrmCampaign);
      });
      const merged = DEFAULT_CRM_CAMPAIGNS.map((def) => {
        const stored = map.get(def.id);
        return stored
          ? {
              ...def,
              ...stored,
              config: { ...def.config, ...(stored.config || {}) },
              metrics: { ...def.metrics, ...(stored.metrics || {}) },
            }
          : { ...def, createdAt: 0, updatedAt: 0 };
      });
      onData(merged);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/crmCampaigns`);
      onError?.(err);
    }
  );
}

export function subscribeCrmCampaignDispatches(
  salonId: string,
  onData: (items: CrmCampaignDispatch[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(
    collection(db, `salons/${salonId}/crmCampaignDispatches`),
    orderBy('dispatchedAt', 'desc'),
    limit(150)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: CrmCampaignDispatch[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CrmCampaignDispatch);
      });
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(
        err,
        OperationType.LIST,
        `salons/${salonId}/crmCampaignDispatches`
      );
      onError?.(err);
    }
  );
}

export function subscribeCrmQuickReplies(
  salonId: string,
  onData: (items: CrmQuickReply[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, `salons/${salonId}/crmQuickReplies`));
  return onSnapshot(
    q,
    (snap) => {
      const list: CrmQuickReply[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CrmQuickReply);
      });
      list.sort((a, b) => a.shortcut.localeCompare(b.shortcut));
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/crmQuickReplies`);
      onError?.(err);
    }
  );
}

export function subscribeCrmAttendants(
  salonId: string,
  onData: (items: CrmAttendant[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, `salons/${salonId}/crmAttendants`));
  return onSnapshot(
    q,
    (snap) => {
      const list: CrmAttendant[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CrmAttendant);
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/crmAttendants`);
      onError?.(err);
    }
  );
}

export function subscribeCrmSettings(
  salonId: string,
  onData: (settings: CrmSettings) => void,
  onError?: (err: unknown) => void
) {
  const ref = doc(db, `salons/${salonId}/crmSettings`, 'config');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_CRM_SETTINGS);
        return;
      }
      const d = snap.data() as Partial<CrmSettings>;
      onData({
        id: snap.id,
        funnelRules: { ...DEFAULT_CRM_SETTINGS.funnelRules, ...(d.funnelRules || {}) },
        teamRules: { ...DEFAULT_CRM_SETTINGS.teamRules, ...(d.teamRules || {}) },
        aiConfig: { ...DEFAULT_CRM_SETTINGS.aiConfig, ...(d.aiConfig || {}) },
        updatedAt: Number(d.updatedAt || 0),
      });
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.GET, `salons/${salonId}/crmSettings/config`);
      onError?.(err);
    }
  );
}

// =====================================================
// CONVERSATION & MESSAGING OPERATIONS
// =====================================================

export async function createOrOpenConversation(params: {
  salonId: string;
  client?: Client | null;
  name: string;
  phone: string;
  origin?: CrmOrigin;
  initialStage?: CrmFunnelStage;
  estimatedValue?: number;
  serviceInterest?: string;
  attendantId?: string;
  attendantName?: string;
  initialMessage?: string;
}): Promise<{ conversationId: string; opportunityId: string }> {
  const now = Date.now();
  const cleanDigits = normalizeDigits(params.phone);
  const phoneKey = normalizePhoneKey(params.phone);
  const convId = phoneKey ? `wa_${phoneKey}` : `wa_${now}`;
  const formattedPhone =
    cleanDigits.startsWith('55') && cleanDigits.length >= 12
      ? cleanDigits
      : cleanDigits.length === 10 || cleanDigits.length === 11
        ? `55${cleanDigits}`
        : cleanDigits;

  const oppRef = doc(collection(db, `salons/${params.salonId}/crmOpportunities`));
  const oppNumber = Math.floor(1000 + (now % 8999));

  const opportunity: CrmOpportunity = {
    id: oppRef.id,
    opportunityNumber: oppNumber,
    conversationId: convId,
    clientId: params.client?.id || '',
    clientName: params.name.trim(),
    clientPhone: formattedPhone || params.phone.trim(),
    stage: params.initialStage || 'in_service',
    origin: params.origin || 'attendant',
    assignedAttendantId: params.attendantId || '',
    assignedAttendantName: params.attendantName || '',
    estimatedValue: Number(params.estimatedValue || 0),
    valueSource: params.estimatedValue ? 'manual' : 'ai',
    serviceInterest: params.serviceInterest || '',
    notes: [],
    history: [
      {
        id: `hist_${now}`,
        action: 'created',
        detail: `Oportunidade #${oppNumber} criada manualmente`,
        actorName: params.attendantName || 'Equipe',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const convRef = doc(db, `salons/${params.salonId}/crmConversations`, convId);
  const convPayload: CrmConversation = {
    id: convId,
    salonId: params.salonId,
    clientId: params.client?.id || '',
    clientName: params.name.trim(),
    clientPhone: formattedPhone || params.phone.trim(),
    clientEmail: params.client?.email || '',
    channel: 'whatsapp',
    status: 'in_service',
    handlingMode: 'human',
    assignedAttendantId: params.attendantId || '',
    assignedAttendantName: params.attendantName || '',
    aiPausedForClient: false,
    isPinned: false,
    unreadCount: 0,
    lastMessageText: params.initialMessage?.trim() || 'Conversa iniciada pelo painel CRM',
    lastMessageAt: now,
    lastMessageDirection: 'system',
    origin: params.origin || 'attendant',
    opportunityId: oppRef.id,
    opportunityNumber: oppNumber,
    createdAt: now,
    updatedAt: now,
  };

  await Promise.all([
    setDoc(oppRef, opportunity, { merge: true }),
    setDoc(convRef, convPayload, { merge: true }),
  ]);

  if (params.initialMessage?.trim()) {
    const msgRef = doc(collection(db, `salons/${params.salonId}/crmConversations/${convId}/messages`));
    await setDoc(msgRef, {
      id: msgRef.id,
      conversationId: convId,
      direction: 'outbound',
      senderType: 'attendant',
      senderId: params.attendantId || '',
      senderName: params.attendantName || 'Equipe',
      body: params.initialMessage.trim(),
      mediaType: 'text',
      deliveryStatus: 'queued',
      createdAt: now,
    } satisfies CrmMessage);
  }

  return { conversationId: convId, opportunityId: oppRef.id };
}

export async function sendCrmMessageApi(params: {
  salonId: string;
  conversation: CrmConversation;
  body: string;
  attendantId?: string;
  attendantName?: string;
  useSignature?: boolean;
  senderType?: 'attendant' | 'ai';
}): Promise<{
  mode: 'whatsapp_cloud' | 'wa_link';
  sentViaCloudApi: boolean;
  waLink: string;
  cloudApiError?: string;
}> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/crm/messages/send', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        salonId: params.salonId,
        conversationId: params.conversation.id,
        body: params.body,
        attendantId: params.attendantId,
        attendantName: params.attendantName,
        useSignature: params.useSignature,
        senderType: params.senderType || 'attendant',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      mode?: 'whatsapp_cloud' | 'wa_link';
      sentViaCloudApi?: boolean;
      waLink?: string;
      cloudApiError?: string;
      error?: string;
      code?: string;
    };
    if (res.ok) {
      return {
        mode: data.mode || 'wa_link',
        sentViaCloudApi: Boolean(data.sentViaCloudApi),
        waLink: data.waLink || formatWhatsAppHref(params.conversation.clientPhone),
        cloudApiError: data.cloudApiError,
      };
    }
    if (res.status !== 503 && data.code !== 'ADMIN_UNAVAILABLE') {
      throw new Error(data.error || 'Erro ao enviar mensagem.');
    }
  } catch (err: unknown) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
  }

  // Fallback when Firebase Admin SDK is unavailable in local sandbox
  const now = Date.now();
  const formattedBody =
    params.useSignature && (params.senderType || 'attendant') === 'attendant' && params.attendantName
      ? `*${params.attendantName}:*\n${params.body}`
      : params.body;

  const msgRef = doc(
    collection(db, `salons/${params.salonId}/crmConversations/${params.conversation.id}/messages`)
  );
  await setDoc(msgRef, {
    id: msgRef.id,
    conversationId: params.conversation.id,
    direction: 'outbound',
    senderType: params.senderType || 'attendant',
    senderId: params.attendantId || '',
    senderName:
      params.senderType === 'ai' ? 'Lumi IA' : params.attendantName || 'Equipe',
    body: formattedBody,
    mediaType: 'text',
    deliveryStatus: 'queued',
    createdAt: now,
  } satisfies CrmMessage);

  const convRef = doc(db, `salons/${params.salonId}/crmConversations`, params.conversation.id);
  await setDoc(
    convRef,
    {
      status: 'in_service',
      handlingMode: params.senderType === 'ai' ? 'ai' : 'human',
      assignedAttendantId: params.conversation.assignedAttendantId || params.attendantId || '',
      assignedAttendantName:
        params.conversation.assignedAttendantName || params.attendantName || 'Equipe',
      unreadCount: 0,
      lastMessageText: params.body.slice(0, 500),
      lastMessageAt: now,
      lastMessageDirection: 'outbound',
      updatedAt: now,
    },
    { merge: true }
  );

  if (params.conversation.opportunityId) {
    await setDoc(
      doc(db, `salons/${params.salonId}/crmOpportunities`, params.conversation.opportunityId),
      {
        waitingSince: 0,
        stage: 'in_service',
        updatedAt: now,
      },
      { merge: true }
    );
  }

  const baseHref = formatWhatsAppHref(params.conversation.clientPhone);
  return {
    mode: 'wa_link',
    sentViaCloudApi: false,
    waLink: baseHref ? `${baseHref}?text=${encodeURIComponent(formattedBody)}` : '',
  };
}

export async function markConversationRead(salonId: string, conversationId: string): Promise<void> {
  await updateDoc(doc(db, `salons/${salonId}/crmConversations`, conversationId), {
    unreadCount: 0,
    updatedAt: Date.now(),
  });
}

export async function toggleConversationPin(
  salonId: string,
  conversationId: string,
  isPinned: boolean
): Promise<void> {
  await updateDoc(doc(db, `salons/${salonId}/crmConversations`, conversationId), {
    isPinned,
    updatedAt: Date.now(),
  });
}

export async function assumeConversation(
  salonId: string,
  conversation: CrmConversation,
  attendantId: string,
  attendantName: string
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, `salons/${salonId}/crmConversations`, conversation.id), {
    handlingMode: 'human',
    status: 'in_service',
    assignedAttendantId: attendantId,
    assignedAttendantName: attendantName,
    unreadCount: 0,
    updatedAt: now,
  });

  const sysMsgRef = doc(
    collection(db, `salons/${salonId}/crmConversations/${conversation.id}/messages`)
  );
  await setDoc(sysMsgRef, {
    id: sysMsgRef.id,
    conversationId: conversation.id,
    direction: 'system',
    senderType: 'system',
    senderName: 'Sistema CRM',
    body: `${attendantName} assumiu este atendimento.`,
    deliveryStatus: 'read',
    createdAt: now,
  } satisfies CrmMessage);

  if (conversation.opportunityId) {
    await setDoc(
      doc(db, `salons/${salonId}/crmOpportunities`, conversation.opportunityId),
      {
        assignedAttendantId: attendantId,
        assignedAttendantName: attendantName,
        stage: 'in_service',
        updatedAt: now,
      },
      { merge: true }
    );
  }
}

export async function returnConversationToAi(
  salonId: string,
  conversation: CrmConversation,
  actorName: string
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, `salons/${salonId}/crmConversations`, conversation.id), {
    handlingMode: 'ai',
    aiPausedForClient: false,
    updatedAt: now,
  });

  const sysMsgRef = doc(
    collection(db, `salons/${salonId}/crmConversations/${conversation.id}/messages`)
  );
  await setDoc(sysMsgRef, {
    id: sysMsgRef.id,
    conversationId: conversation.id,
    direction: 'system',
    senderType: 'system',
    senderName: 'Sistema CRM',
    body: `${actorName} devolveu a conversa para a Lumi IA.`,
    deliveryStatus: 'read',
    createdAt: now,
  } satisfies CrmMessage);
}

export async function toggleClientAiPause(
  salonId: string,
  conversationId: string,
  paused: boolean
): Promise<void> {
  await updateDoc(doc(db, `salons/${salonId}/crmConversations`, conversationId), {
    aiPausedForClient: paused,
    handlingMode: paused ? 'human' : 'ai',
    updatedAt: Date.now(),
  });
}

export async function linkConversationClient(
  salonId: string,
  conversationId: string,
  client: Client,
  opportunityId?: string
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, `salons/${salonId}/crmConversations`, conversationId), {
    clientId: client.id,
    clientName: client.name,
    clientEmail: client.email || '',
    updatedAt: now,
  });
  if (opportunityId) {
    await updateDoc(doc(db, `salons/${salonId}/crmOpportunities`, opportunityId), {
      clientId: client.id,
      clientName: client.name,
      updatedAt: now,
    });
  }
}

// =====================================================
// LUMI IA ASSISTANT (GEMINI)
// =====================================================

export interface AiAssistResponse {
  success: boolean;
  suggestedReply: string;
  detectedService: string;
  estimatedValue: number;
  recommendedStage: CrmFunnelStage;
  handoffRecommended: boolean;
  intentSummary: string;
}

export async function requestAiAssistApi(params: {
  salonId: string;
  clientName: string;
  clientVisitsCount: number;
  action: 'suggest_reply' | 'qualify_opportunity' | 'recovery_draft';
  transcript: Array<{ direction: 'inbound' | 'outbound' | 'system'; body: string }>;
  tone?: 'acolhedor' | 'sofisticado' | 'objetivo';
  customInstructions?: string;
  opportunityId?: string;
}): Promise<AiAssistResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/crm/ai/assist', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<AiAssistResponse> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao consultar a Lumi IA.');
  }
  return data as AiAssistResponse;
}

// =====================================================
// FUNNEL OPPORTUNITIES
// =====================================================

export async function moveOpportunityStage(
  salonId: string,
  opportunity: CrmOpportunity,
  targetStage: CrmFunnelStage,
  actorName: string,
  options?: { closeReason?: string; closeComment?: string; manual?: boolean }
): Promise<void> {
  const now = Date.now();
  const isClosed = targetStage === 'scheduled' || targetStage === 'lost' || targetStage === 'other';
  const nextHistory = [
    ...(opportunity.history || []).slice(-35),
    {
      id: `hist_${now}`,
      action: 'stage_changed',
      detail: `Etapa: ${FUNNEL_STAGE_META[opportunity.stage]?.label || opportunity.stage} → ${FUNNEL_STAGE_META[targetStage]?.label || targetStage}${options?.closeReason ? ` (${options.closeReason})` : ''}`,
      actorName,
      createdAt: now,
    },
  ];

  const nextNotes = [...(opportunity.notes || [])];
  if (options?.closeReason || options?.closeComment) {
    nextNotes.push({
      id: `note_close_${now}`,
      text: `[Fechamento: ${options.closeReason || FUNNEL_STAGE_META[targetStage].label}]${options.closeComment ? ` ${options.closeComment}` : ''}`,
      authorId: auth.currentUser?.uid || 'system',
      authorName: actorName,
      createdAt: now,
    });
  }

  await updateDoc(doc(db, `salons/${salonId}/crmOpportunities`, opportunity.id), {
    stage: targetStage,
    movedManually: options?.manual !== false,
    ...(options?.closeReason ? { closeReason: options.closeReason } : {}),
    ...(options?.closeComment ? { closeComment: options.closeComment } : {}),
    ...(isClosed ? { closedAt: now, waitingSince: 0 } : {}),
    notes: nextNotes.slice(-50),
    history: nextHistory,
    updatedAt: now,
  });
}

export async function updateOpportunityValue(
  salonId: string,
  opportunity: CrmOpportunity,
  estimatedValue: number,
  actorName: string
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, `salons/${salonId}/crmOpportunities`, opportunity.id), {
    estimatedValue: Math.max(0, Number(estimatedValue) || 0),
    valueSource: 'manual',
    history: [
      ...(opportunity.history || []).slice(-35),
      {
        id: `hist_${now}`,
        action: 'value_updated',
        detail: `Valor atualizado para R$ ${Number(estimatedValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        actorName,
        createdAt: now,
      },
    ],
    updatedAt: now,
  });
}

export async function addOpportunityNote(
  salonId: string,
  opportunity: CrmOpportunity,
  noteText: string,
  authorId: string,
  authorName: string
): Promise<void> {
  const trimmed = noteText.trim();
  if (!trimmed) return;
  const now = Date.now();
  const note: CrmOpportunityNote = {
    id: `note_${now}`,
    text: trimmed,
    authorId,
    authorName,
    createdAt: now,
  };
  await updateDoc(doc(db, `salons/${salonId}/crmOpportunities`, opportunity.id), {
    notes: [...(opportunity.notes || []).slice(-49), note],
    updatedAt: now,
  });
}

export async function deleteOpportunityNote(
  salonId: string,
  opportunity: CrmOpportunity,
  noteId: string
): Promise<void> {
  await updateDoc(doc(db, `salons/${salonId}/crmOpportunities`, opportunity.id), {
    notes: (opportunity.notes || []).filter((n) => n.id !== noteId),
    updatedAt: Date.now(),
  });
}

export async function deleteOpportunity(salonId: string, opportunityId: string): Promise<void> {
  await deleteDoc(doc(db, `salons/${salonId}/crmOpportunities`, opportunityId));
}

// =====================================================
// CAMPAIGNS & AUDIENCE EVALUATION
// =====================================================

export async function saveCrmCampaign(
  salonId: string,
  campaign: CrmCampaign
): Promise<void> {
  const now = Date.now();
  await setDoc(
    doc(db, `salons/${salonId}/crmCampaigns`, campaign.id),
    {
      ...campaign,
      updatedAt: now,
      createdAt: campaign.createdAt || now,
    },
    { merge: true }
  );
}

export interface CampaignCandidate {
  clientId: string;
  clientName: string;
  clientPhone: string;
  reason: string;
  renderedMessage: string;
  eligible: boolean;
  blockedReason?: string;
}

export interface CampaignEvaluationResult {
  success: boolean;
  totalEvaluated: number;
  eligibleCount: number;
  estimatedDaysToClear: number;
  candidates: CampaignCandidate[];
}

export async function evaluateCampaignAudienceApi(params: {
  salonId: string;
  salonName: string;
  campaign: CrmCampaign;
  clients: Client[];
  appointments: Appointment[];
}): Promise<CampaignEvaluationResult> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/crm/campaigns/evaluate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        salonId: params.salonId,
        campaignType: params.campaign.type,
        messageTemplate: params.campaign.messageTemplate,
        dailyLimit: params.campaign.dailyLimit,
        inactiveMonths: params.campaign.config.inactiveMonths || 3,
        defaultReturnDays: params.campaign.config.defaultReturnDays || 45,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as CampaignEvaluationResult & {
      error?: string;
      code?: string;
    };
    if (res.ok) return data;
    if (res.status !== 503 && data.code !== 'ADMIN_UNAVAILABLE') {
      throw new Error(data.error || 'Erro ao avaliar público da campanha.');
    }
  } catch (err: unknown) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
  }

  // Client-side exact Firestore state evaluation fallback when Admin SDK returns 503
  const today = new Date();
  const todayYmd = today.toISOString().slice(0, 10);
  const tomorrowYmd = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  const currentMonth = todayYmd.slice(5, 7);
  const candidates: CampaignCandidate[] = [];

  const renderMsg = (clientName: string, service?: string, date?: string, time?: string) => {
    const first = clientName.trim().split(/\s+/)[0] || 'Cliente';
    return params.campaign.messageTemplate
      .replace(/\{cliente\}/g, first)
      .replace(/\{cliente_completo\}/g, clientName)
      .replace(/\{salao\}/g, params.salonName || 'Nosso Salão')
      .replace(/\{servico\}/g, service || 'seu atendimento')
      .replace(/\{data\}/g, date || '')
      .replace(/\{hora\}/g, time || '');
  };

  if (params.campaign.type === 'confirmation') {
    params.appointments
      .filter((a) => !a.isBlock && (a.date === todayYmd || a.date === tomorrowYmd) && a.status === 'scheduled')
      .forEach((a) => {
        const client = params.clients.find((c) => c.id === a.clientId);
        const phone = a.clientPhone || client?.phone || '';
        const dateBr = a.date.split('-').reverse().join('/');
        candidates.push({
          clientId: a.clientId,
          clientName: a.clientName,
          clientPhone: phone,
          reason: `Horário ${dateBr} às ${a.time}`,
          renderedMessage: renderMsg(a.clientName, a.serviceName, dateBr, a.time),
          eligible: Boolean(phone),
          blockedReason: phone ? undefined : 'Sem WhatsApp cadastrado',
        });
      });
  } else if (params.campaign.type === 'birthday') {
    params.clients
      .filter((c) => !c.deletedAt && !c.archived && c.birthDate?.slice(5, 7) === currentMonth)
      .forEach((c) => {
        candidates.push({
          clientId: c.id,
          clientName: c.name,
          clientPhone: c.phone || '',
          reason: `Aniversário ${c.birthDate?.slice(8, 10)}/${c.birthDate?.slice(5, 7)}`,
          renderedMessage: renderMsg(c.name),
          eligible: Boolean(c.phone),
          blockedReason: c.phone ? undefined : 'Sem WhatsApp cadastrado',
        });
      });
  } else if (params.campaign.type === 'post_service_csat') {
    params.appointments
      .filter((a) => !a.isBlock && a.status === 'completed')
      .slice(0, params.campaign.dailyLimit)
      .forEach((a) => {
        const client = params.clients.find((c) => c.id === a.clientId);
        const phone = a.clientPhone || client?.phone || '';
        candidates.push({
          clientId: a.clientId,
          clientName: a.clientName,
          clientPhone: phone,
          reason: `Concluiu ${a.serviceName}`,
          renderedMessage: renderMsg(a.clientName, a.serviceName),
          eligible: Boolean(phone),
          blockedReason: phone ? undefined : 'Sem telefone',
        });
      });
  } else {
    const minDays =
      params.campaign.type === 'inactive_clients'
        ? (params.campaign.config.inactiveMonths || 3) * 30
        : (params.campaign.config.defaultReturnDays || 45) - 8;
    params.clients
      .filter((c) => !c.deletedAt && !c.archived)
      .forEach((c) => {
        const completed = params.appointments
          .filter((a) => a.clientId === c.id && a.status === 'completed')
          .sort((x, y) => y.date.localeCompare(x.date));
        const hasFuture = params.appointments.some(
          (a) => a.clientId === c.id && a.date >= todayYmd && a.status !== 'canceled' && a.status !== 'no_show'
        );
        const refDate = completed[0]?.date || new Date(c.createdAt || today.getTime()).toISOString().slice(0, 10);
        const elapsedDays = Math.round(
          (today.getTime() - new Date(`${refDate}T12:00:00`).getTime()) / 86400000
        );
        if (elapsedDays < minDays) return;
        candidates.push({
          clientId: c.id,
          clientName: c.name,
          clientPhone: c.phone || '',
          reason: `Última visita há ${elapsedDays} dias`,
          renderedMessage: renderMsg(c.name, completed[0]?.serviceName),
          eligible: Boolean(c.phone) && !hasFuture,
          blockedReason: !c.phone ? 'Sem WhatsApp' : hasFuture ? 'Já possui horário futuro' : undefined,
        });
      });
  }

  const eligibleCount = candidates.filter((c) => c.eligible).length;
  return {
    success: true,
    totalEvaluated: candidates.length,
    eligibleCount,
    estimatedDaysToClear:
      eligibleCount > 0 ? Math.max(1, Math.ceil(eligibleCount / params.campaign.dailyLimit)) : 0,
    candidates: candidates.slice(0, params.campaign.dailyLimit),
  };
}

export async function dispatchCampaignApi(params: {
  salonId: string;
  campaign: CrmCampaign;
  recipients: CampaignCandidate[];
}): Promise<{
  dispatchedCount: number;
  sentCloudCount: number;
  queuedWaLinksCount: number;
  waLinks: Array<{ clientName: string; waLink: string }>;
}> {
  const eligible = params.recipients.filter((r) => r.eligible && r.clientPhone);
  if (eligible.length === 0) {
    throw new Error('Nenhum destinatário elegível com telefone válido selecionado.');
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/crm/campaigns/dispatch', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        salonId: params.salonId,
        campaignId: params.campaign.id,
        campaignType: params.campaign.type,
        recipients: eligible.slice(0, 50).map((r) => ({
          clientId: r.clientId,
          clientName: r.clientName,
          clientPhone: r.clientPhone,
          renderedMessage: r.renderedMessage,
        })),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      dispatchedCount?: number;
      sentCloudCount?: number;
      queuedWaLinksCount?: number;
      waLinks?: Array<{ clientName: string; waLink: string }>;
      error?: string;
      code?: string;
    };
    if (res.ok) {
      return {
        dispatchedCount: data.dispatchedCount || eligible.length,
        sentCloudCount: data.sentCloudCount || 0,
        queuedWaLinksCount: data.queuedWaLinksCount || 0,
        waLinks: data.waLinks || [],
      };
    }
    if (res.status !== 503 && data.code !== 'ADMIN_UNAVAILABLE') {
      throw new Error(data.error || 'Falha ao disparar campanha.');
    }
  } catch (err: unknown) {
    if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
      throw err;
    }
  }

  // Sandbox fallback
  const now = Date.now();
  const waLinks: Array<{ clientName: string; waLink: string }> = [];
  for (const r of eligible.slice(0, 50)) {
    const dispRef = doc(collection(db, `salons/${params.salonId}/crmCampaignDispatches`));
    await setDoc(dispRef, {
      id: dispRef.id,
      campaignId: params.campaign.id,
      campaignType: params.campaign.type,
      clientId: r.clientId,
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      status: 'sent',
      statusReason: 'Registrado via fila do CRM',
      renderedMessage: r.renderedMessage,
      dispatchedAt: now,
      createdAt: now,
    } satisfies CrmCampaignDispatch);

    const baseHref = formatWhatsAppHref(r.clientPhone);
    if (baseHref) {
      waLinks.push({
        clientName: r.clientName,
        waLink: `${baseHref}?text=${encodeURIComponent(r.renderedMessage)}`,
      });
    }
  }

  await setDoc(
    doc(db, `salons/${params.salonId}/crmCampaigns`, params.campaign.id),
    {
      ...params.campaign,
      lastRunAt: now,
      updatedAt: now,
      metrics: {
        ...params.campaign.metrics,
        sentCount: (params.campaign.metrics.sentCount || 0) + eligible.length,
        deliveredCount: (params.campaign.metrics.deliveredCount || 0) + eligible.length,
      },
    },
    { merge: true }
  );

  return {
    dispatchedCount: eligible.length,
    sentCloudCount: 0,
    queuedWaLinksCount: waLinks.length,
    waLinks: waLinks.slice(0, 10),
  };
}

// =====================================================
// QUICK REPLIES (/atalho), ATTENDANTS & SETTINGS
// =====================================================

export async function saveQuickReply(
  salonId: string,
  reply: Omit<CrmQuickReply, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> & {
    id?: string;
    createdAt?: number;
    usageCount?: number;
  }
): Promise<void> {
  const now = Date.now();
  const ref = reply.id
    ? doc(db, `salons/${salonId}/crmQuickReplies`, reply.id)
    : doc(collection(db, `salons/${salonId}/crmQuickReplies`));

  const cleanShortcut = reply.shortcut
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/\s+/g, '_');

  await setDoc(
    ref,
    {
      id: ref.id,
      shortcut: cleanShortcut,
      title: reply.title.trim(),
      body: reply.body.trim(),
      scope: reply.scope,
      ownerUid: reply.ownerUid || '',
      ownerName: reply.ownerName || '',
      usageCount: reply.usageCount || 0,
      createdAt: reply.createdAt || now,
      updatedAt: now,
    } satisfies CrmQuickReply,
    { merge: true }
  );
}

export async function deleteQuickReply(salonId: string, replyId: string): Promise<void> {
  await deleteDoc(doc(db, `salons/${salonId}/crmQuickReplies`, replyId));
}

export async function seedDefaultQuickReplies(salonId: string): Promise<void> {
  const now = Date.now();
  await Promise.all(
    DEFAULT_QUICK_REPLIES.map((item) => {
      const ref = doc(db, `salons/${salonId}/crmQuickReplies`, `preset_${item.shortcut}`);
      return setDoc(
        ref,
        {
          id: ref.id,
          ...item,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    })
  );
}

export async function saveCrmAttendant(
  salonId: string,
  attendant: Omit<CrmAttendant, 'createdAt' | 'updatedAt'> & { createdAt?: number }
): Promise<void> {
  const now = Date.now();
  await setDoc(
    doc(db, `salons/${salonId}/crmAttendants`, attendant.id),
    {
      ...attendant,
      createdAt: attendant.createdAt || now,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function removeCrmAttendant(salonId: string, attendantId: string): Promise<void> {
  await deleteDoc(doc(db, `salons/${salonId}/crmAttendants`, attendantId));
}

export async function saveCrmSettings(
  salonId: string,
  settings: CrmSettings
): Promise<void> {
  await setDoc(
    doc(db, `salons/${salonId}/crmSettings`, 'config'),
    {
      ...settings,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

// =====================================================
// ANALYTICS & SLA CALCULATORS
// =====================================================

export interface FunnelAnalyticsSummary {
  totalConversations: number;
  awaitingCount: number;
  inServiceCount: number;
  interestedCount: number;
  scheduledCount: number;
  lostCount: number;
  otherCount: number;
  conversionRatePct: number;
  avgFirstResponseMin: number;
  aiHandledPct: number;
  pipelinePotentialValue: number;
  scheduledRevenue: number;
  lostRevenue: number;
  biggestDropoffStage: string;
  biggestDropoffRatePct: number;
  byOrigin: Array<{ origin: CrmOrigin; label: string; total: number; scheduled: number; revenue: number }>;
  waitingNow: Array<{
    conversation: CrmConversation;
    opportunity?: CrmOpportunity;
    waitMinutes: number;
  }>;
  attendantStats: Array<{
    id: string;
    name: string;
    isOnline: boolean;
    conversations: number;
    scheduled: number;
    revenue: number;
    avgFirstResponseMin: number;
    lastSeenAt?: number;
  }>;
}

export function computeFunnelAnalytics(
  opportunities: CrmOpportunity[],
  conversations: CrmConversation[],
  attendants: CrmAttendant[],
  periodDays: number
): FunnelAnalyticsSummary {
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400000 : 0;
  const opps = opportunities.filter((o) => o.createdAt >= cutoff || o.updatedAt >= cutoff);
  const convs = conversations.filter((c) => c.lastMessageAt >= cutoff || c.createdAt >= cutoff);

  const stageCounts: Record<CrmFunnelStage, number> = {
    awaiting_reply: 0,
    in_service: 0,
    interested: 0,
    scheduled: 0,
    lost: 0,
    other: 0,
  };

  let pipelinePotentialValue = 0;
  let scheduledRevenue = 0;
  let lostRevenue = 0;

  opps.forEach((o) => {
    stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1;
    const val = Number(o.estimatedValue || 0);
    if (o.stage === 'scheduled') scheduledRevenue += val;
    else if (o.stage === 'lost') lostRevenue += val;
    else if (o.stage !== 'other') pipelinePotentialValue += val;
  });

  const closedDecisionTotal = stageCounts.scheduled + stageCounts.lost;
  const conversionBase = opps.length - stageCounts.other;
  const conversionRatePct =
    conversionBase > 0 ? Math.round((stageCounts.scheduled / conversionBase) * 100) : 0;

  const responseSamples = convs
    .map((c) => c.firstResponseMs || 0)
    .filter((ms) => ms > 0);
  const avgFirstResponseMin =
    responseSamples.length > 0
      ? Math.round(responseSamples.reduce((acc, v) => acc + v, 0) / responseSamples.length / 60000)
      : 0;

  const aiConvs = convs.filter((c) => c.handlingMode === 'ai').length;
  const aiHandledPct = convs.length > 0 ? Math.round((aiConvs / convs.length) * 100) : 0;

  // Drop-off diagnosis
  const dropoffAwaiting =
    opps.length > 0 && stageCounts.awaiting_reply > stageCounts.in_service
      ? Math.round((stageCounts.awaiting_reply / opps.length) * 100)
      : 0;
  const dropoffLost =
    closedDecisionTotal > 0 ? Math.round((stageCounts.lost / Math.max(1, conversionBase)) * 100) : 0;

  const biggestDropoffRatePct = Math.max(dropoffAwaiting, dropoffLost);
  const biggestDropoffStage =
    dropoffLost >= dropoffAwaiting
      ? 'Interessado → Agendado (Perdidos)'
      : 'Aguardando resposta → Em atendimento';

  const origins: CrmOrigin[] = ['receptivo', 'confirmacao', 'marketing', 'attendant'];
  const byOrigin = origins.map((origin) => {
    const group = opps.filter((o) => o.origin === origin);
    const sched = group.filter((o) => o.stage === 'scheduled');
    return {
      origin,
      label: ORIGIN_LABELS[origin],
      total: group.length,
      scheduled: sched.length,
      revenue: sched.reduce((acc, o) => acc + Number(o.estimatedValue || 0), 0),
    };
  });

  const oppMap = new Map(opportunities.map((o) => [o.id, o]));
  const now = Date.now();
  const waitingNow = conversations
    .filter((c) => c.status === 'awaiting_reply' || c.unreadCount > 0)
    .map((conversation) => {
      const refTime = conversation.lastInboundAt || conversation.lastMessageAt || now;
      return {
        conversation,
        opportunity: conversation.opportunityId ? oppMap.get(conversation.opportunityId) : undefined,
        waitMinutes: Math.max(1, Math.round((now - refTime) / 60000)),
      };
    })
    .sort((a, b) => b.waitMinutes - a.waitMinutes)
    .slice(0, 12);

  const attendantStats = attendants.map((att) => {
    const attConvs = convs.filter(
      (c) => c.assignedAttendantId === att.id || (att.userId && c.assignedAttendantId === att.userId)
    );
    const attOpps = opps.filter(
      (o) => o.assignedAttendantId === att.id || (att.userId && o.assignedAttendantId === att.userId)
    );
    const attSched = attOpps.filter((o) => o.stage === 'scheduled');
    const attRespSamples = attConvs.map((c) => c.firstResponseMs || 0).filter((v) => v > 0);
    return {
      id: att.id,
      name: att.name,
      isOnline: att.isOnline,
      conversations: attConvs.length,
      scheduled: attSched.length,
      revenue: attSched.reduce((acc, o) => acc + Number(o.estimatedValue || 0), 0),
      avgFirstResponseMin:
        attRespSamples.length > 0
          ? Math.round(attRespSamples.reduce((a, b) => a + b, 0) / attRespSamples.length / 60000)
          : 0,
      lastSeenAt: att.lastSeenAt,
    };
  });

  return {
    totalConversations: convs.length,
    awaitingCount: stageCounts.awaiting_reply,
    inServiceCount: stageCounts.in_service,
    interestedCount: stageCounts.interested,
    scheduledCount: stageCounts.scheduled,
    lostCount: stageCounts.lost,
    otherCount: stageCounts.other,
    conversionRatePct,
    avgFirstResponseMin,
    aiHandledPct,
    pipelinePotentialValue,
    scheduledRevenue,
    lostRevenue,
    biggestDropoffStage,
    biggestDropoffRatePct,
    byOrigin,
    waitingNow,
    attendantStats,
  };
}

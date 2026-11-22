import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { OperationType, reportFirestoreListenerError } from '@/lib/firestoreError';
import type {
  Client,
  ClientAddress,
  ClientCustomField,
  ClientFormScope,
  ClientNotice,
} from '@/types';

export interface DuplicateClientPair {
  id: string;
  primary: Client;
  secondary: Client;
  reasons: string[];
  score: number;
}

export interface MergeClientsPayload {
  salonId: string;
  primaryClientId: string;
  secondaryClientId: string;
  resolvedFields: {
    name: string;
    phone: string;
    secondaryPhone?: string;
    email?: string;
    gender?: string;
    birthDate?: string;
    cpf?: string;
    rg?: string;
    notes?: string;
    address?: ClientAddress;
  };
}

export interface MergeClientsResult {
  success: boolean;
  primaryClientId: string;
  secondaryClientId: string;
  migratedAppointments: number;
  migratedComandas: number;
}

export function slugifyFieldName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function normalizeDigits(raw?: string | null): string {
  return String(raw || '').replace(/\D/g, '');
}

export function normalizePhoneKey(raw?: string | null): string {
  const digits = normalizeDigits(raw);
  if (!digits) return '';
  // Strip country code 55 if Brazilian 12-13 digit format
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits.length >= 8 ? digits : '';
}

export function normalizeNameKey(raw?: string | null): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatWhatsAppHref(phone?: string | null): string {
  const digits = normalizeDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return `https://wa.me/${digits}`;
  if (digits.length === 10 || digits.length === 11) return `https://wa.me/55${digits}`;
  return `https://wa.me/${digits}`;
}

export function formatBirthDatePtBR(birthDate?: string | null): string {
  if (!birthDate) return '';
  const trimmed = birthDate.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];
    const monthLabel = months[Number(m) - 1] || m;
    return `${d} de ${monthLabel}${y === '0000' ? '' : ` de ${y}`}`;
  }
  return trimmed;
}

export function isBirthdayThisMonth(birthDate?: string | null): boolean {
  if (!birthDate) return false;
  const isoMatch = /^\d{4}-(\d{2})-\d{2}$/.exec(birthDate.trim());
  if (!isoMatch) return false;
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  return isoMatch[1] === currentMonth;
}

export async function lookupBrazilianCep(cep: string): Promise<Partial<ClientAddress> | null> {
  const digits = normalizeDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.erro) return null;
    return {
      zipCode: digits.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
      street: String(data.logradouro || ''),
      neighborhood: String(data.bairro || ''),
      city: String(data.localidade || ''),
      state: String(data.uf || ''),
    };
  } catch {
    return null;
  }
}

export function findDuplicateClientPairs(clients: Client[]): DuplicateClientPair[] {
  const active = clients.filter((c) => !c.deletedAt && !c.archived && c.status !== 'inactive');
  const pairsMap = new Map<string, DuplicateClientPair>();

  const registerPair = (a: Client, b: Client, reason: string, scoreWeight: number) => {
    // Prefer client with more appointments / LTV / older record as primary
    const aScore = (a.totalAppointments || 0) * 10 + (a.lifetimeValue || 0) * 0.01;
    const bScore = (b.totalAppointments || 0) * 10 + (b.lifetimeValue || 0) * 0.01;
    const primary = aScore >= bScore ? a : b;
    const secondary = primary.id === a.id ? b : a;
    const key = [primary.id, secondary.id].sort().join('__');
    const existing = pairsMap.get(key);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      existing.score += scoreWeight;
    } else {
      pairsMap.set(key, {
        id: key,
        primary,
        secondary,
        reasons: [reason],
        score: scoreWeight,
      });
    }
  };

  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    const aPhone = normalizePhoneKey(a.phone);
    const aEmail = (a.email || '').trim().toLowerCase();
    const aCpf = normalizeDigits(a.cpf);
    const aName = normalizeNameKey(a.name);

    for (let j = i + 1; j < active.length; j++) {
      const b = active[j];
      const bPhone = normalizePhoneKey(b.phone);
      const bEmail = (b.email || '').trim().toLowerCase();
      const bCpf = normalizeDigits(b.cpf);
      const bName = normalizeNameKey(b.name);

      if (aCpf && bCpf && aCpf.length >= 11 && aCpf === bCpf) {
        registerPair(a, b, 'Mesmo CPF', 100);
      }
      if (aPhone && bPhone && aPhone === bPhone) {
        registerPair(a, b, 'Mesmo telefone/WhatsApp', 90);
      }
      if (aEmail && bEmail && aEmail === bEmail) {
        registerPair(a, b, 'Mesmo e-mail', 85);
      }
      if (aName && bName && aName.length >= 4 && aName === bName) {
        registerPair(a, b, 'Nome idêntico', 60);
      }
    }
  }

  return Array.from(pairsMap.values()).sort((x, y) => y.score - x.score);
}

export function subscribeClientCustomFields(
  salonId: string,
  onData: (fields: ClientCustomField[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, `salons/${salonId}/clientCustomFields`));
  return onSnapshot(
    q,
    (snap) => {
      const list: ClientCustomField[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ClientCustomField);
      });
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/clientCustomFields`);
      onError?.(err);
    }
  );
}

export async function saveClientCustomField(
  salonId: string,
  field: Omit<ClientCustomField, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number }
): Promise<string> {
  const now = Date.now();
  const ref = field.id
    ? doc(db, `salons/${salonId}/clientCustomFields`, field.id)
    : doc(collection(db, `salons/${salonId}/clientCustomFields`));

  const payload: ClientCustomField = {
    id: ref.id,
    scope: field.scope,
    label: field.label.trim(),
    slug: field.slug.trim() || slugifyFieldName(field.label),
    type: field.type,
    order: Number(field.order) || 0,
    defaultValue: field.defaultValue ?? '',
    placeholder: field.placeholder ?? '',
    options: Array.isArray(field.options) ? field.options.filter(Boolean) : [],
    required: Boolean(field.required),
    isActive: field.isActive !== false,
    createdAt: field.createdAt || now,
    updatedAt: now,
  };

  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function deleteClientCustomField(salonId: string, fieldId: string): Promise<void> {
  await deleteDoc(doc(db, `salons/${salonId}/clientCustomFields`, fieldId));
}

export const BEAUTY_FORM_PRESETS: Record<
  ClientFormScope,
  Array<Omit<ClientCustomField, 'id' | 'createdAt' | 'updatedAt'>>
> = {
  anamnese: [
    {
      scope: 'anamnese',
      label: 'Alergia a produtos químicos ou cosméticos',
      slug: 'alergia_produtos_quimicos',
      type: 'boolean',
      order: 1,
      defaultValue: 'false',
      required: true,
      isActive: true,
    },
    {
      scope: 'anamnese',
      label: 'Quais alergias ou sensibilidades possui?',
      slug: 'detalhes_alergias',
      type: 'textarea',
      order: 2,
      defaultValue: '',
      placeholder: 'Ex: Amônia, látex, fragrâncias, metais...',
      required: false,
      isActive: true,
    },
    {
      scope: 'anamnese',
      label: 'Gestante ou lactante?',
      slug: 'gestante_lactante',
      type: 'boolean',
      order: 3,
      defaultValue: 'false',
      required: false,
      isActive: true,
    },
    {
      scope: 'anamnese',
      label: 'Histórico químico nos últimos 6 meses',
      slug: 'historico_quimico',
      type: 'select',
      order: 4,
      defaultValue: 'Nenhuma química recente',
      options: [
        'Nenhuma química recente',
        'Coloração / Tonalizante',
        'Descoloração / Mechas',
        'Progressiva / Alisamento',
        'Botox / Selagem',
      ],
      required: false,
      isActive: true,
    },
  ],
  prontuario: [
    {
      scope: 'prontuario',
      label: 'Fórmula / Coloração / Produto utilizado',
      slug: 'formula_utilizada',
      type: 'textarea',
      order: 1,
      defaultValue: '',
      placeholder: 'Ex: Raiz 7.1 (30g) + OX 20vol (45ml)',
      required: false,
      isActive: true,
    },
    {
      scope: 'prontuario',
      label: 'Tempo de pausa (minutos)',
      slug: 'tempo_pausa_min',
      type: 'number',
      order: 2,
      defaultValue: '30',
      required: false,
      isActive: true,
    },
    {
      scope: 'prontuario',
      label: 'Diagnóstico do fio / pele no atendimento',
      slug: 'diagnostico_atendimento',
      type: 'select',
      order: 3,
      defaultValue: 'Saudável',
      options: ['Saudável', 'Ressecado / Poroso', 'Elástico / Sensibilizado', 'Oleoso / Sensível'],
      required: false,
      isActive: true,
    },
    {
      scope: 'prontuario',
      label: 'Orientação Home Care / Próximo retorno',
      slug: 'orientacao_home_care',
      type: 'text',
      order: 4,
      defaultValue: '',
      placeholder: 'Ex: Cronograma reconstrução a cada 15 dias',
      required: false,
      isActive: true,
    },
  ],
};

export function subscribeClientNotices(
  salonId: string,
  onData: (notices: ClientNotice[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, `salons/${salonId}/clientNotices`));
  return onSnapshot(
    q,
    (snap) => {
      const list: ClientNotice[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ClientNotice);
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/clientNotices`);
      onError?.(err);
    }
  );
}

export async function saveClientNotice(
  salonId: string,
  notice: Omit<ClientNotice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number }
): Promise<string> {
  const now = Date.now();
  const ref = notice.id
    ? doc(db, `salons/${salonId}/clientNotices`, notice.id)
    : doc(collection(db, `salons/${salonId}/clientNotices`));

  const payload: ClientNotice = {
    id: ref.id,
    title: notice.title.trim(),
    message: notice.message.trim(),
    severity: notice.severity || 'warning',
    triggers: {
      onSchedule: Boolean(notice.triggers?.onSchedule),
      onComanda: Boolean(notice.triggers?.onComanda),
    },
    targetType: notice.targetType || 'clients',
    clientIds: Array.isArray(notice.clientIds) ? notice.clientIds : [],
    targetTags: Array.isArray(notice.targetTags)
      ? notice.targetTags.map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [],
    isActive: notice.isActive !== false,
    createdBy: notice.createdBy || '',
    createdByName: notice.createdByName || '',
    createdAt: notice.createdAt || now,
    updatedAt: now,
  };

  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function deleteClientNotice(salonId: string, noticeId: string): Promise<void> {
  await deleteDoc(doc(db, `salons/${salonId}/clientNotices`, noticeId));
}

export function filterActiveNoticesForClient(
  notices: ClientNotice[],
  client: Client | null | undefined,
  trigger: 'onSchedule' | 'onComanda' | 'all'
): ClientNotice[] {
  if (!client || client.id === 'consumidor-final') return [];
  const clientTagsLower = new Set((client.tags || []).map((t) => t.trim().toLowerCase()));

  return notices.filter((notice) => {
    if (!notice.isActive) return false;

    if (trigger === 'onSchedule' && !notice.triggers?.onSchedule) return false;
    if (trigger === 'onComanda' && !notice.triggers?.onComanda) return false;
    if (trigger === 'all' && !notice.triggers?.onSchedule && !notice.triggers?.onComanda) {
      return false;
    }

    if (notice.targetType === 'all') return true;
    if (notice.targetType === 'clients') {
      return Array.isArray(notice.clientIds) && notice.clientIds.includes(client.id);
    }
    if (notice.targetType === 'tags') {
      return (
        Array.isArray(notice.targetTags) &&
        notice.targetTags.some((tag) => clientTagsLower.has(tag.trim().toLowerCase()))
      );
    }
    return false;
  });
}

export async function mergeClientsApi(
  payload: MergeClientsPayload,
  clientsList: Client[]
): Promise<MergeClientsResult> {
  const token = await auth.currentUser?.getIdToken?.();
  if (token) {
    try {
      const resp = await fetch('/api/clients/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return data as MergeClientsResult;
      }
      if (resp.status !== 503 && data?.code !== 'ADMIN_UNAVAILABLE') {
        throw new Error(data?.error || 'Erro ao unificar cadastros.');
      }
    } catch (err: any) {
      // Only fall back on 503/network unavailability; propagate validation/permission errors
      if (err instanceof Error && !err.message.toLowerCase().includes('fetch')) {
        throw err;
      }
    }
  }

  // Client-side transactional batch fallback when Admin SDK is unavailable in local sandbox
  const { salonId, primaryClientId, secondaryClientId, resolvedFields } = payload;
  const primaryClient = clientsList.find((c) => c.id === primaryClientId);
  const secondaryClient = clientsList.find((c) => c.id === secondaryClientId);
  if (!primaryClient || !secondaryClient) {
    throw new Error('Cadastros não encontrados para unificação.');
  }

  const now = Date.now();
  const uid = auth.currentUser?.uid || '';
  const actorName = auth.currentUser?.displayName || auth.currentUser?.email || 'Gestor';
  const resolvedName = resolvedFields.name.trim();

  const mergedTags = Array.from(
    new Set([...(primaryClient.tags || []), ...(secondaryClient.tags || [])])
  );

  const [apptsSnap, comandasSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, `salons/${salonId}/appointments`),
        where('clientId', '==', secondaryClientId)
      )
    ),
    getDocs(
      query(
        collection(db, `salons/${salonId}/comandas`),
        where('clientId', '==', secondaryClientId)
      )
    ),
  ]);

  const batch = writeBatch(db);
  const primaryRef = doc(db, `salons/${salonId}/clients`, primaryClientId);
  const secondaryRef = doc(db, `salons/${salonId}/clients`, secondaryClientId);

  batch.set(
    primaryRef,
    {
      name: resolvedName,
      phone: resolvedFields.phone.trim(),
      secondaryPhone: resolvedFields.secondaryPhone?.trim() || '',
      email: resolvedFields.email?.trim() || '',
      gender: resolvedFields.gender?.trim() || '',
      birthDate: resolvedFields.birthDate?.trim() || '',
      cpf: resolvedFields.cpf?.trim() || '',
      rg: resolvedFields.rg?.trim() || '',
      notes: resolvedFields.notes?.trim() || '',
      address: resolvedFields.address || primaryClient.address || secondaryClient.address || {},
      tags: mergedTags,
      anamneseResponses: {
        ...(secondaryClient.anamneseResponses || {}),
        ...(primaryClient.anamneseResponses || {}),
      },
      prontuarioResponses: {
        ...(secondaryClient.prontuarioResponses || {}),
        ...(primaryClient.prontuarioResponses || {}),
      },
      lifetimeValue:
        Number(primaryClient.lifetimeValue || 0) + Number(secondaryClient.lifetimeValue || 0),
      totalSpent: Number(primaryClient.totalSpent || 0) + Number(secondaryClient.totalSpent || 0),
      totalAppointments:
        Number(primaryClient.totalAppointments || 0) +
        Number(secondaryClient.totalAppointments || 0),
      creditBalance:
        Number(primaryClient.creditBalance || 0) + Number(secondaryClient.creditBalance || 0),
      updatedAt: now,
      updatedBy: uid,
    },
    { merge: true }
  );

  apptsSnap.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      clientId: primaryClientId,
      clientName: resolvedName,
      updatedAt: now,
    });
  });

  comandasSnap.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      clientId: primaryClientId,
      clientName: resolvedName,
      updatedAt: now,
    });
  });

  const histRef = doc(collection(db, `salons/${salonId}/clients/${primaryClientId}/history`));
  batch.set(histRef, {
    id: histRef.id,
    type: 'data_updated',
    title: 'Cadastros Unificados',
    description: `Cadastro "${secondaryClient.name}" mesclado neste perfil (${apptsSnap.size} agendamento(s) e ${comandasSnap.size} comanda(s) preservados).`,
    createdBy: uid,
    createdByName: actorName,
    createdAt: now,
  });

  batch.update(secondaryRef, {
    deletedAt: now,
    archived: true,
    status: 'inactive',
    mergedIntoClientId: primaryClientId,
    updatedAt: now,
    updatedBy: uid,
  });

  await batch.commit();

  return {
    success: true,
    primaryClientId,
    secondaryClientId,
    migratedAppointments: apptsSnap.size,
    migratedComandas: comandasSnap.size,
  };
}

import { z } from 'zod';
import { workspaceFetch } from './googleWorkspaceService';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: 'system' | 'user';
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export interface RawGmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  sizeEstimate?: number;
  payload?: GmailMessagePart;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  internalDateMs: number;
  isUnread: boolean;
  isStarred: boolean;
  messageIdHeader: string;
  referencesHeader: string;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  cc: string;
  bodyText: string;
  bodyHtml: string;
}

export interface GmailDraftSummary {
  draftId: string;
  message: GmailMessageSummary;
}

export const gmailComposeSchema = z.object({
  to: z
    .string()
    .trim()
    .min(3, 'Informe pelo menos um destinatário.')
    .refine(
      (val) => {
        const parts = val
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        return parts.length > 0 && parts.every((addr) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr));
      },
      { message: 'Informe endereços de e-mail válidos (separados por vírgula se houver mais de um).' }
    ),
  cc: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const parts = val
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        return parts.every((addr) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr));
      },
      { message: 'Um ou mais e-mails em Cópia (Cc) são inválidos.' }
    ),
  subject: z.string().trim().min(1, 'Informe o assunto do e-mail.').max(250, 'Assunto muito longo.'),
  bodyText: z.string().trim().min(1, 'Escreva a mensagem antes de continuar.'),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
});

export type GmailComposeInput = z.infer<typeof gmailComposeSchema>;

function encodeBytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeUtf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeUtf8ToBase64Url(value: string): string {
  return encodeBytesToBase64Url(new TextEncoder().encode(value));
}

function decodeBase64UrlToUtf8(data?: string): string {
  if (!data) return '';
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function encodeRfc2047Subject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) {
    return subject.replace(/[\r\n]+/g, ' ').trim();
  }
  const clean = subject.replace(/[\r\n]+/g, ' ').trim();
  return `=?UTF-8?B?${encodeUtf8ToBase64(clean)}?=`;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function buildRawMimeMessage(input: GmailComposeInput): string {
  const validated = gmailComposeSchema.parse(input);
  const headers: string[] = [
    `To: ${sanitizeHeaderValue(validated.to)}`,
  ];

  if (validated.cc && validated.cc.trim()) {
    headers.push(`Cc: ${sanitizeHeaderValue(validated.cc)}`);
  }

  headers.push(`Subject: ${encodeRfc2047Subject(validated.subject)}`);

  if (validated.inReplyTo) {
    headers.push(`In-Reply-To: ${sanitizeHeaderValue(validated.inReplyTo)}`);
  }
  if (validated.references) {
    headers.push(`References: ${sanitizeHeaderValue(validated.references)}`);
  }

  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push('Content-Transfer-Encoding: base64');

  const encodedBody = encodeUtf8ToBase64(validated.bodyText);
  const rawMime = `${headers.join('\r\n')}\r\n\r\n${encodedBody}`;
  return encodeUtf8ToBase64Url(rawMime);
}

function getHeader(headers: GmailMessageHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const target = name.toLowerCase();
  const match = headers.find((h) => h.name?.toLowerCase() === target);
  return match?.value || '';
}

function decodeEntities(raw: string): string {
  return raw
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function mapSummary(raw: RawGmailMessage): GmailMessageSummary {
  const headers = raw.payload?.headers;
  const labelIds = raw.labelIds || [];
  const internalDateMs = raw.internalDate ? Number(raw.internalDate) : 0;

  return {
    id: raw.id,
    threadId: raw.threadId,
    labelIds,
    snippet: decodeEntities(raw.snippet || ''),
    from: getHeader(headers, 'From') || '(Remetente desconhecido)',
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject') || '(Sem assunto)',
    date: getHeader(headers, 'Date'),
    internalDateMs: Number.isFinite(internalDateMs) ? internalDateMs : 0,
    isUnread: labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    messageIdHeader: getHeader(headers, 'Message-ID') || getHeader(headers, 'Message-Id'),
    referencesHeader: getHeader(headers, 'References'),
  };
}

function extractBodyParts(part?: GmailMessagePart): { bodyText: string; bodyHtml: string } {
  if (!part) return { bodyText: '', bodyHtml: '' };

  let bodyText = '';
  let bodyHtml = '';

  const walk = (node: GmailMessagePart) => {
    const mime = (node.mimeType || '').toLowerCase();
    if (mime === 'text/plain' && node.body?.data && !bodyText) {
      bodyText = decodeBase64UrlToUtf8(node.body.data);
    } else if (mime === 'text/html' && node.body?.data && !bodyHtml) {
      bodyHtml = decodeBase64UrlToUtf8(node.body.data);
    }
    if (Array.isArray(node.parts)) {
      node.parts.forEach(walk);
    }
  };

  walk(part);
  return { bodyText, bodyHtml };
}

export async function getGmailProfile(): Promise<GmailProfile> {
  return workspaceFetch<GmailProfile>(`${GMAIL_API_BASE}/profile`);
}

export async function listGmailLabels(): Promise<GmailLabel[]> {
  const res = await workspaceFetch<{ labels?: GmailLabel[] }>(`${GMAIL_API_BASE}/labels`);
  return res.labels || [];
}

export async function listGmailMessages(params: {
  q?: string;
  labelIds?: string[];
  maxResults?: number;
  pageToken?: string;
}): Promise<{
  messages: GmailMessageSummary[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}> {
  const searchParams = new URLSearchParams();
  searchParams.set('maxResults', String(params.maxResults ?? 20));
  if (params.q && params.q.trim()) {
    searchParams.set('q', params.q.trim());
  }
  if (params.labelIds && params.labelIds.length > 0) {
    params.labelIds.forEach((lbl) => searchParams.append('labelIds', lbl));
  }
  if (params.pageToken) {
    searchParams.set('pageToken', params.pageToken);
  }

  const listData = await workspaceFetch<{
    messages?: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }>(`${GMAIL_API_BASE}/messages?${searchParams.toString()}`);

  const refs = listData.messages || [];
  if (refs.length === 0) {
    return {
      messages: [],
      nextPageToken: listData.nextPageToken,
      resultSizeEstimate: listData.resultSizeEstimate ?? 0,
    };
  }

  // Busca metadados em lotes paralelos limitados (pool de 10)
  const POOL_SIZE = 10;
  const summaries: GmailMessageSummary[] = [];

  for (let i = 0; i < refs.length; i += POOL_SIZE) {
    const slice = refs.slice(i, i + POOL_SIZE);
    const metaParams = new URLSearchParams({ format: 'metadata' });
    ['From', 'To', 'Subject', 'Date', 'Message-ID', 'References'].forEach((h) =>
      metaParams.append('metadataHeaders', h)
    );

    const results = await Promise.all(
      slice.map(async (item) => {
        try {
          const raw = await workspaceFetch<RawGmailMessage>(
            `${GMAIL_API_BASE}/messages/${encodeURIComponent(item.id)}?${metaParams.toString()}`
          );
          return mapSummary(raw);
        } catch {
          return null;
        }
      })
    );
    results.forEach((m) => {
      if (m) summaries.push(m);
    });
  }

  summaries.sort((a, b) => b.internalDateMs - a.internalDateMs);

  return {
    messages: summaries,
    nextPageToken: listData.nextPageToken,
    resultSizeEstimate: listData.resultSizeEstimate ?? summaries.length,
  };
}

export async function getGmailMessageDetail(messageId: string): Promise<GmailMessageDetail> {
  const raw = await workspaceFetch<RawGmailMessage>(
    `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}?format=full`
  );
  const summary = mapSummary(raw);
  const { bodyText, bodyHtml } = extractBodyParts(raw.payload);

  return {
    ...summary,
    cc: getHeader(raw.payload?.headers, 'Cc'),
    bodyText,
    bodyHtml,
  };
}

export async function sendGmailMessage(
  input: GmailComposeInput
): Promise<{ id: string; threadId: string }> {
  const raw = buildRawMimeMessage(input);
  const payload: { raw: string; threadId?: string } = { raw };
  if (input.threadId) {
    payload.threadId = input.threadId;
  }

  return workspaceFetch<{ id: string; threadId: string }>(`${GMAIL_API_BASE}/messages/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createGmailDraft(
  input: GmailComposeInput
): Promise<{ id: string; message: { id: string; threadId: string } }> {
  const raw = buildRawMimeMessage(input);
  const messagePayload: { raw: string; threadId?: string } = { raw };
  if (input.threadId) {
    messagePayload.threadId = input.threadId;
  }

  return workspaceFetch<{ id: string; message: { id: string; threadId: string } }>(
    `${GMAIL_API_BASE}/drafts`,
    {
      method: 'POST',
      body: JSON.stringify({ message: messagePayload }),
    }
  );
}

export async function listGmailDrafts(): Promise<GmailDraftSummary[]> {
  const listRes = await workspaceFetch<{
    drafts?: Array<{ id: string; message?: { id: string; threadId: string } }>;
  }>(`${GMAIL_API_BASE}/drafts?maxResults=20`);

  const drafts = listRes.drafts || [];
  if (drafts.length === 0) return [];

  const items = await Promise.all(
    drafts.map(async (d) => {
      try {
        const detail = await workspaceFetch<{ id: string; message: RawGmailMessage }>(
          `${GMAIL_API_BASE}/drafts/${encodeURIComponent(d.id)}?format=full`
        );
        return {
          draftId: detail.id,
          message: mapSummary(detail.message),
        };
      } catch {
        return null;
      }
    })
  );

  return items.filter((item): item is GmailDraftSummary => Boolean(item));
}

export async function sendGmailDraft(draftId: string): Promise<{ id: string; threadId: string }> {
  return workspaceFetch<{ id: string; threadId: string }>(`${GMAIL_API_BASE}/drafts/send`, {
    method: 'POST',
    body: JSON.stringify({ id: draftId }),
  });
}

export async function deleteGmailDraft(draftId: string): Promise<void> {
  await workspaceFetch(`${GMAIL_API_BASE}/drafts/${encodeURIComponent(draftId)}`, {
    method: 'DELETE',
  });
}

export async function modifyGmailMessageLabels(params: {
  messageId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}): Promise<void> {
  await workspaceFetch(
    `${GMAIL_API_BASE}/messages/${encodeURIComponent(params.messageId)}/modify`,
    {
      method: 'POST',
      body: JSON.stringify({
        addLabelIds: params.addLabelIds || [],
        removeLabelIds: params.removeLabelIds || [],
      }),
    }
  );
}

export async function trashGmailMessage(messageId: string): Promise<void> {
  await workspaceFetch(`${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}/trash`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

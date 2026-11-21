import { z } from 'zod';
import { workspaceFetch } from './googleWorkspaceService';
import type { Appointment } from '@/types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
}

export interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  organizer?: boolean;
  self?: boolean;
}

export interface GoogleCalendarEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  attendees?: GoogleCalendarAttendee[];
  creator?: {
    email?: string;
    displayName?: string;
  };
  updated?: string;
}

export interface FreeBusyPeriod {
  start: string;
  end: string;
}

export interface FreeBusyCalendarResult {
  busy: FreeBusyPeriod[];
  errors?: Array<{ domain?: string; reason?: string }>;
}

export type FreeBusyResultMap = Record<string, FreeBusyCalendarResult>;

export const calendarEventFormSchema = z.object({
  calendarId: z.string().trim().min(1, 'Selecione uma agenda.'),
  summary: z.string().trim().min(2, 'Informe o título do evento (mínimo 2 caracteres).').max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida (AAAA-MM-DD).'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Informe um horário válido (HH:MM).'),
  durationMinutes: z
    .number()
    .int()
    .min(5, 'Duração mínima de 5 minutos.')
    .max(720, 'Duração máxima de 12 horas (720 minutos).'),
  location: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).optional(),
  attendeesEmails: z
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
        return parts.length > 0 && parts.every((addr) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr));
      },
      { message: 'Informe e-mails válidos de convidados separados por vírgula.' }
    ),
});

export type CalendarEventFormInput = z.infer<typeof calendarEventFormSchema>;

export const createCalendarSchema = z.object({
  summary: z.string().trim().min(2, 'Informe o nome da nova agenda.').max(120),
  description: z.string().trim().max(500).optional(),
  timeZone: z.string().trim().min(2).optional(),
});

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

function formatOffsetIso(dateObj: Date): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offsetMinutes = -dateObj.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = pad(offsetMinutes / 60);
  const mins = pad(offsetMinutes % 60);

  const year = dateObj.getFullYear();
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  const hour = pad(dateObj.getHours());
  const minute = pad(dateObj.getMinutes());
  const second = pad(dateObj.getSeconds());

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${hours}:${mins}`;
}

export function buildIsoDateTimeRange(
  dateStr: string,
  startTimeStr: string,
  durationMinutes: number
): { startDateTime: string; endDateTime: string; timeZone: string } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const [hourStr, minStr] = startTimeStr.split(':');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minStr);

  const startDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  return {
    startDateTime: formatOffsetIso(startDate),
    endDateTime: formatOffsetIso(endDate),
    timeZone: getBrowserTimeZone(),
  };
}

export function parseEventToFormValues(
  calendarId: string,
  event: GoogleCalendarEvent
): CalendarEventFormInput {
  const startRaw = event.start.dateTime || event.start.date || '';
  const endRaw = event.end.dateTime || event.end.date || '';

  let date = new Date().toISOString().split('T')[0];
  let startTime = '09:00';
  let durationMinutes = 60;

  if (event.start.dateTime) {
    const startDt = new Date(startRaw);
    if (!Number.isNaN(startDt.getTime())) {
      const y = startDt.getFullYear();
      const m = String(startDt.getMonth() + 1).padStart(2, '0');
      const d = String(startDt.getDate()).padStart(2, '0');
      const hh = String(startDt.getHours()).padStart(2, '0');
      const mm = String(startDt.getMinutes()).padStart(2, '0');
      date = `${y}-${m}-${d}`;
      startTime = `${hh}:${mm}`;

      if (endRaw) {
        const endDt = new Date(endRaw);
        const diffMins = Math.round((endDt.getTime() - startDt.getTime()) / 60000);
        if (diffMins >= 5 && diffMins <= 720) {
          durationMinutes = diffMins;
        }
      }
    }
  } else if (event.start.date) {
    date = event.start.date;
  }

  const attendeesEmails = (event.attendees || [])
    .filter((a) => !a.self && a.email)
    .map((a) => a.email)
    .join(', ');

  return {
    calendarId,
    summary: event.summary || '',
    date,
    startTime,
    durationMinutes,
    location: event.location || '',
    description: event.description || '',
    attendeesEmails,
  };
}

export function buildEventDescriptionFromAppointment(
  app: Appointment,
  clientPhone?: string,
  clientEmail?: string
): string {
  const lines = [
    `Cliente: ${app.clientName}`,
    `Serviço: ${app.serviceName}`,
    `Profissional: ${app.professionalName}`,
  ];
  const phone = app.clientPhone || clientPhone;
  const email = app.clientEmail || clientEmail;
  if (phone) lines.push(`Telefone: ${phone}`);
  if (email) lines.push(`E-mail: ${email}`);
  if (app.price && app.price > 0) {
    lines.push(`Valor previsto: R$ ${app.price.toFixed(2).replace('.', ',')}`);
  }
  if (app.notes) {
    lines.push(`Observações: ${app.notes}`);
  }
  lines.push('', 'Agendamento sincronizado via LumièreOS.');
  return lines.join('\n');
}

export async function listCalendars(): Promise<GoogleCalendarListItem[]> {
  const params = new URLSearchParams({
    minAccessRole: 'reader',
    showHidden: 'false',
  });
  const data = await workspaceFetch<{ items?: GoogleCalendarListItem[] }>(
    `${CALENDAR_API_BASE}/users/me/calendarList?${params.toString()}`
  );
  const items = data.items || [];
  return items.sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return a.summary.localeCompare(b.summary, 'pt-BR');
  });
}

export async function createSecondaryCalendar(input: {
  summary: string;
  description?: string;
  timeZone?: string;
}): Promise<GoogleCalendarListItem> {
  const parsed = createCalendarSchema.parse(input);
  return workspaceFetch<GoogleCalendarListItem>(`${CALENDAR_API_BASE}/calendars`, {
    method: 'POST',
    body: JSON.stringify({
      summary: parsed.summary,
      description: parsed.description || 'Agenda integrada ao sistema LumièreOS.',
      timeZone: parsed.timeZone || getBrowserTimeZone(),
    }),
  });
}

export async function listCalendarEvents(params: {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  q?: string;
  maxResults?: number;
}): Promise<GoogleCalendarEvent[]> {
  const queryParams = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    maxResults: String(params.maxResults ?? 50),
  });
  if (params.q && params.q.trim()) {
    queryParams.set('q', params.q.trim());
  }

  const data = await workspaceFetch<{ items?: GoogleCalendarEvent[] }>(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(params.calendarId)}/events?${queryParams.toString()}`
  );
  return (data.items || []).filter((evt) => evt.status !== 'cancelled');
}

export async function queryFreeBusy(params: {
  timeMin: string;
  timeMax: string;
  calendarIds: string[];
}): Promise<FreeBusyResultMap> {
  if (params.calendarIds.length === 0) return {};
  const data = await workspaceFetch<{ calendars?: FreeBusyResultMap }>(
    `${CALENDAR_API_BASE}/freeBusy`,
    {
      method: 'POST',
      body: JSON.stringify({
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        timeZone: getBrowserTimeZone(),
        items: params.calendarIds.map((id) => ({ id })),
      }),
    }
  );
  return data.calendars || {};
}

function buildEventPayload(parsed: CalendarEventFormInput): Record<string, unknown> {
  const { startDateTime, endDateTime, timeZone } = buildIsoDateTimeRange(
    parsed.date,
    parsed.startTime,
    parsed.durationMinutes
  );

  const attendeesList = (parsed.attendeesEmails || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  const payload: Record<string, unknown> = {
    summary: parsed.summary,
    description: parsed.description || '',
    location: parsed.location || '',
    start: {
      dateTime: startDateTime,
      timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone,
    },
  };

  if (attendeesList.length > 0) {
    payload.attendees = attendeesList;
  }

  return payload;
}

export async function createCalendarEvent(
  input: CalendarEventFormInput
): Promise<GoogleCalendarEvent> {
  const parsed = calendarEventFormSchema.parse(input);
  const payload = buildEventPayload(parsed);
  const hasAttendees = Array.isArray(payload.attendees) && payload.attendees.length > 0;
  const query = hasAttendees ? '?sendUpdates=all' : '';

  return workspaceFetch<GoogleCalendarEvent>(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(parsed.calendarId)}/events${query}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventFormInput
): Promise<GoogleCalendarEvent> {
  const parsed = calendarEventFormSchema.parse(input);
  const payload = buildEventPayload(parsed);
  const hasAttendees = Array.isArray(payload.attendees) && payload.attendees.length > 0;
  const query = hasAttendees ? '?sendUpdates=all' : '';

  return workspaceFetch<GoogleCalendarEvent>(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(parsed.calendarId)}/events/${encodeURIComponent(eventId)}${query}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  await workspaceFetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
    }
  );
}

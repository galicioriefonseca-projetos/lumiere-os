import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GoogleWorkspaceAccount,
  WorkspaceAuthError,
  clearWorkspaceToken,
  connectGoogleWorkspace,
  subscribeWorkspaceAuth,
} from '@/services/googleWorkspaceService';
import {
  CalendarEventFormInput,
  FreeBusyPeriod,
  GoogleCalendarEvent,
  GoogleCalendarListItem,
  buildEventDescriptionFromAppointment,
  buildIsoDateTimeRange,
  calendarEventFormSchema,
  createCalendarEvent,
  createSecondaryCalendar,
  deleteCalendarEvent,
  listCalendarEvents,
  listCalendars,
  parseEventToFormValues,
  queryFreeBusy,
  updateCalendarEvent,
} from '@/services/calendarService';
import type { Appointment, Client } from '@/types';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  WorkspaceConfirmDetails,
  WorkspaceConfirmDialog,
} from './WorkspaceConfirmDialog';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

export interface CalendarPrefillEvent {
  summary: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  location?: string;
  description?: string;
  attendeesEmails?: string;
}

interface GoogleCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'events' | 'create' | 'sync';
  prefillEvent?: CalendarPrefillEvent | null;
  appointments?: Appointment[];
  clients?: Client[];
  salonName?: string;
}

type DateRangePreset = 'today' | '7d' | '30d';

interface PendingCalendarAction {
  confirmDetails: WorkspaceConfirmDetails;
  execute: () => Promise<void>;
}

function getDateWindow(preset: DateRangePreset): { timeMin: string; timeMax: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const days = preset === 'today' ? 1 : preset === '7d' ? 7 : 30;
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

function formatEventTimeRange(event: GoogleCalendarEvent): {
  dateLabel: string;
  timeLabel: string;
} {
  if (event.start.date) {
    const parsed = new Date(`${event.start.date}T12:00:00`);
    const dateLabel = Number.isNaN(parsed.getTime())
      ? event.start.date
      : parsed.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });
    return { dateLabel, timeLabel: 'Dia inteiro' };
  }

  const startDt = event.start.dateTime ? new Date(event.start.dateTime) : null;
  const endDt = event.end.dateTime ? new Date(event.end.dateTime) : null;

  if (!startDt || Number.isNaN(startDt.getTime())) {
    return { dateLabel: '-', timeLabel: '-' };
  }

  const dateLabel = startDt.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const startStr = startDt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endStr =
    endDt && !Number.isNaN(endDt.getTime())
      ? endDt.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

  return {
    dateLabel,
    timeLabel: endStr ? `${startStr} – ${endStr}` : startStr,
  };
}

export function GoogleCalendarDialog({
  open,
  onOpenChange,
  initialTab = 'events',
  prefillEvent = null,
  appointments = [],
  clients = [],
  salonName = '',
}: GoogleCalendarDialogProps) {
  const [activeTab, setActiveTab] = useState<'events' | 'create' | 'sync'>(initialTab);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<GoogleWorkspaceAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Calendars & Selection
  const [calendars, setCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('primary');
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);

  // Events list state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [dayBusyPeriods, setDayBusyPeriods] = useState<FreeBusyPeriod[]>([]);

  // Create / Edit event state
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CalendarEventFormInput>({
    calendarId: 'primary',
    summary: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    durationMinutes: 60,
    location: salonName || '',
    description: '',
    attendeesEmails: '',
  });
  const [selectedDateBusySlots, setSelectedDateBusySlots] = useState<FreeBusyPeriod[]>([]);
  const [isCheckingFreeBusy, setIsCheckingFreeBusy] = useState(false);

  // Secondary calendar creation inline box
  const [newCalendarName, setNewCalendarName] = useState('');
  const [showNewCalendarInput, setShowNewCalendarInput] = useState(false);

  // Sync Appointments state
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>([]);
  const [syncProgressLabel, setSyncProgressLabel] = useState<string | null>(null);

  // Confirmation dialog state (mandatory before EVERY mutating action)
  const [pendingAction, setPendingAction] = useState<PendingCalendarAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  useEffect(() => {
    const unsub = subscribeWorkspaceAuth((state) => {
      setIsConnected(state.isConnected);
      setAccount(state.account);
    });
    return () => unsub();
  }, []);

  const upcomingAppointments = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return appointments
      .filter((app) => (app.status === 'scheduled' || app.status === 'confirmed') && app.date >= today)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [appointments]);

  const clientEmailById = useMemo(() => {
    const map = new Map<string, { email?: string; phone?: string }>();
    clients.forEach((client) => {
      map.set(client.id, { email: client.email, phone: client.phone });
    });
    return map;
  }, [clients]);

  // Reset tab & prefill when modal opens
  useEffect(() => {
    if (!open) return;

    if (prefillEvent) {
      setActiveTab('create');
      setEditingEventId(null);
      setFormState({
        calendarId: selectedCalendarId || 'primary',
        summary: prefillEvent.summary,
        date: prefillEvent.date,
        startTime: prefillEvent.startTime,
        durationMinutes: prefillEvent.durationMinutes || 60,
        location: prefillEvent.location ?? salonName ?? '',
        description: prefillEvent.description || '',
        attendeesEmails: prefillEvent.attendeesEmails || '',
      });
    } else {
      setActiveTab(initialTab);
      if (initialTab === 'create' && !editingEventId) {
        setFormState((prev) => ({
          ...prev,
          calendarId: selectedCalendarId || 'primary',
          location: prev.location || salonName || '',
        }));
      }
    }
  }, [open, initialTab, prefillEvent, salonName, selectedCalendarId, editingEventId]);

  // Preselect upcoming appointments when switching to sync
  useEffect(() => {
    if (open && upcomingAppointments.length > 0) {
      setSelectedAppointmentIds(upcomingAppointments.map((a) => a.id));
    } else if (open) {
      setSelectedAppointmentIds([]);
    }
  }, [open, upcomingAppointments]);

  const handleWorkspaceError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof WorkspaceAuthError) {
      toast.error(err.message);
      return;
    }
    const msg = err instanceof Error ? err.message : fallback;
    toast.error(msg);
  }, []);

  const loadCalendarsList = useCallback(async () => {
    if (!isConnected) return;
    setIsLoadingCalendars(true);
    try {
      const list = await listCalendars();
      setCalendars(list);
      const hasCurrent = list.some((c) => c.id === selectedCalendarId);
      if (!hasCurrent) {
        const preferred = list.find((c) => c.primary) || list[0];
        if (preferred) {
          setSelectedCalendarId(preferred.id);
          setFormState((prev) => ({ ...prev, calendarId: preferred.id }));
        }
      }
    } catch (err) {
      handleWorkspaceError(err, 'Erro ao carregar agendas do Google.');
    } finally {
      setIsLoadingCalendars(false);
    }
  }, [isConnected, selectedCalendarId, handleWorkspaceError]);

  const loadEvents = useCallback(async () => {
    if (!isConnected || !selectedCalendarId) return;
    setIsLoadingEvents(true);
    try {
      const { timeMin, timeMax } = getDateWindow(dateRangePreset);
      const [fetchedEvents, freeBusy] = await Promise.all([
        listCalendarEvents({
          calendarId: selectedCalendarId,
          timeMin,
          timeMax,
          q: searchQuery,
          maxResults: 60,
        }),
        queryFreeBusy({
          timeMin,
          timeMax,
          calendarIds: [selectedCalendarId],
        }).catch(() => ({})),
      ]);
      setEvents(fetchedEvents);
      setDayBusyPeriods(freeBusy[selectedCalendarId]?.busy || []);
    } catch (err) {
      handleWorkspaceError(err, 'Erro ao buscar eventos no Google Agenda.');
    } finally {
      setIsLoadingEvents(false);
    }
  }, [isConnected, selectedCalendarId, dateRangePreset, searchQuery, handleWorkspaceError]);

  // Initial load on open + connect
  useEffect(() => {
    if (open && isConnected) {
      void loadCalendarsList();
    }
  }, [open, isConnected, loadCalendarsList]);

  useEffect(() => {
    if (open && isConnected && activeTab === 'events') {
      void loadEvents();
    }
  }, [open, isConnected, activeTab, selectedCalendarId, dateRangePreset, loadEvents]);

  // Live FreeBusy availability check for the date chosen in the create/edit form
  useEffect(() => {
    if (!open || !isConnected || activeTab !== 'create' || !formState.date || !formState.calendarId) {
      return;
    }
    let cancelled = false;
    const checkAvailability = async () => {
      setIsCheckingFreeBusy(true);
      try {
        const dayStart = new Date(`${formState.date}T00:00:00`);
        const dayEnd = new Date(`${formState.date}T23:59:59`);
        if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) return;

        const fb = await queryFreeBusy({
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          calendarIds: [formState.calendarId],
        });
        if (!cancelled) {
          setSelectedDateBusySlots(fb[formState.calendarId]?.busy || []);
        }
      } catch {
        if (!cancelled) setSelectedDateBusySlots([]);
      } finally {
        if (!cancelled) setIsCheckingFreeBusy(false);
      }
    };
    void checkAvailability();
    return () => {
      cancelled = true;
    };
  }, [open, isConnected, activeTab, formState.date, formState.calendarId]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectGoogleWorkspace();
      toast.success('Conta Google conectada ao Google Agenda!');
    } catch (err) {
      handleWorkspaceError(err, 'Não foi possível conectar ao Google Agenda.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearWorkspaceToken();
    setCalendars([]);
    setEvents([]);
    setDayBusyPeriods([]);
    toast.info('Sessão do Google Workspace desconectada.');
  };

  const selectedCalendarObj = useMemo(
    () => calendars.find((c) => c.id === selectedCalendarId) || null,
    [calendars, selectedCalendarId]
  );

  const selectedCalendarLabel =
    selectedCalendarObj?.summary || (selectedCalendarId === 'primary' ? 'Agenda Principal' : selectedCalendarId);

  const formConflictWarning = useMemo(() => {
    if (selectedDateBusySlots.length === 0 || !formState.date || !formState.startTime) return null;
    try {
      const { startDateTime, endDateTime } = buildIsoDateTimeRange(
        formState.date,
        formState.startTime,
        formState.durationMinutes
      );
      const startMs = new Date(startDateTime).getTime();
      const endMs = new Date(endDateTime).getTime();

      const conflicting = selectedDateBusySlots.some((period) => {
        const bStart = new Date(period.start).getTime();
        const bEnd = new Date(period.end).getTime();
        return startMs < bEnd && endMs > bStart;
      });
      return conflicting
        ? 'Já existe um compromisso ocupado neste horário na agenda selecionada.'
        : null;
    } catch {
      return null;
    }
  }, [selectedDateBusySlots, formState.date, formState.startTime, formState.durationMinutes]);

  const requestSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const targetInput: CalendarEventFormInput = {
      ...formState,
      calendarId: formState.calendarId || selectedCalendarId || 'primary',
    };
    const parsed = calendarEventFormSchema.safeParse(targetInput);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || 'Verifique os dados do evento.';
      toast.error(firstErr);
      return;
    }

    const calName =
      calendars.find((c) => c.id === parsed.data.calendarId)?.summary || selectedCalendarLabel;
    const isEditing = Boolean(editingEventId);

    setPendingAction({
      confirmDetails: {
        title: isEditing ? 'Confirmar Atualização no Google Agenda' : 'Confirmar Criação no Google Agenda',
        description: isEditing
          ? `Deseja atualizar o evento "${parsed.data.summary}" diretamente na agenda selecionada?`
          : `Deseja criar o evento "${parsed.data.summary}" na sua agenda do Google?`,
        targetLabel: 'Agenda Google:',
        targetName: calName,
        subTargetLabel: 'Data e horário:',
        sheetTabName: `${parsed.data.date.split('-').reverse().join('/')} às ${parsed.data.startTime} (${parsed.data.durationMinutes} min)`,
        affectedCountLabel: parsed.data.attendeesEmails
          ? `1 evento + envio de convite (${parsed.data.attendeesEmails})`
          : '1 evento',
        warningText: formConflictWarning || undefined,
        confirmLabel: isEditing ? 'Atualizar Evento' : 'Criar Evento',
      },
      execute: async () => {
        if (editingEventId) {
          await updateCalendarEvent(editingEventId, parsed.data);
          toast.success('Evento atualizado no Google Agenda!');
        } else {
          await createCalendarEvent(parsed.data);
          toast.success('Evento criado no Google Agenda!');
        }
        setEditingEventId(null);
        setFormState({
          calendarId: parsed.data.calendarId,
          summary: '',
          date: parsed.data.date,
          startTime: '09:00',
          durationMinutes: 60,
          location: salonName || '',
          description: '',
          attendeesEmails: '',
        });
        setActiveTab('events');
        await loadEvents();
      },
    });
  };

  const requestDeleteEvent = (event: GoogleCalendarEvent) => {
    const { dateLabel, timeLabel } = formatEventTimeRange(event);
    setPendingAction({
      confirmDetails: {
        title: 'Excluir Evento do Google Agenda',
        description: `Tem certeza que deseja remover "${event.summary || 'Evento sem título'}" do Google Agenda?`,
        targetLabel: 'Agenda Google:',
        targetName: selectedCalendarLabel,
        subTargetLabel: 'Horário do evento:',
        sheetTabName: `${dateLabel} · ${timeLabel}`,
        affectedCountLabel: '1 evento será removido permanentemente',
        warningText: 'Esta ação remove o compromisso diretamente da sua conta Google Calendar.',
        confirmLabel: 'Excluir Evento',
        destructive: true,
      },
      execute: async () => {
        await deleteCalendarEvent(selectedCalendarId, event.id);
        toast.success('Evento excluído do Google Agenda.');
        await loadEvents();
      },
    });
  };

  const requestCreateSecondaryCalendar = () => {
    const cleanName = newCalendarName.trim();
    if (cleanName.length < 2) {
      toast.error('Digite um nome válido para a nova agenda.');
      return;
    }

    setPendingAction({
      confirmDetails: {
        title: 'Criar Nova Agenda Secundária',
        description: 'Será criada uma agenda dedicada na sua conta Google Calendar.',
        targetLabel: 'Nome da Agenda:',
        targetName: cleanName,
        affectedCountLabel: '1 nova agenda Google',
        confirmLabel: 'Criar Agenda',
      },
      execute: async () => {
        const created = await createSecondaryCalendar({ summary: cleanName });
        toast.success(`Agenda "${created.summary}" criada com sucesso!`);
        setNewCalendarName('');
        setShowNewCalendarInput(false);
        await loadCalendarsList();
        setSelectedCalendarId(created.id);
        setFormState((prev) => ({ ...prev, calendarId: created.id }));
      },
    });
  };

  const requestSyncAppointments = () => {
    const chosen = upcomingAppointments.filter((a) => selectedAppointmentIds.includes(a.id));
    if (chosen.length === 0) {
      toast.error('Selecione pelo menos um agendamento para sincronizar.');
      return;
    }

    setPendingAction({
      confirmDetails: {
        title: 'Sincronizar Agendamentos com Google Agenda',
        description: `Os ${chosen.length} agendamento(s) selecionado(s) do LumièreOS serão criados como eventos na agenda escolhida.`,
        targetLabel: 'Agenda de destino:',
        targetName: selectedCalendarLabel,
        affectedCountLabel: `${chosen.length} agendamento(s) futuro(s)`,
        warningText:
          'Se o cliente possuir e-mail cadastrado, ele poderá receber o convite automático do Google Agenda.',
        confirmLabel: `Enviar ${chosen.length} Evento(s)`,
      },
      execute: async () => {
        const CHUNK_SIZE = 3;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < chosen.length; i += CHUNK_SIZE) {
          const chunk = chosen.slice(i, i + CHUNK_SIZE);
          setSyncProgressLabel(
            `Sincronizando ${Math.min(i + chunk.length, chosen.length)} de ${chosen.length}...`
          );

          const results = await Promise.allSettled(
            chunk.map((app) => {
              const clientInfo = clientEmailById.get(app.clientId);
              const attendeeEmail = app.clientEmail || clientInfo?.email || '';
              return createCalendarEvent({
                calendarId: selectedCalendarId,
                summary: `${app.serviceName} — ${app.clientName}`,
                date: app.date,
                startTime: app.time || '09:00',
                durationMinutes: app.serviceDuration && app.serviceDuration >= 5 ? app.serviceDuration : 60,
                location: salonName || '',
                description: buildEventDescriptionFromAppointment(
                  app,
                  clientInfo?.phone,
                  clientInfo?.email
                ),
                attendeesEmails: attendeeEmail,
              });
            })
          );

          results.forEach((r) => {
            if (r.status === 'fulfilled') successCount += 1;
            else failCount += 1;
          });
        }

        setSyncProgressLabel(null);
        if (successCount > 0) {
          toast.success(`${successCount} agendamento(s) enviado(s) ao Google Agenda!`);
        }
        if (failCount > 0) {
          toast.warning(`${failCount} agendamento(s) não puderam ser enviados.`);
        }
        setActiveTab('events');
        await loadEvents();
      },
    });
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    setIsExecutingAction(true);
    try {
      await pendingAction.execute();
      setPendingAction(null);
    } catch (err) {
      handleWorkspaceError(err, 'Falha ao executar operação no Google Agenda.');
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleStartEditEvent = (event: GoogleCalendarEvent) => {
    setEditingEventId(event.id);
    setFormState(parseEventToFormValues(selectedCalendarId, event));
    setActiveTab('create');
  };

  const toggleAppointmentSelection = (id: string) => {
    setSelectedAppointmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllAppointments = () => {
    if (selectedAppointmentIds.length === upcomingAppointments.length) {
      setSelectedAppointmentIds([]);
    } else {
      setSelectedAppointmentIds(upcomingAppointments.map((a) => a.id));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-y-auto bg-white border border-[#E5E2DC] text-[#171717] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-semibold text-lg text-[#171717] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F5F1E9] border border-[#D8C79F] flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-[#8A6D36]" />
                </div>
                <div>
                  <span>Google Agenda — Sincronização & Eventos</span>
                  {account?.email && isConnected && (
                    <p className="text-[11px] font-normal text-[#6B6B6B]">
                      Conectado como {account.email}
                    </p>
                  )}
                </div>
              </div>

              {isConnected && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="text-xs text-[#6B6B6B] hover:text-red-600 hover:bg-red-50 gap-1.5 mr-6"
                >
                  <LogOut className="w-3.5 h-3.5" /> Desconectar
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {!isConnected ? (
            <div className="py-10 px-4 flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F1E9] border border-[#D8C79F] flex items-center justify-center">
                <CalendarIcon className="w-7 h-7 text-[#8A6D36]" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-base font-semibold text-[#171717]">
                  Conecte seu Google Agenda ao LumièreOS
                </h3>
                <p className="text-xs text-[#6B6B6B] leading-relaxed">
                  Visualize seus compromissos em tempo real, verifique horários livres e envie
                  agendamentos do negócio diretamente para a sua agenda do Google com segurança.
                </p>
              </div>
              <GoogleSignInButton
                onClick={handleConnect}
                loading={isConnecting}
                label="Conectar com o Google Agenda"
              />
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {/* Seletor de Agenda + Criar Agenda Secundária */}
              <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label className="text-xs font-medium text-[#4A4A4A] shrink-0">
                      Agenda ativa:
                    </Label>
                    <Select
                      value={selectedCalendarId}
                      onValueChange={(val) => {
                        setSelectedCalendarId(val);
                        setFormState((prev) => ({ ...prev, calendarId: val }));
                      }}
                      disabled={isLoadingCalendars}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white border-[#E5E2DC] text-[#171717]">
                        <SelectValue placeholder="Selecione uma agenda" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                        {calendars.length === 0 ? (
                          <SelectItem value="primary">Agenda Principal</SelectItem>
                        ) : (
                          calendars.map((cal) => (
                            <SelectItem key={cal.id} value={cal.id}>
                              {cal.summary} {cal.primary ? '(Principal)' : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNewCalendarInput((v) => !v)}
                      className="h-8 text-xs border-[#E5E2DC] bg-white hover:bg-[#F5F1E9] text-[#171717] gap-1"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-[#8A6D36]" />
                      Nova Agenda
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void loadEvents()}
                      disabled={isLoadingEvents}
                      className="h-8 text-xs border-[#E5E2DC] bg-white hover:bg-[#F5F1E9] text-[#171717] gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                </div>

                {showNewCalendarInput && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-[#E5E2DC]">
                    <Input
                      value={newCalendarName}
                      onChange={(e) => setNewCalendarName(e.target.value)}
                      placeholder={`Ex: ${salonName ? `${salonName} — Atendimentos` : 'LumièreOS — Agenda'}`}
                      className="h-8 text-xs bg-white border-[#E5E2DC]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={requestCreateSecondaryCalendar}
                      className="h-8 text-xs bg-[#171717] hover:bg-[#2B2B2B] text-white shrink-0"
                    >
                      Criar Agenda
                    </Button>
                  </div>
                )}
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as 'events' | 'create' | 'sync')}
              >
                <TabsList className="grid w-full grid-cols-3 bg-[#FAF9F7] border border-[#E5E2DC] p-1 rounded-xl">
                  <TabsTrigger
                    value="events"
                    className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#171717] data-[state=active]:shadow-sm"
                  >
                    Eventos ({events.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="create"
                    className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#171717] data-[state=active]:shadow-sm"
                  >
                    {editingEventId ? 'Editar Evento' : 'Criar Evento'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="sync"
                    className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#171717] data-[state=active]:shadow-sm"
                  >
                    Sincronizar Salão ({upcomingAppointments.length})
                  </TabsTrigger>
                </TabsList>

                {/* ABA 1: EVENTOS */}
                <TabsContent value="events" className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void loadEvents();
                          }
                        }}
                        placeholder="Filtrar eventos por cliente, serviço ou palavra-chave..."
                        className="pl-8 h-9 text-xs bg-white border-[#E5E2DC]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(
                        [
                          { id: 'today', label: 'Hoje' },
                          { id: '7d', label: '7 dias' },
                          { id: '30d', label: '30 dias' },
                        ] as const
                      ).map((preset) => (
                        <Button
                          key={preset.id}
                          type="button"
                          size="sm"
                          variant={dateRangePreset === preset.id ? 'default' : 'outline'}
                          onClick={() => setDateRangePreset(preset.id)}
                          className={`h-8 text-xs ${
                            dateRangePreset === preset.id
                              ? 'bg-[#171717] text-white'
                              : 'border-[#E5E2DC] bg-white text-[#4A4A4A]'
                          }`}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {dayBusyPeriods.length > 0 && (
                    <div className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] px-3 py-2 text-[11px] text-[#6B6B6B] flex items-center justify-between">
                      <span>
                        <strong className="text-[#171717]">{dayBusyPeriods.length}</strong> bloco(s)
                        ocupado(s) no período via FreeBusy
                      </span>
                      <span className="text-[#8A6D36] font-medium">{selectedCalendarLabel}</span>
                    </div>
                  )}

                  {isLoadingEvents ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#6B6B6B]">
                      <Loader2 className="w-6 h-6 animate-spin text-[#8A6D36]" />
                      Carregando compromissos do Google Agenda...
                    </div>
                  ) : events.length === 0 ? (
                    <div className="py-10 text-center rounded-xl border border-dashed border-[#E5E2DC] bg-[#FAF9F7] space-y-2">
                      <CalendarIcon className="w-7 h-7 text-[#8A6D36] mx-auto" />
                      <p className="text-xs font-medium text-[#171717]">
                        Nenhum evento encontrado neste período.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setEditingEventId(null);
                          setActiveTab('create');
                        }}
                        className="h-8 text-xs bg-[#171717] hover:bg-[#2B2B2B] text-white"
                      >
                        Criar Novo Evento
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {events.map((evt) => {
                        const { dateLabel, timeLabel } = formatEventTimeRange(evt);
                        return (
                          <div
                            key={evt.id}
                            className="rounded-xl border border-[#E5E2DC] bg-white p-3.5 hover:border-[#D8C79F] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F5F1E9] text-[#8A6D36] border border-[#D8C79F]">
                                  {dateLabel}
                                </span>
                                <span className="text-xs font-mono text-[#4A4A4A] flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-[#8A6D36]" />
                                  {timeLabel}
                                </span>
                              </div>
                              <h4 className="text-sm font-semibold text-[#171717] truncate">
                                {evt.summary || 'Evento sem título'}
                              </h4>
                              <div className="flex items-center gap-3 flex-wrap text-[11px] text-[#6B6B6B]">
                                {evt.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {evt.location}
                                  </span>
                                )}
                                {evt.attendees && evt.attendees.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {evt.attendees.length} convidado(s)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {evt.htmlLink && (
                                <a
                                  href={evt.htmlLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] hover:bg-[#F5F1E9] text-[11px] font-medium text-[#171717]"
                                >
                                  <ExternalLink className="w-3 h-3" /> Abrir
                                </a>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartEditEvent(evt)}
                                className="h-8 text-[11px] border-[#E5E2DC] bg-white hover:bg-[#F5F1E9] text-[#171717] gap-1"
                              >
                                <Edit2 className="w-3 h-3" /> Editar
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => requestDeleteEvent(evt)}
                                className="h-8 w-8 text-[#6B6B6B] hover:text-red-600 hover:bg-red-50"
                                title="Excluir evento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* ABA 2: CRIAR / EDITAR EVENTO */}
                <TabsContent value="create" className="pt-2">
                  <form onSubmit={requestSaveEvent} className="space-y-3.5 text-xs">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-[#171717]">
                        Título do Evento
                      </Label>
                      <Input
                        required
                        value={formState.summary}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, summary: e.target.value }))
                        }
                        placeholder="Ex: Corte & Escova — Maria Clara"
                        className="bg-white border-[#E5E2DC]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-[#171717]">Data</Label>
                        <Input
                          required
                          type="date"
                          value={formState.date}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, date: e.target.value }))
                          }
                          className="bg-white border-[#E5E2DC]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-[#171717]">Início</Label>
                        <Input
                          required
                          type="time"
                          value={formState.startTime}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, startTime: e.target.value }))
                          }
                          className="bg-white border-[#E5E2DC]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-[#171717]">
                          Duração (min)
                        </Label>
                        <Input
                          required
                          type="number"
                          min={5}
                          max={720}
                          step={5}
                          value={formState.durationMinutes}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              durationMinutes: Number(e.target.value) || 60,
                            }))
                          }
                          className="bg-white border-[#E5E2DC]"
                        />
                      </div>
                    </div>

                    {isCheckingFreeBusy ? (
                      <div className="text-[11px] text-[#6B6B6B] flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Verificando disponibilidade na agenda...
                      </div>
                    ) : formConflictWarning ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{formConflictWarning}</span>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>
                          Horário livre nesta agenda ({selectedDateBusySlots.length} compromisso(s)
                          no dia).
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-[#171717]">
                          Local (opcional)
                        </Label>
                        <Input
                          value={formState.location || ''}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, location: e.target.value }))
                          }
                          placeholder="Endereço do salão ou link da chamada"
                          className="bg-white border-[#E5E2DC]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-[#171717]">
                          Convidados por e-mail (opcional)
                        </Label>
                        <Input
                          value={formState.attendeesEmails || ''}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, attendeesEmails: e.target.value }))
                          }
                          placeholder="cliente@email.com, equipe@email.com"
                          className="bg-white border-[#E5E2DC]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-[#171717]">
                        Descrição / Observações
                      </Label>
                      <Textarea
                        rows={4}
                        value={formState.description || ''}
                        onChange={(e) =>
                          setFormState((p) => ({ ...p, description: e.target.value }))
                        }
                        placeholder="Detalhes do atendimento, profissional responsável ou lembretes..."
                        className="bg-white border-[#E5E2DC] text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      {editingEventId && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingEventId(null);
                            setFormState({
                              calendarId: selectedCalendarId || 'primary',
                              summary: '',
                              date: new Date().toISOString().split('T')[0],
                              startTime: '09:00',
                              durationMinutes: 60,
                              location: salonName || '',
                              description: '',
                              attendeesEmails: '',
                            });
                          }}
                          className="border-[#E5E2DC] text-[#4A4A4A]"
                        >
                          Cancelar Edição
                        </Button>
                      )}
                      <Button
                        type="submit"
                        className="bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                        {editingEventId ? 'Revisar e Atualizar' : 'Revisar e Criar Evento'}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                {/* ABA 3: SINCRONIZAR AGENDAMENTOS DO SALÃO */}
                <TabsContent value="sync" className="space-y-3 pt-2">
                  {upcomingAppointments.length === 0 ? (
                    <div className="py-10 text-center rounded-xl border border-dashed border-[#E5E2DC] bg-[#FAF9F7] space-y-1.5">
                      <CalendarIcon className="w-7 h-7 text-[#8A6D36] mx-auto" />
                      <p className="text-xs font-medium text-[#171717]">
                        Nenhum agendamento futuro pendente no LumièreOS.
                      </p>
                      <p className="text-[11px] text-[#6B6B6B]">
                        Crie agendamentos futuros na aba Agenda para enviá-los em lote para o Google
                        Agenda.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] px-3.5 py-2.5 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-[#171717]">
                          <input
                            type="checkbox"
                            checked={
                              upcomingAppointments.length > 0 &&
                              selectedAppointmentIds.length === upcomingAppointments.length
                            }
                            onChange={toggleSelectAllAppointments}
                            className="rounded border-[#D8C79F] text-[#171717]"
                          />
                          Selecionar todos ({upcomingAppointments.length})
                        </label>
                        <span className="text-[11px] text-[#6B6B6B]">
                          {selectedAppointmentIds.length} selecionado(s)
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {upcomingAppointments.map((app) => {
                          const isChecked = selectedAppointmentIds.includes(app.id);
                          const clientInfo = clientEmailById.get(app.clientId);
                          const email = app.clientEmail || clientInfo?.email;

                          return (
                            <label
                              key={app.id}
                              className={`flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                                isChecked
                                  ? 'border-[#D8C79F] bg-[#FAF9F7]'
                                  : 'border-[#E5E2DC] bg-white hover:bg-[#FAF9F7]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleAppointmentSelection(app.id)}
                                  className="rounded border-[#D8C79F]"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[#171717] truncate">
                                    {app.serviceName} — {app.clientName}
                                  </p>
                                  <p className="text-[11px] text-[#6B6B6B] truncate">
                                    {app.date.split('-').reverse().join('/')} às {app.time} · com{' '}
                                    {app.professionalName}
                                    {email ? ` · ${email}` : ''}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E5E2DC] text-[#8A6D36] shrink-0">
                                {app.status === 'confirmed' ? 'Confirmado' : 'Agendado'}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-[#6B6B6B]">
                          {syncProgressLabel ||
                            `Destino: ${selectedCalendarLabel}`}
                        </span>
                        <Button
                          type="button"
                          onClick={requestSyncAppointments}
                          disabled={selectedAppointmentIds.length === 0 || Boolean(syncProgressLabel)}
                          className="bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold gap-1.5 text-xs"
                        >
                          <CalendarPlus className="w-3.5 h-3.5 text-[#D4AF37]" />
                          Sincronizar Selecionados ({selectedAppointmentIds.length})
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <WorkspaceConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isExecutingAction) {
            setPendingAction(null);
          }
        }}
        details={pendingAction?.confirmDetails || null}
        loading={isExecutingAction}
        onConfirm={handleConfirmPendingAction}
      />
    </>
  );
}

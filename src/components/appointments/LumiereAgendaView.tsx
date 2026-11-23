import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Lock,
  MessageCircle,
  Calendar as CalendarIcon,
  CalendarPlus,
  Clock,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  UserCheck,
  Play,
  ExternalLink,
  Copy,
  SlidersHorizontal,
  Loader2,
  User,
  Phone,
  Sparkles,
  Receipt,
  DoorOpen,
} from 'lucide-react';
import {
  Appointment,
  AppointmentStatus,
  Client,
  ClientNotice,
  Professional,
  ProfessionalGoal,
  Salon,
  Service,
} from '@/types';
import { ClientActiveNoticesBanner } from '@/components/clients/ClientActiveNoticesBanner';
import {
  APPOINTMENT_STATUS_META,
  getAppointmentStatusMeta,
  minutesToTime,
  sendWhatsAppConfirmation,
  SendWhatsAppConfirmationResponse,
  timeToMinutes,
} from '@/services/appointmentsService';
import {
  getCalendarWeekRange,
  resolveAppointmentPrice,
} from '@/lib/goals';
import { WeeklyGoalForecastPanel } from './WeeklyGoalForecastPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn, formatBRL } from '@/lib/utils';
import { toast } from 'sonner';

type AgendaMode = 'day' | 'week' | 'month';

interface LumiereAgendaViewProps {
  salonData: Salon;
  appointments: Appointment[];
  clients: Client[];
  professionals: Professional[];
  services: Service[];
  goals: ProfessionalGoal[];
  notices?: ClientNotice[];
  userRole: string;
  currentUserId?: string;
  canManageGoals?: boolean;
  canEditAppointments: boolean;
  onQuickCreate: (prefill: {
    date: string;
    time?: string;
    professionalId?: string;
    isBlock?: boolean;
  }) => void;
  onEditAppointment: (app: Appointment) => void;
  onChangeStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  onDeleteAppointment: (app: Appointment) => Promise<void>;
  onOpenGoogleCalendar: (mode: 'events' | 'sync' | 'create', app?: Appointment) => void;
  onOpenWhatsAppSettings?: () => void;
  openComandasCount?: number;
  onOpenComandasList?: () => void;
  onOpenComandaFromAppointment?: (app: Appointment) => void;
}

const WEEKDAY_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const WEEKDAY_MON_FIRST = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return toYmd(d);
}

function addMonthsYmd(ymd: string, deltaMonths: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setMonth(d.getMonth() + deltaMonths);
  return toYmd(d);
}

function formatDatePtBR(ymd: string): string {
  const parts = ymd.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ymd;
}

const STATUS_ORDER: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'waiting',
  'in_service',
  'completed',
  'blocked',
  'canceled',
  'no_show',
];

const PIXELS_PER_HOUR = 76; // 38px por cada 30 min -> leitura nítida sem poluição

export const LumiereAgendaView: React.FC<LumiereAgendaViewProps> = ({
  salonData,
  appointments,
  clients,
  professionals,
  services,
  goals,
  notices = [],
  userRole,
  currentUserId,
  canManageGoals = true,
  canEditAppointments,
  onQuickCreate,
  onEditAppointment,
  onChangeStatus,
  onDeleteAppointment,
  onOpenGoogleCalendar,
  onOpenWhatsAppSettings,
  openComandasCount = 0,
  onOpenComandasList,
  onOpenComandaFromAppointment,
}) => {
  const todayStr = useMemo(() => toYmd(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [miniCalMonth, setMiniCalMonth] = useState<string>(todayStr.substring(0, 7));
  const [viewMode, setViewMode] = useState<AgendaMode>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [proSearchQuery, setProSearchQuery] = useState('');
  const [selectedProIds, setSelectedProIds] = useState<string[]>([]);
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<AppointmentStatus>>(
    () => new Set(['canceled'])
  );
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const [showForecastPanel, setShowForecastPanel] = useState(true);

  // Detalhes & WhatsApp Dispatch state
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [sendingWaId, setSendingWaId] = useState<string | null>(null);
  const [waDispatchResult, setWaDispatchResult] = useState<{
    appointment: Appointment;
    response: SendWhatsAppConfirmationResponse;
  } | null>(null);

  const activeAppointment = useMemo(
    () => (activeAppId ? appointments.find((a) => a.id === activeAppId) || null : null),
    [activeAppId, appointments]
  );

  // Scope professionals if user is a professional (only shows themselves if matched, else all)
  const availableProfessionals = useMemo(() => {
    if (userRole === 'professional' && currentUserId) {
      const own = professionals.filter(
        (p) =>
          p.id === currentUserId ||
          (p as unknown as { userId?: string }).userId === currentUserId ||
          (p as unknown as { professionalId?: string }).professionalId === currentUserId
      );
      if (own.length > 0) return own;
    }
    return professionals;
  }, [professionals, userRole, currentUserId]);

  const filteredProfessionals = useMemo(() => {
    const q = proSearchQuery.trim().toLowerCase();
    if (!q) return availableProfessionals;
    return availableProfessionals.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.specialty || p.primaryFunction || '').toLowerCase().includes(q)
    );
  }, [availableProfessionals, proSearchQuery]);

  const visibleProfessionals = useMemo(() => {
    if (selectedProIds.length === 0) return availableProfessionals;
    const set = new Set(selectedProIds);
    const list = availableProfessionals.filter((p) => set.has(p.id));
    return list.length > 0 ? list : availableProfessionals;
  }, [availableProfessionals, selectedProIds]);

  const visibleProIdSet = useMemo(
    () => new Set(visibleProfessionals.map((p) => p.id)),
    [visibleProfessionals]
  );

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appointments.filter((app) => {
      if (availableProfessionals.length > 0 && !visibleProIdSet.has(app.professionalId)) {
        return false;
      }
      const effectiveStatus: AppointmentStatus = app.isBlock ? 'blocked' : app.status;
      if (hiddenStatuses.has(effectiveStatus)) {
        return false;
      }
      if (!q) return true;
      return (
        String(app.clientName || '').toLowerCase().includes(q) ||
        String(app.serviceName || '').toLowerCase().includes(q) ||
        String(app.professionalName || '').toLowerCase().includes(q) ||
        String(app.clientPhone || '').toLowerCase().includes(q)
      );
    });
  }, [appointments, availableProfessionals.length, visibleProIdSet, hiddenStatuses, searchQuery]);

  // Mini Calendar Matrix
  const miniCalDays = useMemo(() => {
    const [yStr, mStr] = miniCalMonth.split('-');
    const year = parseInt(yStr, 10) || new Date().getFullYear();
    const monthIdx = (parseInt(mStr, 10) || new Date().getMonth() + 1) - 1;
    const firstDay = new Date(year, monthIdx, 1);
    const startOffset = firstDay.getDay();
    const gridStart = new Date(year, monthIdx, 1 - startOffset);

    const cells: Array<{ ymd: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({
        ymd: toYmd(d),
        day: d.getDate(),
        inMonth: d.getMonth() === monthIdx,
      });
    }
    return { year, monthIdx, cells };
  }, [miniCalMonth]);

  const appointmentCountByDay = useMemo(() => {
    const map = new Map<string, { total: number; confirmed: number; revenue: number }>();
    for (const app of filteredAppointments) {
      if (app.isBlock || app.status === 'blocked' || app.status === 'canceled') continue;
      const ymd = String(app.date || '').substring(0, 10);
      if (!ymd) continue;
      const cur = map.get(ymd) || { total: 0, confirmed: 0, revenue: 0 };
      cur.total += 1;
      if (app.status === 'confirmed' || app.status === 'completed') {
        cur.confirmed += 1;
      }
      cur.revenue += resolveAppointmentPrice(app, services);
      map.set(ymd, cur);
    }
    return map;
  }, [filteredAppointments, services]);

  const weekRange = useMemo(() => getCalendarWeekRange(selectedDate), [selectedDate]);

  // Working Hours Timeline Bounds
  const { startHour, endHour } = useMemo(() => {
    let minM = 8 * 60;
    let maxM = 20 * 60;
    const wh = salonData?.workingHours;
    if (wh) {
      const dayKey = String(new Date(`${selectedDate}T12:00:00`).getDay());
      const dayCfg = wh[dayKey];
      if (dayCfg && dayCfg.isOpen) {
        minM = Math.min(minM, timeToMinutes(dayCfg.start));
        maxM = Math.max(maxM, timeToMinutes(dayCfg.end));
      }
    }
    for (const app of filteredAppointments) {
      if (app.date !== selectedDate) continue;
      const mStart = timeToMinutes(app.time);
      const dur = Number(app.serviceDuration) || 45;
      minM = Math.min(minM, mStart);
      maxM = Math.max(maxM, mStart + dur);
    }
    return {
      startHour: Math.max(6, Math.floor(minM / 60)),
      endHour: Math.min(23, Math.ceil(maxM / 60)),
    };
  }, [salonData?.workingHours, selectedDate, filteredAppointments]);

  const hourTicks = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      arr.push(h);
    }
    return arr;
  }, [startHour, endHour]);

  const currentTimeMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const navigatePeriod = (direction: -1 | 1) => {
    let next = selectedDate;
    if (viewMode === 'day') next = addDaysYmd(selectedDate, direction);
    else if (viewMode === 'week') next = addDaysYmd(selectedDate, direction * 7);
    else next = addMonthsYmd(selectedDate, direction);
    setSelectedDate(next);
    setMiniCalMonth(next.substring(0, 7));
  };

  const jumpToToday = () => {
    setSelectedDate(todayStr);
    setMiniCalMonth(todayStr.substring(0, 7));
  };

  const toggleProfessional = (id: string) => {
    setSelectedProIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleStatusFilter = (status: AppointmentStatus) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const handleRequestWhatsAppConfirmation = async (app: Appointment) => {
    if (!salonData?.id) return;
    try {
      setSendingWaId(app.id);
      const res = await sendWhatsAppConfirmation(salonData.id, app.id);
      if (res.sentViaCloudApi) {
        toast.success(
          'Confirmação enviada via WhatsApp API! Assim que o cliente responder, a agenda ficará verde automaticamente.'
        );
      } else {
        setWaDispatchResult({ appointment: app, response: res });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar confirmação WhatsApp.');
    } finally {
      setSendingWaId(null);
    }
  };

  const periodHeaderTitle = useMemo(() => {
    const dt = new Date(`${selectedDate}T12:00:00`);
    if (viewMode === 'day') {
      return dt.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }
    if (viewMode === 'week') {
      return `Semana de ${weekRange.label} • ${dt.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })}`;
    }
    return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedDate, viewMode, weekRange.label]);

  const monthGridCells = useMemo(() => {
    const activeMonth = selectedDate.substring(0, 7);
    const [yStr, mStr] = activeMonth.split('-');
    const year = parseInt(yStr, 10) || new Date().getFullYear();
    const monthIdx = (parseInt(mStr, 10) || new Date().getMonth() + 1) - 1;
    const first = new Date(year, monthIdx, 1);
    const offset = first.getDay();
    const start = new Date(year, monthIdx, 1 - offset);
    const rows: Array<{ ymd: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      rows.push({
        ymd: toYmd(d),
        day: d.getDate(),
        inMonth: d.getMonth() === monthIdx,
      });
    }
    return rows;
  }, [selectedDate]);

  const monthStats = useMemo(() => {
    const mPrefix = selectedDate.substring(0, 7);
    let total = 0;
    let confirmed = 0;
    let peakDay = '';
    let peakCount = 0;
    let totalRevenue = 0;

    appointmentCountByDay.forEach((stats, ymd) => {
      if (!ymd.startsWith(mPrefix)) return;
      total += stats.total;
      confirmed += stats.confirmed;
      totalRevenue += stats.revenue;
      if (stats.total > peakCount) {
        peakCount = stats.total;
        peakDay = ymd;
      }
    });

    return { total, confirmed, peakDay, peakCount, totalRevenue };
  }, [appointmentCountByDay, selectedDate]);

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Date Navigation + Title */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => navigatePeriod(-1)}
                className="p-2 rounded-lg text-[#171717] hover:bg-white transition-colors cursor-pointer"
                aria-label="Período anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={jumpToToday}
                className="px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => navigatePeriod(1)}
                className="p-2 rounded-lg text-[#171717] hover:bg-white transition-colors cursor-pointer"
                aria-label="Próximo período"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-sm sm:text-base font-heading font-semibold text-[#171717] capitalize px-1">
              {periodHeaderTitle}
            </h3>

            <button
              type="button"
              onClick={() => setShowSidebarMobile((v) => !v)}
              className="lg:hidden inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] text-[#171717]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8A6D36]" />
              Filtros
            </button>
          </div>

          {/* Search + View Mode Switch + Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente ou serviço..."
                className="pl-8 h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl"
              />
            </div>

            <div className="inline-flex bg-[#FAF9F7] p-1 rounded-xl border border-[#E5E2DC]">
              {(['day', 'week', 'month'] as AgendaMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    viewMode === mode
                      ? 'bg-[#171717] text-white shadow-xs'
                      : 'text-[#6B6B6B] hover:text-[#171717]'
                  )}
                >
                  {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowForecastPanel((v) => !v)}
              className={cn(
                'h-9 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer',
                showForecastPanel
                  ? 'bg-[#FAF9F7] border-[#B89B5E] text-[#8A6D36]'
                  : 'bg-white border-[#E5E2DC] text-[#6B6B6B]'
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Metas & Previsão
            </button>

            {onOpenComandasList && (
              <Button
                type="button"
                variant="outline"
                onClick={onOpenComandasList}
                className="h-9 px-3 rounded-xl border-[#B89B5E]/50 bg-[#FAF9F7] text-[#171717] hover:bg-[#EFECE4] text-xs font-semibold gap-1.5 whitespace-nowrap shrink-0"
              >
                <Receipt className="w-3.5 h-3.5 text-[#8A6D36]" />
                <span>Comandas Abertas</span>
                <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-[#171717] text-white text-[10px] font-bold tabular-nums">
                  {openComandasCount}
                </span>
              </Button>
            )}

            {onOpenWhatsAppSettings && (
              <Button
                type="button"
                variant="outline"
                onClick={onOpenWhatsAppSettings}
                className="h-9 px-3 rounded-xl border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold gap-1.5 whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp API
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenGoogleCalendar('sync')}
              className="h-9 px-3 rounded-xl border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#FAF9F7] text-xs font-semibold gap-1.5 whitespace-nowrap shrink-0"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-[#8A6D36]" />
              Google Agenda
            </Button>

            {canEditAppointments && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onQuickCreate({
                      date: selectedDate,
                      professionalId:
                        selectedProIds.length === 1 ? selectedProIds[0] : undefined,
                      isBlock: true,
                    })
                  }
                  className="h-9 px-3 rounded-xl border-[#E5E2DC] bg-[#FAF9F7] text-[#171717] hover:bg-[#EAE7E0] text-xs font-semibold gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-[#6B6B6B]" />
                  Bloquear Horário
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    onQuickCreate({
                      date: selectedDate,
                      professionalId:
                        selectedProIds.length === 1 ? selectedProIds[0] : undefined,
                      isBlock: false,
                    })
                  }
                  className="h-9 px-3.5 rounded-xl bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs font-semibold gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Novo Agendamento
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Interactive Status Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E2DC]">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_ORDER.map((stKey) => {
              const meta = APPOINTMENT_STATUS_META[stKey];
              const isHidden = hiddenStatuses.has(stKey);
              return (
                <button
                  key={stKey}
                  type="button"
                  onClick={() => toggleStatusFilter(stKey)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer',
                    isHidden
                      ? 'bg-[#FAF9F7] border-[#E5E2DC] text-[#9A958E] line-through opacity-70'
                      : 'bg-white border-[#E5E2DC] text-[#171717] hover:bg-[#FAF9F7]'
                  )}
                  title={isHidden ? 'Clique para mostrar' : 'Clique para ocultar'}
                >
                  <span className={cn('w-2 h-2 rounded-full', meta.dotColor)} />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-[#6B6B6B] hidden sm:inline">
            Confirmado pelo cliente no WhatsApp muda para <strong className="text-emerald-700">verde</strong> automaticamente.
          </span>
        </div>
      </div>

      {/* Weekly & Monthly Goal Predictability Panel */}
      {showForecastPanel && (
        <WeeklyGoalForecastPanel
          appointments={appointments}
          services={services}
          professionals={availableProfessionals}
          goals={goals}
          selectedDate={selectedDate}
          selectedProfessionalIds={visibleProfessionals.map((p) => p.id)}
          currentUserRole={userRole}
          canViewGoals={canManageGoals}
          onSelectAppointment={(app) => setActiveAppId(app.id)}
          onRequestWhatsAppConfirmation={handleRequestWhatsAppConfirmation}
        />
      )}

      {/* Main Split Workspace: Left Sidebar + Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
        {/* Left Rail */}
        <aside
          className={cn(
            'space-y-4',
            showSidebarMobile ? 'block' : 'hidden lg:block'
          )}
        >
          {/* Mini Calendar */}
          <div className="bg-white border border-[#E5E2DC] rounded-2xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMiniCalMonth(addMonthsYmd(`${miniCalMonth}-15`, -1).substring(0, 7))}
                className="p-1 rounded-lg hover:bg-[#FAF9F7] text-[#171717] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-[#171717] capitalize">
                {new Date(miniCalDays.year, miniCalDays.monthIdx, 1).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                type="button"
                onClick={() => setMiniCalMonth(addMonthsYmd(`${miniCalMonth}-15`, 1).substring(0, 7))}
                className="p-1 rounded-lg hover:bg-[#FAF9F7] text-[#171717] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_SHORT.map((d) => (
                <span key={d} className="text-[10px] font-semibold text-[#6B6B6B] py-1">
                  {d[0]}
                </span>
              ))}
              {miniCalDays.cells.map((cell) => {
                const isSelected = cell.ymd === selectedDate;
                const isToday = cell.ymd === todayStr;
                const hasData = (appointmentCountByDay.get(cell.ymd)?.total || 0) > 0;
                return (
                  <button
                    key={cell.ymd}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cell.ymd);
                      setMiniCalMonth(cell.ymd.substring(0, 7));
                    }}
                    className={cn(
                      'relative h-7 rounded-lg text-[11px] font-medium tabular-nums transition-colors cursor-pointer flex items-center justify-center',
                      isSelected
                        ? 'bg-[#171717] text-white font-semibold'
                        : isToday
                          ? 'bg-[#FAF9F7] border border-[#B89B5E] text-[#8A6D36] font-semibold'
                          : cell.inMonth
                            ? 'text-[#171717] hover:bg-[#FAF9F7]'
                            : 'text-[#B5B0A6] hover:bg-[#FAF9F7]'
                    )}
                  >
                    {cell.day}
                    {hasData && !isSelected && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#B89B5E]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Professionals Filter */}
          <div className="bg-white border border-[#E5E2DC] rounded-2xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717]">
                Profissionais ({visibleProfessionals.length}/{availableProfessionals.length})
              </span>
              {selectedProIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedProIds([])}
                  className="text-[11px] font-semibold text-[#8A6D36] hover:underline cursor-pointer"
                >
                  Mostrar todos
                </button>
              )}
            </div>

            {availableProfessionals.length > 4 && (
              <div className="relative">
                <Search className="w-3 h-3 text-[#6B6B6B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={proSearchQuery}
                  onChange={(e) => setProSearchQuery(e.target.value)}
                  placeholder="Filtrar profissional..."
                  className="pl-7 h-8 text-xs bg-[#FAF9F7] border-[#E5E2DC] rounded-lg"
                />
              </div>
            )}

            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {filteredProfessionals.map((prof) => {
                const isSelected =
                  selectedProIds.length === 0 || selectedProIds.includes(prof.id);
                const dayCount = filteredAppointments.filter(
                  (a) =>
                    a.professionalId === prof.id &&
                    a.date === selectedDate &&
                    !a.isBlock &&
                    a.status !== 'canceled'
                ).length;

                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => toggleProfessional(prof.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer border',
                      selectedProIds.includes(prof.id)
                        ? 'bg-[#FAF9F7] border-[#B89B5E] text-[#171717]'
                        : isSelected
                          ? 'bg-white border-transparent hover:bg-[#FAF9F7] text-[#171717]'
                          : 'bg-white border-transparent text-[#9A958E] opacity-70 hover:opacity-100'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                          isSelected
                            ? 'bg-[#171717] text-[#D4AF37]'
                            : 'bg-[#EAE7E0] text-[#6B6B6B]'
                        )}
                      >
                        {prof.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{prof.name}</p>
                        {(prof.primaryFunction || prof.specialty) && (
                          <p className="text-[10px] text-[#6B6B6B] truncate">
                            {prof.primaryFunction || prof.specialty}
                          </p>
                        )}
                      </div>
                    </div>
                    {dayCount > 0 && (
                      <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-[#FAF9F7] border border-[#E5E2DC] text-[#171717]">
                        {dayCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Calendar Canvas */}
        <section className="bg-white border border-[#E5E2DC] rounded-2xl shadow-xs overflow-hidden min-w-0">
          {/* ================= VIEW 1: DIA (TIMELINE POR PROFISSIONAL) ================= */}
          {viewMode === 'day' && (
            <div className="overflow-x-auto">
              {visibleProfessionals.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#6B6B6B]">
                  Cadastre profissionais na aba Equipe para visualizar as colunas da agenda.
                </div>
              ) : (
                <div
                  className="min-w-[640px]"
                  style={{
                    width:
                      visibleProfessionals.length > 4
                        ? `${64 + visibleProfessionals.length * 195}px`
                        : '100%',
                  }}
                >
                  {/* Column Headers */}
                  <div
                    className="grid border-b border-[#E5E2DC] bg-[#FAF9F7] sticky top-0 z-10"
                    style={{
                      gridTemplateColumns: `64px repeat(${visibleProfessionals.length}, minmax(180px, 1fr))`,
                    }}
                  >
                    <div className="p-2.5 border-r border-[#E5E2DC] flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                      Hora
                    </div>
                    {visibleProfessionals.map((prof) => {
                      const dayAppts = filteredAppointments.filter(
                        (a) =>
                          a.date === selectedDate &&
                          a.professionalId === prof.id &&
                          !a.isBlock &&
                          a.status !== 'canceled'
                      );
                      const dayRev = dayAppts.reduce(
                        (s, a) => s + resolveAppointmentPrice(a, services),
                        0
                      );
                      return (
                        <div
                          key={prof.id}
                          className="p-2.5 border-r last:border-r-0 border-[#E5E2DC] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[#171717] text-[#D4AF37] text-xs font-bold flex items-center justify-center shrink-0">
                              {prof.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#171717] truncate">
                                {prof.name}
                              </p>
                              <p className="text-[10px] text-[#6B6B6B] truncate">
                                {dayAppts.length} atend. • {formatBRL(dayRev)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Timeline Grid Body */}
                  <div
                    className="relative grid"
                    style={{
                      gridTemplateColumns: `64px repeat(${visibleProfessionals.length}, minmax(180px, 1fr))`,
                      height: `${(endHour - startHour + 1) * PIXELS_PER_HOUR}px`,
                    }}
                  >
                    {/* Current Time Indicator */}
                    {selectedDate === todayStr &&
                      currentTimeMinutes >= startHour * 60 &&
                      currentTimeMinutes <= (endHour + 1) * 60 && (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                          style={{
                            top: `${((currentTimeMinutes - startHour * 60) / 60) * PIXELS_PER_HOUR}px`,
                          }}
                        >
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold tabular-nums shadow-xs">
                            {minutesToTime(currentTimeMinutes)}
                          </span>
                          <div className="flex-1 h-[1.5px] bg-rose-500" />
                        </div>
                      )}

                    {/* Left Time Axis */}
                    <div className="border-r border-[#E5E2DC] bg-[#FAF9F7]/60 relative">
                      {hourTicks.map((hour, idx) => (
                        <div
                          key={hour}
                          className="border-b border-[#E5E2DC] relative text-[11px] font-medium text-[#6B6B6B] tabular-nums pr-2 text-right pt-1"
                          style={{ height: `${PIXELS_PER_HOUR}px`, top: 0 }}
                        >
                          {String(hour).padStart(2, '0')}:00
                          {idx < hourTicks.length && (
                            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-[#E5E2DC]/70" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Professional Columns */}
                    {visibleProfessionals.map((prof) => {
                      const colAppts = filteredAppointments
                        .filter((a) => a.date === selectedDate && a.professionalId === prof.id)
                        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

                      return (
                        <div
                          key={prof.id}
                          className="relative border-r last:border-r-0 border-[#E5E2DC] bg-white"
                        >
                          {/* Clickable 30-min Slots */}
                          {hourTicks.map((hour) => (
                            <React.Fragment key={hour}>
                              <div
                                onClick={() => {
                                  if (!canEditAppointments) return;
                                  onQuickCreate({
                                    date: selectedDate,
                                    time: `${String(hour).padStart(2, '0')}:00`,
                                    professionalId: prof.id,
                                  });
                                }}
                                className={cn(
                                  'border-b border-dashed border-[#E5E2DC]/70 transition-colors',
                                  canEditAppointments && 'hover:bg-[#FAF9F7] cursor-pointer'
                                )}
                                style={{ height: `${PIXELS_PER_HOUR / 2}px` }}
                                title={
                                  canEditAppointments
                                    ? `Agendar com ${prof.name} às ${String(hour).padStart(2, '0')}:00`
                                    : undefined
                                }
                              />
                              <div
                                onClick={() => {
                                  if (!canEditAppointments) return;
                                  onQuickCreate({
                                    date: selectedDate,
                                    time: `${String(hour).padStart(2, '0')}:30`,
                                    professionalId: prof.id,
                                  });
                                }}
                                className={cn(
                                  'border-b border-[#E5E2DC] transition-colors',
                                  canEditAppointments && 'hover:bg-[#FAF9F7] cursor-pointer'
                                )}
                                style={{ height: `${PIXELS_PER_HOUR / 2}px` }}
                                title={
                                  canEditAppointments
                                    ? `Agendar com ${prof.name} às ${String(hour).padStart(2, '0')}:30`
                                    : undefined
                                }
                              />
                            </React.Fragment>
                          ))}

                          {/* Appointment Blocks */}
                          {colAppts.map((app, index) => {
                            const startMin = timeToMinutes(app.time);
                            const durMin = Math.max(25, Number(app.serviceDuration) || 45);
                            const topPx =
                              ((startMin - startHour * 60) / 60) * PIXELS_PER_HOUR + 2;
                            const heightPx = Math.max(
                              32,
                              (durMin / 60) * PIXELS_PER_HOUR - 4
                            );
                            const meta = getAppointmentStatusMeta(app);
                            const priceVal = resolveAppointmentPrice(app, services);

                            // Detect simple overlap with previous block for readability
                            const prev = index > 0 ? colAppts[index - 1] : null;
                            const overlapsPrev =
                              prev &&
                              startMin <
                                timeToMinutes(prev.time) +
                                  Math.max(25, Number(prev.serviceDuration) || 45);

                            return (
                              <button
                                key={app.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveAppId(app.id);
                                }}
                                style={{
                                  top: `${Math.max(2, topPx)}px`,
                                  height: `${heightPx}px`,
                                  borderLeftWidth: '4px',
                                  borderLeftColor: meta.accentHex,
                                }}
                                className={cn(
                                  'absolute z-10 rounded-xl border px-2.5 py-1.5 text-left shadow-xs transition-all hover:shadow-md hover:z-20 overflow-hidden cursor-pointer flex flex-col justify-between',
                                  overlapsPrev ? 'left-4 right-1.5' : 'left-1.5 right-1.5',
                                  meta.cardBg,
                                  meta.cardBorder,
                                  meta.cardText
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-bold tabular-nums">
                                      {app.time}
                                      {durMin ? ` – ${minutesToTime(startMin + durMin)}` : ''}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {app.confirmationStatus === 'awaiting_client' &&
                                        app.status === 'scheduled' && (
                                          <span
                                            className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                                            title="Aguardando confirmação do cliente no WhatsApp"
                                          />
                                        )}
                                      {app.status === 'confirmed' && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs font-semibold truncate leading-tight mt-0.5">
                                    {app.isBlock || app.status === 'blocked'
                                      ? `Bloqueio: ${app.notes || 'Horário indisponível'}`
                                      : app.clientName}
                                  </p>
                                  {heightPx >= 52 && !app.isBlock && (
                                    <p className="text-[11px] opacity-85 truncate">
                                      {app.serviceName}
                                    </p>
                                  )}
                                </div>

                                {heightPx >= 72 && !app.isBlock && priceVal > 0 && (
                                  <div className="flex items-center justify-between text-[10px] font-semibold opacity-90 pt-0.5">
                                    <span>{meta.shortLabel}</span>
                                    <span className="tabular-nums">{formatBRL(priceVal)}</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= VIEW 2: SEMANA (7 DIAS) ================= */}
          {viewMode === 'week' && (
            <div className="overflow-x-auto">
              <div className="min-w-[780px] grid grid-cols-7 divide-x divide-[#E5E2DC]">
                {weekRange.days.map((dayYmd, idx) => {
                  const isToday = dayYmd === todayStr;
                  const isSelected = dayYmd === selectedDate;
                  const dayApps = filteredAppointments
                    .filter((a) => a.date === dayYmd)
                    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
                  const dayRevenue = dayApps.reduce(
                    (s, a) => s + resolveAppointmentPrice(a, services),
                    0
                  );

                  return (
                    <div key={dayYmd} className="min-h-[540px] flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(dayYmd);
                          setViewMode('day');
                        }}
                        className={cn(
                          'p-3 border-b border-[#E5E2DC] text-left transition-colors cursor-pointer',
                          isToday
                            ? 'bg-[#FAF9F7] border-b-2 border-b-[#B89B5E]'
                            : isSelected
                              ? 'bg-[#FAF9F7]'
                              : 'bg-white hover:bg-[#FAF9F7]'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                            {WEEKDAY_MON_FIRST[idx]}
                          </span>
                          <span
                            className={cn(
                              'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center tabular-nums',
                              isToday ? 'bg-[#171717] text-white' : 'text-[#171717]'
                            )}
                          >
                            {dayYmd.slice(8, 10)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#6B6B6B] tabular-nums">
                          <span>{dayApps.filter((a) => !a.isBlock).length} atend.</span>
                          <span className="font-semibold text-[#8A6D36]">
                            {formatBRL(dayRevenue)}
                          </span>
                        </div>
                      </button>

                      <div className="p-2 space-y-2 flex-1 bg-[#FAF9F7]/40">
                        {dayApps.length === 0 ? (
                          <div className="h-24 flex flex-col items-center justify-center text-center text-[11px] text-[#9A958E]">
                            <span>Livre</span>
                            {canEditAppointments && (
                              <button
                                type="button"
                                onClick={() => onQuickCreate({ date: dayYmd })}
                                className="mt-1 text-[10px] font-semibold text-[#8A6D36] hover:underline cursor-pointer"
                              >
                                + Agendar
                              </button>
                            )}
                          </div>
                        ) : (
                          dayApps.map((app) => {
                            const meta = getAppointmentStatusMeta(app);
                            const priceVal = resolveAppointmentPrice(app, services);
                            return (
                              <div
                                key={app.id}
                                onClick={() => setActiveAppId(app.id)}
                                style={{
                                  borderLeftWidth: '4px',
                                  borderLeftColor: meta.accentHex,
                                }}
                                className={cn(
                                  'rounded-xl border p-2 cursor-pointer transition-all hover:shadow-sm space-y-1',
                                  meta.cardBg,
                                  meta.cardBorder,
                                  meta.cardText
                                )}
                              >
                                <div className="flex items-center justify-between gap-1 text-[10px] font-bold tabular-nums">
                                  <span>{app.time}</span>
                                  {app.status === 'confirmed' ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  ) : app.confirmationStatus === 'awaiting_client' &&
                                    app.status === 'scheduled' ? (
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  ) : null}
                                </div>
                                <p className="text-[11px] font-semibold truncate leading-tight">
                                  {app.isBlock ? `Bloqueio: ${app.notes || 'Horário'}` : app.clientName}
                                </p>
                                {!app.isBlock && (
                                  <>
                                    <p className="text-[10px] opacity-85 truncate">
                                      {app.serviceName}
                                    </p>
                                    <div className="flex items-center justify-between text-[10px] opacity-90 pt-0.5">
                                      <span className="truncate max-w-[70px]">
                                        {app.professionalName.split(' ')[0]}
                                      </span>
                                      <span className="font-semibold tabular-nums">
                                        {formatBRL(priceVal)}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= VIEW 3: MÊS (OCUPAÇÃO E RECEITA PREVISTA) ================= */}
          {viewMode === 'month' && (
            <div className="p-4 space-y-4">
              {/* Monthly Stats Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3">
                  <span className="text-[11px] text-[#6B6B6B] block">Agendamentos no mês</span>
                  <span className="text-lg font-bold text-[#171717] tabular-nums">
                    {monthStats.total}
                  </span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                  <span className="text-[11px] text-emerald-900 block">Confirmados / Concluídos</span>
                  <span className="text-lg font-bold text-emerald-800 tabular-nums">
                    {monthStats.confirmed}
                  </span>
                </div>
                <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3">
                  <span className="text-[11px] text-[#6B6B6B] block">Previsão do mês</span>
                  <span className="text-lg font-bold text-[#8A6D36] tabular-nums">
                    {formatBRL(monthStats.totalRevenue)}
                  </span>
                </div>
                <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3">
                  <span className="text-[11px] text-[#6B6B6B] block">Dia de maior movimento</span>
                  <span className="text-sm font-bold text-[#171717] tabular-nums">
                    {monthStats.peakDay
                      ? `${monthStats.peakDay.slice(8, 10)}/${monthStats.peakDay.slice(5, 7)} (${monthStats.peakCount})`
                      : '-'}
                  </span>
                </div>
              </div>

              <div className="border border-[#E5E2DC] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-7 bg-[#FAF9F7] border-b border-[#E5E2DC]">
                  {WEEKDAY_SHORT.map((dayName) => (
                    <div
                      key={dayName}
                      className="py-2 text-center text-[11px] font-semibold text-[#6B6B6B]"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 divide-x divide-y divide-[#E5E2DC]">
                  {monthGridCells.map((cell) => {
                    const stats = appointmentCountByDay.get(cell.ymd);
                    const count = stats?.total || 0;
                    const isToday = cell.ymd === todayStr;

                    const heatBg =
                      !cell.inMonth
                        ? 'bg-[#FAF9F7]/50 text-[#B5B0A6]'
                        : count >= 12
                          ? 'bg-[#EFE2BF]/75'
                          : count >= 6
                            ? 'bg-[#F5ECD4]/75'
                            : count >= 1
                              ? 'bg-[#FAF6EA]'
                              : 'bg-white';

                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        onClick={() => {
                          setSelectedDate(cell.ymd);
                          setMiniCalMonth(cell.ymd.substring(0, 7));
                          setViewMode('day');
                        }}
                        className={cn(
                          'min-h-[60px] sm:min-h-[96px] p-1 sm:p-2 text-left flex flex-col justify-between transition-colors hover:bg-[#FAF9F7] cursor-pointer overflow-hidden',
                          heatBg
                        )}
                      >
                        <div className="flex items-center justify-between w-full gap-0.5">
                          <span
                            className={cn(
                              'w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[11px] sm:text-xs font-semibold flex items-center justify-center tabular-nums shrink-0',
                              isToday
                                ? 'bg-[#171717] text-white'
                                : cell.inMonth
                                  ? 'text-[#171717]'
                                  : 'text-[#B5B0A6]'
                            )}
                          >
                            {cell.day}
                          </span>
                          {stats && stats.confirmed > 0 && (
                            <span className="hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 tabular-nums">
                              {stats.confirmed} conf.
                            </span>
                          )}
                        </div>

                        {count > 0 ? (
                          <>
                            <span className="sm:hidden inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-[#171717] text-white text-[10px] font-bold tabular-nums self-start mt-1">
                              {count}
                            </span>
                            <div className="hidden sm:block space-y-0.5 pt-2">
                              <p className="text-xs font-bold text-[#171717] tabular-nums">
                                {count} {count === 1 ? 'reserva' : 'reservas'}
                              </p>
                              <p className="text-[10px] font-semibold text-[#8A6D36] tabular-nums">
                                {formatBRL(stats?.revenue || 0)}
                              </p>
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-[#B5B0A6]">—</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ================= DETAIL MODAL DO AGENDAMENTO / BLOQUEIO ================= */}
      <Dialog open={Boolean(activeAppointment)} onOpenChange={(open) => !open && setActiveAppId(null)}>
        <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          {activeAppointment && (
            <>
              {(() => {
                const meta = getAppointmentStatusMeta(activeAppointment);
                const priceVal = resolveAppointmentPrice(activeAppointment, services);
                const matchedClient = clients.find((c) => c.id === activeAppointment.clientId);
                const phoneDisplay = activeAppointment.clientPhone || matchedClient?.phone || '';

                return (
                  <>
                    <DialogHeader>
                      <div className="flex items-center justify-between gap-2 pr-6">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border',
                            meta.badgeBg,
                            meta.badgeText,
                            meta.badgeBorder
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-full', meta.dotColor)} />
                          {meta.label}
                        </span>
                        {priceVal > 0 && (
                          <span className="text-sm font-bold text-[#8A6D36] tabular-nums">
                            {formatBRL(priceVal)}
                          </span>
                        )}
                      </div>
                      <DialogTitle className="font-heading text-lg text-[#171717] pt-2">
                        {activeAppointment.isBlock || activeAppointment.status === 'blocked'
                          ? 'Bloqueio de Horário'
                          : activeAppointment.clientName}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#6B6B6B]">
                        {formatDatePtBR(activeAppointment.date)} às {activeAppointment.time} •{' '}
                        {activeAppointment.serviceDuration || 45} min
                      </DialogDescription>
                    </DialogHeader>

                      <div className="space-y-4 pt-2 text-xs">
                      {!activeAppointment.isBlock && (
                        <ClientActiveNoticesBanner
                          notices={notices}
                          client={matchedClient}
                          trigger="onSchedule"
                          theme="light"
                        />
                      )}
                      <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[#6B6B6B] inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" /> Profissional
                          </span>
                          <span className="font-semibold text-[#171717]">
                            {activeAppointment.professionalName}
                          </span>
                        </div>
                        {!activeAppointment.isBlock && (
                          <div className="flex items-center justify-between">
                            <span className="text-[#6B6B6B] inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" /> Serviço
                            </span>
                            <span className="font-semibold text-[#171717]">
                              {activeAppointment.serviceName}
                            </span>
                          </div>
                        )}
                        {phoneDisplay && (
                          <div className="flex items-center justify-between">
                            <span className="text-[#6B6B6B] inline-flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5" /> Telefone
                            </span>
                            <span className="font-semibold text-[#171717] tabular-nums">
                              {phoneDisplay}
                            </span>
                          </div>
                        )}
                        {activeAppointment.resourceName && (
                          <div className="flex items-center justify-between">
                            <span className="text-[#6B6B6B] inline-flex items-center gap-1.5">
                              <DoorOpen className="w-3.5 h-3.5" /> Sala / Equipamento
                            </span>
                            <span className="font-semibold text-[#171717]">
                              {activeAppointment.resourceName}
                            </span>
                          </div>
                        )}
                        {activeAppointment.notes && (
                          <div className="pt-2 border-t border-[#E5E2DC] text-[#6B6B6B]">
                            {activeAppointment.notes}
                          </div>
                        )}
                      </div>

                      {/* WhatsApp Confirmation Banner & 1-Click Trigger */}
                      {!activeAppointment.isBlock &&
                        activeAppointment.status !== 'completed' &&
                        activeAppointment.status !== 'canceled' && (
                          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold text-emerald-950">
                                  Confirmação pelo WhatsApp
                                </p>
                                <p className="text-[11px] text-emerald-800">
                                  {activeAppointment.status === 'confirmed'
                                    ? 'Cliente já confirmado! O horário está garantido em verde na agenda.'
                                    : activeAppointment.confirmationStatus === 'awaiting_client'
                                      ? 'Link enviado. Aguardando o cliente tocar em confirmar.'
                                      : 'Envie a mensagem para que o cliente confirme e o horário fique verde automaticamente.'}
                                </p>
                              </div>
                            </div>

                            <Button
                              type="button"
                              disabled={sendingWaId === activeAppointment.id}
                              onClick={() => handleRequestWhatsAppConfirmation(activeAppointment)}
                              className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-2"
                            >
                              {sendingWaId === activeAppointment.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MessageCircle className="w-4 h-4" />
                              )}
                              {activeAppointment.whatsappSentAt
                                ? 'Reenviar Confirmação no WhatsApp'
                                : 'Solicitar Confirmação via WhatsApp'}
                            </Button>
                          </div>
                        )}

                      {/* Status Lifecycle Transitions */}
                      {!activeAppointment.isBlock && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] block">
                            Atualizar Status do Atendimento
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            {activeAppointment.status !== 'confirmed' && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => onChangeStatus(activeAppointment.id, 'confirmed')}
                                className="h-9 rounded-xl border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
                              </Button>
                            )}
                            {activeAppointment.status !== 'waiting' && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => onChangeStatus(activeAppointment.id, 'waiting')}
                                className="h-9 rounded-xl border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 text-xs font-semibold gap-1.5"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Na Recepção
                              </Button>
                            )}
                            {activeAppointment.status !== 'in_service' && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => onChangeStatus(activeAppointment.id, 'in_service')}
                                className="h-9 rounded-xl border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 text-xs font-semibold gap-1.5"
                              >
                                <Play className="w-3.5 h-3.5" /> Em Atendimento
                              </Button>
                            )}
                            {activeAppointment.status !== 'completed' && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => onChangeStatus(activeAppointment.id, 'completed')}
                                className="h-9 rounded-xl border-[#9CC3B0] bg-[#EEF5F1] text-[#133A29] hover:bg-[#DCEEE4] text-xs font-semibold gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                              </Button>
                            )}
                            {activeAppointment.status !== 'canceled' && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => onChangeStatus(activeAppointment.id, 'canceled')}
                                className="h-9 rounded-xl border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-semibold gap-1.5"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Cancelar
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Footer Edit / Google Calendar / Delete */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5E2DC]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!activeAppointment.isBlock && onOpenComandaFromAppointment && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const target = activeAppointment;
                                setActiveAppId(null);
                                onOpenComandaFromAppointment(target);
                              }}
                              className="h-8 text-xs bg-[#171717] hover:bg-[#2c2c2c] text-white gap-1 whitespace-nowrap"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#D4AF37]" />
                              Abrir Comanda
                            </Button>
                          )}
                          {!activeAppointment.isBlock && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveAppId(null);
                                onOpenGoogleCalendar('create', activeAppointment);
                              }}
                              className="h-8 text-xs border-[#E5E2DC] gap-1 whitespace-nowrap"
                            >
                              <CalendarIcon className="w-3.5 h-3.5 text-[#8A6D36]" />
                              Google Agenda
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {canEditAppointments && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const target = activeAppointment;
                                  setActiveAppId(null);
                                  onEditAppointment(target);
                                }}
                                className="h-8 text-xs border-[#E5E2DC] gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Editar
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const target = activeAppointment;
                                  setActiveAppId(null);
                                  await onDeleteAppointment(target);
                                }}
                                className="h-8 text-xs border-rose-200 text-rose-700 hover:bg-rose-50 gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Excluir
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= DISPATCH WHATSAPP LINK MODAL (FALLBACK 1-CLIQUE) ================= */}
      <Dialog
        open={Boolean(waDispatchResult)}
        onOpenChange={(open) => !open && setWaDispatchResult(null)}
      >
        <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg text-[#171717] flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
              Enviar Confirmação para {waDispatchResult?.appointment.clientName}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              {waDispatchResult?.response.cloudApiError
                ? `A API oficial retornou: "${waDispatchResult.response.cloudApiError}". Envie manualmente pelo botão abaixo.`
                : 'A mensagem já inclui o link exclusivo. Quando o cliente confirmar, a cor da agenda mudará para verde automaticamente.'}
            </DialogDescription>
          </DialogHeader>

          {waDispatchResult && (
            <div className="space-y-4 pt-2 text-xs">
              {!waDispatchResult.response.phoneFound && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-[11px]">
                  Telefone não cadastrado neste agendamento. Você pode copiar a mensagem ou escolher o contato direto no WhatsApp.
                </div>
              )}

              <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3 whitespace-pre-wrap text-[11px] text-[#171717] leading-relaxed max-h-48 overflow-y-auto">
                {waDispatchResult.response.messageText}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={waDispatchResult.response.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWaDispatchResult(null)}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center justify-center gap-2 px-4 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir WhatsApp Agora
                </a>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(waDispatchResult.response.confirmUrl)
                      .then(() => toast.success('Link de confirmação copiado!'))
                      .catch(() => toast.error('Não foi possível copiar.'));
                  }}
                  className="h-10 rounded-xl border-[#E5E2DC] text-xs font-semibold gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Briefcase,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  Globe,
  ListTodo,
  Loader2,
  MessageSquareText,
  Package,
  Scissors,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { cn, formatBRL } from '@/lib/utils';
import { useLexicon } from '../../hooks/useLexicon';
import ProfessionalDashboard from './ProfessionalDashboard';
import { useLumi } from '../../lumi/hooks/useLumi';
import { useSalonPerformanceRanking } from '../../hooks/useSalonPerformanceRanking';
import { LumiInsightsList } from '../../components/lumi/LumiInsightsList';
import { LumiRecommendationsList } from '../../components/lumi/LumiRecommendationsList';
import { LumiAlertsList } from '../../components/lumi/LumiAlertsList';
import { BusinessPulse } from '../../components/lumi/BusinessPulse';
import { LumiTimeline, type TimelineEvent } from '../../components/lumi/LumiTimeline';
import { LumiDailySummary } from '../../components/lumi/LumiDailySummary';
import { LumiereIAInsights } from '../../components/dashboard/LumiereIAInsights';
import { LumiSystemReadinessAlert } from '../../components/lumi/LumiSystemReadinessAlert';
import { SubscriptionBanner } from '@/components/dashboard/SubscriptionBanner';
import type { Appointment, ChecklistRun, ComandaFlow, InventoryItem } from '../../types';

type TimeRangeKey = 'today' | '7d' | 'month';
type DashboardDensity = 'operational' | 'detailed';

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDays(base: Date, deltaDays: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + deltaDays);
  return next;
}

function getPreviousYm(ym: string): string {
  const [yStr, mStr] = ym.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return ym;
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function extractRecordYmd(record: { date?: string; createdAt?: unknown }): string {
  if (typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(record.date)) {
    return record.date.substring(0, 10);
  }
  if (typeof record.createdAt === 'number') {
    return toLocalYmd(new Date(record.createdAt));
  }
  if (typeof record.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(record.createdAt)) {
    return record.createdAt.substring(0, 10);
  }
  return '';
}

function getAppointmentStatusMeta(status: Appointment['status']): {
  label: string;
  toneClass: string;
} {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmado', toneClass: 'text-emerald-700' };
    case 'in_service':
      return { label: 'Em atendimento', toneClass: 'text-[#8A6D36]' };
    case 'waiting':
      return { label: 'Aguardando', toneClass: 'text-amber-700' };
    case 'completed':
      return { label: 'Concluído', toneClass: 'text-[#6B6B6B]' };
    case 'canceled':
    case 'no_show':
      return { label: 'Cancelado', toneClass: 'text-red-700' };
    default:
      return { label: 'Pendente', toneClass: 'text-amber-700' };
  }
}

export default function DashboardHome() {
  const { salonData, userData, isPlatformAdmin } = useAuth();
  const { segment, lex, isAgency, isModuleEnabled } = useLexicon();
  const isPaymentPending = salonData?.billing?.status !== 'ACTIVE';
  const navigate = useNavigate();
  const location = useLocation();

  const isProfessionalView =
    userData?.role === 'professional' ||
    location.pathname.endsWith('/meu-painel') ||
    location.pathname.endsWith('/profissional');

  const {
    loading: lumiLoading,
    context,
    metrics: lumiMetrics,
    healthScore: lumiHealthScore,
    alerts: lumiAlerts,
    insights: lumiInsights,
    recommendations: lumiRecommendations,
  } = useLumi(isProfessionalView ? undefined : salonData?.id);

  const [timeRange, setTimeRange] = useState<TimeRangeKey>('today');
  const [viewMode, setViewMode] = useState<DashboardDensity>('operational');

  const todayYmd = useMemo(() => toLocalYmd(new Date()), []);
  const currentMonthYm = useMemo(() => todayYmd.substring(0, 7), [todayYmd]);

  const [activeRankingMonth, setActiveRankingMonth] = useState<string>(currentMonthYm);
  const {
    professionalsPerformance,
    latestActiveMonth,
    loading: rankingLoading,
  } = useSalonPerformanceRanking(
    isProfessionalView ? undefined : salonData?.id,
    activeRankingMonth
  );

  useEffect(() => {
    if (latestActiveMonth && activeRankingMonth === currentMonthYm && !rankingLoading) {
      const hasActive = professionalsPerformance.some(
        (p) => p.totalRevenue > 0 || p.totalChecklists > 0 || p.totalGoals > 0
      );
      if (!hasActive && latestActiveMonth !== currentMonthYm) {
        setActiveRankingMonth(latestActiveMonth);
      }
    }
  }, [latestActiveMonth, activeRankingMonth, currentMonthYm, professionalsPerformance, rankingLoading]);

  const windowAnalytics = useMemo(() => {
    const now = new Date();
    const today = toLocalYmd(now);
    const yesterday = toLocalYmd(shiftDays(now, -1));
    const last7Start = toLocalYmd(shiftDays(now, -6));
    const prev7Start = toLocalYmd(shiftDays(now, -13));
    const prev7End = toLocalYmd(shiftDays(now, -7));
    const currentYm = today.substring(0, 7);
    const prevYm = getPreviousYm(currentYm);

    const isInCurrentWindow = (ymd: string): boolean => {
      if (!ymd) return false;
      if (timeRange === 'today') return ymd === today;
      if (timeRange === '7d') return ymd >= last7Start && ymd <= today;
      return ymd.startsWith(currentYm);
    };

    const isInPreviousWindow = (ymd: string): boolean => {
      if (!ymd) return false;
      if (timeRange === 'today') return ymd === yesterday;
      if (timeRange === '7d') return ymd >= prev7Start && ymd <= prev7End;
      return ymd.startsWith(prevYm);
    };

    const appointments = (context?.appointments || []) as Appointment[];
    const comandas = (context?.comandas || []) as ComandaFlow[];

    const calcRevenueAndCount = (predicate: (ymd: string) => boolean) => {
      let revenue = 0;
      let count = 0;

      appointments.forEach((ap) => {
        if (ap.status !== 'completed') return;
        const ymd = extractRecordYmd(ap);
        if (!predicate(ymd)) return;
        revenue += Number(ap.price) || 0;
        count += 1;
      });

      comandas.forEach((c) => {
        if (c.status !== 'completed') return;
        const ymd = extractRecordYmd(c);
        if (!predicate(ymd)) return;
        revenue += Number(c.finalTotal ?? c.totalAmount ?? 0) || 0;
        count += 1;
      });

      return {
        revenue,
        count,
        avgTicket: count > 0 ? revenue / count : 0,
      };
    };

    const currentStats = calcRevenueAndCount(isInCurrentWindow);
    const previousStats = calcRevenueAndCount(isInPreviousWindow);
    const monthStats = calcRevenueAndCount((ymd) => ymd.startsWith(currentYm));
    const prevMonthStats = calcRevenueAndCount((ymd) => ymd.startsWith(prevYm));
    const todayStats = calcRevenueAndCount((ymd) => ymd === today);

    // Goal target proportional to selected window
    const monthGoals = (context?.goals || []).filter((g) => g.month === currentYm);
    const monthlyGoal = monthGoals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyGoal = monthlyGoal > 0 ? monthlyGoal / daysInMonth : 0;

    const windowGoalTarget =
      monthlyGoal <= 0
        ? 0
        : timeRange === 'today'
          ? dailyGoal
          : timeRange === '7d'
            ? dailyGoal * 7
            : monthlyGoal;

    const goalProgressPct =
      windowGoalTarget > 0 ? Math.round((currentStats.revenue / windowGoalTarget) * 100) : 0;

    // Today's agenda breakdown (timezone-safe local YYYY-MM-DD)
    const todayAppointments = appointments
      .filter((ap) => ap.date === today && !ap.isBlock && ap.status !== 'canceled' && ap.status !== 'no_show')
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    const scheduledTodayCount = todayAppointments.filter(
      (ap) => ap.status === 'scheduled' || ap.status === 'confirmed' || ap.status === 'waiting' || ap.status === 'in_service'
    ).length;
    const pendingConfirmationCount = todayAppointments.filter(
      (ap) => ap.status === 'scheduled' && ap.confirmationStatus !== 'confirmed_by_client'
    ).length;
    const completedTodayCount = todayAppointments.filter((ap) => ap.status === 'completed').length;

    return {
      currentStats,
      previousStats,
      revenueDeltaPct: computeDeltaPct(currentStats.revenue, previousStats.revenue),
      ticketDeltaPct: computeDeltaPct(currentStats.avgTicket, previousStats.avgTicket),
      monthComparison: {
        revenueDeltaPct: computeDeltaPct(monthStats.revenue, prevMonthStats.revenue),
        ticketDeltaPct: computeDeltaPct(monthStats.avgTicket, prevMonthStats.avgTicket),
        periodLabel: 'Comparado ao mês anterior',
      },
      monthlyGoal,
      dailyGoal: Math.round(dailyGoal),
      windowGoalTarget,
      goalProgressPct,
      todayRevenue: todayStats.revenue,
      monthRevenue: monthStats.revenue,
      todayAppointments,
      scheduledTodayCount,
      pendingConfirmationCount,
      completedTodayCount,
      comparisonLabel:
        timeRange === 'today'
          ? 'vs ontem'
          : timeRange === '7d'
            ? 'vs 7 dias anteriores'
            : 'vs mês anterior',
    };
  }, [context?.appointments, context?.comandas, context?.goals, timeRange]);

  const checklistRunsToday = useMemo(() => {
    const runs = (context?.checklistRuns || []) as ChecklistRun[];
    return runs.filter((r) => (r.date || r.evaluationDate) === todayYmd);
  }, [context?.checklistRuns, todayYmd]);

  const lowStockItems = useMemo(() => {
    const items = (context?.inventory || []) as InventoryItem[];
    return items.filter((item) => Number(item.quantity) <= Number(item.minQuantity ?? 0));
  }, [context?.inventory]);

  const clientMetrics = useMemo(() => {
    if (!salonData?.id) return undefined;
    return {
      todayRevenue: windowAnalytics.todayRevenue,
      monthRevenue: windowAnalytics.monthRevenue,
      dailyGoal: windowAnalytics.dailyGoal > 0 ? windowAnalytics.dailyGoal : undefined,
      monthlyGoal: windowAnalytics.monthlyGoal > 0 ? windowAnalytics.monthlyGoal : undefined,
      scheduledAppointments: windowAnalytics.scheduledTodayCount,
      completedAppointments: windowAnalytics.completedTodayCount,
      pendingAppointments: windowAnalytics.pendingConfirmationCount,
      checklistRunsCount: checklistRunsToday.length,
    };
  }, [salonData?.id, windowAnalytics, checklistRunsToday.length]);

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    windowAnalytics.todayAppointments.slice(0, 3).forEach((ap) => {
      const statusMeta = getAppointmentStatusMeta(ap.status);
      events.push({
        id: `appt-${ap.id}`,
        type: 'appointment',
        title: `${ap.clientName || 'Cliente'} · ${ap.serviceName || 'Atendimento'}`,
        description: `${ap.professionalName || 'Equipe'} (${statusMeta.label})`,
        time: ap.time || 'Hoje',
        href: '/dashboard/agendamentos',
      });
    });

    checklistRunsToday.slice(0, 2).forEach((run) => {
      const score = run.percentage ?? run.completionPercentage ?? 0;
      events.push({
        id: `chk-${run.id}`,
        type: 'checklist',
        title: run.checklistTitle || 'Checklist Diário',
        description: run.evaluatedProfessionalName
          ? `${run.evaluatedProfessionalName} · ${Math.round(score)}% de conformidade`
          : `${Math.round(score)}% concluído`,
        time: 'Hoje',
        href: '/dashboard/checklist',
      });
    });

    if (lumiAlerts.length > 0) {
      const topAlert = lumiAlerts[0];
      events.push({
        id: `alert-${topAlert.id}`,
        type: 'alert',
        title: topAlert.title,
        description: topAlert.description,
        time: new Date(topAlert.createdAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        href: topAlert.actionUrl
          ? topAlert.actionUrl.startsWith('/dashboard')
            ? topAlert.actionUrl
            : `/dashboard${topAlert.actionUrl.startsWith('/') ? '' : '/'}${topAlert.actionUrl}`
          : undefined,
      });
    }

    if (lumiInsights.length > 0 && lumiInsights[0].id !== 'insight_insufficient_data') {
      const topInsight = lumiInsights[0];
      events.push({
        id: `insight-${topInsight.id}`,
        type: 'insight',
        title: topInsight.title,
        description: topInsight.description,
        time: new Date(topInsight.createdAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    }

    return events.slice(0, 6);
  }, [windowAnalytics.todayAppointments, checklistRunsToday, lumiAlerts, lumiInsights]);

  if (isPlatformAdmin) {
    return (
      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-8 text-center max-w-lg mx-auto mt-12 space-y-4">
        <Crown className="w-10 h-10 text-[#8A6D36] mx-auto" />
        <div className="space-y-1.5">
          <h2 className="text-xl font-heading font-semibold text-[#171717]">Painel Master Ativo</h2>
          <p className="text-xs text-[#4A4A4A] leading-relaxed">
            Você está autenticado como Administrador Global da plataforma. Acesse a central master
            para gerenciar os estabelecimentos afiliados.
          </p>
        </div>
        <Button
          onClick={() => navigate('/master')}
          className="bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold rounded-lg text-xs h-10 px-6"
        >
          Ir para o Painel Master
        </Button>
      </div>
    );
  }

  if (!salonData?.id || !userData || lumiLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#8A6D36]" />
        <span className="text-xs font-medium text-[#6B6B6B]">
          Sincronizando dados do estabelecimento...
        </span>
      </div>
    );
  }

  if (isProfessionalView) {
    return <ProfessionalDashboard />;
  }

  const isOwnerOrManager =
    userData?.role === 'owner' ||
    userData?.role === 'manager' ||
    userData?.role === 'platform_admin';
  const isReceptionistOrAttendant =
    userData?.role === 'receptionist' || userData?.role === 'attendant';

  const roleDisplayInfo: Record<string, { label: string; desc: string }> = {
    owner: {
      label: 'Proprietário',
      desc: 'Visão completa de faturamento, agenda, equipe, CRM e metas do dia.',
    },
    manager: {
      label: 'Gerente',
      desc: 'Acompanhamento de operação diária, equipe, agenda e metas.',
    },
    receptionist: {
      label: 'Recepcionista',
      desc: 'Controle de agenda, confirmações de clientes, checklists e recepção.',
    },
    attendant: {
      label: 'Atendente',
      desc: 'Consulta rápida de agenda, cadastro de clientes e checklists.',
    },
    professional: {
      label: 'Profissional',
      desc: 'Agenda pessoal, atendimentos e comissões.',
    },
    platform_admin: {
      label: 'Master Admin',
      desc: 'Administração global da plataforma.',
    },
  };
  const activeRole = roleDisplayInfo[userData?.role || 'owner'] || roleDisplayInfo.owner;

  const topRankingPros = professionalsPerformance
    .filter((p) => p.totalRevenue > 0 || p.totalChecklists > 0 || p.totalGoals > 0)
    .slice(0, 5);

  const timeRangeLabels: Record<TimeRangeKey, string> = {
    today: 'Hoje',
    '7d': '7 dias',
    month: 'Este mês',
  };

  return (
    <div className="space-y-6 font-sans pb-12 text-[#171717]">
      {isPaymentPending && <SubscriptionBanner />}

      {/* Hero Header */}
      <section className="rounded-2xl border border-[#E5E2DC] bg-white p-5 md:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-[#6B6B6B]">
            <span className="text-[#8A6D36] font-semibold">
              {salonData?.plan === 'founder' ? 'Plano Founder' : 'Estabelecimento Parceiro'}
            </span>
            <span aria-hidden="true"> · </span>
            <span>Perfil {activeRole.label}</span>
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#171717] font-heading truncate">
            {salonData.name}
          </h1>
          <p className="text-xs text-[#4A4A4A] max-w-2xl leading-relaxed">
            Olá, <span className="font-semibold text-[#171717]">{userData?.fullName}</span>.{' '}
            {activeRole.desc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            onClick={() => navigate('/dashboard/agendamentos')}
            className="rounded-lg bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold text-xs h-10 px-4 gap-2"
          >
            <CalendarPlus className="w-4 h-4 text-[#D8C79F]" />
            Novo Agendamento
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/clientes')}
            className="rounded-lg border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] text-xs h-10 px-4 font-medium gap-2"
          >
            <UserPlus className="w-4 h-4 text-[#8A6D36]" />
            Novo Cliente
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/lumi-ia')}
            className="rounded-lg border-[#E5E2DC] bg-[#FAF9F7] hover:border-[#8A6D36]/50 text-[#171717] text-xs h-10 px-4 font-medium gap-2"
          >
            <Sparkles className="w-4 h-4 text-[#8A6D36]" />
            Lumi IA
          </Button>
        </div>
      </section>

      {/* Quick Access Modules */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">
            Acesso Rápido
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Selector */}
            <div
              role="group"
              aria-label="Recorte de tempo"
              className="inline-flex items-center rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-0.5"
            >
              {(['today', '7d', 'month'] as TimeRangeKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTimeRange(key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    timeRange === key
                      ? 'bg-white text-[#171717] shadow-xs border border-[#E5E2DC]'
                      : 'text-[#6B6B6B] hover:text-[#171717]'
                  )}
                >
                  {timeRangeLabels[key]}
                </button>
              ))}
            </div>

            {/* Density Toggle */}
            <div
              role="group"
              aria-label="Nível de detalhe do painel"
              className="inline-flex items-center rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-0.5"
            >
              <button
                type="button"
                onClick={() => setViewMode('operational')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  viewMode === 'operational'
                    ? 'bg-white text-[#171717] shadow-xs border border-[#E5E2DC]'
                    : 'text-[#6B6B6B] hover:text-[#171717]'
                )}
              >
                Operacional
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  viewMode === 'detailed'
                    ? 'bg-white text-[#171717] shadow-xs border border-[#E5E2DC]'
                    : 'text-[#6B6B6B] hover:text-[#171717]'
                )}
              >
                Análise Completa
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Link
            to="/dashboard/agendamentos"
            className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
          >
            <Calendar className="w-4 h-4 text-[#8A6D36]" />
            <span className="text-xs font-medium text-[#171717] truncate w-full">
              {lex.appointments || 'Agenda'}
            </span>
          </Link>

          <Link
            to="/dashboard/clientes"
            className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
          >
            <Users className="w-4 h-4 text-[#8A6D36]" />
            <span className="text-xs font-medium text-[#171717] truncate w-full">
              {lex.clients || 'Clientes'}
            </span>
          </Link>

          <Link
            to="/dashboard/crm"
            className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
          >
            <MessageSquareText className="w-4 h-4 text-[#8A6D36]" />
            <span className="text-xs font-medium text-[#171717] truncate w-full">CRM 360°</span>
          </Link>

          <Link
            to="/dashboard/lumi-ia"
            className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-[#8A6D36]" />
            <span className="text-xs font-medium text-[#171717] truncate w-full">Lumi IA</span>
          </Link>

          <Link
            to="/dashboard/servicos"
            className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
          >
            {segment === 'beauty' ? (
              <Scissors className="w-4 h-4 text-[#8A6D36]" />
            ) : segment === 'health' ? (
              <Activity className="w-4 h-4 text-[#8A6D36]" />
            ) : (
              <Briefcase className="w-4 h-4 text-[#8A6D36]" />
            )}
            <span className="text-xs font-medium text-[#171717] truncate w-full">
              {lex.services || 'Serviços'}
            </span>
          </Link>

          {(isOwnerOrManager || !isReceptionistOrAttendant) && (
            <>
              <Link
                to="/dashboard/equipe"
                className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
              >
                <Briefcase className="w-4 h-4 text-[#8A6D36]" />
                <span className="text-xs font-medium text-[#171717] truncate w-full">
                  {salonData?.managementMode === 'liberal'
                    ? 'Meu Perfil'
                    : lex.professionals || 'Equipe'}
                </span>
              </Link>

              <Link
                to="/dashboard/checklist"
                className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
              >
                <ListTodo className="w-4 h-4 text-[#8A6D36]" />
                <span className="text-xs font-medium text-[#171717] truncate w-full">
                  {lex.checklists || 'Checklists'}
                </span>
              </Link>

              <Link
                to="/dashboard/relatorios"
                className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
              >
                <FileText className="w-4 h-4 text-[#8A6D36]" />
                <span className="text-xs font-medium text-[#171717] truncate w-full">
                  Relatórios
                </span>
              </Link>
            </>
          )}

          {(isAgency || isModuleEnabled('clientPortal')) && (
            <Link
              to="/dashboard/area-do-cliente"
              className="rounded-xl border border-[#E5E2DC] bg-white hover:border-[#8A6D36]/50 hover:bg-[#FAF9F7] p-3.5 flex flex-col items-center justify-center text-center gap-2 transition-colors"
            >
              <Globe className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-medium text-[#171717] truncate w-full">
                Portal Clientes
              </span>
            </Link>
          )}
        </div>
      </section>

      {/* Primary KPI Grid (Real Calculations + Real Comparison Deltas) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Revenue */}
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
            <span>Faturamento ({timeRangeLabels[timeRange]})</span>
            <TrendingUp className="w-4 h-4 text-[#8A6D36]" />
          </div>
          <p className="text-2xl font-bold text-[#171717] tabular-nums">
            {formatBRL(windowAnalytics.currentStats.revenue)}
          </p>
          <div className="flex items-center justify-between text-[11px] pt-1">
            {windowAnalytics.revenueDeltaPct !== null ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-semibold tabular-nums',
                  windowAnalytics.revenueDeltaPct >= 0 ? 'text-emerald-700' : 'text-red-700'
                )}
              >
                {windowAnalytics.revenueDeltaPct >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {windowAnalytics.revenueDeltaPct >= 0
                  ? `+${windowAnalytics.revenueDeltaPct}%`
                  : `${windowAnalytics.revenueDeltaPct}%`}{' '}
                {windowAnalytics.comparisonLabel}
              </span>
            ) : (
              <span className="text-[#6B6B6B]">
                {windowAnalytics.currentStats.count} atendimento(s) concluído(s)
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Goal Progress */}
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
            <span>Progresso da Meta ({timeRangeLabels[timeRange]})</span>
            <Target className="w-4 h-4 text-[#8A6D36]" />
          </div>
          {windowAnalytics.windowGoalTarget > 0 ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl font-bold text-[#171717] tabular-nums">
                  {windowAnalytics.goalProgressPct}%
                </p>
                <span className="text-[11px] text-[#6B6B6B] tabular-nums">
                  Meta {formatBRL(Math.round(windowAnalytics.windowGoalTarget))}
                </span>
              </div>
              <Progress
                value={Math.min(100, windowAnalytics.goalProgressPct)}
                className="h-1.5 bg-[#F2EFE9]"
              />
            </>
          ) : (
            <div className="space-y-1.5">
              <p className="text-lg font-semibold text-[#171717]">Sem meta definida</p>
              <Link
                to="/dashboard/metas"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A6D36] hover:underline"
              >
                Definir meta mensal <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* KPI 3: Average Ticket */}
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
            <span>Ticket Médio ({timeRangeLabels[timeRange]})</span>
            <Activity className="w-4 h-4 text-[#8A6D36]" />
          </div>
          <p className="text-2xl font-bold text-[#171717] tabular-nums">
            {formatBRL(windowAnalytics.currentStats.avgTicket)}
          </p>
          <div className="text-[11px] pt-1">
            {windowAnalytics.ticketDeltaPct !== null ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-semibold tabular-nums',
                  windowAnalytics.ticketDeltaPct >= 0 ? 'text-emerald-700' : 'text-red-700'
                )}
              >
                {windowAnalytics.ticketDeltaPct >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {windowAnalytics.ticketDeltaPct >= 0
                  ? `+${windowAnalytics.ticketDeltaPct}%`
                  : `${windowAnalytics.ticketDeltaPct}%`}{' '}
                {windowAnalytics.comparisonLabel}
              </span>
            ) : (
              <span className="text-[#6B6B6B] tabular-nums">
                {windowAnalytics.currentStats.count} lançamento(s)
              </span>
            )}
          </div>
        </div>

        {/* KPI 4: Today's Agenda */}
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
            <span>Agenda de Hoje</span>
            <Clock className="w-4 h-4 text-[#8A6D36]" />
          </div>
          <p className="text-2xl font-bold text-[#171717] tabular-nums">
            {windowAnalytics.todayAppointments.length}
          </p>
          <p className="text-[11px] text-[#4A4A4A] tabular-nums pt-1">
            <span className="font-semibold text-emerald-700">
              {windowAnalytics.completedTodayCount} concluído(s)
            </span>
            <span aria-hidden="true"> · </span>
            <span
              className={cn(
                'font-semibold',
                windowAnalytics.pendingConfirmationCount > 0
                  ? 'text-amber-700'
                  : 'text-[#6B6B6B]'
              )}
            >
              {windowAnalytics.pendingConfirmationCount} sem confirmação
            </span>
          </p>
        </div>
      </section>

      {/* 2-Column Operational Cockpit */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Agenda de Hoje & Confirmações */}
        <div className="lg:col-span-7 rounded-xl border border-[#E5E2DC] bg-white p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#E5E2DC] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#171717]">
                  Atendimentos de Hoje ({todayYmd.split('-').reverse().join('/')})
                </h2>
                <p className="text-xs text-[#6B6B6B]">
                  Ordem cronológica com status de confirmação em tempo real
                </p>
              </div>
              <Link
                to="/dashboard/agendamentos"
                className="text-xs font-semibold text-[#8A6D36] hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Abrir agenda <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {windowAnalytics.todayAppointments.length === 0 ? (
              <div className="py-10 text-center space-y-2 text-xs text-[#6B6B6B]">
                <Calendar className="w-6 h-6 text-[#8A6D36] mx-auto" />
                <p className="font-semibold text-[#171717]">
                  Nenhum agendamento ativo para hoje.
                </p>
                <p>
                  Registre um novo horário ou dispare uma campanha de reativação na Central Lumi IA.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate('/dashboard/agendamentos')}
                    className="h-8 px-3 text-xs bg-[#171717] text-white hover:bg-[#2B2B2B] rounded-lg"
                  >
                    Agendar Horário
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/dashboard/lumi-ia')}
                    className="h-8 px-3 text-xs border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] rounded-lg"
                  >
                    Campanha Lumi IA
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E2DC]">
                {windowAnalytics.todayAppointments.slice(0, 6).map((ap) => {
                  const statusMeta = getAppointmentStatusMeta(ap.status);
                  return (
                    <div
                      key={ap.id}
                      className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-12 text-xs font-bold text-[#171717] tabular-nums shrink-0">
                          {ap.time || '--:--'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#171717] truncate">
                            {ap.clientName || 'Cliente'}
                          </p>
                          <p className="text-[11px] text-[#6B6B6B] truncate">
                            {ap.serviceName || 'Serviço'} · {ap.professionalName || 'Profissional'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-0.5">
                        <p className={cn('text-[11px] font-semibold', statusMeta.toneClass)}>
                          {statusMeta.label}
                        </p>
                        {typeof ap.price === 'number' && ap.price > 0 && (
                          <p className="text-[11px] text-[#6B6B6B] tabular-nums">
                            {formatBRL(ap.price)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {windowAnalytics.todayAppointments.length > 0 && (
            <div className="border-t border-[#E5E2DC] pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#6B6B6B] tabular-nums">
                Exibindo {Math.min(6, windowAnalytics.todayAppointments.length)} de{' '}
                {windowAnalytics.todayAppointments.length} horários de hoje
              </span>
              {windowAnalytics.pendingConfirmationCount > 0 && (
                <Link
                  to="/dashboard/crm"
                  className="font-semibold text-[#8A6D36] hover:underline inline-flex items-center gap-1"
                >
                  Confirmar {windowAnalytics.pendingConfirmationCount} no CRM 360°{' '}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right: Top Equipe & Pulso Operacional */}
        <div className="lg:col-span-5 rounded-xl border border-[#E5E2DC] bg-white p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#E5E2DC] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#8A6D36]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#171717]">
                    Desempenho da Equipe
                  </h2>
                  <p className="text-xs text-[#6B6B6B]">
                    Produção consolidada no mês de referência
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard/relatorios"
                className="text-xs font-semibold text-[#8A6D36] hover:underline shrink-0"
              >
                Relatórios
              </Link>
            </div>

            {topRankingPros.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#6B6B6B] space-y-1">
                <p className="font-semibold text-[#171717]">Sem produção lançada no mês.</p>
                <p>Conclua atendimentos ou comandas para formar o ranking da equipe.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topRankingPros.map((pro, idx) => (
                  <div key={pro.id || idx} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-xs font-bold text-[#8A6D36] tabular-nums shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#171717] truncate">
                          {pro.name || pro.fullName || 'Profissional'}
                        </p>
                        <p className="text-[11px] text-[#6B6B6B] tabular-nums">
                          {pro.totalChecklists > 0
                            ? `Checklist ${Math.round(pro.avgScore)}%`
                            : 'Sem checklist no mês'}
                          {pro.totalGoals > 0
                            ? ` · Meta ${Math.round(pro.avgGoalProgress)}%`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#171717] tabular-nums shrink-0">
                      {formatBRL(pro.totalRevenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operational Pulses Strip */}
          <div className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#4A4A4A] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Checklists hoje
              </span>
              <Link
                to="/dashboard/checklist"
                className="font-semibold text-[#171717] hover:text-[#8A6D36] tabular-nums"
              >
                {checklistRunsToday.length} executado(s)
              </Link>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#4A4A4A] flex items-center gap-1.5">
                {lowStockItems.length > 0 ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                ) : (
                  <Package className="w-3.5 h-3.5 text-[#8A6D36]" />
                )}
                Estoque mínimo
              </span>
              <Link
                to="/dashboard/estoque"
                className={cn(
                  'font-semibold tabular-nums hover:underline',
                  lowStockItems.length > 0 ? 'text-amber-700' : 'text-emerald-700'
                )}
              >
                {lowStockItems.length > 0
                  ? `${lowStockItems.length} item(ns) em alerta`
                  : 'Estoque em dia'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Calibration Alert (only renders if setup < 100%) */}
      <LumiSystemReadinessAlert
        salonName={salonData.name}
        configState={{
          hasGoals:
            Boolean(clientMetrics?.monthlyGoal && clientMetrics.monthlyGoal > 0) ||
            Boolean(context?.goals && context.goals.length > 0),
          hasServices: Boolean(context?.services && context.services.length > 0),
          hasProfessionals: Boolean(context?.professionals && context.professionals.length > 0),
          hasCommissions: Boolean(
            context?.professionals &&
              context.professionals.some(
                (p) => p.commissionRate !== undefined && p.commissionRate > 0
              )
          ),
          hasChecklists:
            Boolean(context?.checklistRuns && context.checklistRuns.length > 0) ||
            Boolean(clientMetrics?.checklistRunsCount && clientMetrics.checklistRunsCount > 0),
          hasSalonDetails: Boolean(salonData?.name && (salonData?.phone || salonData?.businessType)),
        }}
      />

      {/* Daily AI Diagnosis */}
      <LumiereIAInsights
        salonId={salonData.id}
        salonName={salonData.name}
        userName={userData?.fullName}
        clientMetrics={clientMetrics}
      />

      {/* Detailed View Sections */}
      {viewMode === 'detailed' && (
        <div className="space-y-6">
          <LumiDailySummary metrics={lumiMetrics} comparison={windowAnalytics.monthComparison} />
          <BusinessPulse healthScore={lumiHealthScore} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <LumiInsightsList insights={lumiInsights} />
              <LumiRecommendationsList recommendations={lumiRecommendations} />
            </div>
            <div className="lg:col-span-1">
              <LumiTimeline events={timelineEvents} />
            </div>
          </div>
          <LumiAlertsList alerts={lumiAlerts} />
        </div>
      )}
    </div>
  );
}

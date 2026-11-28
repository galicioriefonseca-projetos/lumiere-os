import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Megaphone,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/utils';
import type {
  Appointment,
  Client,
  CrmCampaign,
  CrmCampaignDispatch,
  CrmConversation,
  CrmOpportunity,
  Service,
} from '@/types';

type OverviewSubTab = 'overview' | 'bookings' | 'confirmed' | 'marketing' | 'inactive';
type PeriodPreset = '7d' | '30d' | '90d' | 'all';

interface LumiAiOverviewPanelProps {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  campaigns: CrmCampaign[];
  dispatches: CrmCampaignDispatch[];
  conversations: CrmConversation[];
  opportunities: CrmOpportunity[];
  healthScoreValue?: number | null;
  onJumpToSection: (section: 'marketing' | 'scheduling' | 'policy') => void;
}

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CAMPAIGN_COLORS: Record<string, string> = {
  service_return: '#B89B5E',
  inactive_clients: '#D97706',
  birthday: '#0284C7',
  promotion: '#16A34A',
  confirmation: '#171717',
  post_service_csat: '#7C3AED',
};

const CAMPAIGN_LABELS: Record<string, string> = {
  service_return: 'Retorno de Serviço',
  inactive_clients: 'Clientes Inativos',
  birthday: 'Aniversário',
  promotion: 'Promoções',
  confirmation: 'Confirmação',
  post_service_csat: 'Pós-atendimento',
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getApptPrice(a: Appointment, servicesMap: Map<string, Service>): number {
  if (typeof a.price === 'number' && !Number.isNaN(a.price)) return a.price;
  const s = servicesMap.get(a.serviceId);
  return s ? Number(s.price || 0) : 0;
}

export function LumiAiOverviewPanel({
  appointments,
  clients,
  services,
  campaigns,
  dispatches,
  conversations,
  opportunities,
  healthScoreValue,
  onJumpToSection,
}: LumiAiOverviewPanelProps) {
  const [subTab, setSubTab] = useState<OverviewSubTab>('overview');
  const [period, setPeriod] = useState<PeriodPreset>('30d');

  const servicesMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const cutoffMs = useMemo(() => {
    if (period === 'all') return 0;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    return Date.now() - days * 86400000;
  }, [period]);

  const cutoffYmd = useMemo(
    () => (cutoffMs > 0 ? toYmd(new Date(cutoffMs)) : '1900-01-01'),
    [cutoffMs]
  );

  // Real automated/online bookings (online client booking OR AI-assisted CRM scheduled opps)
  const autoBookings = useMemo(() => {
    return appointments.filter((a) => {
      if (a.isBlock || a.status === 'canceled') return false;
      if (a.date < cutoffYmd) return false;
      return a.source === 'client_booking';
    });
  }, [appointments, cutoffYmd]);

  const aiScheduledOpps = useMemo(() => {
    const convById = new Map(conversations.map((c) => [c.id, c]));
    return opportunities.filter((o) => {
      if (o.stage !== 'scheduled') return false;
      if (o.updatedAt < cutoffMs && o.createdAt < cutoffMs) return false;
      const conv = o.conversationId ? convById.get(o.conversationId) : undefined;
      return conv?.handlingMode === 'ai' || o.valueSource === 'ai';
    });
  }, [opportunities, conversations, cutoffMs]);

  const totalAutoBookingsCount = autoBookings.length + aiScheduledOpps.length;
  const totalAutoBookingsRevenue =
    autoBookings.reduce((acc, a) => acc + getApptPrice(a, servicesMap), 0) +
    aiScheduledOpps.reduce((acc, o) => acc + Number(o.estimatedValue || 0), 0);
  const autoAvgTicket =
    totalAutoBookingsCount > 0 ? totalAutoBookingsRevenue / totalAutoBookingsCount : 0;

  // Real confirmations
  const confirmedAppts = useMemo(() => {
    return appointments.filter((a) => {
      if (a.isBlock || a.date < cutoffYmd) return false;
      return (
        a.confirmationStatus === 'confirmed_by_client' ||
        a.status === 'confirmed' ||
        Boolean(a.confirmedAt)
      );
    });
  }, [appointments, cutoffYmd]);

  const confirmationDispatches = useMemo(
    () =>
      dispatches.filter(
        (d) => d.campaignType === 'confirmation' && d.dispatchedAt >= cutoffMs
      ),
    [dispatches, cutoffMs]
  );

  // Marketing dispatches (excluding confirmation)
  const marketingDispatches = useMemo(
    () =>
      dispatches.filter(
        (d) => d.campaignType !== 'confirmation' && d.dispatchedAt >= cutoffMs
      ),
    [dispatches, cutoffMs]
  );

  const marketingConverted = useMemo(
    () => marketingDispatches.filter((d) => d.status === 'converted'),
    [marketingDispatches]
  );

  const marketingRecoveredRevenue = useMemo(() => {
    const fromDispatches = marketingConverted.reduce(
      (acc, d) => acc + Number(d.convertedRevenue || 0),
      0
    );
    const fromCampaigns = campaigns
      .filter((c) => c.type !== 'confirmation')
      .reduce((acc, c) => acc + Number(c.metrics.recoveredRevenue || 0), 0);
    return Math.max(fromDispatches, fromCampaigns);
  }, [marketingConverted, campaigns]);

  const marketingConversionRate =
    marketingDispatches.length > 0
      ? Math.round((marketingConverted.length / marketingDispatches.length) * 1000) / 10
      : 0;

  // Inactive dispatches & candidates
  const inactiveDispatches = useMemo(
    () =>
      dispatches
        .filter((d) => d.campaignType === 'inactive_clients' && d.dispatchedAt >= cutoffMs)
        .sort((a, b) => b.dispatchedAt - a.dispatchedAt),
    [dispatches, cutoffMs]
  );

  const inactiveRecoveredRevenue = useMemo(
    () =>
      inactiveDispatches
        .filter((d) => d.status === 'converted')
        .reduce((acc, d) => acc + Number(d.convertedRevenue || 0), 0),
    [inactiveDispatches]
  );

  const inactiveEligibleCandidates = useMemo(() => {
    const todayYmd = toYmd(new Date());
    const todayMs = Date.now();
    return clients
      .filter((c) => !c.deletedAt && !c.archived && Boolean(c.phone))
      .map((c) => {
        const hasFuture = appointments.some(
          (a) =>
            a.clientId === c.id &&
            a.date >= todayYmd &&
            a.status !== 'canceled' &&
            a.status !== 'no_show'
        );
        if (hasFuture) return null;
        const completed = appointments
          .filter((a) => a.clientId === c.id && a.status === 'completed')
          .sort((x, y) => y.date.localeCompare(x.date));
        const refDate = completed[0]?.date;
        if (!refDate) return null;
        const daysAgo = Math.round(
          (todayMs - new Date(`${refDate}T12:00:00`).getTime()) / 86400000
        );
        if (daysAgo < 90) return null;
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          daysAgo,
          lastService: completed[0]?.serviceName || 'Atendimento anterior',
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.daysAgo - a.daysAgo)
      .slice(0, 12);
  }, [clients, appointments]);

  // Charts for Bookings tab
  const bookingsByHour = useMemo(() => {
    const map = new Map<string, number>();
    autoBookings.forEach((a) => {
      const hh = `${String(a.time || '09:00').slice(0, 2)}:00`;
      map.set(hh, (map.get(hh) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hora, total]) => ({ hora, total }));
  }, [autoBookings]);

  const bookingsByWeekday = useMemo(() => {
    const counts = new Array(7).fill(0);
    autoBookings.forEach((a) => {
      const dayIdx = new Date(`${a.date}T12:00:00`).getDay();
      if (dayIdx >= 0 && dayIdx < 7) counts[dayIdx] += 1;
    });
    return WEEKDAY_NAMES.map((dia, idx) => ({ dia, total: counts[idx] })).filter((d) => d.total > 0);
  }, [autoBookings]);

  const bookingsDailySeries = useMemo(() => {
    const map = new Map<string, { bookings: number; revenue: number }>();
    autoBookings.forEach((a) => {
      const slot = map.get(a.date) || { bookings: 0, revenue: 0 };
      slot.bookings += 1;
      slot.revenue += getApptPrice(a, servicesMap);
      map.set(a.date, slot);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ymd, val]) => ({
        data: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`,
        agendamentos: val.bookings,
        faturamento: Math.round(val.revenue),
      }));
  }, [autoBookings, servicesMap]);

  // Charts for Confirmed tab
  const confirmationsDailySeries = useMemo(() => {
    const map = new Map<string, number>();
    confirmedAppts.forEach((a) => {
      const key = a.confirmedAt ? toYmd(new Date(a.confirmedAt)) : a.date;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ymd, total]) => ({
        data: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`,
        confirmados: total,
      }));
  }, [confirmedAppts]);

  const confirmationsByWeekday = useMemo(() => {
    const counts = new Array(7).fill(0);
    confirmedAppts.forEach((a) => {
      const dt = a.confirmedAt ? new Date(a.confirmedAt) : new Date(`${a.date}T12:00:00`);
      const idx = dt.getDay();
      if (idx >= 0 && idx < 7) counts[idx] += 1;
    });
    return WEEKDAY_NAMES.map((dia, idx) => ({ dia, total: counts[idx] }));
  }, [confirmedAppts]);

  const confirmationsByHour = useMemo(() => {
    const map = new Map<number, number>();
    for (let h = 7; h <= 22; h++) map.set(h, 0);
    confirmedAppts.forEach((a) => {
      const h = a.confirmedAt
        ? new Date(a.confirmedAt).getHours()
        : Number(String(a.time || '10:00').slice(0, 2));
      if (h >= 7 && h <= 22) map.set(h, (map.get(h) || 0) + 1);
    });
    return Array.from(map.entries()).map(([h, total]) => ({
      hora: `${String(h).padStart(2, '0')}h`,
      total,
    }));
  }, [confirmedAppts]);

  // Charts for Marketing tab
  const marketingByType = useMemo(() => {
    const counts = new Map<string, number>();
    marketingDispatches.forEach((d) => {
      counts.set(d.campaignType, (counts.get(d.campaignType) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([type, value]) => ({
      type,
      name: CAMPAIGN_LABELS[type] || type,
      value,
      color: CAMPAIGN_COLORS[type] || '#B89B5E',
    }));
  }, [marketingDispatches]);

  const marketingDailyChart = useMemo(() => {
    const map = new Map<
      string,
      {
        data: string;
        service_return: number;
        inactive_clients: number;
        birthday: number;
        promotion: number;
        converted: number;
      }
    >();
    marketingDispatches.forEach((d) => {
      const ymd = toYmd(new Date(d.dispatchedAt));
      const slot = map.get(ymd) || {
        data: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`,
        service_return: 0,
        inactive_clients: 0,
        birthday: 0,
        promotion: 0,
        converted: 0,
      };
      if (d.campaignType === 'service_return') slot.service_return += 1;
      else if (d.campaignType === 'inactive_clients') slot.inactive_clients += 1;
      else if (d.campaignType === 'birthday') slot.birthday += 1;
      else if (d.campaignType === 'promotion') slot.promotion += 1;
      if (d.status === 'converted') slot.converted += 1;
      map.set(ymd, slot);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [marketingDispatches]);

  const activeCampaignsCount = campaigns.filter((c) => c.enabled).length;

  return (
    <div className="space-y-5">
      {/* Header + Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171717] tracking-tight">
            Painel Lumi IA — Desempenho em Tempo Real
          </h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            Telemetria real de agendamentos, confirmações, disparos e recuperação de clientes da sua base.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] self-start sm:self-auto">
          {(
            [
              { id: '7d', label: '7 dias' },
              { id: '30d', label: '30 dias' },
              { id: '90d', label: '90 dias' },
              { id: 'all', label: 'Todo período' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[34px] ${
                period === p.id
                  ? 'bg-[#171717] text-white'
                  : 'text-[#6B6B6B] hover:text-[#171717]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-[#E5E2DC] flex items-center gap-1 overflow-x-auto scrollbar-none">
        {(
          [
            { id: 'overview', label: 'Visão Geral' },
            { id: 'bookings', label: 'Agendamentos' },
            { id: 'confirmed', label: 'Confirmados' },
            { id: 'marketing', label: 'Marketing' },
            { id: 'inactive', label: 'Inativos' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[42px] ${
              subTab === tab.id
                ? 'border-[#171717] text-[#171717]'
                : 'border-transparent text-[#6B6B6B] hover:text-[#171717]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* VISÃO GERAL */}
      {subTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Agendamento via IA &amp; Online
                </span>
                <Bot className="w-4 h-4 text-[#8A6D36]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#171717] tabular-nums">
                  {totalAutoBookingsCount}
                </p>
                <p className="text-xs text-[#6B6B6B] mt-1 tabular-nums">
                  Receita gerada: <strong className="text-[#171717]">{formatBRL(totalAutoBookingsRevenue)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('bookings')}
                className="text-xs font-medium text-[#8A6D36] hover:text-[#171717] inline-flex items-center gap-1 self-start cursor-pointer"
              >
                Detalhar agendamentos <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Confirmações Automáticas
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#171717] tabular-nums">
                  {confirmedAppts.length}
                </p>
                <p className="text-xs text-[#6B6B6B] mt-1 tabular-nums">
                  {confirmationDispatches.length} disparo(s) de lembrete no período
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('confirmed')}
                className="text-xs font-medium text-[#8A6D36] hover:text-[#171717] inline-flex items-center gap-1 self-start cursor-pointer"
              >
                Ver horários de pico <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Campanhas de Marketing
                </span>
                <Megaphone className="w-4 h-4 text-[#8A6D36]" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#171717] tabular-nums">
                  {marketingDispatches.length}
                </p>
                <p className="text-xs text-[#6B6B6B] mt-1 tabular-nums">
                  {marketingConverted.length} convertido(s) · {formatBRL(marketingRecoveredRevenue)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToSection('marketing')}
                className="text-xs font-medium text-[#8A6D36] hover:text-[#171717] inline-flex items-center gap-1 self-start cursor-pointer"
              >
                Gerenciar {activeCampaignsCount} régua(s) ativas <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Clientes Inativos
                </span>
                <Users className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <p className="text-3xl font-semibold text-[#171717] tabular-nums">
                  {inactiveEligibleCandidates.length}
                </p>
                <p className="text-xs text-[#6B6B6B] mt-1 tabular-nums">
                  Prontos para resgate · {inactiveDispatches.length} já contatados
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('inactive')}
                className="text-xs font-medium text-[#8A6D36] hover:text-[#171717] inline-flex items-center gap-1 self-start cursor-pointer"
              >
                Abrir lista de resgate <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Executive Lumi Health Strip + Shortcuts */}
          <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#F5F1E9] border border-[#D8C79F] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-[#8A6D36]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#171717]">
                  Central Unificada Lumi IA
                  {typeof healthScoreValue === 'number' && healthScoreValue > 0 && (
                    <span className="ml-2 text-xs font-normal text-[#6B6B6B] tabular-nums">
                      · Saúde Operacional: <strong className="text-[#171717]">{healthScoreValue}/100</strong>
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-1 max-w-2xl leading-relaxed">
                  Diferente de painéis estáticos atualizados no dia seguinte, a Lumi IA calcula cada disparo,
                  confirmação, resposta no WhatsApp e oportunidade de retorno em tempo real direto da sua agenda e CRM.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onJumpToSection('marketing')}
                className="h-10 px-4 text-xs border-[#E5E2DC] bg-[#FAF9F7] text-[#171717] hover:bg-[#F5F1E9] rounded-xl"
              >
                Criar Campanha ou Promoção
              </Button>
              <Link to="/dashboard/crm">
                <Button
                  type="button"
                  className="h-10 px-4 text-xs bg-[#171717] hover:bg-[#2A2A2A] text-white rounded-xl"
                >
                  Abrir Chat Omnichannel CRM
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* AGENDAMENTOS TAB */}
      {subTab === 'bookings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Agendamentos Automáticos
              </span>
              <p className="text-2xl font-semibold text-[#171717] mt-1.5 tabular-nums">
                {totalAutoBookingsCount}
              </p>
              <p className="text-[11px] text-[#6B6B6B] mt-1">
                Link público + qualificados pela Lumi IA
              </p>
            </div>
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Faturamento com Agendamentos
              </span>
              <p className="text-2xl font-semibold text-[#171717] mt-1.5 tabular-nums">
                {formatBRL(totalAutoBookingsRevenue)}
              </p>
              <p className="text-[11px] text-[#6B6B6B] mt-1">Valor acumulado no período</p>
            </div>
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Ticket Médio Automático
              </span>
              <p className="text-2xl font-semibold text-[#171717] mt-1.5 tabular-nums">
                {formatBRL(autoAvgTicket)}
              </p>
              <p className="text-[11px] text-[#6B6B6B] mt-1">Por agendamento autônomo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#171717]">Distribuição por Horário</h4>
              <p className="text-xs text-[#6B6B6B] mb-4">
                Horários em que os agendamentos automáticos acontecem
              </p>
              {bookingsByHour.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-[#6B6B6B]">
                  Nenhum agendamento automático registrado neste período.
                </div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookingsByHour}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                      <XAxis dataKey="hora" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Agendamentos" fill="#B89B5E" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#171717]">Dias de Maior Demanda</h4>
              <p className="text-xs text-[#6B6B6B] mb-4">
                Volume de agendamentos por dia da semana
              </p>
              {bookingsByWeekday.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-[#6B6B6B]">
                  Sem agendamentos automáticos no período selecionado.
                </div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookingsByWeekday}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                      <XAxis dataKey="dia" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Agendamentos" fill="#171717" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
            <h4 className="text-sm font-semibold text-[#171717]">Evolução Diária de Agendamentos</h4>
            <p className="text-xs text-[#6B6B6B] mb-4">
              Faturamento e volume diário captado de forma autônoma
            </p>
            {bookingsDailySeries.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-xs text-[#6B6B6B] gap-2">
                <CalendarCheck2 className="w-7 h-7 text-[#B89B5E]" />
                <span>Ative o Agendamento Automático para acompanhar a curva diária aqui.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onJumpToSection('scheduling')}
                  className="mt-1 h-9 text-xs"
                >
                  Configurar Agendamento IA
                </Button>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bookingsDailySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                    <XAxis dataKey="data" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} />
                    <Tooltip formatter={(v: number, name: string) => [name === 'faturamento' ? formatBRL(v) : v, name === 'faturamento' ? 'Faturamento' : 'Agendamentos']} />
                    <Area
                      type="monotone"
                      dataKey="faturamento"
                      stroke="#B89B5E"
                      fill="#B89B5E"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMADOS TAB */}
      {subTab === 'confirmed' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 bg-white border border-[#E5E2DC] rounded-2xl p-6 flex flex-col justify-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Agendamentos Confirmados
              </span>
              <p className="text-4xl font-semibold text-[#171717] mt-2 tabular-nums">
                {confirmedAppts.length}
              </p>
              <p className="text-xs text-[#6B6B6B] mt-2">
                {confirmationDispatches.length} disparo(s) de confirmação registrados no período.
              </p>
            </div>

            <div className="lg:col-span-8 bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#171717]">
                Crescimento Diário de Confirmações
              </h4>
              <p className="text-xs text-[#6B6B6B] mb-3">
                Quantidade de clientes confirmados por dia
              </p>
              {confirmationsDailySeries.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-[#6B6B6B]">
                  Nenhuma confirmação registrada neste período.
                </div>
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={confirmationsDailySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                      <XAxis dataKey="data" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="confirmados"
                        name="Confirmados"
                        stroke="#16A34A"
                        fill="#16A34A"
                        fillOpacity={0.14}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#171717]">
                Quando seus clientes mais confirmam
              </h4>
              <p className="text-xs text-[#6B6B6B] mb-3">Volume por dia da semana</p>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={confirmationsByWeekday}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                    <XAxis dataKey="dia" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="Confirmados" fill="#171717" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#171717]">Confirmações por Horário</h4>
              <p className="text-xs text-[#6B6B6B] mb-3">Faixas horárias de resposta e agenda</p>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={confirmationsByHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                    <XAxis dataKey="hora" stroke="#6B6B6B" fontSize={10} tickLine={false} />
                    <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="Confirmados" fill="#B89B5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MARKETING TAB */}
      {subTab === 'marketing' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Mensagens Enviadas
                </span>
                <p className="text-2xl font-semibold text-[#171717] mt-1 tabular-nums">
                  {marketingDispatches.length}
                </p>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                  Réguas de retorno, aniversário e promoções
                </p>
              </div>
              {marketingByType.length > 0 && (
                <div className="w-16 h-16 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={marketingByType}
                        dataKey="value"
                        innerRadius={18}
                        outerRadius={30}
                        paddingAngle={2}
                      >
                        {marketingByType.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Receita Gerada Após Disparo
              </span>
              <p className="text-2xl font-semibold text-[#171717] mt-1.5 tabular-nums">
                {formatBRL(marketingRecoveredRevenue)}
              </p>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5">Retorno financeiro atribuído</p>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Clientes Convertidos
              </span>
              <p className="text-2xl font-semibold text-[#171717] mt-1.5 tabular-nums">
                {marketingConverted.length}
              </p>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5">Agendaram após mensagem</p>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Taxa de Conversão
              </span>
              <p className="text-2xl font-semibold text-[#171717] mt-1.5 tabular-nums">
                {marketingConversionRate}%
              </p>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5">Conversões / total disparado</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#171717]">Disparos Realizados por Dia</h4>
              <p className="text-xs text-[#6B6B6B] mb-3">
                Distribuição diária entre Aniversário, Inativos, Retorno e Promoções
              </p>
              {marketingDailyChart.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-[#6B6B6B]">
                  Nenhum disparo de marketing registrado no período.
                </div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketingDailyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                      <XAxis dataKey="data" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="service_return" stackId="a" name="Retorno" fill="#B89B5E" />
                      <Bar dataKey="inactive_clients" stackId="a" name="Inativos" fill="#D97706" />
                      <Bar dataKey="birthday" stackId="a" name="Aniversário" fill="#0284C7" />
                      <Bar dataKey="promotion" stackId="a" name="Promoções" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#171717]">
                Clientes Convertidos ao Longo dos Dias
              </h4>
              <p className="text-xs text-[#6B6B6B] mb-3">
                Agendamentos confirmados após contato das campanhas
              </p>
              {marketingDailyChart.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-xs text-[#6B6B6B]">
                  Aguardando primeiras conversões no período.
                </div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={marketingDailyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                      <XAxis dataKey="data" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="converted" name="Convertidos" fill="#171717" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INATIVOS TAB */}
      {subTab === 'inactive' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Inativos Contatados (Período)
              </span>
              <p className="text-2xl font-semibold text-[#171717] mt-1.5 tabular-nums">
                {inactiveDispatches.length}
              </p>
            </div>
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Inativos Prontos para Resgate (+90d)
              </span>
              <p className="text-2xl font-semibold text-[#171717] mt-1.5 tabular-nums">
                {inactiveEligibleCandidates.length}
              </p>
            </div>
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Receita Recuperada
              </span>
              <p className="text-2xl font-semibold text-emerald-700 mt-1.5 tabular-nums">
                {formatBRL(inactiveRecoveredRevenue)}
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E2DC] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-[#171717]">
                  Histórico de Resgate de Clientes Inativos
                </h4>
                <p className="text-xs text-[#6B6B6B]">
                  Acompanhe contatos disparados e o tempo decorrido desde a última abordagem
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => onJumpToSection('marketing')}
                className="h-9 px-3.5 text-xs bg-[#171717] text-white rounded-xl gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Avaliar e Disparar Resgate
              </Button>
            </div>

            {inactiveDispatches.length === 0 ? (
              <div className="p-6 space-y-4">
                <p className="text-xs text-[#6B6B6B]">
                  Nenhum disparo de reativação registrado no período. Abaixo estão clientes sem visita há mais de 90 dias prontos para abordagem:
                </p>
                {inactiveEligibleCandidates.length === 0 ? (
                  <p className="text-xs text-[#6B6B6B] py-4 text-center">
                    Sua base não possui clientes sem retorno há +90 dias no momento.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-[#E5E2DC] rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B]">
                          <th className="py-2.5 px-4 font-semibold">Cliente</th>
                          <th className="py-2.5 px-4 font-semibold">Telefone</th>
                          <th className="py-2.5 px-4 font-semibold">Último Serviço</th>
                          <th className="py-2.5 px-4 font-semibold text-right">Dias Ausente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2DC]">
                        {inactiveEligibleCandidates.map((c) => (
                          <tr key={c.id} className="hover:bg-[#FAF9F7]">
                            <td className="py-2.5 px-4 font-medium text-[#171717]">{c.name}</td>
                            <td className="py-2.5 px-4 text-[#6B6B6B] tabular-nums">{c.phone}</td>
                            <td className="py-2.5 px-4 text-[#6B6B6B]">{c.lastService}</td>
                            <td className="py-2.5 px-4 text-right font-semibold text-amber-700 tabular-nums">
                              {c.daysAgo} dias
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B]">
                      <th className="py-2.5 px-4 font-semibold">Cliente</th>
                      <th className="py-2.5 px-4 font-semibold">Telefone</th>
                      <th className="py-2.5 px-4 font-semibold">Dias desde Disparo</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Receita Recuperada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC]">
                    {inactiveDispatches.map((d) => {
                      const daysSince = Math.max(
                        0,
                        Math.round((Date.now() - d.dispatchedAt) / 86400000)
                      );
                      return (
                        <tr key={d.id} className="hover:bg-[#FAF9F7]">
                          <td className="py-2.5 px-4 font-medium text-[#171717]">
                            {d.clientName}
                          </td>
                          <td className="py-2.5 px-4 text-[#6B6B6B] tabular-nums">
                            {d.clientPhone}
                          </td>
                          <td className="py-2.5 px-4 text-[#171717] tabular-nums">
                            {daysSince} dia(s)
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`font-medium ${
                                d.status === 'converted'
                                  ? 'text-emerald-700'
                                  : d.status === 'failed'
                                    ? 'text-rose-700'
                                    : 'text-[#8A6D36]'
                              }`}
                            >
                              {d.status === 'converted'
                                ? 'Agendou retorno'
                                : d.status === 'replied'
                                  ? 'Respondeu'
                                  : d.status === 'failed'
                                    ? 'Falhou'
                                    : 'Enviado'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-[#171717] tabular-nums">
                            {d.convertedRevenue ? formatBRL(d.convertedRevenue) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

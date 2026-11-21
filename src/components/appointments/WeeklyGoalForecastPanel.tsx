import React, { useMemo, useState } from 'react';
import {
  Target,
  TrendingUp,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Calendar,
  Sparkles,
  Users,
} from 'lucide-react';
import { Appointment, Professional, ProfessionalGoal, Service } from '@/types';
import {
  calculateGoalPredictability,
  generateDefaultWeeklySplits,
  getCalendarWeekRange,
  getMonthDateRange,
  normalizeGoal,
} from '@/lib/goals';
import { getAppointmentStatusMeta } from '@/services/appointmentsService';
import { formatBRL, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface WeeklyGoalForecastPanelProps {
  appointments: Appointment[];
  services: Service[];
  professionals: Professional[];
  goals: ProfessionalGoal[];
  selectedDate: string; // YYYY-MM-DD
  selectedProfessionalIds: string[]; // empty or all -> team view; 1 -> individual focus
  currentUserRole: string;
  onSelectAppointment?: (app: Appointment) => void;
  onRequestWhatsAppConfirmation?: (app: Appointment) => void;
  compact?: boolean;
  canViewGoals?: boolean;
}

function resolveProfessionalGoalForMonth(
  goals: ProfessionalGoal[],
  prof: Professional | undefined,
  monthStr: string
): number {
  if (!prof) return 0;
  const candidateIds = new Set(
    [prof.id, (prof as unknown as { userId?: string }).userId, (prof as unknown as { professionalId?: string }).professionalId, (prof as unknown as { linkedLegacyProfId?: string }).linkedLegacyProfId]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  );
  const matched = goals.find((g) => {
    const sameMonth = String(g.month || '').substring(0, 7) === monthStr;
    return sameMonth && candidateIds.has(g.professionalId);
  });
  if (!matched) return 0;
  return normalizeGoal(matched).targetValue || 0;
}

function resolveProfessionalWeeklyTarget(
  goals: ProfessionalGoal[],
  prof: Professional | undefined,
  monthStr: string,
  refDate: string
): { weeklyTarget: number; monthlyTarget: number; matchedGoal?: ProfessionalGoal } {
  if (!prof) return { weeklyTarget: 0, monthlyTarget: 0 };
  const candidateIds = new Set(
    [prof.id, (prof as unknown as { userId?: string }).userId, (prof as unknown as { professionalId?: string }).professionalId, (prof as unknown as { linkedLegacyProfId?: string }).linkedLegacyProfId]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  );
  const matched = goals.find((g) => {
    const sameMonth = String(g.month || '').substring(0, 7) === monthStr;
    return sameMonth && candidateIds.has(g.professionalId);
  });

  if (!matched) return { weeklyTarget: 0, monthlyTarget: 0 };
  const norm = normalizeGoal(matched);
  const splits =
    norm.weeklyGoals && norm.weeklyGoals.length > 0
      ? norm.weeklyGoals
      : generateDefaultWeeklySplits(monthStr, norm.targetValue);

  const matchingSplit =
    splits.find((w) => refDate >= w.startDate && refDate <= w.endDate) || splits[0];

  return {
    weeklyTarget: Number(matchingSplit?.targetAmount) || Math.round((norm.targetValue / 4) * 100) / 100,
    monthlyTarget: norm.targetValue,
    matchedGoal: matched,
  };
}

export const WeeklyGoalForecastPanel: React.FC<WeeklyGoalForecastPanelProps> = ({
  appointments,
  services,
  professionals,
  goals,
  selectedDate,
  selectedProfessionalIds,
  currentUserRole,
  onSelectAppointment,
  onRequestWhatsAppConfirmation,
  compact = false,
  canViewGoals = true,
}) => {
  const [showApptsList, setShowApptsList] = useState(false);
  const [showTeamBreakdown, setShowTeamBreakdown] = useState(false);
  const [periodFocus, setPeriodFocus] = useState<'week' | 'month'>('week');

  const safeDate = (selectedDate || new Date().toISOString().substring(0, 10)).substring(0, 10);
  const activeMonth = safeDate.substring(0, 7);
  const weekRange = useMemo(() => getCalendarWeekRange(safeDate), [safeDate]);
  const monthRange = useMemo(() => getMonthDateRange(activeMonth), [activeMonth]);

  const activePros = useMemo(() => {
    if (selectedProfessionalIds.length === 0) return professionals;
    const set = new Set(selectedProfessionalIds);
    const filtered = professionals.filter((p) => set.has(p.id));
    return filtered.length > 0 ? filtered : professionals;
  }, [professionals, selectedProfessionalIds]);

  const focusedPro = activePros.length === 1 ? activePros[0] : undefined;
  const activeProfIdsList = useMemo(
    () => (activePros.length > 0 ? activePros.map((p) => p.id) : null),
    [activePros]
  );

  const { weeklyTargetSum, monthlyTargetSum, perProRows } = useMemo(() => {
    let wSum = 0;
    let mSum = 0;
    const rows = activePros.map((prof) => {
      const { weeklyTarget, monthlyTarget } = resolveProfessionalWeeklyTarget(
        goals,
        prof,
        activeMonth,
        safeDate
      );
      wSum += weeklyTarget;
      mSum += monthlyTarget;
      const weekPred = calculateGoalPredictability(
        appointments,
        services,
        prof.id,
        weekRange.startDate,
        weekRange.endDate,
        weeklyTarget
      );
      return {
        professional: prof,
        weeklyTarget,
        monthlyTarget,
        weekPred,
      };
    });
    return { weeklyTargetSum: wSum, monthlyTargetSum: mSum, perProRows: rows };
  }, [activePros, goals, activeMonth, safeDate, appointments, services, weekRange.startDate, weekRange.endDate]);

  const weeklySummary = useMemo(
    () =>
      calculateGoalPredictability(
        appointments,
        services,
        activeProfIdsList,
        weekRange.startDate,
        weekRange.endDate,
        weeklyTargetSum
      ),
    [appointments, services, activeProfIdsList, weekRange.startDate, weekRange.endDate, weeklyTargetSum]
  );

  const monthlySummary = useMemo(
    () =>
      calculateGoalPredictability(
        appointments,
        services,
        activeProfIdsList,
        monthRange.startDate,
        monthRange.endDate,
        monthlyTargetSum
      ),
    [appointments, services, activeProfIdsList, monthRange.startDate, monthRange.endDate, monthlyTargetSum]
  );

  if (!canViewGoals) {
    return null;
  }

  const activeSummary = periodFocus === 'week' ? weeklySummary : monthlySummary;
  const hasTarget = activeSummary.targetAmount > 0;
  const isCoveredByAgenda = hasTarget && activeSummary.missingWithAgenda <= 0;

  // Stacked progress bar percentages capped neatly at 100
  const cap = (v: number) => Math.max(0, Math.min(100, v));
  const realizedBarPct = hasTarget
    ? cap((activeSummary.realizedRevenue / activeSummary.targetAmount) * 100)
    : 0;
  const confirmedBarPct = hasTarget
    ? cap(((activeSummary.realizedRevenue + activeSummary.confirmedScheduledRevenue) / activeSummary.targetAmount) * 100) - realizedBarPct
    : 0;
  const pendingBarPct = hasTarget
    ? cap((activeSummary.projectedTotalRevenue / activeSummary.targetAmount) * 100) - realizedBarPct - confirmedBarPct
    : 0;

  return (
    <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A6D36]">
              <Target className="w-3.5 h-3.5" />
              Previsibilidade de Meta
            </span>
            <span className="text-xs text-[#6B6B6B]">
              •{' '}
              {focusedPro
                ? focusedPro.name
                : currentUserRole === 'professional'
                  ? 'Minha Agenda'
                  : `Equipe (${activePros.length} ${activePros.length === 1 ? 'profissional' : 'profissionais'})`}
            </span>
            <span className="text-[11px] font-medium text-[#6B6B6B] bg-[#FAF9F7] border border-[#E5E2DC] px-2 py-0.5 rounded-md tabular-nums">
              {periodFocus === 'week'
                ? `Semana ${weekRange.label}`
                : `Mês ${activeMonth.slice(5, 7)}/${activeMonth.slice(0, 4)}`}
            </span>
          </div>

          <p className="text-xs text-[#6B6B6B]">
            Veja quanto já foi faturado, quanto está garantido na agenda e exatamente quanto falta para atingir a meta.
          </p>
        </div>

        {/* Toggle Semanal vs Mensal */}
        <div className="flex items-center gap-2 self-start lg:self-center">
          <div className="inline-flex bg-[#FAF9F7] p-1 rounded-xl border border-[#E5E2DC]">
            <button
              type="button"
              onClick={() => setPeriodFocus('week')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                periodFocus === 'week'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#6B6B6B] hover:text-[#171717]'
              )}
            >
              Semana ({weekRange.label})
            </button>
            <button
              type="button"
              onClick={() => setPeriodFocus('month')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                periodFocus === 'month'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#6B6B6B] hover:text-[#171717]'
              )}
            >
              Mês Completo
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className={cn('grid gap-3', compact ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-5')}>
        {/* Meta */}
        <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3 space-y-1">
          <span className="text-[11px] font-medium text-[#6B6B6B] block">
            {periodFocus === 'week' ? 'Meta da Semana' : 'Meta do Mês'}
          </span>
          <p className="text-base sm:text-lg font-bold text-[#171717] tabular-nums">
            {hasTarget ? formatBRL(activeSummary.targetAmount) : 'Sem meta'}
          </p>
          <span className="text-[11px] text-[#6B6B6B] block tabular-nums">
            {periodFocus === 'week' && monthlySummary.targetAmount > 0
              ? `Mensal: ${formatBRL(monthlySummary.targetAmount)}`
              : hasTarget
                ? `${activeSummary.projectedPercent.toFixed(0)}% previsto`
                : 'Defina em Metas'}
          </span>
        </div>

        {/* Realizado */}
        <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3 space-y-1">
          <span className="text-[11px] font-medium text-[#6B6B6B] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-700 inline-block" />
            Realizado
          </span>
          <p className="text-base sm:text-lg font-bold text-[#133A29] tabular-nums">
            {formatBRL(activeSummary.realizedRevenue)}
          </p>
          <span className="text-[11px] text-[#6B6B6B] block tabular-nums">
            {activeSummary.completedCount} concluído(s)
          </span>
        </div>

        {/* Confirmado na Agenda */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-1">
          <span className="text-[11px] font-medium text-emerald-900 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Confirmados na Agenda
          </span>
          <p className="text-base sm:text-lg font-bold text-emerald-800 tabular-nums">
            {formatBRL(activeSummary.confirmedScheduledRevenue)}
          </p>
          <span className="text-[11px] text-emerald-800/80 block tabular-nums">
            {activeSummary.confirmedCount} horário(s) garantido(s)
          </span>
        </div>

        {/* Aguardando Confirmação */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-1">
          <span className="text-[11px] font-medium text-amber-900 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            Aguardando Cliente
          </span>
          <p className="text-base sm:text-lg font-bold text-amber-800 tabular-nums">
            {formatBRL(activeSummary.pendingScheduledRevenue)}
          </p>
          <span className="text-[11px] text-amber-800/80 block tabular-nums">
            {activeSummary.pendingCount} a confirmar
          </span>
        </div>

        {/* Previsibilidade Total & Quanto Falta */}
        <div
          className={cn(
            'col-span-2 md:col-span-1 rounded-xl p-3 border space-y-1',
            isCoveredByAgenda
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-[#FAF9F7] border-[#B89B5E]/45'
          )}
        >
          <span className="text-[11px] font-semibold text-[#8A6D36] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            {isCoveredByAgenda ? 'Meta Coberta' : 'Falta p/ Meta'}
          </span>
          <p
            className={cn(
              'text-base sm:text-lg font-bold tabular-nums',
              isCoveredByAgenda ? 'text-emerald-800' : 'text-[#171717]'
            )}
          >
            {!hasTarget
              ? formatBRL(activeSummary.projectedTotalRevenue)
              : isCoveredByAgenda
                ? `+${formatBRL(activeSummary.surplusWithAgenda)}`
                : formatBRL(activeSummary.missingWithAgenda)}
          </p>
          <span className="text-[11px] text-[#6B6B6B] block tabular-nums">
            {!hasTarget
              ? 'Total previsto na agenda'
              : isCoveredByAgenda
                ? `Projeção: ${formatBRL(activeSummary.projectedTotalRevenue)}`
                : activeSummary.estimatedAppointmentsNeeded > 0
                  ? `~${activeSummary.estimatedAppointmentsNeeded} atend. restante(s)`
                  : `Falta faturar: ${formatBRL(activeSummary.missingRealized)}`}
          </span>
        </div>
      </div>

      {/* Stacked Predictability Progress Bar */}
      <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3.5 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[#171717] tabular-nums">
              Previsão Total ({periodFocus === 'week' ? 'Semana' : 'Mês'}):{' '}
              <span className="text-[#8A6D36]">{formatBRL(activeSummary.projectedTotalRevenue)}</span>
            </span>
            {hasTarget && (
              <span className="text-[#6B6B6B] tabular-nums">
                ({activeSummary.projectedPercent.toFixed(1)}% da meta • Realizado: {activeSummary.realizedPercent.toFixed(1)}%)
              </span>
            )}
          </div>

          {hasTarget && (
            <div className="text-xs font-medium">
              {isCoveredByAgenda ? (
                <span className="text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Agenda já cobre 100% da meta
                  {activeSummary.pendingScheduledRevenue > 0
                    ? ` (${formatBRL(activeSummary.pendingScheduledRevenue)} aguardando WhatsApp)`
                    : '!'}
                </span>
              ) : (
                <span className="text-[#8A6D36] inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Falta agendar {formatBRL(activeSummary.missingWithAgenda)} nesta {periodFocus === 'week' ? 'semana' : 'competência'}
                  {activeSummary.missingRealized > activeSummary.missingWithAgenda
                    ? ` (falta concluir ${formatBRL(activeSummary.missingRealized)})`
                    : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Visual Segmented Progress */}
        <div className="h-3 w-full bg-[#EAE7E0] rounded-full overflow-hidden flex">
          {realizedBarPct > 0 && (
            <div
              className="h-full bg-teal-700 transition-all duration-300"
              style={{ width: `${realizedBarPct}%` }}
              title={`Realizado: ${formatBRL(activeSummary.realizedRevenue)}`}
            />
          )}
          {confirmedBarPct > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${confirmedBarPct}%` }}
              title={`Confirmados na agenda: ${formatBRL(activeSummary.confirmedScheduledRevenue)}`}
            />
          )}
          {pendingBarPct > 0 && (
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${pendingBarPct}%` }}
              title={`Aguardando confirmação: ${formatBRL(activeSummary.pendingScheduledRevenue)}`}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6B6B6B]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-700" />
              Realizado ({formatBRL(activeSummary.realizedRevenue)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
              Confirmados ({formatBRL(activeSummary.confirmedScheduledRevenue)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
              A Confirmar ({formatBRL(activeSummary.pendingScheduledRevenue)})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {perProRows.length > 1 && (
              <button
                type="button"
                onClick={() => setShowTeamBreakdown((v) => !v)}
                className="inline-flex items-center gap-1 text-[#8A6D36] hover:text-[#171717] font-semibold cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                {showTeamBreakdown ? 'Ocultar por profissional' : 'Por profissional'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowApptsList((v) => !v)}
              className="inline-flex items-center gap-1 text-[#171717] hover:text-[#8A6D36] font-semibold cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              Ver agendamentos ({activeSummary.contributingAppointments.length})
              {showApptsList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Team Breakdown Table (when multiple pros selected) */}
      {showTeamBreakdown && perProRows.length > 1 && (
        <div className="border border-[#E5E2DC] rounded-xl overflow-hidden">
          <div className="bg-[#FAF9F7] px-3.5 py-2 border-b border-[#E5E2DC] text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
            Previsibilidade Semanal por Profissional ({weekRange.label})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAF9F7] text-[#6B6B6B] border-b border-[#E5E2DC]">
                <tr>
                  <th className="py-2 px-3 font-medium">Profissional</th>
                  <th className="py-2 px-3 font-medium text-right">Meta Semanal</th>
                  <th className="py-2 px-3 font-medium text-right">Realizado</th>
                  <th className="py-2 px-3 font-medium text-right">Na Agenda</th>
                  <th className="py-2 px-3 font-medium text-right">Previsão</th>
                  <th className="py-2 px-3 font-medium text-right">Falta Agendar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {perProRows.map(({ professional, weeklyTarget, weekPred }) => (
                  <tr key={professional.id} className="hover:bg-[#FAF9F7]">
                    <td className="py-2 px-3 font-medium text-[#171717]">{professional.name}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[#6B6B6B]">
                      {weeklyTarget > 0 ? formatBRL(weeklyTarget) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-[#133A29] font-medium">
                      {formatBRL(weekPred.realizedRevenue)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-700 font-medium">
                      {formatBRL(weekPred.scheduledTotalRevenue)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-[#171717]">
                      {formatBRL(weekPred.projectedTotalRevenue)}
                      {weeklyTarget > 0 && (
                        <span className="ml-1 text-[10px] text-[#6B6B6B]">
                          ({weekPred.projectedPercent.toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {weeklyTarget <= 0 ? (
                        <span className="text-[#6B6B6B]">-</span>
                      ) : weekPred.missingWithAgenda <= 0 ? (
                        <span className="text-emerald-700 font-semibold">Coberta</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">
                          {formatBRL(weekPred.missingWithAgenda)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expandable Appointments List contributing to the forecast */}
      {showApptsList && (
        <div className="border border-[#E5E2DC] rounded-xl overflow-hidden">
          <div className="bg-[#FAF9F7] px-3.5 py-2 border-b border-[#E5E2DC] flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
            <span>
              Agendamentos da {periodFocus === 'week' ? `Semana (${weekRange.label})` : `Competência (${activeMonth})`}
            </span>
            <span className="tabular-nums">{activeSummary.contributingAppointments.length} registro(s)</span>
          </div>
          {activeSummary.contributingAppointments.length === 0 ? (
            <div className="p-5 text-center text-xs text-[#6B6B6B]">
              Nenhum agendamento ativo encontrado neste período.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-[#E5E2DC]">
              {activeSummary.contributingAppointments.map((app: Appointment) => {
                const meta = getAppointmentStatusMeta(app);
                const priceVal = Number(app.price) || services.find((s) => s.id === app.serviceId)?.price || 0;
                const dParts = String(app.date || '').substring(0, 10).split('-');
                const brDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}` : app.date;
                return (
                  <div
                    key={app.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF9F7] text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAppointment?.(app)}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', meta.dotColor)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#171717] tabular-nums">
                            {brDate} {app.time}
                          </span>
                          <span className="font-medium text-[#171717] truncate">{app.clientName}</span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                              meta.badgeBg,
                              meta.badgeText,
                              meta.badgeBorder
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B6B6B] truncate">
                          {app.serviceName} • {app.professionalName}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-[#171717] tabular-nums">
                        {formatBRL(priceVal)}
                      </span>
                      {app.status === 'scheduled' && onRequestWhatsAppConfirmation && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => onRequestWhatsAppConfirmation(app)}
                          className="h-7 px-2 rounded-lg border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold gap-1"
                          title="Enviar confirmação no WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState, useEffect } from "react";
import {
  TrendingUp,
  Target,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  MessageCircle,
  Sparkles,
  Clock,
} from "lucide-react";
import { Appointment, Goal, Professional, ProfessionalGoal, Service } from "@/types";
import {
  calculateGoalPredictability,
  generateDefaultWeeklySplits,
  getCalendarWeekRange,
  getMonthDateRange,
  resolveProfessionalGoalTargets,
} from "@/lib/goals";
import { getAppointmentStatusMeta } from "@/services/appointmentsService";
import { formatBRL, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface GoalPredictabilityPanelProps {
  mode?: "team" | "professional";
  professionals: Professional[];
  appointments: Appointment[];
  services: Service[];
  goals: ProfessionalGoal[];
  salonGoals?: Goal[];
  selectedMonth: string; // YYYY-MM
  focusedProfessionalId?: string | null;
  onSelectProfessional?: (profId: string | null) => void;
  onRequestWhatsAppConfirmation?: (app: Appointment) => void;
  onOpenAppointment?: (app: Appointment) => void;
  title?: string;
}

function getLocalTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateBrShort(ymd: string): string {
  if (!ymd || ymd.length < 10) return ymd;
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

export const GoalPredictabilityPanel: React.FC<GoalPredictabilityPanelProps> = ({
  mode = "team",
  professionals,
  appointments,
  services,
  goals,
  salonGoals,
  selectedMonth,
  focusedProfessionalId = null,
  onSelectProfessional,
  onRequestWhatsAppConfirmation,
  onOpenAppointment,
  title,
}) => {
  const todayStr = getLocalTodayStr();
  const cleanMonth = (selectedMonth || todayStr.substring(0, 7)).substring(0, 7);
  const isCurrentMonth = cleanMonth === todayStr.substring(0, 7);

  const [internalProfId, setInternalProfId] = useState<string>(
    focusedProfessionalId || "all"
  );
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("calendar_current");
  const [showApptsDrawer, setShowApptsDrawer] = useState(false);

  useEffect(() => {
    if (focusedProfessionalId) {
      setInternalProfId(focusedProfessionalId);
    } else if (mode === "professional" && professionals.length === 1) {
      setInternalProfId(professionals[0].id);
    }
  }, [focusedProfessionalId, mode, professionals]);

  // If the user switches to a different month from current month, default to Semana 1 (or keep current week when in active month)
  useEffect(() => {
    if (isCurrentMonth) {
      setSelectedWeekKey("calendar_current");
    } else {
      setSelectedWeekKey("split_1");
    }
  }, [cleanMonth, isCurrentMonth]);

  const effectiveProfId =
    mode === "professional"
      ? focusedProfessionalId || professionals[0]?.id || "all"
      : internalProfId;

  const focusedProf = useMemo(() => {
    if (!effectiveProfId || effectiveProfId === "all") return undefined;
    return professionals.find((p) => p.id === effectiveProfId);
  }, [professionals, effectiveProfId]);

  const activePros = useMemo(() => {
    if (focusedProf) return [focusedProf];
    return professionals;
  }, [focusedProf, professionals]);

  const monthRange = useMemo(() => getMonthDateRange(cleanMonth), [cleanMonth]);
  const calendarWeek = useMemo(
    () => getCalendarWeekRange(isCurrentMonth ? todayStr : `${cleanMonth}-15`),
    [isCurrentMonth, todayStr, cleanMonth]
  );

  // Determine active Salon Goal if in salon tab
  const matchingSalonGoal = useMemo(() => {
    if (!salonGoals || salonGoals.length === 0) return undefined;
    return salonGoals.find((g) => String(g.month || "").substring(0, 7) === cleanMonth);
  }, [salonGoals, cleanMonth]);

  // Build selectable week options (Calendar Mon-Sun when in current month + Splits 1..4 of the month)
  const monthSplits = useMemo(() => {
    if (focusedProf) {
      const resolved = resolveProfessionalGoalTargets(goals, focusedProf, cleanMonth, todayStr);
      if (resolved.weeklySplits.length > 0) return resolved.weeklySplits;
    }
    if (matchingSalonGoal?.weeklyGoals && matchingSalonGoal.weeklyGoals.length > 0) {
      return matchingSalonGoal.weeklyGoals;
    }
    return generateDefaultWeeklySplits(cleanMonth, matchingSalonGoal?.targetAmount || 0);
  }, [focusedProf, goals, cleanMonth, todayStr, matchingSalonGoal]);

  const activeWeekWindow = useMemo(() => {
    if (selectedWeekKey === "calendar_current") {
      return {
        key: "calendar_current",
        label: `Semana Atual (${calendarWeek.label})`,
        shortLabel: calendarWeek.label,
        startDate: calendarWeek.startDate,
        endDate: calendarWeek.endDate,
        splitNumber: null as number | null,
      };
    }
    const splitNum = parseInt(selectedWeekKey.replace("split_", ""), 10) || 1;
    const matchedSplit = monthSplits.find((s) => s.weekNumber === splitNum) || monthSplits[0];
    return {
      key: `split_${matchedSplit.weekNumber}`,
      label: matchedSplit.label,
      shortLabel: `${formatDateBrShort(matchedSplit.startDate)} a ${formatDateBrShort(matchedSplit.endDate)}`,
      startDate: matchedSplit.startDate,
      endDate: matchedSplit.endDate,
      splitNumber: matchedSplit.weekNumber,
    };
  }, [selectedWeekKey, calendarWeek, monthSplits]);

  // Helper to compute exact metrics for 1 professional (used both for hero & team table)
  const computeProMetrics = useMemo(() => {
    return (prof: Professional) => {
      const refForWeeklyTarget = activeWeekWindow.startDate;
      const targets = resolveProfessionalGoalTargets(
        goals,
        prof,
        cleanMonth,
        refForWeeklyTarget
      );

      let weeklyTarget = targets.weeklyTarget;
      if (activeWeekWindow.splitNumber !== null) {
        const specificSplit = targets.weeklySplits.find(
          (w) => w.weekNumber === activeWeekWindow.splitNumber
        );
        if (specificSplit) {
          weeklyTarget = Number(specificSplit.targetAmount) || 0;
        }
      }

      const weeklyPred = calculateGoalPredictability(
        appointments,
        services,
        prof.id,
        activeWeekWindow.startDate,
        activeWeekWindow.endDate,
        weeklyTarget
      );

      const monthlyBasePred = calculateGoalPredictability(
        appointments,
        services,
        prof.id,
        monthRange.startDate,
        monthRange.endDate,
        targets.monthlyTarget
      );

      // Respect manual realized entries if higher than appointment completions alone
      const monthlyRealizedEffective = Math.max(
        monthlyBasePred.realizedRevenue,
        targets.manualMonthlyCurrent
      );
      const monthlyConfirmedTotalEffective =
        monthlyRealizedEffective + monthlyBasePred.confirmedScheduledRevenue;
      const monthlyMissingWithConfirmed = Math.max(
        0,
        targets.monthlyTarget - monthlyConfirmedTotalEffective
      );
      const monthlyMissingRealized = Math.max(
        0,
        targets.monthlyTarget - monthlyRealizedEffective
      );
      const monthlySurplusWithConfirmed = Math.max(
        0,
        monthlyConfirmedTotalEffective - targets.monthlyTarget
      );

      return {
        professional: prof,
        weeklyTarget,
        monthlyTarget: targets.monthlyTarget,
        weeklyPred,
        monthlyBasePred,
        monthlyRealizedEffective,
        monthlyConfirmedTotalEffective,
        monthlyMissingWithConfirmed,
        monthlyMissingRealized,
        monthlySurplusWithConfirmed,
      };
    };
  }, [appointments, services, goals, cleanMonth, activeWeekWindow, monthRange]);

  const perProMetrics = useMemo(
    () => activePros.map((p) => computeProMetrics(p)),
    [activePros, computeProMetrics]
  );

  // Aggregate metrics (when team view is "all", or directly matches focused pro, or uses salonGoal if provided)
  const aggregate = useMemo(() => {
    const activeIds = activePros.map((p) => p.id);

    let sumWeeklyTarget = perProMetrics.reduce((s, r) => s + r.weeklyTarget, 0);
    let sumMonthlyTarget = perProMetrics.reduce((s, r) => s + r.monthlyTarget, 0);
    let sumManualMonthly = perProMetrics.reduce((s, r) => s + r.monthlyRealizedEffective, 0);

    // If viewing Salon Goals tab with a configured general goal and "all" pros
    const useSalonGoalTarget =
      Boolean(matchingSalonGoal) && effectiveProfId === "all";

    if (useSalonGoalTarget && matchingSalonGoal) {
      sumMonthlyTarget = Number(matchingSalonGoal.targetAmount) || 0;
      const salonSplits =
        matchingSalonGoal.weeklyGoals && matchingSalonGoal.weeklyGoals.length > 0
          ? matchingSalonGoal.weeklyGoals
          : generateDefaultWeeklySplits(cleanMonth, sumMonthlyTarget);
      const matchedSplit =
        activeWeekWindow.splitNumber !== null
          ? salonSplits.find((w) => w.weekNumber === activeWeekWindow.splitNumber)
          : salonSplits.find(
              (w) => todayStr >= w.startDate && todayStr <= w.endDate
            ) || salonSplits[0];
      sumWeeklyTarget =
        Number(matchedSplit?.targetAmount) ||
        Math.round((sumMonthlyTarget / 4) * 100) / 100;
    }

    const profFilterIds = effectiveProfId === "all" ? null : activeIds;

    const weeklySummary = calculateGoalPredictability(
      appointments,
      services,
      profFilterIds,
      activeWeekWindow.startDate,
      activeWeekWindow.endDate,
      sumWeeklyTarget
    );

    const monthlyRaw = calculateGoalPredictability(
      appointments,
      services,
      profFilterIds,
      monthRange.startDate,
      monthRange.endDate,
      sumMonthlyTarget
    );

    const salonCurrent =
      useSalonGoalTarget && matchingSalonGoal
        ? Number(matchingSalonGoal.currentAmount) || 0
        : sumManualMonthly;

    const monthlyRealizedEffective = Math.max(
      monthlyRaw.realizedRevenue,
      salonCurrent
    );
    const monthlyConfirmedTotal =
      monthlyRealizedEffective + monthlyRaw.confirmedScheduledRevenue;
    const monthlyProjectedAll =
      monthlyConfirmedTotal + monthlyRaw.pendingScheduledRevenue;

    const monthlyMissingWithConfirmed = Math.max(
      0,
      sumMonthlyTarget - monthlyConfirmedTotal
    );
    const monthlyMissingRealized = Math.max(
      0,
      sumMonthlyTarget - monthlyRealizedEffective
    );
    const monthlySurplusWithConfirmed = Math.max(
      0,
      monthlyConfirmedTotal - sumMonthlyTarget
    );

    const monthlyRealizedPct =
      sumMonthlyTarget > 0
        ? Math.round((monthlyRealizedEffective / sumMonthlyTarget) * 1000) / 10
        : 0;
    const monthlyConfirmedPct =
      sumMonthlyTarget > 0
        ? Math.round((monthlyConfirmedTotal / sumMonthlyTarget) * 1000) / 10
        : 0;

    return {
      weeklyTarget: sumWeeklyTarget,
      monthlyTarget: sumMonthlyTarget,
      weeklySummary,
      monthlyRaw,
      monthlyRealizedEffective,
      monthlyConfirmedTotal,
      monthlyProjectedAll,
      monthlyMissingWithConfirmed,
      monthlyMissingRealized,
      monthlySurplusWithConfirmed,
      monthlyRealizedPct,
      monthlyConfirmedPct,
    };
  }, [
    activePros,
    perProMetrics,
    matchingSalonGoal,
    effectiveProfId,
    cleanMonth,
    activeWeekWindow,
    todayStr,
    appointments,
    services,
    monthRange,
  ]);

  const { weeklySummary } = aggregate;
  const hasWeeklyTarget = aggregate.weeklyTarget > 0;
  const hasMonthlyTarget = aggregate.monthlyTarget > 0;

  const isWeeklyGuaranteed =
    hasWeeklyTarget && weeklySummary.missingWithConfirmed <= 0;
  const isMonthlyGuaranteed =
    hasMonthlyTarget && aggregate.monthlyMissingWithConfirmed <= 0;

  // Stacked bar helpers
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const wRealizedPct = hasWeeklyTarget
    ? clamp((weeklySummary.realizedRevenue / aggregate.weeklyTarget) * 100)
    : 0;
  const wConfirmedPct = hasWeeklyTarget
    ? clamp((weeklySummary.confirmedTotalRevenue / aggregate.weeklyTarget) * 100) - wRealizedPct
    : 0;
  const wPendingPct = hasWeeklyTarget
    ? clamp((weeklySummary.projectedTotalRevenue / aggregate.weeklyTarget) * 100) -
      wRealizedPct -
      wConfirmedPct
    : 0;

  const handleSelectProf = (val: string) => {
    setInternalProfId(val);
    onSelectProfessional?.(val === "all" ? null : val);
  };

  const monthLabelBR = `${cleanMonth.slice(5, 7)}/${cleanMonth.slice(0, 4)}`;

  return (
    <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 sm:p-5 shadow-xs space-y-5">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-[#E5E2DC]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A6D36] bg-[#FAF9F7] border border-[#E5E2DC] px-2.5 py-0.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              Previsibilidade • Base Confirmados
            </span>
            <span className="text-xs font-medium text-[#6B6B6B]">
              {focusedProf
                ? focusedProf.name
                : matchingSalonGoal && effectiveProfId === "all"
                  ? `Salão (${activePros.length} profissionais)`
                  : `Equipe (${activePros.length} profissionais)`}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-heading font-semibold text-[#171717]">
            {title || "Faturamento Projetado da Semana & Saldo de Metas"}
          </h3>
          <p className="text-xs text-[#6B6B6B]">
            Soma os atendimentos já concluídos com os agendamentos confirmados da semana para mostrar exatamente quanto falta para atingir a meta semanal e mensal.
          </p>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {mode === "team" && professionals.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl px-2.5 h-9">
              <User className="w-3.5 h-3.5 text-[#8A6D36] shrink-0" />
              <select
                value={effectiveProfId}
                onChange={(e) => handleSelectProf(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#171717] focus:outline-none cursor-pointer pr-1"
                aria-label="Filtrar profissional na previsibilidade"
              >
                <option value="all">Toda a Equipe ({professionals.length})</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl px-2.5 h-9">
            <Calendar className="w-3.5 h-3.5 text-[#8A6D36] shrink-0" />
            <select
              value={activeWeekWindow.key}
              onChange={(e) => setSelectedWeekKey(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#171717] focus:outline-none cursor-pointer pr-1"
              aria-label="Selecionar semana da previsibilidade"
            >
              {isCurrentMonth && (
                <option value="calendar_current">
                  Semana Atual ({calendarWeek.label})
                </option>
              )}
              {monthSplits.map((w) => (
                <option key={w.weekNumber} value={`split_${w.weekNumber}`}>
                  Semana {w.weekNumber} ({formatDateBrShort(w.startDate)} a{" "}
                  {formatDateBrShort(w.endDate)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3 Primary Highlight Cards: Weekly Projected (Confirmed) | Missing Weekly | Missing Monthly */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Faturamento Projetado da Semana (Confirmados) */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Projetado na Semana
              </span>
              <span className="text-[10px] font-semibold text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-full tabular-nums">
                {activeWeekWindow.shortLabel}
              </span>
            </div>

            <p className="text-2xl sm:text-3xl font-bold text-emerald-900 tabular-nums pt-0.5">
              {formatBRL(weeklySummary.confirmedTotalRevenue)}
            </p>
            <p className="text-[11px] text-emerald-800/85">
              Base: Concluídos + Agendamentos Confirmados
            </p>
          </div>

          <div className="bg-white/90 border border-emerald-200/80 rounded-xl p-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#6B6B6B] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-700" />
                Já realizado ({weeklySummary.completedCount})
              </span>
              <span className="font-semibold text-[#171717] tabular-nums">
                {formatBRL(weeklySummary.realizedRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6B6B6B] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Confirmados ({weeklySummary.confirmedCount})
              </span>
              <span className="font-semibold text-emerald-700 tabular-nums">
                +{formatBRL(weeklySummary.confirmedScheduledRevenue)}
              </span>
            </div>
            {weeklySummary.pendingScheduledRevenue > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-[#E5E2DC] text-[11px]">
                <span className="text-amber-800 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  A confirmar ({weeklySummary.pendingCount})
                </span>
                <span className="font-semibold text-amber-700 tabular-nums">
                  +{formatBRL(weeklySummary.pendingScheduledRevenue)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Quanto Falta para Meta Semanal */}
        <div
          className={cn(
            "rounded-2xl p-4 border flex flex-col justify-between space-y-3",
            isWeeklyGuaranteed
              ? "bg-emerald-50/40 border-emerald-300"
              : "bg-[#FAF9F7] border-[#E5E2DC]"
          )}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6D36] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Falta p/ Meta Semanal
              </span>
              {hasWeeklyTarget && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums",
                    isWeeklyGuaranteed
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-white text-[#171717] border-[#E5E2DC]"
                  )}
                >
                  {weeklySummary.confirmedPercent.toFixed(0)}% garantido
                </span>
              )}
            </div>

            {!hasWeeklyTarget ? (
              <p className="text-lg font-semibold text-[#6B6B6B] pt-1">
                Meta semanal não definida
              </p>
            ) : isWeeklyGuaranteed ? (
              <div className="pt-0.5">
                <p className="text-xl sm:text-2xl font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  Meta Garantida!
                </p>
                <p className="text-xs font-medium text-emerald-700 mt-0.5 tabular-nums">
                  +{formatBRL(weeklySummary.surplusWithConfirmed)} acima da meta semanal
                </p>
              </div>
            ) : (
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-[#171717] tabular-nums pt-0.5">
                  {formatBRL(weeklySummary.missingWithConfirmed)}
                </p>
                <p className="text-[11px] text-[#6B6B6B]">
                  {weeklySummary.estimatedConfirmedAppointmentsNeeded > 0
                    ? `~${weeklySummary.estimatedConfirmedAppointmentsNeeded} atendimento(s) confirmado(s) para bater`
                    : "Diferença considerando realizado + confirmados"}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {hasWeeklyTarget && (
              <div className="space-y-1">
                <div className="h-2.5 w-full bg-[#EAE7E0] rounded-full overflow-hidden flex">
                  {wRealizedPct > 0 && (
                    <div
                      className="h-full bg-teal-700 transition-all duration-300"
                      style={{ width: `${wRealizedPct}%` }}
                    />
                  )}
                  {wConfirmedPct > 0 && (
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${wConfirmedPct}%` }}
                    />
                  )}
                  {wPendingPct > 0 && (
                    <div
                      className="h-full bg-amber-300 transition-all duration-300"
                      style={{ width: `${wPendingPct}%` }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#6B6B6B] tabular-nums">
                  <span>Meta semanal: {formatBRL(aggregate.weeklyTarget)}</span>
                  <span>
                    Falta faturar: <strong>{formatBRL(weeklySummary.missingRealized)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Quanto Falta para Meta Mensal */}
        <div
          className={cn(
            "rounded-2xl p-4 border flex flex-col justify-between space-y-3",
            isMonthlyGuaranteed
              ? "bg-emerald-50/40 border-emerald-300"
              : "bg-[#FAF9F7] border-[#E5E2DC]"
          )}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6D36] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Falta p/ Meta Mensal
              </span>
              {hasMonthlyTarget && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums",
                    isMonthlyGuaranteed
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-white text-[#171717] border-[#E5E2DC]"
                  )}
                >
                  {aggregate.monthlyConfirmedPct.toFixed(0)}% previsto
                </span>
              )}
            </div>

            {!hasMonthlyTarget ? (
              <p className="text-lg font-semibold text-[#6B6B6B] pt-1">
                Meta mensal ({monthLabelBR}) não definida
              </p>
            ) : isMonthlyGuaranteed ? (
              <div className="pt-0.5">
                <p className="text-xl sm:text-2xl font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  Meta Mensal Garantida!
                </p>
                <p className="text-xs font-medium text-emerald-700 mt-0.5 tabular-nums">
                  +{formatBRL(aggregate.monthlySurplusWithConfirmed)} de superávit previsto
                </p>
              </div>
            ) : (
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-[#171717] tabular-nums pt-0.5">
                  {formatBRL(aggregate.monthlyMissingWithConfirmed)}
                </p>
                <p className="text-[11px] text-[#6B6B6B] tabular-nums">
                  Projetado c/ confirmados do mês:{" "}
                  <strong className="text-[#171717]">
                    {formatBRL(aggregate.monthlyConfirmedTotal)}
                  </strong>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {hasMonthlyTarget && (
              <div className="space-y-1">
                <div className="h-2.5 w-full bg-[#EAE7E0] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-teal-700 transition-all duration-300"
                    style={{ width: `${clamp(aggregate.monthlyRealizedPct)}%` }}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${Math.max(
                        0,
                        clamp(aggregate.monthlyConfirmedPct) - clamp(aggregate.monthlyRealizedPct)
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#6B6B6B] tabular-nums">
                  <span>Meta {monthLabelBR}: {formatBRL(aggregate.monthlyTarget)}</span>
                  <span>
                    Falta faturar: <strong>{formatBRL(aggregate.monthlyMissingRealized)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Breakdown Matrix (when viewing Whole Team in Manager view) */}
      {mode === "team" && effectiveProfId === "all" && perProMetrics.length > 0 && (
        <div className="border border-[#E5E2DC] rounded-xl overflow-hidden">
          <div className="bg-[#FAF9F7] px-4 py-2.5 border-b border-[#E5E2DC] flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#8A6D36]" />
              Previsibilidade Individual • Semana {activeWeekWindow.shortLabel} & Mês {monthLabelBR}
            </span>
            <span className="text-[11px] text-[#6B6B6B]">
              Clique em um profissional para focar os cards acima
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[10px] uppercase tracking-wider text-[#6B6B6B]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Profissional</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Projetado Semana (Confirm.)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Meta Semanal</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Falta Meta Semanal</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Meta Mensal</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Falta Meta Mensal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {perProMetrics.map((row) => {
                  const wHit =
                    row.weeklyTarget > 0 && row.weeklyPred.missingWithConfirmed <= 0;
                  const mHit =
                    row.monthlyTarget > 0 && row.monthlyMissingWithConfirmed <= 0;
                  return (
                    <tr
                      key={row.professional.id}
                      onClick={() => handleSelectProf(row.professional.id)}
                      className="hover:bg-[#FAF9F7] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#171717]">
                          {row.professional.name}
                        </div>
                        <div className="text-[10px] text-[#6B6B6B]">
                          Realizado: {formatBRL(row.weeklyPred.realizedRevenue)} • Confirm.:{" "}
                          {formatBRL(row.weeklyPred.confirmedScheduledRevenue)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-800 tabular-nums">
                        {formatBRL(row.weeklyPred.confirmedTotalRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#6B6B6B] tabular-nums">
                        {row.weeklyTarget > 0 ? formatBRL(row.weeklyTarget) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {row.weeklyTarget <= 0 ? (
                          <span className="text-[#6B6B6B]">—</span>
                        ) : wHit ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Garantida
                          </span>
                        ) : (
                          <span className="font-semibold text-[#171717]">
                            {formatBRL(row.weeklyPred.missingWithConfirmed)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#6B6B6B] tabular-nums">
                        {row.monthlyTarget > 0 ? formatBRL(row.monthlyTarget) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {row.monthlyTarget <= 0 ? (
                          <span className="text-[#6B6B6B]">—</span>
                        ) : mHit ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Garantida
                          </span>
                        ) : (
                          <span className="font-semibold text-[#171717]">
                            {formatBRL(row.monthlyMissingWithConfirmed)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expandable Weekly Appointments Drawer */}
      <div className="pt-1 flex items-center justify-between flex-wrap gap-2 border-t border-[#E5E2DC]">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6B6B6B]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-700" />
            Concluídos ({weeklySummary.completedCount})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
            Confirmados ({weeklySummary.confirmedCount})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
            A Confirmar ({weeklySummary.pendingCount})
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowApptsDrawer((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717] hover:text-[#8A6D36] cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
          {showApptsDrawer ? "Ocultar atendimentos da semana" : `Ver atendimentos da semana (${weeklySummary.contributingAppointments.length})`}
          {showApptsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showApptsDrawer && (
        <div className="border border-[#E5E2DC] rounded-xl overflow-hidden">
          {weeklySummary.contributingAppointments.length === 0 ? (
            <div className="p-5 text-center text-xs text-[#6B6B6B]">
              Nenhum agendamento registrado para esta semana.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E2DC]">
              {weeklySummary.contributingAppointments.map((app: Appointment) => {
                const meta = getAppointmentStatusMeta(app);
                const priceVal =
                  Number(app.price) ||
                  services.find((s) => s.id === app.serviceId)?.price ||
                  0;
                const dParts = String(app.date || "").substring(0, 10).split("-");
                const brDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}` : app.date;
                const isIncludedInConfirmed =
                  app.status === "completed" ||
                  app.status === "confirmed" ||
                  app.status === "waiting" ||
                  app.status === "in_service";
                return (
                  <div
                    key={app.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF9F7] text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenAppointment?.(app)}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", meta.dotColor)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#171717] tabular-nums">
                            {brDate} {app.time}
                          </span>
                          <span className="font-medium text-[#171717] truncate">
                            {app.clientName}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                              meta.badgeBg,
                              meta.badgeText,
                              meta.badgeBorder
                            )}
                          >
                            {meta.label}
                          </span>
                          {!isIncludedInConfirmed && (
                            <span className="text-[10px] text-amber-700 font-medium">
                              (não somado à base confirmada)
                            </span>
                          )}
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
                      {app.status === "scheduled" && onRequestWhatsAppConfirmation && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => onRequestWhatsAppConfirmation(app)}
                          className="h-7 px-2 rounded-lg border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold gap-1"
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

import { WeeklyGoalSplit } from '../types';

export interface NormalizedGoal {
  id: string;
  professionalId?: string;
  professionalName?: string;
  targetValue: number;
  currentValue: number;
  period: string; // "mensal" | "semanal" | "diaria"
  month: string;  // "YYYY-MM"
  startDate: Date;
  endDate: Date;
  weeklyGoals?: WeeklyGoalSplit[];
  weeklyDistributionMode?: 'equal' | 'custom';
  createdAt?: any;
  updatedAt?: any;
  title?: string;
  scope?: string;
  lastProgressUpdateAt?: any;
  lastProgressUpdatedBy?: string;
}

export function generateDefaultWeeklySplits(monthStr: string, totalTarget: number): WeeklyGoalSplit[] {
  let cleanMonth = monthStr || new Date().toISOString().substring(0, 7);
  if (cleanMonth.length > 7) cleanMonth = cleanMonth.substring(0, 7);

  const parts = cleanMonth.split('-');
  const year = parseInt(parts[0]) || new Date().getFullYear();
  const monthIdx = (parseInt(parts[1]) || (new Date().getMonth() + 1)) - 1;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();

  const total = Number(totalTarget) || 0;
  const splitAmount = total > 0 ? Math.round((total / 4) * 100) / 100 : 0;
  const lastWeekAmount = total > 0 ? Math.max(0, Math.round((total - (splitAmount * 3)) * 100) / 100) : 0;

  const mStr = String(monthIdx + 1).padStart(2, '0');

  return [
    {
      weekNumber: 1,
      label: `Semana 1 (01/${mStr} a 07/${mStr})`,
      startDate: `${year}-${mStr}-01`,
      endDate: `${year}-${mStr}-07`,
      targetAmount: splitAmount,
    },
    {
      weekNumber: 2,
      label: `Semana 2 (08/${mStr} a 14/${mStr})`,
      startDate: `${year}-${mStr}-08`,
      endDate: `${year}-${mStr}-14`,
      targetAmount: splitAmount,
    },
    {
      weekNumber: 3,
      label: `Semana 3 (15/${mStr} a 21/${mStr})`,
      startDate: `${year}-${mStr}-15`,
      endDate: `${year}-${mStr}-21`,
      targetAmount: splitAmount,
    },
    {
      weekNumber: 4,
      label: `Semana 4 (22/${mStr} a ${String(lastDay).padStart(2, '0')}/${mStr})`,
      startDate: `${year}-${mStr}-22`,
      endDate: `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`,
      targetAmount: lastWeekAmount,
    },
  ];
}

export function getCurrentWeekIndex(weeks: WeeklyGoalSplit[], refDate: Date = new Date()): number {
  if (!weeks || weeks.length === 0) return 0;
  const todayStr = refDate.toISOString().substring(0, 10);

  const matchIdx = weeks.findIndex(w => todayStr >= w.startDate && todayStr <= w.endDate);
  if (matchIdx !== -1) return matchIdx;

  if (todayStr < weeks[0].startDate) return 0;
  return weeks.length - 1;
}

export interface CalendarWeekRange {
  startDate: string; // YYYY-MM-DD (Monday)
  endDate: string;   // YYYY-MM-DD (Sunday)
  label: string;
  days: string[];    // 7 YYYY-MM-DD strings Mon -> Sun
}

function toYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCalendarWeekRange(refDateStr?: string): CalendarWeekRange {
  const base = refDateStr
    ? new Date(`${refDateStr.substring(0, 10)}T12:00:00`)
    : new Date();
  const safeBase = isNaN(base.getTime()) ? new Date() : base;
  const day = safeBase.getDay(); // 0=Sun, 1=Mon...6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(safeBase);
  monday.setDate(safeBase.getDate() + diffToMonday);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toYmdLocal(d));
  }

  const startDate = days[0];
  const endDate = days[6];
  const fmtShort = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

  return {
    startDate,
    endDate,
    label: `${fmtShort(startDate)} a ${fmtShort(endDate)}`,
    days,
  };
}

export function getMonthDateRange(monthStr?: string): { startDate: string; endDate: string; month: string } {
  const clean = (monthStr && monthStr.length >= 7)
    ? monthStr.substring(0, 7)
    : toYmdLocal(new Date()).substring(0, 7);
  const [yStr, mStr] = clean.split('-');
  const year = parseInt(yStr, 10) || new Date().getFullYear();
  const monthIdx = (parseInt(mStr, 10) || (new Date().getMonth() + 1)) - 1;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const mm = String(monthIdx + 1).padStart(2, '0');
  return {
    month: `${year}-${mm}`,
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function resolveAppointmentPrice(app: any, services: any[]): number {
  if (app?.isBlock || app?.status === 'blocked') return 0;
  if (app?.price !== undefined && app?.price !== null && app?.price !== '') {
    return Number(app.price) || 0;
  }
  const srv = services.find((s) => s.id === app?.serviceId);
  return Number(srv?.price) || 0;
}

export interface GoalPredictabilitySummary {
  targetAmount: number;
  realizedRevenue: number;
  confirmedScheduledRevenue: number;
  pendingScheduledRevenue: number;
  scheduledTotalRevenue: number;
  confirmedTotalRevenue: number; // realized + confirmed (base confirmados)
  projectedTotalRevenue: number; // realized + confirmed + pending
  missingRealized: number;       // target - realized
  missingWithConfirmed: number;  // target - confirmedTotalRevenue
  surplusWithConfirmed: number;  // max(0, confirmedTotalRevenue - target)
  missingWithAgenda: number;     // target - projectedTotalRevenue (gap to still book)
  surplusWithAgenda: number;     // max(0, projectedTotalRevenue - target)
  realizedPercent: number;
  confirmedPercent: number;
  projectedPercent: number;
  completedCount: number;
  confirmedCount: number;
  pendingCount: number;
  activeAppointmentsCount: number;
  averageTicket: number;
  estimatedAppointmentsNeeded: number;
  estimatedConfirmedAppointmentsNeeded: number;
  contributingAppointments: any[];
}

export function calculateGoalPredictability(
  appointments: any[],
  services: any[],
  profIds: string | string[] | null,
  startDate: string,
  endDate: string,
  targetAmount: number
): GoalPredictabilitySummary {
  const target = Math.max(0, Number(targetAmount) || 0);
  const profIdSet = Array.isArray(profIds)
    ? new Set(profIds.filter(Boolean))
    : profIds
      ? new Set([profIds])
      : null;

  const relevant = (appointments || [])
    .filter((app) => {
      if (!app || app.isBlock || app.status === 'blocked' || app.status === 'canceled' || app.status === 'no_show') {
        return false;
      }
      const matchProf = !profIdSet || profIdSet.has(app.professionalId);
      const appDate = app.date ? String(app.date).substring(0, 10) : '';
      return matchProf && appDate >= startDate && appDate <= endDate;
    })
    .sort((a, b) => {
      const ka = `${String(a.date || '').substring(0, 10)}T${a.time || '00:00'}`;
      const kb = `${String(b.date || '').substring(0, 10)}T${b.time || '00:00'}`;
      return ka.localeCompare(kb);
    });

  let realizedRevenue = 0;
  let confirmedScheduledRevenue = 0;
  let pendingScheduledRevenue = 0;
  let completedCount = 0;
  let confirmedCount = 0;
  let pendingCount = 0;

  for (const app of relevant) {
    const val = resolveAppointmentPrice(app, services);
    if (app.status === 'completed') {
      realizedRevenue += val;
      completedCount += 1;
    } else if (app.status === 'confirmed' || app.status === 'in_service' || app.status === 'waiting') {
      confirmedScheduledRevenue += val;
      confirmedCount += 1;
    } else {
      // scheduled
      pendingScheduledRevenue += val;
      pendingCount += 1;
    }
  }

  const scheduledTotalRevenue = confirmedScheduledRevenue + pendingScheduledRevenue;
  const confirmedTotalRevenue = realizedRevenue + confirmedScheduledRevenue;
  const projectedTotalRevenue = realizedRevenue + scheduledTotalRevenue;

  const missingRealized = Math.max(0, target - realizedRevenue);
  const missingWithConfirmed = Math.max(0, target - confirmedTotalRevenue);
  const surplusWithConfirmed = Math.max(0, confirmedTotalRevenue - target);
  const missingWithAgenda = Math.max(0, target - projectedTotalRevenue);
  const surplusWithAgenda = Math.max(0, projectedTotalRevenue - target);

  const realizedPercent = target > 0 ? Math.round((realizedRevenue / target) * 1000) / 10 : 0;
  const confirmedPercent = target > 0 ? Math.round((confirmedTotalRevenue / target) * 1000) / 10 : 0;
  const projectedPercent = target > 0 ? Math.round((projectedTotalRevenue / target) * 1000) / 10 : 0;

  const activeAppointmentsCount = relevant.length;
  const averageTicket = activeAppointmentsCount > 0
    ? projectedTotalRevenue / activeAppointmentsCount
    : (services.length > 0
      ? services.reduce((s, srv) => s + (Number(srv?.price) || 0), 0) / services.length
      : 0);

  const estimatedAppointmentsNeeded = missingWithAgenda > 0 && averageTicket > 0
    ? Math.ceil(missingWithAgenda / averageTicket)
    : 0;
  const estimatedConfirmedAppointmentsNeeded = missingWithConfirmed > 0 && averageTicket > 0
    ? Math.ceil(missingWithConfirmed / averageTicket)
    : 0;

  return {
    targetAmount: target,
    realizedRevenue,
    confirmedScheduledRevenue,
    pendingScheduledRevenue,
    scheduledTotalRevenue,
    confirmedTotalRevenue,
    projectedTotalRevenue,
    missingRealized,
    missingWithConfirmed,
    surplusWithConfirmed,
    missingWithAgenda,
    surplusWithAgenda,
    realizedPercent,
    confirmedPercent,
    projectedPercent,
    completedCount,
    confirmedCount,
    pendingCount,
    activeAppointmentsCount,
    averageTicket,
    estimatedAppointmentsNeeded,
    estimatedConfirmedAppointmentsNeeded,
    contributingAppointments: relevant,
  };
}

export interface ResolvedProfessionalGoalTargets {
  monthlyTarget: number;
  manualMonthlyCurrent: number;
  weeklyTarget: number;
  weeklySplit?: WeeklyGoalSplit;
  weeklySplits: WeeklyGoalSplit[];
  matchedGoal?: any;
}

export function resolveProfessionalGoalTargets(
  goals: any[],
  prof: any | undefined,
  monthStr: string,
  refDate: string
): ResolvedProfessionalGoalTargets {
  if (!prof) {
    return { monthlyTarget: 0, manualMonthlyCurrent: 0, weeklyTarget: 0, weeklySplits: [] };
  }
  const candidateIds = new Set(
    [prof.id, prof.userId, prof.professionalId, prof.linkedLegacyProfId]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  );
  const matched = (goals || []).find((g) => {
    const sameMonth = String(g?.month || '').substring(0, 7) === monthStr;
    return sameMonth && candidateIds.has(g?.professionalId);
  });

  if (!matched) {
    return { monthlyTarget: 0, manualMonthlyCurrent: 0, weeklyTarget: 0, weeklySplits: [] };
  }

  const norm = normalizeGoal(matched);
  const splits =
    norm.weeklyGoals && norm.weeklyGoals.length > 0
      ? norm.weeklyGoals
      : generateDefaultWeeklySplits(monthStr, norm.targetValue);

  const matchingSplit =
    splits.find((w) => refDate >= w.startDate && refDate <= w.endDate) || splits[0];

  const manualMonthlyCurrent = Number(
    matched.currentValue ?? matched.realizedValue ?? matched.achievedValue ?? 0
  ) || 0;

  return {
    monthlyTarget: norm.targetValue,
    manualMonthlyCurrent,
    weeklyTarget: Number(matchingSplit?.targetAmount) || Math.round((norm.targetValue / 4) * 100) / 100,
    weeklySplit: matchingSplit,
    weeklySplits: splits,
    matchedGoal: matched,
  };
}

export function calculateRevenueForDateRange(
  appointments: any[],
  services: any[],
  profId: string | null,
  startDate: string,
  endDate: string
): number {
  if (!appointments || appointments.length === 0) return 0;

  return appointments
    .filter((app) => {
      const matchProf = !profId || app.professionalId === profId;
      const isCompleted = app.status === 'completed';
      const appDate = app.date ? String(app.date).substring(0, 10) : '';
      const inRange = appDate >= startDate && appDate <= endDate;
      return matchProf && isCompleted && inRange;
    })
    .reduce((sum, app) => {
      if (app.price !== undefined && app.price !== null) {
        return sum + Number(app.price);
      }
      const srv = services.find((s) => s.id === app.serviceId);
      return sum + (srv?.price || 0);
    }, 0);
}

export function normalizeGoal(goal: any, fallbackCurrentValue?: number): NormalizedGoal {
  const targetValue =
    goal.targetValue ??
    goal.targetAmount ??
    goal.goalValue ??
    goal.amount ??
    goal.monthlyGoal ??
    goal.revenueTarget ??
    0;

  const currentValue =
    goal.currentValue ??
    goal.currentAmount ??
    goal.realizedValue ??
    goal.achievedValue ??
    goal.revenueCurrent ??
    fallbackCurrentValue ??
    0;

  const periodRaw = goal.periodType ?? goal.type ?? goal.period ?? "mensal";
  const period = periodRaw === "monthly" || periodRaw === "mensal" ? "mensal" :
                 periodRaw === "weekly" || periodRaw === "semanal" ? "semanal" :
                 periodRaw === "daily" || periodRaw === "diaria" ? "diaria" : "mensal";

  const scope = goal.goalScope ?? goal.scope ?? "professional";

  // Month parsing
  let month = goal.month || new Date().toISOString().substring(0, 7);
  // Ensure month format is YYYY-MM
  if (month.length > 7) {
    month = month.substring(0, 7);
  }

  // Determine dates
  let startDate: Date;
  let endDate: Date;

  if (goal.startDate) {
    startDate = new Date(goal.startDate);
  } else {
    // Start of the month
    const parts = month.split("-");
    const year = parseInt(parts[0]) || new Date().getFullYear();
    const m = (parseInt(parts[1]) || (new Date().getMonth() + 1)) - 1;
    startDate = new Date(year, m, 1);
  }

  if (goal.endDate) {
    endDate = new Date(goal.endDate);
  } else {
    // End of the month
    const parts = month.split("-");
    const year = parseInt(parts[0]) || new Date().getFullYear();
    const m = (parseInt(parts[1]) || (new Date().getMonth() + 1)) - 1;
    endDate = new Date(year, m + 1, 0); // Last day of month
  }

  // Ensure valid date objects
  if (isNaN(startDate.getTime())) {
    startDate = new Date();
  }
  if (isNaN(endDate.getTime())) {
    endDate = new Date();
  }

  const weeklyGoals = Array.isArray(goal.weeklyGoals) && goal.weeklyGoals.length > 0
    ? goal.weeklyGoals
    : (targetValue > 0 ? generateDefaultWeeklySplits(month, targetValue) : []);

  return {
    id: goal.id || "",
    professionalId: goal.professionalId,
    professionalName: goal.professionalName,
    targetValue,
    currentValue,
    period,
    month,
    startDate,
    endDate,
    weeklyGoals,
    weeklyDistributionMode: goal.weeklyDistributionMode || 'equal',
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    title: goal.title || "",
    scope,
    lastProgressUpdateAt: goal.lastProgressUpdateAt,
    lastProgressUpdatedBy: goal.lastProgressUpdatedBy,
  };
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  // 0 is Sunday, 6 is Saturday. Monday to Friday are business days.
  return day !== 0 && day !== 6;
}

export function getDaysCount(start: Date, end: Date, useBusinessDays = false): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  if (s > e) return 0;
  
  if (!useBusinessDays) {
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of start & end
  }
  
  let count = 0;
  const current = new Date(s);
  while (current <= e) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function getElapsedDaysCount(start: Date, end: Date, ref: Date, useBusinessDays = false): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const r = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  
  if (r < s) return 0;
  if (r > e) return getDaysCount(s, e, useBusinessDays);
  
  return getDaysCount(s, r, useBusinessDays);
}

export interface GoalProgress {
  targetValue: number;
  currentValue: number;
  remainingValue: number;
  progressPercent: number;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  expectedProgressPercent: number;
  dailyAverageCurrent: number;
  dailyAverageRequired: number;
  status: "completed" | "on_track" | "attention" | "behind" | "missed" | "not_started";
}

export function calculateGoalProgress(goal: any, options?: { useBusinessDays?: boolean; referenceDate?: Date }): GoalProgress {
  const norm = normalizeGoal(goal);
  const useBusinessDays = options?.useBusinessDays ?? false;
  const referenceDate = options?.referenceDate ?? new Date();

  const targetValue = norm.targetValue;
  const currentValue = norm.currentValue;

  const remainingValue = Math.max(targetValue - currentValue, 0);
  const progressPercent = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;

  const totalDays = getDaysCount(norm.startDate, norm.endDate, useBusinessDays);
  const elapsedDays = getElapsedDaysCount(norm.startDate, norm.endDate, referenceDate, useBusinessDays);
  const remainingDays = Math.max(totalDays - elapsedDays, 0);

  const expectedProgressPercent = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

  const dailyAverageCurrent = elapsedDays > 0 ? currentValue / elapsedDays : 0;
  const dailyAverageRequired = remainingDays > 0 ? remainingValue / remainingDays : 0;

  // Status calculation
  let status: GoalProgress["status"] = "not_started";

  const todayMid = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const startMid = new Date(norm.startDate.getFullYear(), norm.startDate.getMonth(), norm.startDate.getDate());
  const endMid = new Date(norm.endDate.getFullYear(), norm.endDate.getMonth(), norm.endDate.getDate());

  if (todayMid < startMid) {
    status = "not_started";
  } else if (progressPercent >= 100) {
    status = "completed";
  } else if (todayMid > endMid) {
    status = "missed";
  } else if (progressPercent >= expectedProgressPercent) {
    status = "on_track";
  } else if (progressPercent >= expectedProgressPercent * 0.75) {
    status = "attention";
  } else {
    status = "behind";
  }

  return {
    targetValue,
    currentValue,
    remainingValue,
    progressPercent,
    startDate: norm.startDate,
    endDate: norm.endDate,
    totalDays,
    elapsedDays,
    remainingDays,
    expectedProgressPercent,
    dailyAverageCurrent,
    dailyAverageRequired,
    status,
  };
}

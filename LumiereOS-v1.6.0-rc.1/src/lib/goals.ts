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
  createdAt?: any;
  updatedAt?: any;
  title?: string;
  scope?: string;
  lastProgressUpdateAt?: any;
  lastProgressUpdatedBy?: string;
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

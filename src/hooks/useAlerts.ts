import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Professional, Appointment, ProfessionalGoal, ChecklistRun } from '../types';

export interface AlertItem {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  category: 'goal_near' | 'top_ranked' | 'below_goal' | 'low_rating' | 'high_absences' | 'attention';
  title: string;
  description: string;
  proId?: string;
  proName?: string;
  createdAt: number;
}

export function useAlerts(salonId: string | undefined, userId: string | undefined, userRole: string | undefined) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [goals, setGoals] = useState<ProfessionalGoal[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<ChecklistRun[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('lumiere_dismissed_alerts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const currentMonth = useMemo(() => {
    return new Date().toISOString().substring(0, 7); // YYYY-MM
  }, []);

  // 1. Fetch professionals, goals, checklist runs, and appointments dynamically
  useEffect(() => {
    if (!salonId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const qPros = query(collection(db, `salons/${salonId}/professionals`));
    const qGoals = query(collection(db, `salons/${salonId}/professionalGoals`));
    const qRuns = query(collection(db, `salons/${salonId}/checklistRuns`));
    const qAppts = query(collection(db, `salons/${salonId}/appointments`));

    const unsubPros = onSnapshot(qPros, (snapshot) => {
      const list: Professional[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Professional);
      });
      setProfessionals(list);
    }, (err) => console.error('[useAlerts] Error loaded professionals:', err));

    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      const list: ProfessionalGoal[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ProfessionalGoal);
      });
      setGoals(list);
    }, (err) => console.error('[useAlerts] Error loaded goals:', err));

    const unsubRuns = onSnapshot(qRuns, (snapshot) => {
      const list: ChecklistRun[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ChecklistRun);
      });
      setChecklistRuns(list);
    }, (err) => console.error('[useAlerts] Error loaded checklist runs:', err));

    const unsubAppts = onSnapshot(qAppts, (snapshot) => {
      const list: Appointment[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Appointment);
      });
      setAppointments(list);
      setLoading(false);
    }, (err) => {
      console.error('[useAlerts] Error loaded appointments:', err);
      setLoading(false);
    });

    return () => {
      unsubPros();
      unsubGoals();
      unsubRuns();
      unsubAppts();
    };
  }, [salonId]);

  // 2. Compute performance metrics for all professionals in the CURRENT MONTH
  const performanceData = useMemo(() => {
    return professionals.map((prof) => {
      // 2a. Calculate Goal and Progress
      const activeGoal = goals.find(g => g.professionalId === prof.id && g.month === currentMonth);
      const targetAmount = activeGoal?.targetAmount ?? 0;
      const productionManual = activeGoal?.currentValue ?? 0;

      // 2b. Calculate Production from Completed Appointments in current month
      const apptsInMonth = appointments.filter(app => {
        if (app.professionalId !== prof.id || app.status !== 'completed' || !app.date) return false;
        // Check if date belongs to this month (YYYY-MM-DD starts with YYYY-MM)
        return app.date.startsWith(currentMonth);
      });

      const productionFromAppts = apptsInMonth.reduce((sum, app) => {
        const priceNum = app.price !== undefined
          ? (typeof app.price === 'number' ? app.price : parseFloat(app.price as unknown as string) || 0)
          : 0;
        return sum + priceNum;
      }, 0);

      // Summing manual and appointment-based production
      const totalProduction = Math.max(productionManual, productionFromAppts);
      const goalProgressPct = targetAmount > 0 ? (totalProduction / targetAmount) * 100 : 0;
      const isNearGoal = targetAmount > 0 && goalProgressPct >= 90 && goalProgressPct < 100;
      const isGoalAchieved = targetAmount > 0 && goalProgressPct >= 100;

      // 2c. Checklist runs count, average, and absences (Faltas)
      const runsInMonth = checklistRuns.filter(r => r.evaluatedProfessionalId === prof.id && r.date?.startsWith(currentMonth));
      const presentRuns = runsInMonth.filter(r => r.attendanceStatus === 'present' || (!r.attendanceStatus && r.totalScore !== undefined));
      const absencesCount = runsInMonth.filter(r => r.attendanceStatus === 'absent').length;

      const avgScorePercent = presentRuns.length > 0
        ? presentRuns.reduce((sum, r) => sum + (r.completionPercentage || 0), 0) / presentRuns.length
        : 0;

      return {
        prof,
        targetAmount,
        totalProduction,
        goalProgressPct,
        isNearGoal,
        isGoalAchieved,
        absencesCount,
        avgScorePercent,
        hasEvaluations: presentRuns.length > 0,
      };
    });
  }, [professionals, goals, checklistRuns, appointments, currentMonth]);

  // 3. Compute dynamic ranking position based on Composite Score
  // scoreComposto = (progressoMeta% * 0.6) + (mediaAvaliacoes% * 0.4)
  const rankedPerformance = useMemo(() => {
    const scored = performanceData.map((p) => {
      const scoreComposto = (p.goalProgressPct * 0.6) + (p.avgScorePercent * 0.4);
      return {
        ...p,
        scoreComposto
      };
    });
    // Sort descending
    return scored.sort((a, b) => b.scoreComposto - a.scoreComposto);
  }, [performanceData]);

  // 4. Generate Alertas
  const allGeneratedAlerts = useMemo(() => {
    const alertsList: AlertItem[] = [];

    // Let's identify who are Owner, Manager or Platform Admin
    const isOwnerOrManager = userRole === 'owner' || userRole === 'manager' || userRole === 'platform_admin';

    // 4a. If user is Owner or Manager, show TEAM Alerts
    if (isOwnerOrManager) {
      rankedPerformance.forEach(({ prof, targetAmount, goalProgressPct, absencesCount, avgScorePercent, hasEvaluations }) => {
        // We only evaluate non-admins/professional roles
        if (prof.role === 'owner' || prof.role === 'platform_admin') return;

        // Notas Baixas alert
        if (hasEvaluations && avgScorePercent < 70) {
          alertsList.push({
            id: `team_low_rating_${prof.id}_${currentMonth}`,
            type: 'error',
            category: 'low_rating',
            title: `Feedback Crítico: ${prof.name}`,
            description: `Desempenho de comportamento e aderência a baixo da média: ${Math.round(avgScorePercent)}% nos checklists deste mês. Recomenda-se feedback técnico.`,
            proId: prof.id,
            proName: prof.name,
            createdAt: Date.now()
          });
        }

        // Meta Baixa alert
        if (targetAmount > 0 && goalProgressPct < 50) {
          alertsList.push({
            id: `team_below_goal_${prof.id}_${currentMonth}`,
            type: 'warning',
            category: 'below_goal',
            title: `Meta em Risco: ${prof.name}`,
            description: `Abaixo da projeção ótima: faturou R$ ${Math.round(goalProgressPct)}% de sua meta de R$ ${targetAmount}.`,
            proId: prof.id,
            proName: prof.name,
            createdAt: Date.now()
          });
        }

        // Muitas Faltas alert
        if (absencesCount >= 2) {
          alertsList.push({
            id: `team_high_absences_${prof.id}_${currentMonth}`,
            type: 'error',
            category: 'high_absences',
            title: `Ausências Excessivas: ${prof.name}`,
            description: `${prof.name} registrou ${absencesCount} faltas justificadas/não atendidas nos checklists operacionais do mês de hoje.`,
            proId: prof.id,
            proName: prof.name,
            createdAt: Date.now()
          });
        }
      });
    }

    // 4b. Personal Alerts for the active logged in professional/user
    if (userId) {
      const myPerfIdx = rankedPerformance.findIndex(p => p.prof.id === userId);
      if (myPerfIdx !== -1) {
        const myPerf = rankedPerformance[myPerfIdx];
        const rankingPos = myPerfIdx + 1;

        // Perto de bater a meta: ameno de 10%
        if (myPerf.isNearGoal) {
          alertsList.push({
            id: `personal_near_goal_${userId}_${currentMonth}`,
            type: 'success',
            category: 'goal_near',
            title: '🎯 Quase lá! Meta à vista!',
            description: `Você faturou ${Math.round(myPerf.goalProgressPct)}% da sua meta mensal! Falta menos de 10% para o alcance do objetivo final e garantia do seu bônus!`,
            proId: userId,
            createdAt: Date.now()
          });
        }

        // Bem ranqueado e com boas avaliações (Top 3, scoreComposto >= 80%, boas avaliações)
        const isHighEvaluation = myPerf.hasEvaluations && myPerf.avgScorePercent >= 85;
        const isHighlyRanked = rankingPos <= 3 && rankedPerformance.length >= 2;
        if (isHighlyRanked && isHighEvaluation) {
          alertsList.push({
            id: `personal_top_performer_${userId}_${currentMonth}`,
            type: 'success',
            category: 'top_ranked',
            title: '👑 Desempenho Estelar! Destaque do Salão',
            description: `Parabéns! Você está no Top ${rankingPos} do ranking do salão com média espetacular de ${Math.round(myPerf.avgScorePercent)}% nas avaliações Essenza!`,
            proId: userId,
            createdAt: Date.now()
          });
        }

        // Abaixo da meta e com más avaliações
        const isLowEvaluation = myPerf.hasEvaluations && myPerf.avgScorePercent < 70;
        const isBelowGoal = myPerf.targetAmount > 0 && myPerf.goalProgressPct < 50;
        if (isBelowGoal && isLowEvaluation) {
          alertsList.push({
            id: `personal_attention_needed_${userId}_${currentMonth}`,
            type: 'warning',
            category: 'attention',
            title: '⚠️ Atenção: Plano de Ação Recomendado',
            description: `Suas métricas combinadas estão abaixo da expectativa do Lumière (Meta: ${Math.round(myPerf.goalProgressPct)}%, Notas: ${Math.round(myPerf.avgScorePercent)}%). Vamos focar em recuperar no próximo atendimento!`,
            proId: userId,
            createdAt: Date.now()
          });
        }
      }
    }

    return alertsList;
  }, [rankedPerformance, userRole, userId, currentMonth]);

  // Filters out already dismissed alerts in the current session/localStorage
  const activeAlerts = useMemo(() => {
    return allGeneratedAlerts.filter(a => !dismissedAlerts.includes(a.id));
  }, [allGeneratedAlerts, dismissedAlerts]);

  // Dismiss action handler
  const dismissAlert = (id: string) => {
    const updated = [...dismissedAlerts, id];
    setDismissedAlerts(updated);
    try {
      localStorage.setItem('lumiere_dismissed_alerts', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Trigger browser Toast notifications once for new active alerts on load
  useEffect(() => {
    if (activeAlerts.length === 0) return;

    // To prevent infinite loop, we fetch newly found alerts not toasted yet
    const sessionsToastKey = 'lumiere_toasted_alerts';
    let toasted: string[] = [];
    try {
      const stored = sessionStorage.getItem(sessionsToastKey);
      if (stored) toasted = JSON.parse(stored);
    } catch {}

    const newToToast = activeAlerts.filter(a => !toasted.includes(a.id));

    if (newToToast.length > 0) {
      newToToast.forEach((alert) => {
        // Emit alert on the device!
        if (alert.type === 'success') {
          toast.success(alert.title, {
            description: alert.description,
            duration: 7000
          });
        } else if (alert.type === 'warning') {
          toast.warning(alert.title, {
            description: alert.description,
            duration: 8000
          });
        } else if (alert.type === 'error') {
          toast.error(alert.title, {
            description: alert.description,
            duration: 9000
          });
        } else {
          toast.info(alert.title, {
            description: alert.description,
          });
        }
        toasted.push(alert.id);
      });

      try {
        sessionStorage.setItem(sessionsToastKey, JSON.stringify(toasted));
      } catch {}
    }
  }, [activeAlerts]);

  return {
    allAlerts: allGeneratedAlerts,
    activeAlerts,
    performanceData,
    rankedPerformance,
    dismissAlert,
    loading
  };
}

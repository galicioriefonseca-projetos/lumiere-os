import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';

export interface PerformanceItem {
  id: string;
  name?: string;
  fullName?: string;
  extraXP?: number;
  isActive?: boolean;
  totalRevenue: number;
  totalServices: number;
  totalProducts: number;
  totalXP: number;
  level: number;
  nextLevelXP: number;
  currentLevelXPStart: number;
  progressPercent: number;
  badges: Array<{ name: string; icon: string; description: string; color: string; unlocked: boolean }>;
  avgScore: number;
  totalChecklists: number;
  totalGoals: number;
  goalsHit: number;
  avgGoalProgress: number;
  performanceScore: number;
  dataStatus: 'completo' | 'parcial_metas' | 'parcial_checklist' | 'sem_dados';
  dataStatusLabel: string;
  explanation: {
    reason: string;
    pointsOfStrength: string[];
    pointsOfAttention: string[];
  };
  bonusStatus: 'elegivel' | 'evolucao' | 'atencao' | 'insuficiente';
  bonusLabel: string;
  bonusColor: string;
  unlockedBadgesCount: number;
  [key: string]: any;
}

export function useSalonPerformanceRanking(salonId: string | undefined, selectedMonth: string) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<any[]>([]);
  const [salonGoals, setSalonGoals] = useState<any[]>([]);
  const [professionalGoals, setProfessionalGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubs: (() => void)[] = [];
    let loadedCount = 0;
    const totalToLoad = 5;

    const markLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        setLoading(false);
      }
    };

    // 1. Agendamentos
    const qAp = query(collection(db, `salons/${salonId}/appointments`));
    unsubs.push(onSnapshot(qAp, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setAppointments(arr);
      markLoaded();
    }, (err) => {
      console.warn("Erro ao carregar agendamentos:", err);
      markLoaded();
    }));

    // 2. Colaboradores
    const qPro = query(collection(db, `salons/${salonId}/professionals`));
    unsubs.push(onSnapshot(qPro, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.isActive !== false) {
          arr.push({ id: doc.id, ...data });
        }
      });
      setProfessionals(arr);
      markLoaded();
    }, (err) => {
      console.warn("Erro ao carregar colaboradores:", err);
      markLoaded();
    }));

    // 3. ChecklistRuns
    const qCk = query(collection(db, `salons/${salonId}/checklistRuns`));
    unsubs.push(onSnapshot(qCk, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setChecklistRuns(arr);
      markLoaded();
    }, (err) => {
      console.warn("Erro ao carregar checklistRuns:", err);
      markLoaded();
    }));

    // 4. Metas do Salão (salons/{salonId}/goals)
    const qG = query(collection(db, `salons/${salonId}/goals`));
    unsubs.push(onSnapshot(qG, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setSalonGoals(arr);
      markLoaded();
    }, (err) => {
      console.warn("Erro ao carregar metas do salão:", err);
      markLoaded();
    }));

    // 5. Metas dos Profissionais (salons/{salonId}/professionalGoals)
    const qPg = query(collection(db, `salons/${salonId}/professionalGoals`));
    unsubs.push(onSnapshot(qPg, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setProfessionalGoals(arr);
      markLoaded();
    }, (err) => {
      console.warn("Erro ao carregar metas profissionais:", err);
      markLoaded();
    }));

    return () => unsubs.forEach(fn => fn());
  }, [salonId]);

  // Cálculos dinâmicos de XP, Nível, Faturamento e Badge para cada profissional
  const professionalsPerformance = useMemo<PerformanceItem[]>(() => {
    const mapped = professionals.map(prof => {
      // 1. Filtrar agendamentos concluídos deste profissional e deste mês selecionado
      const completedSrvs = appointments.filter(ap => {
        const isCompleted = ap.status === 'completed';
        if (!isCompleted) return false;
        
        const isSameProf = ap.professionalId === prof.id;
        if (!isSameProf) return false;

        const apDate = ap.date || (ap.createdAt && typeof ap.createdAt === 'string' && ap.createdAt) || '';
        if (apDate.startsWith(selectedMonth)) return true;
        
        if (typeof ap.createdAt === 'number') {
          return new Date(ap.createdAt).toISOString().substring(0, 7) === selectedMonth;
        }
        return false;
      });

      // Faturamento total
      const totalRevenue = completedSrvs.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

      // Quantidade de serviços e produtos vendidos
      const totalServices = completedSrvs.filter(ap => ap.type !== 'product').length;
      const totalProducts = completedSrvs.filter(ap => ap.type === 'product').length;

      // 2. Nota média em checklists avaliados (0 a 100) no mês selecionado
      const runsInMonth = checklistRuns.filter(r => 
        r.evaluatedProfessionalId === prof.id && 
        (r.date?.startsWith(selectedMonth) || r.evaluationDate?.startsWith(selectedMonth))
      );
      // Filtrar apenas runs válidas (onde a nota ou percentual foi registrado e não é uma falta)
      const validRuns = runsInMonth.filter(r => {
        if (r.attendanceStatus && r.attendanceStatus !== 'present') return false;
        return r.percentage !== undefined || r.completionPercentage !== undefined;
      });
      const totalChecklists = validRuns.length;
      const avgScore = totalChecklists > 0 
        ? validRuns.reduce((sum, r) => {
            const score = r.percentage !== undefined ? r.percentage : (r.completionPercentage ?? 0);
            return sum + score;
          }, 0) / totalChecklists
        : 0;

      // 3. Unificar metas atribuídas para o mês selecionado
      const pGoalsPg = professionalGoals.filter(g => g.professionalId === prof.id && g.month === selectedMonth);
      const pGoalsG = salonGoals.filter(g => g.professionalId === prof.id && g.month === selectedMonth);
      
      const uniqueGoalsMap = new Map<string, any>();
      pGoalsPg.forEach(g => uniqueGoalsMap.set(g.id, g));
      pGoalsG.forEach(g => uniqueGoalsMap.set(g.id, g));
      const assignedGoals = Array.from(uniqueGoalsMap.values());

      const totalGoals = assignedGoals.length;
      const goalsHit = assignedGoals.filter(g => {
        const target = g.targetAmount ?? g.targetValue ?? g.amount ?? 0;
        const current = g.currentValue ?? g.currentAmount ?? g.realizedValue ?? 0;
        return target > 0 && current >= target;
      }).length;

      const sumGoalProgress = assignedGoals.reduce((sum, g) => {
        const target = g.targetAmount ?? g.targetValue ?? g.amount ?? 0;
        const current = g.currentValue ?? g.currentAmount ?? g.realizedValue ?? 0;
        const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        return sum + progress;
      }, 0);

      const avgGoalProgress = totalGoals > 0 ? sumGoalProgress / totalGoals : 0;

      // 4. Nova fórmula inteligente (70% Metas, 30% Checklist)
      const hasGoals = totalGoals > 0;
      const hasChecklists = totalChecklists > 0;

      let performanceScore = 0;
      let dataStatus: 'completo' | 'parcial_metas' | 'parcial_checklist' | 'sem_dados' = 'completo';
      let dataStatusLabel = '';

      if (hasGoals && hasChecklists) {
        performanceScore = Math.round((avgGoalProgress * 0.70) + (avgScore * 0.30));
        dataStatus = 'completo';
        dataStatusLabel = 'Dados Completos';
      } else if (hasGoals && !hasChecklists) {
        performanceScore = Math.round(avgGoalProgress);
        dataStatus = 'parcial_metas';
        dataStatusLabel = 'Parcial (Sem Checklist)';
      } else if (!hasGoals && hasChecklists) {
        performanceScore = Math.round(avgScore);
        dataStatus = 'parcial_checklist';
        dataStatusLabel = 'Parcial (Sem Metas)';
      } else {
        performanceScore = 0;
        dataStatus = 'sem_dados';
        dataStatusLabel = 'Sem Dados Suficientes';
      }

      // Cálculo de XP Inteligente no mês selecionado:
      const baseXP = Math.floor(totalRevenue);
      const serviceBonus = totalServices * 50;
      const productBonus = totalProducts * 150;
      const perfBonus = runsInMonth.filter(r => r.completionPercentage === 100 || r.percentage === 100).length * 200;

      const totalXP = baseXP + serviceBonus + productBonus + perfBonus + (prof.extraXP || 0);

      // Sistema de Nível Simples e Linear:
      let level = 1;
      let nextLevelXP = 1000;
      let currentLevelXPStart = 0;

      if (totalXP >= 10000) {
        const extraXPs = totalXP - 10000;
        const extraLevels = Math.floor(extraXPs / 5000);
        level = 5 + extraLevels;
        currentLevelXPStart = 10000 + extraLevels * 5000;
        nextLevelXP = currentLevelXPStart + 5000;
      } else if (totalXP >= 6000) {
        level = 4;
        currentLevelXPStart = 6000;
        nextLevelXP = 10000;
      } else if (totalXP >= 3000) {
        level = 3;
        currentLevelXPStart = 3000;
        nextLevelXP = 6000;
      } else if (totalXP >= 1000) {
        level = 2;
        currentLevelXPStart = 1000;
        nextLevelXP = 3000;
      }

      const progressPercent = Math.min(
        100,
        Math.max(0, ((totalXP - currentLevelXPStart) / (nextLevelXP - currentLevelXPStart)) * 100)
      );

      // Conquistas / Badges Dinâmicas:
      const badges = [
        {
          name: 'Mestre da Tesoura',
          icon: '✂️',
          description: 'Prestou mais de 10 serviços no salão.',
          color: 'from-amber-500 to-yellow-600',
          unlocked: totalServices >= 10
        },
        {
          name: 'Inabalável',
          icon: '⭐',
          description: 'Obteve 100% de conformidade em uma auditoria.',
          color: 'from-blue-500 to-indigo-600',
          unlocked: runsInMonth.some(r => r.completionPercentage === 100 || r.percentage === 100)
        },
        {
          name: 'Imperador de Vendas',
          icon: '🛍️',
          description: 'Vendeu mais de 3 produtos físicos para clientes.',
          color: 'from-emerald-500 to-teal-600',
          unlocked: totalProducts >= 3
        },
        {
          name: 'Luz de Lumière',
          icon: '👑',
          description: 'Faturou acima de R$ 2.000,00 no mês corrente.',
          color: 'from-purple-500 to-pink-600',
          unlocked: totalRevenue >= 2000
        },
        {
          name: 'Super Querido',
          icon: '🔥',
          description: 'Realizou mais de 20 atendimentos.',
          color: 'from-orange-500 to-red-600',
          unlocked: completedSrvs.length >= 20
        }
      ];

      // Explicação "Por que está nesta posição?"
      const pointsOfStrength: string[] = [];
      const pointsOfAttention: string[] = [];

      if (hasGoals) {
        if (avgGoalProgress >= 80) {
          pointsOfStrength.push(`Excelente progresso nas metas manuais (${avgGoalProgress.toFixed(0)}%).`);
        } else if (avgGoalProgress < 50) {
          pointsOfAttention.push(`Baixo progresso na meta mensal (${avgGoalProgress.toFixed(0)}%). Necessário foco.`);
        }
      } else {
        pointsOfAttention.push('Sem meta manual cadastrada neste mês.');
      }

      if (hasChecklists) {
        if (avgScore >= 85) {
          pointsOfStrength.push(`Excelente conformidade no checklist diário (${avgScore.toFixed(1)}%).`);
        } else if (avgScore < 75) {
          pointsOfAttention.push(`Atenção aos padrões de conformidade do checklist (${avgScore.toFixed(1)}%).`);
        }
      } else {
        pointsOfAttention.push('Nenhuma rotina de checklist realizada no período.');
      }

      if (hasGoals && hasChecklists) {
        if (avgGoalProgress >= 80 && avgScore >= 85) {
          pointsOfStrength.push('Ótimo equilíbrio entre metas e conformidade.');
        }
      }

      const explanation = {
        reason: (hasGoals && hasChecklists)
          ? `Seu score de ${performanceScore}% pondera seu progresso de ${avgGoalProgress.toFixed(0)}% nas metas (peso 70%) e conformidade de ${avgScore.toFixed(1)}% nos checklists (peso 30%).`
          : hasGoals
            ? `Score de ${performanceScore}% calculado provisoriamente apenas pelo progresso de ${avgGoalProgress.toFixed(0)}% nas metas individuais (sem checklists no período).`
            : hasChecklists
              ? `Score de ${performanceScore}% calculado provisoriamente apenas pela nota média de ${avgScore.toFixed(1)}% nos checklists (sem metas no período).`
              : "Sem registros ativos de metas ou checklists para compor o ranking.",
        pointsOfStrength: pointsOfStrength.length > 0 ? pointsOfStrength : ['Operação diária em andamento.'],
        pointsOfAttention: pointsOfAttention.length > 0 ? pointsOfAttention : ['Continue mantendo o ritmo atual para pontuar!']
      };

      // Bonificação Status
      let bonusStatus: 'elegivel' | 'evolucao' | 'atencao' | 'insuficiente' = 'insuficiente';
      let bonusLabel = '';
      let bonusColor = '';

      if (!hasGoals || !hasChecklists) {
        bonusStatus = 'insuficiente';
        bonusLabel = 'Dados insuficientes';
        bonusColor = 'text-zinc-500 bg-zinc-900 border-zinc-850';
      } else if (avgGoalProgress >= 80 && avgScore >= 85) {
        bonusStatus = 'elegivel';
        bonusLabel = 'Elegível para Bonificação';
        bonusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      } else if (avgGoalProgress >= 50 || avgScore >= 70) {
        bonusStatus = 'evolucao';
        bonusLabel = 'Em Evolução';
        bonusColor = 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      } else {
        bonusStatus = 'atencao';
        bonusLabel = 'Necessita Atenção';
        bonusColor = 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      }

      return {
        ...prof,
        totalRevenue,
        totalServices,
        totalProducts,
        totalXP,
        level,
        nextLevelXP,
        currentLevelXPStart,
        progressPercent,
        badges,
        avgScore,
        totalChecklists,
        totalGoals,
        goalsHit,
        avgGoalProgress,
        performanceScore,
        dataStatus,
        dataStatusLabel,
        explanation,
        bonusStatus,
        bonusLabel,
        bonusColor,
        unlockedBadgesCount: badges.filter(b => b.unlocked).length
      };
    });

    // Ordenar ranking pelo SCORE FINAL (performanceScore) de forma decrescente, e por XP total em caso de empate
    return mapped.sort((a, b) => {
      if (b.performanceScore !== a.performanceScore) {
        return b.performanceScore - a.performanceScore;
      }
      return b.totalXP - a.totalXP;
    });
  }, [professionals, appointments, checklistRuns, salonGoals, professionalGoals, selectedMonth]);

  const rankingByEvaluation = useMemo(() => {
    return professionalsPerformance
      .filter(prof => prof.totalChecklists > 0)
      .sort((a, b) => {
        if (b.avgScore !== a.avgScore) {
          return b.avgScore - a.avgScore;
        }
        return b.totalChecklists - a.totalChecklists;
      });
  }, [professionalsPerformance]);

  const rankingByGoals = useMemo(() => {
    return professionalsPerformance
      .filter(prof => prof.totalGoals > 0)
      .sort((a, b) => {
        if (b.goalsHit !== a.goalsHit) {
          return b.goalsHit - a.goalsHit;
        }
        return b.avgGoalProgress - a.avgGoalProgress;
      });
  }, [professionalsPerformance]);

  return {
    professionalsPerformance,
    rankingByEvaluation,
    rankingByGoals,
    loading
  };
}

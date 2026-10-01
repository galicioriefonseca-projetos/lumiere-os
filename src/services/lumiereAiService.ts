import { auth } from '@/lib/firebase';

export interface DailyInsightGoals {
  todayTarget: number;
  todayAchieved: number;
  progressPct: number;
  monthlyTarget: number;
  monthlyAchieved: number;
  monthlyProgressPct: number;
}

export interface DailyInsightGoalsDiagnosis {
  analysis: string;
  paceDescription: string;
}

export interface DailyInsightPendency {
  id: string;
  category: 'appointments' | 'checklists' | 'financial' | 'team' | string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
}

export interface DailyInsightFinancialAlert {
  id: string;
  type: 'positive' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  highlight?: string;
}

export interface LumiereDailyInsights {
  executiveSummary: string;
  status: 'optimal' | 'attention' | 'critical';
  statusLabel: string;
  goalsDiagnosis: DailyInsightGoalsDiagnosis;
  goals: DailyInsightGoals;
  pendencies: DailyInsightPendency[];
  financialAlerts: DailyInsightFinancialAlert[];
  strategicTip: string;
  isAiGenerated: boolean;
  engine: string;
  generatedAt: string;
}

export interface ClientMetricsSnapshot {
  todayRevenue?: number;
  monthRevenue?: number;
  monthlyGoal?: number;
  dailyGoal?: number;
  scheduledAppointments?: number;
  completedAppointments?: number;
  pendingAppointments?: number;
  checklistRunsCount?: number;
  expensesToday?: number;
  netCashToday?: number;
}

function generateClientHeuristicDailyInsights(
  salonId: string, 
  clientMetrics?: ClientMetricsSnapshot
): LumiereDailyInsights {
  const todayRevenue = clientMetrics?.todayRevenue || 0;
  const monthRevenue = clientMetrics?.monthRevenue || 0;
  const dailyGoal = clientMetrics?.dailyGoal || 1000;
  const monthlyGoal = clientMetrics?.monthlyGoal || 25000;
  const scheduled = clientMetrics?.scheduledAppointments || 0;
  const completed = clientMetrics?.completedAppointments || 0;
  const pending = clientMetrics?.pendingAppointments || 0;
  const checklists = clientMetrics?.checklistRunsCount || 0;
  const expenses = clientMetrics?.expensesToday || 0;
  const netCash = clientMetrics?.netCashToday ?? (todayRevenue - expenses);

  const progressPct = dailyGoal > 0 ? Math.min(Math.round((todayRevenue / dailyGoal) * 100), 250) : 0;
  const monthlyProgressPct = monthlyGoal > 0 ? Math.min(Math.round((monthRevenue / monthlyGoal) * 100), 200) : 0;

  let status: 'optimal' | 'attention' | 'critical' = 'optimal';
  let statusLabel = 'Operação em Ritmo Saudável';
  let executiveSummary = 'O ritmo de atendimento do estabelecimento está em fluxo consistente hoje, com metas alinhadas ao planejamento semanal.';

  if (progressPct < 40 && pending > 2) {
    status = 'critical';
    statusLabel = 'Atenção Operacional & Metas';
    executiveSummary = 'Atingimento de metas em ritmo lento para o horário e acúmulo de agendamentos pendentes demandam intervenção imediata da recepção.';
  } else if (progressPct < 70 || pending > 1 || expenses > todayRevenue) {
    status = 'attention';
    statusLabel = 'Ajustes de Ritmo Recomendados';
    executiveSummary = 'Bom volume de operações em andamento, com oportunidade de acelerar o ticket médio e fechar confirmações pendentes.';
  }

  const pendencies: DailyInsightPendency[] = [];
  if (pending > 0) {
    pendencies.push({
      id: 'pend_appointments',
      category: 'appointments',
      priority: pending > 2 ? 'high' : 'medium',
      title: `${pending} agendamento(s) aguardando confirmação`,
      description: 'Clientes agendados para hoje aguardam confirmação da recepção.',
      actionLabel: 'Ver Agendamentos',
      actionUrl: '/dashboard/agendamentos'
    });
  }
  if (checklists === 0) {
    pendencies.push({
      id: 'pend_checklist',
      category: 'checklists',
      priority: 'medium',
      title: 'Checklist Operacional Diário não registrado',
      description: 'O checklist de abertura e conformidade dos postos ainda não foi concluído hoje.',
      actionLabel: 'Abrir Checklists',
      actionUrl: '/dashboard/checklist'
    });
  }
  if (pendencies.length === 0) {
    pendencies.push({
      id: 'pend_crm',
      category: 'team',
      priority: 'low',
      title: 'Rotina de CRM & Pós-Atendimento',
      description: 'Aproveite os intervalos da tarde para convidar clientes inativos para retorno.',
      actionLabel: 'Ver CRM',
      actionUrl: '/dashboard/clientes'
    });
  }

  const financialAlerts: DailyInsightFinancialAlert[] = [];
  if (netCash > 0) {
    financialAlerts.push({
      id: 'fin_positive',
      type: 'positive',
      title: 'Fluxo Líquido Positivo',
      description: `Saldo líquido favorável de R$ ${netCash.toLocaleString('pt-BR')} hoje.`,
      highlight: `+ R$ ${netCash.toLocaleString('pt-BR')}`
    });
  } else if (netCash < 0) {
    financialAlerts.push({
      id: 'fin_neg',
      type: 'warning',
      title: 'Despesas Superiores à Entrada',
      description: `Despesas registradas (R$ ${expenses.toLocaleString('pt-BR')}) superam os recebimentos imediatos.`,
      highlight: `- R$ ${Math.abs(netCash).toLocaleString('pt-BR')}`
    });
  }

  if (dailyGoal > 0 && todayRevenue < dailyGoal) {
    const gap = dailyGoal - todayRevenue;
    financialAlerts.push({
      id: 'fin_gap',
      type: 'info',
      title: 'Gap de Meta Diária',
      description: `Faltam R$ ${gap.toLocaleString('pt-BR')} para completar a cota prevista de hoje.`,
      highlight: `Faltam R$ ${gap.toLocaleString('pt-BR')}`
    });
  }

  return {
    executiveSummary,
    status,
    statusLabel,
    goalsDiagnosis: {
      analysis: `A meta diária atingiu ${Math.round(progressPct)}% do planejado (R$ ${todayRevenue.toLocaleString('pt-BR')} de R$ ${dailyGoal.toLocaleString('pt-BR')}). No acumulado mensal, alcançou ${Math.round(monthlyProgressPct)}% de R$ ${monthlyGoal.toLocaleString('pt-BR')}.`,
      paceDescription: todayRevenue >= dailyGoal
        ? 'Meta diária superada com sucesso! Foque em upsell de produtos home care.'
        : `Faltam R$ ${(dailyGoal - todayRevenue > 0 ? dailyGoal - todayRevenue : 0).toLocaleString('pt-BR')} para cumprir a meta do dia.`
    },
    goals: {
      todayTarget: dailyGoal,
      todayAchieved: todayRevenue,
      progressPct: Math.round(progressPct),
      monthlyTarget: monthlyGoal,
      monthlyAchieved: monthRevenue,
      monthlyProgressPct: Math.round(monthlyProgressPct)
    },
    pendencies,
    financialAlerts,
    strategicTip: 'Ofereça um serviço complementar express durante os agendamentos já confirmados para elevar o ticket médio e fechar o dia acima da meta.',
    isAiGenerated: false,
    engine: 'Lumière Heuristic Intelligence (Modo Resiliente)',
    generatedAt: new Date().toISOString()
  };
}

class LumiereAiService {
  private cache: Map<string, { data: LumiereDailyInsights; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache inteligente

  /**
   * Obtém os insights executivos do dia para o salão via endpoint backend com Gemini ou Fallback Heurístico
   */
  async getDailyInsights(
    salonId: string, 
    clientMetrics?: ClientMetricsSnapshot, 
    forceRefresh = false
  ): Promise<LumiereDailyInsights> {
    if (!salonId) {
      throw new Error("salonId é obrigatório para consultar os insights.");
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const cacheKey = `${salonId}_${todayStr}`;

    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
        return cached.data;
      }
    }

    // Obter ID Token do usuário logado se disponível
    let token: string | null = null;
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        token = await currentUser.getIdToken();
      }
    } catch (authErr) {
      console.warn("[LumiereAiService] Não foi possível obter token de autenticação:", authErr);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch("/api/lumiere-insights/daily", {
        method: "POST",
        headers,
        body: JSON.stringify({
          salonId,
          date: todayStr,
          clientMetrics,
        }),
      });

      if (response.ok) {
        const data: LumiereDailyInsights = await response.json();
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }

      console.warn(`[LumiereAiService] Resposta HTTP ${response.status} do endpoint de IA, acionando inteligência heurística local.`);
    } catch (networkErr) {
      console.warn("[LumiereAiService] Falha de conexão com backend na nuvem, acionando inteligência heurística local:", networkErr);
    }

    // Fallback gracioso imediato
    const fallbackData = generateClientHeuristicDailyInsights(salonId, clientMetrics);
    this.cache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
    return fallbackData;
  }

  /**
   * Invalida o cache para permitir atualização imediata
   */
  clearCache(salonId: string) {
    const todayStr = new Date().toISOString().substring(0, 10);
    this.cache.delete(`${salonId}_${todayStr}`);
  }
}

export const lumiereAiService = new LumiereAiService();

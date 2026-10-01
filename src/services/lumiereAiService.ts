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

class LumiereAiService {
  private cache: Map<string, { data: LumiereDailyInsights; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache inteligente

  /**
   * Obtém os insights executivos do dia para o salão via endpoint backend com Gemini 3.8
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

    const response = await fetch("/api/lumiere-insights/daily", {
      method: "POST",
      headers,
      body: JSON.stringify({
        salonId,
        date: todayStr,
        clientMetrics,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro HTTP ${response.status} ao consultar insights diários.`);
    }

    const data: LumiereDailyInsights = await response.json();
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
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

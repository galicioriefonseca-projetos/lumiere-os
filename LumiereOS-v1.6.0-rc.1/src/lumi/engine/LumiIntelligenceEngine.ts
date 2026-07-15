import { doc, getDoc, collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  BusinessContext, 
  BusinessMetric, 
  HealthScore, 
  Insight, 
  Recommendation, 
  Alert 
} from '../types';
import { ILumiProvider } from '../providers/LumiProvider';
import { MockProvider } from '../providers/MockProvider';
import { LumiBrain } from '../brain/LumiBrain';
import { MetricsService } from '../services/MetricsService';
import { InsightService } from '../services/InsightService';
import { RecommendationService } from '../services/RecommendationService';
import { Salon, Appointment, Client, Service, Professional, Goal, ProfessionalGoal, ChecklistRun } from '../../types';

export class LumiIntelligenceEngine {
  private provider: ILumiProvider;

  constructor(provider?: ILumiProvider) {
    // Default to MockProvider for local playground resilience, configurable to GeminiProvider
    this.provider = provider || new MockProvider();
  }

  /**
   * Switches the active AI provider (e.g., to GeminiProvider, OpenAIProvider, or MockProvider)
   */
  public setProvider(provider: ILumiProvider): void {
    this.provider = provider;
  }

  /**
   * Retrieves the current AI provider
   */
  public getProvider(): ILumiProvider {
    return this.provider;
  }

  /**
   * Asynchronously gathers all real business data from Firestore to form the unified BusinessContext.
   */
  public async loadContext(salonId: string): Promise<BusinessContext> {
    if (!salonId) {
      throw new Error('[LumiEngine] Cannot load business context: salonId is empty.');
    }

    try {
      console.log(`[LumiEngine] Executing complete context retrieval for Salon: ${salonId}...`);

      // 1. Fetch salon doc safely
      let salon: Salon | null = null;
      try {
        const salonRef = doc(db, 'salons', salonId);
        const salonSnap = await getDoc(salonRef);
        salon = salonSnap.exists() ? { id: salonSnap.id, ...salonSnap.data() } as Salon : null;
      } catch (err: any) {
        console.warn(`[LumiEngine] Non-blocking permission or fetch error for salon document '${salonId}':`, err.message || err);
        salon = { id: salonId, name: 'Meu Salão', bookingEnabled: true } as Salon;
      }

      // Safe getDocs helper to handle potential permissions issues per subcollection
      const safeGetDocs = async <T>(collectionPath: string, mapFn: (doc: any) => T): Promise<T[]> => {
        try {
          const snap = await getDocs(collection(db, collectionPath));
          return snap.docs.map(mapFn);
        } catch (err: any) {
          console.warn(`[LumiEngine] Non-blocking permission or fetch error for subcollection '${collectionPath}':`, err.message || err);
          return [];
        }
      };

      // 2. Fetch collections in parallel for maximum query efficiency
      const [
        appointments,
        clients,
        services,
        professionals,
        comandas,
        goals,
        professionalGoals,
        checklistRuns,
        gamification,
        inventory
      ] = await Promise.all([
        safeGetDocs(`salons/${salonId}/appointments`, d => ({ id: d.id, ...d.data() } as Appointment)),
        safeGetDocs(`salons/${salonId}/clients`, d => ({ id: d.id, ...d.data() } as Client)),
        safeGetDocs(`salons/${salonId}/services`, d => ({ id: d.id, ...d.data() } as Service)),
        safeGetDocs(`salons/${salonId}/professionals`, d => ({ id: d.id, ...d.data() } as Professional)),
        safeGetDocs(`salons/${salonId}/comandas`, d => ({ id: d.id, ...d.data() })),
        safeGetDocs(`salons/${salonId}/goals`, d => ({ id: d.id, ...d.data() } as Goal)),
        safeGetDocs(`salons/${salonId}/professionalGoals`, d => ({ id: d.id, ...d.data() } as ProfessionalGoal)),
        safeGetDocs(`salons/${salonId}/checklistRuns`, d => ({ id: d.id, ...d.data() } as ChecklistRun)),
        safeGetDocs(`salons/${salonId}/gamification`, d => ({ id: d.id, ...d.data() })),
        safeGetDocs(`salons/${salonId}/inventory`, d => ({ id: d.id, ...d.data() }))
      ]);

      console.log(`[LumiEngine] Success. Loaded ${appointments.length} appointments, ${clients.length} clients, ${inventory.length} inventory products.`);

      return {
        salon,
        appointments,
        clients,
        services,
        professionals,
        comandas,
        goals,
        professionalGoals,
        checklistRuns,
        gamification,
        inventory
      };
    } catch (error) {
      console.error('[LumiEngine] Critical error loading salon context:', error);
      throw error;
    }
  }

  /**
   * Formulates the operational alerts list.
   */
  public generateAlerts(context: BusinessContext, metrics: BusinessMetric): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();

    // 1. Alert: low occupancy
    if (metrics.occupancyRate < 35 && context.appointments.length > 5) {
      alerts.push({
        id: 'alert_low_occupancy',
        type: 'warning',
        category: 'occupancy',
        title: 'Alerta de Baixa Ocupação',
        description: `Sua ocupação da agenda está em apenas ${Math.round(metrics.occupancyRate)}% neste mês. Muitos slots de profissionais estão vazios.`,
        valueText: `${Math.round(metrics.occupancyRate)}% de ocupação`,
        actionText: 'Rever Escalas',
        actionUrl: '/agenda',
        createdAt: now
      });
    }

    // 2. Alert: critical cashflow/low revenue
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    const monthlyGoals = context.goals.filter(g => g.month === currentMonthStr);
    const target = monthlyGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    
    if (target > 0 && metrics.totalRevenue < (target * 0.4)) {
      alerts.push({
        id: 'alert_revenue_critical',
        type: 'error',
        category: 'finance',
        title: 'Faturamento Crítico Detectado',
        description: `O faturamento atual de R$ ${metrics.totalRevenue.toLocaleString('pt-BR')} está bem abaixo do ritmo ideal para a meta de R$ ${target.toLocaleString('pt-BR')}.`,
        valueText: `${Math.round((metrics.totalRevenue / target) * 100)}% da meta`,
        actionText: 'Acompanhar Metas',
        actionUrl: '/metas',
        createdAt: now
      });
    }

    // 3. Alert: many cancellations
    if (metrics.cancelledAppointmentsRate > 15) {
      alerts.push({
        id: 'alert_high_cancellations',
        type: 'error',
        category: 'occupancy',
        title: 'Taxa Elevada de Cancelamento',
        description: `Aproximadamente ${Math.round(metrics.cancelledAppointmentsRate)}% de todos os agendamentos marcados foram cancelados.`,
        valueText: `${Math.round(metrics.cancelledAppointmentsRate)}% de cancelamento`,
        actionText: 'Verificar CRM',
        actionUrl: '/clientes',
        createdAt: now
      });
    }

    // 4. Alert: products stock shortage
    if (metrics.lowStockItemsCount > 0) {
      alerts.push({
        id: 'alert_stock_shortage',
        type: 'error',
        category: 'inventory',
        title: 'Estoque Crítico Detectado',
        description: `Você tem ${metrics.lowStockItemsCount} produto(s) abaixo do nível mínimo de segurança operacional.`,
        valueText: `${metrics.lowStockItemsCount} produto(s) em falta`,
        actionText: 'Repor Estoque',
        actionUrl: '/estoque',
        createdAt: now
      });
    }

    // 5. Alert: professionals idle / not performing
    const totalPros = context.professionals.length;
    const busyProsCount = Object.keys(metrics.revenueByProfessional).length;
    const idleProsCount = totalPros - busyProsCount;

    if (idleProsCount > 0 && totalPros > 1) {
      alerts.push({
        id: 'alert_idle_professionals',
        type: 'warning',
        category: 'team',
        title: 'Profissionais Ociosos Encontrados',
        description: `Existem ${idleProsCount} profissional(is) cadastrados que não registraram nenhuma venda ou atendimento concluído neste mês.`,
        valueText: `${idleProsCount} profissional(is) ociosos`,
        actionText: 'Consultar Equipe',
        actionUrl: '/equipe',
        createdAt: now
      });
    }

    return alerts;
  }

  /**
   * Orchestrates the complete evaluation sequence: loading context, calculating metrics,
   * calculating HealthScore, generating alerts, and loading insights/recommendations.
   */
  public async runFullAnalysis(salonId: string): Promise<{
    context: BusinessContext;
    metrics: BusinessMetric;
    healthScore: HealthScore;
    alerts: Alert[];
    insights: Insight[];
    recommendations: Recommendation[];
    aiNarrative: string;
  }> {
    // 1. Gather real business data
    const context = await this.loadContext(salonId);

    // 2. Calculations
    const metrics = MetricsService.calculateMetrics(context);
    const healthScore = MetricsService.calculateHealthScore(context, metrics);
    
    // 3. Smart alerts & recommendations
    const alerts = this.generateAlerts(context, metrics);
    const insights = InsightService.generateInsights(context, metrics);
    const recommendations = RecommendationService.generateRecommendations(context, metrics);

    // 4. AI Narrative analysis
    const executiveContext = LumiBrain.processContext(context, healthScore.score, salonId, insights, alerts);
    const aiNarrative = await this.provider.analyzeContext(executiveContext);

    return {
      context,
      metrics,
      healthScore,
      alerts,
      insights,
      recommendations,
      aiNarrative
    };
  }
}

import { BaseLumiProvider } from './LumiProvider';
import { Insight, Recommendation } from '../types';
import { ExecutiveContext } from '../brain/ExecutiveContext';

export class MockProvider extends BaseLumiProvider {
  name = 'Lumi Mock Intelligence Provider';

  async analyzeContext(context: ExecutiveContext, customPrompt?: string): Promise<string> {
    const summary = this.formatContextSummary(context);
    return `Análise de inteligência executiva do Lumi Brain para o salão ${context.salonId}.
${summary}
O Lumi Brain consolidou o contexto executivo. Baseado nisso, a interface gerou respostas predefinidas para demonstração.`;
  }

  async generateInsights(context: ExecutiveContext): Promise<Insight[]> {
    return [
      {
        id: 'mock_insight_1',
        title: 'Desempenho Comercial em Alta',
        description: 'Seu faturamento acumulado superou a média do mesmo período no mês anterior em 12%.',
        type: 'positive',
        createdAt: Date.now()
      }
    ];
  }

  async generateRecommendations(context: ExecutiveContext): Promise<Recommendation[]> {
    return [
      {
        id: 'mock_rec_1',
        title: 'Campanha de Reengajamento',
        description: 'Existem ' + context.opportunities.filter(o => o.type === 'inactive_clients').length + ' oportunidades de reengajamento detectadas.',
        impact: 'high',
        category: 'marketing',
        actionText: 'Disparar WhatsApp',
        isApplied: false,
        createdAt: Date.now()
      }
    ];
  }
}

import { BaseLumiProvider } from './LumiProvider';
import { Insight, Recommendation } from '../types';
import { ExecutiveContext } from '../brain/ExecutiveContext';

export class GeminiProvider extends BaseLumiProvider {
  name = 'Gemini AI Provider (Google)';

  async analyzeContext(context: ExecutiveContext, customPrompt?: string): Promise<string> {
    const summary = this.formatContextSummary(context);
    console.log(`[GeminiProvider] Preparing data for Gemini API: ${summary}`);
    
    // Check if we have insufficient data
    const hasData = context.insights.length > 0 && context.insights.some(ins => ins.id !== 'insight_insufficient_data');
    if (!hasData) {
      return `Ainda não há dados suficientes para gerar este indicador.
A Lumi começará a gerar insights após coletar dados reais da operação.
Cadastre clientes, agendamentos, metas ou vendas para ativar esta análise.`;
    }
    
    // O prompt enviado para a IA deverá conter somente: Contexto. Nunca regras.
    const prompt = `Contexto Executivo:\n${JSON.stringify(context, null, 2)}`;
    console.log(`[GeminiProvider] Prompt for Gemini: ${prompt.substring(0, 200)}...`);
    
    return `[Gemini AI Interface]
Analizando o contexto executivo do salão ${context.salonId} via Gemini.
O Lumi Brain processou a memória operacional, detectou ${context.opportunities.length} oportunidades e ${context.risks.length} riscos.
Score de saúde: ${context.healthScore}.
O Gemini está pronto para gerar respostas em linguagem natural com base nesses dados puros, sem avaliar as regras de negócios internamente.`;
  }

  async generateInsights(context: ExecutiveContext): Promise<Insight[]> {
    console.log('[GeminiProvider] Mocked insights returned, waiting for real Gemini API integration.');
    return [];
  }

  async generateRecommendations(context: ExecutiveContext): Promise<Recommendation[]> {
    console.log('[GeminiProvider] Mocked recommendations returned, waiting for real Gemini API integration.');
    return [];
  }
}

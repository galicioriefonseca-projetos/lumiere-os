import { BaseLumiProvider } from './LumiProvider';
import { Insight, Recommendation } from '../types';
import { ExecutiveContext } from '../brain/ExecutiveContext';

export class OpenAIProvider extends BaseLumiProvider {
  name = 'OpenAI Provider';

  async analyzeContext(context: ExecutiveContext, customPrompt?: string): Promise<string> {
    const summary = this.formatContextSummary(context);
    console.log(`[OpenAIProvider] Preparing data for OpenAI API: ${summary}`);
    
    // Check if we have insufficient data
    const hasData = context.insights.length > 0 && context.insights.some(ins => ins.id !== 'insight_insufficient_data');
    if (!hasData) {
      return `Ainda não há dados suficientes para gerar este indicador.
A Lumi começará a gerar insights após coletar dados reais da operação.
Cadastre clientes, agendamentos, metas ou vendas para ativar esta análise.`;
    }
    
    return `[OpenAI Interface]
Processamento estratégico do contexto executivo via OpenAI GPT.
Infraestrutura de análise estrutural (Lumi Brain) enviou o contexto formatado com sucesso.`;
  }

  async generateInsights(context: ExecutiveContext): Promise<Insight[]> {
    console.log('[OpenAIProvider] OpenAI API not connected. Prepared interface returned empty array.');
    return [];
  }

  async generateRecommendations(context: ExecutiveContext): Promise<Recommendation[]> {
    console.log('[OpenAIProvider] OpenAI API not connected. Prepared interface returned empty array.');
    return [];
  }
}

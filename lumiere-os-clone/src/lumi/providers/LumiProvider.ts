import { Insight, Recommendation } from '../types';
import { ExecutiveContext } from '../brain/ExecutiveContext';

export interface ILumiProvider {
  name: string;
  analyzeContext(context: ExecutiveContext, customPrompt?: string): Promise<string>;
  generateInsights(context: ExecutiveContext): Promise<Insight[]>;
  generateRecommendations(context: ExecutiveContext): Promise<Recommendation[]>;
}

export abstract class BaseLumiProvider implements ILumiProvider {
  abstract name: string;
  
  abstract analyzeContext(context: ExecutiveContext, customPrompt?: string): Promise<string>;
  
  abstract generateInsights(context: ExecutiveContext): Promise<Insight[]>;
  
  abstract generateRecommendations(context: ExecutiveContext): Promise<Recommendation[]>;
  
  protected formatContextSummary(context: ExecutiveContext): string {
    return `=== Executive Context Summary ===
Salon ID: ${context.salonId}
Top Professionals: ${context.memory.topProfessionals.length}
Opportunities detected: ${context.opportunities.length}
Risks detected: ${context.risks.length}
Health Score: ${context.healthScore}
    `.trim();
  }
}

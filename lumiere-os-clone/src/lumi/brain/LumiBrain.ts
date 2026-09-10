import { BusinessContext, Insight, Alert } from '../types';
import { ExecutiveContext } from './ExecutiveContext';
import { BusinessMemoryBuilder } from './BusinessMemory';
import { ExecutiveSummaryBuilder } from './ExecutiveSummaryBuilder';
import { OpportunityDetector } from './OpportunityDetector';
import { RiskDetector } from './RiskDetector';
import { PerformanceRankingBuilder } from './PerformanceRanking';

export class LumiBrain {
  public static processContext(
    context: BusinessContext, 
    healthScore: number, 
    salonId: string,
    insights: Insight[],
    alerts: Alert[]
  ): ExecutiveContext {
    const memory = BusinessMemoryBuilder.build(context);
    const summary = ExecutiveSummaryBuilder.build(context);
    const opportunities = OpportunityDetector.detect(context);
    const risks = RiskDetector.detect(context);
    const rankings = PerformanceRankingBuilder.build(context);

    return {
      memory,
      summary,
      opportunities,
      risks,
      rankings,
      healthScore,
      insights,
      alerts,
      timestamp: Date.now(),
      salonId
    };
  }
}

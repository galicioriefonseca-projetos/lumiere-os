import { BusinessContext } from '../types';
import { ExecutiveSummary } from './types';

export class ExecutiveSummaryBuilder {
  static build(context: BusinessContext): ExecutiveSummary {
    return {
      dailySummary: "Resumo do dia baseado no contexto atual...",
      weeklySummary: "Resumo da semana baseado no contexto atual...",
      monthlySummary: "Resumo do mês baseado no contexto atual...",
      executiveSummary: "Resumo executivo consolidado da operação."
    };
  }
}

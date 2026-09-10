import { BusinessContext, BusinessMetric, Insight } from '../types';

export class InsightService {
  /**
   * Scans and analyzes business data to construct actionable insights.
   */
  public static generateInsights(context: BusinessContext, metrics: BusinessMetric): Insight[] {
    const insights: Insight[] = [];

    // 1. Insight: Cancellation analysis
    if (metrics.cancelledAppointmentsRate > 15) {
      insights.push({
        id: 'insight_cancellations_high',
        title: 'Vazamento de Receita por Cancelamentos',
        description: `Sua taxa de cancelamento está em ${Math.round(
          metrics.cancelledAppointmentsRate
        )}%, acima do ideal (10%). Isto representa um gargalo na eficiência operacional e indica que as políticas de lembretes automáticos precisam ser intensificadas.`,
        type: 'negative',
        metricRef: 'cancelledAppointmentsRate',
        createdAt: Date.now(),
      });
    } else if (metrics.cancelledAppointmentsRate > 0 && metrics.cancelledAppointmentsRate <= 8) {
      insights.push({
        id: 'insight_cancellations_healthy',
        title: 'Estabilidade na Agenda',
        description: `Sua taxa de cancelamento está sob absoluto controle em apenas ${Math.round(
          metrics.cancelledAppointmentsRate
        )}%. O fluxo de confirmações e compromisso dos clientes está saudável.`,
        type: 'positive',
        metricRef: 'cancelledAppointmentsRate',
        createdAt: Date.now(),
      });
    }

    // 2. Insight: Tuesday Morning Ocupation (Análise de Ociosidade)
    // Check appointments in Tuesday Morning (08:00 to 12:00)
    const appointmentsOnTue = context.appointments.filter((a) => {
      if (!a.date || !a.time) return false;
      const dayOfWeek = new Date(a.date + 'T00:00:00').getDay(); // 0 = Sun, 2 = Tue
      return dayOfWeek === 2;
    });

    const tueMorningAppts = appointmentsOnTue.filter((a) => {
      const hour = parseInt(a.time.split(':')[0]) || 0;
      return hour >= 8 && hour < 12;
    });

    if (context.appointments.length > 5 && appointmentsOnTue.length > 0 && tueMorningAppts.length <= 1) {
      insights.push({
        id: 'insight_tue_morning_idle',
        title: 'Janela de Ociosidade Detectada',
        description: 'Análise de densidade de agenda identificou que as manhãs de terça-feira operam com baixíssima ocupação de agendamentos. Esse período ocioso reduz a produtividade da equipe.',
        type: 'neutral',
        metricRef: 'occupancyRate',
        createdAt: Date.now(),
      });
    }

    // 3. Insight: Stock / Inventory shortage
    if (metrics.lowStockItemsCount > 0) {
      insights.push({
        id: 'insight_stock_warning',
        title: 'Risco de Ruptura de Estoque',
        description: `Existem ${metrics.lowStockItemsCount} produto(s) críticos com quantidade igual ou abaixo do estoque mínimo. Isto pode gerar perda de vendas imediatas de serviços e produtos de prateleira.`,
        type: 'negative',
        metricRef: 'lowStockItemsCount',
        createdAt: Date.now(),
      });
    }

    // 4. Insight: Top service contribution
    if (metrics.topServicesByCount.length > 0) {
      const top = metrics.topServicesByCount[0];
      const contributionPct = metrics.totalRevenue > 0 ? (top.revenue / metrics.totalRevenue) * 100 : 0;
      
      if (contributionPct > 35) {
        insights.push({
          id: 'insight_service_concentration',
          title: `Alta Dependência de Serviço: ${top.serviceName}`,
          description: `O serviço "${top.serviceName}" concentra ${Math.round(
            contributionPct
          )}% de todo o faturamento da empresa. Recomenda-se incentivar a venda cruzada de outros serviços do menu para diluir o risco de concentração.`,
          type: 'neutral',
          metricRef: 'topServicesByCount',
          createdAt: Date.now(),
        });
      } else if (contributionPct > 0) {
        insights.push({
          id: 'insight_top_service_growth',
          title: `Líder de Demanda: ${top.serviceName}`,
          description: `O serviço "${top.serviceName}" continua liderando a preferência dos clientes com ${top.count} agendamentos concluídos neste período, gerando faturamento de R$ ${top.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          type: 'positive',
          metricRef: 'topServicesByCount',
          createdAt: Date.now(),
        });
      }
    }

    // 5. Insight: Client retention & loyalty
    if (context.clients.length > 0) {
      if (metrics.clientRetentionRate > 60) {
        insights.push({
          id: 'insight_retention_excellent',
          title: 'Alto Índice de Fidelização de Clientes',
          description: `Sua taxa de retorno é de ${Math.round(
            metrics.clientRetentionRate
          )}%. Isso demonstra altíssima satisfação pós-serviço e solidez na recorrência do salão.`,
          type: 'positive',
          metricRef: 'clientRetentionRate',
          createdAt: Date.now(),
        });
      } else if (metrics.clientRetentionRate > 0 && metrics.clientRetentionRate < 30) {
        insights.push({
          id: 'insight_retention_low',
          title: 'Vazamento no Funil de Clientes',
          description: `Apenas ${Math.round(
            metrics.clientRetentionRate
          )}% dos clientes cadastrados retornaram para um segundo agendamento. Você está gastando energia para atrair novos clientes que não retornam.`,
          type: 'negative',
          metricRef: 'clientRetentionRate',
          createdAt: Date.now(),
        });
      }
    }

    // Fallback if there is zero data
    if (insights.length === 0) {
      insights.push({
        id: 'insight_insufficient_data',
        title: 'Mapeamento de Padrões em Progresso',
        description: 'Lumi está coletando dados operacionais adicionais sobre agendamentos, estoque e faturamento para consolidar insights estatísticos confiáveis sobre sua operação.',
        type: 'neutral',
        createdAt: Date.now(),
      });
    }

    return insights;
  }
}

import { BusinessContext, BusinessMetric, HealthScore } from '../types';

export class MetricsService {
  /**
   * Consolidates raw BusinessContext data into structured BusinessMetrics.
   */
  public static calculateMetrics(context: BusinessContext): BusinessMetric {
    const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM

    // 1. Total Revenue calculation
    // Revenue from completed comandas
    const completedComandas = context.comandas.filter(
      (c) => c.status === 'completed' && (!c.date || c.date.startsWith(currentMonthStr))
    );
    const comandasRevenue = completedComandas.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

    // Revenue from completed appointments
    const completedAppointments = context.appointments.filter(
      (a) => a.status === 'completed' && (!a.date || a.date.startsWith(currentMonthStr))
    );
    const appointmentsRevenue = completedAppointments.reduce((sum, a) => sum + (a.price || 0), 0);

    const totalRevenue = comandasRevenue + appointmentsRevenue;

    // 2. Average Ticket size
    const totalTransactionsCount = completedComandas.length + completedAppointments.length;
    const averageTicket = totalTransactionsCount > 0 ? totalRevenue / totalTransactionsCount : 0;

    // 3. Occupancy Rate
    // Active appointments (scheduled + confirmed + completed) vs total (including canceled/no-show)
    const activeApptsCount = context.appointments.filter(
      (a) => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'completed'
    ).length;
    const totalApptsCount = context.appointments.length;
    const occupancyRate = totalApptsCount > 0 ? (activeApptsCount / totalApptsCount) * 100 : 0;

    // 4. Cancelled appointments rate
    const cancelledApptsCount = context.appointments.filter((a) => a.status === 'canceled').length;
    const cancelledAppointmentsRate = totalApptsCount > 0 ? (cancelledApptsCount / totalApptsCount) * 100 : 0;

    // 5. Active clients count
    // Clients in CRM stages other than inactive/lost
    const activeClients = context.clients.filter(
      (c) => c.crmStage !== 'inactive_lost' && !c.archived
    );
    const activeClientsCount = activeClients.length;

    // 6. Client Retention Rate (clients with > 1 appointment)
    const clientsWithMultipleAppts = context.clients.filter(
      (c) => (c.totalAppointments || 0) > 1
    ).length;
    const clientRetentionRate = context.clients.length > 0 ? (clientsWithMultipleAppts / context.clients.length) * 100 : 0;

    // 7. Low Stock Items count
    const lowStockItems = context.inventory.filter(
      (item) => item.quantity <= (item.minQuantity ?? 0)
    );
    const lowStockItemsCount = lowStockItems.length;

    // 8. Goal achievement rate
    const currentMonthGoals = context.goals.filter((g) => g.month === currentMonthStr);
    const totalGoalTarget = currentMonthGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    const goalAchievementRate = totalGoalTarget > 0 ? (totalRevenue / totalGoalTarget) * 100 : 0;

    // 9. Revenue by professional
    const revenueByProfessional: Record<string, number> = {};
    completedAppointments.forEach((a) => {
      if (a.professionalId) {
        revenueByProfessional[a.professionalId] = (revenueByProfessional[a.professionalId] || 0) + (a.price || 0);
      }
    });

    // 10. Top services by usage count
    const servicesMap: Record<string, { name: string; count: number; revenue: number }> = {};
    completedAppointments.forEach((a) => {
      if (a.serviceId) {
        const entry = servicesMap[a.serviceId] || { name: a.serviceName || 'Serviço', count: 0, revenue: 0 };
        entry.count += 1;
        entry.revenue += (a.price || 0);
        servicesMap[a.serviceId] = entry;
      }
    });

    const topServicesByCount = Object.entries(servicesMap)
      .map(([serviceId, item]) => ({
        serviceId,
        serviceName: item.name,
        count: item.count,
        revenue: item.revenue,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRevenue,
      averageTicket,
      occupancyRate,
      clientRetentionRate,
      cancelledAppointmentsRate,
      completedAppointmentsCount: completedAppointments.length,
      activeClientsCount,
      lowStockItemsCount,
      goalAchievementRate,
      revenueByProfessional,
      topServicesByCount,
    };
  }

  /**
   * Evaluates the operational Health Score (0-100) of the business based on consolidated metrics.
   */
  public static calculateHealthScore(context: BusinessContext, metrics: BusinessMetric): HealthScore {
    // 1. Pillar: Agenda (Weight: 20%)
    // High occupancy, low cancellations = higher score
    const occupancyFactor = metrics.occupancyRate; // 0 to 100
    const cancellationPenalty = Math.min(40, metrics.cancelledAppointmentsRate * 2); // max penalty of 40%
    const agendaScore = context.appointments.length > 0
      ? Math.min(100, Math.max(10, occupancyFactor - cancellationPenalty + 20)) // base boost
      : 75; // neutral fallback

    let agendaBreakdown = 'Volume de agendamentos está estável e equilibrado.';
    if (metrics.occupancyRate < 35 && context.appointments.length > 0) {
      agendaBreakdown = 'Alerta de baixa ocupação geral. Há muitos horários livres na agenda.';
    } else if (metrics.cancelledAppointmentsRate > 20) {
      agendaBreakdown = 'Taxa de cancelamento elevada. Recomenda-se rever políticas de confirmação.';
    } else if (context.appointments.length > 0) {
      agendaBreakdown = `Agenda operando com excelente ocupação de ${Math.round(metrics.occupancyRate)}%.`;
    }

    // 2. Pillar: Financeiro (Weight: 25%)
    // Base achievement of goals + average ticket healthy check
    let financeScore = 70;
    if (metrics.goalAchievementRate > 0) {
      financeScore = Math.min(100, Math.max(20, metrics.goalAchievementRate));
    } else if (metrics.totalRevenue > 0) {
      // If there are no goals, score based on ticket size average (> R$80 is great)
      financeScore = Math.min(100, Math.max(50, (metrics.averageTicket / 80) * 100));
    }

    let financeBreakdown = 'Faturamento está dentro dos níveis normais de faturamento.';
    if (metrics.goalAchievementRate > 0 && metrics.goalAchievementRate < 50) {
      financeBreakdown = `Abaixo do ritmo planejado para a meta mensal (${Math.round(metrics.goalAchievementRate)}% atingido).`;
    } else if (metrics.goalAchievementRate >= 90) {
      financeBreakdown = `Faturamento excepcional! Batendo ${Math.round(metrics.goalAchievementRate)}% da meta mensal prevista.`;
    } else if (metrics.totalRevenue > 0) {
      financeBreakdown = `Faturamento mensal consolidado em R$ ${metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
    }

    // 3. Pillar: Equipe (Weight: 20%)
    // Evaluates checklist performance run percentage and professional goals achievement
    const checklistRunsWithScore = context.checklistRuns.filter((r) => r.completionPercentage !== undefined);
    const avgChecklistScore = checklistRunsWithScore.length > 0
      ? checklistRunsWithScore.reduce((sum, r) => sum + r.completionPercentage, 0) / checklistRunsWithScore.length
      : 85; // baseline

    // Average progress of professional goals
    const totalProfGoals = context.professionalGoals.length;
    const avgProfGoalProgress = totalProfGoals > 0
      ? context.professionalGoals.reduce((sum, pg) => {
          const target = pg.targetAmount || 0;
          const current = pg.currentValue || 0;
          return sum + (target > 0 ? (current / target) * 100 : 0);
        }, 0) / totalProfGoals
      : 80;

    const equipeScore = Math.min(100, Math.max(30, (avgChecklistScore * 0.5) + (avgProfGoalProgress * 0.5)));
    
    let equipeBreakdown = 'Colaboradores mantêm ritmo constante e bom preenchimento de rotinas.';
    if (avgChecklistScore < 70) {
      equipeBreakdown = 'Baixo engajamento ou nota insatisfatória nos checklists de operação diária.';
    } else if (avgProfGoalProgress < 40 && totalProfGoals > 0) {
      equipeBreakdown = 'Produtividade da equipe está abaixo das metas profissionais estipuladas.';
    }

    // 4. Pillar: Clientes (Weight: 15%)
    // Active CRM clients and retention rating
    const crmRetentionFactor = metrics.clientRetentionRate;
    const activeClientsRatio = context.clients.length > 0
      ? (metrics.activeClientsCount / context.clients.length) * 100
      : 80;

    const clientesScore = Math.min(100, Math.max(20, (crmRetentionFactor * 0.4) + (activeClientsRatio * 0.6)));

    let clientesBreakdown = 'Sua base de clientes cadastrados está engajada.';
    if (metrics.clientRetentionRate < 30 && context.clients.length > 0) {
      clientesBreakdown = 'Baixa taxa de retorno de clientes. Foco em fidelização e CRM necessário.';
    } else if (metrics.activeClientsCount < 5 && context.clients.length > 0) {
      clientesBreakdown = 'Número de leads ativos no funil de vendas está reduzido.';
    } else if (context.clients.length > 0) {
      clientesBreakdown = `${Math.round(metrics.clientRetentionRate)}% de seus clientes já retornaram ao menos uma vez ao salão.`;
    }

    // 5. Pillar: Operação (Weight: 20%)
    // Inventory low stocks, checklist execution regularity
    const stockPenalties = Math.min(70, metrics.lowStockItemsCount * 8); // 8% penalty per low item
    const stockScore = Math.max(10, 100 - stockPenalties);
    
    const checklistFrequencyFactor = context.checklistRuns.length > 0 ? Math.min(100, context.checklistRuns.length * 10) : 70;
    const operacaoScore = Math.min(100, (stockScore * 0.6) + (checklistFrequencyFactor * 0.4));

    let operacaoBreakdown = 'Inventário equilibrado e rotinas operacionais em dia.';
    if (metrics.lowStockItemsCount > 0) {
      operacaoBreakdown = `Alerta: Você possui ${metrics.lowStockItemsCount} produto(s) em falta ou com estoque crítico.`;
    } else if (context.checklistRuns.length === 0) {
      operacaoBreakdown = 'Nenhuma rotina ou checklist diário executado recentemente.';
    }

    // Rounded overall weighted score
    const score = Math.round(
      (agendaScore * 0.20) +
      (financeScore * 0.25) +
      (equipeScore * 0.20) +
      (clientesScore * 0.15) +
      (operacaoScore * 0.20)
    );

    return {
      score,
      areas: {
        agenda: Math.round(agendaScore),
        financeiro: Math.round(financeScore),
        equipe: Math.round(equipeScore),
        clientes: Math.round(clientesScore),
        operacao: Math.round(operacaoScore),
      },
      breakdown: {
        agenda: agendaBreakdown,
        financeiro: financeBreakdown,
        equipe: equipeBreakdown,
        clientes: clientesBreakdown,
        operacao: operacaoBreakdown,
      },
    };
  }
}

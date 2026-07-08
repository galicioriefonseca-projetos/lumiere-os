import { BusinessContext, BusinessMetric, Recommendation } from '../types';

export class RecommendationService {
  /**
   * Evaluates metrics and context to output high-impact, actionable business recommendations.
   */
  public static generateRecommendations(context: BusinessContext, metrics: BusinessMetric): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 1. Recommendation: Increase team capacity
    // If occupancy is super high (> 80%), indicating high demand, and we are near or over our professional limit
    if (metrics.occupancyRate > 80 && context.professionals.length > 0) {
      recommendations.push({
        id: 'rec_expand_team',
        title: 'Expansão Estratégica: Aumente sua Equipe em 1 Profissional',
        description: `Sua taxa de ocupação média de agenda atingiu ${Math.round(
          metrics.occupancyRate
        )}%. Com profissionais operando perto do limite, você está recusando agendamentos. Recrutar mais um profissional aumentará sua capacidade imediata e faturamento estimado em até 20%.`,
        impact: 'high',
        category: 'hr',
        actionText: 'Convidar Profissional',
        actionUrl: '/equipe',
        isApplied: false,
        createdAt: Date.now(),
      });
    }

    // 2. Recommendation: Low occupancy promotion on Tuesday mornings
    // Check if Tuesday Morning has low occupation
    const appointmentsOnTue = context.appointments.filter((a) => {
      if (!a.date || !a.time) return false;
      const dayOfWeek = new Date(a.date + 'T00:00:00').getDay();
      return dayOfWeek === 2;
    });
    const tueMorningAppts = appointmentsOnTue.filter((a) => {
      const hour = parseInt(a.time.split(':')[0]) || 0;
      return hour >= 8 && hour < 12;
    });

    if (context.appointments.length > 5 && appointmentsOnTue.length > 0 && tueMorningAppts.length <= 1) {
      recommendations.push({
        id: 'rec_tue_morning_promo',
        title: 'Campanha Terça-Feira Clássica: Preencher Janela Ociosa',
        description: 'Foi identificado que as terças pela manhã têm baixíssima ocupação. Crie uma ação promocional rápida (ex: 15% de desconto em serviços de escova ou barba) focada especificamente nessa faixa de horário para atrair clientes de folga ou home office.',
        impact: 'medium',
        category: 'marketing',
        actionText: 'Criar Promoção',
        actionUrl: '/servicos',
        isApplied: false,
        createdAt: Date.now(),
      });
    }

    // 3. Recommendation: Low Ticket average
    // If ticket average is low (< R$ 60), suggest cross-selling combos
    if (metrics.averageTicket > 0 && metrics.averageTicket < 60) {
      recommendations.push({
        id: 'rec_upsell_combos',
        title: 'Eleve seu Ticket Médio com Combos de Serviços',
        description: `Seu ticket médio atual está em R$ ${Math.round(
          metrics.averageTicket
        )}. Ofereça um serviço complementar (ex: Hidratação rápida na lavagem por R$ 25 adicionais) para elevar o valor da comanda durante a finalização no balcão.`,
        impact: 'high',
        category: 'finance',
        actionText: 'Ajustar Serviços',
        actionUrl: '/servicos',
        isApplied: false,
        createdAt: Date.now(),
      });
    }

    // 4. Recommendation: Client retention loyalty campaigns
    if (metrics.clientRetentionRate > 0 && metrics.clientRetentionRate < 45) {
      recommendations.push({
        id: 'rec_vip_retention',
        title: 'Campanha de Recorrência para Clientes Premium',
        description: `Sua taxa de retorno está abaixo do padrão ideal de mercado. Crie um canal de contato ativo pelo WhatsApp direcionado aos clientes que realizaram serviços premium há mais de 40 dias para agendamento de retorno preventivo.`,
        impact: 'high',
        category: 'marketing',
        actionText: 'Abrir Gestor CRM',
        actionUrl: '/clientes',
        isApplied: false,
        createdAt: Date.now(),
      });
    }

    // 5. Recommendation: Stock replenishments
    if (metrics.lowStockItemsCount > 0) {
      const lowItems = context.inventory.filter((item) => item.quantity <= (item.minQuantity ?? 0));
      const firstItemName = lowItems[0]?.name || 'produtos críticos';
      recommendations.push({
        id: 'rec_restock_urgent',
        title: `Pedido de Reposição Urgente: ${firstItemName}`,
        description: `Você possui ${metrics.lowStockItemsCount} produto(s) críticos abaixo do limite de segurança. Entre em contato com seu distribuidor para repor o estoque e evitar a interrupção da execução de procedimentos profissionais.`,
        impact: 'high',
        category: 'stock',
        actionText: 'Ir para Almoxarifado',
        actionUrl: '/estoque',
        isApplied: false,
        createdAt: Date.now(),
      });
    }

    // Default recommendation if there's very little data
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'rec_onboard_complete',
        title: 'Mapeamento de Metas de Produtividade',
        description: 'Configure metas corporativas gerais e individuais para cada um de seus profissionais. Isto alimentará o motor de projeções Lumi com objetivos reais para calibrar as recomendações de contratação e faturamento.',
        impact: 'medium',
        category: 'operations',
        actionText: 'Configurar Metas',
        actionUrl: '/metas',
        isApplied: false,
        createdAt: Date.now(),
      });
    }

    return recommendations;
  }
}

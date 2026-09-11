import type { PublicPlanId } from './planPricing';

export type PlanFeature =
  | 'operation'
  | 'team'
  | 'goals'
  | 'commissions'
  | 'checklists'
  | 'performance'
  | 'crm'
  | 'financial'
  | 'advanced_reports'
  | 'ai'
  | 'automation'
  | 'multiunit';

/** Matriz comercial centralizada: cada plano libera um conjunto de ferramentas. */
const PLAN_FEATURES: Record<PublicPlanId, readonly PlanFeature[]> = {
  essential: ['operation'],
  professional: ['operation', 'team', 'goals', 'commissions', 'checklists', 'performance', 'crm', 'financial', 'advanced_reports'],
  performance_plus: ['operation', 'team', 'goals', 'commissions', 'checklists', 'performance', 'crm', 'financial', 'advanced_reports', 'ai', 'automation'],
  multiunit: ['operation', 'team', 'goals', 'commissions', 'checklists', 'performance', 'crm', 'financial', 'advanced_reports', 'ai', 'automation', 'multiunit'],
  enterprise_custom: ['operation', 'team', 'goals', 'commissions', 'checklists', 'performance', 'crm', 'financial', 'advanced_reports', 'ai', 'automation', 'multiunit'],
};

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  operation: 'Operação',
  team: 'Gestão de equipe',
  goals: 'Metas',
  commissions: 'Comissões',
  checklists: 'Checklists',
  performance: 'Desempenho da equipe',
  crm: 'CRM',
  financial: 'Financeiro completo',
  advanced_reports: 'Relatórios avançados',
  ai: 'Lumi — IA',
  automation: 'Automação',
  multiunit: 'Gestão multiunidade',
};

export function hasPlanFeature(planId: string | null | undefined, feature: PlanFeature): boolean {
  if (!planId) return false;
  return (PLAN_FEATURES[planId as PublicPlanId] ?? []).includes(feature);
}

export function requiredPlanForFeature(feature: PlanFeature): PublicPlanId {
  if (['ai', 'automation'].includes(feature)) return 'performance_plus';
  if (feature === 'multiunit') return 'multiunit';
  if (feature === 'operation') return 'essential';
  return 'professional';
}

export function getPlanFeatureMatrix() {
  return PLAN_FEATURES;
}

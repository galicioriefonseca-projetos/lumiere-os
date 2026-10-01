import type { PublicPlanId } from './planPricing';
import { getCommercialPlan, type PlanModule } from '../../shared/commercialPlanCatalog';

export type PlanFeature = PlanModule;

/**
 * Legacy matrix retained for existing callers/data. New code should use the
 * canonical plan IDs (start/pro/business/enterprise), which resolve through
 * the shared commercial catalog.
 */
const PLAN_FEATURES: Record<Exclude<PublicPlanId, 'start' | 'pro' | 'business' | 'enterprise'>, readonly PlanFeature[]> = {
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
  const canonical = getCommercialPlan(planId);
  if (canonical) return canonical.modules.includes(feature);
  return (PLAN_FEATURES[planId as keyof typeof PLAN_FEATURES] ?? []).includes(feature);
}

export function requiredPlanForFeature(feature: PlanFeature): PublicPlanId {
  if (['ai', 'automation'].includes(feature)) return 'business';
  if (feature === 'multiunit') return 'enterprise';
  if (feature === 'operation') return 'start';
  return 'pro';
}

export function getPlanFeatureMatrix() {
  return PLAN_FEATURES;
}

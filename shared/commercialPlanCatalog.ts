export type CanonicalPlanId = 'start' | 'pro' | 'business' | 'enterprise';
export type SubscriptionSource = 'direct' | 'gf_bundle';

export type PlanModule =
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

export interface CommercialPlanDefinition {
  id: CanonicalPlanId;
  name: string;
  description: string;
  monthlyPrice: number | null;
  customPricing?: boolean;
  modules: readonly PlanModule[];
  legacyIds: readonly string[];
}

/**
 * Canonical commercial catalog for the platform.
 * Existing legacy IDs remain supported and are resolved through LEGACY_PLAN_IDS.
 * Keep prices here as the single source for new platform-level integrations.
 */
export const COMMERCIAL_PLANS: readonly CommercialPlanDefinition[] = [
  {
    id: 'start',
    name: 'Lumière Start',
    description: 'Para organizar a operação e centralizar a gestão essencial do negócio.',
    monthlyPrice: 197,
    modules: ['operation'],
    legacyIds: ['essential'],
  },
  {
    id: 'pro',
    name: 'Lumière Pro',
    description: 'Para empresas que precisam de gestão de equipe, metas, relacionamento e resultados.',
    monthlyPrice: 397,
    modules: [
      'operation',
      'team',
      'goals',
      'commissions',
      'checklists',
      'performance',
      'crm',
      'financial',
      'advanced_reports',
    ],
    legacyIds: ['professional'],
  },
  {
    id: 'business',
    name: 'Lumière Business',
    description: 'Para operações que precisam de inteligência, análises e automação avançada.',
    monthlyPrice: 597,
    modules: [
      'operation',
      'team',
      'goals',
      'commissions',
      'checklists',
      'performance',
      'crm',
      'financial',
      'advanced_reports',
      'ai',
      'automation',
    ],
    legacyIds: ['performance_plus'],
  },
  {
    id: 'enterprise',
    name: 'Lumière Enterprise',
    description: 'Para operações de maior porte com recursos avançados e necessidades personalizadas.',
    monthlyPrice: 797,
    modules: [
      'operation',
      'team',
      'goals',
      'commissions',
      'checklists',
      'performance',
      'crm',
      'financial',
      'advanced_reports',
      'ai',
      'automation',
      'multiunit',
    ],
    legacyIds: ['multiunit', 'enterprise_custom'],
  },
];

export const LEGACY_PLAN_IDS: Readonly<Record<string, CanonicalPlanId>> = {
  essential: 'start',
  professional: 'pro',
  performance_plus: 'business',
  multiunit: 'enterprise',
  enterprise_custom: 'enterprise',
  start: 'start',
  founder: 'pro',
  performance: 'business',
  network: 'enterprise',
  enterprise: 'enterprise',
};

export function canonicalPlanId(planId: string | null | undefined): CanonicalPlanId | null {
  if (!planId) return null;
  return LEGACY_PLAN_IDS[planId] ?? null;
}

export function getCommercialPlan(planId: string | null | undefined): CommercialPlanDefinition | null {
  const canonical = canonicalPlanId(planId);
  return COMMERCIAL_PLANS.find(plan => plan.id === canonical) ?? null;
}

export function hasCommercialModule(
  planId: string | null | undefined,
  module: PlanModule,
): boolean {
  return getCommercialPlan(planId)?.modules.includes(module) ?? false;
}

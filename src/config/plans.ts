import { PlanType } from '../types';

export interface PlanConfig {
  planValue: PlanType;
  name: string;
  monthlyAmount: number;
  founderDurationDays?: number;
  nextAmount?: number;
  accessLevel: 'basic' | 'standard' | 'advanced' | 'full';
  includesFutureUpdates: boolean;
  maxProfessionals: number;
  features: string[];
}

export const PLANS_CONFIG: Record<PlanType, PlanConfig> = {
  start: {
    planValue: 'start',
    name: 'Start',
    monthlyAmount: 197,
    accessLevel: 'basic',
    includesFutureUpdates: false,
    maxProfessionals: 5,
    features: [
      'Até 5 profissionais',
      'Configurações Básicas',
      'Checklist operacional básico',
      'Agenda de Horários'
    ]
  },
  studio: {
    planValue: 'studio',
    name: 'Studio',
    monthlyAmount: 397,
    accessLevel: 'standard',
    includesFutureUpdates: false,
    maxProfessionals: 10,
    features: [
      'Até 10 profissionais',
      'Gestão de Categorias',
      'Histórico de checklists',
      'Metas por equipe',
      'Agendamentos completos'
    ]
  },
  performance: {
    planValue: 'performance',
    name: 'Performance',
    monthlyAmount: 597,
    accessLevel: 'advanced',
    includesFutureUpdates: false,
    maxProfessionals: 20,
    features: [
      'Até 20 profissionais',
      'Gestão de Comissões',
      'Avaliações',
      'Gamificação',
      'Insights IA e Relatórios avançados'
    ]
  },
  network: {
    planValue: 'network',
    name: 'Network',
    monthlyAmount: 997,
    accessLevel: 'full',
    includesFutureUpdates: true,
    maxProfessionals: 999, // unlimited
    features: [
      'Profissionais Ilimitados',
      'Gestão Multiunidade',
      'Painel Master de Rede',
      'Relatórios Executivos',
      'Suporte prioritário vIP'
    ]
  },
  founder: {
    planValue: 'founder',
    name: 'Founder / Piloto',
    monthlyAmount: 297,
    founderDurationDays: 90,
    nextAmount: 397,
    accessLevel: 'full',
    includesFutureUpdates: true,
    maxProfessionals: 22,
    features: [
      'Até 22 profissionais',
      'Acesso Completo a todos os recursos',
      'Sem bloqueios ou limites restritos',
      'Atualizações futuras inclusas',
      'Checklist Essenza',
      'Metas por equipe',
      'Relatórios e Indicadores',
      'Suporte prioritário e implantação assistida'
    ]
  }
};

/**
 * Returns whether a salon with a given plan has a feature.
 * For "founder" plan, it ALWAYS returns true for any active features.
 */
export function hasPlanFeature(plan: PlanType | string | undefined, feature: string): boolean {
  if (!plan) return false;
  const normalizedPlan = plan.toLowerCase() as PlanType;
  
  // Founder plan has access to ALL features in the system!
  if (normalizedPlan === 'founder') {
    return true;
  }

  // Network also has access to all features
  if (normalizedPlan === 'network') {
    return true;
  }

  const config = PLANS_CONFIG[normalizedPlan];
  if (!config) return false;

  // Manual list of features matching the specs (founder and network already returned true above)
  if (feature === 'reports' || feature === 'relatorios') {
    return normalizedPlan === 'performance';
  }

  if (feature === 'commissions' || feature === 'comissoes') {
    return normalizedPlan === 'performance';
  }

  if (feature === 'checklist' || feature === 'checklist_essenza') {
    return normalizedPlan === 'studio' || normalizedPlan === 'performance';
  }

  if (feature === 'goals' || feature === 'metas') {
    return normalizedPlan === 'studio' || normalizedPlan === 'performance';
  }

  return true;
}

/**
 * Helper to get access level of a plan.
 */
export function getPlanAccessLevel(plan: PlanType | string | undefined): 'basic' | 'standard' | 'advanced' | 'full' {
  if (!plan) return 'basic';
  const normalizedPlan = plan.toLowerCase() as PlanType;
  
  if (normalizedPlan === 'founder') {
    return 'full';
  }

  const config = PLANS_CONFIG[normalizedPlan];
  return config ? config.accessLevel : 'basic';
}

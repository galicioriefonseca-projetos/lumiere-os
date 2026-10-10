import { useMemo } from 'react';
import { Plan } from '@/billing/types';
import { planCatalog } from '../config/planPricing';

/**
 * Catálogo comercial oficial do LumièreOS.
 */
export function usePlans() {
  const plans = useMemo<Plan[]>(() => {
    const catalogPlans = planCatalog.plans
      .filter((plan: any) => plan.id !== 'founder')
      .map((plan: any, index: number) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: Number(plan.monthlyPrice || 0),
        billingCycle: 'MONTHLY' as const,
        trialDays: 0,
        features: Array.isArray(plan.features) ? plan.features : [],
        active: plan.active !== false,
        displayOrder: index + 1,
        color: '#D4AF37',
        badge: plan.badge || undefined,
        maxProfessionals: plan.maxProfessionals ?? undefined,
        customPricing: plan.customPricing ?? false,
      }));

    const perfPlan = catalogPlans.find(p => p.id === 'performance') || catalogPlans.find(p => p.id === 'professional')!;
    const aliases = [
      { ...perfPlan, id: 'performance_plus', legacy: true },
      { ...catalogPlans.find(p => p.id === 'multiunit')!, id: 'network', legacy: true },
      { ...catalogPlans.find(p => p.id === 'essential')!, id: 'start', legacy: true },
    ] as unknown as Plan[];

    return [...catalogPlans, ...aliases];
  }, []);

  const getPlan = (id: string) => plans.find(p => p.id === id);

  return { plans, loading: false, getPlan };
}

import catalog from './planCatalog.json';
import { getCommercialPlan, type CanonicalPlanId } from '../../shared/commercialPlanCatalog';

export type LegacyPlanId = 'essential' | 'professional' | 'performance_plus' | 'multiunit' | 'enterprise_custom';
export type PublicPlanId = LegacyPlanId | CanonicalPlanId;
export type PublicBillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

export function getPlanPrice(planId: PublicPlanId, cycle: PublicBillingCycle): number | null {
  const canonical = getCommercialPlan(planId);
  const monthlyPrice = canonical?.monthlyPrice ?? catalog.plans.find(item => item.id === planId)?.monthlyPrice ?? null;
  if (monthlyPrice == null) return null;
  if (cycle === 'MONTHLY') return monthlyPrice;
  const months = cycle === 'SEMIANNUALLY' ? 6 : 12;
  const discount = cycle === 'SEMIANNUALLY' ? catalog.discounts.semiannual : catalog.discounts.annual;
  return Math.round(monthlyPrice * months * (1 - discount));
}

export function getEquivalentMonthly(planId: PublicPlanId, cycle: PublicBillingCycle): number | null {
  const price = getPlanPrice(planId, cycle);
  if (price == null) return null;
  const months = cycle === 'MONTHLY' ? 1 : cycle === 'SEMIANNUALLY' ? 6 : 12;
  return price / months;
}

export { catalog as planCatalog };

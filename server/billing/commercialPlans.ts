import { Plan, BillingCycle } from './types.js';
import {
  COMMERCIAL_PLANS,
  canonicalPlanId,
  getCommercialPlan,
} from '../../shared/commercialPlanCatalog.js';

const LEGACY_PRICE_BY_ID: Record<string, number | null> = {
  essential: 197,
  professional: 397,
  performance_plus: 597,
  multiunit: 897,
  enterprise_custom: null,
};

/**
 * Compatibility layer for the existing billing records.
 * Existing Firestore/Asaas IDs are preserved; new code can use canonical IDs.
 */
export function normalizePlanId(planId: string): string {
  return canonicalPlanId(planId) ?? planId;
}

export function isCommercialPlanId(planId: string): boolean {
  return canonicalPlanId(planId) !== null;
}

export function commercialPlan(planId: string): Plan | null {
  const canonical = canonicalPlanId(planId);
  const definition = getCommercialPlan(planId);
  if (!canonical || !definition) return null;

  // Preserve the legacy multiunit price for existing subscriptions. New Enterprise
  // contracts use the canonical R$797 starting price defined in the shared catalog.
  const legacyPrice = LEGACY_PRICE_BY_ID[planId];
  const monthly = legacyPrice !== undefined
    ? legacyPrice
    : definition.monthlyPrice;

  const semiannual = monthly == null ? undefined : Math.round(monthly * 6 * 0.90);
  const annual = monthly == null ? undefined : Math.round(monthly * 12 * 0.85);

  return {
    id: canonical,
    name: definition.name,
    description: definition.description,
    price: monthly ?? 0,
    semiannualPrice: semiannual,
    annualPrice: annual,
    billingCycle: 'MONTHLY' as BillingCycle,
    trialDays: 0,
    features: [...definition.modules],
    active: true,
    displayOrder: COMMERCIAL_PLANS.findIndex(item => item.id === canonical) + 1,
    color: '#D4AF37',
    // Kept for backward compatibility. Commercial access is now module-based.
    maxProfessionals: undefined,
    customPricing: definition.customPricing ?? false,
  };
}

export function commercialPlanPrice(planId: string, cycle: BillingCycle): number | null {
  const plan = commercialPlan(planId);
  if (!plan || plan.customPricing) return null;
  if (cycle === 'MONTHLY') return plan.price;
  return cycle === 'SEMIANNUALLY' ? plan.semiannualPrice ?? null : plan.annualPrice ?? null;
}

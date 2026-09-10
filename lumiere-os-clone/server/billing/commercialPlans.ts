import { Plan, BillingCycle } from './types.js';

/**
 * Catálogo comercial autoritativo para o backend de billing.
 * Não depende do seed legado da coleção Firestore `plans`.
 */
const MONTHLY_PRICES: Record<string, number | null> = {
  essential: 197,
  professional: 397,
  performance_plus: 597,
  multiunit: 897,
  enterprise_custom: null,
};

const NAMES: Record<string, string> = {
  essential: 'Essencial',
  professional: 'Profissional',
  performance_plus: 'Performance',
  multiunit: 'Multiunidade',
  enterprise_custom: 'Enterprise',
};

const MAX_PROFESSIONALS: Record<string, number | undefined> = {
  essential: 5,
  professional: 15,
  performance_plus: 30,
  multiunit: 60,
  enterprise_custom: undefined,
};

const LEGACY_TO_PUBLIC: Record<string, string> = {
  start: 'essential',
  founder: 'professional',
  performance: 'performance_plus',
  network: 'multiunit',
  enterprise: 'enterprise_custom',
};

export function normalizePlanId(planId: string): string {
  return LEGACY_TO_PUBLIC[planId] || planId;
}

export function isCommercialPlanId(planId: string): boolean {
  return Object.prototype.hasOwnProperty.call(MONTHLY_PRICES, normalizePlanId(planId));
}

export function commercialPlan(planId: string): Plan | null {
  const id = normalizePlanId(planId);
  if (!isCommercialPlanId(id)) return null;

  const monthly = MONTHLY_PRICES[id];
  const semiannual = monthly == null ? undefined : Math.round(monthly * 6 * 0.90);
  const annual = monthly == null ? undefined : Math.round(monthly * 12 * 0.85);

  return {
    id,
    name: NAMES[id],
    description: `Plano comercial ${NAMES[id]} do LumièreOS.`,
    price: monthly ?? 0,
    semiannualPrice: semiannual,
    annualPrice: annual,
    billingCycle: 'MONTHLY' as BillingCycle,
    trialDays: 0,
    features: [],
    active: true,
    displayOrder: Object.keys(MONTHLY_PRICES).indexOf(id) + 1,
    color: '#D4AF37',
    maxProfessionals: MAX_PROFESSIONALS[id],
    customPricing: monthly == null,
  };
}

export function commercialPlanPrice(planId: string, cycle: BillingCycle): number | null {
  const plan = commercialPlan(planId);
  if (!plan || plan.customPricing) return null;
  if (cycle === 'MONTHLY') return plan.price;
  return cycle === 'SEMIANNUALLY' ? plan.semiannualPrice ?? null : plan.annualPrice ?? null;
}

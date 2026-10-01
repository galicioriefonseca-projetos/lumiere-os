import type { CanonicalPlanId, SubscriptionSource } from './commercialPlanCatalog.js';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'canceled'
  | 'pending';

export interface SubscriptionEntitlement {
  tenantId: string;
  planId: CanonicalPlanId;
  source: SubscriptionSource;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt?: string | null;
  sourceReference?: string | null;
}

export interface SubscriptionRecord extends SubscriptionEntitlement {
  provider: 'asaas' | 'manual' | 'other';
  providerSubscriptionId?: string | null;
  billingCycle: 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';
  nextBillingDate?: string | null;
  cancelAt?: string | null;
}

/**
 * GF 360 grants the same canonical Lumière Pro entitlement as a direct Pro
 * subscription. It is deliberately represented as an origin, not as another plan.
 */
export function isActiveEntitlement(entitlement: SubscriptionEntitlement | null | undefined): boolean {
  if (!entitlement) return false;
  if (entitlement.status !== 'active' && entitlement.status !== 'trialing') return false;

  if (entitlement.endsAt) {
    const end = Date.parse(entitlement.endsAt);
    if (!Number.isNaN(end) && end < Date.now()) return false;
  }

  return true;
}

export function isGfBundlePro(entitlement: SubscriptionEntitlement | null | undefined): boolean {
  return Boolean(
    entitlement &&
      entitlement.source === 'gf_bundle' &&
      entitlement.planId === 'pro' &&
      isActiveEntitlement(entitlement),
  );
}

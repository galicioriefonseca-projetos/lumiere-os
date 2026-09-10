import { describe, expect, it } from 'vitest';
import { getEquivalentMonthly, getPlanPrice } from './planPricing';

describe('LumièreOS public plan pricing', () => {
  it('keeps the Professional plan at R$397 monthly', () => {
    expect(getPlanPrice('professional', 'MONTHLY')).toBe(397);
  });

  it('applies 10% semestral discount', () => {
    expect(getPlanPrice('professional', 'SEMIANNUALLY')).toBe(2144);
    expect(getEquivalentMonthly('professional', 'SEMIANNUALLY')).toBeCloseTo(357.3333, 3);
  });

  it('applies 15% annual discount', () => {
    expect(getPlanPrice('professional', 'YEARLY')).toBe(4049);
    expect(getEquivalentMonthly('professional', 'YEARLY')).toBeCloseTo(337.4167, 3);
  });

  it('does not expose a public price for Enterprise', () => {
    expect(getPlanPrice('enterprise_custom', 'MONTHLY')).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Billing Security', () => {
  it('keeps Asaas webhook authentication fail-closed', () => {
    const source = readSource('server/routes/billing/webhook.ts');

    expect(source).toContain("if (!configuredToken || !receivedToken || receivedToken !== configuredToken)");
    expect(source).toContain("return res.status(401).json({ error: 'Não autorizado' });");
    expect(source).not.toContain("if (billingSettings?.webhookToken && token !== billingSettings.webhookToken)");
  });

  it('does not create Asaas customers with fake CPF or phone fallbacks', () => {
    const source = readSource('server/billing/BillingService.ts');

    expect(source).toContain("if (!name || !email || !cpfCnpj)");
    expect(source).not.toContain("'25068355801'");
    expect(source).not.toContain("'11999999999'");
  });

  it('does not activate a new plan before payment confirmation', () => {
    const service = readSource('server/billing/BillingService.ts');

    expect(service).toContain("'billing.pendingPlanId': newPlanId");
    expect(service).toContain("'billing.status': 'PENDING_PAYMENT'");
    expect(service).toContain("if (isPaymentConfirmed && currentBilling.pendingPlanId)");
    expect(service).toContain("billingUpdate.planId = confirmedPlanId");
  });
});

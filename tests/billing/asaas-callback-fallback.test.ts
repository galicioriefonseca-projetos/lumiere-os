import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsaasProvider } from '../../server/billing/AsaasProvider.js';

describe('AsaasProvider Callback Fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries without callback when Asaas returns domain not configured error', async () => {
    const provider = new AsaasProvider();

    let callCount = 0;
    const recordedBodies: any[] = [];

    global.fetch = vi.fn().mockImplementation(async (_url: string, options: any) => {
      callCount++;
      const body = options?.body ? JSON.parse(options.body) : null;
      recordedBodies.push(body);

      if (callCount === 1) {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({
            errors: [
              {
                code: 'invalid_object',
                description: 'Não há nenhum domínio configurado em sua conta. Cadastre um site em Minha Conta na aba Informações.'
              }
            ]
          })
        };
      }

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          id: 'sub_test123',
          customer: 'cus_test',
          value: 197,
          billingType: 'CREDIT_CARD',
          status: 'ACTIVE',
          cycle: 'MONTHLY'
        })
      };
    });

    const result = await provider.createSubscription('sandbox', 'test-key', {
      customer: 'cus_test',
      value: 197,
      billingType: 'CREDIT_CARD',
      cycle: 'MONTHLY',
      callback: {
        successUrl: 'https://ais-dev.run.app/aguardando-pagamento?payment=success',
        autoRedirect: true
      }
    });

    expect(callCount).toBe(2);
    expect(recordedBodies[0].callback).toBeDefined();
    expect(recordedBodies[1].callback).toBeUndefined();
    expect(result.id).toBe('sub_test123');
  });
});

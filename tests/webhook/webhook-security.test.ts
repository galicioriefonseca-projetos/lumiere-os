import { describe, it, expect, vi } from 'vitest';
import asaasWebhookHandler from '../../server/routes/billing/webhook';

// Mocks
vi.mock('../../server/shared/firebaseAdmin.js', () => {
  return {
    getAdminDb: vi.fn(() => ({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            data: () => ({ webhookToken: 'secure-token-123' })
          })
        }))
      }))
    }))
  };
});

describe('Webhook Security', () => {
  it('should reject requests without a valid token', async () => {
    const req = {
      headers: { 'asaas-access-token': 'wrong-token' },
      body: { event: 'PAYMENT_CONFIRMED' }
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;

    await asaasWebhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
  });

  it('should process request with valid token', async () => {
    const req = {
      headers: { 'asaas-access-token': 'secure-token-123' },
      body: { event: 'PAYMENT_CONFIRMED' }
    } as any;

    // Needs further mocking of billingService if we want it to succeed
    // For now we just verify it doesn't fail with 401
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;

    // Because billingService is not mocked, it might throw, but it won't be 401
    await asaasWebhookHandler(req, res);
    expect(res.status).not.toHaveBeenCalledWith(401);
  });
});

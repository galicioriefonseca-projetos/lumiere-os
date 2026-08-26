import { describe, it, expect, vi } from 'vitest';
import asaasWebhookHandler from '../../server/routes/billing/webhook';

const handleWebhook = vi.fn().mockResolvedValue(undefined);

vi.mock('../../server/shared/firebaseAdmin.js', () => ({
  getAdminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          data: () => ({ webhookToken: 'secure-token-123' })
        })
      }))
    }))
  }))
}));

vi.mock('../../server/billing/BillingService.js', () => ({
  billingService: { handleWebhook }
}));

describe('Webhook Security', () => {
  const makeResponse = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as any);

  it('should reject requests without a valid token', async () => {
    const req = {
      method: 'POST',
      headers: { 'asaas-access-token': 'wrong-token' },
      body: { event: 'PAYMENT_CONFIRMED' }
    } as any;
    const res = makeResponse();

    await asaasWebhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
    expect(handleWebhook).not.toHaveBeenCalled();
  });

  it('should reject requests without the Asaas token', async () => {
    const req = {
      method: 'POST',
      headers: {},
      body: { event: 'PAYMENT_CONFIRMED' }
    } as any;
    const res = makeResponse();

    await asaasWebhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
    expect(handleWebhook).not.toHaveBeenCalled();
  });

  it('should process request with the valid Asaas token', async () => {
    const req = {
      method: 'POST',
      headers: { 'asaas-access-token': 'secure-token-123' },
      body: { event: 'PAYMENT_CONFIRMED' }
    } as any;
    const res = makeResponse();

    await asaasWebhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(handleWebhook).toHaveBeenCalledWith('PAYMENT_CONFIRMED', req.body);
  });
});

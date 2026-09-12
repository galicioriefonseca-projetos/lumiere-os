import { describe, it, expect, vi, beforeEach } from 'vitest';
import asaasWebhookHandler from '../../server/routes/billing/webhook';

// Mocks
const mockSet = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});

const mockSalonData = {
  id: 'salon-123',
  name: 'Studio Beleza Pura',
  ownerId: 'user-456',
  ownerEmail: 'dono@belezapura.com',
  ownerName: 'Maria Silva',
  plan: 'pro',
  onboardingCompleted: false
};

const mockSalonDoc = {
  exists: true,
  id: 'salon-123',
  data: () => mockSalonData
};

const mockGet = vi.fn((path?: string) => {
  return Promise.resolve(mockSalonDoc);
});

vi.mock('../../server/shared/firebaseAdmin.js', () => {
  return {
    getAdminDb: vi.fn(() => ({
      collection: vi.fn((colName: string) => ({
        doc: vi.fn((docId: string) => {
          if (colName === 'settings' && docId === 'asaas') {
            return {
              get: vi.fn().mockResolvedValue({
                data: () => ({ webhookToken: 'valid-secret-token' })
              })
            };
          }
          return {
            get: mockGet,
            set: mockSet,
            update: mockUpdate
          };
        }),
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              docs: [mockSalonDoc]
            })
          }))
        }))
      }))
    }))
  };
});

// Mock billingService
vi.mock('../../server/billing/BillingService.js', () => ({
  billingService: {
    handleWebhook: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock email service
const mockSendCompanySetupEmail = vi.fn().mockResolvedValue({ sent: true, messageId: 'msg-123' });
vi.mock('../../server/shared/email.js', () => ({
  sendCompanySetupEmail: (...args: any[]) => mockSendCompanySetupEmail(...args),
  sendEmail: vi.fn().mockResolvedValue({ sent: true })
}));

describe('Webhook Payment Confirmation & Setup Email Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('activates salon and sends setup email on PAYMENT_CONFIRMED', async () => {
    const req = {
      method: 'POST',
      headers: { 'asaas-access-token': 'valid-secret-token' },
      body: {
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay_123',
          customer: 'cus_789',
          customerEmail: 'dono@belezapura.com',
          value: 129.90
        }
      }
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;

    await asaasWebhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });

    // Verifica se atualizou o salão para 'active'
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'active',
        subscriptionStatus: 'active',
        isActive: true,
        onboardingStatus: 'pending_setup'
      }),
      { merge: true }
    );

    // Verifica se disparou o e-mail transacional com a rota /dashboard/configurar-empresa contendo o token
    expect(mockSendCompanySetupEmail).toHaveBeenCalledTimes(1);
    const emailCallArg = mockSendCompanySetupEmail.mock.calls[0][0];
    expect(emailCallArg.to).toBe('dono@belezapura.com');
    expect(emailCallArg.setupUrl).toContain('/dashboard/configurar-empresa?token=');
  });

  it('activates salon and sends setup email on PAYMENT_RECEIVED', async () => {
    const req = {
      method: 'POST',
      headers: { 'asaas-access-token': 'valid-secret-token' },
      body: {
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_456',
          customer: 'cus_789',
          customerEmail: 'dono@belezapura.com',
          value: 129.90
        }
      }
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;

    await asaasWebhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSendCompanySetupEmail).toHaveBeenCalledTimes(1);
  });
});

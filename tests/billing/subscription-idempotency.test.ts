import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  asaas: {
    testConnection: vi.fn(),
    createCustomer: vi.fn(),
    getSubscription: vi.fn(),
    listSubscriptions: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    getPaymentsBySubscription: vi.fn(),
    getPixQrCode: vi.fn(),
    getBoleto: vi.fn()
  },
  db: {
    settingsExists: true,
    settingsData: { mode: 'production', apiKey: 'test-key', webhookToken: 'test-token' },
    salonExists: true,
    salonData: {},
    planExists: true,
    planData: { name: 'Start', price: 197, billingCycle: 'MONTHLY', trialDays: 1 },
    update: vi.fn()
  }
}));

vi.mock('../../server/billing/AsaasProvider.js', () => ({ asaasProvider: mocks.asaas }));
vi.mock('../../server/shared/firebaseAdmin.js', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (_id: string) => ({
        get: async () => {
          if (name === 'settings') return { exists: mocks.db.settingsExists, data: () => mocks.db.settingsData };
          if (name === 'plans') return { exists: mocks.db.planExists, id: 'start', data: () => mocks.db.planData };
          if (name === 'salons') return { exists: mocks.db.salonExists, id: 'salon-1', data: () => mocks.db.salonData };
          return { exists: false, data: () => undefined };
        },
        update: mocks.db.update
      })
    }),
    runTransaction: async (callback: any) => callback({
      get: async () => ({ exists: false, data: () => undefined }),
      set: vi.fn(),
      delete: vi.fn()
    })
  })
}));

describe('BillingService subscription idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.salonData = {
      name: 'Lumière Beauty Studio',
      billing: {
        customerId: 'cus_123',
        subscriptionId: 'sub_existing',
        planId: 'start',
        status: 'PENDING_PAYMENT'
      }
    };
    mocks.asaas.getSubscription.mockResolvedValue({
      id: 'sub_existing',
      customer: 'cus_123',
      billingType: 'UNDEFINED',
      value: 197,
      nextDueDate: '2026-08-25',
      status: 'ACTIVE',
      description: 'Assinatura Start - LumièreOS'
    });
  });

  it('reuses the existing local subscription instead of creating another one', async () => {
    const { BillingService } = await import('../../server/billing/BillingService.js');
    const service = new BillingService();

    const result = await service.createSubscription('salon-1', 'start', 'UNDEFINED', mocks.db.salonData);

    expect(result.id).toBe('sub_existing');
    expect(mocks.asaas.createSubscription).not.toHaveBeenCalled();
    expect(mocks.asaas.listSubscriptions).not.toHaveBeenCalled();
  });

  it('reconciles an active Asaas subscription found by externalReference before creating another', async () => {
    mocks.db.salonData = { name: 'Lumière Beauty Studio', billing: { customerId: 'cus_123' } };
    mocks.asaas.listSubscriptions.mockResolvedValue([{
      id: 'sub_remote',
      customer: 'cus_123',
      billingType: 'UNDEFINED',
      value: 197,
      nextDueDate: '2026-08-25',
      status: 'ACTIVE',
      description: 'Assinatura Start - LumièreOS'
    }]);

    const { BillingService } = await import('../../server/billing/BillingService.js');
    const service = new BillingService();

    const result = await service.createSubscription('salon-1', 'start', 'UNDEFINED', mocks.db.salonData);

    expect(result.id).toBe('sub_remote');
    expect(mocks.asaas.createSubscription).not.toHaveBeenCalled();
    expect(mocks.db.update).toHaveBeenCalled();
  });
});

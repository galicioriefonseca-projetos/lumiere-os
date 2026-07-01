import { BillingProvider } from './BillingProvider';
import { AsaasProvider } from './providers/asaas/AsaasProvider';
import {
  BillingCustomer,
  BillingSubscription,
  BillingInvoice,
  BillingPayment,
  BillingWebhookEvent
} from './types';

export class BillingService {
  private provider: BillingProvider;

  constructor(provider?: BillingProvider) {
    // Inicializa com AsaasProvider por padrão
    this.provider = provider || new AsaasProvider();
  }

  /**
   * Altera dinamicamente o gateway/provider de faturamento ativo
   */
  setProvider(provider: BillingProvider): void {
    this.provider = provider;
  }

  async createCustomer(salonId: string, data: Partial<BillingCustomer>): Promise<BillingCustomer> {
    return this.provider.createCustomer(salonId, data);
  }

  async updateCustomer(customerId: string, data: Partial<BillingCustomer>): Promise<BillingCustomer> {
    return this.provider.updateCustomer(customerId, data);
  }

  async createSubscription(salonId: string, customerId: string, data: Partial<BillingSubscription>): Promise<BillingSubscription> {
    return this.provider.createSubscription(salonId, customerId, data);
  }

  async updateSubscription(subscriptionId: string, data: Partial<BillingSubscription>): Promise<BillingSubscription> {
    return this.provider.updateSubscription(subscriptionId, data);
  }

  async cancelSubscription(subscriptionId: string): Promise<BillingSubscription> {
    return this.provider.cancelSubscription(subscriptionId);
  }

  async resumeSubscription(subscriptionId: string): Promise<BillingSubscription> {
    return this.provider.resumeSubscription(subscriptionId);
  }

  async changePaymentMethod(subscriptionId: string, paymentMethod: 'credit_card' | 'pix' | 'boleto', paymentDetails?: any): Promise<BillingSubscription> {
    return this.provider.changePaymentMethod(subscriptionId, paymentMethod, paymentDetails);
  }

  async generatePix(invoiceId: string): Promise<{ qrCode: string; copyPaste: string; expirationDate: Date }> {
    return this.provider.generatePix(invoiceId);
  }

  async listInvoices(customerId: string): Promise<BillingInvoice[]> {
    return this.provider.listInvoices(customerId);
  }

  async listPayments(customerId: string): Promise<BillingPayment[]> {
    return this.provider.listPayments(customerId);
  }

  async processWebhook(event: any): Promise<BillingWebhookEvent> {
    return this.provider.processWebhook(event);
  }
}

// Exporta instância global unificada do serviço
export const billingService = new BillingService();

import {
  BillingCustomer,
  BillingSubscription,
  BillingInvoice,
  BillingPayment,
  BillingWebhookEvent
} from './types';

export interface BillingProvider {
  /**
   * Cria um cliente no gateway de faturamento
   */
  createCustomer(salonId: string, data: Partial<BillingCustomer>): Promise<BillingCustomer>;

  /**
   * Atualiza os dados de um cliente existente no gateway de faturamento
   */
  updateCustomer(customerId: string, data: Partial<BillingCustomer>): Promise<BillingCustomer>;

  /**
   * Cria uma assinatura recorrente no gateway de faturamento
   */
  createSubscription(salonId: string, customerId: string, data: Partial<BillingSubscription>): Promise<BillingSubscription>;

  /**
   * Atualiza detalhes de uma assinatura recorrente (ex: plano, valor, intervalo)
   */
  updateSubscription(subscriptionId: string, data: Partial<BillingSubscription>): Promise<BillingSubscription>;

  /**
   * Cancela uma assinatura ativa imediatamente ou ao final do ciclo
   */
  cancelSubscription(subscriptionId: string): Promise<BillingSubscription>;

  /**
   * Reativa ou retoma uma assinatura que estava suspensa ou prestes a ser cancelada
   */
  resumeSubscription(subscriptionId: string): Promise<BillingSubscription>;

  /**
   * Altera a forma de pagamento principal de uma assinatura ativa
   */
  changePaymentMethod(subscriptionId: string, paymentMethod: 'credit_card' | 'pix' | 'boleto', paymentDetails?: any): Promise<BillingSubscription>;

  /**
   * Gera dados de pagamento via PIX para uma cobrança específica
   */
  generatePix(invoiceId: string): Promise<{ qrCode: string; copyPaste: string; expirationDate: Date }>;

  /**
   * Lista todas as faturas de um determinado cliente
   */
  listInvoices(customerId: string): Promise<BillingInvoice[]>;

  /**
   * Lista todos os pagamentos históricos de um determinado cliente
   */
  listPayments(customerId: string): Promise<BillingPayment[]>;

  /**
   * Processa o evento de webhook recebido do gateway de pagamento
   */
  processWebhook(event: any): Promise<BillingWebhookEvent>;
}

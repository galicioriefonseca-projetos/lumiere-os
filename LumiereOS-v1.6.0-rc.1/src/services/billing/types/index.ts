export interface BillingCustomer {
  id: string; // ID interno ou ID do Gateway
  externalId?: string; // ID no gateway de pagamento (ex: Asaas)
  salonId: string; // ID do salão associado no LumièreOS
  name: string;
  email: string;
  phone?: string;
  document: string; // CPF ou CNPJ
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingSubscription {
  id: string;
  externalId?: string; // ID da assinatura no gateway de pagamento
  salonId: string;
  customerId: string;
  planId: string;
  status: 'active' | 'pending' | 'suspended' | 'canceled' | 'previewing';
  paymentMethod: 'credit_card' | 'pix' | 'boleto';
  price: number;
  interval: 'monthly' | 'semi-annually' | 'annually';
  previewDays?: number;
  previewEnd?: Date;
  nextDueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingInvoice {
  id: string;
  externalId?: string;
  salonId: string;
  subscriptionId?: string;
  customerId: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'canceled' | 'refunded';
  paymentMethod: 'credit_card' | 'pix' | 'boleto';
  dueDate: Date;
  paymentDate?: Date;
  invoiceUrl?: string; // Link externo para visualização da fatura
  pdfUrl?: string; // Link direto para download do PDF da fatura
  createdAt: Date;
}

export interface BillingPayment {
  id: string;
  externalId?: string;
  salonId: string;
  invoiceId?: string;
  amount: number;
  status: 'success' | 'failed' | 'pending' | 'refunded';
  paymentMethod: 'credit_card' | 'pix' | 'boleto';
  transactionId?: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface BillingWebhookEvent {
  id: string;
  event: 'payment.created' | 'payment.approved' | 'payment.overdue' | 'payment.refunded' | 'subscription.created' | 'subscription.updated' | 'subscription.canceled';
  provider: 'asaas' | string;
  payload: any;
  timestamp: Date;
}

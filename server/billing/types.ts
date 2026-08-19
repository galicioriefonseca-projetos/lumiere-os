export type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  semiannualPrice?: number;
  annualPrice?: number;
  billingCycle: BillingCycle;
  trialDays: number;
  features: string[];
  active: boolean;
  displayOrder: number;
  color: string;
  badge?: string;
  createdAt?: string;
  updatedAt?: string;
  maxProfessionals?: number;
  asaasId?: string;
  customPricing?: boolean;
  legacy?: boolean;
}

// UNDEFINED lets the payer choose the payment method on the Asaas hosted invoice.
export type PaymentMethod = 'UNDEFINED' | 'PIX' | 'CREDIT_CARD' | 'BOLETO';

export interface Customer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
}

export interface Subscription {
  id: string;
  customer: string;
  billingType: PaymentMethod;
  value: number;
  nextDueDate: string;
  status: string;
  description?: string;
  cycle?: BillingCycle;
}

export interface BillingProvider {
  createCustomer(mode: 'sandbox'|'production', apiKey: string, data: any): Promise<Customer>;
  updateCustomer(mode: 'sandbox'|'production', apiKey: string, id: string, data: any): Promise<Customer>;
  getCustomer(mode: 'sandbox'|'production', apiKey: string, id: string): Promise<Customer>;
  createSubscription(mode: 'sandbox'|'production', apiKey: string, data: any): Promise<Subscription>;
  cancelSubscription(mode: 'sandbox'|'production', apiKey: string, id: string): Promise<boolean>;
  updateSubscription(mode: 'sandbox'|'production', apiKey: string, id: string, data: any): Promise<Subscription>;
  getSubscription(mode: 'sandbox'|'production', apiKey: string, id: string): Promise<Subscription>;
}

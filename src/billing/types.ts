export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'MONTHLY' | 'YEARLY' | 'QUARTERLY' | 'SEMIANNUALLY';
  trialDays: number;
  features: string[];
  active: boolean;
  displayOrder: number;
  color: string;
  badge?: string;
  createdAt?: string;
  updatedAt?: string;
  maxProfessionals?: number;
}

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

export interface BillingInfo {
  provider: 'asaas';
  customerId?: string;
  subscriptionId?: string;
  planId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'OVERDUE' | 'CANCELLED' | 'TRIAL' | 'PENDING';
  paymentMethod?: PaymentMethod;
  nextDueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

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
}

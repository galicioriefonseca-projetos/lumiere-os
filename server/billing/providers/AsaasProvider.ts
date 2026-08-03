import { BillingProvider, Customer, Subscription, PaymentMethod } from '../types';

export class AsaasProvider implements BillingProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, mode: 'sandbox' | 'production') {
    this.apiKey = apiKey;
    this.baseUrl = mode === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  }

  private async request(endpoint: string, method: string = 'GET', body?: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Asaas API Error [${method} ${endpoint}]:`, errorData);
      throw new Error(`Asaas API Error: ${response.status} - ${errorData}`);
    }

    return response.json();
  }

  async createCustomer(data: any): Promise<Customer> {
    const res = await this.request('/customers', 'POST', data);
    return this.mapCustomer(res);
  }

  async updateCustomer(id: string, data: any): Promise<Customer> {
    const res = await this.request(`/customers/${id}`, 'POST', data);
    return this.mapCustomer(res);
  }

  async getCustomer(id: string): Promise<Customer> {
    const res = await this.request(`/customers/${id}`);
    return this.mapCustomer(res);
  }

  async createSubscription(data: any): Promise<Subscription> {
    const res = await this.request('/subscriptions', 'POST', data);
    return this.mapSubscription(res);
  }

  async cancelSubscription(id: string): Promise<boolean> {
    const res = await this.request(`/subscriptions/${id}`, 'DELETE');
    return res.deleted || false;
  }

  async updateSubscription(id: string, data: any): Promise<Subscription> {
    const res = await this.request(`/subscriptions/${id}`, 'POST', data);
    return this.mapSubscription(res);
  }

  async getSubscription(id: string): Promise<Subscription> {
    const res = await this.request(`/subscriptions/${id}`);
    return this.mapSubscription(res);
  }

  async createPixPayment(subscriptionId: string): Promise<any> {
     // Obter faturas da assinatura
     const res = await this.request(`/payments?subscription=${subscriptionId}&status=PENDING`);
     if (res.data && res.data.length > 0) {
         const paymentId = res.data[0].id;
         const pixRes = await this.request(`/payments/${paymentId}/pixQrCode`);
         return pixRes;
     }
     throw new Error("No pending payment found for subscription");
  }
  
  async getPayment(id: string): Promise<any> {
    return this.request(`/payments/${id}`);
  }

  private mapCustomer(data: any): Customer {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj,
      phone: data.phone,
      mobilePhone: data.mobilePhone
    };
  }

  private mapSubscription(data: any): Subscription {
    return {
      id: data.id,
      customer: data.customer,
      billingType: data.billingType,
      value: data.value,
      nextDueDate: data.nextDueDate,
      status: data.status
    };
  }
}

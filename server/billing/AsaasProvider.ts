import { BillingProvider, Customer, Subscription, PaymentMethod } from './types.js';

export class AsaasProvider implements BillingProvider {
  private getBaseUrl(mode: 'sandbox' | 'production') {
    // Asaas atual: produção e sandbox usam os domínios api.* e não /api/v3.
    return mode === 'sandbox'
      ? 'https://api-sandbox.asaas.com/v3'
      : 'https://api.asaas.com/v3';
  }

  private getHeaders(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      'access_token': apiKey,
      'User-Agent': 'LumiereOS'
    };
  }

  private async request(mode: 'sandbox' | 'production', apiKey: string, endpoint: string, method: string = 'GET', body?: any) {
    const url = `${this.getBaseUrl(mode)}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: this.getHeaders(apiKey),
      body: body ? JSON.stringify(body) : undefined
    };

    const response = await fetch(url, options);
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(`Asaas API Error [${method} ${endpoint}]:`, json || response.statusText);
      throw new Error(`Asaas API Error: ${response.status} - ${JSON.stringify(json || response.statusText)}`);
    }

    return json;
  }

  async testConnection(mode: 'sandbox' | 'production', apiKey: string) {
    try {
      await this.request(mode, apiKey, '/customers?limit=1');
      return true;
    } catch (err: any) {
      console.error('[AsaasProvider] testConnection error:', err);
      return false;
    }
  }

  async createCustomer(mode: 'sandbox' | 'production', apiKey: string, data: any): Promise<Customer> {
    const res = await this.request(mode, apiKey, '/customers', 'POST', data);
    return this.mapCustomer(res);
  }

  async updateCustomer(mode: 'sandbox' | 'production', apiKey: string, id: string, data: any): Promise<Customer> {
    const res = await this.request(mode, apiKey, `/customers/${id}`, 'POST', data);
    return this.mapCustomer(res);
  }

  async getCustomer(mode: 'sandbox' | 'production', apiKey: string, id: string): Promise<Customer> {
    const res = await this.request(mode, apiKey, `/customers/${id}`);
    return this.mapCustomer(res);
  }

  async createSubscription(mode: 'sandbox' | 'production', apiKey: string, data: any): Promise<Subscription> {
    const res = await this.request(mode, apiKey, '/subscriptions', 'POST', data);
    return this.mapSubscription(res);
  }

  async cancelSubscription(mode: 'sandbox' | 'production', apiKey: string, id: string): Promise<boolean> {
    const res = await this.request(mode, apiKey, `/subscriptions/${id}`, 'DELETE');
    return res.deleted || false;
  }

  async updateSubscription(mode: 'sandbox' | 'production', apiKey: string, id: string, data: any): Promise<Subscription> {
    // Asaas documents subscription updates with PUT. POST here caused the hosted
    // payment-method flow to fail or return non-JSON/404 responses in production.
    const res = await this.request(mode, apiKey, `/subscriptions/${id}`, 'PUT', data);
    return this.mapSubscription(res);
  }

  async getSubscription(mode: 'sandbox' | 'production', apiKey: string, id: string): Promise<Subscription> {
    const res = await this.request(mode, apiKey, `/subscriptions/${id}`);
    return this.mapSubscription(res);
  }

  async getPaymentsBySubscription(mode: 'sandbox' | 'production', apiKey: string, subscriptionId: string): Promise<any[]> {
    const res = await this.request(mode, apiKey, `/payments?subscription=${subscriptionId}`);
    return res.data || [];
  }

  async getPixQrCode(mode: 'sandbox' | 'production', apiKey: string, paymentId: string): Promise<any> {
    return this.request(mode, apiKey, `/payments/${paymentId}/pixQrCode`);
  }

  async getBoleto(mode: 'sandbox' | 'production', apiKey: string, paymentId: string): Promise<any> {
    const res = await this.request(mode, apiKey, `/payments/${paymentId}`);
    return {
      bankSlipUrl: res.bankSlipUrl,
      identificationField: res.identificationField
    };
  }

  async updatePaymentMethod(mode: 'sandbox' | 'production', apiKey: string, paymentId: string, billingType: PaymentMethod, creditCard?: any, creditCardHolderInfo?: any): Promise<any> {
    const payload: any = { billingType };
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
      payload.creditCard = creditCard;
      payload.creditCardHolderInfo = creditCardHolderInfo;
    }
    return this.request(mode, apiKey, `/payments/${paymentId}`, 'POST', payload);
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
      status: data.status,
      description: data.description
    };
  }
}

export const asaasProvider = new AsaasProvider();

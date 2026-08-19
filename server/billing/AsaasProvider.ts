import { BillingProvider, Subscription, PaymentMethod, BillingCycle, Customer } from './types.js';

export class AsaasProvider implements BillingProvider {
  private getBaseUrl(mode: 'sandbox' | 'production') {
    return mode === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
  }

  private getHeaders(apiKey: string) {
    return { 'Content-Type': 'application/json', 'access_token': apiKey, 'User-Agent': 'LumiereOS' };
  }

  private async request(mode: 'sandbox' | 'production', apiKey: string, endpoint: string, method: string = 'GET', body?: any) {
    const url = `${this.getBaseUrl(mode)}${endpoint}`;
    const options: RequestInit = { method, headers: this.getHeaders(apiKey), body: body ? JSON.stringify(body) : undefined };
    const response = await fetch(url, options);
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(`Asaas API Error [${method} ${endpoint}]:`, json || response.statusText);
      throw new Error(`Asaas API Error: ${response.status} - ${JSON.stringify(json || response.statusText)}`);
    }
    return json;
  }

  async testConnection(mode: 'sandbox' | 'production', apiKey: string) {
    try { await this.request(mode, apiKey, '/customers?limit=1'); return true; }
    catch (err: any) { console.error('[AsaasProvider] testConnection error:', err); return false; }
  }

  async createCustomer(mode: 'sandbox' | 'production', apiKey: string, data: any): Promise<Customer> {
    return this.mapCustomer(await this.request(mode, apiKey, '/customers', 'POST', data));
  }

  async updateCustomer(mode: 'sandbox' | 'production', apiKey: string, id: string, data: any): Promise<Customer> {
    return this.mapCustomer(await this.request(mode, apiKey, `/customers/${id}`, 'PUT', data));
  }

  async getCustomer(mode: 'sandbox' | 'production', apiKey: string, id: string): Promise<Customer> {
    return this.mapCustomer(await this.request(mode, apiKey, `/customers/${id}`));
  }

  async createSubscription(mode: 'sandbox' | 'production', apiKey: string, data: any): Promise<Subscription> {
    const payload = { ...data };
    if (data.callback?.successUrl) {
      payload.callback = { successUrl: data.callback.successUrl, cancelUrl: data.callback.cancelUrl, expiredUrl: data.callback.expiredUrl, autoRedirect: data.callback.autoRedirect ?? true };
    }
    return this.mapSubscription(await this.request(mode, apiKey, '/subscriptions', 'POST', payload));
  }

  async createRecurringCheckout(mode: 'sandbox' | 'production', apiKey: string, data: any): Promise<any> {
    const payload = {
      billingTypes: data.billingTypes || ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: data.minutesToExpire || 60,
      callback: data.callback,
      items: data.items,
      customerData: data.customerData,
      externalReference: data.externalReference,
      subscription: data.subscription
    };
    return this.request(mode, apiKey, '/checkouts', 'POST', payload);
  }

  async updateSubscriptionCreditCard(mode: 'sandbox' | 'production', apiKey: string, id: string, data: any): Promise<any> {
    return this.request(mode, apiKey, `/subscriptions/${id}/creditCard`, 'PUT', data);
  }

  async listSubscriptions(mode: 'sandbox' | 'production', apiKey: string, filters: { customer?: string; externalReference?: string; includeDeleted?: boolean } = {}): Promise<Subscription[]> {
    const params = new URLSearchParams({ limit: '100', offset: '0' });
    if (filters.customer) params.set('customer', filters.customer);
    if (filters.externalReference) params.set('externalReference', filters.externalReference);
    if (filters.includeDeleted) params.set('includeDeleted', 'true');
    const res = await this.request(mode, apiKey, `/subscriptions?${params.toString()}`);
    return Array.isArray(res?.data) ? res.data.map((item: any) => this.mapSubscription(item)) : [];
  }

  async cancelSubscription(mode: 'sandbox' | 'production', apiKey: string, id: string): Promise<boolean> {
    const res = await this.request(mode, apiKey, `/subscriptions/${id}`, 'DELETE');
    return res.deleted || false;
  }

  async updateSubscription(mode: 'sandbox' | 'production', apiKey: string, id: string, data: any): Promise<Subscription> {
    return this.mapSubscription(await this.request(mode, apiKey, `/subscriptions/${id}`, 'PUT', data));
  }

  async getSubscription(mode: 'sandbox' | 'production', apiKey: string, id: string): Promise<Subscription> {
    return this.mapSubscription(await this.request(mode, apiKey, `/subscriptions/${id}`));
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
    return { bankSlipUrl: res.bankSlipUrl, identificationField: res.identificationField };
  }

  async updatePaymentMethod(mode: 'sandbox' | 'production', apiKey: string, paymentId: string, billingType: PaymentMethod, creditCard?: any, creditCardHolderInfo?: any): Promise<any> {
    const payload: any = { billingType };
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) { payload.creditCard = creditCard; payload.creditCardHolderInfo = creditCardHolderInfo; }
    return this.request(mode, apiKey, `/payments/${paymentId}`, 'POST', payload);
  }

  private mapCustomer(data: any): Customer {
    return { id: data.id, name: data.name, email: data.email, cpfCnpj: data.cpfCnpj, phone: data.phone, mobilePhone: data.mobilePhone };
  }

  private mapSubscription(data: any): Subscription {
    const cycle = String(data.cycle || '').toUpperCase();
    return {
      id: data.id,
      customer: data.customer,
      billingType: data.billingType,
      value: data.value,
      nextDueDate: data.nextDueDate,
      status: data.status,
      description: data.description,
      cycle: (cycle === 'MONTHLY' || cycle === 'SEMIANNUALLY' || cycle === 'YEARLY') ? cycle as BillingCycle : undefined
    };
  }
}

export const asaasProvider = new AsaasProvider();

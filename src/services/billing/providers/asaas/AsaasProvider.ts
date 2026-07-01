import { BillingProvider } from '../../BillingProvider';
import {
  BillingCustomer,
  BillingSubscription,
  BillingInvoice,
  BillingPayment,
  BillingWebhookEvent
} from '../../types';
import { auth } from '@/lib/firebase';

export class AsaasProvider implements BillingProvider {
  private async handleResponse(response: Response, defaultError: string): Promise<any> {
    const contentType = response.headers.get('content-type');
    if (!response.ok) {
      let errorMessage = defaultError;
      if (contentType && contentType.includes('application/json')) {
        try {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
        } catch (e) {}
      } else {
        try {
          const text = await response.text();
          console.error("Non-JSON error response from billing API:", text);
        } catch (e) {}
        errorMessage = `Erro de Servidor (status ${response.status}). Certifique-se de que o backend Express está rodando e configurado corretamente.`;
      }
      throw new Error(errorMessage);
    }

    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    throw new Error("O servidor retornou uma resposta não-JSON inesperada.");
  }

  async createCustomer(salonId: string, data: Partial<BillingCustomer>): Promise<BillingCustomer> {
    const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch('/api/asaas/create-customer', {
      method: 'POST',
      headers,
      body: JSON.stringify({ salonId, ...data })
    });
    return this.handleResponse(response, "Erro ao criar cliente no Asaas");
  }

  async updateCustomer(customerId: string, data: Partial<BillingCustomer>): Promise<BillingCustomer> {
    throw new Error("Método não implementado no cliente");
  }

  async createSubscription(salonId: string, customerId: string, data: Partial<BillingSubscription>): Promise<BillingSubscription> {
    const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch('/api/asaas/create-subscription', {
      method: 'POST',
      headers,
      body: JSON.stringify({ salonId, customerId, ...data })
    });
    return this.handleResponse(response, "Erro ao criar assinatura no Asaas");
  }

  async updateSubscription(subscriptionId: string, data: Partial<BillingSubscription>): Promise<BillingSubscription> {
    throw new Error("Método não implementado no cliente");
  }

  async cancelSubscription(subscriptionId: string): Promise<BillingSubscription> {
    throw new Error("Método não implementado no cliente");
  }

  async resumeSubscription(subscriptionId: string): Promise<BillingSubscription> {
    throw new Error("Método não implementado no cliente");
  }

  async changePaymentMethod(subscriptionId: string, paymentMethod: 'credit_card' | 'pix' | 'boleto', paymentDetails?: any): Promise<BillingSubscription> {
    throw new Error("Método não implementado no cliente");
  }

  async generatePix(invoiceId: string): Promise<{ qrCode: string; copyPaste: string; expirationDate: Date }> {
    throw new Error("Método não implementado no cliente");
  }

  async listInvoices(customerId: string): Promise<BillingInvoice[]> {
    throw new Error("Método não implementado no cliente");
  }

  async listPayments(customerId: string): Promise<BillingPayment[]> {
    throw new Error("Método não implementado no cliente");
  }

  async processWebhook(event: any): Promise<BillingWebhookEvent> {
    throw new Error("Método não implementado no cliente");
  }
}


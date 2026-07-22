import { BillingProvider } from '../../BillingProvider';
import {
  BillingCustomer,
  BillingSubscription,
  BillingInvoice,
  BillingPayment,
  BillingWebhookEvent
} from '../../types';
import { auth } from '@/lib/firebase';

export class CaktoProvider implements BillingProvider {
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
          console.error("Non-JSON error response from Cakto API:", text);
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
    // Na Cakto, o cadastro do cliente e processamento é feito integrado no checkout
    return {
      id: data.id || `cus_${Math.random().toString(36).substring(2, 9)}`,
      salonId,
      name: data.name || '',
      email: data.email || '',
      phone: data.phone,
      document: data.document || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateCustomer(customerId: string, data: Partial<BillingCustomer>): Promise<BillingCustomer> {
    throw new Error("Método não aplicável na Cakto");
  }

  async createSubscription(salonId: string, customerId: string, data: Partial<BillingSubscription>): Promise<BillingSubscription> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Sessão expirada. Entre novamente para continuar.");
    }

    const idToken = await currentUser.getIdToken(true);
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    };

    const response = await fetch('/api/cakto/create-checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        salonId,
        planId: data.planId,
        paymentMethod: data.paymentMethod || 'credit_card',
        email: customerId, checkoutPurpose: (data as any).checkoutPurpose || "new_subscription" // Aqui passamos o email ou ID do cliente para referência
      })
    });
    return this.handleResponse(response, "Erro ao criar checkout na Cakto");
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

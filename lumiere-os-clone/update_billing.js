const fs = require('fs');
let code = fs.readFileSync('server/billing/BillingService.ts', 'utf8');

const newMethod = `
  async getSubscriptionInvoiceUrl(subscriptionId: string): Promise<string | null> {
    const settings = await this.getSettings();
    const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
    const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
    if (!pendingPayment) return null;
    return pendingPayment.invoiceUrl;
  }
`;

code = code.replace('async getPixPaymentDetails', newMethod + '\n  async getPixPaymentDetails');
fs.writeFileSync('server/billing/BillingService.ts', code);

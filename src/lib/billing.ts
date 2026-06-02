import { PLANS_CONFIG } from '../config/plans';
import { PlanType, Salon } from '../types';

export function getPlanAmount(plan: PlanType): number {
  return PLANS_CONFIG[plan]?.monthlyAmount || 0;
}

export function getPlanLabel(plan: PlanType): string {
  return PLANS_CONFIG[plan]?.name || "Desconhecido";
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function getNextBillingDate(date: number | undefined): Date | null {
  if (!date) return null;
  return new Date(date);
}

export function getFounderPriceInfo(salon: Salon): string {
  if (salon.plan === 'founder') {
    return 'Plano Founder — R$297/mês durante o período Founder.';
  }
  return '';
}

export function isPaymentOverdue(salon: Salon): boolean {
  if (salon.subscriptionStatus === 'overdue' || salon.paymentStatus === 'overdue') return true;
  if (!salon.nextBillingDate) return false;
  // If we are past the next billing date by more than 1 day
  const nextBilling = new Date(salon.nextBillingDate);
  const now = new Date();
  
  // Adding small grace period of 1 day to be strict but not immediately blocking
  const graceDate = new Date(nextBilling);
  graceDate.setDate(graceDate.getDate() + 1);
  
  return now > graceDate && salon.paymentStatus !== 'reported';
}

export function isPaymentDueInDays(salon: Salon, days: number): boolean {
  if (!salon.nextBillingDate) return false;
  const nextBilling = new Date(salon.nextBillingDate);
  const now = new Date();
  
  const diffTime = nextBilling.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 && diffDays <= days;
}

export function getSubscriptionStatusLabel(status: string): string {
  switch (status) {
    case 'trial': return 'Período de Teste';
    case 'active': return 'Ativo';
    case 'pending_payment': return 'Pagamento Pendente';
    case 'overdue': return 'Vencido';
    case 'canceled': return 'Cancelado';
    default: return 'Desconhecido';
  }
}

export function getPaymentStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'none': return 'Sem faturamento';
    case 'pending': return 'Pendente';
    case 'reported': return 'Informado';
    case 'paid': return 'Pago';
    case 'overdue': return 'Atrasado';
    case 'rejected': return 'Rejeitado';
    case 'canceled': return 'Cancelado';
    default: return 'Sem informações';
  }
}

export function getBillingProviderLabel(provider?: string): string {
  switch (provider) {
    case 'manual_pix': return 'PIX Manual';
    case 'stripe': return 'Stripe';
    case 'asaas': return 'Asaas';
    default: return 'PIX Manual';
  }
}

export function getBillingModeLabel(mode?: string): string {
  switch (mode) {
    case 'manual_pix': return 'PIX Manual';
    case 'recurring_card': return 'Cartão de Crédito Recorrente';
    default: return 'PIX Manual';
  }
}

export function isRecurringCardEnabled(): boolean {
  return !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
}

// Esta função só pode ser usada no servidor (api/stripe/*)
// No frontend, o plano é enviado como string e o servidor resolve o priceId
export function getPlanStripePriceId(plan: PlanType): string {
  // Nunca chame isso no browser — variáveis STRIPE_PRICE_* não são expostas ao Vite
  if (typeof window !== 'undefined') {
    console.error('[billing] getPlanStripePriceId chamado no browser — isso é um bug');
    return '';
  }
  switch (plan) {
    case 'start':       return process.env.STRIPE_PRICE_START || '';
    case 'studio':      return process.env.STRIPE_PRICE_STUDIO || '';
    case 'performance': return process.env.STRIPE_PRICE_PERFORMANCE || '';
    case 'network':     return process.env.STRIPE_PRICE_NETWORK || '';
    case 'founder':     return process.env.STRIPE_PRICE_FOUNDER || '';
    default:            return '';
  }
}

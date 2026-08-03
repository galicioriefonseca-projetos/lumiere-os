import { auth } from '@/lib/firebase';
import { PlanType, Salon } from '../types';

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function getNextBillingDate(date: number | undefined | string): Date | null {
  if (!date) return null;
  return new Date(date);
}

export function isPaymentOverdue(salon: any): boolean {
  if (salon.billing?.status === 'OVERDUE') return true;
  if (!salon.billing?.nextDueDate) return false;
  
  const nextBilling = new Date(salon.billing.nextDueDate);
  const now = new Date();
  
  const graceDate = new Date(nextBilling);
  graceDate.setDate(graceDate.getDate() + 1);
  
  return now > graceDate && salon.billing?.status !== 'PENDING';
}

export function isPaymentDueInDays(salon: any, days: number): boolean {
  if (!salon.billing?.nextDueDate) return false;
  const nextBilling = new Date(salon.billing.nextDueDate);
  const now = new Date();
  
  const diffTime = nextBilling.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 && diffDays <= days;
}

export function getSubscriptionStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Ativo';
    case 'PENDING': return 'Pagamento Pendente';
    case 'OVERDUE': return 'Vencido';
    case 'CANCELLED': return 'Cancelado';
    case 'TRIAL': return 'Avaliação Gratuita';
    default: return 'Desconhecido';
  }
}

export function getPaymentStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'PENDING': return 'Pendente';
    case 'RECEIVED': return 'Pago';
    case 'CONFIRMED': return 'Confirmado';
    case 'OVERDUE': return 'Atrasado';
    case 'REFUNDED': return 'Reembolsado';
    case 'RECEIVED_IN_CASH': return 'Pago em Dinheiro';
    case 'REFUND_REQUESTED': return 'Reembolso Solicitado';
    case 'CHARGEBACK_REQUESTED': return 'Chargeback Solicitado';
    case 'CHARGEBACK_DISPUTE': return 'Em Disputa de Chargeback';
    case 'AWAITING_CHARGEBACK_REVERSAL': return 'Aguardando Reversão de Chargeback';
    case 'DUNNING_REQUESTED': return 'Em Processo de Cobrança';
    case 'DUNNING_RECEIVED': return 'Recuperado';
    case 'AWAITING_RISK_ANALYSIS': return 'Em Análise de Risco';
    default: return 'Sem informações';
  }
}

export function isRealProviderSubscription(salonData: any): boolean {
  if (!salonData) return false;
  return salonData.billing?.provider === "asaas" && !!salonData.billing?.subscriptionId;
}

export function isManualActiveSubscription(salonData: any): boolean {
  // Legacy function support
  return false;
}

export async function schedulePlanChange(salonId: string, planId: string): Promise<any> {
  throw new Error("Use changePlan via BillingService");
}

export async function cancelPlanChange(salonId: string): Promise<any> {
  throw new Error("Not implemented");
}

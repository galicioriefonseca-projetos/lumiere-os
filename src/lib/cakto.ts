import { auth } from '@/lib/firebase';

/**
 * Helper to generate authenticated headers for API requests
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  return headers;
}

/**
 * Helper to handle fetch responses and throw clear errors
 */
async function handleResponse(response: Response, defaultError: string): Promise<any> {
  const contentType = response.headers.get('content-type');
  let data: any = null;
  
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      // Ignored
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || defaultError;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Interface representing current billing status and metadata
 */
export interface CaktoSubscriptionStatus {
  billingProvider: string;
  subscriptionStatus: string;
  paymentStatus: string;
  caktoPaymentStatus: string;
  nextBillingDate: number | null;
  caktoCustomerId: string | null;
  caktoOrderId: string | null;
  caktoSubscriptionId: string | null;
  caktoCheckoutUrl: string | null;
  caktoOfferId: string | null;
}

/**
 * Interface representing a pending plan change
 */
export interface PendingPlanChange {
  fromPlan: string;
  toPlan: string;
  currentAmount: number;
  targetAmount: number;
  priceDifference: number;
  targetOfferId: string;
  requestedAt: number;
  effectiveAt: number;
  status: string;
}

/**
 * Fetches the current subscription status from the Cakto API
 */
export async function getSubscriptionStatus(salonId: string): Promise<CaktoSubscriptionStatus> {
  if (!salonId) {
    throw new Error('O campo salonId é obrigatório para consulta de status.');
  }

  const headers = await getAuthHeaders();
  const response = await fetch(`/api/cakto/subscription-status?salonId=${encodeURIComponent(salonId)}`, {
    method: 'GET',
    headers
  });

  return handleResponse(response, 'Erro ao consultar status da assinatura na Cakto.');
}

/**
 * Schedules a plan change for the next billing cycle
 */
export async function schedulePlanChange(
  salonId: string,
  planId: string
): Promise<{ success: boolean; message: string; pendingPlanChange: PendingPlanChange }> {
  if (!salonId || !planId) {
    throw new Error('Os campos salonId e planId são obrigatórios para agendamento de plano.');
  }

  const headers = await getAuthHeaders();
  const response = await fetch('/api/cakto/change-plan', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      salonId,
      planId,
      action: 'schedule'
    })
  });

  return handleResponse(response, 'Erro ao agendar mudança de plano na Cakto.');
}

/**
 * Cancels a scheduled plan change
 */
export async function cancelPlanChange(salonId: string): Promise<{ success: boolean; message: string }> {
  if (!salonId) {
    throw new Error('O campo salonId é obrigatório para cancelamento da alteração programada.');
  }

  const headers = await getAuthHeaders();
  const response = await fetch('/api/cakto/change-plan', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      salonId,
      action: 'cancel'
    })
  });

  return handleResponse(response, 'Erro ao cancelar alteração programada de plano.');
}

/**
 * Simulates immediate confirmation of a scheduled plan change (homologation mode)
 */
export async function simulateConfirmPlanChange(
  salonId: string
): Promise<{ success: boolean; message: string; newPlan: string }> {
  if (!salonId) {
    throw new Error('O campo salonId é obrigatório para simulação.');
  }

  const headers = await getAuthHeaders();
  const response = await fetch('/api/cakto/change-plan', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      salonId,
      action: 'simulate_confirm'
    })
  });

  return handleResponse(response, 'Erro ao simular confirmação imediata da mudança de plano.');
}

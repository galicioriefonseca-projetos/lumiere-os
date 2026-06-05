// src/config/mercadoPago.ts
export type SubscriptionPlan = 'founder' | 'start' | 'studio' | 'performance' | 'network';

export const MERCADO_PAGO_PLANS = {
  founder: { label: 'Founder - Vitalício', defaultAmount: 297 },
  start: { label: 'Plano Start', defaultAmount: 197 },
  studio: { label: 'Plano Studio', defaultAmount: 397 },
  performance: { label: 'Plano Performance', defaultAmount: 697 },
  network: { label: 'Plano Network', defaultAmount: 1497 },
};

export const MERCADO_PAGO_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando Pagamento',
  authorized: 'Ativo',
  paused: 'Pausado',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  rejected: 'Rejeitado',
};

export function getMercadoPagoPlanLabel(plan: string | null | undefined): string {
  if (!plan) return 'Plano Desconhecido';
  const key = plan.toLowerCase() as keyof typeof MERCADO_PAGO_PLANS;
  return MERCADO_PAGO_PLANS[key]?.label || 'Plano Desconhecido';
}

export function getMercadoPagoPlanAmount(plan: string | null | undefined): number {
  if (!plan) return 0;
  const key = plan.toLowerCase() as keyof typeof MERCADO_PAGO_PLANS;
  // If we had env vars injected here via Vite, we'd use them, but backend uses process.env
  // For frontend display:
  return MERCADO_PAGO_PLANS[key]?.defaultAmount || 0;
}

import { useMemo } from 'react';
import { Plan } from '@/billing/types';
import { planCatalog } from '../config/planPricing';

/**
 * Catálogo comercial oficial do LumièreOS.
 *
 * A área Minha Assinatura não deve depender do seed antigo da coleção
 * `plans` do Firestore, pois isso permitia que planos legados voltassem
 * a aparecer na interface mesmo após a atualização do catálogo comercial.
 *
 * O Firestore continua sendo a fonte dos dados da assinatura do cliente
 * (planId, billingCycle, status, subscriptionId etc.). Aqui ficam apenas
 * os dados de apresentação/seleção dos planos comerciais.
 */
export function usePlans() {
  const plans = useMemo<Plan[]>(() => {
    const catalogPlans = planCatalog.plans.map((plan: any, index: number) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: Number(plan.monthlyPrice || 0),
      billingCycle: 'MONTHLY' as const,
      trialDays: 0,
      features: Array.isArray(plan.features) ? plan.features : [],
      active: plan.active !== false,
      displayOrder: index + 1,
      color: '#D4AF37',
      badge: plan.badge || undefined,
      maxProfessionals: plan.maxProfessionals ?? undefined,
    }));

    // Compatibilidade visual para contas antigas. Os aliases não aparecem
    // como opções de compra, mas permitem exibir corretamente o plano atual
    // enquanto a assinatura antiga não for migrada pelo backend/Asaas.
    const aliases = [
      { ...catalogPlans.find(p => p.id === 'professional')!, id: 'performance', legacy: true },
      { ...catalogPlans.find(p => p.id === 'professional')!, id: 'founder', legacy: true },
      { ...catalogPlans.find(p => p.id === 'multiunit')!, id: 'network', legacy: true },
      { ...catalogPlans.find(p => p.id === 'essential')!, id: 'start', legacy: true },
    ] as Plan[];

    return [...catalogPlans, ...aliases];
  }, []);

  const getPlan = (id: string) => plans.find(p => p.id === id);

  return { plans, loading: false, getPlan };
}

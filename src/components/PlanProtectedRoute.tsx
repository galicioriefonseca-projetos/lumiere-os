import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPlanFeature, type PlanFeature } from '@/config/planFeatures';
import PlanFeatureGate from './PlanFeatureGate';

/** Converte planos antigos para o catálogo comercial atual sem quebrar contas existentes. */
function normalizePlan(plan?: string | null) {
  switch (plan) {
    case 'start': return 'essential';
    case 'performance': return 'professional';
    case 'founder': return 'professional';
    case 'network': return 'multiunit';
    default: return plan;
  }
}

type Props = {
  feature: PlanFeature;
  children: ReactNode;
};

/** Proteção de rota baseada no recurso liberado pelo plano do salão. */
export default function PlanProtectedRoute({ feature, children }: Props) {
  const { salonData, loading } = useAuth();

  if (loading) return null;

  // A Lumiere Beauty é uma conta de demonstração controlada.
  // Contas reais continuam sujeitas ao catálogo comercial; a demo pode
  // navegar por todas as ferramentas para apresentar o produto completo.
  const isDemoSalon = Boolean(
    salonData?.isDemo === true ||
    (salonData?.name && /lumiere\s*beauty/i.test(String(salonData.name)))
  );

  const plan = normalizePlan(salonData?.plan);
  const allowed = isDemoSalon || hasPlanFeature(plan, feature);

  return <PlanFeatureGate feature={feature} allowed={allowed}>{children}</PlanFeatureGate>;
}

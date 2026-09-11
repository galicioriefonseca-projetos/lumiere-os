import { LockKeyhole, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FEATURE_LABELS, type PlanFeature, requiredPlanForFeature } from '@/config/planFeatures';
import type { ReactNode } from 'react';

const PLAN_NAMES: Record<string, string> = {
  essential: 'Essencial',
  professional: 'Gestão',
  performance_plus: 'Performance',
  multiunit: 'Multiunidade',
  enterprise_custom: 'Enterprise',
};

type Props = {
  feature: PlanFeature;
  children: ReactNode;
  allowed: boolean;
};

/** Protege uma ferramenta e transforma bloqueios em oportunidade clara de upgrade. */
export default function PlanFeatureGate({ feature, children, allowed }: Props) {
  const navigate = useNavigate();
  if (allowed) return <>{children}</>;

  const plan = requiredPlanForFeature(feature);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-zinc-950/80 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
        <LockKeyhole className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-white">{FEATURE_LABELS[feature]} não está disponível neste plano</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
        Essa ferramenta faz parte do plano <strong className="text-primary">{PLAN_NAMES[plan]}</strong>. Faça o upgrade para liberar este recurso.
      </p>
      <Button onClick={() => navigate('/planos')} className="mt-6 rounded-full bg-primary px-6 text-black hover:bg-primary/90">
        <Sparkles className="mr-2 h-4 w-4" /> Ver planos
      </Button>
    </div>
  );
}

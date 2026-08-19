import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPlanPrice, getEquivalentMonthly, planCatalog, PublicBillingCycle, PublicPlanId } from '@/config/planPricing';

const cycleLabels: Record<PublicBillingCycle, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual'
};

const cycleDiscount: Record<PublicBillingCycle, string> = {
  MONTHLY: '',
  SEMIANNUALLY: '10% OFF',
  YEARLY: '15% OFF'
};

export default function PricingPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<PublicBillingCycle>('MONTHLY');
  const plans = useMemo(() => planCatalog.plans as Array<any>, []);

  const choose = (planId: PublicPlanId) => {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:comercial@lumiere-os.com?subject=Enterprise%20LumièreOS';
      return;
    }
    navigate(`/cadastro?plan=${encodeURIComponent(planId)}&cycle=${cycle}`);
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="w-4 h-4" /> Planos LumièreOS
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-light tracking-tight">Escolha o nível de gestão que sua empresa precisa.</h1>
          <p className="mt-5 text-zinc-400 text-lg">Comece pequeno, cresça sem trocar de sistema e pague menos ao escolher ciclos mais longos.</p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-full border border-white/10 bg-zinc-900/80 p-1">
            {(Object.keys(cycleLabels) as PublicBillingCycle[]).map(item => (
              <button key={item} onClick={() => setCycle(item)} className={`rounded-full px-5 py-2.5 text-sm transition ${cycle === item ? 'bg-primary text-black font-semibold' : 'text-zinc-400 hover:text-white'}`}>
                {cycleLabels[item]} {cycleDiscount[item] && <span className="ml-1 text-[10px] font-bold">{cycleDiscount[item]}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5 items-stretch">
          {plans.map(plan => {
            const price = getPlanPrice(plan.id, cycle);
            const equivalent = getEquivalentMonthly(plan.id, cycle);
            const highlighted = plan.id === 'professional';
            return (
              <div key={plan.id} className={`relative flex flex-col rounded-3xl border p-6 ${highlighted ? 'border-primary/60 bg-primary/[0.07] shadow-[0_0_50px_rgba(212,175,55,0.12)]' : 'border-white/10 bg-zinc-950/80'}`}>
                {plan.badge && <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">{plan.badge}</div>}
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="mt-2 min-h-12 text-sm leading-relaxed text-zinc-400">{plan.description}</p>
                <div className="mt-6">
                  {price == null ? <div className="text-2xl font-semibold">Sob consulta</div> : <><div className="text-4xl font-bold">R$ {price.toLocaleString('pt-BR')}</div><div className="mt-1 text-xs text-zinc-500">{cycle === 'MONTHLY' ? 'por mês' : `≈ R$ ${equivalent!.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês`}</div></>}
                </div>
                {plan.maxProfessionals && <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm font-medium">Até {plan.maxProfessionals} profissionais{plan.id === 'multiunit' ? ' por unidade' : ''}</div>}
                <div className="mt-6 space-y-3 flex-1">
                  {plan.features.map((feature: string) => <div key={feature} className="flex gap-2 text-sm text-zinc-300"><Check className="w-4 h-4 shrink-0 text-primary mt-0.5" />{feature}</div>)}
                </div>
                <Button onClick={() => choose(plan.id)} className={`mt-8 w-full rounded-full ${highlighted ? 'bg-primary text-black hover:bg-yellow-300' : 'bg-white/10 text-white hover:bg-white/15'}`}>
                  {plan.id === 'enterprise' ? 'Falar com especialista' : 'Escolher plano'} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Pagamento processado pelo Asaas</span>
          <span>Semestral: 10% de desconto</span>
          <span>Anual: 15% de desconto</span>
        </div>
        <div className="mt-8 text-center"><Button variant="ghost" onClick={() => navigate('/')} className="text-zinc-400">Voltar para o site</Button></div>
      </div>
    </div>
  );
}

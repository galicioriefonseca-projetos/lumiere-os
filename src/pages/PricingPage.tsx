import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, ArrowLeft, ShieldCheck, HelpCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

const cycleLabels: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual'
};

const discounts: Record<BillingCycle, number> = {
  MONTHLY: 0,
  SEMIANNUALLY: 0.1,
  YEARLY: 0.15
};

const plans = [
  { 
    id: 'essential', 
    name: 'Essencial', 
    description: 'Para organizar a rotina operacional, clientes e finanças básicas da empresa.', 
    monthlyPrice: 197, 
    idealFor: 'Profissionais autônomos e empresas em estruturação inicial',
    features: [
      'Agenda e organização de atendimentos', 
      'Gestão de clientes e histórico completo', 
      'Catálogo de serviços e produtos', 
      'Controle financeiro de entradas e saídas', 
      'Painel operacional em tempo real', 
      'Relatórios básicos de movimentação'
    ] 
  },
  { 
    id: 'professional', 
    name: 'Gestão', 
    description: 'Para estruturar processos, liderar equipes e profissionalizar a gestão empresarial.', 
    monthlyPrice: 397, 
    badge: 'Mais escolhido', 
    highlight: true, 
    idealFor: 'Empresas, agências e negócios com equipe em crescimento',
    features: [
      'Tudo do Plano Essencial', 
      'Gestão completa de pessoas e colaboradores', 
      'Metas individuais e comissões automáticas', 
      'Checklists de processos e padrões de qualidade', 
      'Avaliação de produtividade e ranking de equipe', 
      'CRM e acompanhamento de carteira de clientes', 
      'Financeiro avançado (DRE gerencial, contas a pagar/receber)', 
      'Relatórios executivos e indicadores de lucro'
    ] 
  },
  { 
    id: 'performance', 
    name: 'Performance', 
    description: 'Gestão completa com inteligência artificial, diagnósticos em tempo real e automações.', 
    monthlyPrice: 597, 
    badge: 'Com Lumi IA',
    idealFor: 'Empresas focadas em escala, governança e alto desempenho',
    features: [
      'Tudo do Plano Gestão', 
      'Lumi — Conselheira Executiva com IA', 
      'Diagnósticos estratégicos automáticos 24/7', 
      'Previsão inteligente de faturamento e fluxo de caixa', 
      'Detecção preventiva de gargalos e clientes inativos', 
      'Direcionamento diário de metas e coaching de equipe', 
      'Análise preditiva de margem e rentabilidade', 
      'Automações inteligentes de rotinas'
    ] 
  },
  { 
    id: 'multiunit', 
    name: 'Multiunidade', 
    description: 'Para grupos empresariais, filiais ou operações com múltiplos polos de gestão.', 
    monthlyPrice: 897, 
    idealFor: 'Redes, filiais e holdings com múltiplos times e empresas',
    features: [
      'Tudo do Plano Performance', 
      'Gestão centralizada de múltiplas empresas e polos', 
      'Dashboard consolidado do grupo empresarial', 
      'Comparativo de performance e produtividade entre unidades', 
      'Centros de custo e finanças consolidadas', 
      'Hierarquia avançada de permissões e acessos', 
      'Suporte executivo prioritário'
    ] 
  },
];

const formatBRL = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

export default function PricingPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');

  const price = (plan: typeof plans[0]) => {
    return Math.round(plan.monthlyPrice * (1 - discounts[cycle]));
  };

  const choose = (planId: string) => {
    navigate(`/cadastro?plan=${encodeURIComponent(planId)}&planId=${encodeURIComponent(planId)}&cycle=${cycle}&billingCycle=${cycle}`);
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#171717] px-5 py-12 md:py-16 selection:bg-[#B89B5E]/20 selection:text-[#8A6D36]">
      <div className="max-w-7xl mx-auto">
        
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/')} 
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#77746D] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para o início
          </button>
          
          <button 
            onClick={() => navigate('/diagnostico')} 
            className="text-xs font-semibold text-[#8A6D36] hover:underline flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Fazer Diagnóstico Gratuito
          </button>
        </div>

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DCCFB3] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#8A6D36] shadow-sm">
            <Sparkles className="w-4 h-4 text-[#B89B5E]" /> Planos & Ferramentas LumièreOS
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-light tracking-tight text-[#171717]">
            Escolha as ferramentas que sua empresa precisa.
          </h1>
          <p className="mt-4 text-[#66645F] text-base md:text-lg leading-relaxed">
            Cada plano libera recursos para profissionalizar a gestão da empresa e potencializar suas pessoas. Evolua conforme o crescimento do seu negócio.
          </p>
        </div>

        {/* Cycle Switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full border border-[#DDD9D1] bg-[#F4F2EE] p-1.5 shadow-sm">
            {(Object.keys(cycleLabels) as BillingCycle[]).map(item => (
              <button 
                key={item} 
                onClick={() => setCycle(item)} 
                className={`rounded-full px-5 py-2.5 text-xs font-semibold transition-all ${
                  cycle === item 
                    ? 'bg-[#171717] text-white shadow-sm' 
                    : 'text-[#6B6B6B] hover:text-[#171717]'
                }`}
              >
                {cycleLabels[item]} 
                {item !== 'MONTHLY' && (
                  <span className="ml-1.5 text-[9px] font-bold text-[#D8C79F]">-{Math.round(discounts[item]*100)}%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Diagnostic Banner */}
        <div className="mb-10 flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
          <span className="inline-flex items-center gap-2 text-xs md:text-sm text-[#77746D]">
            <HelpCircle className="w-4 h-4 text-[#8A6D36]" /> Em dúvida sobre o plano ideal para seu momento?
          </span>
          <Button 
            variant="outline" 
            onClick={() => navigate('/diagnostico')} 
            className="rounded-full border-[#DCCFB3] bg-white text-xs font-semibold text-[#8A6D36] hover:bg-zinc-50"
          >
            Fazer diagnóstico em 1 min <ArrowRight className="ml-2 w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-5 lg:grid-cols-4 items-stretch">
          {plans.map(plan => {
            const p = price(plan);
            return (
              <motion.div 
                key={plan.id} 
                whileHover={{ y: -5 }} 
                className={`relative flex flex-col rounded-3xl border p-7 ${
                  plan.highlight 
                    ? 'border-[#B89B5E] bg-[#FFFDF8] shadow-[0_15px_45px_rgba(184,155,94,.14)]' 
                    : 'border-[#E4E1DB] bg-white shadow-sm'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-6 rounded-full bg-[#171717] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm">
                    <Crown className="mr-1 inline h-3 w-3 text-[#D8C79F]" />
                    {plan.badge}
                  </div>
                )}
                
                <h3 className="text-xl font-medium text-[#171717]">{plan.name}</h3>
                <p className="mt-1 text-[11px] font-medium text-[#9F844A]">{plan.idealFor}</p>
                <p className="mt-3 min-h-[60px] text-xs leading-5 text-[#6B6B6B]">{plan.description}</p>
                
                <div className="mt-6">
                  <span className="text-4xl font-semibold tracking-tight text-[#171717]">{formatBRL(p)}</span>
                  <span className="ml-1 text-xs text-[#77746D]">/mês</span>
                </div>
                
                {cycle !== 'MONTHLY' && (
                  <p className="mt-2 text-xs text-[#9F844A] font-medium">Economia de {Math.round(discounts[cycle]*100)}% no ciclo</p>
                )}
                
                <div className="my-6 h-px bg-[#E5E2DC]"/>
                
                <div className="mb-4 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-2.5 text-xs text-[#6B6B6B]">
                  <span className="font-semibold text-[#333]">Ferramentas inclusas:</span>
                </div>

                <ul className="flex-1 space-y-2.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex gap-2 text-xs leading-5 text-[#5F5D58]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9F844A]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 text-[10px] text-[#8B8881]">
                  Capacidade recomendada: {plan.id==='essential'?'até 5':plan.id==='professional'?'até 15':plan.id==='performance'?'até 30':'até 60'} colaboradores
                </div>

                <Button 
                  onClick={() => choose(plan.id)} 
                  className={`mt-5 h-12 w-full rounded-xl text-xs font-bold transition-all ${
                    plan.highlight
                      ? 'bg-[#171717] text-white hover:bg-[#2B2B2B] shadow-md'
                      : 'border border-[#D8D4CC] bg-white text-[#333] hover:bg-[#F4F2EE]'
                  }`}
                >
                  Escolher {plan.name} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 text-xs text-[#77746D]">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Pagamento seguro e transparente via Asaas</span>
          <span>•</span>
          <span>Sem contrato de fidelidade no plano mensal</span>
          <span>•</span>
          <span>Ativação e liberação imediata do sistema</span>
        </div>

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-xs text-[#77746D] hover:text-[#171717]">
            <ArrowLeft className="mr-2 w-3.5 h-3.5" /> Voltar para a página principal
          </Button>
        </div>

      </div>
    </div>
  );
}

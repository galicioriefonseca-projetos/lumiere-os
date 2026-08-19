import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Crown,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import PWAInstallButton from '../components/PWAInstallButton';

type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

type Plan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | null;
  maxProfessionals: number | null;
  badge?: string | null;
  customPricing?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    id: 'essential',
    name: 'Essencial',
    description: 'Para organizar a operação e sair do improviso.',
    monthlyPrice: 197,
    maxProfessionals: 5,
    features: ['Até 5 profissionais', 'Agenda completa', 'Clientes e serviços', 'Comandas', 'Controle básico de caixa', 'Agendamento online', 'Dashboard operacional', 'Relatórios básicos', 'Suporte padrão'],
  },
  {
    id: 'professional',
    name: 'Profissional',
    description: 'Para negócios em crescimento que precisam de controle financeiro e gestão de equipe.',
    monthlyPrice: 397,
    maxProfessionals: 15,
    badge: 'Mais escolhido',
    features: ['Tudo do Essencial', 'Até 15 profissionais', 'Financeiro completo', 'Fluxo de caixa', 'Contas a pagar e receber', 'Comissões e metas', 'CRM', 'Relatórios avançados', 'Dashboard de gestão', 'Suporte prioritário'],
  },
  {
    id: 'performance_plus',
    name: 'Performance',
    description: 'Para operações que querem inteligência, automação e decisões orientadas por dados.',
    monthlyPrice: 597,
    maxProfessionals: 30,
    features: ['Tudo do Profissional', 'Até 30 profissionais', 'Lumi — IA', 'Insights automáticos', 'Análises financeiras avançadas', 'Indicadores inteligentes', 'Análise de desempenho da equipe', 'Relatórios gerenciais avançados', 'Automação avançada', 'Suporte prioritário'],
  },
  {
    id: 'multiunit',
    name: 'Multiunidade',
    description: 'Para grupos, redes e operações com múltiplas unidades.',
    monthlyPrice: 897,
    maxProfessionals: 60,
    features: ['Tudo do Performance', 'Até 60 profissionais por unidade', 'Gestão multiunidade', 'Dashboard consolidado', 'Comparação entre unidades', 'Financeiro por unidade', 'Relatórios executivos', 'Gestão centralizada', 'Permissões avançadas', 'Suporte VIP'],
  },
  {
    id: 'enterprise_custom',
    name: 'Enterprise',
    description: 'Para operações de grande porte com necessidades comerciais e técnicas personalizadas.',
    monthlyPrice: null,
    maxProfessionals: null,
    badge: 'Sob consulta',
    customPricing: true,
    features: ['Tudo do Multiunidade', 'Implantação personalizada', 'Integrações avançadas', 'BI e relatórios personalizados', 'Gerente de conta', 'SLA e suporte dedicado'],
  },
];

const discountByCycle: Record<BillingCycle, number> = {
  MONTHLY: 0,
  SEMIANNUALLY: 0.1,
  YEARLY: 0.15,
};

const cycleLabels: Record<BillingCycle, { label: string; short: string }> = {
  MONTHLY: { label: 'Mensal', short: 'mês' },
  SEMIANNUALLY: { label: 'Semestral', short: 'mês no semestral' },
  YEARLY: { label: 'Anual', short: 'mês no anual' },
};

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function monthlyEquivalent(plan: Plan, cycle: BillingCycle) {
  if (plan.monthlyPrice == null) return null;
  return Math.round(plan.monthlyPrice * (1 - discountByCycle[cycle]));
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) navigate('/login?source=pwa', { replace: true });
  }, [navigate]);

  const cycleDiscount = discountByCycle[cycle];

  const choosePlan = (planId: string) => {
    if (planId === 'enterprise_custom') {
      const el = document.getElementById('contato');
      el?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    navigate(`/cadastro?planId=${encodeURIComponent(planId)}&billingCycle=${encodeURIComponent(cycle)}`);
  };

  const anchor = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const benefits = useMemo(() => [
    { icon: CalendarCheck2, title: 'Agenda sem conflito', text: 'Tenha uma visão clara dos horários, profissionais e atendimentos para reduzir desencontros e decisões de última hora.' },
    { icon: CircleDollarSign, title: 'Financeiro sob controle', text: 'Centralize entradas, saídas, contas, comissões e metas para saber o que está acontecendo com o dinheiro do negócio.' },
    { icon: Users, title: 'Equipe mais previsível', text: 'Acompanhe profissionais, metas e processos em um único lugar, com menos cobrança manual e mais clareza.' },
    { icon: BarChart3, title: 'Decisões com dados', text: 'Transforme informações da operação em indicadores para identificar oportunidades e agir antes que pequenos problemas cresçam.' },
  ], []);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-primary/30 selection:text-primary">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/75 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-6">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5" aria-label="LumièreOS início">
            <Sparkles className="h-7 w-7 text-primary" />
            <span className="font-heading text-2xl tracking-wide">Lumière</span>
            <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">OS</span>
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            <button onClick={() => anchor('problema')} className="text-sm text-zinc-400 transition hover:text-white">O problema</button>
            <button onClick={() => anchor('recursos')} className="text-sm text-zinc-400 transition hover:text-white">Recursos</button>
            <button onClick={() => anchor('planos')} className="text-sm text-zinc-400 transition hover:text-white">Planos</button>
            <button onClick={() => navigate('/login')} className="text-sm text-zinc-400 transition hover:text-white">Entrar</button>
            <Button onClick={() => navigate('/cadastro')} className="rounded-full bg-primary px-6 text-xs font-bold uppercase tracking-wider text-black hover:bg-gold-400">Começar agora</Button>
          </nav>

          <button onClick={() => setMobileOpen(v => !v)} className="md:hidden" aria-label="Abrir menu">
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-white/5 bg-zinc-950 px-5 py-5 md:hidden">
            <div className="flex flex-col gap-4">
              <button onClick={() => anchor('problema')} className="text-left text-sm text-zinc-300">O problema</button>
              <button onClick={() => anchor('recursos')} className="text-left text-sm text-zinc-300">Recursos</button>
              <button onClick={() => anchor('planos')} className="text-left text-sm text-zinc-300">Planos</button>
              <button onClick={() => navigate('/login')} className="text-left text-sm text-zinc-300">Entrar</button>
              <Button onClick={() => navigate('/cadastro')} className="rounded-full bg-primary text-black">Começar agora</Button>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-24 pt-24 md:pb-32 md:pt-32">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.14),transparent_55%)]" />
          <div className="mx-auto max-w-6xl text-center">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Gestão feita para negócios de beleza
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mx-auto max-w-5xl text-5xl font-light leading-[1.04] tracking-tight md:text-7xl lg:text-8xl">
              Pare de <span className="text-zinc-500">apagar incêndios.</span><br />
              Comece a <span className="bg-gradient-to-r from-primary via-yellow-200 to-white bg-clip-text font-medium italic text-transparent">comandar.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mx-auto mt-7 max-w-3xl text-base leading-7 text-zinc-400 md:text-xl md:leading-8">
              O LumièreOS coloca agenda, clientes, equipe, financeiro e indicadores no mesmo lugar — para que a gestão deixe de depender de planilhas, mensagens espalhadas e decisões no achismo.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => anchor('planos')} className="h-14 rounded-full bg-primary px-9 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_35px_rgba(212,175,55,0.2)] hover:bg-gold-400">
                Ver planos e escolher <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/cadastro')} className="h-14 rounded-full border-zinc-800 bg-zinc-950/60 px-9 text-xs uppercase tracking-wider text-zinc-200 hover:border-primary/40 hover:bg-zinc-900">
                Fazer diagnóstico
              </Button>
            </motion.div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Escolha o plano que faz sentido</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Pagamentos processados pelo Asaas</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /> Gestão em qualquer dispositivo</span>
            </div>
          </div>
        </section>

        <section id="problema" className="border-y border-white/5 bg-zinc-950/60 px-5 py-20 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr] md:items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Se isso acontece, o problema não é falta de esforço</span>
                <h2 className="mt-4 text-4xl font-light leading-tight md:text-5xl">Sua empresa cresceu.<br /><span className="text-zinc-500">A forma de administrar também precisa crescer.</span></h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'A agenda depende de mensagens, memória e conferências manuais.',
                  'O dinheiro entra, mas é difícil enxergar o resultado com clareza.',
                  'A equipe precisa ser cobrada o tempo todo para seguir processos.',
                  'Existem dados, mas faltam respostas para saber onde agir primeiro.',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/5 bg-black/40 p-5">
                    <XCircle className="mb-3 h-5 w-5 text-red-400/70" />
                    <p className="text-sm leading-6 text-zinc-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="px-5 py-24 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Uma operação, uma visão</span>
              <h2 className="mt-4 text-4xl font-light md:text-5xl">Menos tarefas administrativas.<br /><span className="text-zinc-500">Mais tempo para administrar.</span></h2>
              <p className="mt-5 text-zinc-400">O LumièreOS conecta as áreas que mais impactam o dia a dia para transformar informação espalhada em uma visão de negócio.</p>
            </div>
            <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title, text }) => (
                <motion.div key={title} whileHover={{ y: -4 }} className="rounded-3xl border border-white/5 bg-zinc-950/70 p-7 transition hover:border-primary/20">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5"><Icon className="h-5 w-5 text-primary" /></div>
                  <h3 className="text-lg font-medium">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">{text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/5 bg-zinc-950/60 px-5 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 md:grid-cols-3">
              <div className="md:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Do caos ao controle</span>
                <h2 className="mt-4 text-4xl font-light">O que muda quando tudo conversa?</h2>
              </div>
              <div className="space-y-4 md:col-span-2">
                {[
                  ['01', 'Você enxerga a operação', 'Agenda, equipe e atendimento deixam de competir por atenção em lugares diferentes.'],
                  ['02', 'Você entende o financeiro', 'Entradas, saídas, contas e comissões ficam organizados para apoiar decisões melhores.'],
                  ['03', 'Você age antes do problema', 'Indicadores e inteligência ajudam a identificar oportunidades e pontos de atenção.'],
                ].map(([number, title, text]) => (
                  <div key={number} className="flex gap-5 rounded-2xl border border-white/5 bg-black/40 p-6">
                    <span className="font-mono text-sm text-primary">{number}</span>
                    <div><h3 className="font-medium">{title}</h3><p className="mt-1 text-sm leading-6 text-zinc-500">{text}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20">
          <div className="mx-auto max-w-5xl rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-zinc-950 to-black p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Feito para acompanhar a rotina</span>
                <h2 className="mt-3 text-3xl font-light">Sua gestão onde a operação acontece.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Use no computador, celular ou tablet. O LumièreOS foi pensado para acompanhar proprietários e equipes durante o dia inteiro.</p>
              </div>
              <PWAInstallButton variant="button" />
            </div>
          </div>
        </section>

        <section id="planos" className="border-t border-white/5 bg-zinc-950/50 px-5 py-24 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Escolha o nível da sua operação</span>
              <h2 className="mt-4 text-4xl font-light md:text-5xl">Um plano para cada momento do negócio.</h2>
              <p className="mt-5 text-zinc-400">Comece pelo que sua operação precisa hoje e evolua quando fizer sentido.</p>
            </div>

            <div className="mx-auto mt-10 flex w-fit rounded-full border border-white/10 bg-black p-1.5">
              {(Object.keys(cycleLabels) as BillingCycle[]).map((item) => (
                <button key={item} onClick={() => setCycle(item)} className={`rounded-full px-5 py-2.5 text-xs font-semibold transition ${cycle === item ? 'bg-primary text-black' : 'text-zinc-500 hover:text-white'}`}>
                  {cycleLabels[item].label}
                  {item !== 'MONTHLY' && <span className="ml-1.5 text-[9px]">-{Math.round(discountByCycle[item] * 100)}%</span>}
                </button>
              ))}
            </div>

            <div className="mt-4 text-center text-xs text-zinc-500">
              {cycle === 'MONTHLY' ? 'Pagamento mensal, sem desconto de ciclo.' : cycle === 'SEMIANNUALLY' ? 'Você economiza 10% no ciclo semestral.' : 'Você economiza 15% no ciclo anual.'}
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-4">
              {plans.filter(plan => !plan.customPricing).map((plan) => {
                const monthly = monthlyEquivalent(plan, cycle)!;
                return (
                  <motion.div key={plan.id} whileHover={{ y: -5 }} className={`relative flex flex-col rounded-3xl border p-7 ${plan.id === 'professional' ? 'border-primary/50 bg-gradient-to-b from-primary/10 to-zinc-950 shadow-[0_0_45px_rgba(212,175,55,0.08)]' : 'border-white/7 bg-zinc-950/80'}`}>
                    {plan.badge && <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-black"><Crown className="mr-1 inline h-3 w-3" />{plan.badge}</div>}
                    <h3 className="text-xl font-medium">{plan.name}</h3>
                    <p className="mt-3 min-h-[60px] text-sm leading-6 text-zinc-500">{plan.description}</p>
                    <div className="mt-7">
                      <div className="flex items-end gap-1"><span className="text-4xl font-semibold tracking-tight">{formatBRL(monthly)}</span><span className="mb-1.5 text-xs text-zinc-500">/{cycleLabels[cycle].short}</span></div>
                      {cycle !== 'MONTHLY' && <p className="mt-2 text-xs text-primary">Economize {Math.round(cycleDiscount * 100)}% neste ciclo</p>}
                    </div>
                    <div className="my-6 h-px bg-white/5" />
                    <div className="mb-5 flex items-center gap-2 text-xs font-medium text-zinc-300"><Users className="h-4 w-4 text-primary" /> Até {plan.maxProfessionals} profissionais</div>
                    <ul className="flex-1 space-y-3">
                      {plan.features.slice(0, 8).map(feature => <li key={feature} className="flex gap-2 text-xs leading-5 text-zinc-400"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{feature}</li>)}
                    </ul>
                    <Button onClick={() => choosePlan(plan.id)} className={`mt-8 h-12 w-full rounded-full text-xs font-bold uppercase tracking-wider ${plan.id === 'professional' ? 'bg-primary text-black hover:bg-gold-400' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'}`}>
                      Escolher {plan.name}<ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_2fr]">
              <div className="rounded-3xl border border-primary/20 bg-primary/5 p-7">
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Enterprise</span>
                <h3 className="mt-2 text-2xl font-light">Uma operação fora do padrão?</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">Implantação, integrações, BI e suporte dedicado para operações que precisam de uma estrutura sob medida.</p>
                <Button onClick={() => anchor('contato')} className="mt-6 rounded-full bg-primary text-black hover:bg-gold-400">Falar com comercial <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
              <div className="rounded-3xl border border-white/5 bg-black/40 p-7">
                <div className="flex items-center gap-3"><Zap className="h-5 w-5 text-primary" /><span className="font-medium">Ainda não sabe qual escolher?</span></div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Faça o Diagnóstico Estratégico. O fluxo considera o perfil da operação e ajuda a encontrar um ponto de partida sem obrigar a escolher no escuro.</p>
                <Button variant="outline" onClick={() => navigate('/cadastro')} className="mt-5 rounded-full border-white/10">Fazer diagnóstico <ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </section>

        <section id="contato" className="border-t border-white/5 px-5 py-24">
          <div className="mx-auto max-w-4xl text-center">
            <Sparkles className="mx-auto h-7 w-7 text-primary" />
            <h2 className="mt-5 text-4xl font-light md:text-5xl">Quando a operação fica organizada, o crescimento fica mais claro.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-zinc-400">Escolha um plano, faça o diagnóstico ou entre no sistema. O próximo passo é transformar a gestão em uma rotina mais simples e previsível.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => anchor('planos')} className="h-13 rounded-full bg-primary px-8 text-black hover:bg-gold-400">Ver planos <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => navigate('/cadastro')} className="h-13 rounded-full border-white/10">Começar pelo diagnóstico</Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-zinc-950 px-5 py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><span className="font-heading text-lg">LumièreOS</span></div>
            <p className="mt-2 text-xs text-zinc-600">Gestão inteligente para negócios de beleza.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-zinc-500">
            <button onClick={() => navigate('/login')} className="hover:text-white">Entrar</button>
            <button onClick={() => anchor('planos')} className="hover:text-white">Planos</button>
            <button onClick={() => navigate('/cadastro')} className="hover:text-white">Diagnóstico</button>
          </div>
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} LumièreOS</p>
        </div>
      </footer>
    </div>
  );
}

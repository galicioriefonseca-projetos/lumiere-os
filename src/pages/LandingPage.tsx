import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, CalendarCheck2, Check, CircleDollarSign, Crown, Menu, ShieldCheck, Sparkles, Users, X, XCircle, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import PWAInstallButton from '../components/PWAInstallButton';

type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

type Plan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | null;
  badge?: string;
  features: string[];
  highlight?: boolean;
};

const plans: Plan[] = [
  {
    id: 'essential',
    name: 'Essencial',
    description: 'Para organizar a operação e sair do improviso.',
    monthlyPrice: 197,
    features: ['Agenda completa', 'Clientes e serviços', 'Comandas', 'Controle básico de caixa', 'Agendamento online', 'Dashboard operacional', 'Relatórios básicos'],
  },
  {
    id: 'professional',
    name: 'Gestão',
    description: 'Para quem precisa transformar equipe e resultados em gestão de verdade.',
    monthlyPrice: 397,
    badge: 'Mais escolhido',
    highlight: true,
    features: ['Tudo do Essencial', 'Gestão de equipe', 'Metas e comissões', 'Checklists de processos', 'Avaliação de desempenho', 'CRM de clientes', 'Financeiro completo', 'Relatórios avançados'],
  },
  {
    id: 'performance_plus',
    name: 'Performance',
    description: 'Para operações que querem inteligência, automação e decisões orientadas por dados.',
    monthlyPrice: 597,
    features: ['Tudo do Gestão', 'Lumi — Inteligência Artificial', 'Insights automáticos', 'Indicadores inteligentes', 'Análise de desempenho', 'Relatórios gerenciais avançados', 'Análises financeiras avançadas', 'Automação avançada'],
  },
  {
    id: 'multiunit',
    name: 'Multiunidade',
    description: 'Para grupos e redes que precisam enxergar toda a operação em um só lugar.',
    monthlyPrice: 897,
    features: ['Tudo do Performance', 'Gestão de múltiplas unidades', 'Dashboard consolidado', 'Comparação entre unidades', 'Financeiro por unidade', 'Gestão centralizada', 'Permissões avançadas', 'Relatórios executivos'],
  },
];

const discounts: Record<BillingCycle, number> = { MONTHLY: 0, SEMIANNUALLY: 0.1, YEARLY: 0.15 };
const cycleLabels: Record<BillingCycle, string> = { MONTHLY: 'Mensal', SEMIANNUALLY: 'Semestral', YEARLY: 'Anual' };

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (standalone) navigate('/login?source=pwa', { replace: true });
  }, [navigate]);

  const go = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const choosePlan = (planId: string) => {
    navigate(`/cadastro?planId=${encodeURIComponent(planId)}&billingCycle=${encodeURIComponent(cycle)}`);
  };

  const price = (plan: Plan) => plan.monthlyPrice == null ? null : Math.round(plan.monthlyPrice * (1 - discounts[cycle]));

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-primary/30 selection:text-primary">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-6">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5" aria-label="LumièreOS início">
            <Sparkles className="h-7 w-7 text-primary" />
            <span className="font-heading text-2xl tracking-wide">Lumière</span>
            <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">OS</span>
          </button>
          <nav className="hidden items-center gap-7 md:flex">
            <button onClick={() => go('problema')} className="text-sm text-zinc-400 hover:text-white">O problema</button>
            <button onClick={() => go('recursos')} className="text-sm text-zinc-400 hover:text-white">Recursos</button>
            <button onClick={() => go('planos')} className="text-sm text-zinc-400 hover:text-white">Planos</button>
            <button onClick={() => navigate('/login')} className="text-sm text-zinc-400 hover:text-white">Entrar</button>
            <Button onClick={() => go('planos')} className="rounded-full bg-primary px-6 text-xs font-bold uppercase tracking-wider text-black">Começar agora</Button>
          </nav>
          <button onClick={() => setMobileOpen(v => !v)} className="md:hidden" aria-label="Abrir menu">{mobileOpen ? <X /> : <Menu />}</button>
        </div>
        {mobileOpen && <div className="border-t border-white/5 bg-zinc-950 px-5 py-5 md:hidden"><div className="flex flex-col gap-4">
          <button onClick={() => go('problema')} className="text-left text-sm text-zinc-300">O problema</button>
          <button onClick={() => go('recursos')} className="text-left text-sm text-zinc-300">Recursos</button>
          <button onClick={() => go('planos')} className="text-left text-sm text-zinc-300">Planos</button>
          <button onClick={() => navigate('/login')} className="text-left text-sm text-zinc-300">Entrar</button>
          <Button onClick={() => go('planos')} className="rounded-full bg-primary text-black">Começar agora</Button>
        </div></div>}
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-24 pt-24 md:pb-32 md:pt-32">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.16),transparent_58%)]" />
          <div className="mx-auto max-w-6xl text-center">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary"><Sparkles className="h-3.5 w-3.5" /> Gestão inteligente para negócios de beleza</motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl text-5xl font-light leading-[1.04] tracking-tight md:text-7xl lg:text-8xl">Pare de <span className="text-zinc-500">apagar incêndios.</span><br />Comece a <span className="bg-gradient-to-r from-primary via-yellow-200 to-white bg-clip-text font-medium italic text-transparent">comandar.</span></motion.h1>
            <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }} className="mx-auto mt-7 max-w-3xl text-base leading-7 text-zinc-400 md:text-xl md:leading-8">O LumièreOS coloca agenda, clientes, equipe, financeiro, metas e indicadores no mesmo lugar — para que a gestão deixe de depender de planilhas, mensagens espalhadas e decisões no achismo.</motion.p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => go('planos')} className="h-14 rounded-full bg-primary px-9 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_35px_rgba(212,175,55,0.2)]">Ver ferramentas e planos <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => navigate('/diagnostico')} className="h-14 rounded-full border-zinc-800 bg-zinc-950/60 px-9 text-xs uppercase tracking-wider">Não sei qual plano escolher</Button>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-zinc-500"><span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Escolha por ferramenta, não por complexidade</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Pagamento seguro via Asaas</span><span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> Acesso em qualquer dispositivo</span></div>
          </div>
        </section>

        <section id="problema" className="border-y border-white/5 bg-zinc-950/60 px-5 py-20 md:py-24">
          <div className="mx-auto max-w-6xl"><div className="grid gap-12 md:grid-cols-[.9fr_1.1fr] md:items-center">
            <div><span className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">A gestão não deveria consumir o dia inteiro</span><h2 className="mt-4 text-4xl font-light leading-tight md:text-5xl">Sua empresa cresceu.<br /><span className="text-zinc-500">A forma de administrar também precisa crescer.</span></h2></div>
            <div className="grid gap-3 sm:grid-cols-2">{['A agenda depende de mensagens e conferências manuais.','O dinheiro entra, mas o resultado não fica claro.','A equipe precisa ser cobrada o tempo todo.','Existem dados, mas faltam respostas para decidir.'].map(item => <div key={item} className="rounded-2xl border border-white/5 bg-black/40 p-5"><XCircle className="mb-3 h-5 w-5 text-red-400/70" /><p className="text-sm leading-6 text-zinc-300">{item}</p></div>)}</div>
          </div></div>
        </section>

        <section id="recursos" className="px-5 py-24 md:py-28">
          <div className="mx-auto max-w-6xl"><div className="mx-auto max-w-3xl text-center"><span className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Ferramentas que trabalham juntas</span><h2 className="mt-4 text-4xl font-light md:text-5xl">Não é só uma agenda.<br /><span className="text-zinc-500">É o centro da operação.</span></h2><p className="mt-5 text-zinc-400">Escolha o nível de gestão que faz sentido para o negócio. Cada plano libera ferramentas específicas.</p></div>
            <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{[
              [CalendarCheck2, 'Agenda e atendimento', 'Organize horários, profissionais, serviços e agendamentos online.'],
              [Users, 'Equipe e metas', 'Defina metas, acompanhe desempenho, comissões e processos.'],
              [CircleDollarSign, 'Financeiro', 'Tenha visão de entradas, saídas, contas, comissões e resultado.'],
              [BarChart3, 'Indicadores e inteligência', 'Transforme os dados da operação em decisões mais rápidas.'],
            ].map(([Icon, title, text]) => { const I = Icon as any; return <motion.div key={title as string} whileHover={{ y: -4 }} className="rounded-3xl border border-white/5 bg-zinc-950/70 p-7 hover:border-primary/20"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5"><I className="h-5 w-5 text-primary" /></div><h3 className="text-lg font-medium">{title as string}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{text as string}</p></motion.div>; })}</div>
          </div>
        </section>

        <section className="border-y border-white/5 bg-zinc-950/60 px-5 py-24"><div className="mx-auto max-w-6xl"><div className="grid gap-10 md:grid-cols-3"><div><span className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Do caos ao controle</span><h2 className="mt-4 text-4xl font-light">O que muda quando tudo conversa?</h2></div><div className="space-y-4 md:col-span-2">{[['01','Você enxerga a operação','Agenda, equipe e atendimento deixam de competir por atenção em lugares diferentes.'],['02','Você entende o negócio','Financeiro, metas e desempenho mostram o que está funcionando.'],['03','Você decide com mais clareza','Indicadores e inteligência ajudam a encontrar oportunidades e pontos de atenção.']].map(([n,t,d]) => <div key={n} className="flex gap-5 rounded-2xl border border-white/5 bg-black/40 p-6"><span className="font-mono text-sm text-primary">{n}</span><div><h3 className="font-medium">{t}</h3><p className="mt-1 text-sm leading-6 text-zinc-500">{d}</p></div></div>)}</div></div></div></section>

        <section className="px-5 py-20"><div className="mx-auto max-w-5xl rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-zinc-950 to-black p-8 md:p-12"><div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center"><div><span className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Feito para acompanhar a rotina</span><h2 className="mt-3 text-3xl font-light">Sua gestão onde a operação acontece.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Use no computador, celular ou tablet. O LumièreOS acompanha proprietários e equipes durante o dia inteiro.</p></div><PWAInstallButton variant="button" /></div></div></section>

        <section id="planos" className="border-t border-white/5 bg-zinc-950/50 px-5 py-24 md:py-28"><div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center"><span className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Escolha pelas ferramentas</span><h2 className="mt-4 text-4xl font-light md:text-5xl">Pague pelo que sua operação precisa.</h2><p className="mt-5 text-zinc-400">A quantidade de profissionais é apenas um limite operacional. O que define o plano são as ferramentas liberadas.</p></div>
          <div className="mx-auto mt-10 flex w-fit rounded-full border border-white/10 bg-black p-1.5">{(Object.keys(cycleLabels) as BillingCycle[]).map(item => <button key={item} onClick={() => setCycle(item)} className={`rounded-full px-5 py-2.5 text-xs font-semibold ${cycle === item ? 'bg-primary text-black' : 'text-zinc-500 hover:text-white'}`}>{cycleLabels[item]}{item !== 'MONTHLY' && <span className="ml-1.5 text-[9px]">-{Math.round(discounts[item] * 100)}%</span>}</button>)}</div>
          <div className="mt-4 text-center text-xs text-zinc-500">{cycle === 'MONTHLY' ? 'Pagamento mensal.' : `Economize ${Math.round(discounts[cycle] * 100)}% escolhendo o ciclo ${cycleLabels[cycle].toLowerCase()}.`}</div>
          <div className="mt-12 grid gap-5 lg:grid-cols-4">{plans.map(plan => { const p = price(plan)!; return <motion.div key={plan.id} whileHover={{ y: -5 }} className={`relative flex flex-col rounded-3xl border p-7 ${plan.highlight ? 'border-primary/50 bg-gradient-to-b from-primary/10 to-zinc-950 shadow-[0_0_45px_rgba(212,175,55,0.08)]' : 'border-white/7 bg-zinc-950/80'}`}>{plan.badge && <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-black"><Crown className="mr-1 inline h-3 w-3" />{plan.badge}</div>}<h3 className="text-xl font-medium">{plan.name}</h3><p className="mt-3 min-h-[72px] text-sm leading-6 text-zinc-500">{plan.description}</p><div className="mt-6"><span className="text-4xl font-semibold tracking-tight">{formatBRL(p)}</span><span className="ml-1 text-xs text-zinc-500">/mês</span></div>{cycle !== 'MONTHLY' && <p className="mt-2 text-xs text-primary">Economia de {Math.round(discounts[cycle] * 100)}% no ciclo</p>}<div className="my-6 h-px bg-white/5"/><div className="mb-5 rounded-xl border border-white/5 bg-black/40 p-3 text-xs text-zinc-400"><span className="font-medium text-zinc-200">Ferramentas deste plano</span></div><ul className="flex-1 space-y-3">{plan.features.map(f => <li key={f} className="flex gap-2 text-xs leading-5 text-zinc-400"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{f}</li>)}</ul><div className="mt-6 text-[10px] text-zinc-600">Limite operacional: {plan.id === 'essential' ? 'até 5' : plan.id === 'professional' ? 'até 15' : plan.id === 'performance_plus' ? 'até 30' : 'até 60'} profissionais</div><Button onClick={() => choosePlan(plan.id)} className={`mt-5 h-12 w-full rounded-full text-xs font-bold uppercase tracking-wider ${plan.highlight ? 'bg-primary text-black' : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'}`}>Escolher {plan.name}<ArrowRight className="ml-2 h-4 w-4" /></Button></motion.div>})}</div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="rounded-3xl border border-primary/20 bg-primary/5 p-7"><span className="text-[9px] font-bold uppercase tracking-widest text-primary">Não sabe qual precisa?</span><h3 className="mt-2 text-2xl font-light">Descubra em menos de 1 minuto.</h3><p className="mt-3 text-sm leading-6 text-zinc-400">O Diagnóstico Estratégico faz algumas perguntas sobre a operação e indica o ponto de partida mais adequado — sem pedir dados pessoais.</p><Button onClick={() => navigate('/diagnostico')} className="mt-6 rounded-full bg-primary text-black">Fazer diagnóstico <ArrowRight className="ml-2 h-4 w-4" /></Button></div><div className="rounded-3xl border border-white/5 bg-black/40 p-7"><span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Enterprise</span><h3 className="mt-2 text-2xl font-light">Precisa de uma estrutura personalizada?</h3><p className="mt-3 text-sm leading-6 text-zinc-400">Implantação, integrações, BI e suporte dedicado para operações fora do padrão.</p><Button variant="outline" onClick={() => go('contato')} className="mt-6 rounded-full border-white/10">Falar com comercial <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>
        </div></section>

        <section id="contato" className="border-t border-white/5 px-5 py-24"><div className="mx-auto max-w-4xl text-center"><Sparkles className="mx-auto h-7 w-7 text-primary"/><h2 className="mt-5 text-4xl font-light md:text-5xl">A gestão pode ser mais simples.</h2><p className="mx-auto mt-5 max-w-2xl text-zinc-400">Escolha um plano e vá direto para o cadastro. Se ainda houver dúvida, faça o diagnóstico antes de preencher qualquer dado.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={() => go('planos')} className="h-13 rounded-full bg-primary px-8 text-black">Ver planos <ArrowRight className="ml-2 h-4 w-4"/></Button><Button variant="outline" onClick={() => navigate('/diagnostico')} className="h-13 rounded-full border-white/10">Fazer diagnóstico</Button></div></div></section>
      </main>

      <footer className="border-t border-white/5 bg-zinc-950 px-5 py-12"><div className="mx-auto flex max-w-7xl flex-col gap-7 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/><span className="font-heading text-lg">LumièreOS</span></div><p className="mt-2 text-xs text-zinc-600">Gestão inteligente para negócios de beleza.</p></div><div className="flex flex-wrap gap-5 text-xs text-zinc-500"><button onClick={() => navigate('/login')} className="hover:text-white">Entrar</button><button onClick={() => go('planos')} className="hover:text-white">Planos</button><button onClick={() => navigate('/diagnostico')} className="hover:text-white">Diagnóstico</button></div><p className="text-xs text-zinc-600">© {new Date().getFullYear()} LumièreOS</p></div></footer>
    </div>
  );
}

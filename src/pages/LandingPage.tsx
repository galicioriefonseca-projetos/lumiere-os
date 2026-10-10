import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  BarChart3, 
  CalendarCheck2, 
  Check, 
  CircleDollarSign, 
  Crown, 
  Menu, 
  ShieldCheck, 
  Sparkles, 
  Users, 
  X, 
  XCircle, 
  Zap,
  Bot,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  Briefcase,
  Layers,
  ChevronRight,
  ChevronDown,
  Target,
  LineChart,
  Shield,
  PhoneCall,
  UserCheck,
  Building2,
  PieChart,
  CheckCircle2,
  Clock,
  Laptop
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PWAInstallButton from '../components/PWAInstallButton';
import { LumiMascotAvatar } from '../components/lumi/LumiMascotAvatar';

type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';
type Plan = { 
  id: string; 
  name: string; 
  description: string; 
  monthlyPrice: number | null; 
  badge?: string; 
  features: string[]; 
  highlight?: boolean;
  idealFor: string;
};

const plans: Plan[] = [
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
    id: 'performance_plus', 
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

const discounts: Record<BillingCycle, number> = { MONTHLY: 0, SEMIANNUALLY: 0.1, YEARLY: 0.15 };
const cycleLabels: Record<BillingCycle, string> = { MONTHLY: 'Mensal', SEMIANNUALLY: 'Semestral', YEARLY: 'Anual' };
const formatBRL = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const segmentsData = [
  {
    id: 'companies',
    title: 'Empresas & Negócios de Serviços',
    subtitle: 'Para empresas que buscam rigor financeiro, processos definidos e gestão de contratos',
    icon: Building2,
    recommendedPlan: 'professional',
    deliverables: [
      'Gestão de Contratos e Faturamento Recorrente',
      'Controle de Fluxo de Caixa, DRE e Margens Reais',
      'Definição de Metas Empresariais e Indicadores (KPIs)',
      'Organização de Prazos, Demandas e Entregas',
      'Histórico Centralizado e CRM de Clientes',
      'Checklists de Padrões e Processos Operacionais'
    ],
    highlight: 'Visão clara da saúde financeira da empresa, contratos ativos e previsibilidade de caixa.'
  },
  {
    id: 'teams',
    title: 'Gestão de Equipes & Pessoas',
    subtitle: 'Para gestores e líderes que coordenam equipes, especialistas e colaboradores',
    icon: Users,
    recommendedPlan: 'professional',
    deliverables: [
      'Cálculo Automático de Comissões e Repasses',
      'Metas Individuais e Coletivas de Faturamento',
      'Ranking de Produtividade e Desempenho por Colaborador',
      'Escalas, Horários e Atribuição de Responsabilidades',
      'Padronização de Entregas e Rotinas de Trabalho',
      'Controle de Acessos e Permissões por Função'
    ],
    highlight: 'Elimine cálculos manuais de comissão e motive sua equipe com metas e transparência.'
  },
  {
    id: 'agency',
    title: 'Agências & Prestadores de Serviços',
    subtitle: 'Para agências e operações que atendem clientes recorrentes e projetos simultâneos',
    icon: Briefcase,
    recommendedPlan: 'professional',
    deliverables: [
      'Acompanhamento de Contratos Mensais (MRR)',
      'Gestão de Prazos e Status de Demandas por Cliente',
      'Apuração de Rentabilidade por Projeto e Conta',
      'Alocação de Especialistas e Produtividade da Equipe',
      'Faturamento, Cobranças e Recebimentos Integrados',
      'Relatórios Gerenciais para Tomada de Decisão'
    ],
    highlight: 'Organize as entregas dos clientes e a capacidade da equipe sem perder prazos nem margem.'
  },
  {
    id: 'professionals',
    title: 'Profissionais Liberais & Autônomos',
    subtitle: 'Para especialistas que gerenciam sua própria carteira e querem crescer com método',
    icon: UserCheck,
    recommendedPlan: 'essential',
    deliverables: [
      'Agenda Integrada e Gestão de Atendimentos',
      'Controle Prático de Entradas, Saídas e Comprovantes',
      'Cadastro e Histórico Completo de Clientes',
      'Organização de Propostas, Serviços e Valores',
      'Metas Pessoais de Faturamento Mensal',
      'Acesso Rápido no Celular, Tablet e Computador'
    ],
    highlight: 'Troque planilhas e cadernos por um sistema executivo moderno e direto ao ponto.'
  }
];

const lumiInsightsDemo = [
  {
    id: 'diagnostico',
    icon: LineChart,
    badge: 'Diagnóstico de Negócio',
    color: 'text-[#D4AF37]',
    title: 'Oportunidade de Lucratividade',
    description: 'Sua categoria de contratos de alto valor gerou 81% de margem operacional este mês. Sugiro focar a expansão comercial nesse perfil de cliente.',
    actionText: 'Ver análise de lucratividade',
    lumiQuote: 'Identifiquei que contratos de ticket acima de R$ 3.000 consom 40% menos tempo operacional por margem de retorno. Recomendo priorizar propostas para esse porte neste trimestre.'
  },
  {
    id: 'coaching',
    icon: Target,
    badge: 'Gestão de Pessoas',
    color: 'text-cyan-400',
    title: 'Acompanhamento de Metas',
    description: 'Sua equipe atingiu 87% da meta mensal antes do prazo. 2 especialistas já atingiram o topo da comissão por produtividade.',
    actionText: 'Ver desempenho da equipe',
    lumiQuote: 'A média de produtividade individual subiu 18%. Recomendo reconhecer os 2 líderes do ranking no fechamento de sexta para manter o ritmo de engajamento.'
  },
  {
    id: 'retencao',
    icon: Users,
    badge: 'Retenção de Clientes',
    color: 'text-rose-400',
    title: 'Alerta de Inatividade',
    description: '3 clientes de ticket expressivo não registram novas interações há 30 dias. Risco de evasão detectado com recomendação de contato.',
    actionText: 'Ver plano de retenção',
    lumiQuote: 'Clientes inativos há mais de 30 dias têm probabilidade 4x maior de cancelamento no próximo ciclo. Preparei a lista de reengajamento prioritária no CRM.'
  },
  {
    id: 'executivo',
    icon: Sparkles,
    badge: 'Visão Executiva',
    color: 'text-amber-400',
    title: 'Previsibilidade Financeira',
    description: 'Projeção de fechamento positivo em R$ 46.800. Contas a receber conciliadas e fluxo de caixa seguro para os próximos 60 dias.',
    actionText: 'Acessar DRE consolidado',
    lumiQuote: 'Com as receitas fixas confirmadas e as provisões de comissão alinhadas, a reserva operacional do negócio atingirá a marca de segurança estipulada.'
  }
];

const faqs = [
  {
    q: 'O que é o LumièreOS?',
    a: 'O LumièreOS é um sistema integrado de gestão de empresas e pessoas. Ele centraliza em uma única plataforma a administração financeira, o controle de processos operacionais, a gestão de equipes e colaboradores (metas, comissões e produtividade) e conta com a Lumi, uma Conselheira Executiva com Inteligência Artificial para apoiar tomadas de decisão estratégicas.'
  },
  {
    q: 'O sistema serve tanto para gerenciar o negócio quanto para liderar equipes?',
    a: 'Sim, esse é o núcleo do LumièreOS. De um lado, você gerencia a empresa (financeiro, DRE, fluxo de caixa, contratos, clientes e processos). Do outro lado, você faz a gestão das pessoas (metas individuais e coletivas, cálculo automático de comissões, ranking de produtividade e padrões operacionais).'
  },
  {
    q: 'Para quais tipos de empresas e profissionais o sistema é indicado?',
    a: 'O LumièreOS foi construído para ser flexível e adaptável: atende desde empresas de serviços, agências e negócios com equipes multidisciplinares até profissionais liberais e consultores que precisam de organização executiva sem complicação.'
  },
  {
    q: 'O que é a Lumi e como ela auxilia na gestão?',
    a: 'A Lumi é a Conselheira Executiva com Inteligência Artificial nativa do LumièreOS. Ela monitora as métricas da sua empresa e da sua equipe 24 horas por dia, identificando oportunidades de aumento de receita, prevenindo perda de clientes e auxiliando líderes no direcionamento de metas.'
  },
  {
    q: 'Como funciona a contratação e o cancelamento?',
    a: 'A contratação é simples e imediata com pagamento seguro via Asaas (Pix ou Cartão). Não exigimos contrato de fidelidade no plano mensal — você tem total liberdade para cancelar a qualquer momento diretamente na sua conta.'
  },
  {
    q: 'Posso acessar no celular, tablet e computador?',
    a: 'Sim! O LumièreOS possui tecnologia Progressive Web App (PWA). Você pode instalá-lo diretamente no seu smartphone (iOS e Android) e no computador (Windows e Mac), garantindo agilidade e acesso contínuo à operação.'
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSegmentTab, setActiveSegmentTab] = useState(0);
  const [selectedLumiInsight, setSelectedLumiInsight] = useState<number>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContactModalOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const go = (id: string) => { 
    setMobileOpen(false); 
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const choosePlan = (id: string) => {
    navigate(`/cadastro?plan=${encodeURIComponent(id)}&planId=${encodeURIComponent(id)}&cycle=${encodeURIComponent(cycle)}&billingCycle=${encodeURIComponent(cycle)}`);
  };

  const price = (plan: Plan) => {
    if (plan.monthlyPrice == null) return null;
    return Math.round(plan.monthlyPrice * (1 - discounts[cycle]));
  };

  const openWhatsAppContact = () => {
    const text = encodeURIComponent('Olá! Gostaria de conversar com a equipe do LumièreOS sobre a gestão da minha empresa e equipe.');
    window.open(`https://wa.me/5517996140963?text=${text}`, '_blank');
  };

  const activeInsight = lumiInsightsDemo[selectedLumiInsight] || lumiInsightsDemo[0];

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#171717] font-sans selection:bg-[#B89B5E]/20 selection:text-[#8A6D36]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#E5E2DC]/80 bg-[#F6F5F2]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
            className="flex items-center gap-2.5 text-left group transition-transform active:scale-95" 
            aria-label="LumièreOS início"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171717] shadow-sm group-hover:bg-[#2B2B2B] transition-colors">
              <Sparkles className="h-4 w-4 text-[#D8C79F]" />
            </span>
            <span className="text-xl font-semibold tracking-tight">
              Lumière<span className="text-[#B89B5E]">OS</span>
            </span>
          </button>
          
          <nav className="hidden items-center gap-7 md:flex">
            <button onClick={() => go('gestao')} className="text-sm text-[#6B6B6B] transition-colors hover:text-[#171717]">Empresas & Pessoas</button>
            <button onClick={() => go('lumi')} className="text-sm font-medium text-[#8A6D36] flex items-center gap-1.5 transition-colors hover:text-[#171717]">
              <Bot className="w-3.5 h-3.5 text-[#B89B5E]" />
              Lumi IA
            </button>
            <button onClick={() => go('pilares')} className="text-sm text-[#6B6B6B] transition-colors hover:text-[#171717]">Pilares</button>
            <button onClick={() => go('recursos')} className="text-sm text-[#6B6B6B] transition-colors hover:text-[#171717]">Recursos</button>
            <button onClick={() => go('planos')} className="text-sm text-[#6B6B6B] transition-colors hover:text-[#171717]">Planos</button>
            <button onClick={() => go('faq')} className="text-sm text-[#6B6B6B] transition-colors hover:text-[#171717]">Dúvidas</button>
            <button onClick={() => navigate('/login')} className="text-sm text-[#6B6B6B] transition-colors hover:text-[#171717]">Entrar</button>
            <Button onClick={() => go('planos')} className="rounded-xl bg-[#171717] px-5 text-xs font-semibold text-white hover:bg-[#2B2B2B] shadow-sm">
              Começar agora <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </nav>

          <button 
            onClick={() => setMobileOpen(v => !v)} 
            className="rounded-xl p-2 md:hidden text-zinc-700 hover:bg-black/5" 
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[#E5E2DC] bg-white px-5 py-5 md:hidden shadow-lg"
            >
              <div className="flex flex-col gap-3.5">
                <button onClick={() => go('gestao')} className="text-left text-sm py-1.5 text-zinc-700">Empresas & Pessoas</button>
                <button onClick={() => go('lumi')} className="text-left text-sm font-semibold text-[#8A6D36] flex items-center gap-1.5 py-1.5">
                  <Bot className="w-4 h-4" /> Lumi IA
                </button>
                <button onClick={() => go('pilares')} className="text-left text-sm py-1.5 text-zinc-700">Pilares</button>
                <button onClick={() => go('recursos')} className="text-left text-sm py-1.5 text-zinc-700">Recursos</button>
                <button onClick={() => go('planos')} className="text-left text-sm py-1.5 text-zinc-700">Planos & Preços</button>
                <button onClick={() => go('faq')} className="text-left text-sm py-1.5 text-zinc-700">Dúvidas Frequentes</button>
                <button onClick={() => navigate('/login')} className="text-left text-sm py-1.5 text-zinc-700 font-medium">Entrar no Painel</button>
                <Button onClick={() => go('planos')} className="rounded-xl bg-[#171717] text-white w-full h-11 mt-2">
                  Começar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden px-5 pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="pointer-events-none absolute -left-40 -top-32 h-[520px] w-[520px] rounded-full bg-[#D8C79F]/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 top-20 h-[420px] w-[420px] rounded-full bg-[#E8E2D5]/80 blur-3xl" />
          
          <div className="relative mx-auto max-w-6xl text-center">
            <motion.div 
              initial={{ opacity: 0, y: 12 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-[#DCCFB3] bg-white/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#8A6D36] shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#B89B5E]" /> Sistema de Gestão de Empresas e Pessoas
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 18 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="mx-auto max-w-5xl text-5xl font-light leading-[1.02] tracking-[-.045em] md:text-7xl lg:text-[80px]"
            >
              O sistema definitivo para gerenciar<br />
              <span className="text-[#9F844A] font-normal">sua empresa e suas pessoas.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: .1 }} 
              className="mx-auto mt-7 max-w-3xl text-base leading-7 text-[#66645F] md:text-xl md:leading-8"
            >
              Finanças, processos, metas, equipes, comissões automáticas e conselheira executiva com Inteligência Artificial no mesmo lugar. A plataforma completa para transformar a rotina do negócio e potencializar o talento das pessoas.
            </motion.p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => go('planos')} className="h-14 rounded-xl bg-[#171717] px-8 text-sm font-semibold text-white shadow-lg shadow-black/10 hover:bg-[#2B2B2B]">
                Conhecer ferramentas e planos <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/diagnostico')} className="h-14 rounded-xl border-[#D8D4CC] bg-white/70 px-8 text-sm text-[#333] hover:bg-white">
                Fazer diagnóstico da minha empresa
              </Button>
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-x-7 gap-y-2 text-xs text-[#77746D]">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Gestão financeira e de pessoas</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#B89B5E]" /> Pagamento seguro via Asaas</span>
              <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-[#B89B5E]" /> Acesso em qualquer dispositivo (PWA)</span>
            </div>
          </div>
        </section>

        {/* Gestao de Empresas e Pessoas - Overview */}
        <section id="gestao" className="scroll-mt-20 md:scroll-mt-24 border-y border-[#E5E2DC] bg-white px-5 py-20 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center mb-16 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9F844A]">Dois Pilares, Uma Só Plataforma</span>
              <h2 className="text-4xl font-light md:text-5xl">
                O equilíbrio exato entre a gestão do negócio e a liderança de pessoas.
              </h2>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                Empresas não prosperam apenas com planilhas financeiras, nem apenas com motivação. O LumièreOS integra números precisos e pessoas engajadas.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Card 1: Gestão de Empresas */}
              <div className="rounded-3xl border border-[#DCCFB3] bg-[#FFFDF8] p-8 md:p-10 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#171717] text-[#D8C79F]">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-medium text-[#171717]">Gestão de Empresas</h3>
                    <p className="text-xs text-[#8A6D36] font-medium">Controle executivo, finanças e processos</p>
                  </div>
                </div>

                <p className="text-sm text-[#55534F] leading-relaxed">
                  Tudo o que o líder ou proprietário precisa para manter as finanças saudáveis, os contratos em dia e as rotinas organizadas com previsibilidade.
                </p>

                <div className="space-y-3 pt-2">
                  {[
                    'Fluxo de Caixa em tempo real e conciliação de receitas/despesas',
                    'DRE Gerencial e apuração automática de lucro operacional',
                    'Gestão de contratos, clientes, faturamento recorrente e comandas',
                    'Checklists de processos e padronização de qualidade de entregas',
                    'Relatórios consolidados para decisões estratégicas sem achismos'
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <span className="text-xs text-[#333] font-medium leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: Gestão de Pessoas */}
              <div className="rounded-3xl border border-[#DCCFB3] bg-[#FFFDF8] p-8 md:p-10 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#171717] text-[#D8C79F]">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-medium text-[#171717]">Gestão de Pessoas</h3>
                    <p className="text-xs text-[#8A6D36] font-medium">Liderança, produtividade e comissões</p>
                  </div>
                </div>

                <p className="text-sm text-[#55534F] leading-relaxed">
                  Ferramentas para engajar colaboradores, especialistas e parceiros, alinhando metas claras com transparência de resultados e remuneração justa.
                </p>

                <div className="space-y-3 pt-2">
                  {[
                    'Cálculo e divisão de comissões automáticas com regras personalizadas',
                    'Metas individuais e coletivas de faturamento com acompanhamento diário',
                    'Ranking de produtividade e acompanhamento de desempenho',
                    'Escalas de trabalho, agendamentos e controle de tarefas',
                    'Hierarquia de permissões para manter dados sensíveis protegidos'
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <span className="text-xs text-[#333] font-medium leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problemas da Gestão Tradicional */}
        <section id="problema" className="scroll-mt-20 md:scroll-mt-24 bg-[#FAF9F7] px-5 py-20 md:py-24 border-b border-[#E5E2DC]">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 md:grid-cols-[.9fr_1.1fr] md:items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9F844A]">Chega de desorganização</span>
                <h2 className="mt-4 text-4xl font-light leading-tight tracking-tight md:text-5xl">
                  Gerenciar negócios e pessoas<br />
                  <span className="text-[#85827B]">não pode depender de improviso.</span>
                </h2>
                <p className="mt-4 text-sm text-[#66645F] leading-relaxed">
                  Quando finanças, equipe e clientes estão espalhados em papéis, planilhas e mensagens soltas, o crescimento vira caos. O LumièreOS traz método e centralização.
                </p>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'Erros e discussões no cálculo manual de comissões e repasses de equipe.',
                  'Falta de clareza sobre o lucro real após o pagamento das despesas e colaboradores.',
                  'Metas que ficam esquecidas no início do mês e não são acompanhadas no dia a dia.',
                  'Sobrecarga do gestor apagando incêndios operacionais em vez de liderar.'
                ].map(item => (
                  <div key={item} className="rounded-2xl border border-[#E8E5DF] bg-white p-5 transition-shadow hover:shadow-md">
                    <XCircle className="mb-3 h-5 w-5 text-[#B97870]" />
                    <p className="text-sm leading-6 text-[#55534F]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LUMI IA SECTION (FEATURED & INTERACTIVE) */}
        <section id="lumi" className="scroll-mt-20 md:scroll-mt-24 relative overflow-hidden bg-[#11100E] text-white px-5 py-24 md:py-32">
          {/* Ambient Lighting */}
          <div className="pointer-events-none absolute -left-48 top-1/4 h-[500px] w-[500px] rounded-full bg-[#D4AF37]/15 blur-[120px]" />
          <div className="pointer-events-none absolute -right-48 bottom-1/4 h-[400px] w-[400px] rounded-full bg-amber-600/10 blur-[100px]" />

          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-14 lg:grid-cols-12 lg:items-center">
              
              {/* Left Column: Lumi Mascot & Interactive Live Terminal */}
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#1F1B12] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[#D4AF37]">
                  <Bot className="w-4 h-4 text-[#D4AF37]" />
                  Inteligência Artificial Executiva
                </div>

                <h2 className="text-4xl font-light leading-tight tracking-tight md:text-5xl">
                  Conheça a <span className="text-[#D4AF37] font-normal">Lumi</span>.<br />
                  Sua Conselheira de Gestão 24/7.
                </h2>

                <p className="text-sm leading-relaxed text-zinc-400 md:text-base">
                  A Lumi analisa os dados da sua empresa e o desempenho das suas pessoas em tempo real. Ela encontra oportunidades de receita, alerta sobre riscos e orienta a equipe para bater metas com consistência.
                </p>

                <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-2xl backdrop-blur-xl space-y-4">
                  <div className="flex items-center gap-4">
                    <LumiMascotAvatar size="lg" mood="strategic" />
                    <div>
                      <h4 className="text-base font-medium text-white flex items-center gap-2">
                        Lumi — AI Executive Advisor
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">Online</span>
                      </h4>
                      <p className="text-xs text-zinc-400">Ativa em tempo real na sua gestão</p>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeInsight.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-[#D4AF37]">
                            {activeInsight.badge}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">IA Simulada</span>
                        </div>
                        <p className="text-xs text-zinc-300 italic bg-black/50 p-3.5 rounded-2xl border border-white/5 leading-relaxed">
                          "{activeInsight.lumiQuote}"
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5"><BrainCircuit className="w-4 h-4 text-[#D4AF37]" /> Decisões baseadas em dados</span>
                  <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#D4AF37]" /> Previsibilidade financeira</span>
                </div>
              </div>

              {/* Right Column: AI Live Insights Showcase */}
              <div className="lg:col-span-7 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {lumiInsightsDemo.map((item, idx) => {
                    const Icon = item.icon;
                    const isSelected = selectedLumiInsight === idx;
                    return (
                      <motion.div 
                        key={item.id}
                        whileHover={{ y: -3 }} 
                        onClick={() => setSelectedLumiInsight(idx)}
                        className={`cursor-pointer rounded-3xl border p-6 transition-all space-y-3 ${
                          isSelected 
                            ? 'border-[#D4AF37] bg-gradient-to-b from-[#1C1811] to-[#12100B] shadow-[0_0_30px_rgba(212,175,55,0.18)] ring-1 ring-[#D4AF37]/50' 
                            : 'border-white/10 bg-zinc-900/60 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-2.5 rounded-xl bg-white/5 ${item.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${item.color}`}>
                            {item.badge}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-white">{item.title}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {item.description}
                        </p>
                        <div className="pt-1 text-[11px] font-medium text-[#D4AF37] flex items-center gap-1">
                          {item.actionText} <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/40 border border-white/5 p-4 rounded-2xl">
                  <span className="text-xs text-zinc-400">
                    Disponível a partir do plano <strong>Performance</strong>.
                  </span>
                  <Button 
                    onClick={() => choosePlan('performance_plus')} 
                    className="w-full sm:w-auto bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold text-xs h-10 px-6 rounded-xl shadow-md"
                  >
                    Ativar Lumi no meu negócio <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* PILARES & SEGMENTOS ADAPTÁVEIS */}
        <section id="pilares" className="scroll-mt-20 md:scroll-mt-24 border-b border-[#E5E2DC] bg-[#FAF9F7] px-5 py-24 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9F844A]">Flexibilidade & Precisão</span>
              <h2 className="text-4xl font-light md:text-5xl">
                Desenvolvido para diferentes modelos de operação.<br />
                <span className="text-[#85827B]">Com foco absoluto em empresas e pessoas.</span>
              </h2>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                Navegue pelas modalidades e veja como o LumièreOS estrutura entregas, finanças e equipes com total aderência ao seu negócio.
              </p>
            </div>

            {/* Segment Selector Tabs */}
            <div className="mt-12 flex flex-wrap justify-center gap-2">
              {segmentsData.map((seg, idx) => {
                const Icon = seg.icon;
                const isActive = activeSegmentTab === idx;
                return (
                  <button
                    key={seg.id}
                    onClick={() => setActiveSegmentTab(idx)}
                    className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-semibold transition-all ${
                      isActive 
                        ? 'bg-[#171717] text-white shadow-md' 
                        : 'bg-white text-[#6B6B6B] border border-[#E5E2DC] hover:border-[#B89B5E] hover:text-[#171717]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#D8C79F]' : 'text-[#9F844A]'}`} />
                    {seg.title}
                  </button>
                );
              })}
            </div>

            {/* Active Segment Detailed Card */}
            <div className="mt-8">
              <AnimatePresence mode="wait">
                {(() => {
                  const currentSeg = segmentsData[activeSegmentTab];
                  const Icon = currentSeg.icon;
                  return (
                    <motion.div
                      key={currentSeg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-3xl border border-[#DCCFB3] bg-white p-8 md:p-10 shadow-sm"
                    >
                      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                        <div className="lg:col-span-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-[#F5F1E9] text-[#9F844A]">
                              <Icon className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="text-xl font-medium text-[#171717]">{currentSeg.title}</h3>
                              <p className="text-xs text-[#77746D]">{currentSeg.subtitle}</p>
                            </div>
                          </div>

                          <div className="bg-[#FAF9F7] p-4 rounded-2xl border border-[#E8E5DF]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9F844A] block mb-1">Destaque de Gestão</span>
                            <p className="text-xs text-[#55534F] leading-relaxed">{currentSeg.highlight}</p>
                          </div>

                          <Button 
                            onClick={() => choosePlan(currentSeg.recommendedPlan)} 
                            className="rounded-xl bg-[#171717] text-white text-xs font-semibold h-11 px-6 shadow-sm hover:bg-[#2B2B2B]"
                          >
                            Escolher plano ideal <ArrowRight className="ml-2 h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="lg:col-span-7">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A6D36] block mb-3">
                            Rotinas e controles estruturados na plataforma:
                          </span>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {currentSeg.deliverables.map((item) => (
                              <div key={item} className="flex items-start gap-2.5 rounded-xl border border-[#EBE8E1] bg-[#FAF9F7] p-3">
                                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                <span className="text-xs text-[#44423E] font-medium leading-snug">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Recursos / Ferramentas que trabalham juntas */}
        <section id="recursos" className="scroll-mt-20 md:scroll-mt-24 px-5 py-24 md:py-28 bg-white">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9F844A]">Ecossistema Completo</span>
              <h2 className="mt-4 text-4xl font-light md:text-5xl">
                Todas as engrenagens conectadas em tempo real.
              </h2>
              <p className="mt-5 text-[#6B6B6B]">
                Elimine sistemas fragmentados. Finanças, pessoas, clientes e inteligência estratégica operando em perfeita sincronia.
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                [Building2, 'Gestão de Empresas', 'Controle de contratos, DRE gerencial, fluxo de caixa, despesas fixas e visão integrada de receitas.'],
                [Users, 'Gestão de Pessoas', 'Regras de comissões automáticas, metas de produtividade, ranking de especialistas e divisão de tarefas.'],
                [CalendarCheck2, 'Operação & Rotinas', 'Agenda centralizada, checklists de conferência de processos e controle de atendimentos ou serviços.'],
                [BarChart3, 'Lumi & Indicadores', 'Diagnósticos com IA executiva para tomada de decisão, prevenção de cancelamentos e faturamento.'],
              ].map(([Icon, title, text]) => { 
                const I = Icon as any; 
                return (
                  <motion.div 
                    key={title as string} 
                    whileHover={{ y: -4 }} 
                    className="rounded-3xl border border-[#E4E1DB] bg-[#FAF9F7] p-7 shadow-[0_4px_20px_rgba(23,23,23,.035)] transition-shadow hover:shadow-lg hover:bg-white"
                  >
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5F1E9]">
                      <I className="h-5 w-5 text-[#9F844A]" />
                    </div>
                    <h3 className="text-lg font-medium">{title as string}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#6B6B6B]">{text as string}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3 Passos: Do Caos ao Controle */}
        <section className="border-y border-[#E5E2DC] bg-[#F0EFEC] px-5 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 md:grid-cols-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9F844A]">Transformação Prática</span>
                <h2 className="mt-4 text-4xl font-light">O que muda quando empresa e equipe estão alinhadas?</h2>
              </div>
              
              <div className="space-y-4 md:col-span-2">
                {[
                  ['01', 'Controle Financeiro Rigoroso', 'Entradas, despesas, margens de lucro e comissões deixam de ser uma incógnita no final do mês.'],
                  ['02', 'Equipe Engajada e Produtiva', 'Cada colaborador tem metas visíveis, clareza dos seus ganhos e processos operacionais bem definidos.'],
                  ['03', 'Decisões com Segurança e IA', 'A Lumi e os relatórios executivos mostram onde estão as alavancas de crescimento sem perda de tempo.']
                ].map(([n, t, d]) => (
                  <div key={n} className="flex gap-5 rounded-2xl border border-[#E0DDD7] bg-white p-6 shadow-sm">
                    <span className="font-mono text-sm text-[#9F844A] font-bold">{n}</span>
                    <div>
                      <h3 className="font-medium text-[#171717]">{t}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#6B6B6B]">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PWA / App Section */}
        <section className="px-5 py-20 bg-white">
          <div className="mx-auto max-w-5xl rounded-3xl border border-[#DCCFB3] bg-[#FFFDF8] p-8 shadow-sm md:p-12">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9F844A]">Acompanhe a sua empresa de onde estiver</span>
                <h2 className="mt-3 text-3xl font-light">Sua gestão na palma da mão.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B6B6B]">
                  Instale como aplicativo no celular, tablet ou computador. O LumièreOS acompanha a rotina de líderes e colaboradores durante todo o dia com máxima rapidez e segurança.
                </p>
              </div>
              <PWAInstallButton variant="button" />
            </div>
          </div>
        </section>

        {/* Planos Section */}
        <section id="planos" className="scroll-mt-20 md:scroll-mt-24 border-t border-[#E5E2DC] bg-[#FAF9F7] px-5 py-24 md:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9F844A]">Escolha o Plano Ideal</span>
              <h2 className="mt-4 text-4xl font-light md:text-5xl">Investimento transparente e sem surpresas.</h2>
              <p className="mt-5 text-[#6B6B6B]">
                Escolha o plano pelas ferramentas que sua empresa e sua equipe necessitam no estágio atual.
              </p>
            </div>

            {/* Billing Cycle Switcher */}
            <div className="mx-auto mt-10 flex w-fit rounded-full border border-[#DDD9D1] bg-[#F4F2EE] p-1.5 shadow-sm">
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

            <div className="mt-4 text-center text-xs text-[#77746D]">
              {cycle === 'MONTHLY' 
                ? 'Pagamento mensal sem contrato de fidelidade.' 
                : `Economize ${Math.round(discounts[cycle]*100)}% optando pelo ciclo ${cycleLabels[cycle].toLowerCase()}.`}
            </div>

            {/* Plans Grid */}
            <div className="mt-12 grid gap-5 lg:grid-cols-4">
              {plans.map(plan => { 
                const p = price(plan)!; 
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
                    
                    <h3 className="text-xl font-medium">{plan.name}</h3>
                    <p className="mt-1 text-[11px] font-medium text-[#9F844A]">{plan.idealFor}</p>
                    <p className="mt-3 min-h-[64px] text-xs leading-5 text-[#6B6B6B]">{plan.description}</p>
                    
                    <div className="mt-6">
                      <span className="text-4xl font-semibold tracking-tight">{formatBRL(p)}</span>
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
                      Capacidade recomendada: {plan.id==='essential'?'até 5':plan.id==='professional'?'até 15':plan.id==='performance_plus'?'até 30':'até 60'} colaboradores
                    </div>

                    <Button 
                      onClick={() => choosePlan(plan.id)} 
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

            {/* Diagnostic CTA Box */}
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-[#DCCFB3] bg-[#FFFDF8] p-7">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#9F844A]">Dúvidas sobre o plano ideal?</span>
                <h3 className="mt-2 text-2xl font-light">Descubra em menos de 1 minuto.</h3>
                <p className="mt-3 text-sm leading-6 text-[#6B6B6B]">
                  O Diagnóstico Estratégico faz perguntas rápidas sobre a estrutura da sua empresa e equipe e recomenda o plano exato.
                </p>
                <Button onClick={() => navigate('/diagnostico')} className="mt-6 rounded-xl bg-[#171717] text-white text-xs font-semibold hover:bg-[#2B2B2B]">
                  Fazer diagnóstico gratuito <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <div className="rounded-3xl border border-[#E4E1DB] bg-white p-7">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#77746D]">Grandes Equipes & Redes</span>
                <h3 className="mt-2 text-2xl font-light">Precisa de estrutura personalizada?</h3>
                <p className="mt-3 text-sm leading-6 text-[#6B6B6B]">
                  Implantação guiada, integração com outros sistemas, dashboards executivos customizados e suporte dedicado.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setContactModalOpen(true)} 
                  className="mt-6 rounded-xl border-[#D8D4CC] text-xs font-semibold hover:bg-zinc-100"
                >
                  Falar com especialista <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="scroll-mt-20 md:scroll-mt-24 border-t border-[#E5E2DC] bg-white px-5 py-24 md:py-28">
          <div className="mx-auto max-w-4xl">
            <div className="text-center space-y-3 mb-12">
              <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9F844A]">Dúvidas Frequentes</span>
              <h2 className="text-4xl font-light md:text-5xl">Perguntas comuns sobre o LumièreOS</h2>
              <p className="text-sm text-[#6B6B6B]">Tudo o que você precisa saber para transformar a gestão da sua empresa e equipe.</p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div 
                    key={index}
                    className="rounded-2xl border border-[#E5E2DC] bg-[#FAF9F7] overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full flex items-center justify-between p-5 text-left text-sm font-semibold text-[#171717] hover:bg-[#F4F2EE] transition"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-[#8A6D36] transition-transform duration-200 shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="px-5 pb-5 text-xs text-[#55534F] leading-relaxed border-t border-[#EBE8E1] pt-3"
                        >
                          {faq.a}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contato Final CTA */}
        <section id="contato" className="scroll-mt-20 md:scroll-mt-24 border-t border-[#E5E2DC] bg-[#F6F5F2] px-5 py-24">
          <div className="mx-auto max-w-4xl text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#171717]">
              <Sparkles className="h-6 w-6 text-[#D8C79F]" />
            </span>
            <h2 className="mt-5 text-4xl font-light md:text-5xl">A gestão da sua empresa e das suas pessoas em outro nível.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-[#6B6B6B] leading-relaxed">
              Junte-se a gestores, líderes e profissionais que transformaram desorganização e insegurança em processos claros, equipe produtiva e lucro previsível.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={() => go('planos')} className="h-13 rounded-xl bg-[#171717] px-8 text-white font-semibold shadow-sm hover:bg-[#2B2B2B]">
                Ver planos e começar agora <ArrowRight className="ml-2 h-4 w-4"/>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setContactModalOpen(true)} 
                className="h-13 rounded-xl border-[#D8D4CC] bg-white flex items-center justify-center gap-2 hover:bg-zinc-50"
              >
                <MessageSquare className="w-4 h-4 text-[#9F844A]" />
                Falar com consultor
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Contact & Specialist Modal */}
      <AnimatePresence>
        {contactModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setContactModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white border border-[#E5E2DC] rounded-3xl p-6 md:p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setContactModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 bg-[#F5F1E9] text-[#9F844A] rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-[#171717]">Fale com um Especialista</h3>
                <p className="text-xs text-[#6B6B6B] leading-relaxed">
                  Tire dúvidas sobre a gestão da sua empresa e equipe, solicite demonstração ou converse sobre implantação personalizada.
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={openWhatsAppContact}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp Oficial: (17) 99614-0963
                </Button>

                <Button 
                  variant="outline"
                  onClick={() => {
                    setContactModalOpen(false);
                    navigate('/diagnostico');
                  }}
                  className="w-full h-12 border-[#D8D4CC] text-xs font-semibold rounded-xl text-[#333] hover:bg-zinc-50"
                >
                  <Sparkles className="w-4 h-4 text-[#9F844A] mr-2" />
                  Fazer Diagnóstico Estratégico
                </Button>
              </div>

              <p className="text-[10px] text-center text-zinc-400 mt-4">
                Atendimento de segunda a sábado das 08h às 19h • (17) 99614-0963
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating WhatsApp Support Button */}
      <button
        onClick={openWhatsAppContact}
        aria-label="Falar pelo WhatsApp (17) 99614-0963"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xl shadow-emerald-900/20 transition-all hover:scale-105 hover:bg-emerald-700 active:scale-95"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Atendimento WhatsApp</span>
      </button>

      {/* Footer */}
      <footer className="border-t border-[#E5E2DC] bg-white px-5 py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#171717]">
                <Sparkles className="h-3.5 w-3.5 text-[#D8C79F]" />
              </span>
              <span className="font-semibold text-base">Lumière<span className="text-[#B89B5E]">OS</span></span>
            </div>
            <p className="mt-2 text-xs text-[#8B8881]">
              Sistema integrado de gestão de empresas e pessoas potencializado por Inteligência Artificial.
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#6B6B6B]">
              Atendimento Comercial & Suporte: (17) 99614-0963
            </p>
          </div>
          
          <div className="flex flex-wrap gap-6 text-xs text-[#6B6B6B]">
            <button onClick={() => navigate('/login')} className="hover:text-[#171717]">Entrar no Painel</button>
            <button onClick={() => go('gestao')} className="hover:text-[#171717]">Empresas & Pessoas</button>
            <button onClick={() => go('lumi')} className="hover:text-[#171717]">Lumi IA</button>
            <button onClick={() => go('pilares')} className="hover:text-[#171717]">Pilares</button>
            <button onClick={() => go('planos')} className="hover:text-[#171717]">Planos & Preços</button>
            <button onClick={() => go('faq')} className="hover:text-[#171717]">Dúvidas</button>
            <button onClick={openWhatsAppContact} className="text-emerald-700 font-semibold hover:underline">WhatsApp (17) 99614-0963</button>
          </div>

          <p className="text-xs text-[#8B8881]">© {new Date().getFullYear()} LumièreOS. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

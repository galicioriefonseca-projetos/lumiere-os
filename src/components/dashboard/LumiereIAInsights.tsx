import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  RefreshCw, 
  ChevronRight, 
  ListTodo,
  Bot,
  Zap,
  ArrowUpRight,
  Lightbulb,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatBRL } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LumiMascotAvatar } from '@/components/lumi/LumiMascotAvatar';
import { LumiConsultingModal } from '@/components/lumi/LumiConsultingModal';

interface LumiereDailyInsightData {
  executiveSummary: string;
  status: 'optimal' | 'attention' | 'critical';
  statusLabel: string;
  goals: {
    todayTarget: number;
    todayAchieved: number;
    progressPct: number;
    monthlyTarget: number;
    monthlyAchieved: number;
    monthlyProgressPct: number;
  };
  goalsDiagnosis: {
    analysis: string;
    paceDescription: string;
  };
  pendencies: Array<{
    id: string;
    category: 'appointments' | 'checklists' | 'financial' | 'team';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    actionLabel: string;
    actionUrl: string;
  }>;
  financialAlerts: Array<{
    id: string;
    type: 'positive' | 'warning' | 'danger' | 'info';
    title: string;
    description: string;
    highlight?: string;
  }>;
  strategicTip: string;
  isAiGenerated: boolean;
  engine: string;
  generatedAt: string;
}

interface LumiereIAInsightsProps {
  salonId?: string;
  salonName?: string;
  userName?: string;
  clientMetrics?: {
    todayRevenue?: number;
    monthRevenue?: number;
    dailyGoal?: number;
    monthlyGoal?: number;
    scheduledAppointments?: number;
    completedAppointments?: number;
    pendingAppointments?: number;
    checklistRunsCount?: number;
  };
  className?: string;
}

export function LumiereIAInsights({
  salonId: propSalonId,
  salonName = 'Nosso Salão',
  userName = 'Gestor',
  clientMetrics,
  className
}: LumiereIAInsightsProps) {
  const { salonData } = useAuth();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<LumiereDailyInsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState(false);

  const effectiveSalonId = propSalonId || salonData?.id || 'demo-salon';

  const loadInsights = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/lumiere-insights/daily?salonId=${effectiveSalonId}&refresh=${forceRefresh ? 'true' : 'false'}`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      } else {
        fallbackWithClientMetrics();
      }
    } catch (e) {
      fallbackWithClientMetrics();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fallbackWithClientMetrics = () => {
    const todayTarget = clientMetrics?.dailyGoal || 1000;
    const todayAchieved = clientMetrics?.todayRevenue || 0;
    const progressPct = todayTarget > 0 ? Math.round((todayAchieved / todayTarget) * 100) : 0;
    const monthlyTarget = clientMetrics?.monthlyGoal || 25000;
    const monthlyAchieved = clientMetrics?.monthRevenue || 0;
    const monthlyProgressPct = monthlyTarget > 0 ? Math.round((monthlyAchieved / monthlyTarget) * 100) : 0;

    const remaining = Math.max(0, todayTarget - todayAchieved);

    setInsights({
      executiveSummary: `Operação em andamento no ${salonName}. O foco de hoje é atingir ${formatBRL(todayTarget)} com confirmação ativa de horários e venda cruzada de cuidados home care.`,
      status: progressPct >= 70 ? 'optimal' : progressPct >= 30 ? 'attention' : 'critical',
      statusLabel: progressPct >= 70 ? 'Ritmo Operacional Saudável' : 'Aceleração Recomendada',
      goals: {
        todayTarget,
        todayAchieved,
        progressPct,
        monthlyTarget,
        monthlyAchieved,
        monthlyProgressPct
      },
      goalsDiagnosis: {
        analysis: progressPct >= 100 ? 'Meta diária batida com excelência!' : `Faltam ${formatBRL(remaining)} para a cota de hoje.`,
        paceDescription: progressPct >= 100 ? 'Excelente ritmo! Busque upsell adicional com tratamentos express.' : `Atingimento de ${progressPct}% da meta do dia.`
      },
      pendencies: [
        {
          id: 'p-1',
          category: 'appointments',
          priority: 'medium',
          title: 'Confirmar Agendamentos de Hoje',
          description: `${clientMetrics?.pendingAppointments || 0} clientes aguardam confirmação na agenda.`,
          actionLabel: 'Ver Agenda',
          actionUrl: '/dashboard/agendamentos'
        }
      ],
      financialAlerts: [
        {
          id: 'f-1',
          type: 'positive',
          title: 'Faturamento do Dia',
          description: `${formatBRL(todayAchieved)} recebidos hoje.`,
          highlight: formatBRL(todayAchieved)
        }
      ],
      strategicTip: 'Incentive sua equipe a oferecer nutrição capilar ou hidratação express durante os atendimentos de hoje para elevar o ticket médio da bancada.',
      isAiGenerated: false,
      engine: 'Lumière Native Engine',
      generatedAt: new Date().toISOString()
    });
  };

  useEffect(() => {
    loadInsights();
  }, [salonData?.id]);

  if (loading) {
    return (
      <div className={cn("relative overflow-hidden bg-gradient-to-br from-[#14121a] via-[#0d0c12] to-[#07060a] rounded-3xl border border-[#D4AF37]/20 p-6 md:p-8 shadow-2xl animate-pulse space-y-4", className)}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-white/10 rounded w-1/4" />
            <div className="h-6 bg-white/10 rounded w-1/2" />
          </div>
        </div>
        <div className="h-20 bg-white/5 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-36 bg-white/5 rounded-2xl" />
          <div className="h-36 bg-white/5 rounded-2xl" />
          <div className="h-36 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const isOptimal = insights.status === 'optimal';
  const isAttention = insights.status === 'attention';
  const isCritical = insights.status === 'critical';

  const mascotMood = isOptimal 
    ? (insights.goals?.progressPct >= 100 ? 'celebrating' : 'happy')
    : isAttention ? 'strategic' : 'alert';

  const cleanEngine = !insights.engine || insights.engine.includes('Fallback') || insights.engine.includes('Heuristic')
    ? 'Lumière Native Engine'
    : insights.engine.replace(' (Google AI)', '');

  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-[#14121c] via-[#0e0c14] to-[#07060a] rounded-3xl border border-[#D4AF37]/30 p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-6 text-white transition-all duration-300", className)}>
      {/* Luz ambiente suave de Champagne Acetinado */}
      <div className="absolute top-0 right-0 -translate-y-16 translate-x-16 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 translate-y-24 w-80 h-80 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Cabeçalho com a Gestora Virtual Lumi */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <LumiMascotAvatar size="lg" mood={mascotMood} />
          
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] bg-[#D4AF37]/15 border border-[#D4AF37]/35 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm font-mono">
                <Sparkles className="w-3 h-3 text-[#D4AF37] animate-pulse" />
                LUMI · GESTORA DE NEGÓCIOS VIRTUAL
              </span>

              <span className="text-[10px] font-medium tracking-wide text-zinc-300 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-mono">
                <Bot className="w-3 h-3 text-[#D4AF37]" />
                {cleanEngine}
              </span>

              {/* Badge de Status Operacional */}
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-mono",
                isOptimal && "text-emerald-400 bg-emerald-500/15 border-emerald-500/35",
                isAttention && "text-amber-400 bg-amber-500/15 border-amber-500/35",
                isCritical && "text-rose-400 bg-rose-500/15 border-rose-500/35"
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  isOptimal && "bg-emerald-400",
                  isAttention && "bg-amber-400",
                  isCritical && "bg-rose-400"
                )} />
                {insights.statusLabel || (isOptimal ? 'Operação Saudável' : isAttention ? 'Ajustes Recomendados' : 'Ação Prioritária')}
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white font-heading">
              Diagnóstico Estratégico da Lumi
            </h2>
            <p className="text-xs text-zinc-300 font-light">
              Acompanhamento inteligente de metas, rotinas e oportunidades para o {salonName}.
            </p>
          </div>
        </div>

        {/* Botões de Ação: Consultoria da Lumi & Atualização */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 shrink-0">
          <Button
            size="sm"
            onClick={() => setIsConsultingModalOpen(true)}
            className="bg-[#D4AF37] hover:bg-amber-400 text-black font-semibold text-xs h-9 px-4 rounded-xl shadow-lg transition-all flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Consultar a Lumi</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInsights(true)}
            disabled={refreshing}
            className="rounded-xl border-white/15 hover:border-[#D4AF37]/50 text-zinc-200 hover:text-white bg-white/5 hover:bg-white/10 text-xs h-9 px-3.5 font-medium transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-2 text-[#D4AF37]", refreshing && "animate-spin")} />
            {refreshing ? "Calculando..." : "Atualizar"}
          </Button>
        </div>
      </div>

      {/* Resumo Executivo & Dica de Ouro da Lumi */}
      <div className="relative z-10 bg-gradient-to-br from-[#191624]/90 to-[#100e18]/90 border border-[#D4AF37]/25 rounded-2xl p-5 md:p-6 space-y-4 backdrop-blur-md shadow-lg">
        <div className="flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="space-y-1.5 flex-1">
            <span className="text-[11px] uppercase font-bold tracking-widest text-[#D4AF37] font-mono">
              Visão Geral da Lumi
            </span>
            <p className="text-sm md:text-base text-zinc-100 font-normal leading-relaxed">
              "{insights.executiveSummary}"
            </p>
          </div>
        </div>

        {insights.strategicTip && (
          <div className="pt-3 border-t border-white/10 flex items-start gap-3 bg-[#D4AF37]/10 -mx-5 -mb-5 md:-mx-6 md:-mb-6 p-4 rounded-b-2xl border-t border-[#D4AF37]/20">
            <Lightbulb className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5 animate-bounce" />
            <div className="text-xs text-zinc-200 leading-relaxed">
              <strong className="text-[#D4AF37] font-semibold">Dica de Ouro da Lumi para Faturar Mais: </strong>
              {insights.strategicTip}
            </div>
          </div>
        )}
      </div>

      {/* Grid de 3 Pilares: Metas & Pacing | Missões & Pendências | Alertas Financeiros */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pilar 1: Radar de Metas & Pacing */}
        <div className="bg-[#14121a]/95 border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-[#D4AF37]/40 transition-all shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#D4AF37]">
                <Target className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Radar de Metas</h3>
              </div>
              <button 
                onClick={() => navigate('/dashboard/metas')}
                className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-0.5 font-medium"
              >
                Gerenciar <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Meta Diária */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">Meta Diária</span>
                <span className="font-bold text-white">
                  {formatBRL(insights.goals?.todayAchieved || 0)} / {formatBRL(insights.goals?.todayTarget || 0)}
                </span>
              </div>
              <Progress value={Math.min(insights.goals?.progressPct || 0, 100)} className="h-2 bg-zinc-800" />
              <div className="flex justify-between items-center text-[11px] text-zinc-300 pt-0.5">
                <span className={cn(
                  "font-semibold",
                  (insights.goals?.progressPct || 0) >= 100 ? "text-emerald-400" : "text-[#D4AF37]"
                )}>
                  {insights.goals?.progressPct || 0}% atingido
                </span>
                <span className="text-zinc-400">
                  {(insights.goals?.todayTarget || 0) - (insights.goals?.todayAchieved || 0) > 0
                    ? `Faltam ${formatBRL((insights.goals?.todayTarget || 0) - (insights.goals?.todayAchieved || 0))}`
                    : 'Meta batida! 🎉'}
                </span>
              </div>
            </div>

            {/* Meta Mensal */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">Meta Mensal</span>
                <span className="font-bold text-white">
                  {formatBRL(insights.goals?.monthlyAchieved || 0)} / {formatBRL(insights.goals?.monthlyTarget || 0)}
                </span>
              </div>
              <Progress value={Math.min(insights.goals?.monthlyProgressPct || 0, 100)} className="h-2 bg-zinc-800" />
              <div className="flex justify-between items-center text-[11px] text-zinc-300 pt-0.5">
                <span className="font-semibold text-[#D4AF37]">
                  {insights.goals?.monthlyProgressPct || 0}% acumulado
                </span>
                <span className="text-zinc-400">Alvo do Mês</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-300 leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/5">
            {insights.goalsDiagnosis?.paceDescription || 'Ritmo de vendas alinhado aos objetivos da equipe.'}
          </p>
        </div>

        {/* Pilar 2: Missões & Pendências Prioritárias */}
        <div className="bg-[#14121a]/95 border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-amber-400/40 transition-all shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <ListTodo className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Missões & Pendências</h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {insights.pendencies?.length || 0} ações
              </span>
            </div>

            <div className="space-y-2.5">
              {(!insights.pendencies || insights.pendencies.length === 0) ? (
                <div className="p-4 text-center text-xs text-zinc-400 space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="font-medium text-white">Tudo em dia!</p>
                  <p className="text-[11px] text-zinc-400">Nenhuma pendência crítica travando a operação.</p>
                </div>
              ) : (
                insights.pendencies.slice(0, 2).map((item) => (
                  <div 
                    key={item.id}
                    className="p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#D4AF37]/30 transition-all space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-white line-clamp-1">
                        {item.title}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                        item.priority === 'high' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      )}>
                        {item.priority === 'high' ? 'Alta' : 'Média'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                    {item.actionUrl && (
                      <button
                        onClick={() => navigate(item.actionUrl)}
                        className="text-[10px] text-[#D4AF37] font-semibold hover:underline flex items-center gap-1 pt-1"
                      >
                        {item.actionLabel || 'Resolver'} <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-[10px] text-zinc-400 text-center pt-2 border-t border-white/10">
            Checklists e confirmações diárias elevam o padrão de atendimento.
          </div>
        </div>

        {/* Pilar 3: Alertas Financeiros & Fluxo de Caixa */}
        <div className="bg-[#14121a]/95 border border-white/10 rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-emerald-400/40 transition-all shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <DollarSign className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Alertas Financeiros</h3>
              </div>
              <button 
                onClick={() => navigate('/dashboard/financeiro')}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-0.5 font-medium"
              >
                Extrato <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(!insights.financialAlerts || insights.financialAlerts.length === 0) ? (
                <div className="p-4 text-center text-xs text-zinc-400 space-y-1">
                  <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="font-medium text-white">Fluxo Estável</p>
                  <p className="text-[11px] text-zinc-400">Nenhum alerta de despesa extraordinária hoje.</p>
                </div>
              ) : (
                insights.financialAlerts.slice(0, 2).map((alert) => (
                  <div 
                    key={alert.id}
                    className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        {alert.title}
                      </span>
                      {alert.highlight && (
                        <span className={cn(
                          "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                          alert.type === 'positive' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                          alert.type === 'warning' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30"
                        )}>
                          {alert.highlight}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      {alert.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/financeiro')}
            className="w-full text-xs text-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 h-8 rounded-xl font-semibold transition-all"
          >
            Ver Fluxo de Caixa Completo
          </Button>
        </div>
      </div>

      {/* Modal Interativo de Consultoria da Gestora Virtual Lumi */}
      <LumiConsultingModal
        isOpen={isConsultingModalOpen}
        onClose={() => setIsConsultingModalOpen(false)}
        salonName={salonName}
        userName={userName}
        metrics={{
          todayRevenue: insights.goals?.todayAchieved || 0,
          monthRevenue: insights.goals?.monthlyAchieved || 0,
          dailyGoal: insights.goals?.todayTarget || 1000,
          monthlyGoal: insights.goals?.monthlyTarget || 25000,
          scheduledCount: clientMetrics?.scheduledAppointments || 0,
          pendingCount: clientMetrics?.pendingAppointments || 0,
        }}
      />
    </div>
  );
}

export default LumiereIAInsights;

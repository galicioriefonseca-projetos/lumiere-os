import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  RefreshCw, 
  Target, 
  ListTodo, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Lightbulb, 
  DollarSign,
  ChevronRight,
  ShieldAlert,
  Zap,
  Bot,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatBRL } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  lumiereAiService, 
  LumiereDailyInsights, 
  ClientMetricsSnapshot 
} from '@/services/lumiereAiService';
import { LumiMascotAvatar } from '../lumi/LumiMascotAvatar';
import { LumiConsultingModal } from '../lumi/LumiConsultingModal';

interface LumiereIAInsightsProps {
  salonId: string;
  salonName?: string;
  userName?: string;
  clientMetrics?: ClientMetricsSnapshot;
  className?: string;
}

export function LumiereIAInsights({
  salonId,
  salonName = 'Nosso Salão',
  userName = 'Gestor',
  clientMetrics,
  className
}: LumiereIAInsightsProps) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<LumiereDailyInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState<boolean>(false);

  const loadInsights = useCallback(async (isRefresh = false) => {
    if (!salonId) return;
    
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await lumiereAiService.getDailyInsights(salonId, clientMetrics, isRefresh);
      setInsights(data);
      if (isRefresh) {
        toast.success("Insights da Lumi atualizados com sucesso!");
      }
    } catch (err: any) {
      console.error("[LumiereIAInsights] Erro ao carregar insights diários:", err);
      setError(err?.message || "Não foi possível carregar os insights da Lumi.");
      if (isRefresh) {
        toast.error("Erro ao atualizar insights. Tente novamente.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [salonId, clientMetrics]);

  useEffect(() => {
    loadInsights(false);
  }, [loadInsights]);

  // Loading Skeleton no estilo Atelier Quiet Luxury
  if (loading && !insights) {
    return (
      <div className={cn("relative overflow-hidden bg-card rounded-3xl border border-primary/20 p-6 md:p-8 shadow-sm space-y-6 animate-pulse", className)}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20" />
            <div className="space-y-2">
              <div className="h-4 w-44 bg-primary/15 rounded-full" />
              <div className="h-6 w-64 bg-secondary rounded-lg" />
            </div>
          </div>
          <div className="h-9 w-36 bg-secondary rounded-xl" />
        </div>
        <div className="h-20 bg-secondary/50 rounded-2xl border border-border/40" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-48 bg-secondary/40 rounded-2xl border border-border/30" />
          <div className="h-48 bg-secondary/40 rounded-2xl border border-border/30" />
          <div className="h-48 bg-secondary/40 rounded-2xl border border-border/30" />
        </div>
      </div>
    );
  }

  // Error State com ação de recarregar
  if (error && !insights) {
    return (
      <div className={cn("relative overflow-hidden bg-card rounded-3xl border border-rose-500/25 p-6 md:p-8 shadow-sm text-center space-y-4", className)}>
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Não foi possível conectar à Lumi</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => loadInsights(true)}
          className="rounded-xl border-border hover:border-primary/40 text-xs h-9 px-4"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          Tentar Novamente
        </Button>
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

  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-card via-[#0f0e13] to-card rounded-3xl border border-primary/25 p-6 md:p-8 shadow-[0_15px_35px_rgba(0,0,0,0.4)] space-y-6 transition-all duration-300", className)}>
      {/* Luz ambiente suave de Champagne Acetinado */}
      <div className="absolute top-0 right-0 -translate-y-16 translate-x-16 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 translate-y-24 w-80 h-80 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

      {/* Cabeçalho com o Mascote Lumi */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <LumiMascotAvatar size="lg" mood={mascotMood} />
          
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 border border-primary/25 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm font-mono">
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                LUMI · SUA COPILOTO DE GESTÃO
              </span>

              <span className="text-[10px] font-medium tracking-wide text-zinc-400 bg-secondary/80 border border-border px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Bot className="w-3 h-3 text-primary" />
                {insights.engine || 'Lumière Native Engine'}
              </span>

              {/* Badge de Status Operacional */}
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1.5",
                isOptimal && "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
                isAttention && "text-amber-400 bg-amber-500/10 border-amber-500/30",
                isCritical && "text-rose-400 bg-rose-500/10 border-rose-500/30"
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

            <h2 className="text-xl md:text-2xl font-light tracking-tight text-foreground font-heading">
              Diagnóstico Estratégico da Lumi
            </h2>
            <p className="text-xs text-muted-foreground">
              Acompanhamento inteligente de metas, rotinas e oportunidades para o {salonName}.
            </p>
          </div>
        </div>

        {/* Botões de Ação: Consultoria da Lumi & Atualização */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 shrink-0">
          <Button
            size="sm"
            onClick={() => setIsConsultingModalOpen(true)}
            className="bg-gradient-to-r from-[#D4AF37] to-amber-500 hover:from-amber-500 hover:to-[#D4AF37] text-black font-semibold text-xs h-9 px-4 rounded-xl shadow-lg transition-all flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Consultar a Lumi</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInsights(true)}
            disabled={refreshing}
            className="rounded-xl border-border hover:border-primary/40 text-foreground bg-secondary/40 text-xs h-9 px-3.5 font-medium transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-2 text-primary", refreshing && "animate-spin text-primary")} />
            {refreshing ? "Calculando..." : "Atualizar"}
          </Button>
        </div>
      </div>

      {/* Resumo Executivo & Dica de Ouro da Lumi */}
      <div className="relative z-10 bg-secondary/40 border border-primary/20 rounded-2xl p-5 md:p-6 space-y-4 backdrop-blur-sm shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-1 flex-1">
            <span className="text-[11px] uppercase font-bold tracking-widest text-primary">
              Visão Geral da Lumi
            </span>
            <p className="text-sm md:text-base text-foreground font-light leading-relaxed">
              "{insights.executiveSummary}"
            </p>
          </div>
        </div>

        {insights.strategicTip && (
          <div className="pt-3 border-t border-border/50 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-amber-400/90 font-medium">Dica de Ouro da Lumi para Faturar Mais: </strong>
              {insights.strategicTip}
            </div>
          </div>
        )}
      </div>

      {/* Grid de 3 Pilares: Metas & Pacing | Missões & Pendências | Alertas Financeiros */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pilar 1: Radar de Metas & Pacing */}
        <div className="bg-secondary/30 border border-border/80 rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-primary/30 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Target className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Radar de Metas</h3>
              </div>
              <button 
                onClick={() => navigate('/dashboard/metas')}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                Gerenciar <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Meta Diária */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Meta Diária</span>
                <span className="font-semibold text-foreground">
                  {formatBRL(insights.goals?.todayAchieved || 0)} / {formatBRL(insights.goals?.todayTarget || 0)}
                </span>
              </div>
              <Progress value={Math.min(insights.goals?.progressPct || 0, 100)} className="h-2 bg-secondary" />
              <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
                <span className={cn(
                  "font-medium",
                  (insights.goals?.progressPct || 0) >= 100 ? "text-emerald-400" : "text-primary"
                )}>
                  {insights.goals?.progressPct || 0}% atingido
                </span>
                <span>
                  {(insights.goals?.todayTarget || 0) - (insights.goals?.todayAchieved || 0) > 0
                    ? `Faltam ${formatBRL((insights.goals?.todayTarget || 0) - (insights.goals?.todayAchieved || 0))}`
                    : 'Meta superada! 🎉'}
                </span>
              </div>
            </div>

            {/* Meta Mensal */}
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Meta Mensal</span>
                <span className="font-semibold text-foreground">
                  {formatBRL(insights.goals?.monthlyAchieved || 0)} / {formatBRL(insights.goals?.monthlyTarget || 0)}
                </span>
              </div>
              <Progress value={Math.min(insights.goals?.monthlyProgressPct || 0, 100)} className="h-2 bg-secondary" />
              <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
                <span className="font-medium text-primary">
                  {insights.goals?.monthlyProgressPct || 0}% acumulado
                </span>
                <span>Alvo do Mês</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed bg-background/40 p-2.5 rounded-xl border border-border/40">
            {insights.goalsDiagnosis?.paceDescription || 'Ritmo de vendas alinhado aos objetivos da equipe.'}
          </p>
        </div>

        {/* Pilar 2: Missões & Pendências Prioritárias */}
        <div className="bg-secondary/30 border border-border/80 rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-primary/30 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <ListTodo className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Missões & Pendências</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {insights.pendencies?.length || 0} ações
              </span>
            </div>

            <div className="space-y-2.5">
              {(!insights.pendencies || insights.pendencies.length === 0) ? (
                <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="font-medium text-foreground">Tudo em dia!</p>
                  <p className="text-[11px]">Nenhuma pendência crítica travando a operação.</p>
                </div>
              ) : (
                insights.pendencies.slice(0, 2).map((item) => (
                  <div 
                    key={item.id}
                    className="p-3 rounded-xl bg-background/50 border border-border/50 hover:border-primary/30 transition-all space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground line-clamp-1">
                        {item.title}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                        item.priority === 'high' ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-400"
                      )}>
                        {item.priority === 'high' ? 'Alta' : 'Média'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                    {item.actionUrl && (
                      <button
                        onClick={() => navigate(item.actionUrl)}
                        className="text-[10px] text-primary font-medium hover:underline flex items-center gap-1 pt-1"
                      >
                        {item.actionLabel || 'Resolver'} <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-[10px] text-zinc-400 text-center pt-2 border-t border-border/30">
            Checklists e confirmações diárias elevam o NPS do salão.
          </div>
        </div>

        {/* Pilar 3: Alertas Financeiros & Fluxo de Caixa */}
        <div className="bg-secondary/30 border border-border/80 rounded-2xl p-5 space-y-4 flex flex-col justify-between hover:border-primary/30 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <DollarSign className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Alertas Financeiros</h3>
              </div>
              <button 
                onClick={() => navigate('/dashboard/financeiro')}
                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                Extrato <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(!insights.financialAlerts || insights.financialAlerts.length === 0) ? (
                <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
                  <DollarSign className="w-6 h-6 text-primary mx-auto mb-1" />
                  <p className="font-medium text-foreground">Fluxo Estável</p>
                  <p className="text-[11px]">Nenhum alerta de despesa extraordinária hoje.</p>
                </div>
              ) : (
                insights.financialAlerts.slice(0, 2).map((alert) => (
                  <div 
                    key={alert.id}
                    className="p-3 rounded-xl bg-background/50 border border-border/50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        {alert.title}
                      </span>
                      {alert.highlight && (
                        <span className={cn(
                          "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                          alert.type === 'positive' ? "bg-emerald-500/15 text-emerald-400" :
                          alert.type === 'warning' ? "bg-rose-500/15 text-rose-400" : "bg-primary/15 text-primary"
                        )}>
                          {alert.highlight}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
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
            className="w-full text-xs text-primary hover:bg-primary/10 h-8 rounded-xl font-medium"
          >
            Ver Fluxo de Caixa Completo
          </Button>
        </div>
      </div>

      {/* Modal Interativo de Consultoria da Mascote Lumi */}
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

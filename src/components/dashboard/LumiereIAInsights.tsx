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
  Bot
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

interface LumiereIAInsightsProps {
  salonId: string;
  salonName?: string;
  clientMetrics?: ClientMetricsSnapshot;
  className?: string;
}

export function LumiereIAInsights({
  salonId,
  salonName,
  clientMetrics,
  className
}: LumiereIAInsightsProps) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<LumiereDailyInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
        toast.success("Insights LumièreIA atualizados com sucesso!");
      }
    } catch (err: any) {
      console.error("[LumiereIAInsights] Erro ao carregar insights diários:", err);
      setError(err?.message || "Não foi possível carregar os insights do dia.");
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
          <div className="space-y-2">
            <div className="h-4 w-44 bg-primary/15 rounded-full" />
            <div className="h-6 w-64 bg-secondary rounded-lg" />
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
          <h3 className="text-base font-semibold text-foreground">Não foi possível conectar à LumièreIA</h3>
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

  return (
    <div className={cn("relative overflow-hidden bg-card rounded-3xl border border-primary/25 p-6 md:p-8 shadow-sm space-y-6 transition-all duration-300", className)}>
      {/* Luz ambiente suave de Champagne Acetinado */}
      <div className="absolute top-0 right-0 -translate-y-16 translate-x-16 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 translate-y-24 w-80 h-80 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

      {/* Cabeçalho do Componente */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3 h-3 text-primary animate-pulse" />
              LUMIÈREIA INSIGHTS
            </span>

            <span className="text-[10px] font-medium tracking-wide text-muted-foreground bg-secondary/80 border border-border px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Bot className="w-3 h-3 text-primary" />
              {insights.engine || 'Gemini 3.8 Intelligence'}
            </span>

            {/* Badge de Status Operacional */}
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5",
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
              {insights.statusLabel || (isOptimal ? 'Operação Ideal' : isAttention ? 'Atenção ao Ritmo' : 'Ação Crítica')}
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-light tracking-tight text-foreground font-heading">
            Radar Executivo do Dia
          </h2>
          <p className="text-xs text-muted-foreground">
            Síntese analítica em tempo real de metas, pendências e alertas do {salonName || 'salão'}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadInsights(true)}
            disabled={refreshing}
            className="rounded-xl border-border hover:border-primary/40 text-foreground bg-secondary/40 text-xs h-9 px-3.5 font-medium transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-2 text-primary", refreshing && "animate-spin text-primary")} />
            {refreshing ? "Sincronizando..." : "Atualizar Insights"}
          </Button>
        </div>
      </div>

      {/* Resumo Executivo & Dica de Ouro */}
      <div className="relative z-10 bg-secondary/40 border border-primary/20 rounded-2xl p-5 md:p-6 space-y-4 backdrop-blur-sm shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-1 flex-1">
            <span className="text-[11px] uppercase font-bold tracking-widest text-primary">
              Síntese Executiva Lumière
            </span>
            <p className="text-sm md:text-base text-foreground font-heading italic leading-relaxed font-light">
              "{insights.executiveSummary}"
            </p>
          </div>
        </div>

        {/* Dica Estratégica Cirúrgica */}
        {insights.strategicTip && (
          <div className="pt-3.5 border-t border-border/60 flex items-start gap-3 text-xs">
            <div className="p-1 rounded-md bg-accent text-primary shrink-0 mt-0.5">
              <Lightbulb className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground font-semibold">Dica de Ouro para Hoje: </strong>
              {insights.strategicTip}
            </p>
          </div>
        )}
      </div>

      {/* Grid de 3 Pilares: Metas, Pendências e Alertas Financeiros */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* PILAR 1: METAS DO DIA & MÊS */}
        <div className="bg-secondary/30 rounded-2xl border border-border hover:border-primary/30 p-5 space-y-4 flex flex-col justify-between transition-all duration-300 shadow-sm group">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-accent border border-primary/20 group-hover:scale-105 transition-transform">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Metas do Dia</h3>
                  <span className="text-[10px] text-muted-foreground">Progresso e ritmo de vendas</span>
                </div>
              </div>

              <span className={cn(
                "text-xs font-bold font-mono px-2 py-0.5 rounded-lg border",
                insights.goals.progressPct >= 100 
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" 
                  : insights.goals.progressPct >= 60 
                  ? "text-primary bg-primary/10 border-primary/25" 
                  : "text-amber-400 bg-amber-500/10 border-amber-500/30"
              )}>
                {insights.goals.progressPct}%
              </span>
            </div>

            {/* Barra de Progresso Diária */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-muted-foreground text-[11px]">Realizado Hoje</span>
                <span className="font-semibold text-foreground font-mono">
                  {formatBRL(insights.goals.todayAchieved)} <span className="text-[10px] text-muted-foreground font-normal">/ {formatBRL(insights.goals.todayTarget)}</span>
                </span>
              </div>
              <Progress value={Math.min(insights.goals.progressPct, 100)} className="h-2 bg-secondary" />
            </div>

            {/* Diagnóstico da IA */}
            <div className="bg-card/70 border border-border/80 rounded-xl p-3 space-y-1 text-xs">
              <p className="text-foreground leading-relaxed text-[11px]">
                {insights.goalsDiagnosis?.analysis || "Metas em acompanhamento contínuo."}
              </p>
              {insights.goalsDiagnosis?.paceDescription && (
                <p className="text-[10px] text-primary font-medium flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 shrink-0" />
                  {insights.goalsDiagnosis.paceDescription}
                </p>
              )}
            </div>

            {/* Snapshot Mensal */}
            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Acumulado do Mês:</span>
              <span className="font-semibold text-foreground font-mono">
                {formatBRL(insights.goals.monthlyAchieved)} ({insights.goals.monthlyProgressPct}%)
              </span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard/metas')}
            className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-xl justify-between h-8 px-3 font-medium cursor-pointer"
          >
            <span>Gerenciar Metas</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {/* PILAR 2: PENDÊNCIAS OPERACIONAIS DO DIA */}
        <div className="bg-secondary/30 rounded-2xl border border-border hover:border-primary/30 p-5 space-y-4 flex flex-col justify-between transition-all duration-300 shadow-sm group">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-accent border border-primary/20 group-hover:scale-105 transition-transform">
                  <ListTodo className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Pendências do Dia</h3>
                  <span className="text-[10px] text-muted-foreground">Ações e confirmações urgentes</span>
                </div>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg bg-secondary border border-border text-foreground font-mono">
                {insights.pendencies.length} {insights.pendencies.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {/* Lista de Pendências */}
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {insights.pendencies.length === 0 ? (
                <div className="p-4 rounded-xl bg-card/50 border border-border text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                  <p className="text-xs font-medium text-foreground">Nenhuma pendência crítica!</p>
                  <p className="text-[10px] text-muted-foreground">Operação, agendamentos e checklists fluindo 100%.</p>
                </div>
              ) : (
                insights.pendencies.map((item) => (
                  <div 
                    key={item.id}
                    className="p-3 rounded-xl bg-card/80 border border-border/80 hover:border-primary/35 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          item.priority === 'high' ? "bg-rose-400" : item.priority === 'medium' ? "bg-amber-400" : "bg-primary"
                        )} />
                        <h4 className="text-xs font-semibold text-foreground line-clamp-1">{item.title}</h4>
                      </div>
                      <span className={cn(
                        "text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border shrink-0",
                        item.priority === 'high' ? "text-rose-400 border-rose-500/30 bg-rose-500/10" :
                        item.priority === 'medium' ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                        "text-muted-foreground border-border bg-secondary"
                      )}>
                        {item.priority === 'high' ? 'Alta' : item.priority === 'medium' ? 'Média' : 'Baixa'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                    {item.actionLabel && (
                      <button
                        onClick={() => navigate(item.actionUrl || '/dashboard')}
                        className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                      >
                        {item.actionLabel}
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard/agendamentos')}
            className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-xl justify-between h-8 px-3 font-medium cursor-pointer"
          >
            <span>Ver Agenda Completa</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {/* PILAR 3: ALERTAS FINANCEIROS DO DIA */}
        <div className="bg-secondary/30 rounded-2xl border border-border hover:border-primary/30 p-5 space-y-4 flex flex-col justify-between transition-all duration-300 shadow-sm group">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-accent border border-primary/20 group-hover:scale-105 transition-transform">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Radar Financeiro</h3>
                  <span className="text-[10px] text-muted-foreground">Fluxo de caixa e liquidez</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-mono font-semibold text-foreground">
                <span>Hoje:</span>
                <span className={cn(
                  "font-bold",
                  (insights.goals.todayAchieved - (insights.goals.todayTarget > 0 ? 0 : 0)) >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {formatBRL(insights.goals.todayAchieved)}
                </span>
              </div>
            </div>

            {/* Alertas Financeiros */}
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {insights.financialAlerts.length === 0 ? (
                <div className="p-4 rounded-xl bg-card/50 border border-border text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                  <p className="text-xs font-medium text-foreground">Finanças sob controle!</p>
                  <p className="text-[10px] text-muted-foreground">Sem alertas de risco ou descompasso financeiro hoje.</p>
                </div>
              ) : (
                insights.financialAlerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className="p-3 rounded-xl bg-card/80 border border-border/80 hover:border-primary/35 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {alert.type === 'positive' ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : alert.type === 'warning' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : alert.type === 'danger' ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                        <h4 className="text-xs font-semibold text-foreground line-clamp-1">{alert.title}</h4>
                      </div>
                      {alert.highlight && (
                        <span className={cn(
                          "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                          alert.type === 'positive' ? "text-emerald-400 bg-emerald-500/10" :
                          alert.type === 'warning' ? "text-amber-400 bg-amber-500/10" :
                          alert.type === 'danger' ? "text-rose-400 bg-rose-500/10" :
                          "text-primary bg-primary/10"
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
            className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-xl justify-between h-8 px-3 font-medium cursor-pointer"
          >
            <span>Ver Fluxo Financeiro</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

      </div>

      {/* Rodapé com timestamp e nota de privacidade */}
      <div className="relative z-10 pt-2 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
          Análise contínua executada com dados reais da operação • Seguro & Multi-tenant
        </span>
        <span>
          Atualizado às {new Date(insights.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

export default LumiereIAInsights;

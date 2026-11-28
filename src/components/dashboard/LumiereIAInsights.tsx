import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Lightbulb,
  ListTodo,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatBRL } from '@/lib/utils';
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

function getLocalTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function LumiereIAInsights({
  salonId: propSalonId,
  salonName = 'Nosso Salão',
  userName = 'Gestor',
  clientMetrics,
  className,
}: LumiereIAInsightsProps) {
  const { salonData } = useAuth();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<LumiereDailyInsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState(false);

  const effectiveSalonId = propSalonId || salonData?.id;

  const buildLocalSummary = (): LumiereDailyInsightData => {
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();
    const monthlyTarget = clientMetrics?.monthlyGoal || 0;
    const todayTarget =
      clientMetrics?.dailyGoal || (monthlyTarget > 0 ? Math.round(monthlyTarget / daysInMonth) : 0);
    const todayAchieved = clientMetrics?.todayRevenue || 0;
    const monthlyAchieved = clientMetrics?.monthRevenue || 0;
    const progressPct = todayTarget > 0 ? Math.round((todayAchieved / todayTarget) * 100) : 0;
    const monthlyProgressPct =
      monthlyTarget > 0 ? Math.round((monthlyAchieved / monthlyTarget) * 100) : 0;
    const remaining = Math.max(0, todayTarget - todayAchieved);
    const pendingCount = clientMetrics?.pendingAppointments || 0;

    return {
      executiveSummary:
        pendingCount > 0
          ? `O ${salonName} tem ${pendingCount} atendimento(s) pendente(s) de confirmação hoje e ${formatBRL(
              todayAchieved
            )} faturados até o momento.`
          : `Operação do ${salonName} em andamento com ${formatBRL(
              todayAchieved
            )} faturados hoje e agenda sob controle.`,
      status: progressPct >= 70 || todayTarget === 0 ? 'optimal' : progressPct >= 30 ? 'attention' : 'critical',
      statusLabel:
        progressPct >= 70 || todayTarget === 0
          ? 'Ritmo Operacional Saudável'
          : 'Aceleração Recomendada',
      goals: {
        todayTarget,
        todayAchieved,
        progressPct,
        monthlyTarget,
        monthlyAchieved,
        monthlyProgressPct,
      },
      goalsDiagnosis: {
        analysis:
          todayTarget === 0
            ? 'Configure uma meta mensal para acompanhar o pacing diário.'
            : progressPct >= 100
              ? 'Meta diária atingida.'
              : `Faltam ${formatBRL(remaining)} para a cota de hoje.`,
        paceDescription:
          todayTarget === 0
            ? 'Nenhuma meta mensal cadastrada para o mês atual.'
            : progressPct >= 100
              ? 'Meta do dia superada. Priorize combos e revenda home care.'
              : `${progressPct}% da meta diária concluída até agora.`,
      },
      pendencies:
        pendingCount > 0
          ? [
              {
                id: 'p-1',
                category: 'appointments',
                priority: pendingCount > 2 ? 'high' : 'medium',
                title: `${pendingCount} agendamento(s) aguardando confirmação`,
                description:
                  'Envie confirmação via Central Lumi IA ou recepção para evitar faltas.',
                actionLabel: 'Abrir Agenda',
                actionUrl: '/dashboard/agendamentos',
              },
            ]
          : [],
      financialAlerts: [
        {
          id: 'f-1',
          type: todayAchieved > 0 ? 'positive' : 'info',
          title: 'Faturamento Realizado Hoje',
          description: `${formatBRL(todayAchieved)} contabilizados no dia.`,
          highlight: formatBRL(todayAchieved),
        },
      ],
      strategicTip:
        'Use os horários vagos do Mapa de Calor nos Relatórios para disparar uma oferta direcionada na Central Lumi IA.',
      isAiGenerated: false,
      engine: 'Lumière Analytics Local',
      generatedAt: new Date().toISOString(),
    };
  };

  const loadInsights = async (forceRefresh = false) => {
    if (!effectiveSalonId) {
      setLoading(false);
      return;
    }
    if (forceRefresh) setRefreshing(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken().catch(() => null);
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const res = await fetch('/api/lumiere-insights/daily', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          salonId: effectiveSalonId,
          date: getLocalTodayYmd(),
          clientMetrics,
          forceRefresh,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as LumiereDailyInsightData;
        setInsights(data);
      } else {
        setInsights(buildLocalSummary());
      }
    } catch {
      setInsights(buildLocalSummary());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadInsights(false);
  }, [effectiveSalonId]);

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-xl border border-[#E5E2DC] bg-white p-6 space-y-4',
          className
        )}
      >
        <div className="h-5 w-48 rounded bg-[#F2EFE9]" />
        <div className="h-16 w-full rounded-lg bg-[#FAF9F7]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 rounded-lg bg-[#FAF9F7]" />
          <div className="h-28 rounded-lg bg-[#FAF9F7]" />
          <div className="h-28 rounded-lg bg-[#FAF9F7]" />
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const isOptimal = insights.status === 'optimal';
  const isAttention = insights.status === 'attention';
  const statusTone = isOptimal
    ? 'text-emerald-700'
    : isAttention
      ? 'text-amber-700'
      : 'text-red-700';

  const cleanEngine =
    !insights.engine ||
    insights.engine.includes('Fallback') ||
    insights.engine.includes('Heuristic')
      ? 'Diagnóstico Operacional'
      : insights.engine.replace(' (Google AI)', '');

  return (
    <div
      className={cn(
        'rounded-xl border border-[#E5E2DC] bg-white p-5 md:p-6 space-y-5 text-[#171717]',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E2DC] pb-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-[#6B6B6B]">
            <span className="text-[#8A6D36] font-semibold">Lumi IA</span>
            <span aria-hidden="true"> · </span>
            <span>{cleanEngine}</span>
            <span aria-hidden="true"> · </span>
            <span className={cn('font-semibold', statusTone)}>
              {insights.statusLabel || (isOptimal ? 'Operação Saudável' : 'Ajustes Recomendados')}
            </span>
          </p>
          <h2 className="text-lg font-semibold text-[#171717] font-heading">
            Diagnóstico Diário da Operação
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setIsConsultingModalOpen(true)}
            className="bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold text-xs h-10 px-4 rounded-lg gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#D8C79F]" />
            Consultar a Lumi
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadInsights(true)}
            disabled={refreshing}
            className="rounded-lg border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] text-xs h-10 px-3.5 font-medium gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 text-[#8A6D36]', refreshing && 'animate-spin')} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Executive Summary & Strategic Tip */}
      <div className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Zap className="w-4 h-4 text-[#8A6D36] shrink-0 mt-0.5" />
          <p className="text-sm text-[#171717] leading-relaxed">{insights.executiveSummary}</p>
        </div>

        {insights.strategicTip && (
          <div className="flex items-start gap-2.5 border-t border-[#E5E2DC] pt-3 text-xs text-[#4A4A4A] leading-relaxed">
            <Lightbulb className="w-4 h-4 text-[#8A6D36] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#171717] font-semibold">Recomendação prática: </strong>
              {insights.strategicTip}
            </div>
          </div>
        )}
      </div>

      {/* 3 Operational Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pillar 1: Goals & Pacing */}
        <div className="rounded-lg border border-[#E5E2DC] bg-white p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#8A6D36]" />
                Metas &amp; Ritmo
              </span>
              <button
                type="button"
                onClick={() => navigate('/dashboard/metas')}
                className="text-xs text-[#8A6D36] font-semibold hover:underline inline-flex items-center gap-0.5"
              >
                Gerenciar <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#6B6B6B]">Meta do dia</span>
                <span className="font-semibold text-[#171717] tabular-nums">
                  {formatBRL(insights.goals?.todayAchieved || 0)} /{' '}
                  {formatBRL(insights.goals?.todayTarget || 0)}
                </span>
              </div>
              <Progress
                value={Math.min(insights.goals?.progressPct || 0, 100)}
                className="h-2 bg-[#F2EFE9]"
              />
              <p className="text-[11px] text-[#4A4A4A] tabular-nums">
                {insights.goals?.progressPct || 0}% atingido
              </p>
            </div>

            <div className="space-y-1.5 border-t border-[#E5E2DC] pt-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#6B6B6B]">Meta do mês</span>
                <span className="font-semibold text-[#171717] tabular-nums">
                  {formatBRL(insights.goals?.monthlyAchieved || 0)} /{' '}
                  {formatBRL(insights.goals?.monthlyTarget || 0)}
                </span>
              </div>
              <Progress
                value={Math.min(insights.goals?.monthlyProgressPct || 0, 100)}
                className="h-2 bg-[#F2EFE9]"
              />
              <p className="text-[11px] text-[#4A4A4A] tabular-nums">
                {insights.goals?.monthlyProgressPct || 0}% acumulado no mês
              </p>
            </div>
          </div>

          <p className="text-[11px] text-[#6B6B6B] border-t border-[#E5E2DC] pt-2.5">
            {insights.goalsDiagnosis?.paceDescription ||
              'Acompanhe o andamento das metas em tempo real.'}
          </p>
        </div>

        {/* Pillar 2: Pendencies */}
        <div className="rounded-lg border border-[#E5E2DC] bg-white p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-[#8A6D36]" />
                Pendências do Dia
              </span>
              <span className="text-xs text-[#6B6B6B] tabular-nums">
                {insights.pendencies?.length || 0} item(ns)
              </span>
            </div>

            {!insights.pendencies || insights.pendencies.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 mx-auto" />
                <p className="text-xs font-semibold text-[#171717]">Tudo em dia</p>
                <p className="text-[11px] text-[#6B6B6B]">
                  Nenhuma pendência crítica aberta hoje.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {insights.pendencies.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#171717] truncate">{item.title}</p>
                      <span
                        className={cn(
                          'text-[11px] font-semibold shrink-0',
                          item.priority === 'high' ? 'text-red-700' : 'text-amber-700'
                        )}
                      >
                        {item.priority === 'high' ? 'Alta' : 'Média'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4A4A4A] line-clamp-2">{item.description}</p>
                    {item.actionUrl && (
                      <button
                        type="button"
                        onClick={() => navigate(item.actionUrl)}
                        className="text-[11px] font-semibold text-[#8A6D36] hover:underline inline-flex items-center gap-1 pt-0.5"
                      >
                        {item.actionLabel || 'Resolver'}
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/checklist')}
            className="text-xs font-semibold text-[#8A6D36] hover:underline text-left pt-2 border-t border-[#E5E2DC]"
          >
            Abrir checklists operacionais
          </button>
        </div>

        {/* Pillar 3: Financial Alerts */}
        <div className="rounded-lg border border-[#E5E2DC] bg-white p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#8A6D36]" />
                Alertas Financeiros
              </span>
              <button
                type="button"
                onClick={() => navigate('/dashboard/financeiro')}
                className="text-xs text-[#8A6D36] font-semibold hover:underline inline-flex items-center gap-0.5"
              >
                Extrato <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!insights.financialAlerts || insights.financialAlerts.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <Sparkles className="w-5 h-5 text-[#8A6D36] mx-auto" />
                <p className="text-xs font-semibold text-[#171717]">Fluxo equilibrado</p>
                <p className="text-[11px] text-[#6B6B6B]">
                  Nenhuma anomalia financeira registrada hoje.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {insights.financialAlerts.slice(0, 2).map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#171717]">{alert.title}</span>
                      {alert.highlight && (
                        <span
                          className={cn(
                            'text-xs font-bold tabular-nums shrink-0',
                            alert.type === 'positive'
                              ? 'text-emerald-700'
                              : alert.type === 'warning' || alert.type === 'danger'
                                ? 'text-red-700'
                                : 'text-[#8A6D36]'
                          )}
                        >
                          {alert.highlight}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#4A4A4A]">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard/financeiro')}
            className="text-xs font-semibold text-[#8A6D36] hover:underline text-left pt-2 border-t border-[#E5E2DC]"
          >
            Ver fluxo de caixa completo
          </button>
        </div>
      </div>

      <LumiConsultingModal
        isOpen={isConsultingModalOpen}
        onClose={() => setIsConsultingModalOpen(false)}
        salonName={salonName}
        userName={userName}
        metrics={{
          todayRevenue: insights.goals?.todayAchieved || 0,
          monthRevenue: insights.goals?.monthlyAchieved || 0,
          dailyGoal: insights.goals?.todayTarget || 0,
          monthlyGoal: insights.goals?.monthlyTarget || 0,
          scheduledCount: clientMetrics?.scheduledAppointments || 0,
          pendingCount: clientMetrics?.pendingAppointments || 0,
        }}
      />
    </div>
  );
}

export default LumiereIAInsights;

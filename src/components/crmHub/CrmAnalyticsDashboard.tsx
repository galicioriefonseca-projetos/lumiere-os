import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CrmAttendant, CrmConversation, CrmOpportunity } from '@/types';
import { computeFunnelAnalytics, FUNNEL_STAGE_META } from '@/services/crmService';

interface CrmAnalyticsDashboardProps {
  opportunities: CrmOpportunity[];
  conversations: CrmConversation[];
  attendants: CrmAttendant[];
  onJumpToConversation: (conversationId: string) => void;
}

type AnalyticsSubTab = 'summary' | 'funnel' | 'attendants';

function formatMoney(v: number): string {
  return Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CrmAnalyticsDashboard({
  opportunities,
  conversations,
  attendants,
  onJumpToConversation,
}: CrmAnalyticsDashboardProps) {
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('summary');
  const [periodDays, setPeriodDays] = useState<number>(30);

  const stats = useMemo(
    () => computeFunnelAnalytics(opportunities, conversations, attendants, periodDays),
    [opportunities, conversations, attendants, periodDays]
  );

  const stageTotal = Math.max(
    1,
    stats.awaitingCount +
      stats.inServiceCount +
      stats.interestedCount +
      stats.scheduledCount +
      stats.lostCount +
      stats.otherCount
  );

  const humanHandledPct = Math.max(0, 100 - stats.aiHandledPct);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg border border-border overflow-x-auto flex-nowrap max-w-full scrollbar-none">
          {(
            [
              { id: 'summary', label: 'Resumo Executivo' },
              { id: 'funnel', label: 'Análise do Funil' },
              { id: 'attendants', label: 'Por Atendente' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                subTab === t.id
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Período de análise"
          value={periodDays}
          onChange={(e) => setPeriodDays(Number(e.target.value))}
          className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={0}>Todo o histórico</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Atendimentos', value: String(stats.totalConversations), sub: 'Conversas no período' },
          {
            label: 'SLA 1ª Resposta',
            value: stats.avgFirstResponseMin > 0 ? `${stats.avgFirstResponseMin} min` : '—',
            sub: 'Tempo médio real',
          },
          {
            label: 'Agendados',
            value: String(stats.scheduledCount),
            sub: `Taxa ${stats.conversionRatePct}%`,
          },
          {
            label: 'Receita Gerada',
            value: `R$ ${formatMoney(stats.scheduledRevenue)}`,
            sub: 'Oportunidades agendadas',
          },
          {
            label: 'Pipeline Aberto',
            value: `R$ ${formatMoney(stats.pipelinePotentialValue)}`,
            sub: 'Em negociação ativa',
          },
          {
            label: 'Perdidos',
            value: `R$ ${formatMoney(stats.lostRevenue)}`,
            sub: `${stats.lostCount} cards perdidos`,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">{kpi.label}</span>
            <p className="text-lg font-semibold text-foreground tabular-nums tracking-tight">
              {kpi.value}
            </p>
            <span className="text-[11px] text-muted-foreground block">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {subTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-card border border-border rounded-xl p-5 space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Atendimento Lumi IA × Equipe Humana
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Proporção das conversas conduzidas por IA vs assumidas pelos atendentes.
              </p>
              <div className="mt-3 h-3 rounded-full bg-secondary overflow-hidden flex border border-border">
                <div
                  className="bg-[#B89B5E] h-full transition-all"
                  style={{ width: `${stats.aiHandledPct}%` }}
                />
                <div
                  className="bg-[#171717] h-full transition-all"
                  style={{ width: `${humanHandledPct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs tabular-nums">
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <Bot className="w-3.5 h-3.5 text-[#9F844A]" /> Lumi IA: {stats.aiHandledPct}%
                </span>
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <Users className="w-3.5 h-3.5 text-foreground" /> Equipe: {humanHandledPct}%
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Desempenho por Origem
              </h4>
              <div className="divide-y divide-border">
                {stats.byOrigin.map((row) => {
                  const rate = row.total > 0 ? Math.round((row.scheduled / row.total) * 100) : 0;
                  return (
                    <div
                      key={row.origin}
                      className="py-2.5 flex items-center justify-between text-xs gap-2"
                    >
                      <span className="font-medium text-foreground">{row.label}</span>
                      <div className="flex items-center gap-4 tabular-nums text-muted-foreground">
                        <span>{row.total} cards</span>
                        <span>
                          {row.scheduled} agend. ({rate}%)
                        </span>
                        <span className="font-semibold text-foreground min-w-[96px] text-right">
                          R$ {formatMoney(row.revenue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-card border border-border rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Esperando resposta agora
                </h4>
                <p className="text-xs text-muted-foreground">
                  Clientes aguardando retorno imediato ordenados pelo maior tempo de espera.
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-700 tabular-nums">
                {stats.waitingNow.length}
              </span>
            </div>

            <div className="flex-1 divide-y divide-border mt-2">
              {stats.waitingNow.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Nenhum cliente aguardando resposta no momento. Excelente SLA!
                </div>
              ) : (
                stats.waitingNow.map(({ conversation, opportunity, waitMinutes }) => (
                  <div
                    key={conversation.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {conversation.clientName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {opportunity?.serviceInterest || conversation.lastMessageText || 'Mensagem recebida'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium text-amber-700 tabular-nums flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {waitMinutes} min
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onJumpToConversation(conversation.id)}
                        className="h-7 px-2.5 text-[11px] border-border gap-1"
                      >
                        Responder <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'funnel' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Distribuição por Etapa do Funil</h4>
              <p className="text-xs text-muted-foreground">
                Volume e participação percentual de cada etapa no período selecionado.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { key: 'awaiting_reply' as const, count: stats.awaitingCount },
                { key: 'in_service' as const, count: stats.inServiceCount },
                { key: 'interested' as const, count: stats.interestedCount },
                { key: 'scheduled' as const, count: stats.scheduledCount },
                { key: 'lost' as const, count: stats.lostCount },
                { key: 'other' as const, count: stats.otherCount },
              ].map((item) => {
                const meta = FUNNEL_STAGE_META[item.key];
                const pct = Math.round((item.count / stageTotal) * 100);
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{meta.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden border border-border">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: meta.dotColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h4 className="text-sm font-semibold text-foreground">Onde você mais perde</h4>
            </div>
            <div className="p-3.5 rounded-xl bg-secondary/70 border border-border space-y-1.5">
              <span className="text-[11px] text-muted-foreground block">Maior gargalo detectado</span>
              <p className="text-sm font-semibold text-foreground">{stats.biggestDropoffStage}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Impacto estimado: {stats.biggestDropoffRatePct}% · Receita perdida: R${' '}
                {formatMoney(stats.lostRevenue)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dica prática: utilize a sugestão de retomada da Lumi IA nos cards em &ldquo;Aguardando resposta&rdquo; há mais de 24h ou ative a campanha de Retorno no menu Campanhas.
            </p>
          </div>
        </div>
      )}

      {subTab === 'attendants' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h4 className="text-sm font-semibold text-foreground">Produtividade por Atendente</h4>
            <p className="text-xs text-muted-foreground">
              SLA de primeira resposta, conversas conduzidas, agendamentos fechados e receita gerada.
            </p>
          </div>
          {stats.attendantStats.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhum atendente vinculado ao CRM ainda. Adicione profissionais na aba Equipe &amp; IA.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Atendente</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Conversas</th>
                    <th className="py-2.5 px-4 font-medium text-right">SLA 1ª Resp.</th>
                    <th className="py-2.5 px-4 font-medium text-right">Agendados</th>
                    <th className="py-2.5 px-4 font-medium text-right">Receita Gerada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.attendantStats.map((att) => (
                    <tr key={att.id} className="hover:bg-secondary/30">
                      <td className="py-3 px-4 font-medium text-foreground">{att.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-medium ${
                            att.isOnline ? 'text-emerald-700' : 'text-muted-foreground'
                          }`}
                        >
                          {att.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{att.conversations}</td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {att.avgFirstResponseMin > 0 ? `${att.avgFirstResponseMin} min` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{att.scheduled}</td>
                      <td className="py-3 px-4 text-right font-semibold text-foreground tabular-nums">
                        R$ {formatMoney(att.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

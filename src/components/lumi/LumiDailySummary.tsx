import React from 'react';
import { Activity, BarChart3, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { BusinessMetric } from '../../lumi/types';
import { formatBRL } from '../../lumi/utils/formatters';

interface LumiDailySummaryProps {
  metrics: BusinessMetric | null;
  comparison?: {
    revenueDeltaPct: number | null;
    ticketDeltaPct: number | null;
    periodLabel?: string;
  };
}

function DeltaLabel({ delta }: { delta: number | null | undefined }) {
  if (delta === undefined || delta === null) {
    return <span className="text-[11px] text-[#6B6B6B] tabular-nums">Sem base anterior</span>;
  }
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
        positive ? 'text-emerald-700' : 'text-red-700'
      }`}
    >
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? `+${delta}%` : `${delta}%`} vs anterior
    </span>
  );
}

export function LumiDailySummary({ metrics, comparison }: LumiDailySummaryProps) {
  if (!metrics) return null;

  const stats = [
    {
      label: 'Volume de Caixa (Mês)',
      value: formatBRL(metrics.totalRevenue),
      delta: comparison?.revenueDeltaPct,
      sub: comparison?.periodLabel || 'Receita consolidada',
      icon: TrendingUp,
    },
    {
      label: 'Ticket Médio',
      value: formatBRL(metrics.averageTicket),
      delta: comparison?.ticketDeltaPct,
      sub: 'Por atendimento concluído',
      icon: Activity,
    },
    {
      label: 'Retenção da Base',
      value: `${Math.round(metrics.clientRetentionRate)}%`,
      delta: undefined,
      sub: `${metrics.activeClientsCount} clientes ativos no CRM`,
      icon: Users,
    },
  ];

  return (
    <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E2DC] pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#8A6D36]" />
          <h3 className="text-sm font-semibold text-[#171717]">Radar Financeiro</h3>
        </div>
        <span className="text-xs text-[#6B6B6B]">Indicadores consolidados do mês</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-4 flex items-start justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-[#6B6B6B]">{stat.label}</p>
                <p className="text-xl font-bold text-[#171717] tabular-nums">{stat.value}</p>
                {stat.delta !== undefined ? (
                  <DeltaLabel delta={stat.delta} />
                ) : (
                  <p className="text-[11px] text-[#6B6B6B] tabular-nums">{stat.sub}</p>
                )}
              </div>
              <Icon className="w-4 h-4 text-[#8A6D36] shrink-0 mt-0.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

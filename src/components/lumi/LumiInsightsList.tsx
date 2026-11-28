import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { Insight } from '../../lumi/types';
import { cn } from '@/lib/utils';

interface LumiInsightsListProps {
  insights: Insight[];
}

function getCategoryLabel(metricRef?: string): string {
  if (!metricRef) return 'Operação';
  const ref = metricRef.toLowerCase();
  if (ref.includes('cancel') || ref.includes('occupancy')) return 'Agenda';
  if (ref.includes('stock')) return 'Estoque';
  if (ref.includes('retention')) return 'Clientes';
  if (ref.includes('revenue')) return 'Financeiro';
  return 'Operação';
}

function getPriorityInfo(type: Insight['type']) {
  switch (type) {
    case 'negative':
      return {
        label: 'Atenção Alta',
        tone: 'text-red-700',
        icon: <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />,
      };
    case 'positive':
      return {
        label: 'Bom Desempenho',
        tone: 'text-emerald-700',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />,
      };
    case 'neutral':
    default:
      return {
        label: 'Acompanhamento',
        tone: 'text-[#8A6D36]',
        icon: <Info className="w-4 h-4 text-[#8A6D36] shrink-0" />,
      };
  }
}

export function LumiInsightsList({ insights }: LumiInsightsListProps) {
  const visibleInsights = insights.slice(0, 5);
  const isInsufficient =
    visibleInsights.length === 0 ||
    (visibleInsights.length === 1 && visibleInsights[0].id === 'insight_insufficient_data');

  return (
    <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E2DC] pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#8A6D36]" />
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">Insights Analíticos</h3>
            <p className="text-xs text-[#6B6B6B]">
              Leitura automática de faturamento, agenda e retenção
            </p>
          </div>
        </div>
        {!isInsufficient && (
          <span className="text-xs font-medium text-[#6B6B6B] tabular-nums">
            {visibleInsights.length} registro(s)
          </span>
        )}
      </div>

      {isInsufficient ? (
        <div className="py-8 text-center space-y-1.5 text-xs text-[#6B6B6B]">
          <p className="font-semibold text-[#171717]">
            Ainda não há dados suficientes para esta análise.
          </p>
          <p>
            Cadastre atendimentos, clientes ou metas para liberar os diagnósticos automáticos.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E5E2DC]">
          {visibleInsights.map((insight, idx) => {
            const priority = getPriorityInfo(insight.type);
            const categoryLabel = getCategoryLabel(insight.metricRef);

            return (
              <div
                key={insight.id || idx}
                className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] font-medium text-[#6B6B6B]">
                    <span>{categoryLabel}</span>
                    <span aria-hidden="true"> · </span>
                    <span className={cn('font-semibold', priority.tone)}>{priority.label}</span>
                  </p>
                  <h4 className="text-sm font-semibold text-[#171717] leading-snug">
                    {insight.title}
                  </h4>
                  <p className="text-xs text-[#4A4A4A] leading-relaxed">{insight.description}</p>
                </div>

                <div className="mt-1 p-2 rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] shrink-0">
                  {priority.icon}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Insight } from '../../lumi/types';
import { InsightBadge, InsightCategory } from './InsightBadge';
import { 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface LumiInsightsListProps {
  insights: Insight[];
}

export function LumiInsightsList({ insights }: LumiInsightsListProps) {
  const visibleInsights = insights.slice(0, 5);

  const getPriorityInfo = (type: 'positive' | 'negative' | 'neutral') => {
    switch (type) {
      case 'negative':
        return {
          label: 'Alta Urgência',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />
        };
      case 'positive':
        return {
          label: 'Desempenho Excelente',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: <CheckCircle className="w-4 h-4 text-emerald-400" />
        };
      case 'neutral':
      default:
        return {
          label: 'Média Urgência',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Info className="w-4 h-4 text-amber-400" />
        };
    }
  };

  const getCategoryFromRef = (metricRef?: string): InsightCategory => {
    if (!metricRef) return 'operacao';
    const ref = metricRef.toLowerCase();
    if (ref.includes('cancel')) return 'agenda';
    if (ref.includes('occupancy')) return 'agenda';
    if (ref.includes('stock')) return 'estoque';
    if (ref.includes('service')) return 'operacao';
    if (ref.includes('retention')) return 'clientes';
    if (ref.includes('revenue')) return 'financeiro';
    return 'operacao';
  };

  return (
    <Card className="border-white/5 bg-[#0c0c0f]/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
      <CardHeader className="border-b border-white/5 p-5 pb-4 bg-white/[0.01]">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-[#D4AF37]" />
          <div>
            <CardTitle className="text-sm font-semibold text-white font-heading">
              Insights Analíticos da Lumi
            </CardTitle>
            <p className="text-[10px] text-zinc-500 font-light mt-0.5">
              Análise profunda de faturamento, comportamento e funil de clientes
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {visibleInsights.length === 0 || (visibleInsights.length === 1 && visibleInsights[0].id === 'insight_insufficient_data') ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-sans space-y-2 leading-relaxed">
            <p className="font-semibold text-zinc-300">Ainda não há dados suficientes para gerar este indicador.</p>
            <p className="text-[11px] text-zinc-400">A Lumi começará a gerar insights após coletar dados reais da operação.</p>
            <p className="text-[11px] text-[#D4AF37]/80">Cadastre clientes, agendamentos, metas ou vendas para ativar esta análise.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {visibleInsights.map((insight, idx) => {
              const priority = getPriorityInfo(insight.type);
              const category = getCategoryFromRef(insight.metricRef);

              return (
                <motion.div
                  key={insight.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <InsightBadge category={category} />
                      <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border font-mono uppercase tracking-wider", priority.color)}>
                        {priority.label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white leading-snug">
                        {insight.title}
                      </h4>
                      <p className="text-xs text-zinc-400 font-light leading-relaxed">
                        {insight.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-center p-2.5 rounded-xl bg-white/[0.02] border border-white/5 self-start">
                    {priority.icon}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

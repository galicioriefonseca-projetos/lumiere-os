import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BusinessMetric } from '../../lumi/types';
import { formatBRL } from '../../lumi/utils/formatters';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface LumiDailySummaryProps {
  metrics: BusinessMetric | null;
}

export function LumiDailySummary({ metrics }: LumiDailySummaryProps) {
  if (!metrics) return null;

  // Derive mock growth numbers relative to prior periods based on context, 
  // or statically indicate for demo purposes.
  const stats = [
    {
      label: 'Volume de Caixa',
      value: formatBRL(metrics.totalRevenue),
      trend: '+12%',
      isPositive: true,
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />
    },
    {
      label: 'Ticket Médio (Macro)',
      value: formatBRL(metrics.averageTicket),
      trend: '+5%',
      isPositive: true,
      icon: <Activity className="w-4 h-4 text-[#D4AF37]" />
    },
    {
      label: 'Fidelização / Retorno',
      value: `${Math.round(metrics.clientRetentionRate)}%`,
      trend: '-2%',
      isPositive: false,
      icon: <Users className="w-4 h-4 text-rose-400" />
    }
  ];

  return (
    <Card className="border-white/5 bg-[#0c0c0f]/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
      <CardHeader className="border-b border-white/5 p-5 pb-4 bg-white/[0.01]">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
          <div>
            <CardTitle className="text-sm font-semibold text-white font-heading">
              Radar Financeiro Diário
            </CardTitle>
            <p className="text-[10px] text-zinc-500 font-light mt-0.5">
              Snapshot de resultados essenciais
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-zinc-500">
                  {stat.label}
                </span>
                <div className="text-xl font-light text-white tracking-tight">
                  {stat.value}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                  {stat.icon}
                </div>
                <span className={cn(
                  "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                  stat.isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                )}>
                  {stat.trend}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

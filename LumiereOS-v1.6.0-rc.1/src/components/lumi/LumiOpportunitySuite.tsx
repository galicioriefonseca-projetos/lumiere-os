import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BusinessMetric, BusinessContext } from '../../lumi/types';
import { 
  Users, 
  Clock, 
  Target, 
  AlertTriangle, 
  ArrowUpRight,
  TrendingUp,
  LineChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { formatBRL } from '../../lumi/utils/formatters';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface LumiOpportunitySuiteProps {
  metrics: BusinessMetric | null;
  context: BusinessContext | null;
}

export function LumiOpportunitySuite({ metrics, context }: LumiOpportunitySuiteProps) {
  const navigate = useNavigate();

  if (!metrics || !context) {
    return null;
  }

  // 1. Clientes sem Retorno
  const retentionRate = Math.round(metrics.clientRetentionRate);
  const showRetentionOpp = metrics.clientRetentionRate < 50;

  // 2. Horários Ociosos
  // Detect if Tuesday mornings has low occupancy as evaluated in the services
  const appointmentsOnTue = context.appointments.filter((a) => {
    if (!a.date || !a.time) return false;
    const dayOfWeek = new Date(a.date + 'T00:00:00').getDay();
    return dayOfWeek === 2;
  });
  const tueMorningAppts = appointmentsOnTue.filter((a) => {
    const hour = parseInt(a.time.split(':')[0]) || 0;
    return hour >= 8 && hour < 12;
  });
  const showIdleOpp = context.appointments.length > 5 && appointmentsOnTue.length > 0 && tueMorningAppts.length <= 1;

  // 3. Meta Próxima
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const monthlyGoals = context.goals.filter(g => g.month === currentMonthStr);
  const target = monthlyGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
  const achievementRate = target > 0 ? Math.round((metrics.totalRevenue / target) * 100) : 0;
  const showGoalOpp = target > 0 && achievementRate >= 40 && achievementRate < 100;

  // 4. Estoque Crítico
  const lowStockCount = metrics.lowStockItemsCount;
  const showStockOpp = lowStockCount > 0;

  const opportunities = [
    {
      id: 'opp_retention',
      title: 'Resgatar Clientes Inativos',
      subtitle: `${100 - retentionRate}% sem retorno recorrente`,
      description: 'Lumi identificou uma queda no retorno de novos clientes. Envie um lembrete automático com benefício exclusivo.',
      icon: <Users className="w-5 h-5 text-cyan-400" />,
      actionText: 'Resgatar via CRM',
      actionUrl: '/clientes',
      badge: 'Retenção Ativa',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
    },
    {
      id: 'opp_idle',
      title: 'Preencher Manhãs de Terça',
      subtitle: 'Janela ociosa recorrente',
      description: 'Horários ociosos identificados nas terças pela manhã. Proponha desconto progressivo ou bônus de indicação.',
      icon: <Clock className="w-5 h-5 text-amber-400" />,
      actionText: 'Criar Promoção',
      actionUrl: '/servicos',
      badge: 'Aumento de Ocupação',
      badgeColor: 'bg-amber-500/10 text-[#D4AF37] border-[#D4AF37]/20'
    },
    {
      id: 'opp_goal',
      title: 'Aceleração de Meta',
      subtitle: `${achievementRate}% concluído`,
      description: `Faltam apenas ${formatBRL(target - metrics.totalRevenue)} para atingir a meta mensal. Estimule as vendas de combos profissionais hoje.`,
      icon: <Target className="w-5 h-5 text-emerald-400" />,
      actionText: 'Visualizar Metas',
      actionUrl: '/metas',
      badge: 'Alvo Próximo',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    },
    {
      id: 'opp_stock',
      title: 'Repor Produtos Críticos',
      subtitle: `${lowStockCount} itens sob risco de falta`,
      description: 'Evite a paralisação de procedimentos de alta lucratividade fazendo reposições urgentes no estoque de segurança.',
      icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
      actionText: 'Consultar Almoxarifado',
      actionUrl: '/estoque',
      badge: 'Segurança de Estoque',
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LineChart className="w-4 h-4 text-[#D4AF37]" />
        <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground font-mono">Oportunidades de Negócios Identificadas</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {opportunities.map((opp, idx) => (
          <motion.div
            key={opp.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="group relative overflow-hidden bg-[#0c0c0f]/90 border border-white/5 hover:border-[#D4AF37]/20 rounded-2xl p-5 flex flex-col justify-between h-full transition-all duration-300 shadow-md hover:shadow-xl"
          >
            {/* Glowing Backdrop */}
            <div className="absolute top-0 right-0 -translate-y-8 translate-x-8 w-24 h-24 bg-white/[0.01] group-hover:bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none transition-all duration-500" />
            
            <div className="space-y-3">
              <div className="flex justify-between items-start gap-2">
                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider font-mono", opp.badgeColor)}>
                  {opp.badge}
                </span>
                <div className="p-1.5 bg-white/[0.02] border border-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                  {opp.icon}
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 font-mono">
                  {opp.subtitle}
                </h4>
                <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-[#D4AF37] transition-colors">
                  {opp.title}
                </h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  {opp.description}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-white/[0.03]">
              <Button
                variant="ghost"
                onClick={() => navigate(`/dashboard${opp.actionUrl}`)}
                className="w-full justify-between text-xs text-zinc-300 hover:text-white group-hover:text-[#D4AF37] hover:bg-white/[0.02] p-2 rounded-xl"
              >
                <span>{opp.actionText}</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

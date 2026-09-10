import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HealthScore } from '../../lumi/types';
import { getHealthScoreColor } from '../../lumi/utils/formatters';
import { 
  Heart, 
  Calendar, 
  DollarSign, 
  Users, 
  ListTodo, 
  Activity,
  Award,
  Zap,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface BusinessPulseProps {
  healthScore: HealthScore | null;
}

export function BusinessPulse({ healthScore }: BusinessPulseProps) {
  if (!healthScore) {
    return (
      <Card className="border-white/5 bg-[#0c0c0f]/80 rounded-2xl shadow-xl p-6 text-center text-zinc-500 font-mono text-xs">
        Analisando pilares corporativos...
      </Card>
    );
  }

  const pillars = [
    {
      key: 'agenda',
      label: 'Agenda',
      score: healthScore.areas.agenda,
      description: healthScore.breakdown.agenda,
      icon: <Calendar className="w-4 h-4 text-amber-400" />
    },
    {
      key: 'financeiro',
      label: 'Financeiro',
      score: healthScore.areas.financeiro,
      description: healthScore.breakdown.financeiro,
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />
    },
    {
      key: 'equipe',
      label: 'Equipe',
      score: healthScore.areas.equipe,
      description: healthScore.breakdown.equipe,
      icon: <Zap className="w-4 h-4 text-violet-400" />
    },
    {
      key: 'clientes',
      label: 'Clientes',
      score: healthScore.areas.clientes,
      description: healthScore.breakdown.clientes,
      icon: <Users className="w-4 h-4 text-cyan-400" />
    },
    {
      key: 'operacao',
      label: 'Operação',
      score: healthScore.areas.operacao,
      description: healthScore.breakdown.operacao,
      icon: <ListTodo className="w-4 h-4 text-indigo-400" />
    }
  ];

  return (
    <Card className="border-white/5 bg-[#0c0c0f]/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
      <CardHeader className="border-b border-white/5 p-5 pb-4 bg-white/[0.01]">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <div>
            <CardTitle className="text-sm font-semibold text-white font-heading">
              Business Pulse (Resumo Executivo)
            </CardTitle>
            <p className="text-[10px] text-zinc-500 font-light mt-0.5">
              Análise ponderada dos 5 pilares vitais para a sustentabilidade do negócio
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {pillars.map((pillar, idx) => {
            const colors = getHealthScoreColor(pillar.score);
            const ringCircumference = 2 * Math.PI * 25; // 157.08

            return (
              <motion.div
                key={pillar.key}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-2xl border border-white/5 bg-gradient-to-b from-[#0c0c0f] to-[#070709] flex flex-col items-center text-center space-y-3.5 hover:border-white/15 transition-all duration-300 shadow-md group relative overflow-hidden"
              >
                {/* Background Accent glow */}
                <div className={cn("absolute top-0 inset-x-0 h-0.5 opacity-40 transition-all", colors.bg)} />

                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 bg-white/[0.02] border border-white/5 rounded-lg">
                    {pillar.icon}
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">
                    {pillar.label}
                  </span>
                </div>

                {/* Elegant Circular Gauge */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 60 60">
                    <circle
                      cx="30"
                      cy="30"
                      r="25"
                      stroke="rgba(255, 255, 255, 0.02)"
                      strokeWidth="4"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="30"
                      cy="30"
                      r="25"
                      className={cn("transition-all duration-1000 ease-out", colors.fill)}
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={ringCircumference}
                      initial={{ strokeDashoffset: ringCircumference }}
                      animate={{ strokeDashoffset: ringCircumference - (ringCircumference * pillar.score) / 100 }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-sm font-semibold text-white leading-none">
                      {pillar.score}%
                    </span>
                  </div>
                </div>

                {/* Pillar Status Description */}
                <p className="text-[10px] text-zinc-400 font-light leading-snug line-clamp-3">
                  {pillar.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Zap, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface DailyPriorityCardProps {
  priority: string;
  impact: string;
  action: string;
  url: string;
}

export function DailyPriorityCard({ priority, impact, action, url }: DailyPriorityCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-[#D4AF37]/20 bg-[#D4AF37]/5 rounded-2xl shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#D4AF37]/15 transition-all" />
      
      <CardContent className="p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/20 shrink-0">
            <Target className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] font-mono">
                Prioridade do Dia
              </h3>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Impacto Esperado: {impact}
              </span>
            </div>
            <p className="text-sm md:text-base font-medium text-white leading-snug">
              {priority}
            </p>
          </div>
        </div>

        <Button 
          onClick={() => navigate(url)}
          className="shrink-0 rounded-xl bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs px-5 h-10 w-full md:w-auto flex items-center gap-2 shadow-[0_4px_15px_rgba(212,175,55,0.15)] transition-all"
        >
          {action}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

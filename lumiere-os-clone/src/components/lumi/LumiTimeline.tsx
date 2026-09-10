import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Clock, Star, Target, Zap, AlertTriangle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

export interface TimelineEvent {
  id: string;
  type: 'welcome' | 'event' | 'alert' | 'achievement' | 'goal' | 'insight';
  title: string;
  description: string;
  time: string;
}

interface LumiTimelineProps {
  events: TimelineEvent[];
}

export function LumiTimeline({ events }: LumiTimelineProps) {
  const getIconAndColors = (type: string) => {
    switch (type) {
      case 'welcome':
        return { icon: <MessageSquare className="w-4 h-4 text-white" />, bg: "bg-blue-500", border: "border-blue-500/30" };
      case 'event':
        return { icon: <Clock className="w-4 h-4 text-white" />, bg: "bg-zinc-500", border: "border-zinc-500/30" };
      case 'alert':
        return { icon: <AlertTriangle className="w-4 h-4 text-white" />, bg: "bg-rose-500", border: "border-rose-500/30" };
      case 'achievement':
        return { icon: <Star className="w-4 h-4 text-white" />, bg: "bg-amber-500", border: "border-amber-500/30" };
      case 'goal':
        return { icon: <Target className="w-4 h-4 text-white" />, bg: "bg-emerald-500", border: "border-emerald-500/30" };
      case 'insight':
        return { icon: <Zap className="w-4 h-4 text-black" />, bg: "bg-[#D4AF37]", border: "border-[#D4AF37]/30" };
      default:
        return { icon: <Clock className="w-4 h-4 text-white" />, bg: "bg-zinc-500", border: "border-zinc-500/30" };
    }
  };

  return (
    <Card className="border-white/5 bg-[#0c0c0f]/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
      <CardHeader className="border-b border-white/5 p-5 pb-4 bg-white/[0.01]">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-[#D4AF37]" />
          <div>
            <CardTitle className="text-sm font-semibold text-white font-heading">
              Linha do Tempo Estratégica
            </CardTitle>
            <p className="text-[10px] text-zinc-500 font-light mt-0.5">
              Eventos recentes e percepções da Lumi
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
          {events.length === 0 || (events.length === 1 && events[0].id === 'welcome') ? (
            <div className="text-center text-zinc-500 text-xs font-sans py-8 space-y-2 leading-relaxed">
              <p className="font-semibold text-zinc-300">Ainda não há dados suficientes para gerar este indicador.</p>
              <p className="text-[11px] text-zinc-400">A Lumi começará a gerar insights após coletar dados reais da operação.</p>
            </div>
          ) : (
            events.map((event, idx) => {
              const { icon, bg, border } = getIconAndColors(event.type);
              
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                >
                  {/* Icon */}
                  <div className={cn("flex items-center justify-center w-11 h-11 rounded-full border-4 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-lg z-10", bg, border, "border-[#0c0c0f]")}>
                    {icon}
                  </div>
                  
                  {/* Content */}
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-colors shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 font-mono">
                        {event.type}
                      </span>
                      <time className="text-[10px] font-mono text-zinc-400">
                        {event.time}
                      </time>
                    </div>
                    <h4 className="text-xs font-bold text-white mb-1 leading-snug">
                      {event.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

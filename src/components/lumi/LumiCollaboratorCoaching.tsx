import React, { useState } from 'react';
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Lightbulb, 
  Award,
  ChevronRight,
  Zap,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LumiMascotAvatar } from './LumiMascotAvatar';
import { LumiConsultingModal } from './LumiConsultingModal';
import { formatBRL, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface LumiCollaboratorCoachingProps {
  professionalName?: string;
  salonName?: string;
  todayGoal?: number;
  todayAchieved?: number;
  monthlyGoal?: number;
  monthlyAchieved?: number;
  commissionRate?: number;
  scheduledTodayCount?: number;
  completedTodayCount?: number;
  className?: string;
}

export function LumiCollaboratorCoaching({
  professionalName = 'Especialista',
  salonName = 'Lumière',
  todayGoal = 400,
  todayAchieved = 0,
  monthlyGoal = 8000,
  monthlyAchieved = 0,
  commissionRate = 50,
  scheduledTodayCount = 0,
  completedTodayCount = 0,
  className = '',
}: LumiCollaboratorCoachingProps) {
  const navigate = useNavigate();
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState(false);

  const firstName = professionalName.split(' ')[0];
  const todayProgressPct = todayGoal > 0 ? Math.min(Math.round((todayAchieved / todayGoal) * 100), 200) : 0;
  const monthlyProgressPct = monthlyGoal > 0 ? Math.min(Math.round((monthlyAchieved / monthlyGoal) * 100), 200) : 0;
  const estimatedCommissionToday = (todayAchieved * commissionRate) / 100;
  const estimatedCommissionMonth = (monthlyAchieved * commissionRate) / 100;

  const mascotMood = todayProgressPct >= 100 ? 'celebrating' : todayProgressPct >= 50 ? 'happy' : 'strategic';

  // Dicas dinâmicas da Lumi para o profissional
  const getCollaboratorTip = () => {
    if (todayProgressPct >= 100) {
      return `Sensacional, ${firstName}! Você já superou sua cota de hoje! Que tal convidar seu último cliente a levar um kit de manutenção home care para turbinar ainda mais seus ganhos?`;
    }
    if (scheduledTodayCount > 0) {
      const remaining = Math.max(0, todayGoal - todayAchieved);
      return `Você tem ${scheduledTodayCount} atendimento(s) na sua agenda hoje. Oferecendo um tratamento express (R$ 40 a R$ 60) em cada cadeira, você bate sua meta de ${formatBRL(todayGoal)} e garante ${formatBRL((todayGoal * commissionRate) / 100)} de comissão!`;
    }
    return `Mantenha sua bancada impecável e aproveite o momento do atendimento para garantir o retorno do seu cliente já agendado para daqui a 3 ou 4 semanas.`;
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#16141c] via-[#0e0d12] to-[#070609] border border-[#D4AF37]/30 p-5 md:p-7 shadow-[0_12px_35px_rgba(0,0,0,0.5)] space-y-6",
      className
    )}>
      {/* Luz dourada de fundo */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header com a Gestora Virtual Lumi & Saudação */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <LumiMascotAvatar size="lg" mood={mascotMood} />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/35 text-[#D4AF37] font-mono flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                LUMI · SUA GESTORA VIRTUAL DE SUCESSO
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {salonName}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white font-heading tracking-tight">
              Olá, {firstName}! Vamos acelerar seus resultados?
            </h3>
            <p className="text-xs text-zinc-300 font-light">
              Acompanhe suas metas de produção, comissões em tempo real e dicas para faturar mais.
            </p>
          </div>
        </div>

        {/* Botão de Consultoria */}
        <Button
          size="sm"
          onClick={() => setIsConsultingModalOpen(true)}
          className="bg-gradient-to-r from-[#D4AF37] to-amber-500 hover:from-amber-500 hover:to-[#D4AF37] text-black font-semibold text-xs h-9 px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Falar com a Lumi</span>
        </Button>
      </div>

      {/* Dica de Ouro da Mentora */}
      <div className="relative z-10 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
        <div className="text-xs text-zinc-200 leading-relaxed font-light">
          <strong className="text-amber-300 font-medium">Conselho da Lumi para hoje: </strong>
          {getCollaboratorTip()}
        </div>
      </div>

      {/* Grid de 3 Indicadores Chave do Profissional */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Meta do Dia */}
        <div className="p-4 rounded-2xl bg-zinc-950/50 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              Sua Meta de Hoje
            </span>
            <span className="text-[11px] font-mono font-bold text-primary">
              {todayProgressPct}%
            </span>
          </div>
          <div className="flex justify-between text-xs text-white font-bold">
            <span>{formatBRL(todayAchieved)}</span>
            <span className="text-zinc-500 font-normal">Alvo: {formatBRL(todayGoal)}</span>
          </div>
          <Progress value={Math.min(todayProgressPct, 100)} className="h-1.5 bg-zinc-800" />
          <span className="text-[10px] text-zinc-400 block pt-0.5">
            {todayAchieved >= todayGoal ? 'Meta batida com sucesso! 🎉' : `Faltam ${formatBRL(todayGoal - todayAchieved)} para fechar o dia.`}
          </span>
        </div>

        {/* Card 2: Projeção de Comissão */}
        <div className="p-4 rounded-2xl bg-zinc-950/50 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Ganhos de Comissão
            </span>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
              {commissionRate}% taxa
            </span>
          </div>
          <div className="flex justify-between text-xs text-white font-bold">
            <span className="text-emerald-400">{formatBRL(estimatedCommissionToday)}</span>
            <span className="text-zinc-400 font-normal text-[11px]">Hoje</span>
          </div>
          <div className="text-[11px] text-zinc-400 flex justify-between pt-1 border-t border-white/5">
            <span>Acumulado no Mês:</span>
            <span className="text-white font-semibold">{formatBRL(estimatedCommissionMonth)}</span>
          </div>
        </div>

        {/* Card 3: Agenda & Atendimentos */}
        <div className="p-4 rounded-2xl bg-zinc-950/50 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Atendimentos de Hoje
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {completedTodayCount}/{scheduledTodayCount} Concluídos
            </span>
          </div>
          <div className="text-xs text-white font-bold">
            {scheduledTodayCount} cliente(s) agendados
          </div>
          <p className="text-[10px] text-zinc-400 leading-tight pt-1">
            Cada cliente bem atendido tem 85% mais chances de comprar produtos de manutenção.
          </p>
        </div>
      </div>

      {/* Modal Interativo da Mascote Lumi */}
      <LumiConsultingModal
        isOpen={isConsultingModalOpen}
        onClose={() => setIsConsultingModalOpen(false)}
        salonName={salonName}
        userName={firstName}
        metrics={{
          todayRevenue: todayAchieved,
          monthRevenue: monthlyAchieved,
          dailyGoal: todayGoal,
          monthlyGoal: monthlyGoal,
          scheduledCount: scheduledTodayCount,
          pendingCount: 0,
        }}
      />
    </div>
  );
}

export default LumiCollaboratorCoaching;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Target, 
  Scissors, 
  Users, 
  ListChecks, 
  Settings, 
  DollarSign,
  Zap,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LumiMascotAvatar } from './LumiMascotAvatar';
import { cn } from '@/lib/utils';

export interface SalonConfigurationState {
  hasGoals: boolean;
  hasServices: boolean;
  hasProfessionals: boolean;
  hasCommissions: boolean;
  hasChecklists: boolean;
  hasSalonDetails: boolean;
}

interface LumiSystemReadinessAlertProps {
  salonName?: string;
  configState?: Partial<SalonConfigurationState>;
  className?: string;
}

export function LumiSystemReadinessAlert({
  salonName = 'Seu Salão',
  configState = {},
  className = '',
}: LumiSystemReadinessAlertProps) {
  const navigate = useNavigate();

  // Itens monitorados pela Lumi para atingir força total
  const setupItems = [
    {
      id: 'goals',
      title: 'Definição de Metas do Mês',
      description: 'Configure as metas de faturamento para a Lumi calcular o pacing e projeção diária.',
      icon: Target,
      configured: configState.hasGoals ?? false,
      url: '/dashboard/metas',
      actionLabel: 'Definir Metas',
      priority: 'high' as const,
    },
    {
      id: 'services',
      title: 'Catálogo de Serviços & Preços',
      description: 'Cadastre seus procedimentos para a Lumi sugerir combos lucrativos e calcular ticket médio.',
      icon: Scissors,
      configured: configState.hasServices ?? false,
      url: '/dashboard/servicos',
      actionLabel: 'Cadastrar Serviços',
      priority: 'high' as const,
    },
    {
      id: 'professionals',
      title: 'Equipe & Especialistas',
      description: 'Adicione os membros do time para a Lumi monitorar metas individuais e produtividade.',
      icon: Users,
      configured: configState.hasProfessionals ?? false,
      url: '/dashboard/equipe',
      actionLabel: 'Cadastrar Equipe',
      priority: 'high' as const,
    },
    {
      id: 'commissions',
      title: 'Regras de Comissão',
      description: 'Ajuste os percentuais para a Lumi calcular repasses e motivar os colaboradores.',
      icon: DollarSign,
      configured: configState.hasCommissions ?? false,
      url: '/dashboard/comissoes',
      actionLabel: 'Configurar Comissões',
      priority: 'medium' as const,
    },
    {
      id: 'checklists',
      title: 'Checklists Operacionais de Qualidade',
      description: 'Habilite as rotinas de abertura e fechamento para a Lumi monitorar a conformidade da casa.',
      icon: ListChecks,
      configured: configState.hasChecklists ?? false,
      url: '/dashboard/checklist',
      actionLabel: 'Ativar Checklists',
      priority: 'medium' as const,
    },
    {
      id: 'details',
      title: 'Perfil & Dados do Estabelecimento',
      description: 'Complete o endereço, chave PIX e canais de atendimento para a recepção.',
      icon: Settings,
      configured: configState.hasSalonDetails ?? false,
      url: '/dashboard/configuracoes',
      actionLabel: 'Completar Perfil',
      priority: 'low' as const,
    },
  ];

  const completedCount = setupItems.filter((item) => item.configured).length;
  const totalCount = setupItems.length;
  const powerPercentage = Math.round((completedCount / totalCount) * 100);
  const pendingItems = setupItems.filter((item) => !item.configured);

  // Se tudo estiver 100% configurado, exibir badge comemorativo sutil
  if (pendingItems.length === 0) {
    return (
      <div className={cn(
        "p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-sm",
        className
      )}>
        <div className="flex items-center gap-3">
          <LumiMascotAvatar size="sm" mood="celebrating" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Lumi em Força Total (100% Configurada)
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.2 rounded-full font-mono">
                Potência Máxima
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Todas as seções vitais do {salonName} estão ativas. A Lumi está processando diagnósticos executivos completos.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center text-xs font-mono text-emerald-400/80">
          6/6 Módulos Ativos
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#181520] via-[#100e16] to-[#0a090e] border border-[#D4AF37]/35 p-5 md:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] space-y-4",
      className
    )}>
      {/* Luz ambiente dourada */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header do Alerta da Lumi */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <LumiMascotAvatar size="md" mood={powerPercentage < 50 ? 'alert' : 'strategic'} />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1 font-mono">
                <Zap className="w-3 h-3 text-amber-400 animate-bounce" />
                Nível de Potência da Lumi: {powerPercentage}%
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                ({completedCount}/{totalCount} Seções Ativas)
              </span>
            </div>
            <h3 className="text-base font-bold text-white font-heading tracking-tight">
              Calibração da Gestora Virtual Lumi
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-light">
              Complete as configurações abaixo para a Gestora Virtual Lumi desbloquear análises cirúrgicas de lucro, metas e prevenção de faltas.
            </p>
          </div>
        </div>

        {/* Barra de Progresso de Potência */}
        <div className="w-full md:w-48 space-y-1.5 shrink-0 bg-black/40 p-3 rounded-2xl border border-white/5">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-zinc-400">Potência Atual</span>
            <span className="font-bold text-[#D4AF37]">{powerPercentage}%</span>
          </div>
          <Progress value={powerPercentage} className="h-2 bg-zinc-800" />
          <span className="text-[9px] text-zinc-500 block text-right">
            {pendingItems.length} {pendingItems.length === 1 ? 'pendência' : 'pendências'} restantes
          </span>
        </div>
      </div>

      {/* Grid de Seções Pendentes de Configuração */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {pendingItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/10 hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between space-y-2.5 group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 group-hover:scale-105 transition-transform">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                      {item.title}
                    </span>
                  </div>
                  {item.priority === 'high' && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25">
                      Vital
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-light">
                  {item.description}
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(item.url)}
                className="w-full h-8 text-[11px] font-semibold border-white/10 hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 text-zinc-200 hover:text-[#D4AF37] rounded-xl flex items-center justify-between px-3 transition-all"
              >
                <span>{item.actionLabel}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#D4AF37]" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LumiSystemReadinessAlert;

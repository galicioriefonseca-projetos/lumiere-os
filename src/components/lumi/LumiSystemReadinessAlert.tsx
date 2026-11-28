import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  DollarSign,
  ListChecks,
  Scissors,
  Settings,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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

  const setupItems = [
    {
      id: 'goals',
      title: 'Metas do Mês',
      description: 'Defina metas para cálculo de pacing e projeções.',
      icon: Target,
      configured: configState.hasGoals ?? false,
      url: '/dashboard/metas',
      actionLabel: 'Definir metas',
    },
    {
      id: 'services',
      title: 'Catálogo de Serviços',
      description: 'Cadastre procedimentos para medir ticket médio e rentabilidade.',
      icon: Scissors,
      configured: configState.hasServices ?? false,
      url: '/dashboard/servicos',
      actionLabel: 'Cadastrar serviços',
    },
    {
      id: 'professionals',
      title: 'Equipe & Especialistas',
      description: 'Adicione profissionais para acompanhar produtividade.',
      icon: Users,
      configured: configState.hasProfessionals ?? false,
      url: '/dashboard/equipe',
      actionLabel: 'Cadastrar equipe',
    },
    {
      id: 'commissions',
      title: 'Regras de Comissão',
      description: 'Configure repasses automáticos por colaborador.',
      icon: DollarSign,
      configured: configState.hasCommissions ?? false,
      url: '/dashboard/comissoes',
      actionLabel: 'Configurar comissões',
    },
    {
      id: 'checklists',
      title: 'Checklists Operacionais',
      description: 'Ative rotinas de abertura e fechamento.',
      icon: ListChecks,
      configured: configState.hasChecklists ?? false,
      url: '/dashboard/checklist',
      actionLabel: 'Ativar checklists',
    },
    {
      id: 'details',
      title: 'Perfil do Estabelecimento',
      description: 'Complete dados de contato e identificação do salão.',
      icon: Settings,
      configured: configState.hasSalonDetails ?? false,
      url: '/dashboard/minha-conta',
      actionLabel: 'Completar perfil',
    },
  ];

  const completedCount = setupItems.filter((item) => item.configured).length;
  const totalCount = setupItems.length;
  const powerPercentage = Math.round((completedCount / totalCount) * 100);
  const pendingItems = setupItems.filter((item) => !item.configured);

  if (pendingItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-[#D8C79F] bg-white p-5 space-y-4',
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8A6D36]">
            <ShieldCheck className="w-4 h-4" />
            <span>
              Calibração do {salonName} · {completedCount}/{totalCount} módulos configurados
            </span>
          </div>
          <h3 className="text-base font-semibold text-[#171717]">
            Complete as configurações iniciais para liberar todos os indicadores
          </h3>
        </div>

        <div className="w-full md:w-52 space-y-1.5 shrink-0">
          <div className="flex justify-between text-xs">
            <span className="text-[#6B6B6B]">Prontidão</span>
            <span className="font-bold text-[#171717] tabular-nums">{powerPercentage}%</span>
          </div>
          <Progress value={powerPercentage} className="h-2 bg-[#F2EFE9]" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pendingItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.url)}
              className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] hover:border-[#8A6D36] p-3.5 text-left transition-colors flex flex-col justify-between gap-2.5 group"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#171717]">
                    <Icon className="w-3.5 h-3.5 text-[#8A6D36]" />
                    {item.title}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#6B6B6B] group-hover:text-[#171717]" />
                </div>
                <p className="text-[11px] text-[#4A4A4A] leading-snug">{item.description}</p>
              </div>
              <span className="text-[11px] font-semibold text-[#8A6D36]">{item.actionLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default LumiSystemReadinessAlert;

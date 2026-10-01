import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Shield, Contact, User, Scissors, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Role } from '../types';
import { canAccessRoute } from '../lib/permissions';
import { toast } from 'sonner';

export function DemoRoleSwitcher() {
  const { currentUser, salonData, userData, demoRole, setDemoRole, isPlatformAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // A conta do Essenza e salões com hideDemoRoleSwitcher não exibem o simulador de funções sob nenhuma hipótese
  const isEssenza = Boolean(
    salonData?.id === 'c2c4ec8f-55f4-4f9b-ae7f-3fd38d7dc6a4' ||
    userData?.salonId === 'c2c4ec8f-55f4-4f9b-ae7f-3fd38d7dc6a4' ||
    (salonData?.name && /essenza/i.test(salonData.name)) ||
    ((userData as any)?.salonName && /essenza/i.test((userData as any).salonName)) ||
    (salonData as any)?.hideDemoRoleSwitcher === true ||
    salonData?.ownerEmail?.toLowerCase() === 'lamalacarneoliveira@gmail.com' ||
    currentUser?.email?.toLowerCase() === 'lamalacarneoliveira@gmail.com' ||
    currentUser?.email?.toLowerCase() === 'laismalacarne@hotmail.com'
  );

  // Se for Essenza, durante carregamento ou se a simulação não estiver disponível, nunca renderiza
  if (loading || isEssenza || !setDemoRole) {
    return null;
  }

  // Visível apenas para ambientes demo/tutorial ou administradores da plataforma fora de contas de produção
  const isDemoActive = Boolean(
    salonData?.isDemo === true ||
    salonData?.isTutorial === true ||
    (salonData?.name && /lumiere\s*beauty/i.test(salonData.name)) ||
    (currentUser?.email && import.meta.env.VITE_DEMO_USER_EMAIL && currentUser.email.toLowerCase() === import.meta.env.VITE_DEMO_USER_EMAIL.toLowerCase()) ||
    currentUser?.email?.toLowerCase() === 'demo@example.com' ||
    currentUser?.email?.toLowerCase() === 'demo@lumiereos.com.br' ||
    import.meta.env.VITE_ENABLE_DEMO_MODE === 'true' ||
    (isPlatformAdmin && !isEssenza)
  );

  if (!isDemoActive) {
    return null;
  }

  const roles = [
    { 
      id: 'owner' as Role, 
      label: 'Proprietário', 
      icon: Crown, 
      activeStyle: 'text-[#8A6D36] bg-[#F5F1E9] border-[#B89B5E] shadow-sm ring-1 ring-[#B89B5E]/30',
      activeDot: 'bg-[#B89B5E]',
      badge: 'Acesso Pleno',
      description: 'Acesso irrestrito a faturamento, equipe, assinaturas e relatórios executivos.'
    },
    { 
      id: 'manager' as Role, 
      label: 'Gerente', 
      icon: Shield, 
      activeStyle: 'text-blue-700 bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-300/40',
      activeDot: 'bg-blue-600',
      badge: 'Operação & Gestão',
      description: 'Gestão da operação diária, agenda, estoque, equipe, metas e comissões.'
    },
    { 
      id: 'receptionist' as Role, 
      label: 'Recepcionista', 
      icon: Contact, 
      activeStyle: 'text-purple-700 bg-purple-50 border-purple-300 shadow-sm ring-1 ring-purple-300/40',
      activeDot: 'bg-purple-600',
      badge: 'Atendimento & Agenda',
      description: 'Controle de fluxo de clientes, lançamentos de produção, agenda e checklists operacionais.'
    },
    { 
      id: 'attendant' as Role, 
      label: 'Atendente', 
      icon: User, 
      activeStyle: 'text-emerald-700 bg-emerald-50 border-emerald-300 shadow-sm ring-1 ring-emerald-300/40',
      activeDot: 'bg-emerald-600',
      badge: 'Apoio Operacional',
      description: 'Recepção ágil, consulta de agenda, cadastro de clientes e conferência de checklists.'
    },
    { 
      id: 'professional' as Role, 
      label: 'Profissional', 
      icon: Scissors, 
      activeStyle: 'text-rose-700 bg-rose-50 border-rose-300 shadow-sm ring-1 ring-rose-300/40',
      activeDot: 'bg-rose-600',
      badge: 'Meu Painel',
      description: 'Área individual: agenda pessoal, histórico de atendimentos, comissões e metas individuais.'
    }
  ];

  const currentRole = (demoRole || userData?.role || 'owner') as Role;
  const activeRoleObj = roles.find(r => r.id === currentRole) || roles[0];

  const handleSelectRole = (r: typeof roles[0]) => {
    setDemoRole(r.id);
    toast.success(`Visualização alternada para: ${r.label}`);
    
    // Se a rota atual não for permitida para a nova função, redireciona para o dashboard inicial
    if (!canAccessRoute(r.id, location.pathname)) {
      navigate('/dashboard');
    }
  };

  const handleReset = () => {
    setDemoRole(null);
    toast.info('Visualização restaurada para o perfil padrão.');
  };

  return (
    <div id="demo-role-switcher" className="bg-card border border-border rounded-2xl p-4 shadow-sm transition-all mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-border pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#8A6D36] tracking-wider uppercase font-sans">
              Simulador de Funções
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              • {activeRoleObj.badge}
            </span>
          </div>
        </div>

        <button 
          id="btn-reset-demo-role"
          onClick={handleReset}
          title="Restaurar para perfil padrão"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border transition-all duration-150 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 text-muted-foreground" />
          <span className="hidden sm:inline">Restaurar</span>
        </button>
      </div>

      <p className="text-[12px] text-muted-foreground font-light mb-3 leading-relaxed">
        Selecione uma função para testar como o LumièreOS se comporta para cada membro da equipe:
      </p>

      {/* Buttons Grid */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        {roles.map((r) => {
          const isSelected = currentRole === r.id;
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              id={`btn-demo-role-${r.id}`}
              onClick={() => handleSelectRole(r)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all duration-200 border select-none ${
                isSelected 
                  ? `${r.activeStyle} scale-[1.02]`
                  : 'bg-secondary/60 text-muted-foreground border-border hover:text-foreground hover:bg-secondary active:scale-[0.98]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{r.label}</span>
              {isSelected && (
                <span className={`w-1.5 h-1.5 rounded-full ${r.activeDot} ml-0.5 animate-pulse`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Dynamic Role Capability Summary */}
      <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate">
          <strong className="text-foreground font-medium">{activeRoleObj.label}:</strong> {activeRoleObj.description}
        </span>
      </div>
    </div>
  );
}

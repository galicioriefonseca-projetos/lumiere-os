import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Shield, Contact, User, Scissors, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Role } from '../types';
import { canAccessRoute } from '../lib/permissions';
import { toast } from 'sonner';

export function DemoRoleSwitcher() {
  const { currentUser, salonData, userData, demoRole, setDemoRole, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Visível para administradores da plataforma, salões em modo demo/tutorial, conta demo e ambiente local
  const isDemoActive = Boolean(
    isPlatformAdmin ||
    salonData?.isDemo === true ||
    salonData?.isTutorial === true ||
    (salonData?.name && /lumiere\s*beauty/i.test(salonData.name)) ||
    (currentUser?.email && import.meta.env.VITE_DEMO_USER_EMAIL && currentUser.email.toLowerCase() === import.meta.env.VITE_DEMO_USER_EMAIL.toLowerCase()) ||
    currentUser?.email?.toLowerCase() === 'leandropfonseca20@gmail.com' ||
    currentUser?.email?.toLowerCase() === 'galicioriefonseca@gmail.com' ||
    currentUser?.email?.toLowerCase() === 'demo@example.com' ||
    currentUser?.email?.toLowerCase() === 'demo@lumiereos.com.br' ||
    import.meta.env.VITE_ENABLE_DEMO_MODE === 'true' ||
    import.meta.env.DEV
  );

  if (!isDemoActive || !setDemoRole) {
    return null;
  }

  const roles = [
    { 
      id: 'owner' as Role, 
      label: 'Proprietário', 
      icon: Crown, 
      activeStyle: 'text-amber-300 bg-amber-500/10 border-amber-400/40 shadow-[0_0_12px_rgba(212,175,55,0.12)] ring-1 ring-amber-400/30',
      activeDot: 'bg-amber-400',
      badge: 'Acesso Pleno',
      description: 'Acesso irrestrito a faturamento, equipe, assinaturas e relatórios executivos.'
    },
    { 
      id: 'manager' as Role, 
      label: 'Gerente', 
      icon: Shield, 
      activeStyle: 'text-blue-300 bg-blue-500/10 border-blue-400/40 shadow-[0_0_12px_rgba(59,130,246,0.12)] ring-1 ring-blue-400/30',
      activeDot: 'bg-blue-400',
      badge: 'Operação & Gestão',
      description: 'Gestão da operação diária, agenda, estoque, equipe, metas e comissões.'
    },
    { 
      id: 'receptionist' as Role, 
      label: 'Recepcionista', 
      icon: Contact, 
      activeStyle: 'text-purple-300 bg-purple-500/10 border-purple-400/40 shadow-[0_0_12px_rgba(168,85,247,0.12)] ring-1 ring-purple-400/30',
      activeDot: 'bg-purple-400',
      badge: 'Atendimento & Agenda',
      description: 'Controle de fluxo de clientes, lançamentos de produção, agenda e checklists operacionais.'
    },
    { 
      id: 'attendant' as Role, 
      label: 'Atendente', 
      icon: User, 
      activeStyle: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.12)] ring-1 ring-emerald-400/30',
      activeDot: 'bg-emerald-400',
      badge: 'Apoio Operacional',
      description: 'Recepção ágil, consulta de agenda, cadastro de clientes e conferência de checklists.'
    },
    { 
      id: 'professional' as Role, 
      label: 'Profissional', 
      icon: Scissors, 
      activeStyle: 'text-rose-300 bg-rose-500/10 border-rose-400/40 shadow-[0_0_12px_rgba(244,63,94,0.12)] ring-1 ring-rose-400/30',
      activeDot: 'bg-rose-400',
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
    <div id="demo-role-switcher" className="bg-[#0b0c12]/95 border border-[#D4AF37]/25 rounded-2xl p-4 shadow-2xl backdrop-blur-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#D4AF37] tracking-wider uppercase font-sans">
              Simulador de Funções
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              • {activeRoleObj.badge}
            </span>
          </div>
        </div>

        <button 
          id="btn-reset-demo-role"
          onClick={handleReset}
          title="Restaurar para perfil padrão"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all duration-150 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 text-zinc-400" />
          <span className="hidden sm:inline">Restaurar</span>
        </button>
      </div>

      <p className="text-[12px] text-zinc-400 font-light mb-3 leading-relaxed">
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
                  : 'bg-[#12131a] text-zinc-400 border-white/5 hover:text-zinc-200 hover:bg-white/[0.04] hover:border-white/10 active:scale-[0.98]'
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
      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-2 text-[11px] text-zinc-400">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
        <span className="truncate">
          <strong className="text-zinc-200 font-medium">{activeRoleObj.label}:</strong> {activeRoleObj.description}
        </span>
      </div>
    </div>
  );
}

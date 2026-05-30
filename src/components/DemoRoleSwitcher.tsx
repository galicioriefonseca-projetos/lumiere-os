import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Shield, Contact, User, Scissors, RefreshCw } from 'lucide-react';
import { Role } from '../types';

export function DemoRoleSwitcher() {
  const { currentUser, salonData, userData, demoRole, setDemoRole } = useAuth();

  // ONLY visible under Leandro's demo/tutorial account
  const isDemoActive = currentUser?.email === 'leandropfonseca20@gmail.com' && salonData?.isDemo === true;

  if (!isDemoActive || !setDemoRole) {
    return null;
  }

  const roles = [
    { id: 'owner' as Role, label: 'Proprietário', icon: Crown, color: 'text-amber-400 bg-amber-400/10 border-amber-400/25' },
    { id: 'manager' as Role, label: 'Gerente', icon: Shield, color: 'text-blue-400 bg-blue-400/10 border-blue-400/25' },
    { id: 'receptionist' as Role, label: 'Recepcionista', icon: Contact, color: 'text-purple-400 bg-purple-400/10 border-purple-400/25' },
    { id: 'attendant' as Role, label: 'Atendente', icon: User, color: 'text-teal-400 bg-teal-400/10 border-teal-400/25' },
    { id: 'professional' as Role, label: 'Profissional', icon: Scissors, color: 'text-pink-400 bg-pink-400/10 border-pink-400/25' }
  ];

  const currentRole = demoRole || userData?.role || 'owner';

  return (
    <div className="bg-[#0b0c10] border border-[#D4AF37]/20 rounded-xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <p className="text-[11px] font-bold text-[#D4AF37] tracking-wider uppercase font-sans">
            Modo Demo/Tutorial Ativo
          </p>
        </div>
        <button 
          onClick={() => setDemoRole('owner')}
          title="Resetar para Proprietário"
          className="text-muted-foreground hover:text-white transition-colors duration-150 p-1 rounded-lg hover:bg-white/5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-zinc-400 font-light mb-3 leading-tight">
        Simule as visualizações e permissões do LumiereOS operando como diferentes membros da equipe.
      </p>

      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
        {roles.map((r) => {
          const isSelected = currentRole === r.id;
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => setDemoRole(r.id)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border ${
                isSelected 
                  ? `${r.color} shadow-[0_0_10px_rgba(212,175,55,0.05)] scale-[1.02]`
                  : 'bg-zinc-900/60 text-muted-foreground border-transparent hover:text-white hover:bg-zinc-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

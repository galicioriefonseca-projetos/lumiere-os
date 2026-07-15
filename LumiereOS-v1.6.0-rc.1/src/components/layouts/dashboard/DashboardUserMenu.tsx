import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  User, 
  ChevronDown, 
  Play, 
  Sparkles, 
  HelpCircle, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BILLING_CONFIG } from '@/config/billing';

interface DashboardUserMenuProps {
  onOpenUpdates: () => void;
}

export function DashboardUserMenu({ onOpenUpdates }: DashboardUserMenuProps) {
  const { userData, salonData, isPlatformAdmin, logout, currentUser } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleStartTour = () => {
    setIsUserMenuOpen(false);
    window.dispatchEvent(new CustomEvent('lumiere-start-interactive-tour'));
  };

  const handleSupportClick = () => {
    setIsUserMenuOpen(false);
    const text = `Suporte LumiereOS - Usuário: ${userData?.fullName || ''}`;
    const number = String(BILLING_CONFIG.supportWhatsApp || '').replace(/\D/g, '');
    const url = number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `mailto:${BILLING_CONFIG.supportEmail}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative" id="lumiere-user-menu">
      <button
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl text-xs text-zinc-300 transition-all cursor-pointer select-none"
      >
        {currentUser?.photoURL ? (
          <img 
            src={currentUser.photoURL} 
            alt="Avatar" 
            className="w-6 h-6 rounded-lg object-cover border border-[#D4AF37]/30" 
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/45 text-white font-bold flex items-center justify-center text-[10px] leading-tight">
            {userData?.fullName?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        <span className="hidden sm:inline font-medium text-zinc-200">
          {userData?.fullName?.split(' ')[0]}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      </button>

      {isUserMenuOpen && (
        <>
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setIsUserMenuOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#09090b] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] p-1.5 z-40 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
            {(salonData?.isDemo || salonData?.isTutorial) && (
              <div className="px-2.5 py-1.2 mb-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                <span className="text-[10px] font-bold text-amber-500 uppercase">Modo Demo/Tutorial</span>
              </div>
            )}
            
            <div className="px-2.5 py-1.5 border-b border-white/5 mb-1.5">
              <p className="text-xs font-semibold text-white truncate">{userData?.fullName}</p>
              <p className="text-[10px] text-zinc-500 truncate">{currentUser?.email}</p>
            </div>

            <Link 
              to="/dashboard/minha-conta" 
              onClick={() => setIsUserMenuOpen(false)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.03] transition-all"
            >
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span>Minha Conta</span>
            </Link>

            <button 
              onClick={handleStartTour}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-lg text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all cursor-pointer text-left font-semibold"
            >
              <Play className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Tour Interativo</span>
            </button>

            <button 
              onClick={() => { setIsUserMenuOpen(false); onOpenUpdates(); }}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.03] transition-all cursor-pointer text-left"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Novidades do sistema</span>
            </button>

            <button 
              onClick={handleSupportClick}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.03] transition-all cursor-pointer text-left"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>Suporte</span>
            </button>

            {isPlatformAdmin && (
              <Link 
                to="/master" 
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs text-[#D4AF37] hover:bg-[#D4AF37]/5 rounded-lg transition-all border border-[#D4AF37]/20 mt-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Painel Master</span>
              </Link>
            )}

            <button 
              onClick={() => { setIsUserMenuOpen(false); logout(); }}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all mt-1.5 cursor-pointer border border-transparent text-left font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

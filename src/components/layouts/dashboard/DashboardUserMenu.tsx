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

  const supportWhatsappUrl = `https://wa.me/5517996140963?text=${encodeURIComponent(
    `Suporte LumiereOS - Usuário: ${userData?.fullName || ''}`
  )}`;

  return (
    <div className="relative" id="lumiere-user-menu">
      <button
        type="button"
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 bg-white hover:bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl text-xs text-[#171717] transition-all cursor-pointer select-none"
      >
        {(userData?.photoURL || (userData as any)?.avatarUrl || currentUser?.photoURL) ? (
          <img 
            src={userData?.photoURL || (userData as any)?.avatarUrl || currentUser?.photoURL || ''} 
            alt="Avatar" 
            className="w-6 h-6 rounded-lg object-cover border border-[#B89B5E]/40 shadow-xs" 
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-6 h-6 rounded-lg bg-[#F5F1E9] border border-[#B89B5E]/40 text-[#8A6D36] font-bold flex items-center justify-center text-[10px] leading-tight">
            {userData?.fullName?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        <span className="hidden sm:inline font-medium text-[#171717]">
          {userData?.fullName?.split(' ')[0]}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#6B6B6B] shrink-0" />
      </button>

      {isUserMenuOpen && (
        <>
          <div 
            className="fixed inset-0 z-30 bg-black/15 sm:bg-transparent" 
            onClick={() => setIsUserMenuOpen(false)}
          />
          <div className="fixed inset-x-3 top-[68px] sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-56 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white border border-[#E5E2DC] shadow-xl p-1.5 z-40 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
            {(salonData?.isDemo || salonData?.isTutorial) && (
              <div className="px-2.5 py-1.5 mb-1.5 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <span className="text-[10px] font-bold text-amber-800 uppercase">Modo Demo/Tutorial</span>
              </div>
            )}
            
            <div className="px-2.5 py-1.5 border-b border-[#E5E2DC] mb-1.5">
              <p className="text-xs font-semibold text-[#171717] truncate">{userData?.fullName}</p>
              <p className="text-[10px] text-[#6B6B6B] truncate">{currentUser?.email}</p>
            </div>

            <Link 
              to="/dashboard/minha-conta" 
              onClick={() => setIsUserMenuOpen(false)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-lg text-[#171717] hover:bg-[#FAF9F7] transition-all"
            >
              <User className="w-3.5 h-3.5 text-[#6B6B6B]" />
              <span>Minha Conta</span>
            </Link>

            <button 
              type="button"
              onClick={handleStartTour}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-lg text-[#8A6D36] hover:bg-[#F5F1E9] transition-all cursor-pointer text-left font-semibold"
            >
              <Play className="w-3.5 h-3.5 text-[#8A6D36]" />
              <span>Tour Interativo</span>
            </button>

            <button 
              type="button"
              onClick={() => { setIsUserMenuOpen(false); onOpenUpdates(); }}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-lg text-[#171717] hover:bg-[#FAF9F7] transition-all cursor-pointer text-left"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8A6D36]" />
              <span>Novidades do sistema</span>
            </button>

            <a 
              href={supportWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsUserMenuOpen(false)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs rounded-lg text-[#171717] hover:bg-[#FAF9F7] transition-all cursor-pointer text-left"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#6B6B6B]" />
              <span>Suporte</span>
            </a>

            {isPlatformAdmin && (
              <Link 
                to="/master" 
                onClick={() => setIsUserMenuOpen(false)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs text-[#8A6D36] hover:bg-[#F5F1E9] rounded-lg transition-all border border-[#B89B5E]/30 mt-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-[#8A6D36]" />
                <span>Painel Master</span>
              </Link>
            )}

            <button 
              type="button"
              onClick={() => { setIsUserMenuOpen(false); logout(); }}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-xs text-rose-700 hover:bg-rose-50 rounded-lg transition-all mt-1.5 cursor-pointer border border-transparent text-left font-semibold"
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

import { Link, useLocation } from 'react-router-dom';
import { 
  X, 
  Crown, 
  HelpCircle, 
  Sparkles, 
  Settings, 
  UserX, 
  LogOut 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import PWAInstallButton from '../../PWAInstallButton';
import { APP_INFO } from '../../../config/appInfo';
import { NavigationCategory } from './getNavigationByRole';

interface DashboardMobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: NavigationCategory[];
  isPlatformAdmin: boolean;
  userData: any;
  salonData: any;
  hasNewVersionNotice: boolean;
  onOpenGuide: () => void;
  onOpenRoadmap: () => void;
  onOpenUpdates: () => void;
  onOpenDeletionModal: () => void;
  logout: () => Promise<void>;
}

export function DashboardMobileNavigation({
  isOpen,
  onClose,
  navigation,
  isPlatformAdmin,
  userData,
  salonData,
  hasNewVersionNotice,
  onOpenGuide,
  onOpenRoadmap,
  onOpenUpdates,
  onOpenDeletionModal,
  logout
}: DashboardMobileNavigationProps) {
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
      {/* Backdrop Overlay */}
      <div 
        className="fixed inset-0 bg-black/85 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto"
        onClick={onClose}
      />
      {/* Slider Container */}
      <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#09090b] border-r border-[#D4AF37]/10 flex flex-col z-50 animate-in slide-in-from-left duration-200">
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#D4AF37] filter drop-shadow-[0_0_4px_rgba(212,175,55,0.3)]" />
            <span className="text-sm font-bold tracking-widest text-[#D4AF37] uppercase font-sans">Lumière<span className="text-white">OS</span></span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#D4AF37] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 py-5 px-4 space-y-1.5 overflow-y-auto">
          <div className="mb-5 flex flex-col gap-2">
             <Button 
               onClick={() => { onClose(); onOpenGuide(); }}
               variant="outline"
               className="w-full text-[#D4AF37] border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 bg-white/[0.02]"
             >
               <HelpCircle className="w-4 h-4" /> Guia do Sistema
             </Button>
             <Button 
               onClick={() => { onClose(); onOpenRoadmap(); }}
               variant="outline"
               className="w-full text-[#D4AF37] border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 bg-white/[0.02]"
             >
               <Sparkles className="w-4 h-4" /> Próximas Atualizações
             </Button>
          </div>
          
          <div className="space-y-5">
            {navigation.map((category) => (
              <div key={category.category} className="space-y-1.5">
                <span className="px-3 text-[9px] uppercase tracking-widest font-extrabold text-[#D4AF37]/85 block select-none">
                  {category.category}
                </span>
                <div className="space-y-1">
                  {category.items.map((item) => {
                    const isActive = item.exact 
                      ? location.pathname === item.href 
                      : location.pathname.startsWith(item.href);
                      
                    return (
                      <Link 
                        key={item.name} 
                        to={item.href} 
                        onClick={onClose} 
                        className={cn(
                          "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border",
                          isActive 
                            ? "bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20 shadow-[0_0_15px_rgba(212,175,55,0.03)]" 
                            : "text-[#a1a1aa] hover:text-white hover:bg-white/[0.02] border-transparent"
                        )}
                      >
                        <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-[#D4AF37]" : "text-zinc-500")} /> {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          {isPlatformAdmin && (
            <Link
              to="/master"
              onClick={onClose}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors mt-6 text-[#D4AF37] bg-[#D4AF37]/5 border border-[#D4AF37]/25"
            >
              <Settings className="w-4.5 h-4.5" />
              Painel Master
            </Link>
          )}
          
          <div className="mt-6 flex flex-col gap-2">
             <PWAInstallButton />

             {/* Institutional version footer mobile */}
             <div className="mt-2.5 px-3 py-3.5 bg-zinc-900/40 border border-white/5 rounded-xl text-center flex flex-col items-center gap-1.5">
               <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-sans select-none justify-center">
                 <span>LumiereOS</span> • <span className="font-semibold text-[#D4AF37]">v{APP_INFO.version}</span>
                 {hasNewVersionNotice && (
                   <span className="relative flex h-1.5 w-1.5">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#D4AF37]"></span>
                   </span>
                 )}
               </div>
               <button 
                 onClick={() => {
                   onClose();
                   onOpenUpdates();
                 }}
                 className="text-[10px] tracking-wider uppercase font-bold text-[#D4AF37] hover:text-amber-400 font-mono transition-all flex items-center gap-1 cursor-pointer focus:outline-none"
               >
                 <Sparkles className="w-3 h-3 text-[#D4AF37]" /> O que há de novo?
               </button>
               <p className="text-[9px] text-zinc-500 leading-tight mt-1 select-none text-center font-light">
                 © Galiciori e Fonseca
               </p>
             </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-white/5 bg-[#070708]">
          <div className="flex items-center gap-3 px-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4AF37]/15 to-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold">
              {userData?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{userData?.fullName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{isPlatformAdmin ? 'Administrador Global' : (salonData?.name || 'Sem salão')}</p>
            </div>
          </div>
          {userData && (
            <Button 
              variant="ghost" 
              disabled={userData.status === 'deletion_requested'}
              className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl text-xs h-9 px-3 mt-1.5" 
              onClick={() => { onClose(); onOpenDeletionModal(); }}
            >
              <UserX className="w-4 h-4 mr-2" />
              {userData.status === 'deletion_requested' ? 'Exclusão Solicitada' : 'Solicitar Exclusão da Conta'}
            </Button>
          )}
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl text-xs h-9 px-3" 
            onClick={() => { onClose(); logout(); }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da Conta
          </Button>
        </div>
      </div>
    </div>
  );
}

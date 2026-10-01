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
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto"
        onClick={onClose}
      />
      {/* Slider Container - Paleta Landing Page */}
      <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-card border-r border-border flex flex-col z-50 animate-in slide-in-from-left duration-200">
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold tracking-widest text-foreground uppercase font-sans">Lumière<span className="text-primary">OS</span></span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 py-5 px-4 space-y-1.5 overflow-y-auto">
          <div className="mb-5 flex flex-col gap-2">
             <Button 
               onClick={() => { onClose(); onOpenGuide(); }}
               variant="outline"
               className="w-full text-foreground border-border hover:bg-secondary h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 bg-card"
             >
               <HelpCircle className="w-4 h-4 text-primary" /> Guia do Sistema
             </Button>
             <Button 
               onClick={() => { onClose(); onOpenRoadmap(); }}
               variant="outline"
               className="w-full text-foreground border-border hover:bg-secondary h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 bg-card"
             >
               <Sparkles className="w-4 h-4 text-primary" /> Próximas Atualizações
             </Button>
          </div>
          
          <div className="space-y-5">
            {navigation.map((category) => (
              <div key={category.category} className="space-y-1.5">
                <span className="px-3 text-[9px] uppercase tracking-widest font-extrabold text-muted-foreground block select-none">
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
                            ? "bg-accent text-accent-foreground border-primary/20 shadow-xs" 
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent"
                        )}
                      >
                        <item.icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} /> {item.name}
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
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors mt-6 text-accent-foreground bg-accent border border-primary/25"
            >
              <Settings className="w-4.5 h-4.5 text-primary" />
              Painel Master
            </Link>
          )}
          
          <div className="mt-6 flex flex-col gap-2">
             <PWAInstallButton />

             {/* Institutional version footer mobile */}
             <div className="mt-2.5 px-3 py-3.5 bg-secondary/70 border border-border rounded-xl text-center flex flex-col items-center gap-1.5">
               <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-sans select-none justify-center">
                 <span>LumiereOS</span> • <span className="font-semibold text-primary">v{APP_INFO.version}</span>
                 {hasNewVersionNotice && (
                   <span className="relative flex h-1.5 w-1.5">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                   </span>
                 )}
               </div>
               <button 
                 onClick={() => {
                   onClose();
                   onOpenUpdates();
                 }}
                 className="text-[10px] tracking-wider uppercase font-bold text-primary hover:text-primary/80 font-mono transition-all flex items-center gap-1 cursor-pointer focus:outline-none"
               >
                 <Sparkles className="w-3 h-3 text-primary" /> O que há de novo?
               </button>
               <p className="text-[9px] text-muted-foreground leading-tight mt-1 select-none text-center font-light">
                 © Galiciori e Fonseca
               </p>
             </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center gap-3 px-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-accent border border-primary/20 flex items-center justify-center text-primary font-bold">
              {userData?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{userData?.fullName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground border border-primary/20 font-semibold uppercase tracking-wider whitespace-nowrap">
                  {userData?.role === 'owner' ? 'Proprietário' :
                   userData?.role === 'manager' ? 'Gerente' :
                   userData?.role === 'receptionist' ? 'Recepcionista' :
                   userData?.role === 'attendant' ? 'Atendente' :
                   userData?.role === 'professional' ? 'Profissional' :
                   userData?.role || 'Usuário'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">{isPlatformAdmin ? 'Admin Global' : (salonData?.name || 'Sem salão')}</span>
              </div>
            </div>
          </div>
          {userData && (
            <Button 
              variant="ghost" 
              disabled={userData.status === 'deletion_requested'}
              className="w-full justify-start text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl text-xs h-9 px-3 mt-1.5" 
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

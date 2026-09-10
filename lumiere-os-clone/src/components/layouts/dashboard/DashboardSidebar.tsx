import { Link, useLocation } from 'react-router-dom';
import { 
  Crown, 
  Settings, 
  Sparkles, 
  UserX, 
  LogOut 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BugReportDialog } from '../../BugReportDialog';
import PWAInstallButton from '../../PWAInstallButton';
import { APP_INFO } from '../../../config/appInfo';
import { DashboardLumiWidget } from './DashboardLumiWidget';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
}

interface NavigationCategory {
  category: string;
  items: NavigationItem[];
}

interface DashboardSidebarProps {
  navigation: NavigationCategory[];
  isPlatformAdmin: boolean;
  userData: any;
  salonData: any;
  hasNewVersionNotice: boolean;
  onOpenUpdates: () => void;
  onOpenDeletionModal: () => void;
  logout: () => Promise<void>;
}

export function DashboardSidebar({
  navigation,
  isPlatformAdmin,
  userData,
  salonData,
  hasNewVersionNotice,
  onOpenUpdates,
  onOpenDeletionModal,
  logout
}: DashboardSidebarProps) {
  const location = useLocation();

  return (
    <aside id="lumiere-desktop-sidebar" className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-[#D4AF37]/10 bg-[#09090b] z-20 shrink-0">
      <div className="h-20 flex items-center px-6 border-b border-white/5">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="p-1.5 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/35 group-hover:border-[#D4AF37] transition-all duration-300">
            <Crown className="w-5 h-5 text-[#D4AF37] filter drop-shadow-[0_0_6px_rgba(212,175,55,0.4)]" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-widest text-[#D4AF37] uppercase font-sans leading-none">Lumière<span className="text-white">OS</span></span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 font-light">Premium Salon SaaS</span>
          </div>
        </Link>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-6 overflow-y-auto">
        {navigation.map((category) => (
          <div key={category.category} className="space-y-2">
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
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border",
                      isActive 
                        ? "bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20 shadow-[0_0_15px_rgba(212,175,55,0.03)]" 
                        : "text-[#a1a1aa] hover:text-white hover:bg-white/[0.03] border-transparent"
                    )}
                  >
                    <item.icon className={cn("w-4.5 h-4.5 transition-colors shrink-0", isActive ? "text-[#D4AF37]" : "text-zinc-500 group-hover:text-zinc-300")} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        
        {isPlatformAdmin && (
          <Link
            to="/master"
            className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 mt-6 text-[#D4AF37] bg-[#D4AF37]/5 hover:bg-[#D4AF37]/15 border border-[#D4AF37]/25 shadow-[0_0_15px_rgba(212,175,55,0.06)]"
          >
            <Settings className="w-4.5 h-4.5" />
            Painel Master
          </Link>
        )}
        
        {/* Lumi Intelligence sidebar Widget */}
        <div className="mt-4">
          <DashboardLumiWidget />
        </div>
        
        <div className="mt-8 px-2 flex flex-col gap-2">
           <PWAInstallButton />

           {/* Institutional version footer desktop */}
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
               onClick={onOpenUpdates}
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37]/15 to-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold shadow-[0_0_10px_rgba(212,175,55,0.05)] font-heading">
            {userData?.fullName?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{userData?.fullName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{isPlatformAdmin ? 'Administrador Global' : (salonData?.name || 'Sem salão')}</p>
          </div>
        </div>
        <BugReportDialog />
        {userData && (
          <Button 
            variant="ghost" 
            disabled={userData.status === 'deletion_requested'}
            className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl mt-1.5 text-xs h-9" 
            onClick={onOpenDeletionModal}
          >
            <UserX className="w-4 h-4 mr-2" />
            {userData.status === 'deletion_requested' ? 'Exclusão Solicitada' : 'Solicitar Exclusão da Conta'}
          </Button>
        )}
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl mt-1.5 text-xs h-9" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>
  );
}

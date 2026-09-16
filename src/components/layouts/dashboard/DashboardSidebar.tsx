import { Link, useLocation } from 'react-router-dom';
import { Crown, Settings, Sparkles, UserX, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BugReportDialog } from '../../BugReportDialog';
import PWAInstallButton from '../../PWAInstallButton';
import { APP_INFO } from '../../../config/appInfo';
import { DashboardLumiWidget } from './DashboardLumiWidget';

interface NavigationItem { name: string; href: string; icon: any; exact?: boolean; }
interface NavigationCategory { category: string; items: NavigationItem[]; }
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

export function DashboardSidebar({ navigation, isPlatformAdmin, userData, salonData, hasNewVersionNotice, onOpenUpdates, onOpenDeletionModal, logout }: DashboardSidebarProps) {
  const location = useLocation();

  return (
    <aside id="lumiere-desktop-sidebar" className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-border bg-card z-20 shrink-0">
      <div className="h-20 flex items-center px-6 border-b border-border/70">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-accent border border-primary/25 flex items-center justify-center group-hover:border-primary/50 transition-colors">
            <Crown className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-[0.18em] text-foreground uppercase leading-none">Lumière<span className="text-primary">OS</span></span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground mt-1">Gestão inteligente</span>
          </div>
        </Link>
      </div>

      <div className="flex-1 py-5 px-3 space-y-5 overflow-y-auto">
        {navigation.map((category) => (
          <div key={category.category} className="space-y-1.5">
            <span className="px-3 text-[9px] uppercase tracking-[0.16em] font-bold text-muted-foreground block select-none">{category.category}</span>
            <div className="space-y-0.5">
              {category.items.map((item) => {
                const isActive = item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href);
                return (
                  <Link key={item.name} to={item.href} className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 border',
                    isActive ? 'bg-accent text-accent-foreground border-primary/20 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent'
                  )}>
                    <item.icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {isPlatformAdmin && (
          <Link to="/master" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-accent-foreground bg-accent hover:bg-primary/15 border border-primary/20 transition-colors">
            <Settings className="w-4 h-4" />
            Painel Master
          </Link>
        )}

        <div className="pt-1"><DashboardLumiWidget /></div>

        <div className="px-2 flex flex-col gap-2">
          <PWAInstallButton />
          <div className="mt-1 px-3 py-3 bg-secondary/70 border border-border rounded-xl text-center flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground select-none justify-center">
              <span>LumiereOS</span> • <span className="font-semibold text-primary">v{APP_INFO.version}</span>
              {hasNewVersionNotice && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" /></span>}
            </div>
            <button onClick={onOpenUpdates} className="text-[9px] tracking-wider uppercase font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer focus:outline-none">
              <Sparkles className="w-3 h-3" /> O que há de novo?
            </button>
            <p className="text-[9px] text-muted-foreground leading-tight mt-1 select-none">© Galiciori e Fonseca</p>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-accent border border-primary/20 flex items-center justify-center text-primary font-bold">{userData?.fullName?.charAt(0).toUpperCase()}</div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{userData?.fullName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground border border-primary/15 font-semibold uppercase tracking-wider whitespace-nowrap">{userData?.role === 'owner' ? 'Proprietário' : userData?.role === 'manager' ? 'Gerente' : userData?.role === 'receptionist' ? 'Recepcionista' : userData?.role === 'attendant' ? 'Atendente' : userData?.role === 'professional' ? 'Profissional' : userData?.role || 'Usuário'}</span>
              <span className="text-[9px] text-muted-foreground truncate">{isPlatformAdmin ? 'Admin Global' : (salonData?.name || 'Sem salão')}</span>
            </div>
          </div>
        </div>
        <BugReportDialog />
        {userData && <Button variant="ghost" disabled={userData.status === 'deletion_requested'} className="w-full justify-start text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg mt-1 text-xs h-9" onClick={onOpenDeletionModal}><UserX className="w-4 h-4 mr-2" />{userData.status === 'deletion_requested' ? 'Exclusão Solicitada' : 'Solicitar Exclusão da Conta'}</Button>}
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg mt-1 text-xs h-9" onClick={logout}><LogOut className="w-4 h-4 mr-2" />Sair</Button>
      </div>
    </aside>
  );
}

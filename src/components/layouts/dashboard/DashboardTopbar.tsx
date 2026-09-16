import { useAuth } from '../../../contexts/AuthContext';
import { Menu, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardUserMenu } from './DashboardUserMenu';
import { DashboardNotifications } from './DashboardNotifications';
import { DashboardBreadcrumbs } from './DashboardBreadcrumbs';
import { DashboardQuickActions } from './DashboardQuickActions';
import { NavigationCategory } from './getNavigationByRole';

interface DashboardTopbarProps {
  onOpenMobileMenu: () => void;
  onOpenGuide: () => void;
  onOpenRoadmap: () => void;
  onOpenFounderDetail: () => void;
  onOpenUpdates: () => void;
  navigation: NavigationCategory[];
}

export function DashboardTopbar({ onOpenMobileMenu, onOpenGuide, onOpenRoadmap, onOpenFounderDetail, onOpenUpdates, navigation }: DashboardTopbarProps) {
  const { salonData, isPlatformAdmin } = useAuth();
  const planName = isPlatformAdmin ? 'MASTER' : (salonData?.plan === 'founder' ? 'FOUNDER' : (salonData?.plan || 'Premium'));
  const getStatusText = () => {
    if (isPlatformAdmin) return 'ativo';
    if (salonData?.subscriptionStatus === 'preview') return 'Garantia de 7 dias pela Asaas';
    if (salonData?.subscriptionStatus === 'active') return 'ativo';
    return 'pendente';
  };

  return (
    <header className="h-16 md:h-20 border-b border-border/80 bg-card/90 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
      <div className="flex items-center gap-3.5 md:hidden">
        <button onClick={onOpenMobileMenu} className="p-2 rounded-lg border border-border bg-secondary hover:border-primary/30 transition-colors">
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-primary" />
          <span className="font-bold tracking-[0.16em] text-primary text-sm uppercase leading-none">Lumiere<span className="text-foreground">OS</span></span>
        </div>
      </div>

      <div className="hidden md:flex items-center"><DashboardBreadcrumbs navigation={navigation} /></div>

      <div className="flex items-center gap-2 md:gap-3">
        <DashboardQuickActions onOpenGuide={onOpenGuide} onOpenRoadmap={onOpenRoadmap} />
        <DashboardNotifications />
        <DashboardUserMenu onOpenUpdates={onOpenUpdates} />
        <button onClick={() => salonData?.plan === 'founder' && onOpenFounderDetail()} className={cn(
          'hidden sm:flex items-center h-8.5 px-3 py-1 bg-secondary/70 rounded-lg border border-border text-[10px] text-muted-foreground whitespace-nowrap text-left transition-colors',
          salonData?.plan === 'founder' ? 'hover:bg-accent hover:border-primary/30 cursor-pointer' : 'cursor-default'
        )}>
          <span className="uppercase tracking-wider mr-2 font-bold text-primary">{planName}</span>
          <span className="opacity-40 mr-2">|</span><span>Status:</span>
          <span className={cn('ml-1 font-semibold capitalize', isPlatformAdmin || salonData?.subscriptionStatus === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary')}>{getStatusText()}</span>
          {salonData?.plan === 'founder' && !isPlatformAdmin && <Sparkles className="w-3.5 h-3.5 text-primary ml-1.5 animate-pulse shrink-0" />}
        </button>
      </div>
    </header>
  );
}

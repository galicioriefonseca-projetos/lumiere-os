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

export function DashboardTopbar({
  onOpenMobileMenu,
  onOpenGuide,
  onOpenRoadmap,
  onOpenFounderDetail,
  onOpenUpdates,
  navigation
}: DashboardTopbarProps) {
  const { salonData, isPlatformAdmin } = useAuth();

  const planName = isPlatformAdmin ? 'MASTER' : (salonData?.plan === 'founder' ? 'FOUNDER' : (salonData?.plan || 'Premium'));
  
  const getStatusText = () => {
    if (isPlatformAdmin) return 'ativo';
    if (salonData?.subscriptionStatus === 'preview') return 'Garantia de 7 dias pela Cakto';
    if (salonData?.subscriptionStatus === 'active') return 'ativo';
    return 'pendente';
  };

  return (
    <header className="h-16 md:h-20 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
      {/* Mobile view topbar items */}
      <div className="flex items-center gap-3.5 md:hidden">
        <button 
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-[#D4AF37]/30 transition-all duration-200"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-[#D4AF37]" />
          <span className="font-sans font-bold tracking-widest text-[#D4AF37] text-sm uppercase leading-none">
            Lumiere<span className="text-white">OS</span>
          </span>
        </div>
      </div>
      
      {/* Desktop view page breadcrumbs */}
      <div className="hidden md:flex items-center">
        <DashboardBreadcrumbs navigation={navigation} />
      </div>
      
      {/* Topbar Actions Group */}
      <div className="flex items-center gap-3">
        {/* Quick Actions (WhatsApp badge, Guide trigger, Roadmap trigger) */}
        <DashboardQuickActions 
          onOpenGuide={onOpenGuide}
          onOpenRoadmap={onOpenRoadmap}
        />

        {/* Custom Notifications Bell dropdown */}
        <DashboardNotifications />

        {/* User Account Menu dropdown */}
        <DashboardUserMenu onOpenUpdates={onOpenUpdates} />

        {/* Active plan and billing/warranty status badge */}
        <button
          onClick={() => {
            if (salonData?.plan === 'founder') {
              onOpenFounderDetail();
            }
          }}
          className={cn(
            "hidden sm:flex items-center h-8.5 px-3 py-1 bg-white/[0.02] rounded-xl border border-white/10 text-[11px] text-muted-foreground whitespace-nowrap text-left transition-all",
            salonData?.plan === 'founder' ? "hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/35 cursor-pointer text-[#D4AF37]" : "cursor-default"
          )}
        >
          <span className="uppercase tracking-wider mr-2 font-bold text-[#D4AF37]">{planName}</span> 
          <span className="opacity-40 mr-2">|</span>
          <span>Status:</span>
          <span className={cn(
            "ml-1 font-semibold capitalize",
            isPlatformAdmin || salonData?.subscriptionStatus === 'active' ? "text-green-400" : "text-[#D4AF37]"
          )}>
            {getStatusText()}
          </span>
          {salonData?.plan === 'founder' && !isPlatformAdmin && (
            <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-1.5 animate-pulse shrink-0 font-bold" />
          )}
        </button>
      </div>
    </header>
  );
}

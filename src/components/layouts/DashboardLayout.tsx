import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  Scissors, 
  CalendarDays, 
  Target, 
  CheckSquare, 
  Settings, 
  LogOut,
  Sparkles,
  Menu,
  X,
  CreditCard,
  HelpCircle,
  FileText,
  TrendingUp,
  Star,
  Crown,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  UserX,
  Loader2
} from 'lucide-react';
import { BugReportDialog } from '../BugReportDialog';
import { Button } from '@/components/ui/button';
import PWAInstallButton from '../PWAInstallButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { APP_INFO } from '../../config/appInfo';
import SystemUpdatesDialog from '../SystemUpdatesDialog';
import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export default function DashboardLayout() {
  const { userData, salonData, isPlatformAdmin, logout, currentUser } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isFounderDetailOpen, setIsFounderDetailOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isSubmittingSubscription, setIsSubmittingSubscription] = useState(false);
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);
  const [isUpdatesDialogOpen, setIsUpdatesDialogOpen] = useState(false);
  const [hasNewVersionNotice, setHasNewVersionNotice] = useState(false);
  const [isDeletionRequestedOpen, setIsDeletionRequestedOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleRequestDeletion = async () => {
    if (!currentUser) {
      toast.error("Você precisa estar autenticado.");
      return;
    }
    setIsDeletingAccount(true);
    try {
      const now = Date.now();
      const uid = currentUser.uid;

      // Update Root `/users/{uid}`
      await updateDoc(doc(db, 'users', uid), {
        accountDeletionRequested: true,
        accountDeletionRequestedAt: now,
        status: 'deletion_requested'
      });

      // Update Subcollection `salons/{salonId}/professionals/{uid}` (if salonId exists)
      if (userData?.salonId) {
        try {
          await updateDoc(doc(db, `salons/${userData.salonId}/professionals`, uid), {
            accountDeletionRequested: true,
            status: 'deletion_requested',
            updatedAt: now
          });
        } catch (subErr) {
          console.log("Professional subcollection update omitted (could be non-professional owner).", subErr);
        }
      }

      toast.success("Solicitação de exclusão enviada com sucesso! Um administrador revisará o pedido.");
      setIsDeletionRequestedOpen(false);
    } catch (err: any) {
      console.error("Erro ao solicitar exclusão:", err);
      toast.error("Erro ao registrar solicitação: " + (err.message || ''));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('lumiere_last_seen_version');
    if (lastSeenVersion !== APP_INFO.version) {
      setHasNewVersionNotice(true);
    }
  }, []);

  // Trial ending check logic
  const trialEndsAt = salonData?.trialEndsAt || 0;
  const now = Date.now();
  const timeLeftMs = trialEndsAt - now;
  const daysLeftDecimal = timeLeftMs / (1000 * 60 * 60 * 24);
  const isTrialEndingSoon = 
    salonData?.subscriptionStatus === 'trial' && 
    !isPlatformAdmin && 
    trialEndsAt > 0 && 
    daysLeftDecimal <= 3;

  // Text representation of time left
  const getTrialDaysMessage = () => {
    if (timeLeftMs <= 0) {
      return "Expirado";
    }
    const days = Math.floor(daysLeftDecimal);
    const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days === 0) {
      if (hours === 0) {
        return "menos de 1 hora";
      }
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
    
    return `${days} ${days === 1 ? 'dia' : 'dias'}${hours > 0 ? ` e ${hours} ${hours === 1 ? 'hora' : 'horas'}` : ''}`;
  };

  const timeLeftFormatted = getTrialDaysMessage();

  // Role based navigation rendering
  const getNavigationByRole = (role: string | undefined) => {
    if (role === 'professional') {
      return [
        { name: 'Meu Painel', href: '/dashboard', icon: LayoutDashboard, exact: true },
        { name: 'Minha Agenda', href: '/dashboard?tab=agenda', icon: CalendarDays },
        { name: 'Meu Desempenho', href: '/dashboard?tab=desempenho', icon: TrendingUp },
        { name: 'Minhas Avaliações', href: '/dashboard?tab=avaliacoes', icon: Star },
        { name: 'Minhas Metas', href: '/dashboard?tab=metas', icon: Target },
      ];
    }
    
    if (role === 'attendant' || role === 'receptionist') {
      return [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
        { name: 'Agenda', href: '/dashboard/agendamentos', icon: CalendarDays },
        { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
        { name: 'Serviços', href: '/dashboard/servicos', icon: Scissors },
      ];
    }

    if (role === 'platform_admin') {
      return [
        { name: 'Painel Master', href: '/master', icon: Settings, exact: true },
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
      ];
    }

    // Default for Owner or Manager
    return [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
      { name: 'Agenda', href: '/dashboard/agendamentos', icon: CalendarDays },
      { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
      { name: 'Profissionais', href: '/dashboard/equipe', icon: Users },
      { name: 'Serviços', href: '/dashboard/servicos', icon: Scissors },
      { name: 'Checklist', href: '/dashboard/checklist', icon: CheckSquare },
      { name: 'Metas', href: '/dashboard/metas', icon: Target },
    ];
  };

  const navigation = getNavigationByRole(userData?.role);

  return (
    <div className="min-h-screen bg-[#050505] flex text-white font-sans antialiased">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#D4AF37]/10 bg-[#09090b] relative z-20">
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
        
        <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.href 
              : location.pathname.startsWith(item.href);
              
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 border",
                  isActive 
                    ? "bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20 shadow-[0_0_15px_rgba(212,175,55,0.03)]" 
                    : "text-muted-foreground hover:text-white hover:bg-white/[0.03] border-transparent"
                )}
              >
                <item.icon className={cn("w-4.5 h-4.5 transition-colors", isActive ? "text-[#D4AF37]" : "text-muted-foreground group-hover:text-white")} />
                {item.name}
              </Link>
            )
          })}
          
          {isPlatformAdmin && (
            <Link
              to="/master"
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 mt-6 text-[#D4AF37] bg-[#D4AF37]/5 hover:bg-[#D4AF37]/15 border border-[#D4AF37]/25 shadow-[0_0_15px_rgba(212,175,55,0.06)]"
            >
              <Settings className="w-4.5 h-4.5" />
              Painel Master
            </Link>
          )}
          
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
                 onClick={() => setIsUpdatesDialogOpen(true)}
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
              onClick={() => setIsDeletionRequestedOpen(true)}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
        <header className="h-16 md:h-20 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3.5 md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:border-[#D4AF37]/30 transition-all duration-200"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-[#D4AF37]" />
              <span className="font-sans font-bold tracking-widest text-[#D4AF37] text-sm uppercase leading-none">Lumiere<span className="text-white">OS</span></span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center">
            <h1 className="text-lg font-medium text-white flex items-center gap-2 font-heading">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              {navigation.find(n => n.exact ? location.pathname === n.href : location.pathname.startsWith(n.href))?.name || 'Dashboard'}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Guia do Sistema Button */}
             <Button
               size="sm"
               variant="outline"
               onClick={() => setIsGuideOpen(true)}
               className="text-xs h-8.5 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all font-semibold rounded-xl bg-white/[0.02] flex items-center gap-1.5 shrink-0 px-3"
             >
               <HelpCircle className="w-4 h-4 text-[#D4AF37]" />
               <span className="hidden sm:inline">Guia do Sistema</span>
               <span className="sm:hidden">Ajuda</span>
             </Button>

             {/* Próximas Atualizações Button */}
             <Button
               size="sm"
               variant="outline"
               onClick={() => setIsRoadmapOpen(true)}
               className="text-xs h-8.5 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all font-semibold rounded-xl bg-white/[0.02] flex items-center gap-1.5 shrink-0 px-3"
             >
               <Sparkles className="w-4 h-4 text-[#D4AF37]" />
               <span className="hidden sm:inline">Próximas Atualizações</span>
               <span className="sm:hidden">Roadmap</span>
             </Button>

             {/* Plan badge */}
             <button
               onClick={() => {
                 if (salonData?.plan === 'founder') {
                   setIsFounderDetailOpen(true);
                 }
               }}
               className={cn(
                 "hidden sm:flex items-center h-8.5 px-3 py-1 bg-white/[0.02] rounded-xl border border-white/10 text-[11px] text-muted-foreground whitespace-nowrap text-left transition-all",
                 salonData?.plan === 'founder' ? "hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/35 cursor-pointer text-[#D4AF37]" : "cursor-default"
               )}
             >
               <span className="uppercase tracking-wider mr-2 font-bold text-[#D4AF37]">{isPlatformAdmin ? 'MASTER' : (salonData?.plan === 'founder' ? 'FOUNDER' : salonData?.plan)}</span> 
               <span className="opacity-40 mr-2">|</span>
               <span>Status:</span>
               <span className={cn(
                 "ml-1 font-semibold capitalize",
                 isPlatformAdmin || salonData?.subscriptionStatus === 'active' ? "text-green-400" : "text-[#D4AF37]"
               )}>
                 {isPlatformAdmin ? 'ativo' : (salonData?.subscriptionStatus === 'trial' ? 'teste' : (salonData?.subscriptionStatus === 'active' ? 'ativo' : 'pendente'))}
               </span>
               {salonData?.plan === 'founder' && !isPlatformAdmin && (
                 <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-1.5 animate-pulse shrink-0 font-bold" />
               )}
             </button>
          </div>
        </header>

        {isTrialEndingSoon && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 md:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left font-sans">
            <div className="flex items-start gap-2.5 text-[#D4AF37]">
              <AlertTriangle className="w-4 h-4 text-[#D4AF37] mt-0.5 shrink-0 animate-pulse" />
              <div className="space-y-0.5">
                <span className="font-semibold text-xs text-[#D4AF37] block">Atenção • Seu teste expira em breve</span>
                <span className="text-[11.5px] text-zinc-300 leading-relaxed font-light">
                  Seu período de testes premium expira em <span className="font-semibold text-[#D4AF37]">{timeLeftFormatted}</span>. Faça o upgrade agora para garantir acesso contínuo aos recursos do LumiereOS sem interrupções!
                </span>
              </div>
            </div>
            <Button 
              size="xs" 
              onClick={() => setIsUpgradeModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-[11px] h-8 px-4 shrink-0 transition-all font-sans cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Fazer Upgrade
            </Button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {salonData?.subscriptionStatus === 'trial' && !isPlatformAdmin && (
             <div className={cn(
               "mb-6 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300",
               isTrialEndingSoon 
                 ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 shadow-[0_0_25px_rgba(245,158,11,0.06)]"
                 : "bg-gradient-to-r from-[#D4AF37]/15 to-transparent border border-[#D4AF37]/25 shadow-[0_0_20px_rgba(212,175,55,0.03)]"
             )}>
                <div className="text-center sm:text-left">
                   <h4 className={cn(
                     "font-semibold flex items-center justify-center sm:justify-start gap-2 text-sm leading-none",
                     isTrialEndingSoon ? "text-[#f59e0b]" : "text-[#D4AF37]"
                   )}>
                     {isTrialEndingSoon ? (
                       <>
                         <AlertTriangle className="w-4.5 h-4.5 animate-bounce text-amber-400" />
                         Seu Período de Testes Expirará em breve!
                       </>
                     ) : (
                       <>
                         <Sparkles className="w-4 h-4 animate-pulse" />
                         Você está no Período de Testes
                       </>
                     )}
                   </h4>
                   <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-light">
                     {isTrialEndingSoon ? (
                       <>
                         Ative sua assinatura agora para evitar interrupções. Restam apenas <span className="font-semibold text-amber-400">{timeLeftFormatted}</span> de uso gratuito do plano <b className="text-white capitalize">{salonData.plan}</b>.
                       </>
                     ) : (
                       <>
                         Aproveite todos os recursos premium do plano <b className="text-white capitalize">{salonData.plan}</b> gratuitamente.
                       </>
                     )}
                   </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className={cn(
                    "font-semibold rounded-xl text-xs h-9.5 px-4 shrink-0 transition-all shadow-[0_4px_15px_rgba(212,175,55,0.15)]",
                    isTrialEndingSoon 
                      ? "bg-[#e0a82e] hover:bg-[#c99522] text-black border border-[#e0a82e]/20" 
                      : "bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black border border-[#D4AF37]/20"
                  )}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Assinar Agora
                </Button>
             </div>
          )}
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Slide-over Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Slider Container */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#09090b] border-r border-[#D4AF37]/10 flex flex-col z-50 animate-in slide-in-from-left duration-200">
            <div className="h-16 flex items-center justify-between px-5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#D4AF37] filter drop-shadow-[0_0_4px_rgba(212,175,55,0.3)]" />
                <span className="text-sm font-bold tracking-widest text-[#D4AF37] uppercase font-sans">Lumière<span className="text-white">OS</span></span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-[#D4AF37] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 py-5 px-4 space-y-1.5 overflow-y-auto">
              <div className="mb-5 flex flex-col gap-2">
                 <Button 
                   onClick={() => { setIsMobileMenuOpen(false); setIsGuideOpen(true); }}
                   variant="outline"
                   className="w-full text-[#D4AF37] border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 bg-white/[0.02]"
                 >
                   <HelpCircle className="w-4 h-4" /> Guia do Sistema
                 </Button>
                 <Button 
                   onClick={() => { setIsMobileMenuOpen(false); setIsRoadmapOpen(true); }}
                   variant="outline"
                   className="w-full text-[#D4AF37] border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 bg-white/[0.02]"
                 >
                   <Sparkles className="w-4 h-4" /> Próximas Atualizações
                 </Button>
              </div>
              
              {navigation.map((item) => {
                const isActive = item.exact 
                  ? location.pathname === item.href 
                  : location.pathname.startsWith(item.href);
                  
                return (
                  <Link 
                    key={item.name} 
                    to={item.href} 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 border",
                      isActive 
                        ? "bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20" 
                        : "text-muted-foreground hover:text-white hover:bg-white/[0.02] border-transparent"
                    )}
                  >
                    <item.icon className={cn("w-4.5 h-4.5", isActive ? "text-[#D4AF37]" : "text-muted-foreground")} /> {item.name}
                  </Link>
                );
              })}
              
              {isPlatformAdmin && (
                <Link
                  to="/master"
                  onClick={() => setIsMobileMenuOpen(false)}
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
                       setIsMobileMenuOpen(false);
                       setIsUpdatesDialogOpen(true);
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
                  onClick={() => { setIsMobileMenuOpen(false); setIsDeletionRequestedOpen(true); }}
                >
                  <UserX className="w-4 h-4 mr-2" />
                  {userData.status === 'deletion_requested' ? 'Exclusão Solicitada' : 'Solicitar Exclusão da Conta'}
                </Button>
              )}
              <Button 
                variant="ghost" 
                className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl text-xs h-9 px-3" 
                onClick={() => { setIsMobileMenuOpen(false); logout(); }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da Conta
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Guia do Sistema Modal */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-4xl bg-[#09090b]/98 border border-white/10 text-white rounded-3xl shadow-2xl backdrop-blur-xl max-h-[85vh] overflow-y-auto w-[94vw] sm:w-[90vw]">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="text-xl md:text-2xl font-heading font-light tracking-tight text-white flex items-center gap-2">
              <Crown className="w-5 md:w-6 h-5 md:h-6 text-[#D4AF37] animate-pulse" /> Guia do Sistema LumiereOS
            </DialogTitle>
            <p className="text-[#a1a1aa] text-xs font-light mt-1">
              Descubra como aproveitar ao máximo cada módulo do seu sistema operacional de salão de beleza premium.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 font-sans max-h-[50vh] overflow-y-auto pr-2">
            {/* Dashboard */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <LayoutDashboard className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Dashboard</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Visão geral do salão, metas, agenda, checklist do dia e indicadores principais. Monitore as métricas vitais da sua operação em tempo real.
                </p>
              </div>
            </div>

            {/* Agenda */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <CalendarDays className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Agenda</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Controle dos atendimentos, horários, clientes, serviços e profissionais. Permite agendar rapidamente e visualizar os compromissos diários ou semanais.
                </p>
              </div>
            </div>

            {/* Clientes */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <Users className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Clientes</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro e histórico básico dos clientes. Acompanhe quem são seus clientes mais fiéis, suas preferências e histórico completo de visitas.
                </p>
              </div>
            </div>

            {/* Profissionais */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <Users className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Profissionais</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro da equipe, funções, status e informações operacionais. Gerencie o time e acompanhe a disponibilidade de cada parceiro do salão.
                </p>
              </div>
            </div>

            {/* Serviços */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <Scissors className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Serviços e Categorias</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro dos serviços, preços, duração e categorias. Organize seu catálogo de atendimentos com precisão para facilitar os agendamentos.
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <CheckSquare className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Checklist</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Rotinas operacionais e Avaliação Diária da Equipe (Módulo Essenza). Garanta a conformidade da abertura/fechamento e avalie diariamente sua equipe.
                </p>
              </div>
            </div>

            {/* Metas */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <Target className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Metas</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Acompanhamento da meta mensal e progresso financeiro. Defina objetivos claros de faturamento e veja o progresso de vendas do estabelecimento.
                </p>
              </div>
            </div>

            {/* Relatórios */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <FileText className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Relatórios</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Consulta de histórico de avaliações, notas consolidadas da equipe e exportação de rotinas diárias e avaliações Essenza em formato PDF de alta qualidade.
                </p>
              </div>
            </div>

            {/* Painel Master */}
            {isPlatformAdmin && (
              <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/35 transition-all md:col-span-2">
                <div className="p-2 h-max rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/30 shrink-0">
                  <Settings className="w-4.5 h-4.5 text-[#D4AF37]" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Painel Master</h4>
                    <span className="text-[8px] bg-[#D4AF37] text-black font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-widest">Apenas Admin</span>
                  </div>
                  <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                    Área administrativa exclusiva de nível de plataforma. Permite gerenciar salões afiliados, planos, visualizações financeiras e o suporte geral do ecossistema LumiereOS.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
            <Button onClick={() => setIsGuideOpen(false)} className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold rounded-xl text-xs px-5 h-9">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detalhes do Plano Founder Dialog */}
      <Dialog open={isFounderDetailOpen} onOpenChange={setIsFounderDetailOpen}>
        <DialogContent className="max-w-md bg-[#09090b]/98 border border-amber-500/30 text-white rounded-3xl shadow-2xl backdrop-blur-xl w-[94vw] sm:w-full">
          <DialogHeader className="border-b border-white/5 pb-4 text-left">
            <DialogTitle className="text-lg md:text-xl font-heading font-medium text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#D4AF37] filter drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]" /> Plano Founder • Detalhes
            </DialogTitle>
            <p className="text-[#a1a1aa] text-xs font-light mt-1">
              Informações contratuais e níveis de privilégio da sua conta de co-criador piloto.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-4 font-sans text-left">
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Membro Founder Piloto
                </span>
                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wider border",
                  salonData?.subscriptionStatus === 'active' 
                    ? "bg-green-500/25 border-green-500/45 text-green-400" 
                    : (salonData?.subscriptionStatus === 'trial' ? "bg-amber-500/25 border-amber-500/45 text-amber-400" : "bg-red-500/25 border-red-500/45 text-red-400")
                )}>
                  CONTRATO: {salonData?.subscriptionStatus === 'trial' ? 'teste' : (salonData?.subscriptionStatus === 'active' ? 'ativo' : 'pendente')}
                </span>
              </div>
              <h4 className="font-semibold text-white text-sm leading-snug">
                Plano Founder Ativo ({salonData?.name || 'Seu Salão'})
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Como contratante do plano Founder piloto, seu estabelecimento possui acesso completo, ilimitado e prioritário a todas as funcionalidades presentes e futuras do LumiereOS.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2.5">
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Plano Especial:</span>
                <strong className="text-white">Piloto (Co-criador)</strong>
              </div>
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Atualizações do Sistema:</span>
                <strong className="text-[#D4AF37]">Inclusas / Vitalícias</strong>
              </div>
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Acesso a relatórios:</span>
                <strong className="text-green-400">Liberado</strong>
              </div>
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Checklist Essenza:</span>
                <strong className="text-[#D4AF37]">Ilimitado</strong>
              </div>
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Metas & Equipes:</span>
                <strong className="text-white">Liberadas</strong>
              </div>
            </div>

            <div className="text-[11px] text-amber-400 font-mono flex items-center justify-center gap-1.5 leading-none bg-amber-500/5 py-2.5 rounded-xl border border-amber-500/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Atualizações futuras totalmente inclusas
            </div>
          </div>

          <div className="flex justify-end pt-2 mt-2">
            <Button onClick={() => setIsFounderDetailOpen(false)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-xs px-5 h-9">
              Fechar Detalhes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade / Assinatura de Plano Dialog */}
      <Dialog open={isUpgradeModalOpen} onOpenChange={(open) => {
        setIsUpgradeModalOpen(open);
        if (!open) setSubscriptionSuccess(false);
      }}>
        <DialogContent className="max-w-xl bg-[#09090b]/98 border border-white/10 text-white rounded-3xl shadow-2xl backdrop-blur-xl w-[94vw] sm:w-full overflow-hidden">
          <button 
            onClick={() => {
              setIsUpgradeModalOpen(false);
              setSubscriptionSuccess(false);
            }} 
            className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full transition-colors bg-white/5 z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {!subscriptionSuccess ? (
            <div className="space-y-5 text-left p-2">
              <div className="border-b border-white/5 pb-4">
                <DialogHeader>
                  <DialogTitle className="text-xl font-heading font-medium text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-[#D4AF37]" /> Upgrade de Conta Premium
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-400">
                    Ative o LumiereOS no seu salão e garanta a produtividade máxima de toda a sua equipe.
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Special pilot founder banner if that's their plan */}
              {salonData?.plan === 'founder' ? (
                <div className="bg-gradient-to-br from-[#D4AF37]/15 to-transparent border border-[#D4AF37]/35 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#D4AF37] font-semibold tracking-wider uppercase font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> Oferta Founder Ativa
                  </div>
                  <h4 className="text-sm font-semibold text-white">Plano Especial Piloto (Founder)</h4>
                  <p className="text-[11.5px] text-zinc-300 font-light leading-relaxed">
                    Você possui uma condição exclusiva por tempo limitado de co-criador. Garanta todas as ferramentas e integrações futuras liberando seu acesso completo.
                  </p>
                  <div className="border-t border-white/5 pt-2 flex items-center justify-between text-xs mt-1">
                    <span className="text-zinc-400">Mensalidade especial:</span>
                    <span className="font-semibold text-[#D4AF37]">R$ 297,00/mês nos primeiros 90 dias</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Início da recorrência regular (Studio):</span>
                    <span>R$ 397,00/mês após este período</span>
                  </div>
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-primary/10 border border-primary/25 text-primary font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wider">Plano Atual: <b className="uppercase">{salonData?.plan}</b></span>
                    <h4 className="text-sm font-semibold text-white">LumiereOS Premium</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-400">Plano contratado:</span>
                    <p className="text-lg font-bold text-white capitalize">{salonData?.plan}</p>
                  </div>
                </div>
              )}

              {/* Credit card input mockup for simulation */}
              <div className="space-y-3.5 bg-black/40 border border-white/5 p-4 rounded-2xl">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-zinc-400" /> Método de Pagamento (Simulação)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Número do Cartão</label>
                    <input 
                      disabled 
                      value="•••• •••• •••• 4242" 
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Nome no Cartão</label>
                    <input 
                      disabled 
                      value={userData?.fullName || "Proprietário do Salão"} 
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 font-light leading-relaxed">
                  Para fins desta demonstração/piloto, o processo de faturamento é totalmente simulado e nenhum valor real será cobrado de sua conta.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button 
                  onClick={() => setIsUpgradeModalOpen(false)} 
                  variant="outline" 
                  className="border-white/10 text-zinc-400 hover:text-white rounded-xl text-xs h-9.5 px-4 bg-transparent"
                >
                  Continuar Testando
                </Button>
                <Button 
                  disabled={isSubmittingSubscription}
                  onClick={async () => {
                    setIsSubmittingSubscription(true);
                    // Simulate API network call
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    setIsSubmittingSubscription(false);
                    setSubscriptionSuccess(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-xs h-9.5 px-5 flex items-center gap-1.5"
                >
                  {isSubmittingSubscription ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin h-3.5 w-3.5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Processando...
                    </span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      Confirmar Assinatura
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 px-4 text-center space-y-4 font-sans flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-green-500/25 border border-green-500/40 text-green-400 flex items-center justify-center mb-1">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-medium text-white font-heading">Assinatura Ativada com Sucesso!</h3>
              <p className="text-xs text-zinc-300 font-light max-w-sm leading-relaxed mx-auto">
                Parabéns! Sua simulação de upgrade foi concluído. Em uma operação de produção, o sistema do LumiereOS ativa o salão instantaneamente ao constatar o pagamento via Gateway.
              </p>
              <p className="text-[11px] text-amber-400 bg-amber-500/5 px-3 py-2 rounded-xl border border-amber-500/10 font-mono inline-block">
                Contrato ativo e integrado em modo Piloto!
              </p>
              <div className="pt-2">
                <Button 
                  onClick={() => {
                    setIsUpgradeModalOpen(false);
                    setSubscriptionSuccess(false);
                  }}
                  className="bg-green-500 hover:bg-green-600 text-black font-semibold rounded-xl text-xs h-9.5 px-6"
                >
                  Retornar ao Painel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Próximas Atualizações / Roadmap Dialog */}
      <Dialog open={isRoadmapOpen} onOpenChange={setIsRoadmapOpen}>
        <DialogContent className="max-w-xl bg-[#09090b]/98 border border-white/10 text-white rounded-3xl shadow-2xl backdrop-blur-xl w-[94vw] sm:w-full overflow-hidden max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-white/5 pb-4 text-left">
            <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-widest bg-[#D4AF37]/10 px-2.5 py-1 rounded-full w-max flex items-center gap-1.5 font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Evolução & Visão Futura
            </span>
            <DialogTitle className="text-lg md:text-xl font-heading font-medium text-white flex items-center gap-2">
              LumièreOS • Próximas Atualizações
            </DialogTitle>
            <p className="text-[#a1a1aa] text-xs font-light mt-1">
              Descubra os novos módulos e recursos comerciais planejados para elevar o prestígio e eficiência do seu salão de beleza premium.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-4 font-sans text-left">
            {/* Item 1 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-primary/10 border border-primary/20 shrink-0 text-primary">
                <CalendarDays className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">1. Integração com Google Agenda</h4>
                  <span className="text-[9px] bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[#D4AF37] px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">Fase 1</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Sincronização futura dos agendamentos do salão. Conecte de forma transparente as agendas dos seus profissionais com os calendários móveis pessoais, eliminando conflitos de horários de forma totalmente automática.
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-primary/10 border border-primary/20 shrink-0 text-primary">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">2. Relatórios Exportáveis</h4>
                  <span className="text-[9px] bg-zinc-500/15 border border-zinc-500/25 text-zinc-400 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">Fase 2</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Exportação futura para planilhas e relatórios gerenciais estruturados. Tenha em mãos dados estruturados para otimizar auditorias contábeis, cálculo de comissões e consolidação financeira do salão em instantes.
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-primary/10 border border-primary/20 shrink-0 text-primary">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">3. Assistente Inteligente LumiereOS</h4>
                  <span className="text-[9px] bg-amber-500/15 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">Fase Assessor</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Futuro assistente nativo para orientar o uso do sistema e gerar insights valiosos do negócio. Otimize o treinamento de novos funcionários e domine todo o potencial do ecossistema LumiereOS sem fricção.
                </p>
              </div>
            </div>

            {/* Item 4 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-primary/10 border border-primary/20 shrink-0 text-primary">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">4. Insights de Desempenho</h4>
                  <span className="text-[9px] bg-zinc-500/15 border border-zinc-500/25 text-zinc-400 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">Planejado</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Análise futura profunda de equipe, metas, checklists de qualidade e produtividade integrada. Monitore taxas de ociosidade e desempenho técnico de forma de inteligência, gerando planos de ação certeiros.
                </p>
              </div>
            </div>

            {/* Item 5 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-primary/10 border border-primary/20 shrink-0 text-primary">
                <Inbox className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">5. Relatórios Automáticos</h4>
                  <span className="text-[9px] bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[#D4AF37] px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold font-sans">Em Roadmap</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Envio futuro de resumos semanais/mensais de métricas de faturamento e taxas de retenção. Mantenha os sócios ou gestores integrados ao progresso do negócio diretamente por canais de comunicação corporativa.
                </p>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 font-light text-center leading-relaxed font-sans pt-1">
              * Nota: Os recursos listados acima representam a nossa visão de evolução contínua da experiência LumiereOS e serão disponibilizados em atualizações futuras sem alteração na mensalidade dos membros pioneiros.
            </p>
          </div>

          <div className="flex justify-end pt-2 mt-4 border-t border-white/5">
            <Button onClick={() => setIsRoadmapOpen(false)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-xs px-5 h-9">
              Excelente, Entendido!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SystemUpdatesDialog 
        isOpen={isUpdatesDialogOpen} 
        onClose={() => setIsUpdatesDialogOpen(false)}
        onMarkAsSeen={() => setHasNewVersionNotice(false)}
      />

      {/* Account Deletion Request Dialog */}
      <Dialog open={isDeletionRequestedOpen} onOpenChange={setIsDeletionRequestedOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="font-heading font-normal flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Solicitar Exclusão de Conta
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Entenda como funciona o desligamento e a retenção histórica no LumiereOS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-3 text-xs leading-relaxed text-zinc-300">
            <p className="font-light">
              Ao confirmar, sua solicitação de exclusão de conta será encaminhada para análise e revisão dos proprietários do salão ou administradores da plataforma.
            </p>
            <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl text-red-200 text-[11px] font-medium leading-relaxed">
              <strong>Importante:</strong> Seus dados operacionais (como histórico de agendamentos realizados, comissões faturadas, respostas a checklists de qualidade Essenza e feedback dos clientes) <strong>नहीं serão excluídos de forma definitiva automaticamente</strong> para manter a consistência contábil, integridade operacional e relatórios gerenciais do salão.
            </div>
            <p className="text-[11px] text-zinc-400 font-light">
              Sua conta receberá o status <strong>"Exclusão Solicitada"</strong> e seu login poderá ser bloqueado ou suspenso durante a análise. Deseja prosseguir?
            </p>
          </div>

          <DialogFooter className="flex sm:flex-row justify-end gap-2 pt-4 border-t border-white/5 mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeletionRequestedOpen(false)}
              className="rounded-xl border-white/10 text-white hover:bg-white/5 h-10 px-4 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isDeletingAccount}
              onClick={handleRequestDeletion}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl h-10 px-4 text-xs flex items-center justify-center gap-1.5"
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Solicitação'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

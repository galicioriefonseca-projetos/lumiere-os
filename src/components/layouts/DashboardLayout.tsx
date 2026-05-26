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
  Crown
} from 'lucide-react';
import { BugReportDialog } from '../BugReportDialog';
import { Button } from '@/components/ui/button';
import PWAInstallButton from '../PWAInstallButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DashboardLayout() {
  const { userData, salonData, isPlatformAdmin, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
          
          <div className="mt-8 px-2">
             <PWAInstallButton />
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

             {/* Plan badge */}
             <div className="hidden sm:flex items-center h-8.5 px-3 py-1 bg-white/[0.02] rounded-xl border border-white/10 text-[11px] text-muted-foreground whitespace-nowrap">
               <span className="uppercase tracking-wider mr-2 font-bold text-[#D4AF37]">{isPlatformAdmin ? 'MASTER' : salonData?.plan}</span> 
               <span className="opacity-40 mr-2">|</span>
               <span>Status:</span>
               <span className={cn(
                 "ml-1 font-semibold capitalize",
                 isPlatformAdmin || salonData?.subscriptionStatus === 'active' ? "text-green-400" : "text-[#D4AF37]"
               )}>
                 {isPlatformAdmin ? 'ativo' : (salonData?.subscriptionStatus === 'trial' ? 'teste' : salonData?.subscriptionStatus)}
               </span>
             </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {salonData?.subscriptionStatus === 'trial' && !isPlatformAdmin && (
             <div className="mb-6 bg-gradient-to-r from-[#D4AF37]/15 to-transparent border border-[#D4AF37]/25 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(212,175,55,0.03)]">
                <div className="text-center sm:text-left">
                   <h4 className="font-semibold text-[#D4AF37] flex items-center justify-center sm:justify-start gap-2 text-sm leading-none"><Sparkles className="w-4 h-4 animate-pulse"/> Você está no Período de Testes</h4>
                   <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-light">Aproveite todos os recursos premium do plano <b className="text-white capitalize">{salonData.plan}</b> gratuitamente.</p>
                </div>
                <Button size="sm" className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold rounded-xl text-xs h-9.5 px-4 shrink-0 shadow-[0_4px_15px_rgba(212,175,55,0.15)]">
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
              <div className="mb-5">
                 <Button 
                   onClick={() => { setIsMobileMenuOpen(false); setIsGuideOpen(true); }}
                   variant="outline"
                   className="w-full text-[#D4AF37] border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 bg-white/[0.02]"
                 >
                   <HelpCircle className="w-4 h-4" /> Guia do Sistema
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
              
              <div className="mt-6">
                 <PWAInstallButton />
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
    </div>
  );
}

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
  Star
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
      { name: 'Categorias', href: '/dashboard/categorias', icon: Sparkles },
      { name: 'Checklist', href: '/dashboard/checklist', icon: CheckSquare },
      { name: 'Metas', href: '/dashboard/metas', icon: Target },
    ];
  };

  const navigation = getNavigationByRole(userData?.role);


  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-card/20 backdrop-blur-xl">
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-heading font-medium tracking-wide">Lumière</span>
          </Link>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.href 
              : location.pathname.startsWith(item.href);
              
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.name}
              </Link>
            )
          })}
          
          {isPlatformAdmin && (
            <Link
              to="/master"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-8 text-primary shadow-[0_0_15px_rgba(212,175,55,0.1)] hover:bg-primary/10 border border-primary/20"
            >
              <Settings className="w-5 h-5" />
              Painel Master
            </Link>
          )}
          
          <div className="mt-8 px-3">
             <PWAInstallButton />
          </div>
        </div>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {userData?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{userData?.fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{salonData?.name}</p>
            </div>
          </div>
          <BugReportDialog />
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 md:h-20 border-b border-white/5 bg-background flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4 md:hidden">
            <button onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-6 h-6 text-foreground" />
            </button>
            <span className="font-heading font-medium tracking-wide">Lumière</span>
          </div>
          
          <div className="hidden md:flex items-center">
            <h1 className="text-xl font-heading text-muted-foreground">
              {navigation.find(n => n.exact ? location.pathname === n.href : location.pathname.startsWith(n.href))?.name || 'Dashboard'}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Guia do Sistema Button */}
             <Button
               size="sm"
               variant="outline"
               onClick={() => setIsGuideOpen(true)}
               className="text-xs h-8 border-primary/20 hover:border-primary/50 text-primary hover:bg-primary/10 transition-all font-semibold rounded-xl bg-white/5 flex items-center gap-1.5 shrink-0"
             >
               <HelpCircle className="w-4 h-4 text-primary" />
               <span className="hidden sm:inline">Guia do Sistema</span>
               <span className="sm:hidden">Ajuda</span>
             </Button>




             {/* Plan badge */}
             <div className="hidden sm:flex items-center px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs text-muted-foreground">
               <span className="uppercase tracking-wider mr-2 font-bold text-primary">{isPlatformAdmin ? 'MASTER' : salonData?.plan}</span> 
               | Status: {isPlatformAdmin ? 'ativo' : salonData?.subscriptionStatus}
             </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {salonData?.subscriptionStatus === 'trial' && !isPlatformAdmin && (
             <div className="mb-6 bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                   <h4 className="font-medium text-primary flex items-center gap-2"><Sparkles className="w-4 h-4"/> Você está no período de teste</h4>
                   <p className="text-sm text-foreground/80 mt-1">Aproveite todos os recursos do plano {salonData.plan} gratuitamente.</p>
                </div>
                <Button size="sm" className="bg-primary text-black">
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

      {/* Mobile Menu (simplified for now) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm md:hidden flex flex-col">
           <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
              <span className="font-heading font-medium tracking-wide">Menu</span>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X className="w-6 h-6" />
              </button>
           </div>
           {/* Re-use navigation logic here, keeping short for brevity */}
           <div className="p-4 space-y-2 flex-1">
             <div className="mb-4">
               <Button 
                 onClick={() => { setIsMobileMenuOpen(false); setIsGuideOpen(true); }}
                 variant="outline"
                 className="w-full text-primary border-primary/20 hover:bg-primary/5 h-10 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 bg-white/5"
               >
                 <HelpCircle className="w-4 h-4" /> Guia do Sistema
               </Button>
             </div>
             {navigation.map(item => (
                <Link key={item.name} to={item.href} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 p-3 text-lg">
                  <item.icon className="w-5 h-5 text-primary" /> {item.name}
                </Link>
             ))}
             <div className="mt-4 pt-4 border-t border-white/5">
                <PWAInstallButton />
             </div>
           </div>
           <div className="p-4 border-t border-white/5">
             <Button variant="ghost" className="w-full justify-start text-destructive" onClick={logout}>Sair da Conta</Button>
           </div>
        </div>
      )}

      {/* Guia do Sistema Modal */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-4xl bg-[#0a0a0c]/98 border border-white/10 text-white rounded-2xl shadow-2xl backdrop-blur-xl max-h-[85vh] overflow-y-auto w-[94vw] sm:w-[90vw]">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="text-xl md:text-2xl font-heading font-light tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5 md:w-6 h-5 md:h-6 text-primary animate-pulse" /> Guia do Sistema LumiereOS
            </DialogTitle>
            <p className="text-[#a1a1aa] text-xs font-light mt-1">
              Descubra como aproveitar ao máximo cada módulo do seu sistema operacional de salão de beleza premium.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 font-sans max-h-[50vh] overflow-y-auto pr-2">
            {/* Dashboard */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 hover:border-primary/20 transition-all">
              <div className="p-2 h-max rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Dashboard</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Visão geral do salão, metas, agenda, checklist do dia e indicadores principais. Monitore as métricas vitais da sua operação em tempo real.
                </p>
              </div>
            </div>

            {/* Agenda */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 hover:border-primary/20 transition-all">
              <div className="p-2 h-max rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <CalendarDays className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Agenda</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Controle dos atendimentos, horários, clientes, serviços e profissionais. Permite agendar rapidamente e visualizar os compromissos diários ou semanais.
                </p>
              </div>
            </div>

            {/* Clientes */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 hover:border-primary/20 transition-all">
              <div className="p-2 h-max rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Clientes</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro e histórico básico dos clientes. Acompanhe quem são seus clientes mais fiéis, suas preferências e histórico completo de visitas.
                </p>
              </div>
            </div>

            {/* Profissionais */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 hover:border-primary/20 transition-all">
              <div className="p-2 h-max rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Profissionais</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro da equipe, funções, status e informações operacionais. Gerencie o time e acompanhe a disponibilidade de cada parceiro do salão.
                </p>
              </div>
            </div>

            {/* Serviços */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 hover:border-primary/20 transition-all">
              <div className="p-2 h-max rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <Scissors className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Serviços e Categorias</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro dos serviços, preços, duração e categorias. Organize seu catálogo de atendimentos com precisão para facilitar os agendamentos.
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 hover:border-primary/20 transition-all">
              <div className="p-2 h-max rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <CheckSquare className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Checklist</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Rotinas operacionais e Avaliação Diária da Equipe (Módulo Essenza). Garanta a conformidade da abertura/fechamento e avalie diariamente sua equipe.
                </p>
              </div>
            </div>

            {/* Metas */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 hover:border-primary/20 transition-all">
              <div className="p-2 h-max rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Metas</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Acompanhamento da meta mensal e progresso financeiro. Defina objetivos claros de faturamento e veja o progresso de vendas do estabelecimento.
                </p>
              </div>
            </div>

            {/* Relatórios */}
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex gap-3 hover:border-primary/20 transition-all">
              <div className="p-2 h-max rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary" />
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
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex gap-3 hover:border-primary/35 transition-all md:col-span-2">
                <div className="p-2 h-max rounded-lg bg-primary/20 border border-primary/30 shrink-0">
                  <Settings className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Painel Master</h4>
                    <span className="text-[8px] bg-primary text-black font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-widest">Apenas Admin</span>
                  </div>
                  <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                    Área administrativa exclusiva de nível de plataforma. Permite gerenciar salões afiliados, planos, visualizações financeiras e o suporte geral do ecossistema LumiereOS.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
            <Button onClick={() => setIsGuideOpen(false)} className="bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl text-xs px-5 h-9">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

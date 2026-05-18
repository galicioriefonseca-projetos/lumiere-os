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
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PWAInstallButton } from '../PWAInstallButton';

export default function DashboardLayout() {
  const { userData, salonData, isPlatformAdmin, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { name: 'Agenda', href: '/dashboard/agendamentos', icon: CalendarDays },
    { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
    { name: 'Profissionais', href: '/dashboard/equipe', icon: Users },
    { name: 'Serviços', href: '/dashboard/servicos', icon: Scissors },
    { name: 'Categorias', href: '/dashboard/categorias', icon: Sparkles },
    { name: 'Checklist', href: '/dashboard/checklist', icon: CheckSquare },
    { name: 'Metas', href: '/dashboard/metas', icon: Target },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-card/20 backdrop-blur-xl">
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-heading font-medium tracking-wide">Lumiere</span>
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
            <span className="font-heading font-medium tracking-wide">Lumiere</span>
          </div>
          
          <div className="hidden md:flex items-center">
            <h1 className="text-xl font-heading text-muted-foreground">
              {navigation.find(n => n.exact ? location.pathname === n.href : location.pathname.startsWith(n.href))?.name || 'Dashboard'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
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
    </div>
  );
}

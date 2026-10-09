import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLexicon } from '../../hooks/useLexicon';
import { Sparkles, CheckCircle2, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function OnboardingLayout() {
  const { salonData } = useAuth();
  const { lex } = useLexicon();
  const location = useLocation();
  const navigate = useNavigate();

  if (salonData?.activationStatus === 'canceled' || salonData?.activationStatus === 'blocked') {
    return <Navigate to="/login" />;
  }

  const steps = [
    { name: lex.professionals || 'Equipe', path: 'equipe' },
    { name: lex.services || 'Serviços', path: 'servicos' },
    { name: lex.goals || 'Metas', path: 'metas' },
    { name: lex.checklists || 'Checklist', path: 'checklist' }
  ];

  const currentStepIndex = steps.findIndex(s => location.pathname.includes(s.path));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/5 py-4">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/onboarding/configuracao')}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Central de Implantação
            </button>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-lg font-heading font-medium tracking-wide">Lumière<span className="text-primary">OS</span></span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-primary" />
            Ir para o Painel
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <div className="mb-10">
          <div className="flex justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10 -z-10" />
            {steps.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isActive = idx === currentStepIndex;
              return (
                <button 
                  key={step.path} 
                  onClick={() => navigate(`/onboarding/${step.path}`)}
                  className="flex flex-col items-center gap-2 bg-background px-3 sm:px-4 group cursor-pointer"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all",
                    isPast ? "bg-primary border-primary text-black" : 
                    isActive ? "border-primary text-primary scale-110" : "border-white/20 text-muted-foreground group-hover:border-white/40"
                  )}>
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : (idx + 1)}
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium uppercase tracking-wider transition-colors", 
                    isActive ? "text-primary font-bold" : "text-muted-foreground group-hover:text-zinc-300"
                  )}>
                    {step.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card/30 border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

export default function OnboardingLayout() {
  const { userData, salonData } = useAuth();
  const location = useLocation();

  if (salonData?.activationStatus === 'canceled' || salonData?.activationStatus === 'blocked') {
    return <Navigate to="/login" />;
  }

  const steps = [
    { name: 'Equipe', path: 'equipe' },
    { name: 'Serviços', path: 'servicos' },
    { name: 'Metas', path: 'metas' },
    { name: 'Checklist', path: 'checklist' }
  ];

  const currentStepIndex = steps.findIndex(s => location.pathname.includes(s.path));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/5 py-4">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-heading font-medium tracking-wide">Lumiere</span>
          </div>
          <div className="text-sm text-muted-foreground uppercase tracking-widest font-heading">
            Onboarding
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <div className="mb-12">
          <div className="flex justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10 -z-10" />
            {steps.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isActive = idx === currentStepIndex;
              return (
                <div key={step.name} className="flex flex-col items-center gap-2 bg-background px-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm",
                    isPast ? "bg-primary border-primary text-black" : 
                    isActive ? "border-primary text-primary" : "border-white/20 text-muted-foreground"
                  )}>
                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : (idx + 1)}
                  </div>
                  <span className={cn("text-xs font-medium uppercase tracking-wider", isActive ? "text-primary" : "text-muted-foreground")}>{step.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card/30 border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

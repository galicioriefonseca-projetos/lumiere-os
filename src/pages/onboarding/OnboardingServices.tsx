import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function OnboardingServices() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-heading">Seus Serviços</h2>
        <p className="text-muted-foreground text-sm">Liste os serviços oferecidos e seus valores.</p>
      </div>
      <div className="py-12 flex justify-center">
        <p className="text-muted-foreground italic text-sm">Em breve...</p>
      </div>
      <div className="flex justify-between pt-4 border-t border-white/10">
        <Button variant="ghost" onClick={() => navigate('/onboarding/equipe')}>Voltar</Button>
        <Button onClick={() => navigate('/onboarding/metas')} className="bg-primary hover:bg-gold-400 text-black">Continuar</Button>
      </div>
    </div>
  );
}

import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function OnboardingTeam() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-heading">Sua Equipe</h2>
        <p className="text-muted-foreground text-sm">Adicione os profissionais que trabalham com você.</p>
      </div>
      <div className="py-12 flex justify-center">
        <p className="text-muted-foreground italic text-sm">Em breve...</p>
      </div>
      <div className="flex justify-end pt-4 border-t border-white/10">
        <Button onClick={() => navigate('/onboarding/servicos')} className="bg-primary hover:bg-gold-400 text-black">
          Continuar
        </Button>
      </div>
    </div>
  );
}

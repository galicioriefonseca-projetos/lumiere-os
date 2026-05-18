import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { useState } from 'react';

export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const { userData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      if (userData) {
        /* PULAR ONBOARDING MARCANDO COMO ATIVO, CASO HAJA ALGUMA LOGICA ADICIONAL */
        await refreshUserData();
      }
      toast.success('Onboarding concluído!');
      navigate('/dashboard', { replace: true });
    } catch (e) {
      toast.error('Erro ao finalizar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-heading">Tudo Pronto!</h2>
        <p className="text-muted-foreground text-sm">Você já pode usar o seu painel.</p>
      </div>
      <div className="py-12 flex justify-center">
        <CheckCircle2 className="w-20 h-20 text-primary" />
      </div>
      <div className="flex justify-between pt-4 border-t border-white/10">
        <Button variant="ghost" onClick={() => navigate('/onboarding/metas')} disabled={loading}>Voltar</Button>
        <Button onClick={handleFinish} disabled={loading} className="bg-primary hover:bg-gold-400 text-black">
          {loading ? 'Finalizando...' : 'Ir para o Dashboard'}
        </Button>
      </div>
    </div>
  );
}

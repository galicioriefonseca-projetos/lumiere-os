import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Chrome, ArrowRight, AlertTriangle } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const planParam = searchParams.get('plan') || '';
  const codeParam = searchParams.get('code') || '';
  const { signInWithGoogleForRegister } = useAuth();

  const planNormalized = planParam.toLowerCase();
  const VALID_PLANS = ['start', 'studio', 'performance', 'network'];
  const isFounderValid = planNormalized === 'founder' && codeParam === 'ESSENZAFOUNDER';
  const isPlanValid = planNormalized !== '' && (VALID_PLANS.includes(planNormalized) || isFounderValid);

  useEffect(() => {
    if (planNormalized === 'founder' && codeParam !== 'ESSENZAFOUNDER') {
        toast.error("Código de Plano Founder Inválido, redirecionando...");
        navigate('/');
    }
  }, [planNormalized, codeParam, navigate]);
  
  const [formData, setFormData] = useState({
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    salonName: '',
    businessType: 'salon',
    city: '',
    state: '',
    professionalsCount: '1-3',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGoogleRegister = async () => {
    if (!formData.salonName || !formData.city || !formData.state || !formData.phone) {
      toast.error('Por favor, preencha o Nome do Negócio, Cidade, Estado e WhatsApp para cadastrar com o Google.');
      return;
    }

    setLoading(true);
    try {
      let limit = 3;
      if (planParam === 'studio') limit = 10;
      if (planParam === 'founder') limit = 22;
      if (planParam === 'performance') limit = 20;
      if (planParam === 'network') limit = 999;

      await signInWithGoogleForRegister({
        salonName: formData.salonName,
        businessType: formData.businessType,
        city: formData.city,
        state: formData.state,
        phone: formData.phone,
        plan: planParam,
        limit,
      }, formData.ownerName || undefined);

      toast.success('Conta criada com sucesso com o Google! Bem-vindo ao Lumière.');
      navigate('/onboarding/equipe', { replace: true });
    } catch (error: any) {
      if (error.code === 'auth/social-email-already-linked') {
        toast.error('Este e-mail já está vinculado a outro salão no LumièreOS.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('A conexão do Google foi fechada antes de ser concluída.');
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error('Já existe uma conta cadastrada com esse mesmo e-mail associada a outra senha.');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error(`Domínio não autorizado nas configurações do Firebase. Adicione o domínio "${window.location.hostname}" em Firebase Console -> Authentication -> Configurações -> Domínios autorizados.`, { duration: 10000 });
      } else {
        console.error('Register Google error:', error);
        toast.error('Erro ao cadastrar com Google: ' + (error.message || 'Erro inesperado'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: formData.ownerName });

      // Calculate trial end date (7 days from now)
      const now = Date.now();
      const trialEndsAt = now + 7 * 24 * 60 * 60 * 1000;

      // Map professionals limits based on plan
      let limit = 3;
      if (planParam === 'studio') limit = 10;
      if (planParam === 'founder') limit = 22;
      if (planParam === 'performance') limit = 20;
      if (planParam === 'network') limit = 999;
      
      // Auto-generate a Salon ID (could just use a random string, but simpler to let Firestore auto-generate. Wait, we use setDoc, so we need an ID)
      const salonId = crypto.randomUUID();

      // 3. Create Salon Document
      const salonData = {
        id: salonId,
        name: formData.salonName,
        ownerName: formData.ownerName,
        ownerId: user.uid,
        ownerEmail: formData.email,
        phone: formData.phone,
        businessType: formData.businessType,
        city: formData.city,
        state: formData.state,
        plan: planParam,
        subscriptionStatus: 'trial',
        activationStatus: 'active',
        trialEndsAt: trialEndsAt,
        isActive: true,
        professionalsLimit: limit,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'salons', salonId), salonData);

      // 2. Create User Document
      const userData = {
        id: user.uid,
        fullName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        role: 'owner',
        salonId: salonId,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      // Clear layout-simulated demo role
      sessionStorage.removeItem('demo_role');

      toast.success('Conta criada com sucesso! Bem-vindo ao Lumière.');
      navigate('/onboarding/equipe', { replace: true });
      
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.');
      } else {
        toast.error('Erro ao criar conta: ' + (error.message || 'Erro desconhecido'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isPlanValid) {
    if (planNormalized === 'founder') {
      return null;
    }
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center mb-6">
            <Link to="/" className="flex items-center gap-2 group">
              <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
              <span className="text-3xl font-heading font-medium tracking-wide">Lumière</span>
            </Link>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-card/40 backdrop-blur-xl py-10 px-6 shadow-2xl border border-white/10 sm:rounded-3xl sm:px-10 text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-primary" />
            </div>

            <h2 className="text-2xl font-light font-heading tracking-tight text-foreground">
              Escolha um plano para continuar.
            </h2>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              Para se cadastrar no LumièreOS e impulsionar o seu negócio de beleza com gestão premium, você precisa selecionar um dos planos ativos disponíveis.
            </p>

            <div className="pt-4">
              <Button 
                onClick={() => navigate('/#planos')} 
                className="w-full rounded-full h-14 bg-primary hover:bg-gold-400 text-black font-semibold text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(212,175,55,0.2)] hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2"
              >
                <span>Ver planos</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-center pt-2">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Já tem uma conta cadastrada? <span className="text-primary font-medium hover:underline">Acesse aqui</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="flex justify-center mb-6">
          <Link to="/" className="flex items-center gap-2 group">
            <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
            <span className="text-3xl font-heading font-medium tracking-wide">Lumière</span>
          </Link>
        </div>
        <h2 className="text-center text-3xl font-light font-heading tracking-tight text-foreground">
          Comece seu teste de 7 dias
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground uppercase tracking-wider">
          Plano Selecionado: <span className="text-primary font-bold">{planParam}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-card/40 backdrop-blur-xl py-8 px-4 shadow-2xl border border-white/10 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            <div className="space-y-4">
              <h3 className="text-lg font-heading border-b border-white/10 pb-2">Seus Dados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Nome Completo</Label>
                  <Input id="ownerName" name="ownerName" required value={formData.ownerName} onChange={handleChange} className="bg-black/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp</Label>
                  <Input id="phone" name="phone" required value={formData.phone} onChange={handleChange} className="bg-black/50" placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} className="bg-black/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" required value={formData.password} onChange={handleChange} className="bg-black/50" />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-heading border-b border-white/10 pb-2">Dados do Negócio</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salonName">Nome do Negócio</Label>
                  <Input id="salonName" name="salonName" required value={formData.salonName} onChange={handleChange} className="bg-black/50" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Negócio</Label>
                  <Select value={formData.businessType} onValueChange={(v) => handleSelectChange('businessType', v)}>
                    <SelectTrigger className="bg-black/50">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salon">Salão de Beleza</SelectItem>
                      <SelectItem value="clinic">Clínica de Estética</SelectItem>
                      <SelectItem value="barbershop">Barbearia</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" name="city" required value={formData.city} onChange={handleChange} className="bg-black/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input id="state" name="state" required value={formData.state} onChange={handleChange} className="bg-black/50" placeholder="SP" />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={loading} className="w-full rounded-full h-14 bg-primary hover:bg-gold-400 text-black font-medium text-lg uppercase tracking-wide">
                {loading ? 'Criando Conta...' : 'Criar Minha Conta'}
              </Button>
            </div>
            
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#141414] px-3 text-muted-foreground text-[11px] tracking-wider">ou cadastre-se com</span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                type="button"
                disabled={loading}
                onClick={handleGoogleRegister}
                className="w-full rounded-full h-12 bg-black/40 hover:bg-black/80 text-foreground border border-white/10 hover:border-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <Chrome className="w-4 h-4 text-primary" />
                <span>Cadastrar com Google</span>
              </Button>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-medium text-primary hover:text-gold-400">
                Acesse aqui
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Chrome, ArrowRight, AlertTriangle, ChevronRight, ChevronLeft, Check, Scissors, Gift, MapPin, Building, Phone, User, Mail, Lock } from 'lucide-react';
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

  const [step, setStep] = useState(1);
  const [painPoint, setPainPoint] = useState('agenda');
  const [revenueRange, setRevenueRange] = useState('10k-50k');

  const getRecommendedPlan = () => {
    const count = formData.professionalsCount;
    if (count === '1-3') return { id: 'start', name: 'Start', limit: 3, description: 'Limites calibrados para profissionais independentes e pequenos espaços.' };
    if (count === '4-10') return { id: 'studio', name: 'Studio', limit: 10, description: 'O padrão ouro para estúdios de beleza e clínicas em crescimento.' };
    if (count === '11-20') return { id: 'performance', name: 'Performance', limit: 20, description: 'Ampla cobertura premium de comissão, inteligência e metas.' };
    return { id: 'network', name: 'Network', limit: 999, description: 'Capacidade ilimitada para salões de grande porte, franquias e redes.' };
  };

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
      let activePlan = planParam;
      let limit = 3;
      if (isPlanValid) {
        if (planParam === 'studio') limit = 10;
        if (planParam === 'founder') limit = 22;
        if (planParam === 'performance') limit = 20;
        if (planParam === 'network') limit = 999;
      } else {
        const reco = getRecommendedPlan();
        activePlan = reco.id;
        limit = reco.limit;
      }

      await signInWithGoogleForRegister({
        salonName: formData.salonName,
        businessType: formData.businessType,
        city: formData.city,
        state: formData.state,
        phone: formData.phone,
        plan: activePlan,
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      let activePlan = planParam;
      let limit = 3;
      if (isPlanValid) {
        if (planParam === 'studio') limit = 10;
        if (planParam === 'founder') limit = 22;
        if (planParam === 'performance') limit = 20;
        if (planParam === 'network') limit = 999;
      } else {
        const reco = getRecommendedPlan();
        activePlan = reco.id;
        limit = reco.limit;
      }
      
      // Auto-generate a Salon ID
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
        plan: activePlan,
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

      toast.success('Licença experimental premium de 7 dias liberada com sucesso!');
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

    const reco = getRecommendedPlan();

    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10" />
        
        <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
          <div className="flex justify-center mb-6">
            <Link to="/" className="flex items-center gap-2 group">
              <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
              <span className="text-3xl font-heading font-medium tracking-wide">Lumière</span>
            </Link>
          </div>
          <h2 className="text-3xl md:text-4xl font-light font-heading tracking-tight text-white leading-tight">
            Diagnóstico Lumière & Trial de 7 Dias
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto font-light">
            Informe o perfil do seu negócio para calibrarmos a licença e liberarmos seu acesso completo em menos de 1 minuto.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
          <div className="bg-card/40 backdrop-blur-xl py-10 px-6 sm:px-10 shadow-2xl border border-white/10 sm:rounded-3xl sm:px-10 space-y-8">
            
            {/* Step Indicators */}
            <div className="flex justify-between items-center max-w-xs mx-auto mb-4 relative">
              <div className="absolute top-[18px] left-0 right-0 h-[2px] bg-white/5 -z-10" />
              <div className="absolute top-[18px] left-0 right-0 h-[2px] bg-primary/35 transition-all duration-300 -z-10" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }} />

              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => s < step && setStep(s)}
                  disabled={s >= step}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-heading font-bold transition-all duration-300 ${
                    step === s
                      ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                      : s < step
                      ? 'bg-primary/20 text-primary border-primary/40 cursor-pointer'
                      : 'bg-black/40 text-muted-foreground border-white/5 cursor-not-allowed'
                  }`}
                >
                  {s < step ? <Check className="w-4 h-4 text-primary" /> : `0${s}`}
                </button>
              ))}
            </div>

            {/* Step Content */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-heading text-white flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary" />
                    <span>Passo 1: Qualidade e Escopo do Negócio</span>
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-light">
                    Comece definindo o nome do seu estabelecimento comercial e selecione o segmento correspondente.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="salonName" className="text-zinc-300">Nome do Estabelecimento / Comercial</Label>
                    <Input
                      id="salonName"
                      name="salonName"
                      placeholder="Ex: Maison de Beauté Lumière"
                      value={formData.salonName}
                      onChange={handleChange}
                      className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white"
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-zinc-300">Tipo de Atividade</Label>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { id: 'salon', label: 'Salão de Beleza' },
                        { id: 'clinic', label: 'Clínica de Estética' },
                        { id: 'barbershop', label: 'Barbearia' },
                        { id: 'studio', label: 'Studio' },
                        { id: 'other', label: 'Outro Segmento' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectChange('businessType', t.id)}
                          className={`p-3.5 text-xs text-center rounded-xl border transition-all cursor-pointer ${
                            formData.businessType === t.id
                              ? 'border-primary/40 bg-primary/5 text-primary font-medium'
                              : 'border-white/5 bg-black/25 text-zinc-400 hover:bg-black/45 hover:border-white/10'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-zinc-300">Tamanho da Equipe (Profissionais)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { id: '1-3', label: '1 a 3 colaboradores' },
                        { id: '4-10', label: '4 a 10 colaboradores' },
                        { id: '11-20', label: '11 a 20 colab.' },
                        { id: '20+', label: 'Mais de 20 colab.' }
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectChange('professionalsCount', c.id)}
                          className={`p-4 text-xs font-medium rounded-xl border transition-all text-center flex flex-col justify-center items-center gap-2 cursor-pointer ${
                            formData.professionalsCount === c.id
                              ? 'border-primary bg-primary/5 text-primary shadow-[0_0_15px_rgba(212,175,55,0.05)]'
                              : 'border-white/5 bg-black/25 text-zinc-400 hover:bg-black/45 hover:border-white/10'
                          }`}
                        >
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="button"
                    disabled={!formData.salonName}
                    onClick={() => setStep(2)}
                    className="rounded-full h-12 px-6 bg-primary hover:bg-gold-500 text-black font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <span>Prosseguir</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-heading text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span>Passo 2: Perfil Operacional e Localidade</span>
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-light">
                    Iremos calibrar a localização e as maiores demandas operacionais do negócio para customizar seu painel.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="city" className="text-zinc-300">Cidade</Label>
                      <Input
                        id="city"
                        name="city"
                        placeholder="Ex: São Paulo"
                        required
                        value={formData.city}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state" className="text-zinc-300">Estado (UF)</Label>
                      <Input
                        id="state"
                        name="state"
                        placeholder="Ex: SP"
                        maxLength={2}
                        required
                        value={formData.state}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label htmlFor="phone" className="text-zinc-300">Contato Comercial (WhatsApp)</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="(11) 99999-9999"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white"
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-zinc-300">Principal gargalo ou objetivo de controle no seu salão</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'agenda', label: 'Eliminar furos e organizar agenda' },
                        { id: 'comissão', label: 'Facilitar repasse de comissões' },
                        { id: 'checklist', label: 'Controlar checklists diários' },
                        { id: 'marketing', label: 'Atrair clientes e crescer faturamento' }
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPainPoint(p.id)}
                          className={`p-4 text-xs font-medium rounded-xl border text-left flex flex-col justify-between h-20 transition-all cursor-pointer ${
                            painPoint === p.id
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-white/5 bg-black/25 text-zinc-400 hover:bg-black/45 hover:border-white/10'
                          }`}
                        >
                          <span className="text-muted-foreground text-[9px] uppercase font-bold tracking-widest">Sua Opção</span>
                          <span className="leading-tight">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <Button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full h-12 px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Voltar</span>
                  </Button>
                  <Button
                    type="button"
                    disabled={!formData.city || !formData.state || !formData.phone}
                    onClick={() => setStep(3)}
                    className="rounded-full h-12 px-6 bg-primary hover:bg-gold-500 text-black font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <span>Analisar e Recomendar</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                
                {/* Dynamically calculated recommended plan based on parameters */}
                <div className="p-6 rounded-2xl bg-[#D4AF37]/5 border border-primary/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-semibold text-primary tracking-widest flex items-center gap-1.5 font-sans">
                      <Gift className="w-4 h-4 text-primary animate-pulse" />
                      Diagnóstico Concluído
                    </span>
                    <span className="text-[10px] uppercase font-mono bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded font-bold">
                      Licença Recomendada
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-2xl font-heading text-white">Lumière {reco.name}</h4>
                    <p className="text-xs text-[#D4AF37] font-medium">Limite de {reco.limit === 999 ? 'Profissionais Ilimitados' : `${reco.limit} profissionais habilitados`}</p>
                    <p className="text-xs text-zinc-300 font-light pt-1 leading-relaxed">
                      {reco.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#D4AF37]/20 flex items-center justify-between text-xs text-[#D4AF37]">
                    <span className="font-medium">🎁 7 Dias de Cortesia Integral Habilitados</span>
                    <span className="font-mono text-[10px]">Sem taxas ou cobranças imediatas</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-heading text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    <span>Passo 3: Credenciais do Administrador</span>
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-light">
                    Crie sua conta mestre para acessar as ferramentas de gestão sob medida imediatamente.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownerName" className="text-zinc-300">Seu Nome Completo</Label>
                    <Input
                      id="ownerName"
                      name="ownerName"
                      placeholder="Ex: Roberto Alencar"
                      required
                      value={formData.ownerName}
                      onChange={handleChange}
                      className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-zinc-300">E-mail Corporativo</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="nome@empresa.com"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-zinc-300">Senha de Acesso</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-between items-center gap-4">
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-full h-12 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Voltar</span>
                  </Button>
                  
                  <Button
                    type="button"
                    disabled={loading || !formData.ownerName || !formData.email || !formData.password}
                    onClick={() => handleSubmit()}
                    className="rounded-full h-12 px-6 bg-primary hover:bg-gold-400 text-black font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform flex-1 justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)] cursor-pointer"
                  >
                    {loading ? (
                      <span>Ativando Licença...</span>
                    ) : (
                      <>
                        <span>Ativar Licença de 7 dias grátis</span>
                        <Gift className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>

                <div className="relative pt-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/15" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-[#0c0c0f] px-3 text-muted-foreground text-[10px] tracking-wider font-light font-sans">ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={loading || !formData.ownerName}
                  onClick={handleGoogleRegister}
                  className="w-full rounded-full h-12 bg-black/40 hover:bg-black/80 text-foreground border border-white/10 hover:border-primary/20 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  <Chrome className="w-4 h-4 text-primary" />
                  <span>Configurar Trial de 7 Dias com o Google</span>
                </Button>
              </div>
            )}

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-muted-foreground hover:text-primary transition-colors block">
                Já possui credenciais no LumièreOS? <span className="text-primary font-medium hover:underline">Faça login aqui</span>
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

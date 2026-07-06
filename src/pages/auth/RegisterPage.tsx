import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Chrome, ChevronRight, ChevronLeft, Check, Gift, Building, MapPin, Phone, User, Mail, Lock, Users } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { signInWithGoogleForRegister } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [formData, setFormData] = useState({
    ownerName: '',
    salonName: '',
    phone: '',
    email: '',
    password: '',
    city: '',
    state: '',
    businessSegment: '' as 'Salão de Beleza' | 'Barbearia' | 'Clínica de Estética' | '',
    estimatedProfessionals: '' as 'Apenas eu' | '2 a 5' | '6 a 10' | '11 a 20' | 'Mais de 20' | '',
  });

  const getRecommendedPlan = (estimatedProfessionals: string) => {
    switch (estimatedProfessionals) {
      case 'Apenas eu':
        return {
          id: 'start',
          name: 'Start',
          price: 'R$ 197/mês',
          maxProfessionals: 'Até 5 profissionais',
          limit: 5,
          benefits: [
            'Até 5 profissionais habilitados',
            'Checklist operacional de excelência',
            'Controle completo de agenda',
            'Painel operacional básico',
            'Suporte padrão via e-mail'
          ]
        };
      case '2 a 5':
        return {
          id: 'founder',
          name: 'Founder (Pioneiro)',
          price: 'R$ 297/mês',
          maxProfessionals: 'Até 22 profissionais',
          limit: 22,
          benefits: [
            'Até 22 profissionais habilitados',
            'Acesso completo a todos os recursos',
            'Sem bloqueios ou limites restritos',
            'Checklist Essenza',
            'Metas de faturamento por colaborador',
            'Suporte prioritário e implantação assistida'
          ]
        };
      case '6 a 10':
        return {
          id: 'performance',
          name: 'Performance',
          price: 'R$ 397/mês',
          maxProfessionals: 'Até 20 profissionais',
          limit: 20,
          benefits: [
            'Até 20 profissionais habilitados',
            'Gestão automatizada de Comissões',
            'Avaliações operacionais (Padrão Essenza)',
            'Módulo de Gamificação completo (Ranking & Desafios)',
            'Relatórios avançados com Insights de IA'
          ]
        };
      case '11 a 20':
        return {
          id: 'network',
          name: 'Network',
          price: 'R$ 797/mês',
          maxProfessionals: 'Profissionais Ilimitados',
          limit: 999,
          benefits: [
            'Profissionais Ilimitados',
            'Gestão Multiunidade integrada',
            'Painel Master de Rede para franquias',
            'Relatórios executivos e auditorias',
            'Suporte VIP prioritário via WhatsApp'
          ]
        };
      case 'Mais de 20':
        return {
          id: 'enterprise',
          name: 'Enterprise',
          price: 'R$ 1997/mês',
          maxProfessionals: 'Profissionais Ilimitados',
          limit: 9999,
          benefits: [
            'Colaboradores e profissionais Ilimitados',
            'Customização de relatórios e BI',
            'Gerente de Conta exclusivo para implantação',
            'Integrações avançadas via API',
            'Suporte VIP Dedicado com SLA corporativo'
          ]
        };
      default:
        return {
          id: 'start',
          name: 'Start',
          price: 'R$ 197/mês',
          maxProfessionals: 'Até 5 profissionais',
          limit: 5,
          benefits: [
            'Até 5 profissionais habilitados',
            'Checklist operacional de excelência',
            'Controle completo de agenda',
            'Painel operacional básico',
            'Suporte padrão'
          ]
        };
    }
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectSegment = (segment: 'Salão de Beleza' | 'Barbearia' | 'Clínica de Estética') => {
    setFormData(prev => ({ ...prev, businessSegment: segment }));
  };

  const handleSelectProfessionals = (option: 'Apenas eu' | '2 a 5' | '6 a 10' | '11 a 20' | 'Mais de 20') => {
    setFormData(prev => ({ ...prev, estimatedProfessionals: option }));
    setStep(3); // Auto-advance to Step 3
  };

  const isStep1Valid = 
    formData.ownerName.trim() !== '' &&
    formData.salonName.trim() !== '' &&
    formData.phone.trim() !== '' &&
    formData.email.trim() !== '' &&
    formData.password.trim() !== '' &&
    formData.city.trim() !== '' &&
    formData.state.trim() !== '' &&
    formData.businessSegment !== '';

  const reco = getRecommendedPlan(formData.estimatedProfessionals || 'Apenas eu');

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

      // Auto-generate a Salon ID
      const salonId = crypto.randomUUID();

      // For backward compatibility mapping
      let legacyBusinessType = 'salon';
      if (formData.businessSegment === 'Barbearia') legacyBusinessType = 'barbershop';
      if (formData.businessSegment === 'Clínica de Estética') legacyBusinessType = 'clinic';

      // 2. Create Salon Document
      const salonData = {
        id: salonId,
        name: formData.salonName,
        ownerId: user.uid,
        ownerEmail: formData.email,
        businessType: legacyBusinessType,
        plan: reco.id,
        subscriptionStatus: 'trial',
        activationStatus: 'active',
        trialEndsAt: trialEndsAt,
        isActive: true,
        professionalsLimit: reco.limit,
        createdAt: now,
        updatedAt: now,

        // Optional onboarding commercial fields
        ownerName: formData.ownerName,
        businessSegment: formData.businessSegment,
        estimatedProfessionals: formData.estimatedProfessionals,
        city: formData.city,
        state: formData.state,
        phone: formData.phone,
        recommendedPlan: reco.id
      };

      try {
        await setDoc(doc(db, 'salons', salonId), salonData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `salons/${salonId}`);
      }

      // 3. Create User Document
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

      try {
        await setDoc(doc(db, 'users', user.uid), userData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }

      // Clear layout-simulated demo role
      sessionStorage.removeItem('demo_role');

      toast.success('Sua licença experimental de 7 dias grátis foi ativada com sucesso!');
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

  const handleGoogleRegister = async () => {
    if (!isStep1Valid || !formData.estimatedProfessionals) {
      toast.error('Por favor, preencha todos os dados das etapas anteriores antes de continuar com o Google.');
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogleForRegister({
        salonName: formData.salonName,
        businessType: formData.businessSegment === 'Barbearia' ? 'barbershop' : formData.businessSegment === 'Clínica de Estética' ? 'clinic' : 'salon',
        city: formData.city,
        state: formData.state,
        phone: formData.phone,
        plan: reco.id,
        limit: reco.limit,
        ownerName: formData.ownerName,
        businessSegment: formData.businessSegment,
        estimatedProfessionals: formData.estimatedProfessionals,
        recommendedPlan: reco.id
      }, formData.ownerName || undefined);

      toast.success('Conta criada via Google e Trial de 7 dias ativado!');
      navigate('/onboarding/equipe', { replace: true });
    } catch (error: any) {
      if (error.code === 'auth/social-email-already-linked') {
        toast.error('Este e-mail já está vinculado a outro salão no LumièreOS.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.');
      } else {
        console.error('Google register error:', error);
        toast.error('Erro ao cadastrar com Google: ' + (error.message || 'Erro inesperado'));
      }
    } finally {
      setLoading(false);
    }
  };

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
          Onboarding Comercial LumièreOS
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto font-light">
          Preencha o perfil do seu negócio em menos de 1 minuto para recomendar o plano ideal e liberar seu Trial Premium de 7 dias.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-card/40 backdrop-blur-xl py-10 px-6 sm:px-10 shadow-2xl border border-white/10 sm:rounded-3xl space-y-8">
          
          {/* Step Progress Indicators */}
          <div className="flex justify-between items-center max-w-xs mx-auto mb-4 relative" id="onboarding-step-indicators">
            <div className="absolute top-[18px] left-0 right-0 h-[2px] bg-white/5 -z-10" />
            <div className="absolute top-[18px] left-0 right-0 h-[2px] bg-primary/35 transition-all duration-300 -z-10" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }} />

            {[1, 2, 3].map((s) => (
              <button
                key={s}
                id={`step-indicator-btn-${s}`}
                onClick={() => {
                  if (s === 1) setStep(1);
                  if (s === 2 && isStep1Valid) setStep(2);
                }}
                disabled={s > step || (s === 2 && !isStep1Valid) || (s === 3 && (!isStep1Valid || !formData.estimatedProfessionals))}
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

          {/* STEP 1: Formulário de Cadastro Comercial */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in" id="step-1-container">
              <div className="space-y-2">
                <h3 className="text-lg font-heading text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  <span>Passo 1: Identificação Comercial & Contato</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-light">
                  Informe os dados básicos do proprietário, negócio e localização para configurarmos seu workspace.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownerName" className="text-zinc-300">Nome do Proprietário</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="ownerName"
                        name="ownerName"
                        required
                        placeholder="Ex: Roberto Alencar"
                        value={formData.ownerName}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salonName" className="text-zinc-300">Nome da Empresa</Label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="salonName"
                        name="salonName"
                        required
                        placeholder="Ex: Belle Epoque Studio"
                        value={formData.salonName}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-300">Email Corporativo</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="exemplo@lumiere.com"
                        value={formData.email}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-zinc-300">Senha de Acesso</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="phone" className="text-zinc-300">WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="phone"
                        name="phone"
                        required
                        placeholder="(11) 99999-9999"
                        value={formData.phone}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="city" className="text-zinc-300">Cidade</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="city"
                        name="city"
                        required
                        placeholder="São Paulo"
                        value={formData.city}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="state" className="text-zinc-300">Estado (UF)</Label>
                    <Input
                      id="state"
                      name="state"
                      required
                      placeholder="SP"
                      maxLength={2}
                      value={formData.state}
                      onChange={handleChange}
                      className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white"
                    />
                  </div>
                </div>

                {/* Segment Selection */}
                <div className="space-y-2 pt-2">
                  <Label className="text-zinc-300">Segmento de Atuação</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Salão de Beleza', 'Barbearia', 'Clínica de Estética'].map((segment) => (
                      <button
                        key={segment}
                        type="button"
                        id={`segment-btn-${segment.replace(/\s+/g, '-').toLowerCase()}`}
                        onClick={() => handleSelectSegment(segment as any)}
                        className={`p-3 text-xs text-center rounded-xl border transition-all cursor-pointer font-medium ${
                          formData.businessSegment === segment
                            ? 'border-primary bg-primary/10 text-primary shadow-[0_0_10px_rgba(212,175,55,0.15)]'
                            : 'border-white/5 bg-black/25 text-zinc-400 hover:bg-black/45 hover:border-white/10'
                        }`}
                      >
                        {segment}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="button"
                  id="btn-step1-continue"
                  disabled={!isStep1Valid}
                  onClick={() => setStep(2)}
                  className="rounded-full h-12 px-6 bg-primary hover:bg-gold-500 text-black font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                >
                  <span>Prosseguir</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Questionamento de Profissionais */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in" id="step-2-container">
              <div className="space-y-2">
                <h3 className="text-lg font-heading text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span>Passo 2: Dimensionamento da Operação</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-light">
                  Nos conte sobre a escala atual do seu negócio. Quantos profissionais trabalham hoje com você?
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <Label className="text-zinc-300">Selecione o tamanho da sua equipe:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="professionals-options-grid">
                  {[
                    { id: 'Apenas eu', label: 'Apenas eu', desc: 'Profissional autônomo atuando individualmente.' },
                    { id: '2 a 5', label: '2 a 5 colaboradores', desc: 'Pequenos estúdios e espaços de atendimento intimistas.' },
                    { id: '6 a 10', label: '6 a 10 colaboradores', desc: 'Salões estruturados em rápida ascensão no mercado.' },
                    { id: '11 a 20', label: '11 a 20 colaboradores', desc: 'Centros integrados de estética e grandes equipes.' },
                    { id: 'Mais de 20', label: 'Mais de 20 colaboradores', desc: 'Franquias, grandes redes e estruturas corporativas.' }
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      id={`professionals-btn-${option.id.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => handleSelectProfessionals(option.id as any)}
                      className={`p-4 text-left rounded-xl border flex flex-col justify-between h-24 transition-all cursor-pointer ${
                        formData.estimatedProfessionals === option.id
                          ? 'border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(212,175,55,0.15)]'
                          : 'border-white/5 bg-black/25 text-zinc-400 hover:bg-black/45 hover:border-white/10'
                      }`}
                    >
                      <span className="font-semibold text-sm leading-tight text-white">{option.label}</span>
                      <span className="text-[10px] text-zinc-400 font-light mt-1">{option.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button
                  type="button"
                  id="btn-step2-back"
                  onClick={() => setStep(1)}
                  className="rounded-full h-12 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Sugestão Elegante de Plano & Confirmação de Trial */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in" id="step-3-container">
              
              <div className="space-y-2 text-center pb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest mb-2 font-sans animate-pulse">
                  <Gift className="w-3.5 h-3.5 text-primary" />
                  <span>Análise de Diagnóstico Concluída</span>
                </div>
                <h3 className="text-xl md:text-2xl font-heading text-white">
                  Identificamos o plano perfeito para você
                </h3>
                <p className="text-xs text-muted-foreground font-light max-w-sm mx-auto">
                  Sugerimos a licença calibrada para o tamanho operacional do seu negócio, sem taxa de implantação.
                </p>
              </div>

              {/* TELA ELEGANTE DE PLANO RECOMENDADO */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-black/60 to-zinc-900/60 border border-primary/20 space-y-5 shadow-2xl relative overflow-hidden" id="recommended-plan-card">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Licença Ideal</span>
                    <h4 className="text-2xl font-heading font-medium tracking-wide text-white">Lumière {reco.name}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-400 font-light block">Valor Mensal</span>
                    <span className="text-xl font-heading font-bold text-primary">{reco.price}</span>
                  </div>
                </div>

                <div className="py-2 border-y border-white/5 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-light">Capacidade de Equipe</span>
                  <span className="text-primary font-semibold font-sans">{reco.maxProfessionals}</span>
                </div>

                <div className="space-y-3 pt-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">Benefícios Inclusos</span>
                  <ul className="space-y-2" id="plan-benefits-list">
                    {reco.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-300 font-light">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-primary/10 flex items-center justify-between text-[11px] text-[#D4AF37]">
                  <span className="font-medium">🎁 Teste Cortesia Premium Liberado</span>
                  <span className="font-mono text-[9px] bg-[#D4AF37]/10 px-2 py-0.5 rounded">7 DIAS GRÁTIS</span>
                </div>
              </div>

              {/* Botão de Confirmação & Ativação */}
              <div className="space-y-3 pt-2">
                <Button
                  type="button"
                  id="btn-confirm-trial-email"
                  disabled={loading}
                  onClick={() => handleSubmit()}
                  className="w-full rounded-full h-14 bg-primary hover:bg-gold-400 text-black font-semibold uppercase tracking-wider text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_20px_rgba(212,175,55,0.2)] cursor-pointer"
                >
                  {loading ? (
                    <span>Configurando seu Trial de 7 Dias...</span>
                  ) : (
                    <>
                      <span>Iniciar meus 7 dias gratuitos</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-4 text-muted-foreground text-[10px] uppercase tracking-widest font-light font-sans">ou com o Google</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <Button
                  type="button"
                  id="btn-confirm-trial-google"
                  disabled={loading}
                  onClick={handleGoogleRegister}
                  className="w-full rounded-full h-12 bg-black/40 hover:bg-black/80 text-foreground border border-white/10 hover:border-primary/20 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  <Chrome className="w-4 h-4 text-primary" />
                  <span>Cadastrar e Iniciar 7 dias grátis com o Google</span>
                </Button>
              </div>

              <div className="pt-2 flex justify-center">
                <Button
                  type="button"
                  id="btn-step3-back"
                  onClick={() => setStep(2)}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Voltar para Passo 2</span>
                </Button>
              </div>
            </div>
          )}

          <div className="text-center pt-2 border-t border-white/5">
            <Link to="/login" className="text-xs text-muted-foreground hover:text-primary transition-colors block">
              Já possui conta cadastrada? <span className="text-primary font-medium hover:underline">Acesse aqui</span>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

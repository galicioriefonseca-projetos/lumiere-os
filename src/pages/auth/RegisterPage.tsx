import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Gift, 
  Building, 
  MapPin, 
  Phone, 
  User, 
  Mail, 
  Users, 
  ArrowLeft,
  FileText,
  ShieldCheck,
  TrendingUp,
  Award
} from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [formData, setFormData] = useState({
    ownerName: '',
    salonName: '',
    phone: '',
    email: '',
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
            'Checklist Lumière',
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
            'Avaliações operacionais (Padrão Lumière)',
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
    formData.city.trim() !== '' &&
    formData.state.trim() !== '' &&
    formData.businessSegment !== '';

  const reco = getRecommendedPlan(formData.estimatedProfessionals || 'Apenas eu');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      // Auto-generate a Salon ID
      const salonId = crypto.randomUUID();

      // Fazer chamada ao backend seguro para criar o checkout e salvar o salão pendente
      const response = await fetch('/api/cakto/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salonId,
          planId: reco.id,
          email: formData.email,
          ownerName: formData.ownerName,
          salonName: formData.salonName,
          phone: formData.phone,
          city: formData.city,
          state: formData.state,
          businessSegment: formData.businessSegment,
          estimatedProfessionals: formData.estimatedProfessionals,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao gerar link de pagamento seguro.');
      }

      const result = await response.json();
      if (result.checkoutUrl) {
        toast.success('Direcionando para o pagamento seguro na Cakto...');
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error('URL de checkout inválida retornada pelo servidor.');
      }

    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao processar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative premium gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center space-y-4">
        <div className="flex justify-center mb-2">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
            <span className="text-3xl font-heading font-medium tracking-wide bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">Lumière</span>
          </Link>
        </div>
        
        {/* Subtitle / Header of the strategic consultation */}
        <div className="space-y-2">
          <span className="px-3.5 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-primary text-[10px] font-bold tracking-widest uppercase inline-block">
            Consultoria de Escala & Gestão
          </span>
          <h2 className="text-3xl md:text-4xl font-light font-heading tracking-tight text-white leading-tight">
            Diagnóstico Estratégico LumièreOS
          </h2>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto font-light leading-relaxed">
            Avalie a eficiência operacional de sua empresa de beleza. Nosso algoritmo analisará sua estrutura para propor a arquitetura perfeita com garantia de 7 dias pela Cakto.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-zinc-900/40 backdrop-blur-xl py-10 px-6 sm:px-10 shadow-3xl border border-white/10 sm:rounded-3xl space-y-8 relative">
          
          {/* Back to Home Button - Always present in all steps */}
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <button 
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors group cursor-pointer"
              id="back-to-home-top-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
              <span>Voltar para página inicial</span>
            </button>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Fase {step} de 3</span>
          </div>

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
                    : 'bg-black/40 text-zinc-500 border-white/5 cursor-not-allowed'
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
                  <span>Passo 1: Identificação da Empresa & Localização</span>
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-light">
                  Insira os dados cadastrais necessários para fundamentar a primeira etapa de análise do ecossistema.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownerName" className="text-zinc-300">Seu Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="ownerName"
                        name="ownerName"
                        required
                        placeholder="Ex: Dr. Roberto Alencar"
                        value={formData.ownerName}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salonName" className="text-zinc-300">Nome da Empresa / Estabelecimento</Label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="salonName"
                        name="salonName"
                        required
                        placeholder="Ex: Belle Epoque Salon & Spa"
                        value={formData.salonName}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-300">E-mail de Contato Executivo</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="diretoria@seuestabelecimento.com"
                        value={formData.email}
                        onChange={handleChange}
                        className="bg-black/50 border-white/10 h-12 pl-11 rounded-xl focus:border-primary/50 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="phone" className="text-zinc-300">WhatsApp Direto</Label>
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
                    <Label htmlFor="state" className="text-zinc-300">UF (Estado)</Label>
                    <Input
                      id="state"
                      name="state"
                      required
                      placeholder="SP"
                      maxLength={2}
                      value={formData.state}
                      onChange={handleChange}
                      className="bg-black/50 border-white/10 h-12 rounded-xl focus:border-primary/50 text-white text-center font-semibold uppercase"
                    />
                  </div>
                </div>

                {/* Segment Selection */}
                <div className="space-y-2 pt-2">
                  <Label className="text-zinc-300 font-medium">Segmento Principal do Negócio</Label>
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

              {/* Action area */}
              <div className="pt-4 flex justify-between items-center">
                <button 
                  type="button"
                  onClick={() => navigate("/")}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  ← Voltar para a Landing Page
                </button>
                <Button
                  type="button"
                  id="btn-step1-continue"
                  disabled={!isStep1Valid}
                  onClick={() => setStep(2)}
                  className="rounded-full h-12 px-7 bg-primary hover:bg-gold-500 text-black font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                >
                  <span>Prosseguir com a análise</span>
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
                  <span>Passo 2: Dimensionamento de Força de Trabalho</span>
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-light">
                  A volumetria e a complexidade de regras de comissão variam de acordo com o porte da equipe. Quantos profissionais atuam hoje sob sua gestão?
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <Label className="text-zinc-300 font-medium">Selecione a quantidade de profissionais integrados:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="professionals-options-grid">
                  {[
                    { id: 'Apenas eu', label: 'Operação Individual (Apenas Eu)', desc: 'Foco em agendamento, agenda pessoal e faturamento básico.' },
                    { id: '2 a 5', label: 'De 2 a 5 profissionais', desc: 'Atendimentos intimistas. Necessita rateio simples e checklist essencial.' },
                    { id: '6 a 10', label: 'De 6 a 10 profissionais', desc: 'Sua estrutura exige regras sólidas de faturamento e governança diária.' },
                    { id: '11 a 20', label: 'De 11 a 20 profissionais', desc: 'Média/grande estrutura. Rateio robusto e checklists automatizados.' },
                    { id: 'Mais de 20', label: 'Mais de 20 profissionais (Rede / Franquia)', desc: 'Multiunidade estratégica. Exige Governança, Analytics com IA e auditorias.' }
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
                      <span className="text-[10px] text-zinc-500 font-light mt-1">{option.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <Button
                  type="button"
                  id="btn-step2-back"
                  onClick={() => setStep(1)}
                  className="rounded-full h-12 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold uppercase tracking-wider text-xs flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar ao Passo 1</span>
                </Button>
                
                <button 
                  type="button"
                  onClick={() => navigate("/")}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  ← Abandonar Diagnóstico
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Relatório de Diagnóstico Estratégico (Antigo Onboarding Final) */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in" id="step-3-container">
              
              <div className="space-y-2 text-center pb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest mb-2 font-sans animate-pulse">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  <span>Diagnóstico Concluído com Sucesso</span>
                </div>
                <h3 className="text-xl md:text-2xl font-heading text-white">
                  Relatório de Alinhamento LumièreOS
                </h3>
                <p className="text-xs text-zinc-400 font-light max-w-md mx-auto leading-relaxed">
                  Com base no perfil operacional enviado, nosso algoritmo de implantação definiu a arquitetura ideal de licenciamento para o seu negócio.
                </p>
              </div>

              {/* RELATÓRIO EXECUTIVO DE CONSULTORIA */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-black/80 to-zinc-900/40 border border-primary/20 space-y-6 shadow-2xl relative overflow-hidden" id="recommended-plan-card">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
                
                {/* Meta header */}
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Documento: Recomendação Oficial</span>
                  <span className="text-[10px] font-mono text-primary font-bold">LUMIÈRE EXECUTIVE REPORT</span>
                </div>

                {/* Analyzed summary table */}
                <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 block">Estabelecimento</span>
                    <span className="text-xs font-semibold text-white truncate block">{formData.salonName || "Lumière Salon"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 block">Segmento</span>
                    <span className="text-xs font-semibold text-white block">{formData.businessSegment || "Estética & Beleza"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 block">Proprietário</span>
                    <span className="text-xs font-semibold text-white truncate block">{formData.ownerName || "Roberto Alencar"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-zinc-500 block">Dimensão de Equipe</span>
                    <span className="text-xs font-semibold text-white block">{formData.estimatedProfessionals || "Não informada"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-primary">Plano Operacional Indicado</span>
                    <h4 className="text-2xl font-heading font-medium tracking-wide text-white">Lumière {reco.name}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 font-light block">Mensalidade</span>
                    <span className="text-xl font-heading font-bold text-primary">{reco.price}</span>
                  </div>
                </div>

                <div className="py-2.5 border-y border-white/5 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-light">Capacidade Habilitada</span>
                  <span className="text-primary font-semibold font-sans">{reco.maxProfessionals}</span>
                </div>

                <div className="space-y-3 pt-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">Recursos e Benefícios Estruturados</span>
                  <ul className="space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2" id="plan-benefits-list">
                    {reco.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-300 font-light">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Security and Cakto Guarantee stamp */}
                <div className="pt-4 border-t border-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-primary">
                  <div className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Transação 100% Protegida & Criptografada</span>
                  </div>
                  <span className="font-mono text-[9px] bg-primary/10 text-primary px-3 py-1 rounded border border-primary/20 uppercase tracking-wider">
                    GARANTIA DE 7 DIAS PELA CAKTO
                  </span>
                </div>
              </div>

              {/* Botão de Confirmação & Ativação */}
              <div className="space-y-4 pt-2">
                <Button
                  type="button"
                  id="btn-confirm-preview-email"
                  disabled={loading}
                  onClick={() => handleSubmit()}
                  className="w-full rounded-full h-14 bg-primary hover:bg-gold-400 text-black font-semibold uppercase tracking-wider text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_25px_rgba(212,175,55,0.25)] cursor-pointer"
                >
                  {loading ? (
                    <span>Processando...</span>
                  ) : (
                    <>
                      <span>Continuar para pagamento seguro</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <div className="flex justify-between items-center text-xs text-zinc-500 font-light pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Reajustar Passo 2</span>
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => navigate("/")}
                    className="hover:text-white transition-colors"
                  >
                    ← Cancelar Diagnóstico
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="text-center pt-2 border-t border-white/5">
            <Link to="/login" className="text-xs text-zinc-400 hover:text-primary transition-colors block">
              Já possui conta cadastrada? <span className="text-primary font-medium hover:underline">Acesse aqui</span>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

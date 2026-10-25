import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLexicon } from '../../hooks/useLexicon';
import { db } from '../../lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { 
  Building2, 
  Users, 
  Scissors, 
  Briefcase, 
  UserRound, 
  Target, 
  ClipboardCheck, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  MessageSquare,
  Activity,
  Check,
  Palette,
  SlidersHorizontal,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OFFICIAL_SUPPORT_WHATSAPP } from '../../config/billing';
import { NicheType } from '../../types';
import { ContextConfigService } from '../../services/contextConfigService';
import { toast } from 'sonner';

interface NicheOption {
  id: NicheType;
  title: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  clientTerm: string;
  workstationTerm: string;
  flowItemTerm: string;
}

const NICHE_OPTIONS: NicheOption[] = [
  {
    id: 'salon',
    title: 'Salão de Beleza & Barbearia',
    badge: 'Beleza & Estética',
    description: 'Fluxo visual com cadeiras, comandas operacionais e comissões integradas.',
    icon: Scissors,
    clientTerm: 'Cliente',
    workstationTerm: 'Cadeira / Bancada',
    flowItemTerm: 'Comanda'
  },
  {
    id: 'clinic',
    title: 'Clínica & Consultório',
    badge: 'Saúde & Terapias',
    description: 'Gestão focada em prontuários, agendamentos clínicos e salas de consulta.',
    icon: Activity,
    clientTerm: 'Paciente',
    workstationTerm: 'Sala / Consultório',
    flowItemTerm: 'Prontuário'
  },
  {
    id: 'studio',
    title: 'Estúdio & Ateliê Criativo',
    badge: 'Tatuagem, Foto & Arte',
    description: 'Ideal para sessões agendadas, estações de trabalho e ordens de serviço.',
    icon: Sparkles,
    clientTerm: 'Cliente',
    workstationTerm: 'Estação / Espaço',
    flowItemTerm: 'Ordem de Serviço'
  },
  {
    id: 'freelancer',
    title: 'Profissional Liberal & Autônomo',
    badge: 'Carreira Solo / PJ',
    description: 'Simplificado para quem atua sozinho, sem comandas e focado em propostas.',
    icon: Briefcase,
    clientTerm: 'Contratante',
    workstationTerm: 'Meu Espaço',
    flowItemTerm: 'Proposta / Pedido'
  }
];

export default function OnboardingSetupHub() {
  const navigate = useNavigate();
  const { salonData } = useAuth();
  const { lex, segment, niche: currentNiche } = useLexicon();

  const [selectedNiche, setSelectedNiche] = useState<NicheType>('salon');
  const [savingContext, setSavingContext] = useState(false);

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    team: false,
    services: false,
    clients: false,
    goals: false,
    checklists: false
  });
  const [checkingProgress, setCheckingProgress] = useState(true);

  // Inicializar o nicho selecionado a partir do salonData existente
  useEffect(() => {
    if (salonData?.contextConfig?.niche) {
      setSelectedNiche(salonData.contextConfig.niche);
    } else if (salonData?.managementMode === 'liberal') {
      setSelectedNiche('freelancer');
    } else if (salonData?.businessType === 'clinic' || salonData?.segment === 'health') {
      setSelectedNiche('clinic');
    } else if (salonData?.businessType === 'studio') {
      setSelectedNiche('studio');
    } else if (salonData?.businessType === 'agency' || salonData?.segment === 'agency') {
      setSelectedNiche('agency');
    } else if (salonData?.businessType === 'consulting' || salonData?.segment === 'consulting') {
      setSelectedNiche('consulting');
    } else {
      setSelectedNiche('salon');
    }
  }, [salonData]);

  useEffect(() => {
    async function checkOnboardingStatus() {
      if (!salonData?.id) {
        setCheckingProgress(false);
        return;
      }
      try {
        const salonId = salonData.id;
        const [prosSnap, servSnap, cliSnap, goalsSnap, checkSnap] = await Promise.all([
          getDocs(query(collection(db, 'salons', salonId, 'professionals'), limit(1))),
          getDocs(query(collection(db, 'salons', salonId, 'services'), limit(1))),
          getDocs(query(collection(db, 'salons', salonId, 'clients'), limit(1))),
          getDocs(query(collection(db, 'salons', salonId, 'goals'), limit(1))),
          getDocs(query(collection(db, 'salons', salonId, 'checklists'), limit(1))),
        ]);

        setCompletedSteps({
          team: !prosSnap.empty,
          services: !servSnap.empty,
          clients: !cliSnap.empty,
          goals: !goalsSnap.empty || Boolean(salonData.monthlyGoal && salonData.monthlyGoal > 0),
          checklists: !checkSnap.empty,
        });
      } catch (err) {
        console.error('Erro ao verificar progresso do onboarding:', err);
      } finally {
        setCheckingProgress(false);
      }
    }

    checkOnboardingStatus();
  }, [salonData]);

  const handleSelectNiche = async (nicheId: NicheType) => {
    setSelectedNiche(nicheId);
    try {
      await ContextConfigService.initializeContextConfig(nicheId);
      toast.success(`Contexto adaptado para ${NICHE_OPTIONS.find(n => n.id === nicheId)?.title || nicheId}!`);
    } catch (e: any) {
      console.warn('Erro ao salvar contexto imediato:', e);
    }
  };

  const handleFinishOnboarding = async () => {
    setSavingContext(true);
    try {
      await ContextConfigService.initializeContextConfig(selectedNiche);
      toast.success('Configuração de contexto salva com sucesso!');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Erro ao finalizar onboarding:', err);
      // Mesmo se a chamada falhar offline, direcionar para o dashboard
      toast.info('Acessando painel principal...');
      navigate('/dashboard', { replace: true });
    } finally {
      setSavingContext(false);
    }
  };

  const ServiceIcon = selectedNiche === 'clinic' ? Activity : (selectedNiche === 'salon' ? Scissors : Briefcase);

  const setupItems = [
    { 
      id: 'team',
      title: lex.professionals || 'Equipe & Especialistas', 
      description: selectedNiche === 'freelancer' 
        ? 'Configuração de perfil individual e parâmetros de atuação.' 
        : 'Cadastre seus colaboradores e especialistas ou gere o link de convite para acesso individual.', 
      path: '/onboarding/equipe', 
      dashboardPath: '/dashboard/equipe?onboarding=1',
      icon: Users, 
      action: `Configurar ${lex.professionals.toLowerCase()}` 
    },
    { 
      id: 'services',
      title: lex.services || 'Catálogo de Serviços', 
      description: 'Importe modelos prontos do seu segmento com 1 clique ou cadastre seus serviços e contratos.', 
      path: '/onboarding/servicos', 
      dashboardPath: '/dashboard/servicos?onboarding=1',
      icon: ServiceIcon, 
      action: `Configurar ${lex.services.toLowerCase()}` 
    },
    { 
      id: 'clients',
      title: `${lex.clients || 'Clientes'} & CRM`, 
      description: `Importe sua carteira atual por planilha CSV/Excel ou cadastre seus primeiros ${lex.clients.toLowerCase()} ativos.`, 
      path: '/dashboard/clientes?onboarding=1', 
      dashboardPath: '/dashboard/clientes?onboarding=1',
      icon: UserRound, 
      action: `Configurar ${lex.clients.toLowerCase()}` 
    }
  ];

  const optionalItems = [
    { 
      id: 'goals',
      title: lex.goals || 'Metas de Faturamento', 
      description: 'Defina a meta mensal da empresa e acompanhe o ritmo diário.', 
      path: '/onboarding/metas', 
      icon: Target 
    },
    { 
      id: 'checklists',
      title: lex.checklists || 'Checklists & Processos', 
      description: 'Padronize as rotinas operacionais e critérios de qualidade.', 
      path: '/onboarding/checklist', 
      icon: ClipboardCheck 
    }
  ];

  const totalCompleted = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = Math.round((totalCompleted / 5) * 100);

  const openWhatsAppSupport = () => {
    const text = encodeURIComponent(`Olá! Estou configurando a empresa "${salonData?.name || ''}" no LumièreOS e gostaria de auxílio no onboarding.`);
    window.open(`https://wa.me/${OFFICIAL_SUPPORT_WHATSAPP}?text=${text}`, '_blank');
  };

  const activeNicheConfig = NICHE_OPTIONS.find(n => n.id === selectedNiche) || NICHE_OPTIONS[0];

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-accent border border-primary/20 flex items-center justify-center mb-4 shadow-sm">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold mb-2">
            Implantação Guiada • Configuração de Contexto
          </p>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight">
            Prepare seu <span className="font-semibold text-primary">{activeNicheConfig.title.split('&')[0]}</span> para decolar
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto mt-2">
            O LumièreOS adapta seu vocabulário, rotinas e ferramentas automaticamente conforme o nicho da sua empresa.
          </p>
        </div>

        {/* SELETOR DE CONTEXTO & NICHO */}
        <div className="mb-8 bg-card border border-primary/20 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Qual é o modelo da sua operação?
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Ajusta todo o vocabulário e módulos do sistema
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {NICHE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedNiche === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectNiche(opt.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-sm text-foreground ring-1 ring-primary/40'
                      : 'bg-background/60 border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Ativo
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-foreground leading-tight mb-1">
                      {opt.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-3">
                      {opt.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/60 text-[10px] space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pessoa:</span>
                      <span className="font-semibold text-foreground">{opt.clientTerm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Local:</span>
                      <span className="font-semibold text-foreground">{opt.workstationTerm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fluxo:</span>
                      <span className="font-semibold text-foreground">{opt.flowItemTerm}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-card border rounded-2xl p-4 sm:p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Progresso do Onboarding
            </span>
            <span className="text-xs font-bold text-primary">
              {totalCompleted} de 5 etapas concluídas ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 rounded-full" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>

        {/* Essential Setup Cards */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs uppercase tracking-widest text-primary font-semibold">Passos Principais</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {setupItems.map((item) => {
            const Icon = item.icon;
            const isDone = completedSteps[item.id];
            return (
              <div 
                key={item.id} 
                className={`bg-card border rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200 ${
                  isDone ? 'border-emerald-500/30' : 'border-border hover:border-primary/20 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isDone ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-base">{item.title}</h3>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Configurado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={() => navigate(item.path)} 
                  variant={isDone ? 'outline' : 'default'}
                  className={`w-full sm:w-auto shrink-0 font-medium rounded-xl h-10 px-5 ${
                    isDone ? 'border-border text-foreground hover:bg-secondary' : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                >
                  {isDone ? 'Revisar' : item.action} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Optional Items */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Governança & Metas</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {optionalItems.map((item) => {
              const Icon = item.icon;
              const isDone = completedSteps[item.id];
              return (
                <button 
                  key={item.id} 
                  onClick={() => navigate(item.path)} 
                  className={`text-left bg-card border rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 ${
                    isDone ? 'border-emerald-500/30' : 'border-border hover:border-primary/20 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-emerald-500/10 text-emerald-500' : 'bg-secondary text-muted-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={openWhatsAppSupport}
              className="inline-flex items-center gap-2 text-xs text-emerald-500 hover:underline font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              Precisa de ajuda na implantação? Fale no WhatsApp (17) 99614-0963
            </button>
          </div>
          
          <Button 
            disabled={savingContext}
            onClick={handleFinishOnboarding} 
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-11 px-7 shadow-md"
          >
            {savingContext ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando Contexto...
              </>
            ) : (
              <>
                Acessar Painel Principal <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}

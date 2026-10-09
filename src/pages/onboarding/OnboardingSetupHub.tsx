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
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OFFICIAL_SUPPORT_WHATSAPP } from '../../config/billing';

export default function OnboardingSetupHub() {
  const navigate = useNavigate();
  const { salonData } = useAuth();
  const { lex, segment } = useLexicon();

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    team: false,
    services: false,
    clients: false,
    goals: false,
    checklists: false
  });
  const [checkingProgress, setCheckingProgress] = useState(true);

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

  const ServiceIcon = segment === 'beauty' ? Scissors : Briefcase;

  const setupItems = [
    { 
      id: 'team',
      title: lex.professionals || 'Equipe & Pessoas', 
      description: 'Cadastre seus colaboradores e especialistas ou gere o link de convite para acesso individual.', 
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
      description: 'Importe sua carteira atual por planilha CSV/Excel ou cadastre seus primeiros clientes ativos.', 
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
      description: 'Defina a meta mensal da empresa e acompanhe o ritmo diário da equipe.', 
      path: '/onboarding/metas', 
      icon: Target 
    },
    { 
      id: 'checklists',
      title: lex.checklists || 'Checklists & Processos', 
      description: 'Padronize as rotinas operacionais e critérios de qualidade da equipe.', 
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

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-accent border border-primary/20 flex items-center justify-center mb-4 shadow-sm">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-bold mb-2">
            Implantação Guiada • Empresas & Pessoas
          </p>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight">
            Vamos deixar o seu <span className="text-primary font-normal">LumièreOS</span> pronto
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto mt-3 leading-relaxed">
            Estruture sua operação e sua equipe em poucos minutos. Tudo o que você configurar agora poderá ser ajustado a qualquer momento no painel.
          </p>
        </div>

        {/* Company Status & Progress Bar */}
        <div className="bg-card border border-emerald-500/20 rounded-2xl p-5 mb-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{salonData?.name || 'Sua Empresa'} está ativa</p>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                    {lex.company}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Progresso da configuração inicial: <strong>{totalCompleted} de 5 etapas concluídas</strong>
                </p>
              </div>
            </div>

            <Button 
              onClick={() => navigate('/dashboard', { replace: true })} 
              variant="outline"
              className="shrink-0 rounded-xl text-xs font-semibold h-9 border-primary/30 text-primary hover:bg-primary/10"
            >
              Ir direto ao Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>

          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500" 
              style={{ width: `${ Math.max(10, progressPercent) }%` }}
            />
          </div>
        </div>

        {/* Core 3 Pillars */}
        <div className="grid md:grid-cols-3 gap-4">
          {setupItems.map((item) => {
            const Icon = item.icon;
            const isDone = completedSteps[item.id];
            return (
              <div 
                key={item.id} 
                className={`bg-card border rounded-2xl p-5 flex flex-col shadow-sm transition-all duration-200 ${
                  isDone 
                    ? 'border-emerald-500/30 bg-emerald-500/[0.02]' 
                    : 'border-border hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${
                    isDone ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-accent border-primary/15 text-primary'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {!checkingProgress && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 ${
                      isDone 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {isDone ? <><Check className="w-3 h-3" /> Concluído</> : 'Pendente'}
                    </span>
                  )}
                </div>

                <h2 className="text-base font-semibold">{item.title}</h2>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2 flex-1">{item.description}</p>
                
                <Button 
                  onClick={() => navigate(item.path)} 
                  variant={isDone ? 'outline' : 'default'}
                  className={`mt-5 w-full font-semibold rounded-xl h-10 text-xs ${
                    isDone 
                      ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' 
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                >
                  {isDone ? `Revisar ${item.title.toLowerCase()}` : item.action}
                  <ArrowRight className="w-3.5 h-3.5 ml-2" />
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
            onClick={() => navigate('/dashboard', { replace: true })} 
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-11 px-7 shadow-md"
          >
            Acessar Painel Principal <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

      </div>
    </div>
  );
}

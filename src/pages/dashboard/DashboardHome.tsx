import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Users, 
  Scissors, 
  UserPlus, 
  CalendarPlus, 
  ListTodo, 
  Crown, 
  Briefcase, 
  FileText, 
  Compass, 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfessionalDashboard from './ProfessionalDashboard';
import { useLumi } from '../../lumi/hooks/useLumi';
import { useSalonPerformanceRanking } from '../../hooks/useSalonPerformanceRanking';
import { LumiExecutiveAdvisor } from '../../components/lumi/LumiExecutiveAdvisor';
import { LumiInsightsList } from '../../components/lumi/LumiInsightsList';
import { LumiRecommendationsList } from '../../components/lumi/LumiRecommendationsList';
import { LumiAlertsList } from '../../components/lumi/LumiAlertsList';
import { BusinessPulse } from '../../components/lumi/BusinessPulse';
import { DailyPriorityCard } from '../../components/lumi/DailyPriorityCard';
import { LumiTimeline } from '../../components/lumi/LumiTimeline';
import { LumiOpportunitySuite } from '../../components/lumi/LumiOpportunitySuite';
import { LumiDailySummary } from '../../components/lumi/LumiDailySummary';
import { LumiereIAInsights } from '../../components/dashboard/LumiereIAInsights';
import { LumiSystemReadinessAlert } from '../../components/lumi/LumiSystemReadinessAlert';

export default function DashboardHome() {
  const { salonData, userData, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    loading: lumiLoading, 
    context,
    metrics: lumiMetrics, 
    healthScore: lumiHealthScore, 
    alerts: lumiAlerts, 
    insights: lumiInsights, 
    recommendations: lumiRecommendations, 
    aiNarrative, 
    runAnalysis, 
    activeProvider, 
    providerType, 
    switchProvider 
  } = useLumi(salonData?.id);
  
  const [viewMode, setViewMode] = useState<'detailed' | 'minimalist'>('detailed');

  const currentMonthStr = useMemo(() => new Date().toISOString().substring(0, 7), []);
  const [activeRankingMonth, setActiveRankingMonth] = useState<string>(currentMonthStr);
  const { professionalsPerformance, latestActiveMonth, loading: rankingLoading } = useSalonPerformanceRanking(salonData?.id, activeRankingMonth);

  useEffect(() => {
    if (latestActiveMonth && activeRankingMonth === currentMonthStr && !rankingLoading) {
      const hasActive = professionalsPerformance.some(p => p.totalRevenue > 0 || p.totalChecklists > 0 || p.totalGoals > 0);
      if (!hasActive && latestActiveMonth !== currentMonthStr) {
        setActiveRankingMonth(latestActiveMonth);
      }
    }
  }, [latestActiveMonth, activeRankingMonth, currentMonthStr, professionalsPerformance, rankingLoading]);

  const topProfessionalName = useMemo(() => {
    if (professionalsPerformance && professionalsPerformance.length > 0) {
      const activePros = professionalsPerformance.filter(p => p.totalRevenue > 0 || p.totalChecklists > 0 || p.totalGoals > 0);
      if (activePros.length > 0) {
        return activePros[0].name || activePros[0].fullName || 'Sem dados suficientes';
      }
    }
    return 'Sem dados suficientes';
  }, [professionalsPerformance]);

  const topOpportunityText = useMemo(() => {
    if (lumiRecommendations && lumiRecommendations.length > 0) {
      return lumiRecommendations[0].title;
    }
    return 'Sem dados suficientes';
  }, [lumiRecommendations]);

  const topAttentionText = useMemo(() => {
    if (lumiAlerts && lumiAlerts.length > 0) {
      return lumiAlerts[0].title;
    }
    return 'Sem dados suficientes';
  }, [lumiAlerts]);

  const timelineEvents = useMemo(() => {
    const events: any[] = [];
    events.push({
      id: 'welcome',
      type: 'welcome',
      title: 'Sistema iniciado.',
      description: 'Lumi Intelligence Engine ativa e monitorando a operação.',
      time: '08:00'
    });
    if (lumiAlerts && lumiAlerts.length > 0) {
      events.push({
        id: 'alert_1',
        type: 'alert',
        title: lumiAlerts[0].title,
        description: lumiAlerts[0].description,
        time: '09:15'
      });
    }
    if (lumiInsights && lumiInsights.length > 0) {
      events.push({
        id: 'insight_1',
        type: 'insight',
        title: lumiInsights[0].title,
        description: lumiInsights[0].description,
        time: '10:30'
      });
    }
    return events;
  }, [lumiAlerts, lumiInsights]);

  const clientMetrics = useMemo(() => {
    if (!salonData?.id) return undefined;
    const todayStr = new Date().toISOString().substring(0, 10);
    const currentMonthStr = todayStr.substring(0, 7);

    const todayAppts = (context?.appointments || []).filter(a => a.date === todayStr);
    const scheduledCount = todayAppts.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length;
    const completedCount = todayAppts.filter(a => a.status === 'completed').length;
    const pendingCount = todayAppts.filter(a => a.status === 'scheduled').length;

    const currentMonthGoals = (context?.goals || []).filter(g => g.month === currentMonthStr);
    const monthlyGoal = currentMonthGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);

    const todayChecklists = (context?.checklistRuns || []).filter(c => c.date === todayStr);

    return {
      monthRevenue: lumiMetrics?.totalRevenue || 0,
      monthlyGoal: monthlyGoal > 0 ? monthlyGoal : undefined,
      scheduledAppointments: scheduledCount,
      completedAppointments: completedCount,
      pendingAppointments: pendingCount,
      checklistRunsCount: todayChecklists.length,
    };
  }, [salonData?.id, context, lumiMetrics]);

  if (isPlatformAdmin) {
    return (
      <div className="bg-[#0c0c0e] p-8 text-center border border-[#D4AF37]/20 rounded-3xl max-w-lg mx-auto mt-12">
        <Crown className="w-12 h-12 text-[#D4AF37] mx-auto mb-4 animate-pulse filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
        <h2 className="text-xl font-heading mb-2 text-white">Painel Master Ativo</h2>
        <p className="text-xs text-[#a1a1aa] mb-6 leading-relaxed">Você está autenticado como Administrador Global da LumiereOS. Acesse a área de gerenciamento para administrar os salões afiliados.</p>
        <Button onClick={() => navigate('/master')} className="bg-[#D4AF37] hover:bg-gold-550 text-black font-semibold rounded-xl text-xs h-10 px-6">
          Ir para o Painel Master
        </Button>
      </div>
    );
  }

  if (lumiLoading || !salonData?.id) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
        <span className="text-xs text-[#a1a1aa] tracking-widest font-mono uppercase animate-pulse">Sincronizando LumiereOS...</span>
      </div>
    );
  }

  if (userData?.role === 'professional' || location.pathname.endsWith('/meu-painel') || location.pathname.endsWith('/profissional')) {
    return <ProfessionalDashboard />;
  }

  const isOwnerOrManager = userData?.role === 'owner' || userData?.role === 'manager' || userData?.role === 'platform_admin';
  const isReceptionistOrAttendant = userData?.role === 'receptionist' || userData?.role === 'attendant';

  const roleDisplayInfo: Record<string, { label: string; badgeClass: string; desc: string }> = {
    owner: { 
      label: 'Proprietário', 
      badgeClass: 'text-amber-300 bg-amber-500/10 border-amber-400/40',
      desc: 'Visualização integral do salão: faturamento, equipe, checklists Lumière, metas e relatórios executivos.'
    },
    manager: { 
      label: 'Gerente', 
      badgeClass: 'text-blue-300 bg-blue-500/10 border-blue-400/40',
      desc: 'Gestão da operação diária: acompanhamento de metas, equipe, agendamentos, estoque e comissões.'
    },
    receptionist: { 
      label: 'Recepcionista', 
      badgeClass: 'text-purple-300 bg-purple-500/10 border-purple-400/40',
      desc: 'Atendimento & Recepção: controle de agenda, fluxo de clientes, checklists operacionais e serviços.'
    },
    attendant: { 
      label: 'Atendente', 
      badgeClass: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/40',
      desc: 'Apoio Operacional: consulta de agenda, cadastro ágil de clientes e conferência de checklists.'
    },
    professional: { 
      label: 'Profissional', 
      badgeClass: 'text-rose-300 bg-rose-500/10 border-rose-400/40',
      desc: 'Meu Painel Individual: agenda pessoal, histórico de atendimentos e comissões.'
    },
    platform_admin: { 
      label: 'Master Admin', 
      badgeClass: 'text-amber-300 bg-amber-500/20 border-amber-400/50',
      desc: 'Acesso global da plataforma LumiereOS.'
    }
  };
  const activeRoleBadge = roleDisplayInfo[userData?.role || 'owner'] || roleDisplayInfo.owner;

  return (
    <div className="space-y-6 md:space-y-8 font-sans pb-12 animate-fade-in">
      
      {/* Header Profile - Premium Luxury Styling */}
      <div className="relative overflow-hidden bg-card rounded-3xl border border-primary/20 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {salonData?.plan === 'founder' ? (
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-full flex items-center gap-2 leading-none shadow-sm">
                <Crown className="w-3.5 h-3.5" /> PLANO FOUNDER • ACESSO COMPLETO • ATUALIZAÇÕES INCLUÍDAS
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full flex items-center gap-1 leading-none shadow-sm">
                 <Crown className="w-3.5 h-3.5" /> ESTABELECIMENTO PARCEIRO LUMIÈRE
              </span>
            )}
            <span className={cn("text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5", activeRoleBadge.badgeClass)}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Modo: {activeRoleBadge.label}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight text-foreground font-heading">
            <span className="font-semibold text-foreground">{salonData.name}</span>
          </h1>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            Olá, <span className="text-foreground font-semibold">{userData?.fullName}</span>. {activeRoleBadge.desc}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 relative z-10">
           <Button onClick={() => navigate('/dashboard/agendamentos')} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-10 px-5 shadow-sm select-none">
             <CalendarPlus className="w-4 h-4 mr-2" />
             Novo Agendamento
           </Button>
           <Button onClick={() => navigate('/dashboard/clientes')} variant="outline" className="rounded-xl border-border hover:border-primary/40 text-foreground bg-secondary/50 text-xs h-10 px-5 font-medium">
             <UserPlus className="w-4 h-4 mr-2 text-primary" />
             Novo Cliente
           </Button>
        </div>
      </div>

      {/* Quick Access Shortcuts - Beautiful grid custom aligned for roles */}
      <div className="space-y-3.5">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Módulos de Acesso Rápido</span>
           </div>
           
           {/* View Toggle */}
           <div className="flex items-center bg-secondary border border-border rounded-xl p-0.5">
              <button 
                onClick={() => setViewMode('detailed')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-semibold rounded-lg uppercase tracking-wider transition-all",
                  viewMode === 'detailed' ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Detalhada
              </button>
              <button 
                onClick={() => setViewMode('minimalist')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-semibold rounded-lg uppercase tracking-wider transition-all",
                  viewMode === 'minimalist' ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Minimalista
              </button>
           </div>
         </div>
         <div className={cn("grid gap-3.5", 
           isReceptionistOrAttendant ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
         )}>
            <Link to="/dashboard/agendamentos" className="bg-card hover:bg-secondary/70 transition-all duration-300 border border-border hover:border-primary/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-sm group">
               <div className="p-3 bg-accent rounded-xl border border-primary/15 group-hover:border-primary/30 group-hover:scale-105 transition-all duration-300">
                 <CalendarPlus className="w-5 h-5 text-primary" />
               </div>
               <span className="text-xs font-semibold text-foreground">Agenda</span>
            </Link>
            <Link to="/dashboard/clientes" className="bg-card hover:bg-secondary/70 transition-all duration-300 border border-border hover:border-primary/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-sm group">
               <div className="p-3 bg-accent rounded-xl border border-primary/15 group-hover:border-primary/30 group-hover:scale-105 transition-all duration-300">
                 <Users className="w-5 h-5 text-primary" />
               </div>
               <span className="text-xs font-semibold text-foreground">Clientes</span>
            </Link>
            <Link to="/dashboard/servicos" className="bg-card hover:bg-secondary/70 transition-all duration-300 border border-border hover:border-primary/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-sm group">
               <div className="p-3 bg-accent rounded-xl border border-primary/15 group-hover:border-primary/30 group-hover:scale-105 transition-all duration-300">
                 <Scissors className="w-5 h-5 text-primary" />
               </div>
               <span className="text-xs font-semibold text-foreground">Serviços</span>
            </Link>
            {isOwnerOrManager && (
              <>
                <Link to="/dashboard/equipe" className="bg-card hover:bg-secondary/70 transition-all duration-300 border border-border hover:border-primary/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-sm group">
                   <div className="p-3 bg-accent rounded-xl border border-primary/15 group-hover:border-primary/30 group-hover:scale-105 transition-all duration-300">
                     <Briefcase className="w-5 h-5 text-primary" />
                   </div>
                   <span className="text-xs font-semibold text-foreground">Equipe</span>
                </Link>
                <Link to="/dashboard/checklist" className="bg-card hover:bg-secondary/70 transition-all duration-300 border border-border hover:border-primary/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-sm group">
                   <div className="p-3 bg-accent rounded-xl border border-primary/15 group-hover:border-primary/30 group-hover:scale-105 transition-all duration-300">
                     <ListTodo className="w-5 h-5 text-primary" />
                   </div>
                   <span className="text-xs font-semibold text-foreground">Checklists</span>
                </Link>
                <button onClick={() => {
                  navigate('/dashboard/relatorios');
                }} className="bg-card hover:bg-secondary/70 transition-all duration-300 border border-border hover:border-primary/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-sm group w-full cursor-pointer">
                   <div className="p-3 bg-accent rounded-xl border border-primary/15 group-hover:border-primary/30 group-hover:scale-105 transition-all duration-300">
                     <FileText className="w-5 h-5 text-primary" />
                   </div>
                   <span className="text-xs font-semibold text-foreground flex items-center justify-center gap-1.5">
                     Relatórios
                   </span>
                </button>
              </>
            )}
         </div>
      </div>

      {/* Lumi Intelligence Suite - Premium Executive Suite */}
      <div className="space-y-6">
        {/* LumièreIA Insights Diários - Metas, Pendências e Alertas Financeiros */}
        <LumiereIAInsights
          salonId={salonData.id}
          salonName={salonData.name}
          userName={userData?.fullName}
          clientMetrics={clientMetrics}
        />

        {/* Alerta de Calibração e Força Total da Lumi */}
        <LumiSystemReadinessAlert
          salonName={salonData.name}
          configState={{
            hasGoals: Boolean(clientMetrics?.monthlyGoal && clientMetrics.monthlyGoal > 0) || Boolean(context?.goals && context.goals.length > 0),
            hasServices: Boolean(context?.services && context.services.length > 0),
            hasProfessionals: Boolean(context?.professionals && context.professionals.length > 0),
            hasCommissions: Boolean(context?.professionals && context.professionals.some(p => p.commissionRate !== undefined && p.commissionRate > 0)),
            hasChecklists: Boolean(context?.checklistRuns && context.checklistRuns.length > 0) || Boolean(clientMetrics?.checklistRunsCount && clientMetrics.checklistRunsCount > 0),
            hasSalonDetails: Boolean(salonData?.name && (salonData?.phone || salonData?.businessType)),
          }}
        />

        <LumiExecutiveAdvisor userName={userData?.fullName} mainRecommendation={lumiRecommendations.length > 0 ? { title: lumiRecommendations[0].title, action: lumiRecommendations[0].actionText || "Agir", url: lumiRecommendations[0].actionUrl || "/" } : undefined} 
          healthScore={lumiHealthScore}
          aiNarrative={aiNarrative}
          onRunAnalysis={runAnalysis}
          isLoading={lumiLoading}
          activeProvider={activeProvider}
          providerType={providerType}
          onSwitchProvider={switchProvider}
          topOpportunity={topOpportunityText}
          topAttention={topAttentionText}
          topProfessional={topProfessionalName}
        />

        {lumiRecommendations && lumiRecommendations.length > 0 && (
          <DailyPriorityCard 
            priority={lumiRecommendations[0].title}
            impact={lumiRecommendations[0].impact === "high" ? "Alto" : "Médio"}
            action={lumiRecommendations[0].actionText || "Resolver Agora"}
            url={lumiRecommendations[0].actionUrl || "/"}
          />
        )}

        {viewMode === 'detailed' && (
          <>
            <LumiDailySummary metrics={lumiMetrics} />
            <BusinessPulse healthScore={lumiHealthScore} />
            <LumiOpportunitySuite metrics={lumiMetrics} context={context} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
              <LumiInsightsList insights={lumiInsights} />
              <LumiRecommendationsList recommendations={lumiRecommendations} />
              </div>
              <div className="lg:col-span-1 space-y-6">
                <LumiTimeline events={timelineEvents} />
              </div>
            </div>
            <LumiAlertsList alerts={lumiAlerts} />
          </>
        )}
      </div>
    </div>
  );
}

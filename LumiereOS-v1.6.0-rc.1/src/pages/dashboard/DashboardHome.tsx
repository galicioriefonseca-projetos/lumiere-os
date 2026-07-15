import { useState, useMemo } from 'react';
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
  const { professionalsPerformance } = useSalonPerformanceRanking(salonData?.id, currentMonthStr);

  const topProfessionalName = useMemo(() => {
    if (professionalsPerformance && professionalsPerformance.length > 0) {
      const activePros = professionalsPerformance.filter(p => p.totalRevenue > 0 || p.totalChecklists > 0);
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

  return (
    <div className="space-y-6 md:space-y-8 font-sans pb-12 animate-fade-in">
      
      {/* Header Profile - Premium Luxury Styling */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0d0d11] to-[#050505] rounded-3xl border border-[#D4AF37]/15 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-80 h-80 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {salonData?.plan === 'founder' ? (
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] bg-[#D4AF37]/15 border border-[#D4AF37]/35 px-3 py-1.5 rounded-full flex items-center gap-2 leading-none shadow-[0_2px_15px_rgba(212,175,55,0.1)] animate-pulse">
                <Crown className="w-3.5 h-3.5 filter drop-shadow-[0_0_2px_rgba(212,175,55,0.4)]" /> PLANO FOUNDER • ACESSO COMPLETO • ATUALIZAÇÕES INCLUÍDAS
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-2.5 py-1 rounded-full flex items-center gap-1 leading-none shadow-[0_2px_10px_rgba(212,175,55,0.05)]">
                 <Crown className="w-3.5 h-3.5" /> ESTABELECIMENTO PARCEIRO LUMIÈRE
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white font-heading">
            <span className="font-semibold text-white">{salonData.name}</span>
          </h1>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            Olá, <span className="text-[#eeef] font-semibold">{userData?.fullName}</span>. Seu LumiereOS está de cara nova. Gerencie agendamentos, equipe, checklists Lumière e faturamento com facilidade.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 relative z-10">
           <Button onClick={() => navigate('/dashboard/agendamentos')} className="rounded-xl bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs h-10 px-5 shadow-[0_4px_15px_rgba(212,175,55,0.15)] select-none">
             <CalendarPlus className="w-4 h-4 mr-2" />
             Novo Agendamento
           </Button>
           <Button onClick={() => navigate('/dashboard/clientes')} variant="outline" className="rounded-xl border-white/10 hover:border-[#D4AF37]/40 text-white bg-white/[0.02] text-xs h-10 px-5 font-medium">
             <UserPlus className="w-4 h-4 mr-2 text-[#D4AF37]" />
             Novo Cliente
           </Button>
        </div>
      </div>

      {/* Quick Access Shortcuts - Beautiful grid custom aligned for roles */}
      <div className="space-y-3.5">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Módulos de Acesso Rápido</span>
           </div>
           
           {/* View Toggle */}
           <div className="flex items-center bg-[#0c0c0f] border border-white/5 rounded-xl p-0.5">
              <button 
                onClick={() => setViewMode('detailed')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-semibold rounded-lg uppercase tracking-wider font-mono transition-all",
                  viewMode === 'detailed' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Detalhada
              </button>
              <button 
                onClick={() => setViewMode('minimalist')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-semibold rounded-lg uppercase tracking-wider font-mono transition-all",
                  viewMode === 'minimalist' ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Minimalista
              </button>
           </div>
         </div>
         <div className={cn("grid gap-3.5", 
           isReceptionistOrAttendant ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
         )}>
            <Link to="/dashboard/agendamentos" className="bg-[#0c0c0f] hover:bg-gradient-to-b hover:from-[#131318] hover:to-[#0c0c0f] transition-all duration-300 border border-white/5 hover:border-[#D4AF37]/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-lg group">
               <div className="p-3 bg-[#D4AF37]/5 rounded-2xl border border-white/5 group-hover:bg-[#D4AF37]/10 group-hover:border-[#D4AF37]/30 transition-all duration-300">
                 <CalendarPlus className="w-5 h-5 text-[#D4AF37]" />
               </div>
               <span className="text-xs font-semibold text-slate-200">Agenda</span>
            </Link>
            <Link to="/dashboard/clientes" className="bg-[#0c0c0f] hover:bg-gradient-to-b hover:from-[#131318] hover:to-[#0c0c0f] transition-all duration-300 border border-white/5 hover:border-[#D4AF37]/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-lg group">
               <div className="p-3 bg-[#D4AF37]/5 rounded-2xl border border-white/5 group-hover:bg-[#D4AF37]/10 group-hover:border-[#D4AF37]/30 transition-all duration-300">
                 <Users className="w-5 h-5 text-[#D4AF37]" />
               </div>
               <span className="text-xs font-semibold text-slate-200">Clientes</span>
            </Link>
            <Link to="/dashboard/servicos" className="bg-[#0c0c0f] hover:bg-gradient-to-b hover:from-[#131318] hover:to-[#0c0c0f] transition-all duration-300 border border-white/5 hover:border-[#D4AF37]/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-lg group">
               <div className="p-3 bg-[#D4AF37]/5 rounded-2xl border border-white/5 group-hover:bg-[#D4AF37]/10 group-hover:border-[#D4AF37]/30 transition-all duration-300">
                 <Scissors className="w-5 h-5 text-[#D4AF37]" />
               </div>
               <span className="text-xs font-semibold text-slate-200">Serviços</span>
            </Link>
            {isOwnerOrManager && (
              <>
                <Link to="/dashboard/equipe" className="bg-[#0c0c0f] hover:bg-gradient-to-b hover:from-[#131318] hover:to-[#0c0c0f] transition-all duration-300 border border-white/5 hover:border-[#D4AF37]/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-lg group">
                   <div className="p-3 bg-[#D4AF37]/5 rounded-2xl border border-white/5 group-hover:bg-[#D4AF37]/10 group-hover:border-[#D4AF37]/30 transition-all duration-300">
                     <Briefcase className="w-5 h-5 text-[#D4AF37]" />
                   </div>
                   <span className="text-xs font-semibold text-slate-200">Equipe</span>
                </Link>
                <Link to="/dashboard/checklist" className="bg-[#0c0c0f] hover:bg-gradient-to-b hover:from-[#131318] hover:to-[#0c0c0f] transition-all duration-300 border border-white/5 hover:border-[#D4AF37]/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-lg group">
                   <div className="p-3 bg-[#D4AF37]/5 rounded-2xl border border-white/5 group-hover:bg-[#D4AF37]/10 group-hover:border-[#D4AF37]/30 transition-all duration-300">
                     <ListTodo className="w-5 h-5 text-[#D4AF37]" />
                   </div>
                   <span className="text-xs font-semibold text-slate-200">Checklists</span>
                </Link>
                <button onClick={() => {
                  navigate('/dashboard/relatorios');
                }} className="bg-[#0c0c0f] hover:bg-gradient-to-b hover:from-[#131318] hover:to-[#0c0c0f] transition-all duration-300 border border-white/5 hover:border-[#D4AF37]/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-lg group w-full">
                   <div className="p-3 bg-[#D4AF37]/5 rounded-2xl border border-white/5 group-hover:bg-[#D4AF37]/10 group-hover:border-[#D4AF37]/30 transition-all duration-300">
                     <FileText className="w-5 h-5 text-[#D4AF37]" />
                   </div>
                   <span className="text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5">
                     Relatórios
                   </span>
                </button>
              </>
            )}
         </div>
      </div>

      {/* Lumi Intelligence Suite - Premium Executive Suite */}
      <div className="space-y-6">
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

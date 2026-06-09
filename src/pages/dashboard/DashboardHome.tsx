import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getEvaluableFunctions, sanitizeFunctionSlug } from '../../lib/evaluation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  Users, 
  Scissors, 
  UserPlus, 
  CalendarPlus, 
  Target, 
  ListTodo, 
  Star, 
  TrendingUp, 
  Crown, 
  HelpCircle, 
  Sparkles,
  ArrowRight,
  Clock,
  Briefcase,
  AlertCircle,
  FileText,
  Lock,
  Compass,
  CreditCard
} from 'lucide-react';
import { formatBRL, cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import ProfessionalDashboard from './ProfessionalDashboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Appointment, Goal, ChecklistRun, Professional } from '../../types';
import { PaymentDialog } from '../../components/billing/PaymentDialog';
import { isPaymentDueInDays, isPaymentOverdue } from '../../lib/billing';
import { GeminiInsightCard } from '../../components/GeminiInsightCard';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts';

export default function DashboardHome() {
  const { salonData, userData, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);

  // Efeito para monitorar e validar status de faturamento/checkout da Stripe
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast.success('Assinatura configurada com sucesso. Estamos confirmando seu pagamento.');
      // Limpa os parâmetros da URL de forma segura
      searchParams.delete('checkout');
      setSearchParams(searchParams);
    } else if (checkout === 'cancel') {
      toast.error('Configuração de faturamento cancelada pelo usuário.');
      searchParams.delete('checkout');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<ChecklistRun[]>([]);                
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [isReportsDialogOpen, setIsReportsDialogOpen] = useState(false);
  const [isFinanceDialogOpen, setIsFinanceDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const [stats, setStats] = useState({
    clients: 0,
    goalTarget: 0,
    goalCurrent: 0,
    checklistPct: 0
  });

  const todayStr = new Date().toISOString().substring(0, 10);
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  // Checks for permissions
  const isOwnerOrManager = userData?.role === 'owner' || userData?.role === 'manager' || userData?.role === 'platform_admin' || userData?.role === 'admin';
  const isReceptionistOrAttendant = userData?.role === 'receptionist' || userData?.role === 'attendant';

  const evaluationTargets = useMemo(() => {
    const list: Array<{
      professionalId: string;
      professionalName: string;
      evaluationFunction: string;
      professional: Professional;
    }> = [];
    professionals.forEach((p) => {
      const funcs = getEvaluableFunctions(p);
      const mainFunc = funcs[0] || p.primaryFunction || p.professionalFunction || p.specialty || "Função não definida";
      list.push({
        professionalId: p.id,
        professionalName: p.name,
        evaluationFunction: mainFunc,
        professional: p
      });
    });
    return list;
  }, [professionals]);

  const findRunForTarget = (target: any, runs: ChecklistRun[]) => {
    return runs.find((r) => {
      if (r.evaluatedProfessionalId !== target.professionalId) return false;
      const runFunc = r.evaluationFunction || r.evaluatedFunction || r.professionalFunction || r.primaryFunction;
      if (runFunc) {
        return sanitizeFunctionSlug(runFunc) === sanitizeFunctionSlug(target.evaluationFunction);
      }
      const p = target.professional;
      const mainFunc = p.primaryFunction || p.professionalFunction || p.specialty || "Função não definida";
      return sanitizeFunctionSlug(target.evaluationFunction) === sanitizeFunctionSlug(mainFunc);
    });
  };

  useEffect(() => {
    if (!salonData) return;
    if (userData?.role === 'professional') {
      setLoading(false);
      return;
    }
    
    const unsubs: (() => void)[] = [];

    // Professionals
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(onSnapshot(qp, snap => {
        const allPros = snap.docs.map(doc => ({id: doc.id, ...doc.data()})) as Professional[];
        const filtered = allPros.filter(p => {
          const isActive =
            (p.isActive === true ||
             p.active === true ||
             p.status === "active" ||
             p.status === "ativo" ||
             (p.status === undefined && p.isActive !== false)) &&
            p.status !== "inactive" &&
            p.status !== "deleted" &&
            !p.deletedAt;
          if (!isActive) return false;
          const role = p.role || "professional";
          return ["professional", "manager", "receptionist", "attendant"].includes(role);
        });
        setProfessionals(filtered);
    }, err => {
        console.error("Erro no onSnapshot de profissionais:", err);
        setLoading(false);
    }));

    // Clients
    const qc = query(collection(db, `salons/${salonData.id}/clients`));
    unsubs.push(onSnapshot(qc, snap => {
        setStats(p => ({...p, clients: snap.docs.length}));
    }, err => {
        console.error("Erro no onSnapshot de clientes:", err);
        setLoading(false);
    }));

    // Appointments Today
    const qa = query(collection(db, `salons/${salonData.id}/appointments`), where('date', '==', todayStr));
    unsubs.push(onSnapshot(qa, snap => {
       const list = snap.docs.map(doc => ({id: doc.id, ...doc.data()})) as Appointment[];
       const sorted = list.sort((a, b) => a.time.localeCompare(b.time));
       setTodayAppointments(sorted);
    }, err => {
        console.error("Erro no onSnapshot de agendamentos:", err);
        setLoading(false);
    }));

    // All Appointments (for historical charts mapping)
    const qaAll = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(onSnapshot(qaAll, snap => {
       const list = snap.docs.map(doc => ({id: doc.id, ...doc.data()})) as Appointment[];
       setAllAppointments(list);
    }, err => {
        console.error("Erro no onSnapshot de todos agendamentos:", err);
    }));

    // General Salon Goals
    const qg = query(collection(db, `salons/${salonData.id}/goals`));
    unsubs.push(onSnapshot(qg, snap => {
       const arr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any) as Goal[];
       setGoals(arr);
     }, err => {
        console.error("Erro no onSnapshot de metas:", err);
        setLoading(false);
     }));

    // Checklist Today
    const qk = query(collection(db, `salons/${salonData.id}/checklistRuns`), where('date', '==', todayStr));
    unsubs.push(onSnapshot(qk, snap => {
       const runs = snap.docs.map(doc => ({id: doc.id, ...doc.data()}) as any) as ChecklistRun[];
       setChecklistRuns(runs);
       setLoading(false);
     }, err => {
        console.error("Erro no onSnapshot de checklistRuns:", err);
        setLoading(false);
     }));

    return () => unsubs.forEach(u => u());
  }, [salonData, userData?.role]);

  // Efeito derivado para calcular estatísticas compostas sem gerar dependência circular
  useEffect(() => {
    if (!salonData) return;
    
    // 1. Calcular estatísticas de metas baseadas em goals
    const currentGoal = goals.find(g => g.month === currentMonthStr);
    const goalTarget = currentGoal ? currentGoal.targetAmount : 0;
    const goalCurrent = currentGoal ? currentGoal.currentAmount : 0;

    // 2. Calcular porcentagem do checklist baseada em checklistRuns e professionals
    let checklistPct = 0;
    const isProfessionalEval = checklistRuns.some(r => r.evaluatedProfessionalId);
    
    if (isProfessionalEval) {
      const uniqueEvaluatedPros = new Set(
        checklistRuns
          .filter((r) => r.evaluatedProfessionalId)
          .map((r) => r.evaluatedProfessionalId)
      ).size;
      checklistPct = professionals.length > 0 ? Math.round((uniqueEvaluatedPros / professionals.length) * 100) : 0;
    } else if (checklistRuns.length > 0) {
      checklistPct = checklistRuns[0].completionPercentage || 0;
    }

    setStats(p => ({
      ...p,
      goalTarget,
      goalCurrent,
      checklistPct
    }));
  }, [goals, checklistRuns, professionals, salonData, currentMonthStr]);

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

  if (loading || !salonData) {
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

  const goalPct = stats.goalTarget > 0 ? Math.min(Math.round((stats.goalCurrent / stats.goalTarget) * 100), 100) : 0;

  // Last 6 months format helper
  const getLast6Months = () => {
    const list = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      list.push(`${y}-${m}`);
    }
    return list;
  };

  const formatMonthLabel = (monthStr: string) => {
    if (!monthStr || monthStr.length !== 7) return monthStr;
    const [year, month] = monthStr.split('-');
    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    const monthIdx = parseInt(month, 10) - 1;
    const shortYear = year.substring(2);
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${monthNames[monthIdx]}/${shortYear}`;
    }
    return monthStr;
  };

  const last6Months = getLast6Months();

  // Map and merge goals
  const chartData = last6Months.map(m => {
    const existingGoal = goals.find((g: any) => g.month === m);
    const monthAppointments = allAppointments.filter(appt => appt.date.startsWith(m));
    const completedAppointmentsCount = monthAppointments.filter(appt => appt.status === 'completed' || appt.status === 'scheduled').length;
    return {
      name: formatMonthLabel(m),
      Faturamento: existingGoal ? existingGoal.currentAmount : 0,
      Meta: existingGoal ? existingGoal.targetAmount : 0,
      Agendamentos: completedAppointmentsCount,
    };
  });

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
            Olá, <span className="text-[#eeef] font-semibold">{userData?.fullName}</span>. Seu LumiereOS está de cara nova. Gerencie agendamentos, equipe, checklists Essenza e faturamento com facilidade.
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

      {/* Billing Warnings & Actions */}
      {null}

      {/* Checklist Evaluated notification pending checklist (Owners / Managers) */}
      {isOwnerOrManager && professionals.filter(p => !checklistRuns.some(r => r.evaluatedProfessionalId === p.id)).length > 0 && (() => {
        const pendingOnes = professionals.filter(p => !checklistRuns.some(r => r.evaluatedProfessionalId === p.id));
        const names = pendingOnes.map(p => p.name).join(", ");
        return (
          <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/5 rounded-2xl shadow-lg relative overflow-hidden backdrop-blur-md">
             <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D4AF37]" />
             <div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                   <div className="bg-[#D4AF37]/10 p-2 rounded-xl border border-[#D4AF37]/25 mt-0.5">
                      <ListTodo className="w-5 h-5 text-[#D4AF37] animate-pulse" />
                   </div>
                   <div>
                      <p className="font-semibold text-[#D4AF37] text-sm flex items-center gap-1.5 leading-none">
                         Avaliação Diária Essenza: {pendingOnes.length} {pendingOnes.length === 1 ? 'Colaborador Pendente' : 'Colaboradores Pendentes'}
                      </p>
                      <p className="text-xs text-slate-300 font-light leading-relaxed mt-1.5">
                         Colaboradores pendentes hoje: <span className="text-white font-medium">{names}</span>. Registre a presença ou feedback deles hoje para acompanhar os relatórios diários.
                      </p>
                   </div>
                </div>
                <Button 
                   onClick={() => navigate('/dashboard/checklist')} 
                   className="w-full md:w-auto shrink-0 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs h-9 rounded-xl px-4"
                >
                   Avaliar Equipe
                </Button>
             </div>
          </div>
        );
      })()}

      {/* Quick Access Shortcuts - Beautiful grid custom aligned for roles */}
      <div className="space-y-3.5">
         <div className="flex items-center gap-2">
           <Compass className="w-4 h-4 text-[#D4AF37]" />
           <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Módulos de Acesso Rápido</span>
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
                  if (salonData?.plan === 'founder') {
                    navigate('/dashboard/relatorios');
                  } else {
                    setIsReportsDialogOpen(true);
                  }
                }} className="bg-[#0c0c0f] hover:bg-gradient-to-b hover:from-[#131318] hover:to-[#0c0c0f] transition-all duration-300 border border-white/5 hover:border-[#D4AF37]/35 p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-lg group w-full">
                   <div className="p-3 bg-[#D4AF37]/5 rounded-2xl border border-white/5 group-hover:bg-[#D4AF37]/10 group-hover:border-[#D4AF37]/30 transition-all duration-300">
                     <FileText className="w-5 h-5 text-[#D4AF37]" />
                   </div>
                   <span className="text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5">
                     Relatórios {salonData?.plan === 'founder' ? (
                        <span className="text-[8px] bg-amber-500/20 border border-amber-500/40 text-[#D4AF37] px-1 py-0.5 rounded uppercase leading-none font-mono tracking-wider">FOUNDER</span>
                      ) : (
                        <span className="text-[8px] bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#D4AF37] px-1 py-0.5 rounded uppercase leading-none font-mono tracking-wider">Premium</span>
                      )}
                   </span>
                </button>
              </>
            )}
         </div>
      </div>

      {/* Stats Cards Dashboard Indicators */}
      <div id="dashboard-stats-grid" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Today's appointments */}
        <Card className="border-[#D4AF37]/10 bg-[#0c0c0f] hover:border-[#D4AF37]/20 transition-all duration-200 rounded-2xl shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <CalendarPlus className="h-20 w-20 text-[#D4AF37]" />
          </div>
          <CardHeader className="pb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold font-mono">Agendamentos Hoje</span>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light tracking-tight text-white flex items-baseline gap-1.5">
              <span>{todayAppointments.length}</span>
              <span className="text-xs text-muted-foreground font-normal">atendimentos</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-none">Prontos para realização hoje</p>
          </CardContent>
        </Card>

        {/* Client database size */}
        <Card className="border-[#D4AF37]/10 bg-[#0c0c0f] hover:border-[#D4AF37]/20 transition-all duration-200 rounded-2xl shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Users className="h-20 w-20 text-[#D4AF37]" />
          </div>
          <CardHeader className="pb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold font-mono">Total Clientes</span>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light tracking-tight text-white flex items-baseline gap-1.5">
              <span>{stats.clients}</span>
              <span className="text-xs text-[#D4AF37] font-semibold">ativos</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-none">Base total de clientes salvos</p>
          </CardContent>
        </Card>

        {/* Operational / Checklist Percentage (Owners / Managers) */}
        {isOwnerOrManager ? (
          <Card className="border-[#D4AF37]/10 bg-[#0c0c0f] hover:border-[#D4AF37]/20 transition-all duration-200 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <ListTodo className="h-20 w-20 text-[#D4AF37]" />
            </div>
            <CardHeader className="pb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold font-mono">Aderência aos Checklists</span>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="text-3xl font-light tracking-tight text-white">
                {stats.checklistPct}%
              </div>
              <div className="space-y-1">
                 <div className="text-[9px] flex justify-between text-muted-foreground font-mono leading-none">
                    <span>Aproveitamento do dia</span>
                    <span>{stats.checklistPct}%</span>
                 </div>
                 <Progress value={stats.checklistPct} className="h-1 bg-black/40" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#D4AF37]/10 bg-[#0c0c0f] hover:border-[#D4AF37]/20 transition-all duration-200 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Briefcase className="h-20 w-20 text-[#D4AF37]" />
            </div>
            <CardHeader className="pb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold font-mono">Time Operacional</span>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-light tracking-tight text-white flex items-baseline gap-1.5">
                <span>{professionals.length}</span>
                <span className="text-xs text-muted-foreground font-normal">membros</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 leading-none">Profissionais cadastrados ativos</p>
            </CardContent>
          </Card>
        )}

        {/* Goal Indicator / Month Target Progress (Owners / Managers) */}
        {isOwnerOrManager ? (
          <Card className="border-[#D4AF37]/10 bg-[#0c0c0f] hover:border-[#D4AF37]/20 transition-all duration-200 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Target className="h-20 w-20 text-[#D4AF37]" />
            </div>
            <CardHeader className="pb-2 flex justify-between items-center w-full">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold font-mono">Meta de Faturamento</span>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {stats.goalTarget > 0 ? (
                <>
                  <div className="text-2xl font-semibold tracking-tight text-white leading-none">
                    {formatBRL(stats.goalCurrent)}
                  </div>
                  <div className="space-y-1">
                     <div className="text-[9px] flex justify-between text-muted-foreground font-mono leading-none">
                        <span>Alvo: {formatBRL(stats.goalTarget)}</span>
                        <span>{goalPct}%</span>
                     </div>
                     <Progress value={goalPct} className="h-1 bg-black/40" />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 py-1">
                  <div className="text-sm font-semibold text-slate-300 leading-none">Não Definida</div>
                  <button onClick={() => navigate('/dashboard/metas')} className="text-[10px] text-[#D4AF37] font-semibold hover:underline block leading-none text-left">
                    Configurar agora
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#D4AF37]/10 bg-[#0c0c0f] hover:border-[#D4AF37]/20 transition-all duration-200 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-5">
              <Lock className="h-16 w-16 text-[#D4AF37]" />
            </div>
            <CardHeader className="pb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold font-mono">Finanças</span>
            </CardHeader>
            <CardContent className="flex flex-col justify-center py-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#D4AF37]" /> Módulo reservado para gerência
              </span>
            </CardContent>
          </Card>
        )}

      </div>

      {isOwnerOrManager && (
        <GeminiInsightCard
          checklistPct={stats.checklistPct}
          goalCurrent={stats.goalCurrent}
          goalTarget={stats.goalTarget}
          professionalsCount={professionals.length}
        />
      )}

      {/* Main Grid: Agenda de Hoje (Left Col) & Sidebar indicators (Right Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
         {/* Today's Agenda (Col-Span 2) */}
         <div className="lg:col-span-2 space-y-3">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm text-slate-200 uppercase tracking-wider font-semibold font-heading">Agenda de Hoje</h3>
              </div>
              <Button onClick={() => navigate('/dashboard/agendamentos')} size="sm" variant="ghost" className="text-xs text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] h-8 rounded-lg select-none">
                Ver completa <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>

            <Card className="border-white/5 bg-[#0c0c0f] rounded-2xl shadow-xl overflow-hidden">
               <CardContent className="p-0">
                  {todayAppointments.length === 0 ? (
                     <div className="p-10 text-center space-y-3.5 flex flex-col items-center">
                        <div className="p-3 bg-white/[0.02] border border-white/5 text-muted-foreground rounded-2xl">
                          <CalendarPlus className="w-8 h-8 opacity-25" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">Nenhum agendamento para hoje</p>
                          <p className="text-xs text-muted-foreground font-light max-w-sm mx-auto">Sua agenda de hoje está livre de compromissos. Cadastre agendamentos na aba operacional para acompanhar o dia.</p>
                        </div>
                        <Button onClick={() => navigate('/dashboard/agendamentos')} className="h-8.5 text-xs bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-semibold rounded-xl px-4">
                           Novo Agendamento
                        </Button>
                     </div>
                  ) : (
                     <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                           <thead>
                              <tr className="border-b border-light/5 text-muted-foreground text-[10px] font-semibold uppercase font-mono tracking-widest bg-white/[0.01]">
                                 <th className="py-3 px-5">Horário</th>
                                 <th className="py-3 px-4">Cliente</th>
                                 <th className="py-3 px-4">Serviço</th>
                                 <th className="py-3 px-4">Profissional</th>
                                 <th className="py-3 px-5 text-right">Status</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/[0.03]">
                              {todayAppointments.map((appt) => (
                                 <tr key={appt.id} className="hover:bg-white/[0.01] transition-colors">
                                    <td className="py-3.5 px-5 whitespace-nowrap">
                                       <span className="font-mono text-xs font-semibold text-[#D4AF37] bg-[#D4AF37]/10 px-2.5 py-1 rounded-lg border border-[#D4AF37]/25 shadow-[0_2px_8px_rgba(212,175,55,0.05)]">
                                         {appt.time}
                                       </span>
                                    </td>
                                    <td className="py-3.5 px-4 font-medium text-xs text-white whitespace-nowrap">
                                       {appt.clientName}
                                    </td>
                                    <td className="py-3.5 px-4 text-xs text-slate-300">
                                       {appt.serviceName}
                                    </td>
                                    <td className="py-3.5 px-4 text-xs text-slate-400">
                                       {appt.professionalName}
                                    </td>
                                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                                       <span className={cn(
                                         "text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full font-mono",
                                         appt.status === 'completed' ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                                         appt.status === 'canceled' ? "bg-destructive/15 text-destructive border border-destructive/25" :
                                         appt.status === 'no_show' ? "bg-slate-800 text-slate-400" :
                                         "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20"
                                       )}>
                                         {appt.status === 'scheduled' ? 'Confirmado' : 
                                          appt.status === 'completed' ? 'Concluído' :
                                          appt.status === 'canceled' ? 'Cancelado' : 'Falta'}
                                       </span>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </CardContent>
            </Card>
         </div>

         {/* Meta do Mês & Desempenho da Equipe (Owners & Managers) */}
         <div className="space-y-6">
            
            {/* Owner Goals visual */}
            {isOwnerOrManager && (
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground px-1 block">Metas do Mês</span>
                <Card className="border-white/5 bg-[#0c0c0f] rounded-2xl shadow-xl overflow-hidden p-5">
                   {stats.goalTarget > 0 ? (
                      <div className="space-y-4">
                         <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                               <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider font-mono">Mês Atual</p>
                               <span className="text-xs font-semibold text-slate-200 capitalize">{formatMonthLabel(currentMonthStr)}</span>
                            </div>
                            <span className="text-xs font-mono font-bold bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-2 py-0.5 rounded text-[#D4AF37] shadow-[0_2px_8px_rgba(212,175,55,0.05)]">
                               {goalPct}% Batido
                            </span>
                         </div>
                         
                         <div className="space-y-1.5">
                            <span className="text-xs text-muted-foreground">Progresso Faturado / Alvo</span>
                            <div className="flex justify-between items-baseline font-mono">
                               <span className="text-lg font-bold text-white">{formatBRL(stats.goalCurrent)}</span>
                               <span className="text-xs text-slate-400">/ {formatBRL(stats.goalTarget)}</span>
                            </div>
                            <Progress value={goalPct} className="h-2 bg-black/50" />
                         </div>

                         {goalPct >= 100 && (
                            <div className="flex gap-2.5 bg-green-500/10 border border-green-500/25 p-3 rounded-xl text-xs text-green-400 items-baseline">
                               <span className="font-bold">★ SENSACIONAL:</span>
                               <span className="font-light">Meta de faturamento atingida!</span>
                            </div>
                         )}
                      </div>
                   ) : (
                      <div className="text-center py-6 space-y-3 flex flex-col items-center">
                         <Target className="w-8 h-8 text-[#D4AF37] opacity-20" />
                         <div className="space-y-1">
                           <p className="text-xs font-semibold text-white">Nenhuma meta configurada</p>
                           <p className="text-[11px] text-muted-foreground font-light">Estimule sua equipe definindo faturamentos desejados.</p>
                         </div>
                         <Button onClick={() => navigate('/dashboard/metas')} size="xs" className="h-8 text-xs bg-white/[0.03] border border-white/10 text-white hover:bg-[#D4AF37] hover:text-black hover:border-transparent font-medium rounded-xl px-3.5">
                            Definir Metas
                         </Button>
                      </div>
                   )}
                </Card>
              </div>
            )}

            {/* Team Evaluation performance listing */}
            {isOwnerOrManager && (
              <div className="space-y-3">
                 <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground px-1 block">Aderência da Equipe</span>
                 <Card className="border-white/5 bg-[#0c0c0f] rounded-2xl shadow-xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                       <span className="text-xs font-semibold text-slate-300">Avaliação Essenza Ativa</span>
                       <span className="text-[10px] text-muted-foreground font-light">{todayStr.split("-").reverse().join("/")}</span>
                    </div>

                    {professionals.length === 0 ? (
                       <p className="text-xs text-muted-foreground font-mono text-center py-4">Nenhum profissional com funções cadastrado.</p>
                    ) : (
                       <div className="space-y-2.5">
                          {professionals.map((pro) => {
                             const runs = checklistRuns.filter(r => r.evaluatedProfessionalId === pro.id);
                             const presentRun = runs.find(r => r.attendanceStatus === "present" || (!r.attendanceStatus && r.totalScore !== undefined));
                             const absentRun = runs.find(r => r.attendanceStatus === "absent");
                             const notPerformedRun = runs.find(r => r.attendanceStatus === "not_performed");

                             const displayFunc = pro.primaryFunction || pro.professionalFunction || pro.specialty || "Profissional";

                             return (
                                <div key={pro.id} className="flex justify-between items-center text-xs p-3 bg-black/20 border border-white/[0.03] rounded-xl hover:border-white/10 transition-all duration-150">
                                   <div className="space-y-0.5 max-w-[65%]">
                                      <p className="font-semibold text-white truncate">{pro.name}</p>
                                      <p className="text-[10px] text-primary uppercase font-mono tracking-wider truncate">{displayFunc}</p>
                                   </div>
                                   <div className="text-right">
                                      {presentRun ? (
                                         <span className="text-[10px] font-semibold text-green-400 font-mono bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 font-mono">
                                            {presentRun.totalScore !== undefined ? `Nota ${presentRun.totalScore}pt` : "Presente"}
                                         </span>
                                      ) : absentRun ? (
                                         <span className="text-[10px] font-semibold text-destructive uppercase font-mono bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 font-mono">Falta</span>
                                      ) : notPerformedRun ? (
                                         <span className="text-[10px] font-semibold text-cyan-400 uppercase font-mono bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-mono">Dispensa</span>
                                      ) : (
                                         <span className="text-[10px] font-mono text-slate-500 font-medium">Não avaliado</span>
                                      )}
                                   </div>
                                </div>
                             );
                          })}
                       </div>
                    )}
                 </Card>
              </div>
            )}

         </div>

      </div>

      {/* Chart performance card - Show only if faturamento/metas are active or for Owner / Manager */}
      {isOwnerOrManager && (
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 px-1">
             <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
             <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Histórico e Tendência Anual</span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Currency Performance Chart */}
            <Card className="border-white/5 bg-[#0c0c0f] shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-white/5 pb-4 bg-white/[0.01]">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                       <CardTitle className="text-sm font-heading font-semibold text-white">
                          Curva Comparativa de Faturamento
                       </CardTitle>
                       <p className="text-[11px] text-muted-foreground mt-1">
                          Acompanhe graficamente a relação entre faturamentos realizados e metas mensais estipuladas.
                       </p>
                    </div>
                    <div className="flex gap-2">
                       <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/metas')} className="text-xs border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] text-[#D4AF37] h-8 rounded-xl cursor-pointer">
                          Definir Metas
                       </Button>
                       <Button variant="outline" size="sm" onClick={() => setIsFinanceDialogOpen(true)} className="text-xs border-white/15 hover:bg-white/5 text-white h-8 rounded-xl cursor-pointer">
                          Finanças
                       </Button>
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="pt-6">
                 <div className="h-80 w-full animate-fade-in">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart
                          data={chartData}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                       >
                          <defs>
                             <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="rgba(255, 255, 255, 0.4)" stopOpacity={0.05}/>
                                <stop offset="95%" stopColor="rgba(255, 255, 255, 0.4)" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                          <XAxis 
                             dataKey="name" 
                             stroke="#71717a" 
                             fontSize={11} 
                             tickLine={false} 
                             axisLine={false} 
                          />
                          <YAxis 
                             stroke="#71717a" 
                             fontSize={11} 
                             tickLine={false} 
                             axisLine={false}
                             tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                          />
                          <Tooltip 
                             contentStyle={{ 
                                backgroundColor: '#121214', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                fontFamily: 'sans-serif'
                             }}
                             labelStyle={{ color: '#d4af37', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}
                             itemStyle={{ color: '#e4e4e7', fontSize: '12px' }}
                             formatter={(value: any) => [formatBRL(value)]}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                          <Area 
                             type="monotone" 
                             dataKey="Faturamento" 
                             name="Faturamento Real"
                             stroke="#d4af37" 
                             strokeWidth={2}
                             fillOpacity={1} 
                             fill="url(#colorFaturamento)" 
                          />
                          <Area 
                             type="monotone" 
                             dataKey="Meta" 
                             name="Meta de Faturamento"
                             stroke="rgba(255, 255, 255, 0.4)" 
                             strokeWidth={1.5}
                             strokeDasharray="4 4"
                             fillOpacity={1} 
                             fill="url(#colorMeta)" 
                          />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </CardContent>
            </Card>

            {/* Volume of Appointments Chart */}
            <Card className="border-white/5 bg-[#0c0c0f] shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-white/5 pb-4 bg-white/[0.01]">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                       <CardTitle className="text-sm font-heading font-semibold text-white">
                          Volume de Atendimentos Realizados
                       </CardTitle>
                       <p className="text-[11px] text-muted-foreground mt-1">
                          Monitore graficamente o total de atendimentos concluídos e agendados no decorrer de cada mês.
                       </p>
                    </div>
                    <div className="flex gap-2">
                       <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/agendamentos')} className="text-xs border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] text-[#D4AF37] h-8 rounded-xl cursor-pointer">
                          Ver Agenda
                       </Button>
                    </div>
                 </div>
              </CardHeader>
              <CardContent className="pt-6">
                 <div className="h-80 w-full animate-fade-in">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart
                          data={chartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                       >
                          <defs>
                             <linearGradient id="colorAgendamentos" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#d4af37" stopOpacity={0.15}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                          <XAxis 
                             dataKey="name" 
                             stroke="#71717a" 
                             fontSize={11} 
                             tickLine={false} 
                             axisLine={false} 
                          />
                          <YAxis 
                             stroke="#71717a" 
                             fontSize={11} 
                             tickLine={false} 
                             axisLine={false}
                             allowDecimals={false}
                          />
                          <Tooltip 
                             contentStyle={{ 
                                backgroundColor: '#121214', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                fontFamily: 'sans-serif'
                             }}
                             labelStyle={{ color: '#d4af37', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}
                             itemStyle={{ color: '#e4e4e7', fontSize: '12px' }}
                             formatter={(value: any) => [`${value} agendamentos`]}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                          <Bar 
                             dataKey="Agendamentos" 
                             name="Agendamentos Realizados"
                             fill="url(#colorAgendamentos)"
                             radius={[6, 6, 0, 0]}
                          />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Premium Relatórios modal - "Em Breve" */}
      <Dialog open={isReportsDialogOpen} onOpenChange={setIsReportsDialogOpen}>
         <DialogContent className="max-w-md bg-[#09090b] border border-[#D4AF37]/20 text-white rounded-3xl shadow-2xl p-6">
            <DialogHeader className="items-center text-center space-y-3">
               <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
                  <FileText className="w-6 h-6 animate-pulse" />
               </div>
               <DialogTitle className="text-lg font-heading font-medium text-white">Relatórios Avançados Lumière {salonData?.plan === 'founder' && <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-[#D4AF37] font-mono px-2 py-0.5 rounded leading-none ml-2">FOUNDER</span>}</DialogTitle>
               <DialogDescription className="text-xs text-slate-300 leading-relaxed max-w-xs font-light">
                  {salonData?.plan === 'founder' ? 'Como contratante do plano Founder para o Essenza Studio di Bellezza, seu acesso a todos os relatórios consolidados e de comissão está inteiramente liberado neste painel! Estamos compilando as informações operacionais da sua equipe para exibição estendida nas telas.' : 'A nossa plataforma de relatórios consolidados, notas analíticas de conformidade Essenza e exportações automáticas de agenda em PDF de alta resolução está na fase final de homologação.'}
               </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3 border-y border-white/5 my-4">
               <div className="flex gap-3 items-start text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Relatórios em alta definição</p>
                    <p className="text-[11px] text-[#a1a1aa] leading-relaxed">Impressão limpa e otimizada do desempenho operacional e checklists.</p>
                  </div>
               </div>
               <div className="flex gap-3 items-start text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Faturamento e Ticket Médio por Profissional</p>
                    <p className="text-[11px] text-[#a1a1aa] leading-relaxed">Visualizações dedicadas de produção com apuração financeira precisa por parceiro.</p>
                  </div>
               </div>
            </div>

            <div className="flex justify-center">
               <Button onClick={() => setIsReportsDialogOpen(false)} className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs rounded-xl h-9.5 px-6">
                  Voltar ao Painel
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* Premium Financeiro Avançado modal - "Em Breve" */}
      <Dialog open={isFinanceDialogOpen} onOpenChange={setIsFinanceDialogOpen}>
         <DialogContent className="max-w-md bg-[#09090b] border border-[#D4AF37]/20 text-white rounded-3xl shadow-2xl p-6">
            <DialogHeader className="items-center text-center space-y-3">
               <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
                  <TrendingUp className="w-6 h-6 animate-pulse" />
               </div>
               <DialogTitle className="text-lg font-heading font-medium text-white">Painel de Comissões e Custos</DialogTitle>
               <DialogDescription className="text-xs text-slate-300 leading-relaxed max-w-xs font-light">
                  A gestão financeira inteligente com cálculo matemático de margens, faturamento líquido do estabelecimento e comissionamento retroativo para parceiros está em fase final de desenvolvimento.
               </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3 border-y border-white/5 my-4">
               <div className="flex gap-3 items-start text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Fechamento de Caixa Automatizado</p>
                    <p className="text-[11px] text-[#a1a1aa] leading-relaxed">Consolidação automática de recebíveis diários de cartões, Pix e espécie.</p>
                  </div>
               </div>
               <div className="flex gap-3 items-start text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Comissões por Desempenho (Essenza-Fin)</p>
                    <p className="text-[11px] text-[#a1a1aa] leading-relaxed">Divisão imediata e correta baseada no contrato cadastrado para cada especialista.</p>
                  </div>
               </div>
            </div>

            <div className="flex justify-center">
               <Button onClick={() => setIsFinanceDialogOpen(false)} className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs rounded-xl h-9.5 px-6">
                  Entendi
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      <PaymentDialog 
        isOpen={isPaymentDialogOpen} 
        onClose={() => setIsPaymentDialogOpen(false)} 
        salonData={salonData} 
      />

    </div>
  );
}

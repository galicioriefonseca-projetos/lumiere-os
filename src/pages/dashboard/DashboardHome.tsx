import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowRight, Users, Scissors, UserPlus, CalendarPlus, Target, ListTodo, Star, TrendingUp } from 'lucide-react';
import { formatBRL, cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import ProfessionalDashboard from './ProfessionalDashboard';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export default function DashboardHome() {
  const { salonData, userData, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<any[]>([]);                
  const [goals, setGoals] = useState<any[]>([]);
  const [stats, setStats] = useState({
    goals: 0,
    clients: 0,
    todayAppointments: 0,
    goalTarget: 0,
    goalCurrent: 0,
    checklistPct: 0
  });

  const todayStr = new Date().toISOString().substring(0, 10);
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  useEffect(() => {
    if (!salonData) return;
    if (userData?.role === 'professional') {
      setLoading(false);
      return;
    }
    
    const unsubs: (() => void)[] = [];

    // Professionals
    const qp = query(collection(db, `salons/${salonData.id}/professionals`), where('isActive', '==', true));
    unsubs.push(onSnapshot(qp, snap => {
        const pros = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        setProfessionals(pros);
    }));

    // Clients
    const qc = query(collection(db, `salons/${salonData.id}/clients`));
    unsubs.push(onSnapshot(qc, snap => setStats(p => ({...p, clients: snap.docs.length}))));

    // Appointments Today
    const qa = query(collection(db, `salons/${salonData.id}/appointments`), where('date', '==', todayStr));
    unsubs.push(onSnapshot(qa, snap => setStats(p => ({...p, todayAppointments: snap.docs.length}))));

    // General Salon Goals & Current Goal
    const qg = query(collection(db, `salons/${salonData.id}/goals`));
    unsubs.push(onSnapshot(qg, snap => {
       const arr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
       setGoals(arr);
       
       const currentGoal = arr.find(g => g.month === currentMonthStr);
       if (currentGoal) {
         setStats(p => ({...p, goalTarget: currentGoal.targetAmount, goalCurrent: currentGoal.currentAmount}));
       } else {
         setStats(p => ({...p, goalTarget: 0, goalCurrent: 0}));
       }
     }));

    // Checklist Today
    const qk = query(collection(db, `salons/${salonData.id}/checklistRuns`), where('date', '==', todayStr));
    unsubs.push(onSnapshot(qk, snap => {
       const runs = snap.docs.map(doc => ({id: doc.id, ...doc.data()}) as any);
       setChecklistRuns(runs);
       
       let isProfessionalEval = false;
       runs.forEach(r => { if (r.evaluatedProfessionalId) isProfessionalEval = true; });
       
       if (isProfessionalEval) {
         const evaluatedPros = runs.filter(r => r.evaluatedProfessionalId).length;
         const pct = professionals.length > 0 ? Math.round((evaluatedPros / professionals.length) * 100) : 0;
         setStats(p => ({...p, checklistPct: pct}));
       } else {
         setStats(p => ({...p, checklistPct: runs.length > 0 ? runs[0].completionPercentage || 0 : 0}));
       }
       setLoading(false);
    }));

    return () => unsubs.forEach(u => u());
  }, [salonData, professionals.length, userData?.role]);

  if (loading || !salonData) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (userData?.role === 'professional') {
    return <ProfessionalDashboard />;
  }

  const goalPct = stats.goalTarget > 0 ? Math.min(Math.round((stats.goalCurrent / stats.goalTarget) * 100), 100) : 0;

  // Generate list of last 6 months in format YYYY-MM
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

  // Map and merge database goals with last 6 months list
  const chartData = last6Months.map(m => {
    const existingGoal = goals.find((g: any) => g.month === m);
    return {
      name: formatMonthLabel(m),
      Faturamento: existingGoal ? existingGoal.currentAmount : 0,
      Meta: existingGoal ? existingGoal.targetAmount : 0,
    };
  });

  return (
    <div className="space-y-8">
      
      {/* Header Profile */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading flex items-center gap-3">
             {salonData.name}
             {isPlatformAdmin ? (
                <span className="text-[10px] uppercase tracking-wider bg-primary text-black font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                   <Star className="w-3 h-3" /> MASTER
                </span>
             ) : salonData.plan !== 'start' ? (
                <span className="text-[10px] uppercase tracking-wider bg-primary text-black font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                   <Star className="w-3 h-3" /> {salonData.plan}
                </span>
             ) : null}
          </h1>
          <p className="text-muted-foreground mt-1">
            Olá, <span className="text-foreground font-medium">{userData?.fullName}</span>. 
            Sua assinatura está <span className="text-primary">{salonData.subscriptionStatus === 'trial' ? 'em teste' : 'ativa'}</span>.
          </p>
        </div>
        
        <div className="flex gap-2">
           <Button onClick={() => navigate('/dashboard/agendamentos')} className="rounded-full bg-primary hover:bg-gold-400 text-black">
             Novo Agendamento
           </Button>
        </div>
      </div>      {/* Banner de Avaliação - Apenas Owner, Manager ou Platform Admin */}
      {(userData?.role === 'owner' || userData?.role === 'manager' || userData?.role === 'platform_admin' || userData?.role === 'admin') && professionals.filter(p => !checklistRuns.find(r => r.evaluatedProfessionalId === p.id)).length > 0 && (() => {
        const pendingOnes = professionals.filter(p => !checklistRuns.find(r => r.evaluatedProfessionalId === p.id));
        const names = pendingOnes.map(p => p.name).join(", ");
        return (
          <Card className="border border-amber-500/20 bg-amber-500/5 rounded-2xl shadow-xl overflow-hidden">
             <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                   <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 mt-0.5">
                      <ListTodo className="w-5 h-5 text-amber-500 animate-pulse" />
                   </div>
                   <div>
                      <p className="font-heading font-semibold text-amber-400 text-sm flex items-center gap-2">
                         Avaliação Diária Essenza: {pendingOnes.length} {pendingOnes.length === 1 ? 'Pendente' : 'Pendentes'}
                      </p>
                      <p className="text-xs text-muted-foreground font-light leading-relaxed mt-1">
                         Profissionais pendentes hoje: <span className="text-foreground font-medium">{names}</span>. Registre a presença ou falta deles para manter os relatórios diários em dia.
                      </p>
                   </div>
                </div>
                <Button 
                   onClick={() => navigate('/dashboard/checklist')} 
                   className="w-full md:w-auto shrink-0 bg-primary hover:bg-gold-400 text-black font-semibold text-xs h-9 rounded-xl px-4"
                >
                   Avaliar Equipe
                </Button>
             </CardContent>
          </Card>
        );
      })()}

      {/* Grid Menu Acesso Rápido */}
      <div className={cn("grid gap-3", 
        (userData?.role === 'receptionist' || userData?.role === 'attendant') ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
      )}>
         <Link to="/dashboard/clientes" className="bg-card hover:bg-white/[0.03] transition-colors border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Novo Cliente</span>
         </Link>
         <Link to="/dashboard/servicos" className="bg-card hover:bg-white/[0.03] transition-colors border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <Scissors className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Serviços</span>
         </Link>
         {(userData?.role === 'owner' || userData?.role === 'manager' || userData?.role === 'platform_admin' || userData?.role === 'admin') && (
           <>
             <Link to="/dashboard/equipe" className="bg-card hover:bg-white/[0.03] transition-colors border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Equipe</span>
             </Link>
             <Link to="/dashboard/checklist" className="bg-card hover:bg-white/[0.03] transition-colors border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <ListTodo className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Checklist</span>
             </Link>
           </>
         )}
      </div>

      {/* Stats Cards */}
      <div className={cn("grid gap-4",
        (userData?.role === 'receptionist' || userData?.role === 'attendant') ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      )}>
        
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Agendamentos (Hoje)</CardTitle>
            <CalendarPlus className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light">{stats.todayAppointments}</div>
          </CardContent>
        </Card>

        {(userData?.role === 'owner' || userData?.role === 'manager' || userData?.role === 'platform_admin' || userData?.role === 'admin') && (
          <>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Meta Mensal</CardTitle>
                <Target className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-light">{formatBRL(stats.goalCurrent)}</div>
                <div className="mt-3 space-y-1">
                   <div className="text-[10px] flex justify-between text-muted-foreground">
                      <span>Progresso</span>
                      <span>{goalPct}%</span>
                   </div>
                   <Progress value={goalPct} className="h-1" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Checklist do Dia</CardTitle>
                <ListTodo className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-light">{stats.checklistPct}%</div>
                <div className="mt-3 space-y-1">
                   <div className="text-[10px] flex justify-between text-muted-foreground">
                      <span>Concluído</span>
                   </div>
                   <Progress value={stats.checklistPct} className="h-1" />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Base</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-light"><span className="text-primary font-bold">{stats.clients}</span> Clientes</div>
            <div className="text-sm text-muted-foreground"><span className="text-foreground">{professionals.length}</span> Profissionais</div>
          </CardContent>
        </Card>

      </div>

      {/* Chart performance card - Show for Owner, Manager, Admin & Platform Admin */}
      {(userData?.role === 'owner' || userData?.role === 'manager' || userData?.role === 'platform_admin' || userData?.role === 'admin') && (
        <Card className="border-border bg-card shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-border/80 pb-4">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                   <CardTitle className="text-lg font-heading text-foreground flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Desempenho de Faturamento
                   </CardTitle>
                   <p className="text-xs text-muted-foreground mt-1">
                      Curva mensal comparativa entre faturamento real (atual) e faturamento estimado (meta).
                   </p>
                </div>
                <div className="flex gap-2">
                   <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/metas')} className="text-xs border-primary/20 hover:bg-primary/10 hover:text-primary">
                      Definir Metas
                   </Button>
                </div>
             </div>
          </CardHeader>
          <CardContent className="pt-6">
             <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                   >
                      <defs>
                         <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d4af37" stopOpacity={0.2}/>
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
                         formatter={(value: any, name: string) => [formatBRL(value), name]}
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
      )}

    </div>
  );
}

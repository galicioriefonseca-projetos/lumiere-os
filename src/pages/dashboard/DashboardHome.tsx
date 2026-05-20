import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowRight, Users, Scissors, UserPlus, CalendarPlus, Target, ListTodo, Star } from 'lucide-react';
import { formatBRL } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export default function DashboardHome() {
  const { salonData, userData, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<any[]>([]);                
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

    // Current Goal
    const qg = query(collection(db, `salons/${salonData.id}/goals`), where('month', '==', currentMonthStr));
    unsubs.push(onSnapshot(qg, snap => {
       if (!snap.empty) {
         const data = snap.docs[0].data();
         setStats(p => ({...p, goalTarget: data.targetAmount, goalCurrent: data.currentAmount}));
       } else {
         setStats(p => ({...p, goalTarget: 0, goalCurrent: 0}));
       }
    }));

    // Checklist Today
    const qk = query(collection(db, `salons/${salonData.id}/checklistRuns`), where('date', '==', todayStr));
    unsubs.push(onSnapshot(qk, snap => {
       const runs = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
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
  }, [salonData, professionals.length]);

  if (loading || !salonData) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const goalPct = stats.goalTarget > 0 ? Math.min(Math.round((stats.goalCurrent / stats.goalTarget) * 100), 100) : 0;

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
      </div>

      {professionals.filter(p => !checklistRuns.find(r => r.evaluatedProfessionalId === p.id)).length > 0 && (
         <Card className="border-orange-500/50 bg-orange-500/10">
            <CardContent className="p-4 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="bg-orange-500 p-2 rounded-full">
                     <ListTodo className="w-5 h-5 text-black" />
                  </div>
                  <div>
                     <p className="font-bold text-orange-200">Avaliações Pendentes</p>
                     <p className="text-sm text-orange-100">Existem profissionais que ainda não foram avaliados hoje.</p>
                  </div>
               </div>
               <Button onClick={() => navigate('/dashboard/checklist')} variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black">
                  Avaliar Agora
               </Button>
            </CardContent>
         </Card>
      )}

      {/* Grid Menu Acesso Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
         <Link to="/dashboard/clientes" className="bg-card hover:bg-white/[0.03] transition-colors border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Novo Cliente</span>
         </Link>
         <Link to="/dashboard/servicos" className="bg-card hover:bg-white/[0.03] transition-colors border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <Scissors className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Serviços</span>
         </Link>
         <Link to="/dashboard/equipe" className="bg-card hover:bg-white/[0.03] transition-colors border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Equipe</span>
         </Link>
         <Link to="/dashboard/checklist" className="bg-card hover:bg-white/[0.03] transition-colors border border-border p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
            <ListTodo className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">Checklist</span>
         </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Agendamentos (Hoje)</CardTitle>
            <CalendarPlus className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light">{stats.todayAppointments}</div>
          </CardContent>
        </Card>

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

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Base</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-light"><span className="text-primary font-bold">{stats.clients}</span> Clientes</div>
            <div className="text-sm text-muted-foreground"><span className="text-foreground">{stats.professionals}</span> Profissionais</div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}

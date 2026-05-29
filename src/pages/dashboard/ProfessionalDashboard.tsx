import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, where, doc, updateDoc } from "firebase/firestore";
import { Appointment, ChecklistRun, Professional, ProfessionalGoal, Service } from "../../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PROFESSIONAL_SPECIALTIES } from "../../data/professionalSpecialties";
import { 
  Calendar, 
  Clock, 
  Smile, 
  Star, 
  TrendingUp, 
  Award, 
  CheckCircle, 
  User,
  AlertCircle,
  FileText,
  MessageSquare,
  ChevronRight,
  ShieldAlert,
  CalendarCheck2,
  Loader2,
  DollarSign,
  Target,
  Filter,
} from "lucide-react";
import { formatBRL, cn } from "@/lib/utils";

export default function ProfessionalDashboard() {
  const { userData, salonData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "painel";

  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<Professional | null>(null);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [myEvaluations, setMyEvaluations] = useState<ChecklistRun[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [myGoals, setMyGoals] = useState<ProfessionalGoal[]>([]);
  const [selectedEval, setSelectedEval] = useState<ChecklistRun | null>(null);
  const [agendaTab, setAgendaTab] = useState<"today" | "all">("today");

  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPrimary, setEditPrimary] = useState('');
  const [editCustomPrimary, setEditCustomPrimary] = useState('');
  const [editExtras, setEditExtras] = useState<string[]>([]);
  const [editCustomExtras, setEditCustomExtras] = useState('');

  useEffect(() => {
    if (myProfile) {
      setEditName(myProfile.name || '');
      setEditPhone(myProfile.phone || '');
      
      const primary = myProfile.primaryFunction || myProfile.professionalFunction || myProfile.specialty || myProfile.category || '';
      if (primary) {
        if (PROFESSIONAL_SPECIALTIES.includes(primary)) {
          setEditPrimary(primary);
          setEditCustomPrimary('');
        } else {
          setEditPrimary('Outro');
          setEditCustomPrimary(primary);
        }
      } else {
        setEditPrimary('');
        setEditCustomPrimary('');
      }

      const extras = myProfile.additionalFunctions || [];
      const standardExtras = extras.filter(e => PROFESSIONAL_SPECIALTIES.includes(e));
      const customExtras = extras.filter(e => !PROFESSIONAL_SPECIALTIES.includes(e));

      const finalExtrasList = [...standardExtras];
      if (customExtras.length > 0) {
        finalExtrasList.push('Outro');
        setEditCustomExtras(customExtras.join(', '));
      } else {
        setEditCustomExtras('');
      }
      setEditExtras(finalExtrasList);
    }
  }, [myProfile?.id]);

  const todayStr = new Date().toISOString().substring(0, 10);
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  useEffect(() => {
    if (!salonData || !userData) return;

    let unsubscribeAppts: (() => void) | null = null;
    let unsubscribeEvals: (() => void) | null = null;
    let unsubscribeServices: (() => void) | null = null;
    let unsubscribeGoals: (() => void) | null = null;

    const cleanupInner = () => {
      if (unsubscribeAppts) unsubscribeAppts();
      if (unsubscribeEvals) unsubscribeEvals();
      if (unsubscribeServices) unsubscribeServices();
      if (unsubscribeGoals) unsubscribeGoals();
    };

    let unsubscribeProfs: () => void;

    if (userData.role === 'professional') {
      const docRef = doc(db, `salons/${salonData.id}/professionals`, userData.id);
      unsubscribeProfs = onSnapshot(docRef, (docSnap) => {
        cleanupInner();

        if (docSnap.exists()) {
          const matched = { id: docSnap.id, ...docSnap.data() } as Professional;
          setMyProfile(matched);

          // 1. Load Appointments
          const qa = query(
            collection(db, `salons/${salonData.id}/appointments`),
            where("professionalId", "==", matched.id)
          );
          unsubscribeAppts = onSnapshot(qa, (snapAppt) => {
            const arr: Appointment[] = [];
            snapAppt.forEach(d => arr.push({ id: d.id, ...d.data() } as Appointment));
            setMyAppointments(
              arr.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
            );
          }, (err) => {
            console.error("Erro ao carregar meus agendamentos:", err);
          });

          // 2. Load Evaluations
          const qe = query(
            collection(db, `salons/${salonData.id}/checklistRuns`),
            where("checklistType", "==", "professional_daily_evaluation"),
            where("evaluatedProfessionalId", "==", matched.id)
          );
          unsubscribeEvals = onSnapshot(qe, (snapEval) => {
            const arr: ChecklistRun[] = [];
            snapEval.forEach(d => arr.push({ id: d.id, ...d.data() } as ChecklistRun));
            setMyEvaluations(arr.sort((a, b) => b.date.localeCompare(a.date)));
            
            if (arr.length > 0 && !selectedEval) {
              setSelectedEval(arr[0]);
            }
          }, (err) => {
            console.error("Erro ao carregar minhas avaliações:", err);
          });

          // 3. Load Services to map pricing
          const qs = query(collection(db, `salons/${salonData.id}/services`));
          unsubscribeServices = onSnapshot(qs, (snapServ) => {
            const arr: Service[] = [];
            snapServ.forEach(d => arr.push({ id: d.id, ...d.data() } as Service));
            setServices(arr);
          }, (err) => {
            console.error("Erro ao carregar serviços no painel de profissional:", err);
          });

          // 4. Load Goals
          const qg = query(
            collection(db, `salons/${salonData.id}/professionalGoals`),
            where("professionalId", "==", matched.id)
          );
          unsubscribeGoals = onSnapshot(qg, (snapGoal) => {
            const arr: ProfessionalGoal[] = [];
            snapGoal.forEach(d => arr.push({ id: d.id, ...d.data() } as ProfessionalGoal));
            setMyGoals(arr);
            setLoading(false);
          }, (err) => {
            console.error("Erro ao carregar minhas metas de profissional:", err);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      }, (err) => {
        console.error("Erro no onSnapshot do perfil de profissional:", err);
        setLoading(false);
      });
    } else {
      // For owners, managers or platform_admin using Dashboard demo view
      const qp = query(collection(db, `salons/${salonData.id}/professionals`));
      unsubscribeProfs = onSnapshot(qp, (snap) => {
        cleanupInner();

        const pros: Professional[] = [];
        snap.forEach(d => {
          pros.push({ id: d.id, ...d.data() } as Professional);
        });

        // Match profile
        const matched = pros.find(
          p => p.email?.toLowerCase().trim() === userData.email?.toLowerCase().trim() ||
               p.name.toLowerCase().trim() === userData.fullName?.toLowerCase().trim()
        );

        if (matched) {
          setMyProfile(matched);

          // 1. Load Appointments
          const qa = query(
            collection(db, `salons/${salonData.id}/appointments`),
            where("professionalId", "==", matched.id)
          );
          unsubscribeAppts = onSnapshot(qa, (snapAppt) => {
            const arr: Appointment[] = [];
            snapAppt.forEach(d => arr.push({ id: d.id, ...d.data() } as Appointment));
            setMyAppointments(
              arr.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
            );
          }, (err) => {
            console.error("Erro ao carregar agendamentos (view de teste):", err);
          });

          // 2. Load Evaluations
          const qe = query(
            collection(db, `salons/${salonData.id}/checklistRuns`),
            where("checklistType", "==", "professional_daily_evaluation"),
            where("evaluatedProfessionalId", "==", matched.id)
          );
          unsubscribeEvals = onSnapshot(qe, (snapEval) => {
            const arr: ChecklistRun[] = [];
            snapEval.forEach(d => arr.push({ id: d.id, ...d.data() } as ChecklistRun));
            setMyEvaluations(arr.sort((a, b) => b.date.localeCompare(a.date)));
            
            if (arr.length > 0 && !selectedEval) {
              setSelectedEval(arr[0]);
            }
          }, (err) => {
            console.error("Erro ao carregar avaliações (view de teste):", err);
          });

          // 3. Load Services to map pricing
          const qs = query(collection(db, `salons/${salonData.id}/services`));
          unsubscribeServices = onSnapshot(qs, (snapServ) => {
            const arr: Service[] = [];
            snapServ.forEach(d => arr.push({ id: d.id, ...d.data() } as Service));
            setServices(arr);
          }, (err) => {
            console.error("Erro ao carregar serviços (view de teste):", err);
          });

          // 4. Load Goals
          const qg = query(
            collection(db, `salons/${salonData.id}/professionalGoals`),
            where("professionalId", "==", matched.id)
          );
          unsubscribeGoals = onSnapshot(qg, (snapGoal) => {
            const arr: ProfessionalGoal[] = [];
            snapGoal.forEach(d => arr.push({ id: d.id, ...d.data() } as ProfessionalGoal));
            setMyGoals(arr);
            setLoading(false);
          }, (err) => {
            console.error("Erro ao carregar metas (view de teste):", err);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      }, (err) => {
        console.error("Erro no onSnapshot da lista de profissionais (view de teste):", err);
        setLoading(false);
      });
    }

    return () => {
      unsubscribeProfs();
      cleanupInner();
    };
  }, [salonData, userData]);

  const changeApptStatus = async (apptId: string, status: Appointment["status"]) => {
    if (!salonData) return;
    try {
      const ref = doc(db, `salons/${salonData.id}/appointments`, apptId);
      await updateDoc(ref, { status, updatedAt: Date.now() });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!myProfile) {
    return (
      <Card className="border-border bg-card/50 max-w-xl mx-auto mt-6">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-heading mb-2">Perfil Pendente de Vinculação</h2>
          <p className="text-muted-foreground text-sm font-light leading-relaxed mb-6">
            Sua conta de acesso do sistema foi criada, mas seu perfil profissional ainda não foi localizado na equipe ativa do salão.
            <br /><br />
            Solicite ao seu administrador que cadastre seu e-mail ou nome idêntico na aba <b>Equipe</b>.
          </p>
          <div className="bg-muted p-4 rounded-xl w-full text-left space-y-2 border border-white/5 font-mono">
            <p className="text-xs text-muted-foreground">E-mail: <b className="text-foreground">{userData?.email}</b></p>
            <p className="text-xs text-muted-foreground">Nome: <b className="text-foreground">{userData?.fullName}</b></p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Earnings calculations
  const myCompletedAppts = myAppointments.filter(a => a.status === 'completed');
  const totalEarnings = myCompletedAppts.reduce((sum, appt) => {
    const service = services.find(s => s.id === appt.serviceId);
    return sum + (service?.price || 0);
  }, 0);

  const currentMonthEarnings = myCompletedAppts
    .filter(a => a.date.startsWith(currentMonthStr))
    .reduce((sum, appt) => {
      const service = services.find(s => s.id === appt.serviceId);
      return sum + (service?.price || 0);
    }, 0);

  // Stats Calculations
  const totalAppointments = myAppointments.filter(a => a.status === 'completed' || a.status === 'scheduled').length;
  const completedAppointments = myCompletedAppts.length;
  const presenceCount = myEvaluations.filter(e => e.attendanceStatus === 'present').length;
  const absenceCount = myEvaluations.filter(e => e.attendanceStatus === 'absent').length;

  const presentEvaluations = myEvaluations.filter(e => e.attendanceStatus === 'present' && e.totalScore !== undefined);
  const overallAvg = presentEvaluations.length > 0 
    ? presentEvaluations.reduce((sum, current) => sum + ((current.totalScore || 0) / (current.maxScore || 40)) * 5, 0) / presentEvaluations.length
    : 0;

  const todayAppointments = myAppointments.filter(a => a.date === todayStr);
  const displayAppointments = agendaTab === "today" ? todayAppointments : myAppointments;

  // Active Goal for current month
  const currentGoal = myGoals.find(g => g.month === currentMonthStr);
  const goalProgressPct = currentGoal && currentGoal.targetAmount > 0 
    ? Math.min(Math.round((currentMonthEarnings / currentGoal.targetAmount) * 100), 100)
    : 0;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData || !myProfile) return;

    if (!editPrimary) {
      toast.error("Por favor, selecione sua função principal.");
      return;
    }

    const finalPrimary = (editPrimary === 'Outro' ? editCustomPrimary.trim() : editPrimary) || 'Função não definida';

    let rawExtras: string[] = [];
    editExtras.forEach((f) => {
      if (f === 'Outro') {
        editCustomExtras.split(',').forEach(part => {
          const trimmed = part.trim();
          if (trimmed) rawExtras.push(trimmed);
        });
      } else {
        rawExtras.push(f);
      }
    });

    const cleanExtras = Array.from(new Set(rawExtras))
      .filter(f => f && f !== finalPrimary);

    const allSpecialties = Array.from(new Set([finalPrimary, ...cleanExtras])).filter(Boolean);

    try {
      setIsSaving(true);
      
      const docRef = doc(db, `salons/${salonData.id}/professionals`, myProfile.id);
      
      const updatePayload = {
        name: editName.trim(),
        phone: editPhone.trim(),
        updatedAt: Date.now(),
        
        primaryFunction: finalPrimary,
        professionalFunction: finalPrimary,
        professionalCategory: finalPrimary,
        category: finalPrimary,
        specialty: finalPrimary,
        additionalFunctions: cleanExtras,
        specialties: allSpecialties
      };

      await updateDoc(docRef, updatePayload);

      // Also update users/{uid} root document if existing
      if (userData?.id) {
        try {
          const userRef = doc(db, 'users', userData.id);
          await updateDoc(userRef, {
            fullName: editName.trim(),
            phone: editPhone.trim(),
            primaryFunction: finalPrimary,
            professionalFunction: finalPrimary,
            professionalCategory: finalPrimary,
            category: finalPrimary,
            specialty: finalPrimary,
            additionalFunctions: cleanExtras,
            specialties: allSpecialties,
            updatedAt: Date.now()
          });
        } catch (err) {
          console.log("Root user doc modification skipped or permissions insufficient", err);
        }
      }

      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar perfil próprio:", err);
      toast.error("Erro ao salvar suas alterações: " + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Function to switch tab
  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Profile card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0d0d11] to-[#050505] rounded-3xl border border-[#D4AF37]/15 p-6 shadow-xl">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] text-xl font-bold font-heading">
              {myProfile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-widest font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-2 py-0.5 rounded-full inline-block leading-none mb-1.5 font-mono shadow-[0_2px_8px_rgba(212,175,55,0.05)]">COLABORADOR PARCEIRO</span>
              <h1 className="text-xl md:text-2xl font-heading font-light text-foreground leading-tight">
                <b className="font-semibold text-white">{myProfile.name}</b>
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap mt-0.5">
                <span className="text-[#D4AF37] font-semibold">{myProfile.primaryFunction || myProfile.professionalFunction || myProfile.specialty || myProfile.category || myProfile.role || "Profissional"}</span>
                {salonData?.name && <span>| {salonData.name}</span>}
              </p>
              {myProfile.additionalFunctions && myProfile.additionalFunctions.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-wider">Outras Especialidades:</span>
                  {myProfile.additionalFunctions.map(ext => (
                    <span key={ext} className="text-[9px] bg-zinc-950 border border-white/5 text-zinc-300 font-medium px-1.5 py-0.5 rounded">
                      {ext}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Quick tab switcher within the page */}
          <div className="flex flex-wrap gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/5">
            <Button size="xs" variant={activeTab === 'painel' ? 'default' : 'ghost'} onClick={() => setTab('painel')} className={cn("text-xs font-medium px-3 h-7 rounded-xl select-none", activeTab === 'painel' ? "bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 hover:text-black font-semibold" : "text-slate-300 hover:text-white hover:bg-white/5")}>Resumo</Button>
            <Button size="xs" variant={activeTab === 'agenda' ? 'default' : 'ghost'} onClick={() => setTab('agenda')} className={cn("text-xs font-medium px-3 h-7 rounded-xl select-none", activeTab === 'agenda' ? "bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 hover:text-black font-semibold" : "text-slate-300 hover:text-white hover:bg-white/5")}>Agenda</Button>
            <Button size="xs" variant={activeTab === 'desempenho' ? 'default' : 'ghost'} onClick={() => setTab('desempenho')} className={cn("text-xs font-medium px-3 h-7 rounded-xl select-none", activeTab === 'desempenho' ? "bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 hover:text-black font-semibold" : "text-slate-300 hover:text-white hover:bg-white/5")}>Desempenho</Button>
            <Button size="xs" variant={activeTab === 'avaliacoes' ? 'default' : 'ghost'} onClick={() => setTab('avaliacoes')} className={cn("text-xs font-medium px-3 h-7 rounded-xl select-none", activeTab === 'avaliacoes' ? "bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 hover:text-black font-semibold" : "text-slate-300 hover:text-white hover:bg-white/5")}>Avaliações</Button>
            <Button size="xs" variant={activeTab === 'metas' ? 'default' : 'ghost'} onClick={() => setTab('metas')} className={cn("text-xs font-medium px-3 h-7 rounded-xl select-none", activeTab === 'metas' ? "bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 hover:text-black font-semibold" : "text-slate-300 hover:text-white hover:bg-white/5")}>Metas {currentGoal && "🎯"}</Button>
            <Button size="xs" variant={activeTab === 'perfil' ? 'default' : 'ghost'} onClick={() => setTab('perfil')} className={cn("text-xs font-medium px-3 h-7 rounded-xl select-none", activeTab === 'perfil' ? "bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 hover:text-black font-semibold" : "text-slate-300 hover:text-white hover:bg-white/5")}>Meu Perfil 👤</Button>
          </div>
        </div>
      </div>

      {/* ==================== SCREEN: OVERVIEW (PAINEL) ==================== */}
      {activeTab === 'painel' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Rating card */}
            <Card className="border-border bg-card/60">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Média Essenza</span>
                  <Star className="w-4 h-4 text-primary fill-primary" />
                </div>
                <div className="text-3xl font-light">{overallAvg > 0 ? overallAvg.toFixed(1) : "-"} <span className="text-[10px] text-muted-foreground font-sans">/ 5.0</span></div>
                <p className="text-[10px] text-muted-foreground/80 mt-2">Baseado em {presentEvaluations.length} feedback(s)</p>
              </CardContent>
            </Card>

            {/* Attendance card */}
            <Card className="border-border bg-card/60">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Assiduidade</span>
                  <CalendarCheck2 className="w-4 h-4 text-primary" />
                </div>
                <div className="text-3xl font-light text-green-400">{presenceCount} <span className="text-xs text-muted-foreground">presenças</span></div>
                <p className="text-[10px] mt-2 text-destructive">{absenceCount} falta(s) registrada(s)</p>
              </CardContent>
            </Card>

            {/* Appointments card */}
            <Card className="border-border bg-card/60">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Atendimentos</span>
                  <CheckCircle className="w-4 h-4 text-primary" />
                </div>
                <div className="text-3xl font-light">{completedAppointments} <span className="text-xs text-muted-foreground">/ {totalAppointments}</span></div>
                <p className="text-[10px] text-muted-foreground mt-2">Conclusão de agendamentos</p>
              </CardContent>
            </Card>

            {/* Billing card */}
            <Card className="border-border bg-card/60">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Produção (Mês)</span>
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <div className="text-3xl font-light text-[#d4af37]">{formatBRL(currentMonthEarnings)}</div>
                <p className="text-[10px] text-muted-foreground mt-2">Total faturado neste mês</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Agenda Preview */}
            <Card className="border-border bg-card/50">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-heading font-medium">Próximos Atendimentos</CardTitle>
                  <CardDescription className="text-xs">Agenda operacional de hoje</CardDescription>
                </div>
                <Button size="xs" onClick={() => setTab("agenda")} className="border-primary/20 text-primary border rounded-xl hover:bg-primary/5 bg-transparent">Ver Todos</Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Nenhum atendimento para hoje.</div>
                ) : (
                  todayAppointments.slice(0, 3).map(app => (
                    <div key={app.id} className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">{app.time}</span>
                          <span className="text-[11px] text-foreground">{app.clientName}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{app.serviceName}</p>
                      </div>
                      <span className={cn(
                        "text-[9px] uppercase font-bold px-2 py-0.5 rounded-full",
                        app.status === 'completed' ? "bg-green-500/10 text-green-400" : "bg-primary/10 text-primary"
                      )}>{app.status}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Last Evaluation Preview */}
            <Card className="border-border bg-card/50">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-heading font-medium">Última Avaliação Essenza</CardTitle>
                  <CardDescription className="text-xs">Acompanhamento diário</CardDescription>
                </div>
                <Button size="xs" onClick={() => setTab("avaliacoes")} className="border-primary/20 text-primary border rounded-xl hover:bg-primary/5 bg-transparent">Histórico</Button>
              </CardHeader>
              <CardContent className="p-4">
                {myEvaluations.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma avaliação cadastrada ainda.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{myEvaluations[0].date.split("-").reverse().join("/")}</span>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {myEvaluations[0].attendanceStatus === 'absent' ? 'Falta' : `Nota ${myEvaluations[0].totalScore}/${myEvaluations[0].maxScore}`}
                      </span>
                    </div>
                    {myEvaluations[0].observations ? (
                      <p className="text-xs italic bg-white/5 p-3 rounded-lg text-muted-foreground mt-3">
                        "{myEvaluations[0].observations}"
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">Dedicado e consistente na presença operacional.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* ==================== SCREEN: MINHA AGENDA ==================== */}
      {activeTab === 'agenda' && (
        <Card className="border-border bg-card/50">
          <CardHeader className="border-b border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-heading font-normal">Sua Agenda de Atendimentos</CardTitle>
              <CardDescription className="text-xs">Monitore seus clientes, horários e confirme a realização dos serviços.</CardDescription>
            </div>
            
            <div className="flex gap-1 bg-muted p-0.5 rounded-lg border border-white/5 self-end">
              <Button 
                size="xs" 
                variant={agendaTab === "today" ? "default" : "ghost"}
                onClick={() => setAgendaTab("today")}
                className="text-xs rounded-md"
              >
                Hoje ({todayAppointments.length})
              </Button>
              <Button 
                size="xs" 
                variant={agendaTab === "all" ? "default" : "ghost"}
                onClick={() => setAgendaTab("all")}
                className="text-xs rounded-md"
              >
                Todos os Períodos ({myAppointments.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {displayAppointments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-heading font-medium text-sm">Nenhum agendamento encontrado</p>
                <p className="text-xs font-light mt-1 text-muted-foreground">Não há compromissos para a seleção atual.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayAppointments.map(app => {
                  const isToday = app.date === todayStr;
                  return (
                    <Card key={app.id} className="border border-white/5 bg-black/20 hover:border-white/10 transition-colors relative overflow-hidden">
                      {app.status === 'completed' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-500" />}
                      {app.status === 'canceled' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-destructive" />}
                      {app.status === 'scheduled' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />}
                      
                      <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-semibold text-primary">{app.time}</span>
                              <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/5">{app.date.split("-").reverse().join("/")}</span>
                            </div>
                            
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full font-mono",
                              app.status === 'completed' ? "bg-green-500/10 text-green-400" :
                              app.status === 'canceled' ? "bg-destructive/10 text-destructive" :
                              "bg-primary/10 text-primary"
                            )}>{app.status}</span>
                          </div>

                          <h4 className="font-medium text-sm text-foreground">{app.clientName}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">Serviço: <b className="text-[#eee]">{app.serviceName}</b></p>
                          {app.notes && (
                            <p className="text-xs text-muted-foreground bg-white/5 border border-white/5 p-2 rounded mt-3 italic">
                              "{app.notes}"
                            </p>
                          )}
                        </div>

                        {app.status === "scheduled" && isToday && (
                          <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-white/5">
                            <Button 
                              size="xs" 
                              onClick={() => changeApptStatus(app.id, 'completed')}
                              className="bg-green-500 hover:bg-green-600 text-black text-xs font-semibold rounded-lg px-3"
                            >
                              Finalizar Serviço
                            </Button>
                            <Button 
                              size="xs" 
                              variant="ghost" 
                              onClick={() => changeApptStatus(app.id, 'canceled')}
                              className="text-destructive hover:bg-destructive/10 text-xs rounded-lg px-3"
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== SCREEN: MEU DESEMPENHO ==================== */}
      {activeTab === 'desempenho' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Financial Performance */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base font-medium">Evolução Faturamento do Profissional</CardTitle>
                <CardDescription className="text-xs">Mapeia faturamento acumulado e realização de atendimentos cadastrados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Completo</span>
                    <p className="text-2xl font-light text-[#eeef] leading-tight mt-1">{completedAppointments}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">trabalhos</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Produção Mês</span>
                    <p className="text-2xl font-light text-primary leading-tight mt-1">{formatBRL(currentMonthEarnings)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{currentMonthStr}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Histórico</span>
                    <p className="text-2xl font-light text-[#eeef] leading-tight mt-1">{formatBRL(totalEarnings)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">acumulado</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-heading font-medium text-sm text-primary">Classificação do Mix de Serviços</h4>
                  {services.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Carregando lista...</p>
                  ) : (
                    <div className="space-y-3">
                      {services.map(s => {
                        const count = myCompletedAppts.filter(a => a.serviceId === s.id).length;
                        if (count === 0) return null;
                        return (
                          <div key={s.id} className="flex justify-between items-center text-xs p-2 bg-black/10 rounded-xl">
                            <span>{s.name}</span>
                            <span className="font-mono text-muted-foreground">{count}x ({formatBRL(s.price * count)})</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          <div>
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base font-medium">Métricas Essenza</CardTitle>
                <CardDescription className="text-xs">Classificações e aderência semanal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs md:text-sm">
                <div className="space-y-2 pb-4 border-b border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Nota Média:</span>
                    <span className="font-bold text-primary">{overallAvg > 0 ? `${overallAvg.toFixed(2)} / 5.00` : "-"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Presenças:</span>
                    <span className="text-green-400 font-semibold">{presenceCount} dias</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Faltas:</span>
                    <span className="text-destructive font-semibold">{absenceCount} dias</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="font-heading font-medium text-xs text-primary uppercase tracking-wider">Checklist Resumo</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed font-light">
                    As classificações de consistência ajudam você e a gerência a acompanhar a pontualidade, atendimento premium e organização da sua bancada de trabalho diariamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==================== SCREEN: HISTÓRICO DE AVALIAÇÕES ==================== */}
      {activeTab === 'avaliacoes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="text-base font-medium">Histórico de Feedbacks</CardTitle>
              <CardDescription className="text-xs font-light">Suas avaliações diárias registradas pelo gerente ou administrador.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {myEvaluations.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">Nenhuma avaliação listada.</div>
              ) : (
                myEvaluations.map(evalRun => {
                  const isSelected = selectedEval?.id === evalRun.id;
                  return (
                    <div 
                      key={evalRun.id}
                      onClick={() => setSelectedEval(evalRun)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all duration-150 cursor-pointer flex justify-between items-center",
                        isSelected ? "border-primary bg-primary/5" : "border-white/5 bg-black/10 hover:border-white/10"
                      )}
                    >
                      <div>
                        <p className="text-[10px] text-muted-foreground">{evalRun.date.split("-").reverse().join("/")}</p>
                        <h4 className="text-sm font-medium mt-1">
                          {evalRun.attendanceStatus === 'absent' ? (
                            <span className="text-destructive font-semibold">Falta Registrada</span>
                          ) : (
                            `Avaliação Diária: Nota ${evalRun.totalScore}/${evalRun.maxScore || 40}`
                          )}
                        </h4>
                        {evalRun.classification && evalRun.attendanceStatus !== 'absent' && (
                          <p className="text-xs text-primary mt-1 font-light">{evalRun.classification}</p>
                        )}
                      </div>
                      <ChevronRight className={cn("w-5 h-5", isSelected ? "text-primary translate-x-1" : "text-muted-foreground")} />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50">
            {selectedEval ? (
              <CardContent className="p-6 space-y-4">
                <div className="border-b border-white/5 pb-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-semibold text-primary">Avaliação de {selectedEval.date.split("-").reverse().join("/")}</h3>
                    <span className={cn(
                      "text-xs px-2.5 py-0.5 rounded-full font-bold",
                      selectedEval.attendanceStatus === 'absent' ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                    )}>
                      {selectedEval.attendanceStatus === 'absent' ? 'Falta' : `${selectedEval.percentage ? Math.round(selectedEval.percentage) : 0}%`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Avaliador: {selectedEval.evaluatorName || "Administrador"}</p>
                </div>

                {selectedEval.attendanceStatus === 'absent' ? (
                  <div className="text-center py-6">
                    <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                    <h4 className="font-semibold text-destructive">FALTA CONFIRMADA</h4>
                    <p className="text-xs text-muted-foreground p-3 border border-destructive/10 bg-destructive/5 rounded-xl italic mt-3">
                      Justificativa: "{selectedEval.absenceReason || "Nenhuma observação prestada"}"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Pontuação</span>
                        <span>{selectedEval.totalScore} de {selectedEval.maxScore || 40}</span>
                      </div>
                      <Progress value={selectedEval.percentage || 0} className="h-1.5" />
                    </div>

                    <div className="space-y-3 pt-2">
                      <h4 className="font-heading font-medium text-xs text-primary uppercase tracking-wider">Notas por Item</h4>
                      {selectedEval.categoryScores && Object.keys(selectedEval.categoryScores).length > 0 ? (
                        Object.entries(selectedEval.categoryScores).map(([cat, score]) => {
                          const valScore = Number(score) || 0;
                          return (
                            <div key={cat} className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{cat}</span>
                                <span className="font-bold text-white leading-none flex items-center gap-1">{valScore} <Star className="w-3 h-3 text-primary fill-primary" /></span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground">Não há notas específicas mapeadas por item.</p>
                      )}
                    </div>

                    {selectedEval.observations && (
                      <div className="pt-4 border-t border-white/5 space-y-1.5">
                        <span className="text-xs font-semibold text-primary">Comentários e Feedbacks:</span>
                        <p className="text-xs italic bg-[#101014] border border-white/5 text-muted-foreground p-3 rounded-xl">
                          "{selectedEval.observations}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            ) : (
              <CardContent className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                <FileText className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium text-sm">Selecione uma avaliação</p>
                <p className="text-xs">Selecione uma data no histórico ao lado para abrir os detalhes do feedback Essenza.</p>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* ==================== SCREEN: MINHAS METAS ==================== */}
      {activeTab === 'metas' && (
        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-base font-medium">Metas Individuais Registradas</CardTitle>
            <CardDescription className="text-xs">Acompanhamento de faturamento do mês atual vs alvo contratual estabelecido.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-6">
            {!currentGoal ? (
              <div className="text-center py-10 text-muted-foreground">
                <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-heading font-medium text-sm">Nenhuma meta ativa para {currentMonthStr}</p>
                <p className="text-xs mt-1">A gerência estabelecerá metas de faturamento e comissionamento para você aqui.</p>
              </div>
            ) : (
              <div className="max-w-xl mx-auto space-y-6">
                <div className="bg-[#121217] p-6 rounded-3xl border border-white/5 text-center space-y-2">
                  <span className="text-[10px] bg-primary/10 text-primary uppercase font-bold tracking-widest px-3 py-1 rounded-full">Meta Individual • {currentGoal.month}</span>
                  <p className="text-muted-foreground text-sm font-light pt-2">Progresso Faturado</p>
                  <p className="text-4xl font-heading font-light text-white">{formatBRL(currentMonthEarnings)}</p>
                  <p className="text-xs text-muted-foreground">de um alvo de <span className="text-primary font-bold">{formatBRL(currentGoal.targetAmount)}</span></p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span>Aderência à Meta</span>
                    <span>{goalProgressPct}%</span>
                  </div>
                  <Progress value={goalProgressPct} className="h-3 rounded-full bg-black/60" />
                </div>

                {goalProgressPct >= 100 ? (
                  <div className="flex gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl items-center text-xs text-green-400">
                    <Award className="w-6 h-6 text-green-400 shrink-0" />
                    <div>
                      <p className="font-bold">Parabéns! Meta 100% Batida</p>
                      <p className="opacity-80">Você atingiu o faturamento estipulado para a equipe Essenza este mês. Mantenha os feedbacks em dia!</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center font-light leading-relaxed">
                    Completar os agendamentos agendados e fidelizar novos clientes ajudam você a bater a meta mais rápido!
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== SCREEN: MEU PERFIL ==================== */}
      {activeTab === 'perfil' && (
        <Card className="border-border bg-card/50 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-[#D4AF37]" /> Meu Perfil Profissional
            </CardTitle>
            <CardDescription className="text-xs">
              Mantenha seus dados de contato e especialidades de atendimento sempre atualizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              
              {/* Name & Phone inputs group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="perfName" className="text-xs font-semibold text-zinc-300">Meu Nome Completo <span className="text-[#D4AF37]">*</span></Label>
                  <Input 
                    id="perfName" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                    placeholder="Seu nome por extenso"
                    className="bg-black/40 border-white/10 text-white rounded-xl h-11 text-xs focus:border-[#D4AF37]/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perfPhone" className="text-xs font-semibold text-zinc-300">Celular (Opcional)</Label>
                  <Input 
                    id="perfPhone" 
                    value={editPhone} 
                    onChange={(e) => setEditPhone(e.target.value)} 
                    placeholder="Ex: (00) 00000-0000"
                    className="bg-black/40 border-white/10 text-white rounded-xl h-11 text-xs focus:border-[#D4AF37]/50"
                  />
                </div>
              </div>

              {/* Email (Read Only Warning) */}
              <div className="space-y-1 bg-zinc-950/40 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Conta Atrelada (E-mail)</span>
                <span className="text-xs text-zinc-300 font-mono block select-none">{myProfile.email}</span>
                <p className="text-[9px] text-zinc-500">Para alterar seu e-mail cadastrado, entre em contato com seu administrador.</p>
              </div>

              {/* Primary function selection dropdown */}
              <div className="space-y-2">
                <Label htmlFor="perfPrimary" className="text-xs font-semibold text-zinc-300">Função Principal <span className="text-[#D4AF37]">*</span></Label>
                <div className="relative">
                  <select
                    id="perfPrimary"
                    value={editPrimary}
                    onChange={(e) => setEditPrimary(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 text-white rounded-xl h-11 px-3 text-xs focus:outline-none focus:border-primary appearance-none cursor-pointer"
                  >
                    <option value="">-- Escolha sua função principal --</option>
                    {PROFESSIONAL_SPECIALTIES.map((spec) => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-xs">
                    ▼
                  </div>
                </div>

                {editPrimary === 'Outro' && (
                  <div className="pt-2">
                    <Label htmlFor="perfCustomPrimary" className="text-[10px] text-zinc-400">Escreva qual é o seu cargo/função principal:</Label>
                    <Input
                      id="perfCustomPrimary"
                      value={editCustomPrimary}
                      onChange={(e) => setEditCustomPrimary(e.target.value)}
                      placeholder="Ex: Cabeleireira Visagista"
                      className="bg-black/40 border-white/10 text-white rounded-xl h-11 text-xs focus:border-[#D4AF37]/50 mt-1"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Additional Functions Checkboxes Grid */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold text-zinc-300">Funções Adicionais / Especialidades Extras</Label>
                <p className="text-[11px] text-zinc-400 font-light leading-relaxed">
                  Marque todas as outras funções que você realiza além da sua principal. No LumiereOS, você usa um único cadastro para todas as suas frentes.
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-3 bg-black/40 border border-[#ffffff05] rounded-2xl scrollbar-thin">
                  {PROFESSIONAL_SPECIALTIES.filter(s => s !== editPrimary).map((spec) => {
                    const isChecked = editExtras.includes(spec);
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => {
                          setEditExtras(prev =>
                            prev.includes(spec) ? prev.filter(p => p !== spec) : [...prev, spec]
                          );
                        }}
                        className={`flex items-center gap-2.5 p-2 rounded-xl text-left text-xs transition-all border ${
                          isChecked 
                            ? 'bg-primary/10 border-primary/45 text-primary font-semibold shadow-[0_2px_10px_rgba(212,175,55,0.05)]' 
                            : 'bg-black/30 border-[#ffffff05] text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                        }`}
                        style={{ minHeight: '44px' }}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${isChecked ? 'bg-primary border-primary text-black' : 'border-zinc-500'} shrink-0`}>
                          {isChecked && <CheckCircle className="w-3 h-3 stroke-[2.5]" />}
                        </div>
                        <span className="truncate leading-none">{spec}</span>
                      </button>
                    );
                  })}
                </div>

                {editExtras.includes('Outro') && (
                  <div className="pt-2">
                    <Label htmlFor="perfCustomExtras" className="text-[10px] text-zinc-400">Escreva suas outras funções adicionais separadas por vírgula:</Label>
                    <Input
                      id="perfCustomExtras"
                      value={editCustomExtras}
                      onChange={(e) => setEditCustomExtras(e.target.value)}
                      placeholder="Ex: Escovista, Designer de Cargas"
                      className="bg-black/40 border-white/10 text-white rounded-xl h-11 text-xs focus:border-[#D4AF37]/50 mt-1"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Submit Buttons footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#D4AF37] hover:bg-[#b08f2e] text-black font-semibold h-11 px-6 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    "Salvar Dados do Perfil"
                  )}
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

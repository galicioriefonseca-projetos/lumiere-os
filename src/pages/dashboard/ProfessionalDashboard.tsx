import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, where, doc, updateDoc, getDocs } from "firebase/firestore";
import { Appointment, ChecklistRun, Professional } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

export default function ProfessionalDashboard() {
  const { userData, salonData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<Professional | null>(null);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [myEvaluations, setMyEvaluations] = useState<ChecklistRun[]>([]);
  const [selectedEval, setSelectedEval] = useState<ChecklistRun | null>(null);
  const [agendaTab, setAgendaTab] = useState<"today" | "all">("today");

  const todayStr = new Date().toISOString().substring(0, 10);

  useEffect(() => {
    if (!salonData || !userData) return;

    // 1. Load active professionals to find the corresponding team profile
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    const unsubscribeProfs = onSnapshot(qp, (snap) => {
      const pros: Professional[] = [];
      snap.forEach(d => {
        pros.push({ id: d.id, ...d.data() } as Professional);
      });

      // Match by email or matched exactly by full name
      const matched = pros.find(
        p => p.email?.toLowerCase().trim() === userData.email?.toLowerCase().trim() ||
             p.name.toLowerCase().trim() === userData.fullName?.toLowerCase().trim()
      );

      if (matched) {
        setMyProfile(matched);

        // 2. Load Appointments for this specific matched professional
        const qa = query(
          collection(db, `salons/${salonData.id}/appointments`),
          where("professionalId", "==", matched.id)
        );
        const unsubscribeAppts = onSnapshot(qa, (snapAppt) => {
          const arr: Appointment[] = [];
          snapAppt.forEach(d => arr.push({ id: d.id, ...d.data() } as Appointment));
          setMyAppointments(
            arr.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
          );
        });

        // 3. Load Evaluations (ChecklistRuns of type daily evaluation) for this professional
        const qe = query(
          collection(db, `salons/${salonData.id}/checklistRuns`),
          where("checklistType", "==", "professional_daily_evaluation"),
          where("evaluatedProfessionalId", "==", matched.id)
        );
        const unsubscribeEvals = onSnapshot(qe, (snapEval) => {
          const arr: ChecklistRun[] = [];
          snapEval.forEach(d => arr.push({ id: d.id, ...d.data() } as ChecklistRun));
          // Sort by date descending
          setMyEvaluations(arr.sort((a, b) => b.date.localeCompare(a.date)));
          setLoading(false);
        });

        return () => {
          unsubscribeAppts();
          unsubscribeEvals();
        };
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeProfs();
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

  // Handle case where logged in user role is 'professional' but owner hasn't linked them inside 'Equipe'
  if (!myProfile) {
    return (
      <Card className="border-border bg-card/50 max-w-xl mx-auto mt-6">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-heading mb-2">Perfil Pendente de Vinculação</h2>
          <p className="text-muted-foreground text-sm font-light leading-relaxed mb-6">
            Sua conta de acesso de sistema foi criada, mas seu perfil profissional ainda não foi localizado na equipe ativa do salão.
            <br /><br />
            Solicite ao seu administrador que cadastre seu e-mail ou nome idêntico na aba <b>Equipe</b>.
          </p>
          <div className="bg-muted p-4 rounded-xl w-full text-left space-y-2 border border-white/5">
            <p className="text-xs text-muted-foreground">E-mail: <b className="text-foreground">{userData?.email}</b></p>
            <p className="text-xs text-muted-foreground">Nome: <b className="text-foreground">{userData?.fullName}</b></p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Stats calculations
  const totalAppointments = myAppointments.filter(a => a.status === 'completed' || a.status === 'scheduled').length;
  const completedAppointments = myAppointments.filter(a => a.status === 'completed').length;
  const presenceCount = myEvaluations.filter(e => e.attendanceStatus === 'present').length;
  const absenceCount = myEvaluations.filter(e => e.attendanceStatus === 'absent').length;
  
  // Calculate average rating from daily evaluations
  // Essenza total score is out of 40. Scale it to 1-5 average
  // we can average the individual scores: (total / maxScore) * 5
  const presentEvaluations = myEvaluations.filter(e => e.attendanceStatus === 'present' && e.totalScore !== undefined);
  const overallAvg = presentEvaluations.length > 0 
    ? presentEvaluations.reduce((sum, current) => sum + ((current.totalScore || 0) / (current.maxScore || 40)) * 5, 0) / presentEvaluations.length
    : 0;

  const todayAppointments = myAppointments.filter(a => a.date === todayStr);
  const displayAppointments = agendaTab === "today" ? todayAppointments : myAppointments;

  // Next appointment
  const nextAppt = todayAppointments.find(a => a.status === "scheduled");

  return (
    <div className="space-y-6">
      {/* Profiler Header card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-card/80 to-card/20 rounded-3xl border border-white/10 p-6 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/20 shrink-0 text-primary text-2xl font-bold font-heading">
            {myProfile.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest font-bold text-primary">ÁREA DO PROFISSIONAL</span>
            <h1 className="text-2xl md:text-3xl font-heading font-light text-foreground">
              Olá, <b className="font-medium text-primary">{myProfile.name}</b>
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Smile className="w-4 h-4 text-primary" /> {myProfile.role} | {salonData?.name}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Star average card */}
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Minha Média Essenza</CardTitle>
            <Star className="w-5 h-5 text-primary fill-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-light">{overallAvg > 0 ? overallAvg.toFixed(1) : "-"}</span>
              <span className="text-xs text-muted-foreground">de 5.0 estrelas</span>
            </div>
            {presentEvaluations.length > 0 ? (
              <p className="text-xs text-muted-foreground mt-3">
                Calculado com base em <b className="text-foreground">{presentEvaluations.length}</b> avaliações este mês.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-3">Ainda não há avaliações de feedback.</p>
            )}
          </CardContent>
        </Card>

        {/* Presence and attendance card */}
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Frequência</CardTitle>
            <CalendarCheck2 className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div>
                <span className="text-3xl font-light text-green-400">{presenceCount}</span>
                <p className="text-[10px] text-muted-foreground uppercase">Presenças</p>
              </div>
              <div className="w-px bg-border h-12" />
              <div>
                <span className="text-3xl font-light text-destructive">{absenceCount}</span>
                <p className="text-[10px] text-muted-foreground uppercase">Faltas</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Total de dias acompanhados pela gerência.
            </p>
          </CardContent>
        </Card>

        {/* Appointments stats card */}
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Agendamentos</CardTitle>
            <Award className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-light">{completedAppointments}</span>
              <span className="text-sm text-muted-foreground"> / {totalAppointments} concluídos</span>
            </div>
            {totalAppointments > 0 && (
              <div className="mt-3 space-y-1">
                <Progress value={(completedAppointments / totalAppointments) * 100} className="h-1.5 bg-background" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agenda Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-heading font-medium flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Minha Agenda
            </h3>
            <div className="flex gap-1 bg-muted p-0.5 rounded-lg border border-white/5">
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
                Todos ({myAppointments.length})
              </Button>
            </div>
          </div>

          {displayAppointments.length === 0 ? (
            <Card className="border-border bg-card/40">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Smile className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Nenhum atendimento listado</p>
                <p className="text-xs text-muted-foreground mt-1">Sua agenda está vazia para este período.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {displayAppointments.map(app => {
                const isToday = app.date === todayStr;
                return (
                  <Card key={app.id} className="border-border bg-card/80 hover:bg-card hover:transition-colors relative overflow-hidden">
                    {app.status === 'completed' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />}
                    {app.status === 'canceled' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />}
                    {app.status === 'scheduled' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                    
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            <span className="font-mono text-xs font-semibold">{app.time}</span>
                            {!isToday && (
                              <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-muted-foreground">
                                {app.date.split("-").reverse().slice(0, 2).join("/")}
                              </span>
                            )}
                            {app.status === 'completed' ? (
                              <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full uppercase">Concluído</span>
                            ) : app.status === 'canceled' ? (
                              <span className="text-[10px] text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded-full uppercase">Cancelado</span>
                            ) : (
                              <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full uppercase">Agendado</span>
                            )}
                          </div>
                          <h4 className="font-medium text-sm text-foreground">{app.clientName}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{app.serviceName}</p>
                          {app.notes && (
                            <p className="text-[11px] text-muted-foreground/80 italic mt-1.5 p-1 px-2 border-l border-primary/20 bg-primary/5 rounded">
                              Obs: {app.notes}
                            </p>
                          )}
                        </div>

                        {app.status === "scheduled" && isToday && (
                          <div className="flex flex-col gap-1">
                            <Button 
                              size="sm" 
                              onClick={() => changeApptStatus(app.id, 'completed')}
                              className="bg-green-500 hover:bg-green-600 text-black text-xs font-semibold px-2 py-1 h-7 rounded-lg"
                            >
                              Concluir
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => changeApptStatus(app.id, 'canceled')}
                              className="text-destructive hover:bg-destructive/10 text-xs px-2 py-1 h-7 rounded-lg"
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Avaliacoes Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-heading font-medium flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> Avaliações Essenza de Desempenho
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Evaluations List */}
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {myEvaluations.length === 0 ? (
                <Card className="border-border bg-card/40">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Nenhuma avaliação hoje</p>
                    <p className="text-xs text-muted-foreground mt-1">A gerência registrará suas avaliações diárias de consistência aqui.</p>
                  </CardContent>
                </Card>
              ) : (
                myEvaluations.map(evalRun => {
                  const isSelected = selectedEval?.id === evalRun.id;
                  const dateFormatted = evalRun.date.split("-").reverse().join("/");
                  
                  return (
                    <Card 
                      key={evalRun.id} 
                      onClick={() => setSelectedEval(evalRun)}
                      className={`border-border hover:bg-card/70 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                        isSelected ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(212,175,55,0.08)]' : 'bg-card/50'
                      }`}
                    >
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{dateFormatted}</p>
                          <p className="text-sm font-medium text-foreground">
                            {evalRun.attendanceStatus === 'absent' 
                              ? <span className="text-destructive font-semibold">Falta Registrada</span>
                              : `Nota ${evalRun.totalScore}/${evalRun.maxScore || 40}`
                            }
                          </p>
                          {evalRun.attendanceStatus !== 'absent' && (
                            <p className="text-xs text-primary">{evalRun.classification}</p>
                          )}
                        </div>
                        <ChevronRight className={`w-5 h-5 transition-transform ${isSelected ? 'translate-x-1 text-primary' : 'text-muted-foreground'}`} />
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Evaluation Detail View */}
            <div className="space-y-3">
              {selectedEval ? (
                <Card className="border-border bg-card/85 relative overflow-hidden h-full">
                  <CardHeader className="pb-3 border-b border-white/5 flex flex-row justify-between items-center space-y-0">
                    <div>
                      <CardTitle className="text-sm font-heading font-medium text-primary">Avaliação de {selectedEval.date.split("-").reverse().join("/")}</CardTitle>
                      <span className="text-[10px] text-muted-foreground">Avaliado por: {selectedEval.evaluatorName || "Administrador"}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 text-xs md:text-sm">
                    {selectedEval.attendanceStatus === 'absent' ? (
                      <div className="text-center py-6 space-y-2">
                        <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
                        <h4 className="font-semibold text-destructive">FALTA REGISTRADA</h4>
                        <p className="text-xs text-muted-foreground p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                          Motivo: <br />
                          <b className="text-foreground">{selectedEval.absenceReason || "Sem justificativa"}</b>
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center py-1">
                            <span className="text-muted-foreground">Pontuação Total:</span>
                            <b className="text-foreground text-sm font-mono">{selectedEval.totalScore} de {selectedEval.maxScore || 40} ({selectedEval.percentage ? Math.round(selectedEval.percentage) : 0}%)</b>
                          </div>
                          
                          <div className="flex justify-between items-center py-1 border-b border-white/5">
                            <span className="text-muted-foreground">Classificação:</span>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{selectedEval.classification}</span>
                          </div>
                        </div>

                        {/* Individual Item Stars */}
                        <div className="space-y-2.5 pt-2">
                          <h4 className="font-medium text-xs text-primary uppercase tracking-widest">Notas por Categoria</h4>
                          {selectedEval.categoryScores && Object.keys(selectedEval.categoryScores).length > 0 ? (
                            Object.entries(selectedEval.categoryScores).map(([cat, score]) => {
                              const valScore = Number(score) || 0;
                              return (
                                <div key={cat} className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span>{cat}</span>
                                    <span className="font-bold flex items-center gap-1">
                                      {valScore} <Star className="w-3 h-3 text-primary fill-primary shrink-0" />
                                    </span>
                                  </div>
                                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${
                                        valScore >= 4 ? "bg-primary" : valScore >= 3 ? "bg-amber-500" : "bg-yellow-500"
                                      }`}
                                      style={{ width: `${(valScore / 5) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-muted-foreground">Não há notas de categorias registradas.</p>
                          )}
                        </div>

                        {/* Observations / Comments */}
                        {selectedEval.observations && (
                          <div className="space-y-1 pt-2">
                            <h4 className="font-medium text-xs text-primary uppercase tracking-widest flex items-center gap-1 leading-none">
                              <MessageSquare className="w-3.5 h-3.5" /> Feedback & Observações
                            </h4>
                            <p className="text-xs text-foreground bg-white/5 p-2 rounded-lg border border-white/5 italic">
                              "{selectedEval.observations}"
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border border-dashed bg-card/10 h-full flex items-center justify-center">
                  <div className="p-6 text-center text-muted-foreground max-w-[200px]">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-light">Selecione uma avaliação na lista para ver o feedback detalhado por categoria.</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

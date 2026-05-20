import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { Checklist, ChecklistRun, ChecklistItemTemplate } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  ListTodo,
  Trash2,
  LayoutTemplate,
  PenLine,
} from "lucide-react";
import {
  predefinedTemplates,
  PredefinedTemplate,
} from "../../data/checklistTemplates";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function removeUndefinedDeep(obj: any): any {
  if (obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep);
  }
  if (obj !== null && typeof obj === "object") {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (obj[key] !== undefined) {
          newObj[key] = removeUndefinedDeep(obj[key]);
        }
      }
    }
    return newObj;
  }
  return obj;
}

export default function ChecklistPage() {
  const { salonData } = useAuth();
  const [activeOperationalChecklist, setActiveOperationalChecklist] = useState<Checklist | null>(null);
  const [activeProfessionalEvaluationChecklist, setActiveProfessionalEvaluationChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalPros, setTotalPros] = useState(0);
  const [evaluatedPros, setEvaluatedPros] = useState(0);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [evaluationRuns, setEvaluationRuns] = useState<ChecklistRun[]>([]);

  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [evalProfessionalId, setEvalProfessionalId] = useState<string>("");
  const [attendanceStatus, setAttendanceStatus] = useState<"present" | "absent" | "">("");
  const [observations, setObservations] = useState("");
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>({});

  const [reportDate, setReportDate] = useState(new Date().toISOString().substring(0, 10));
  const [reportRuns, setReportRuns] = useState<ChecklistRun[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"todos" | "pendentes" | "avaliados" | "faltas">("todos");
  
  const todayStr = new Date().toISOString().substring(0, 10);

  useEffect(() => {
    if (!salonData) return;
    const unsubs: (() => void)[] = [];

    // 0. Fetch professionals
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(
      onSnapshot(qp, (snapshot) => {
        const pros: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const isActive = data.isActive === true || data.active === true || data.status === "active" || data.status === "ativo" || (data.status === undefined && data.isActive !== false);
          if (isActive) pros.push({ id: doc.id, ...data });
        });
        setProfessionals(pros);
        setTotalPros(pros.length);
      }),
    );

    // 1. Fetch active templates
    const qt = query(
      collection(db, `salons/${salonData.id}/checklists`),
      where("isActive", "==", true),
    );
    unsubs.push(
      onSnapshot(qt, (snapshot) => {
        let op: Checklist | null = null;
        let evalT: Checklist | null = null;
        
        snapshot.forEach((doc) => {
          const data = doc.data() as Checklist;
          const isEval = data.type === "professional_daily_evaluation" || data.checklistGroup === "professional_evaluation";
          
          if (isEval) {
            evalT = { id: doc.id, ...data };
          } else {
            op = { id: doc.id, ...data };
          }
        });
        
        setActiveOperationalChecklist(op);
        setActiveProfessionalEvaluationChecklist(evalT);

        // Fetch evaluation runs
        if (evalT) {
            const qrEval = query(
              collection(db, `salons/${salonData.id}/checklistRuns`),
              where("date", "==", todayStr),
              where("checklistId", "==", evalT.id),
            );
            unsubs.push(
              onSnapshot(qrEval, (snap) => {
                const arr: ChecklistRun[] = [];
                snap.forEach((doc) =>
                  arr.push({ id: doc.id, ...doc.data() } as ChecklistRun),
                );
                setEvaluationRuns(arr);
                setEvaluatedPros(arr.length);
              }),
            );
        } else {
            setEvaluationRuns([]);
            setEvaluatedPros(0);
        }
        setLoading(false);
      }),
    );

    return () => unsubs.forEach((u) => u());
  }, [salonData]);

  const handleCreateEssenzaChecklist = async () => {
    if (!salonData) return;
    const template = predefinedTemplates.find(t => t.type === 'professional_daily_evaluation');
    if (!template) {
        toast.error("Template Essenza não encontrado");
        return;
    }

    const docRef = doc(collection(db, `salons/${salonData.id}/checklists`));
    const payload = removeUndefinedDeep({
        title: template.title,
        description: template.description,
        type: template.type,
        checklistGroup: template.checklistGroup,
        scoringMode: template.scoringMode,
        scoreBy: template.scoreBy,
        maxScore: template.maxScore,
        categories: template.categories,
        items: template.items.map((item, index) => ({ id: `item-${index}`, ...item })),
        classificationRules: template.classificationRules,
        scale: template.scale,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    try {
        await setDoc(docRef, payload);
        toast.success(`Checklist criado com sucesso: ${docRef.id}`);
    } catch (e) {
        toast.error("Erro ao criar checklist");
        console.error(e);
    }
  };

  const getClassification = (score: number) => {
    if (!activeProfessionalEvaluationChecklist?.classificationRules) {
        if (score >= 35) return "Excelência";
        if (score >= 30) return "Muito bom";
        if (score >= 25) return "Bom";
        if (score >= 20) return "Atenção";
        return "Precisa de alinhamento";
    }
    
    // Sort rules descending
    const rules = [...activeProfessionalEvaluationChecklist.classificationRules].sort((a,b) => b.min - a.min);
    const rule = rules.find(r => score >= r.min);
    return rule ? rule.label : "Precisa de alinhamento";
  };

  const handleSaveEvaluation = async () => {
    if (!salonData || !evalProfessionalId || !activeProfessionalEvaluationChecklist) return;

    if (attendanceStatus === 'present') {
      const allCategories = activeProfessionalEvaluationChecklist.categories || [];
      if (allCategories.some(c => !categoryScores[c])) {
        toast.error("Preencha todas as categorias");
        return;
      }
    } else if (attendanceStatus === 'absent') {
      if (!observations) {
        toast.error("Motivo da falta é obrigatório");
        return;
      }
    }

    const totalScore = attendanceStatus === 'present' ? Object.values(categoryScores).reduce((a, b) => a + b, 0) : 0;
    const classification = attendanceStatus === 'present' ? getClassification(totalScore) : "Falta registrada";
    const maxScore = activeProfessionalEvaluationChecklist.maxScore || 40;

    const existingRun = evaluationRuns.find(r => r.evaluatedProfessionalId === evalProfessionalId);

    const runData: Partial<ChecklistRun> = {
        checklistId: activeProfessionalEvaluationChecklist.id,
        checklistTitle: activeProfessionalEvaluationChecklist.title,
        checklistType: activeProfessionalEvaluationChecklist.type,
        scoringMode: activeProfessionalEvaluationChecklist.scoringMode,
        date: todayStr,
        evaluationDate: todayStr,
        evaluatedProfessionalId: evalProfessionalId,
        evaluatedProfessionalName: professionals.find(p => p.id === evalProfessionalId)?.name || 'Unknown',
        evaluatorName: 'Admin', // Temporary hardcoded
        attendanceStatus: attendanceStatus,
        observations: observations,
        categoryScores: attendanceStatus === 'present' ? categoryScores : {},
        totalScore: attendanceStatus === 'present' ? totalScore : undefined,
        maxScore: attendanceStatus === 'present' ? maxScore : undefined,
        percentage: attendanceStatus === 'present' ? (totalScore / maxScore) * 100 : undefined,
        classification: classification,
        absenceReason: attendanceStatus === 'absent' ? observations : undefined,
        status: 'completed',
        createdAt: existingRun && existingRun.createdAt ? existingRun.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    try {
        const runRef = existingRun 
            ? doc(db, `salons/${salonData.id}/checklistRuns`, existingRun.id)
            : doc(collection(db, `salons/${salonData.id}/checklistRuns`));
        await setDoc(runRef, removeUndefinedDeep(runData));
        toast.success("Avaliação salva");
        setEvalProfessionalId("");
        setAttendanceStatus("");
        setObservations("");
        setCategoryScores({});
        setIsEvaluationOpen(false);
    } catch (e) {
        toast.error("Erro ao salvar");
        console.error(e);
    }
  };

  const fetchReport = async () => {
    if (!salonData) return;
    setLoadingReport(true);
    
    const qr = query(
        collection(db, `salons/${salonData.id}/checklistRuns`),
        where("evaluationDate", "==", reportDate),
        where("checklistType", "==", "professional_daily_evaluation"),
      );
    
    try {
        const snap = await getDocs(qr);
        const arr: ChecklistRun[] = [];
        snap.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as ChecklistRun));
        setReportRuns(arr);
    } catch (e) {
        toast.error("Erro ao carregar relatório");
        console.error(e);
    } finally {
        setLoadingReport(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text(`Relatório de Avaliação Diária: ${reportDate}`, 10, 10);
    
    // Summary
    const total = professionals.length;
    const avaliados = reportRuns.filter(r => r.attendanceStatus === 'present').length;
    const faltas = reportRuns.filter(r => r.attendanceStatus === 'absent').length;
    const pendentes = total - avaliados - faltas;
    const totalPontos = reportRuns.reduce((sum, run) => sum + (run.totalScore || 0), 0);
    const media = avaliados > 0 ? (totalPontos / avaliados).toFixed(1) : "-";

    const summary = [
        ["Total de profissionais", total.toString()],
        ["Avaliados", avaliados.toString()],
        ["Faltas", faltas.toString()],
        ["Pendentes", pendentes.toString()],
        ["Perc. de conclusão", total > 0 ? `${Math.round(((avaliados + faltas) / total) * 100)}%` : "0%"],
        ["Média de pontuação", media]
    ];

    autoTable(doc, { 
        startY: 20,
        body: summary,
        theme: 'plain'
    });

    const tableData = professionals.map(p => {
        const run = reportRuns.find(r => r.evaluatedProfessionalId === p.id);
        return [
            p.name,
            p.role || "Pro",
            run ? (run.attendanceStatus === 'absent' ? 'Falta' : 'Avaliado') : 'Pendente',
            run?.totalScore || "-",
            run?.classification || "-",
            run?.observations || (run?.absenceReason || "-")
        ];
    });

    autoTable(doc, {
        head: [['Profissional', 'Função', 'Status', 'Pontuação', 'Classificação', 'Obs/Motivo']],
        body: tableData,
        startY: (doc as any).lastAutoTable.finalY + 10,
    });
    
    doc.text("Gerado pelo Lumière OS", 10, doc.internal.pageSize.getHeight() - 10);
    doc.save(`relatorio_${reportDate}.pdf`);
  };

  const filteredProfessionals = professionals
    .filter(p => {
        const run = evaluationRuns.find(r => r.evaluatedProfessionalId === p.id);
        const status = run ? (run.attendanceStatus === 'absent' ? 'faltas' : 'avaliados') : 'pendentes';
        
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'todos' || status === filter;
        
        return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const runA = evaluationRuns.find(r => r.evaluatedProfessionalId === a.id);
      const runB = evaluationRuns.find(r => r.evaluatedProfessionalId === b.id);
      const statusA = runA ? (runA.attendanceStatus === 'absent' ? 2 : 3) : 1;
      const statusB = runB ? (runB.attendanceStatus === 'absent' ? 2 : 3) : 1;
      return statusA - statusB;
    });

  const avaliados = evaluationRuns.filter(r => r.attendanceStatus === 'present').length;
  const faltas = evaluationRuns.filter(r => r.attendanceStatus === 'absent').length;
  const pendentes = totalPros - avaliados - faltas;
  const percentual = totalPros > 0 ? Math.round(((avaliados + faltas) / totalPros) * 100) : 0;

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-heading font-light">Checklist</h2>
      </div>

      <div className="space-y-8">
        {/* A) Avaliação de Hoje */}
        <section className="space-y-4">
             <h3 className="text-xl font-heading">Avaliação de Hoje</h3>
             {!activeProfessionalEvaluationChecklist ? (
                <Card>
                    <CardContent className="py-6 text-center">
                        <p className="text-muted-foreground text-sm mb-4">Nenhuma avaliação diária configurada.</p>
                        <Button onClick={handleCreateEssenzaChecklist}>Criar Avaliação Diária Essenza</Button>
                    </CardContent>
                </Card>
             ) : (
                <Card>
                    <CardHeader><CardTitle className="text-lg">Avaliação Diária Essenza</CardTitle></CardHeader>
                    <CardContent>
                         <div className="flex justify-between items-center mb-4">
                             <span>{evaluatedPros} de {totalPros} avaliados</span>
                             <span>{totalPros > 0 ? Math.round((evaluatedPros / totalPros) * 100) : 0}%</span>
                         </div>
                        <Dialog open={isEvaluationOpen} onOpenChange={(open) => {
                          setIsEvaluationOpen(open);
                          if (open) {
                            setFilter("pendentes");
                            setSearchTerm("");
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button className="w-full">Iniciar Avaliação Diária</Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                  <DialogTitle>Avaliação Diária Essenza</DialogTitle>
                              </DialogHeader>
                              <div className="p-4">
                                  {/* Summary Cards */}
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                                    <div className="bg-muted p-3 rounded text-center">
                                      <div className="text-2xl font-bold">{professionals.length}</div>
                                      <div className="text-xs text-muted-foreground">Total</div>
                                    </div>
                                    <div className="bg-muted p-3 rounded text-center text-green-600">
                                      <div className="text-2xl font-bold">{evaluationRuns.filter(r => r.attendanceStatus === 'present').length}</div>
                                      <div className="text-xs text-muted-foreground">Avaliados</div>
                                    </div>
                                    <div className="bg-muted p-3 rounded text-center text-red-600">
                                      <div className="text-2xl font-bold">{evaluationRuns.filter(r => r.attendanceStatus === 'absent').length}</div>
                                      <div className="text-xs text-muted-foreground">Faltas</div>
                                    </div>
                                    <div className="bg-muted p-3 rounded text-center text-orange-600">
                                      <div className="text-2xl font-bold">{professionals.length - evaluationRuns.filter(r => r.attendanceStatus === 'present').length - evaluationRuns.filter(r => r.attendanceStatus === 'absent').length}</div>
                                      <div className="text-xs text-muted-foreground">Pendentes</div>
                                    </div>
                                    <div className="bg-muted p-3 rounded text-center">
                                      <div className="text-2xl font-bold">{professionals.length > 0 ? Math.round(((evaluationRuns.filter(r => r.attendanceStatus === 'present').length + evaluationRuns.filter(r => r.attendanceStatus === 'absent').length) / professionals.length) * 100) : 0}%</div>
                                      <div className="text-xs text-muted-foreground">Concluído</div>
                                    </div>
                                  </div>

                                  {/* Search and Filters */}
                                  <div className="flex flex-col gap-2 mb-4">
                                      <Input 
                                          placeholder="Buscar profissional..." 
                                          value={searchTerm} 
                                          onChange={e => setSearchTerm(e.target.value)} 
                                      />
                                      <div className="flex gap-2">
                                          {(['todos', 'pendentes', 'avaliados', 'faltas'] as const).map(f => (
                                              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="capitalize">
                                                  {f}
                                              </Button>
                                          ))}
                                      </div>
                                  </div>

                                  {evalProfessionalId ? (
                                    <div className="space-y-4">
                                      <Button onClick={() => setEvalProfessionalId("")} variant="outline">Voltar</Button>
                                      <h3 className="font-medium text-base md:text-lg">Avaliando: {professionals.find(p => p.id === evalProfessionalId)?.name}</h3>
                                      
                                      <div className="flex gap-2 p-2 bg-muted rounded-lg">
                                        <Button onClick={() => setAttendanceStatus("present")} variant={attendanceStatus === 'present' ? 'default' : 'outline'} className="flex-1">Presente</Button>
                                        <Button onClick={() => setAttendanceStatus("absent")} variant={attendanceStatus === 'absent' ? 'destructive' : 'outline'} className="flex-1">Faltou</Button>
                                      </div>

                                      {/* Legenda Geral */}
                                      {attendanceStatus === 'present' && (
                                        <div className="grid grid-cols-5 gap-1 text-center bg-muted/30 p-2 rounded-lg text-[10px] text-muted-foreground">
                                          <div>1: Inadequado</div>
                                          <div>2: Ajustar</div>
                                          <div>3: Bom</div>
                                          <div>4: Muito Bom</div>
                                          <div>5: Excelente</div>
                                        </div>
                                      )}

                                      {attendanceStatus === 'present' && activeProfessionalEvaluationChecklist?.items
                                        .filter((item, index, self) => self.findIndex(t => t.category === item.category) === index)
                                        .map(item => {
                                          const categoryName = item.category || "Geral";
                                          const currentScore = categoryScores[categoryName];
                                          const isBelowThree = currentScore !== undefined && currentScore > 0 && currentScore < 3;
                                          
                                          return (
                                            <div 
                                              key={categoryName} 
                                              className={`flex flex-col gap-2 p-3 rounded-lg border transition-all duration-200 ${
                                                isBelowThree 
                                                  ? 'bg-yellow-500/10 border-yellow-500/30' 
                                                  : 'bg-card border-border'
                                              }`}
                                            >
                                              <div className="flex justify-between items-center">
                                                <Label className={`font-medium text-xs md:text-sm ${isBelowThree ? 'text-yellow-500 font-semibold' : 'text-foreground'}`}>
                                                  {categoryName}
                                                </Label>
                                                {isBelowThree && (
                                                  <span className="text-[10px] font-medium text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full animate-pulse">
                                                    Abaixo do esperado
                                                  </span>
                                                )}
                                              </div>
                                              
                                              <div className="grid grid-cols-5 gap-1.5">
                                                {[1, 2, 3, 4, 5].map(score => {
                                                  const isSelected = currentScore === score;
                                                  let customClass = "";
                                                  
                                                  if (isSelected) {
                                                    if (score < 3) {
                                                      customClass = "bg-yellow-500 hover:bg-yellow-600 text-black font-bold border-yellow-500";
                                                    } else {
                                                      customClass = "bg-primary hover:bg-primary/95 text-primary-foreground";
                                                    }
                                                  }
                                                  
                                                  return (
                                                    <Button 
                                                      key={score} 
                                                      type="button"
                                                      size="sm"
                                                      variant={isSelected ? 'default' : 'outline'} 
                                                      className={`h-8 md:h-9 ${customClass}`}
                                                      onClick={() => setCategoryScores({
                                                        ...categoryScores, 
                                                        [categoryName]: score
                                                      })}
                                                    >
                                                      {score}
                                                    </Button>
                                                  );
                                                })}
                                              </div>

                                              {currentScore && (
                                                <div className={`text-[11px] font-medium ${isBelowThree ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                                                  Status: <span className="underline">{
                                                    currentScore === 1 ? "Inadequado" :
                                                    currentScore === 2 ? "Precisa melhorar" :
                                                    currentScore === 3 ? "Bom" :
                                                    currentScore === 4 ? "Muito bom" :
                                                    "Excelente"
                                                  }</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      }
                                      
                                      <Label>Observações {attendanceStatus === 'absent' && <span className="text-destructive">*</span>}</Label>
                                      <Input placeholder={attendanceStatus === 'absent' ? "Informe o motivo da falta (obrigatório)..." : "Adicione observações para esta avaliação..."} value={observations} onChange={e => setObservations(e.target.value)} />
                                      
                                      <Button onClick={handleSaveEvaluation} className="w-full">Salvar Avaliação</Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                        {filteredProfessionals.map(p => {
                                            const run = evaluationRuns.find(r => r.evaluatedProfessionalId === p.id);
                                            const status = run ? (run.attendanceStatus === 'absent' ? 'faltas' : 'avaliados') : 'pendentes';
                                            
                                            return (
                                                <div key={p.id} className="flex justify-between items-center p-3 border-b hover:bg-muted/50">
                                                    <div>
                                                        <div className="font-medium">{p.name}</div>
                                                        <div className="flex items-center gap-2 text-xs mt-1">
                                                            <span className={`capitalize px-2 py-0.5 rounded-full ${
                                                                status === 'pendentes' ? 'bg-yellow-500/10 text-yellow-500' :
                                                                status === 'avaliados' ? 'bg-green-500/10 text-green-500' :
                                                                'bg-red-500/10 text-red-500'
                                                            }`}>
                                                                {status === 'pendentes' ? 'Pendente' : status === 'avaliados' ? 'Avaliado' : 'Falta'}
                                                            </span>
                                                            {run && run.totalScore && (
                                                                <span className="text-muted-foreground">Nota: {run.totalScore}</span>
                                                            )}
                                                            {run && run.classification && (
                                                                <span className="text-muted-foreground">- {run.classification}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        {status === 'pendentes' && (
                                                            <>
                                                                <Button size="sm" onClick={() => { 
                                                                    setEvalProfessionalId(p.id); 
                                                                    setAttendanceStatus('present'); 
                                                                    setCategoryScores({});
                                                                    setObservations("");
                                                                }}>Avaliar</Button>
                                                                <Button size="sm" variant="destructive" onClick={() => { 
                                                                    setEvalProfessionalId(p.id); 
                                                                    setAttendanceStatus('absent'); 
                                                                    setCategoryScores({});
                                                                    setObservations("");
                                                                }}>Falta</Button>
                                                            </>
                                                        )}
                                                        {status !== 'pendentes' && (
                                                            <Button size="sm" variant="outline" onClick={() => { 
                                                                setEvalProfessionalId(p.id); 
                                                                setAttendanceStatus(run?.attendanceStatus || ''); 
                                                                setCategoryScores(run?.categoryScores || {});
                                                                setObservations(run?.observations || run?.absenceReason || '');
                                                            }}>Ver/Editar</Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                  )}

                              </div>
                          </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
             )}
        </section>

        {/* B) Relatórios */}
        <section className="space-y-4">
             <h3 className="text-xl font-heading">Relatórios de Avaliação</h3>
             <Card>
                <CardContent className="py-6 space-y-4">
                    <div className="flex gap-2">
                        <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
                        <Button onClick={fetchReport} disabled={loadingReport}>Buscar relatório</Button>
                        <Button onClick={generatePDF} disabled={reportRuns.length === 0} variant="outline">Baixar relatório em PDF</Button>
                    </div>
                </CardContent>
             </Card>
        </section>

        {/* C) Operational */}
        <section className="space-y-4">
             <h3 className="text-xl font-heading">Checklist Operacional</h3>
             {!activeOperationalChecklist ? (
                <Card>
                   <CardContent className="py-6 text-center"><p>Nenhum checklist operacional.</p></CardContent>
                </Card>
             ) : (
                <Card>
                    <CardHeader><CardTitle className="text-lg">{activeOperationalChecklist.title}</CardTitle></CardHeader>
                </Card>
             )}
        </section>
      </div>

    </div>
  );
}

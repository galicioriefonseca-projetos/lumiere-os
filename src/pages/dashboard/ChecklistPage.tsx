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
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { Checklist, ChecklistRun, ChecklistItemTemplate } from "../../types";
import { canEvaluateTeam } from "../../lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  ListTodo,
  Trash2,
  LayoutTemplate,
  PenLine,
  Search,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Sparkles,
  Award,
  CalendarDays,
  HelpCircle,
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
  const { salonData, userData } = useAuth();
  const [activeOperationalChecklists, setActiveOperationalChecklists] =
    useState<Checklist[]>([]);
  const [operationalRuns, setOperationalRuns] = useState<ChecklistRun[]>([]);
  const [
    activeProfessionalEvaluationChecklist,
    setActiveProfessionalEvaluationChecklist,
  ] = useState<Checklist | null>(null);
  const [allChecklists, setAllChecklists] = useState<Checklist[]>([]);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalPros, setTotalPros] = useState(0);
  const [evaluatedPros, setEvaluatedPros] = useState(0);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [evaluationRuns, setEvaluationRuns] = useState<ChecklistRun[]>([]);

  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [evalProfessionalId, setEvalProfessionalId] = useState<string>("");
  const [attendanceStatus, setAttendanceStatus] = useState<
    "present" | "absent" | ""
  >("");
  const [observations, setObservations] = useState("");
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>(
    {},
  );

  const [reportDate, setReportDate] = useState(
    new Date().toISOString().substring(0, 10),
  );
  const [reportRuns, setReportRuns] = useState<ChecklistRun[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<
    "todos" | "pendentes" | "avaliados" | "faltas"
  >("todos");
  const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);
  const [showCategoryCriteria, setShowCategoryCriteria] = useState<Record<string, boolean>>({});

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
          const isActive =
            data.isActive === true ||
            data.active === true ||
            data.status === "active" ||
            data.status === "ativo" ||
            (data.status === undefined && data.isActive !== false);
          if (isActive) pros.push({ id: doc.id, ...data });
        });
        setProfessionals(pros);
        setTotalPros(pros.length);
      }),
    );

    // 1. Fetch ALL templates (active and inactive) to allow administration
    const qt = query(
      collection(db, `salons/${salonData.id}/checklists`),
    );
    unsubs.push(
      onSnapshot(qt, (snapshot) => {
        const allList: Checklist[] = [];
        const ops: Checklist[] = [];
        let evalT: Checklist | null = null;

        snapshot.forEach((doc) => {
          const data = doc.data() as Checklist;
          const fullChecklist = { id: doc.id, ...data };
          allList.push(fullChecklist);

          const isEval =
            data.type === "professional_daily_evaluation" ||
            data.checklistGroup === "professional_evaluation";

          if (data.isActive !== false) {
            if (isEval) {
              evalT = fullChecklist;
            } else {
              ops.push(fullChecklist);
            }
          }
        });

        setAllChecklists(allList);
        setActiveOperationalChecklists(ops);
        setActiveProfessionalEvaluationChecklist(evalT);

        // Fetch runs for all checklists today
        const qrRuns = query(
          collection(db, `salons/${salonData.id}/checklistRuns`),
          where("date", "==", todayStr),
        );
        const unsubRuns = onSnapshot(qrRuns, (snap) => {
          const evRuns: ChecklistRun[] = [];
          const opRuns: ChecklistRun[] = [];

          snap.forEach((d) => {
            const run = { id: d.id, ...d.data() } as ChecklistRun;
            if (evalT && run.checklistId === evalT.id) {
              evRuns.push(run);
            } else {
              opRuns.push(run);
            }
          });

          setEvaluationRuns(evRuns);
          setEvaluatedPros(evRuns.length);
          setOperationalRuns(opRuns);
          setLoading(false);
        }, (err) => {
          console.error("Error reading runs today:", err);
          setLoading(false);
        });

        unsubs.push(unsubRuns);
      }, (err) => {
        console.error("Error template sub", err);
        setLoading(false);
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [salonData]);

  const handleCreateEssenzaChecklist = async () => {
    if (!salonData) return;
    const template = predefinedTemplates.find(
      (t) => t.type === "professional_daily_evaluation",
    );
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
      items: template.items.map((item, index) => ({
        id: `item-${index}`,
        ...item,
      })),
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

  const handleCreatePredefinedOperationalChecklist = async (templateTitle: string) => {
    if (!salonData) return;
    const template = predefinedTemplates.find((t) => t.title === templateTitle);
    if (!template) {
      toast.error("Template operacional não encontrado");
      return;
    }

    const docRef = doc(collection(db, `salons/${salonData.id}/checklists`));
    const payload = removeUndefinedDeep({
      title: template.title,
      description: template.description || "",
      type: template.type || "standard",
      checklistGroup: template.checklistGroup || "operational",
      scoringMode: template.scoringMode || "checkbox",
      items: template.items.map((item, index) => ({
        id: `item-${index}`,
        ...item,
      })),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await setDoc(docRef, payload);
      toast.success(`Checklist operatório "${template.title}" ativado com sucesso!`);
    } catch (e) {
      toast.error("Erro ao ativar checklist");
      console.error(e);
    }
  };

  const handleDeactivateChecklist = async (id: string) => {
    if (!salonData) return;
    try {
      await updateDoc(doc(db, `salons/${salonData.id}/checklists`, id), {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
      toast.success("Checklist removido do painel ativo.");
    } catch (e) {
      toast.error("Erro ao desativar checklist");
      console.error(e);
    }
  };

  const handleToggleChecklistActive = async (id: string, currentStatus: boolean | undefined) => {
    if (!salonData) return;
    const isNowActive = currentStatus === undefined ? true : !currentStatus;
    try {
      await updateDoc(doc(db, `salons/${salonData.id}/checklists`, id), {
        isActive: isNowActive,
        updatedAt: serverTimestamp(),
      });
      toast.success(
        isNowActive
          ? "Checklist ativado e exibido na página principal."
          : "Checklist desativado e ocultado da exibição ativa."
      );
    } catch (e) {
      toast.error("Erro ao atualizar status do checklist");
      console.error(e);
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    if (!salonData) return;
    try {
      await deleteDoc(doc(db, `salons/${salonData.id}/checklists`, id));
      toast.success("Checklist excluído definitivamente.");
    } catch (e) {
      toast.error("Erro ao excluir checklist");
      console.error(e);
    }
  };

  const toggleOperationalItem = async (checklist: Checklist, itemId: string) => {
    if (!salonData) return;
    const currentRun = operationalRuns.find(r => r.checklistId === checklist.id);
    const completedItems = currentRun?.completedItems ? [...currentRun.completedItems] : [];

    const idx = completedItems.indexOf(itemId);
    if (idx > -1) {
      completedItems.splice(idx, 1);
    } else {
      completedItems.push(itemId);
    }

    const totalItems = checklist.items.length;
    const pct = totalItems > 0 ? Math.round((completedItems.length / totalItems) * 100) : 0;

    const runId = `${checklist.id}_${todayStr}`;
    const runData = {
      id: runId,
      checklistId: checklist.id,
      checklistTitle: checklist.title,
      checklistType: "standard",
      completedItems: completedItems,
      completionPercentage: pct,
      date: todayStr,
      status: pct === 100 ? "completed" : "pending",
      updatedAt: Date.now(),
      createdAt: currentRun?.createdAt || Date.now()
    };

    try {
      const runRef = doc(db, `salons/${salonData.id}/checklistRuns`, runId);
      await setDoc(runRef, removeUndefinedDeep(runData));
      toast.success("Item do checklist atualizado!");
    } catch (err) {
      console.error("Error updating checklist item run:", err);
      toast.error("Erro ao atualizar o progresso.");
    }
  };

  const generateOperationalPDF = () => {
    const doc = new jsPDF();
    doc.text(`Lumière OS — Relatório Operacional: ${todayStr}`, 10, 10);

    const tableData: any[] = [];
    activeOperationalChecklists.forEach((chk) => {
      const run = operationalRuns.find((r) => r.checklistId === chk.id);
      const completedIds = run?.completedItems || [];

      chk.items.forEach((item) => {
        const isCompleted = completedIds.includes(item.id);
        tableData.push([
          chk.title,
          item.label,
          isCompleted ? "Concluído" : "Pendente"
        ]);
      });
    });

    if (tableData.length === 0) {
      doc.text("Nenhum item operatório executado hoje.", 10, 20);
    } else {
      autoTable(doc, {
        head: [["Checklist", "Ação do Processo", "Status Operacional"]],
        body: tableData,
        startY: 20
      });
    }

    doc.text(
      "Gerado pelo Lumière OS — MVP Excellence",
      10,
      doc.internal.pageSize.getHeight() - 10,
    );
    doc.save(`checklists_operacionais_${todayStr}.pdf`);
    toast.success("PDF operacional exportado com sucesso!");
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
    const rules = [
      ...activeProfessionalEvaluationChecklist.classificationRules,
    ].sort((a, b) => b.min - a.min);
    const rule = rules.find((r) => score >= r.min);
    return rule ? rule.label : "Precisa de alinhamento";
  };

  const handleSaveEvaluation = async (goToNext = false) => {
    if (
      !salonData ||
      !evalProfessionalId ||
      !activeProfessionalEvaluationChecklist
    )
      return;

    if (attendanceStatus === "present") {
      const allCategories =
        activeProfessionalEvaluationChecklist.categories || [];
      if (allCategories.some((c) => !categoryScores[c])) {
        toast.error("Preencha todas as categorias");
        return;
      }
    } else if (attendanceStatus === "absent") {
      if (!observations) {
        toast.error("Motivo da falta é obrigatório");
        return;
      }
    }

    const totalScore =
      attendanceStatus === "present"
        ? (Object.values(categoryScores).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number)
        : 0;
    const classification =
      attendanceStatus === "present"
        ? getClassification(totalScore as number)
        : "Falta registrada";
    const maxScore = activeProfessionalEvaluationChecklist.maxScore || 40;

    const existingRun = evaluationRuns.find(
      (r) => r.evaluatedProfessionalId === evalProfessionalId,
    );

    const runData: Partial<ChecklistRun> = {
      checklistId: activeProfessionalEvaluationChecklist.id,
      checklistTitle: activeProfessionalEvaluationChecklist.title,
      checklistType: activeProfessionalEvaluationChecklist.type,
      scoringMode: activeProfessionalEvaluationChecklist.scoringMode,
      date: todayStr,
      evaluationDate: todayStr,
      evaluatedProfessionalId: evalProfessionalId,
      evaluatedProfessionalName:
        professionals.find((p) => p.id === evalProfessionalId)?.name ||
        "Unknown",
      evaluatorName: userData?.fullName || "Administrador",
      attendanceStatus: attendanceStatus,
      observations: observations,
      categoryScores: attendanceStatus === "present" ? categoryScores : {},
      totalScore: attendanceStatus === "present" ? (totalScore as number) : undefined,
      maxScore: attendanceStatus === "present" ? maxScore : undefined,
      percentage:
        attendanceStatus === "present"
          ? ((totalScore as number) / maxScore) * 100
          : undefined,
      classification: classification,
      absenceReason: attendanceStatus === "absent" ? observations : undefined,
      status: "completed",
      createdAt:
        existingRun && existingRun.createdAt
          ? existingRun.createdAt
          : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const runRef = existingRun
        ? doc(db, `salons/${salonData.id}/checklistRuns`, existingRun.id)
        : doc(collection(db, `salons/${salonData.id}/checklistRuns`));
      await setDoc(runRef, removeUndefinedDeep(runData));
      toast.success("Avaliação salva");

      // Determine if there is a next pending professional
      const pendingPros = professionals.filter((p) => {
        if (p.id === evalProfessionalId) return false;
        const run = evaluationRuns.find(
          (r) => r.evaluatedProfessionalId === p.id,
        );
        return !run;
      });

      if (goToNext && pendingPros.length > 0) {
        const nextPro = pendingPros[0];
        setEvalProfessionalId(nextPro.id);
        setAttendanceStatus("present");
        setCategoryScores({});
        setObservations("");
      } else {
        setEvalProfessionalId("");
        setAttendanceStatus("");
        setObservations("");
        setCategoryScores({});
        setIsEvaluationOpen(false);
      }
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
      snap.forEach((doc) =>
        arr.push({ id: doc.id, ...doc.data() } as ChecklistRun),
      );
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
    const avaliados = reportRuns.filter(
      (r) => r.attendanceStatus === "present",
    ).length;
    const faltas = reportRuns.filter(
      (r) => r.attendanceStatus === "absent",
    ).length;
    const pendentes = total - avaliados - faltas;
    const totalPontos = reportRuns.reduce(
      (sum, run) => sum + (run.totalScore || 0),
      0,
    );
    const media = avaliados > 0 ? (totalPontos / avaliados).toFixed(1) : "-";

    const summary = [
      ["Total de profissionais", total.toString()],
      ["Avaliados", avaliados.toString()],
      ["Faltas", faltas.toString()],
      ["Pendentes", pendentes.toString()],
      [
        "Perc. de conclusão",
        total > 0
          ? `${Math.round(((avaliados + faltas) / total) * 100)}%`
          : "0%",
      ],
      ["Média de pontuação", media],
    ];

    autoTable(doc, {
      startY: 20,
      body: summary,
      theme: "plain",
    });

    const tableData = professionals.map((p) => {
      const run = reportRuns.find((r) => r.evaluatedProfessionalId === p.id);
      return [
        p.name,
        p.role || "Pro",
        run
          ? run.attendanceStatus === "absent"
            ? "Falta"
            : "Avaliado"
          : "Pendente",
        run?.totalScore || "-",
        run?.classification || "-",
        run?.observations || run?.absenceReason || "-",
      ];
    });

    autoTable(doc, {
      head: [
        [
          "Profissional",
          "Função",
          "Status",
          "Pontuação",
          "Classificação",
          "Obs/Motivo",
        ],
      ],
      body: tableData,
      startY: (doc as any).lastAutoTable.finalY + 10,
    });

    doc.text(
      "Gerado pelo Lumière OS",
      10,
      doc.internal.pageSize.getHeight() - 10,
    );
    doc.save(`relatorio_${reportDate}.pdf`);
  };

  const filteredProfessionals = professionals
    .filter((p) => {
      const run = evaluationRuns.find(
        (r) => r.evaluatedProfessionalId === p.id,
      );
      const status = run
        ? run.attendanceStatus === "absent"
          ? "faltas"
          : "avaliados"
        : "pendentes";

      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesFilter = filter === "todos" || status === filter;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const runA = evaluationRuns.find(
        (r) => r.evaluatedProfessionalId === a.id,
      );
      const runB = evaluationRuns.find(
        (r) => r.evaluatedProfessionalId === b.id,
      );
      const statusA = runA ? (runA.attendanceStatus === "absent" ? 2 : 3) : 1;
      const statusB = runB ? (runB.attendanceStatus === "absent" ? 2 : 3) : 1;
      return statusA - statusB;
    });

  const avaliados = evaluationRuns.filter(
    (r) => r.attendanceStatus === "present",
  ).length;
  const faltas = evaluationRuns.filter(
    (r) => r.attendanceStatus === "absent",
  ).length;
  const pendentes = totalPros - avaliados - faltas;
  const percentual =
    totalPros > 0 ? Math.round(((avaliados + faltas) / totalPros) * 100) : 0;

  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center sm:gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-heading font-light">Checklist</h2>
          <Button
            onClick={() => setIsHowToUseOpen(true)}
            variant="ghost"
            size="sm"
            className="text-[#a1a1aa] hover:text-primary hover:bg-white/5 border border-white/5 h-8 px-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            <span>Como usar</span>
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {/* A) Avaliação de Hoje */}
        {canEvaluateTeam(userData?.role) && (
          <section className="space-y-4">
          <h3 className="text-xl font-heading">Avaliação de Hoje</h3>
          {!activeProfessionalEvaluationChecklist ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground text-sm mb-4">
                  Nenhuma avaliação diária configurada.
                </p>
                <Button onClick={handleCreateEssenzaChecklist}>
                  Criar Avaliação Diária Essenza
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-lg font-heading font-medium text-primary">
                  Avaliação Diária Essenza
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4 text-xs md:text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-light">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> {evaluatedPros} de {totalPros} profissionais avaliados hoje
                  </span>
                  <span className="font-semibold text-primary">
                    {totalPros > 0 ? Math.round((evaluatedPros / totalPros) * 100) : 0}%
                  </span>
                </div>
                <Progress value={totalPros > 0 ? (evaluatedPros / totalPros) * 100 : 0} className="h-2 mb-6 bg-white/5" />
                <Dialog
                  open={isEvaluationOpen}
                  onOpenChange={(open) => {
                    setIsEvaluationOpen(open);
                    if (open) {
                      setFilter("pendentes");
                      setSearchTerm("");
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="w-full bg-primary hover:bg-gold-400 text-black font-semibold tracking-wide shadow-md transition-all duration-300">
                      Iniciar Avaliação Diária
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-card border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.6)] rounded-3xl p-0">
                    <DialogHeader className="p-6 pb-4 border-b border-white/5">
                      <DialogTitle className="text-xl font-heading font-light text-foreground flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" /> Avaliação Diária Essenza
                      </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-6">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                        <div className="bg-muted/40 p-3.5 rounded-2xl text-center border border-white/5 flex flex-col justify-center">
                          <div className="text-2xl font-light text-foreground font-heading">
                            {professionals.length}
                          </div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">
                            Total de profissionais
                          </div>
                        </div>
                        <div className="bg-green-500/5 p-3.5 rounded-2xl text-center border border-green-500/10 flex flex-col justify-center">
                          <div className="text-2xl font-light text-green-400 font-heading">
                            {
                              evaluationRuns.filter(
                                (r) => r.attendanceStatus === "present",
                              ).length
                            }
                          </div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-green-500 mt-1 font-semibold">
                            Avaliados
                          </div>
                        </div>
                        <div className="bg-destructive/5 p-3.5 rounded-2xl text-center border border-destructive/10 flex flex-col justify-center">
                          <div className="text-2xl font-light text-destructive font-heading">
                            {
                              evaluationRuns.filter(
                                (r) => r.attendanceStatus === "absent",
                              ).length
                            }
                          </div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-destructive mt-1 font-semibold">
                            Faltas registradas
                          </div>
                        </div>
                        <div className="bg-yellow-500/5 p-3.5 rounded-2xl text-center border border-yellow-500/10 flex flex-col justify-center">
                          <div className="text-2xl font-light text-yellow-500 font-heading font-semibold">
                            {Math.max(0, professionals.length - evaluationRuns.length)}
                          </div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-yellow-500 mt-1 font-semibold">
                            Pendentes
                          </div>
                        </div>
                        <div className="bg-primary/5 p-3.5 rounded-2xl text-center border border-primary/10 flex flex-col justify-center">
                          <div className="text-2xl font-medium text-primary font-heading font-semibold">
                            {professionals.length > 0
                              ? Math.round((evaluationRuns.length / professionals.length) * 100)
                              : 0}
                            %
                          </div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-primary mt-1 font-semibold">
                            Percentual concluído
                          </div>
                        </div>
                      </div>

                      {/* Search and Filters */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar profissional..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-10 bg-background/50 border-white/5 rounded-xl font-light text-sm text-foreground focus:border-primary/50"
                          />
                        </div>
                        <div className="flex gap-1.5 p-1 bg-muted/60 border border-white/5 rounded-xl self-start shrink-0">
                          {(
                            [
                              "todos",
                              "pendentes",
                              "avaliados",
                              "faltas",
                            ] as const
                          ).map((f) => (
                            <Button
                              key={f}
                              size="xs"
                              variant={filter === f ? "default" : "ghost"}
                              onClick={() => setFilter(f)}
                              className="text-xs rounded-lg px-3.5 h-8 font-medium capitalize"
                            >
                              {f === "todos" ? "Todos" : f === "pendentes" ? "Pendentes" : f === "avaliados" ? "Avaliados" : "Faltas"}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {evalProfessionalId ? (
                        <div className="space-y-6">
                          {/* Individual Header Info */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/30 border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold font-heading">
                                {professionals
                                  .find((p) => p.id === evalProfessionalId)
                                  ?.name.charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                  Avaliar Profissional
                                </span>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                  <h3 className="font-heading font-medium text-base text-foreground">
                                    {
                                      professionals.find(
                                        (p) => p.id === evalProfessionalId,
                                      )?.name
                                    }
                                  </h3>
                                  <span className="text-[10px] text-primary bg-primary/10 border border-primary/25 px-2.5 py-0.5 rounded-full font-mono uppercase font-bold tracking-wider">
                                    {professionals.find((p) => p.id === evalProfessionalId)?.role || "Profissional"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Button
                              onClick={() => {
                                setEvalProfessionalId("");
                                setAttendanceStatus("");
                                setCategoryScores({});
                                setObservations("");
                              }}
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-xl border-white/10 text-xs"
                            >
                              <ArrowLeft className="w-4 h-4 mr-1.5 text-muted-foreground" /> Voltar à lista
                            </Button>
                          </div>

                          <div className="flex gap-1.5 p-1.5 bg-background border border-white/5 rounded-2xl max-w-sm">
                            <Button
                              size="sm"
                              onClick={() => setAttendanceStatus("present")}
                              variant={
                                attendanceStatus === "present"
                                  ? "default"
                                  : "ghost"
                              }
                              className={`flex-1 rounded-xl text-xs font-semibold h-9 ${
                                attendanceStatus === "present"
                                  ? "bg-primary text-black hover:bg-gold-400 font-bold"
                                  : "text-muted-foreground hover:bg-white/5"
                              }`}
                            >
                              Ficha de Presença
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setAttendanceStatus("absent")}
                              variant={
                                attendanceStatus === "absent"
                                  ? "destructive"
                                  : "ghost"
                              }
                              className={`flex-1 rounded-xl text-xs font-semibold h-9 ${
                                attendanceStatus === "absent"
                                  ? "bg-red-600 text-white hover:bg-red-700 font-bold"
                                  : "text-muted-foreground hover:bg-white/5"
                              }`}
                            >
                              Registrar Falta
                            </Button>
                          </div>

                          {attendanceStatus === "present" && (
                            <div className="space-y-6">
                              {/* Real-time score calculator visual element */}
                              {(() => {
                                const liveScore = Object.values(categoryScores).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
                                const liveClassification = getClassification(liveScore as number);
                                const liveMaxScore = activeProfessionalEvaluationChecklist?.maxScore || 40;
                                const livePercentage = Math.round(((liveScore as number) / liveMaxScore) * 100);
                                const allDone = activeProfessionalEvaluationChecklist?.categories?.every(
                                  (c) => categoryScores[c] !== undefined,
                                );

                                return (
                                  <Card className="border border-primary/20 bg-primary/5 rounded-2xl overflow-hidden relative">
                                    <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                      <div className="space-y-1">
                                        <span className="text-[10px] text-primary uppercase font-bold tracking-wider">
                                          Pontuação em Tempo Real
                                        </span>
                                        <div className="flex items-baseline gap-2">
                                          <h4 className="text-2xl font-light font-heading text-foreground font-semibold">
                                            Total atual: {liveScore}/{liveMaxScore} pts <span className="text-xs text-muted-foreground font-light">({livePercentage}%)</span>
                                          </h4>
                                        </div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                          Classificação atual: <span className="font-bold text-primary uppercase">{liveClassification}</span>
                                        </p>
                                      </div>
                                      <div className="w-full md:w-48 space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                          <span>Aproveitamento</span>
                                          <span>{livePercentage}%</span>
                                        </div>
                                        <Progress value={livePercentage} className="h-1.5 bg-background font-sans" />
                                        {!allDone && (
                                          <p className="text-[9px] text-amber-500 font-medium italic mt-1">Preencha todas as {activeProfessionalEvaluationChecklist?.categories?.length} categorias.</p>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })()}

                              {/* Legenda Geral */}
                              <div className="space-y-2.5">
                                <Label className="text-xs uppercase tracking-widest text-primary font-bold">
                                  Legenda de Notas & Padrão de Excelência
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-white/[0.02] p-4 rounded-2xl text-[11px] text-[#a1a1aa] border border-white/5 font-sans">
                                  <div className="flex sm:flex-col items-start sm:items-center sm:text-center gap-2 sm:gap-1 bg-white/[0.01] p-2 rounded-xl border border-white/[0.02]">
                                    <span className="w-6 h-6 rounded-full bg-red-600/20 text-red-500 font-bold text-xs flex items-center justify-center shrink-0">1</span>
                                    <div className="text-left sm:text-center">
                                      <p className="font-semibold text-white">Inadequado</p>
                                      <p className="text-[9px] mt-0.5 leading-tight">comprometeu o padrão do salão</p>
                                    </div>
                                  </div>
                                  <div className="flex sm:flex-col items-start sm:items-center sm:text-center gap-2 sm:gap-1 bg-white/[0.01] p-2 rounded-xl border border-white/[0.02]">
                                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold text-xs flex items-center justify-center shrink-0">2</span>
                                    <div className="text-left sm:text-center">
                                      <p className="font-semibold text-white">Precisa melhorar</p>
                                      <p className="text-[9px] mt-0.5 leading-tight">apresentou falhas que precisam ser corrigidas</p>
                                    </div>
                                  </div>
                                  <div className="flex sm:flex-col items-start sm:items-center sm:text-center gap-2 sm:gap-1 bg-white/[0.01] p-2 rounded-xl border border-white/[0.02]">
                                    <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">3</span>
                                    <div className="text-left sm:text-center">
                                      <p className="font-semibold text-white">Bom</p>
                                      <p className="text-[9px] mt-0.5 leading-tight">cumpriu o básico esperado</p>
                                    </div>
                                  </div>
                                  <div className="flex sm:flex-col items-start sm:items-center sm:text-center gap-2 sm:gap-1 bg-white/[0.01] p-2 rounded-xl border border-white/[0.02]">
                                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">4</span>
                                    <div className="text-left sm:text-center">
                                      <p className="font-semibold text-white">Muito bom</p>
                                      <p className="text-[9px] mt-0.5 leading-tight">cumpriu muito bem o padrão</p>
                                    </div>
                                  </div>
                                  <div className="flex sm:flex-col items-start sm:items-center sm:text-center gap-2 sm:gap-1 bg-white/[0.01] p-2 rounded-xl border border-white/[0.02]">
                                    <span className="w-6 h-6 rounded-full bg-green-600/20 text-green-400 font-bold text-xs flex items-center justify-center shrink-0">5</span>
                                    <div className="text-left sm:text-center">
                                      <p className="font-semibold text-white">Excelente</p>
                                      <p className="text-[9px] mt-0.5 leading-tight">superou o padrão esperado</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                {activeProfessionalEvaluationChecklist?.items
                                  .filter(
                                    (item, index, self) =>
                                      self.findIndex(
                                        (t) => t.category === item.category,
                                      ) === index,
                                  )
                                  .map((item) => {
                                    const categoryName = item.category || "Geral";
                                    const currentScore =
                                      categoryScores[categoryName];
                                    const isBelowThree =
                                      currentScore !== undefined &&
                                      currentScore > 0 &&
                                      currentScore < 3;

                                    const categoryDescriptions: Record<string, string[]> = {
                                      "Apresentação Pessoal": [
                                        "O profissional estava com aparência alinhada ao padrão do salão?",
                                        "Usou uniforme ou roupa adequada?",
                                        "Manteve postura profissional durante o atendimento?",
                                        "Transmitiu cuidado, higiene e organização pessoal?"
                                      ],
                                      "Pontualidade e Organização": [
                                        "Chegou no horário combinado?",
                                        "Preparou a estação antes do atendimento?",
                                        "Cumpriu os horários dos atendimentos?",
                                        "Evitou atrasos que prejudicaram a agenda?"
                                      ],
                                      "Atendimento à Cliente": [
                                        "Recebeu a cliente com cordialidade?",
                                        "Escutou as necessidades antes de executar o serviço?",
                                        "Explicou o procedimento com clareza?",
                                        "Manteve comunicação educada durante o atendimento?"
                                      ],
                                      "Qualidade do Serviço": [
                                        "Executou o serviço com atenção aos detalhes?",
                                        "O resultado final ficou dentro do padrão esperado?",
                                        "Evitou retrabalho ou correções?",
                                        "Seguiu o procedimento técnico corretamente?"
                                      ],
                                      "Organização do Ambiente": [
                                        "Manteve bancada, materiais e ferramentas organizados?",
                                        "Higienizou o espaço após o atendimento?",
                                        "Descartou resíduos corretamente?",
                                        "Contribuiu para a aparência premium do salão?"
                                      ],
                                      "Colaboração com a Equipe": [
                                        "Ajudou colegas quando necessário?",
                                        "Comunicou imprevistos com antecedência?",
                                        "Respeitou a rotina e o fluxo do salão?",
                                        "Teve postura cooperativa?"
                                      ],
                                      "Responsabilidades do Dia": [
                                        "Cumpriu as tarefas combinadas?",
                                        "Atualizou informações necessárias no sistema?",
                                        "Seguiu orientações da gerência?",
                                        "Demonstrou comprometimento com a rotina?"
                                      ],
                                      "Desempenho Comercial": [
                                        "Indicou serviços complementares quando adequado?",
                                        "Apresentou produtos ou tratamentos com naturalidade?",
                                        "Contribuiu para fidelização da cliente?",
                                        "Ajudou no alcance das metas do salão?"
                                      ],
                                    };

                                    const criteriaList = categoryDescriptions[categoryName] || [];
                                    const showCriteria = !!showCategoryCriteria[categoryName];

                                    return (
                                      <div
                                        key={categoryName}
                                        className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                                          isBelowThree
                                            ? "bg-yellow-500/10 border-yellow-500/25 shadow-[0_4px_20px_rgba(234,179,8,0.05)]"
                                            : "bg-muted/20 border-white/5 hover:border-white/10"
                                        }`}
                                      >
                                        <div className="flex flex-col justify-between items-start md:flex-row md:items-center gap-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <Label
                                              className={`font-medium text-xs md:text-sm ${isBelowThree ? "text-yellow-500 font-semibold flex items-center gap-1" : "text-foreground"}`}
                                            >
                                              {isBelowThree && <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />}
                                              {categoryName}
                                            </Label>
                                            {isBelowThree && (
                                              <span className="text-[10px] font-medium text-yellow-600 bg-yellow-500/15 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse font-sans">
                                                Abaixo de 3
                                              </span>
                                            )}
                                          </div>

                                          {criteriaList.length > 0 && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              onClick={() => setShowCategoryCriteria({
                                                ...showCategoryCriteria,
                                                [categoryName]: !showCriteria
                                              })}
                                              className="text-[10px] p-0 h-auto text-primary/70 hover:text-primary transition-colors flex items-center gap-1 font-mono hover:bg-transparent font-medium uppercase tracking-wider"
                                            >
                                              {showCriteria ? "Ocultar critérios ▴" : "Ver critérios ▾"}
                                            </Button>
                                          )}
                                        </div>

                                        {showCriteria && criteriaList.length > 0 && (
                                          <div className="bg-white/[0.01] border-l-2 border-primary/40 pl-3 py-1.5 space-y-1 font-sans text-[11px] text-[#a1a1aa] leading-relaxed select-none">
                                            {criteriaList.map((q, qidx) => (
                                              <p key={qidx} className="flex items-start gap-1">
                                                <span className="text-primary/55 mt-0.5 shrink-0">•</span> {q}
                                              </p>
                                            ))}
                                          </div>
                                        )}

                                        <div className="grid grid-cols-5 gap-1.5 font-sans">
                                          {[1, 2, 3, 4, 5].map((score) => {
                                            const isSelected =
                                              currentScore === score;
                                            let customClass = "border border-white/5 bg-white/5 text-[#a1a1aa] hover:bg-white/10 hover:text-white";

                                            if (isSelected) {
                                              if (score === 1) {
                                                customClass =
                                                  "bg-red-600 hover:bg-red-700 text-white font-bold border-red-600 shadow-md scale-105";
                                              } else if (score === 2) {
                                                customClass =
                                                  "bg-amber-500 hover:bg-amber-600 text-black font-bold border-amber-500 shadow-md scale-105";
                                              } else if (score === 3) {
                                                customClass =
                                                  "bg-blue-600 hover:bg-blue-700 text-white font-bold border-blue-600 shadow-md scale-105";
                                              } else if (score === 4) {
                                                customClass =
                                                  "bg-primary hover:bg-gold-400 text-black font-bold border-primary shadow-md scale-105";
                                              } else if (score === 5) {
                                                customClass =
                                                  "bg-green-600 hover:bg-green-700 text-white font-bold border-green-600 shadow-md scale-105";
                                              }
                                            }

                                            return (
                                              <Button
                                                key={score}
                                                type="button"
                                                size="sm"
                                                variant={
                                                  isSelected ? "default" : "outline"
                                                }
                                                className={`h-9 md:h-11 text-xs md:text-sm font-semibold rounded-xl transition-all duration-200 ${customClass}`}
                                                onClick={() =>
                                                  setCategoryScores({
                                                    ...categoryScores,
                                                    [categoryName]: score,
                                                  })
                                                }
                                              >
                                                {score}
                                              </Button>
                                            );
                                          })}
                                        </div>

                                        {currentScore && (
                                          <div
                                            className={`text-[11px] font-medium ${isBelowThree ? "text-yellow-500 font-semibold" : "text-muted-foreground"}`}
                                          >
                                            Critério de Desempenho:{" "}
                                            <span className="underline font-bold font-heading text-foreground">
                                              {currentScore === 1
                                                ? "1 = Inadequado"
                                                : currentScore === 2
                                                  ? "2 = Precisa de melhorias"
                                                  : currentScore === 3
                                                    ? "3 = Bom"
                                                    : currentScore === 4
                                                      ? "4 = Muito bom"
                                                      : "5 = Excelente"}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              Observações{" "}
                              {attendanceStatus === "absent" && (
                                <span className="text-destructive font-bold text-sm leading-none">*</span>
                              )}
                            </Label>
                            <Input
                              placeholder={
                                attendanceStatus === "absent"
                                  ? "Informe detalhadamente a justificativa para a falta..."
                                  : "Adicione observações de acompanhamento de equipe..."
                              }
                              value={observations}
                              onChange={(e) => setObservations(e.target.value)}
                              className="h-10 bg-background/50 border-white/5 rounded-xl font-light text-sm text-foreground"
                            />
                          </div>

                          {/* Combined Save Button options */}
                          {(() => {
                            const pendingPros = professionals.filter((p) => {
                              if (p.id === evalProfessionalId) return false;
                              return !evaluationRuns.some(
                                (r) => r.evaluatedProfessionalId === p.id,
                              );
                            });
                            const hasNextPending = pendingPros.length > 0;

                            return (
                              <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-white/5 font-sans">
                                {hasNextPending && (
                                  <Button
                                    onClick={() => handleSaveEvaluation(true)}
                                    className="flex-1 bg-[#d4af37] hover:bg-gold-400 text-black font-bold h-10 rounded-xl transition-all"
                                  >
                                    Salvar e avaliar próximo
                                  </Button>
                                )}
                                <Button
                                  variant={hasNextPending ? "outline" : "default"}
                                  onClick={() => handleSaveEvaluation(false)}
                                  className={`h-10 rounded-xl font-semibold ${hasNextPending ? "border-primary/20 text-primary w-full sm:w-48 hover:bg-primary/5" : "w-full bg-primary text-black"}`}
                                >
                                  Salvar Avaliação
                                </Button>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                          {filteredProfessionals.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-muted/10 font-sans">
                              <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                              <p className="text-sm font-light text-muted-foreground">
                                Nenhum profissional encontrado com os filtros ativos.
                              </p>
                            </div>
                          ) : (
                            filteredProfessionals.map((p) => {
                              const run = evaluationRuns.find(
                                (r) => r.evaluatedProfessionalId === p.id,
                              );
                              const status = run
                                ? run.attendanceStatus === "absent"
                                  ? "faltas"
                                  : "avaliados"
                                : "pendentes";

                              return (
                                <div
                                  key={p.id}
                                  className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 rounded-2xl border border-white/5 bg-muted/20 hover:bg-muted/40 transition-all duration-200"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm font-heading">
                                      {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-medium text-sm text-foreground">{p.name}</div>
                                        <span className="text-[9px] text-muted-foreground bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                                          {p.role || "Profissional"}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span
                                          className={`capitalize text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            status === "pendentes"
                                              ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/10"
                                              : status === "avaliados"
                                                ? "bg-green-500/10 text-green-500 border border-green-500/10"
                                                : "bg-red-500/10 text-red-500 border border-red-500/10"
                                          }`}
                                        >
                                          {status === "pendentes"
                                            ? "Pendente"
                                            : status === "avaliados"
                                              ? "Avaliado"
                                              : "Falta"}
                                        </span>
                                        {run && run.totalScore !== undefined && (
                                          <span className="text-xs text-muted-foreground font-mono">
                                            Pontos: {run.totalScore}/{run.maxScore || 40}
                                          </span>
                                        )}
                                        {run && run.classification && (
                                          <span className="text-xs text-primary font-medium">
                                            - {run.classification}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-sans">
                                    {status === "pendentes" && (
                                      <>
                                        <Button
                                          size="sm"
                                          className="bg-primary hover:bg-gold-400 text-black font-semibold text-xs px-3.5 h-8.5 rounded-xl transition-all shadow-sm"
                                          onClick={() => {
                                            setEvalProfessionalId(p.id);
                                            setAttendanceStatus("present");
                                            setCategoryScores({});
                                            setObservations("");
                                          }}
                                        >
                                          Avaliar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs px-3.5 h-8.5 rounded-xl transition-all font-semibold"
                                          onClick={() => {
                                            setEvalProfessionalId(p.id);
                                            setAttendanceStatus("absent");
                                            setCategoryScores({});
                                            setObservations("");
                                          }}
                                        >
                                          Registrar Falta
                                        </Button>
                                      </>
                                    )}
                                    {status !== "pendentes" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-white/10 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 px-3.5 h-8.5 rounded-xl"
                                        onClick={() => {
                                          setEvalProfessionalId(p.id);
                                          setAttendanceStatus(
                                            run?.attendanceStatus || "present",
                                          );
                                          setCategoryScores(
                                            run?.categoryScores || {},
                                          );
                                          setObservations(
                                            run?.observations ||
                                              run?.absenceReason ||
                                              "",
                                          );
                                        }}
                                      >
                                        Ver/Editar
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </section>
        )}

        {/* B) Relatórios */}
        {canEvaluateTeam(userData?.role) && (
          <section className="space-y-4">
          <h3 className="text-xl font-heading">Relatórios de Avaliação</h3>
          <Card>
            <CardContent className="py-6 space-y-4">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
                <Button onClick={fetchReport} disabled={loadingReport}>
                  Buscar relatório
                </Button>
                <Button
                  onClick={generatePDF}
                  disabled={reportRuns.length === 0}
                  variant="outline"
                >
                  Baixar relatório em PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
        )}

        {/* C) Operational */}
        <section className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-heading font-light tracking-tight text-white flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-primary" /> Checklist Operacional
              </h3>
              <p className="text-muted-foreground text-xs font-light">
                Controle as rotinas de abertura, fechamento e higienização diária do estabelecimento.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsManageDialogOpen(true)}
                className="h-9 rounded-xl border-white/10 text-xs px-3.5 bg-white/5 text-primary hover:bg-white/10 hover:border-primary/50 transition-all font-semibold"
              >
                Gerenciar Rotinas
              </Button>
              {activeOperationalChecklists.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateOperationalPDF}
                  className="h-9 rounded-xl border-white/10 text-xs px-3.5 hover:bg-white/5"
                >
                  Exportar Rotinas de Hoje (PDF)
                </Button>
              )}
            </div>
          </div>

          {activeOperationalChecklists.length === 0 ? (
            <Card className="border-white/10 bg-card/40 rounded-2xl shadow-xl overflow-hidden">
              <CardContent className="py-12 text-center max-w-2xl mx-auto space-y-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto">
                  <LayoutTemplate className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-foreground">
                    Ative as Rotinas Diárias do Salão
                  </h4>
                  <p className="text-muted-foreground text-xs mt-1.5 max-w-md mx-auto">
                    Configure e ative os checklists operacionais recorrentes para garantir o padrão premium de organização e segurança.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  {[
                    {
                      title: "Checklist de Abertura do Salão",
                      desc: "Agenda, equipamentos e recepção.",
                    },
                    {
                      title: "Checklist de Fechamento do Salão",
                      desc: "Caixa, estoque e segurança do salão.",
                    },
                    {
                      title: "Checklist de Limpeza e Organização",
                      desc: "Manutenção e higienização geral.",
                    },
                    {
                      title: "Checklist de Manutenção de Equipamentos",
                      desc: "Validade de produtos, limpeza e organização do espaço.",
                    },
                  ].map((tpl) => (
                    <Button
                      key={tpl.title}
                      variant="outline"
                      onClick={() => handleCreatePredefinedOperationalChecklist(tpl.title)}
                      className="flex flex-col items-center justify-center p-5 h-auto text-center border-white/10 bg-white/5 hover:border-primary/40 hover:bg-primary/5 rounded-2xl transition-all select-none space-y-2"
                    >
                      <span className="font-semibold text-xs text-foreground block">
                        {tpl.title.replace("Checklist de ", "")}
                      </span>
                      <span className="text-[10px] text-muted-foreground block line-clamp-2 leading-tight">
                        {tpl.desc}
                      </span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {activeOperationalChecklists.map((chk) => {
                const run = operationalRuns.find((r) => r.checklistId === chk.id);
                const completedCount = run?.completedItems?.length || 0;
                const totalItems = chk.items?.length || 0;
                const pct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
                const isFinished = pct === 100;

                return (
                  <Card key={chk.id} className="border-white/10 bg-card/45 rounded-2xl shadow-lg relative overflow-hidden transition-all duration-300">
                    <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base font-medium text-white">
                          {chk.title}
                        </CardTitle>
                        {chk.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-light">
                            {chk.description}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeactivateChecklist(chk.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-white/5 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      {/* Operational Progress indicator */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-light">
                          Progresso de Hoje
                        </span>
                        <span className="font-semibold text-foreground">
                          {completedCount} de {totalItems} concluídos ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5 bg-white/5" />

                      {/* Display Completed Celebration */}
                      {isFinished ? (
                        <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-between gap-3 text-xs text-green-400 font-semibold animate-fade-in shadow-md">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 animate-pulse text-green-400" /> Rotina concluída com sucesso!
                          </span>
                          <span className="bg-green-500/25 text-green-300 uppercase font-bold tracking-wider px-2 py-0.5 rounded text-[9px]">
                            100% OK
                          </span>
                        </div>
                      ) : null}

                      {/* Iterative Checkbox Item Lists */}
                      <div className="space-y-1 pt-1">
                        {chk.items.map((item) => {
                          const isCompleted = run?.completedItems?.includes(item.id) || false;

                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleOperationalItem(chk, item.id)}
                              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                                isCompleted
                                  ? "bg-white/5 text-muted-foreground"
                                  : "hover:bg-muted/30 hover:shadow-xs text-foreground"
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 select-none animate-scale-up" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-white/20 hover:border-primary/50 shrink-0 transition-all select-none bg-background" />
                              )}
                              <span
                                className={`text-xs font-light select-none ${
                                  isCompleted ? "line-through opacity-70" : ""
                                }`}
                              >
                                {item.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Modal de Gerenciamento de Rotinas, Ativação e Ocultamento */}
        <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
          <DialogContent className="max-w-2xl bg-[#09090b]/95 border-white/10 text-white rounded-2xl shadow-2xl backdrop-blur-xl max-h-[85vh] overflow-y-auto w-[94vw] sm:w-[550px] md:w-[650px]">
            <DialogHeader className="border-b border-white/5 pb-4">
              <DialogTitle className="text-xl font-heading font-light tracking-tight text-white flex items-center gap-2">
                <ListTodo className="w-5.5 h-5.5 text-primary" /> Configuração de Checklist Operacional
              </DialogTitle>
              <p className="text-[#a1a1aa] text-xs font-light mt-1">
                Ative ou desative a exibição no painel diário e importe novos modelos recomendados para as suas rotinas.
              </p>
            </DialogHeader>

            <div className="space-y-6 pt-4 font-sans">
              
              {/* Seção 1: Rotinas Cadastradas (Checklists no Banco) */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Rotinas Cadastradas no Estabelecimento
                </h4>

                {allChecklists.filter(c => c.type !== "professional_daily_evaluation" && c.checklistGroup !== "professional_evaluation").length === 0 ? (
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-center text-xs text-muted-foreground">
                    Nenhum checklist operacional cadastrado. Importe um modelo abaixo para começar!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {allChecklists
                      .filter(c => c.type !== "professional_daily_evaluation" && c.checklistGroup !== "professional_evaluation")
                      .map((chk) => {
                        const isCurrentlyActive = chk.isActive !== false;
                        return (
                          <div
                            key={chk.id}
                            className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.05] transition-all"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-foreground">
                                  {chk.title}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  isCurrentlyActive 
                                    ? "bg-primary/10 text-primary border border-primary/20" 
                                    : "bg-white/5 text-[#a1a1aa] border border-white/10"
                                }`}>
                                  {isCurrentlyActive ? "Ativo" : "Inativo"}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">
                                {chk.description || "Sem descrição"} • {chk.items?.length || 0} itens
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant={isCurrentlyActive ? "outline" : "default"}
                                onClick={() => handleToggleChecklistActive(chk.id, isCurrentlyActive)}
                                className={`h-8 rounded-lg text-xs font-semibold px-3 transition-all ${
                                  isCurrentlyActive
                                    ? "border-white/10 text-muted-foreground hover:text-white"
                                    : "bg-primary hover:bg-gold-500 text-black border-transparent"
                                }`}
                              >
                                {isCurrentlyActive ? "Desativar / Ocultar" : "Ativar / Exibir"}
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteChecklist(chk.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-white/5 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Seção 2: Adicionar Novos Modelos */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Modelos Disponíveis para Importação
                </h4>

                <div className="grid sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                  {predefinedTemplates
                    .filter(t => t.checklistGroup === "operational")
                    .map((tpl) => {
                      const alreadyExists = allChecklists.some(c => c.title === tpl.title);
                      return (
                        <div
                          key={tpl.title}
                          className="bg-white/[0.02] border border-[#ffffff0a] rounded-xl p-3 flex flex-col justify-between gap-3 hover:border-white/15 transition-all"
                        >
                          <div>
                            <span className="font-semibold text-xs text-foreground block">
                              {tpl.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground block leading-tight mt-1 line-clamp-2">
                              {tpl.description}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.03]">
                            <span className="text-[9px] text-[#a1a1aa] font-mono">
                              {tpl.items.length} itens
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreatePredefinedOperationalChecklist(tpl.title)}
                              className="h-7 rounded-lg text-[10px] font-semibold px-2.5 border-white/10 hover:bg-primary hover:text-black hover:border-primary shrink-0 transition-colors"
                            >
                              {alreadyExists ? "Importar Cópia" : "Ativar Modelo"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

            </div>
          </DialogContent>
        </Dialog>
      {/* Diálogo Como Usar Checklist */}
      <Dialog open={isHowToUseOpen} onOpenChange={setIsHowToUseOpen}>
        <DialogContent className="max-w-2xl bg-[#0a0a0c]/98 border border-white/10 text-white rounded-2xl shadow-2xl backdrop-blur-xl w-[94vw] sm:w-[90vw]">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="text-lg md:text-xl font-heading font-light tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Como usar a Avaliação Diária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4 font-sans text-xs md:text-sm leading-relaxed text-[#a1a1aa] overflow-y-auto max-h-[60vh] pr-2">
            <div className="space-y-2">
              <p className="font-semibold text-white">Objetivo Principal:</p>
              <p className="text-[#a1a1aa] font-light">
                A Avaliação Diária serve para medir a postura, qualidade, organização, atendimento e o desempenho comercial geral de toda a equipe sob o padrão premium de excelência Essenza.
              </p>
            </div>

            <div className="border-t border-white/5 my-3 pt-3 space-y-2">
              <p className="font-semibold text-white">Regras de Operação:</p>
              <ul className="list-disc pl-5 space-y-2 font-light text-[#a1a1aa]">
                <li>
                  <strong className="text-white">Avaliação Individual:</strong> Cada profissional ativo do estabelecimento deve ser avaliado <span className="text-primary font-medium">uma vez por dia</span>.
                </li>
                <li>
                  <strong className="text-white">Faltas e Ausências:</strong> Se o profissional faltou no dia, utilize a opção <span className="text-red-400 font-medium">"Registrar Falta"</span> para justificar a ausência.
                </li>
                <li>
                  <strong className="text-white">Conclusão de 100%:</strong> O progresso do checklist diário só chegará a 100% de conclusão quando <span className="text-primary font-medium">todos os profissionais ativos</span> forem avaliados ou tiverem suas faltas registradas.
                </li>
                <li>
                  <strong className="text-white">Relatórios e Exportação:</strong> Você poderá consultar todo o histórico completo de avaliações, filtrar por profissional ou datas, e baixar em formato PDF de modo a manter um histórico físico ou digital.
                </li>
              </ul>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-xl space-y-1 mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Dica de Gerenciamento
              </p>
              <p className="text-[11px] text-[#a1a1aa] font-light leading-relaxed">
                Utilize o botão <strong className="text-white">"Salvar e avaliar próximo"</strong> para acelerar a rotina diária ao avaliar vários membros da equipe consecutivamente de forma fluida.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
            <Button onClick={() => setIsHowToUseOpen(false)} className="bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl text-xs px-5 h-9">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

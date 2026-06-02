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
import { getEvaluableFunctions, sanitizeFunctionSlug } from "../../lib/evaluation";
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
  ChevronDown,
  ChevronUp,
  FileText,
  Users,
  Info,
} from "lucide-react";
import {
  predefinedTemplates,
  PredefinedTemplate,
} from "../../data/checklistTemplates";
import jsPDF from "jspdf";
import ManageRotinasDialog from "../../components/checklist/ManageRotinasDialog";
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
  const [evalFunction, setEvalFunction] = useState<string>("");
  const [selectedFilterFunction, setSelectedFilterFunction] = useState<string>("");
  const [attendanceStatus, setAttendanceStatus] = useState<
    "present" | "absent" | "not_performed" | ""
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

  const [mobileStep, setMobileStep] = useState<"list" | "evaluation" | "completed">("list");
  const [incompleteValidationCategories, setIncompleteValidationCategories] = useState<string[]>([]);

  // Memo representing all unique professional + evaluable function targets
  const evaluationTargets = React.useMemo(() => {
    const targets: {
      professionalId: string;
      professionalName: string;
      evaluationFunction: string;
      primaryFunction: string;
      allFunctions: string[];
      professional: any;
    }[] = [];
    professionals.forEach((p) => {
      const funcs = getEvaluableFunctions(p);
      funcs.forEach((func) => {
        targets.push({
          professionalId: p.id,
          professionalName: p.name,
          evaluationFunction: func,
          primaryFunction: p.primaryFunction || p.professionalFunction || p.specialty || "Função não definida",
          allFunctions: funcs,
          professional: p,
        });
      });
    });
    return targets;
  }, [professionals]);

  // Evaluator function mapper for retrocompatibility and exact match
  const findRunForTarget = (target: any, runs: ChecklistRun[]) => {
    return runs.find((r) => {
      const runFunc = r.evaluationFunction || r.evaluatedFunction || r.professionalFunction || r.primaryFunction;
      
      if (runFunc && r.evaluatedProfessionalId === target.professionalId) {
        return sanitizeFunctionSlug(runFunc) === sanitizeFunctionSlug(target.evaluationFunction);
      }
      
      if (!runFunc && r.evaluatedProfessionalId === target.professionalId) {
        return target.evaluationFunction === target.primaryFunction;
      }
      
      return false;
    });
  };

  const distinctFunctions = React.useMemo(() => {
    const funcs: string[] = [];
    evaluationTargets.forEach((t) => {
      if (!funcs.includes(t.evaluationFunction)) {
        funcs.push(t.evaluationFunction);
      }
    });
    return funcs.sort();
  }, [evaluationTargets]);

  const stats = React.useMemo(() => {
    const total = evaluationTargets.length;
    let avaliadas = 0;
    let faltas = 0;
    let naoExecutadas = 0;
    
    evaluationTargets.forEach((t) => {
      const run = findRunForTarget(t, evaluationRuns);
      if (run) {
        if (run.attendanceStatus === "absent") {
          faltas++;
        } else if (run.attendanceStatus === "not_performed") {
          naoExecutadas++;
        } else {
          avaliadas++;
        }
      }
    });
    
    const pendentes = Math.max(0, total - avaliadas - faltas - naoExecutadas);
    const percentual = total > 0 ? Math.round(((avaliadas + faltas + naoExecutadas) / total) * 100) : 0;
    
    return {
      total,
      avaliadas,
      faltas,
      naoExecutadas,
      pendentes,
      percentual,
    };
  }, [evaluationTargets, evaluationRuns]);

  const scrollEvaluationToTop = () => {
    const container = document.getElementById("evaluation-scroll-container");
    if (container) {
      container.scrollTop = 0;
    }
  };

  useEffect(() => {
    if (evalProfessionalId) {
      scrollEvaluationToTop();
    }
  }, [evalProfessionalId]);

  const [isDailyExpanded, setIsDailyExpanded] = useState(() => {
    return localStorage.getItem("lumiere_checklist_daily_expanded") !== "false";
  });
  const [isReportsExpanded, setIsReportsExpanded] = useState(() => {
    return localStorage.getItem("lumiere_checklist_reports_expanded") === "true";
  });
  const [isOperationalExpanded, setIsOperationalExpanded] = useState(() => {
    return localStorage.getItem("lumiere_checklist_operational_expanded") === "true";
  });

  const toggleDaily = () => {
    const nextVal = !isDailyExpanded;
    setIsDailyExpanded(nextVal);
    localStorage.setItem("lumiere_checklist_daily_expanded", String(nextVal));
  };

  const toggleReports = () => {
    const nextVal = !isReportsExpanded;
    setIsReportsExpanded(nextVal);
    localStorage.setItem("lumiere_checklist_reports_expanded", String(nextVal));
  };

  const toggleOperational = () => {
    const nextVal = !isOperationalExpanded;
    setIsOperationalExpanded(nextVal);
    localStorage.setItem("lumiere_checklist_operational_expanded", String(nextVal));
  };

  const roleTranslations: Record<string, string> = {
    admin: "Administrador(a)",
    receptionist: "Recepcionista",
    professional: "Profissional",
    assistant: "Assistente",
    master_admin: "Master"
  };

  const getDisplayFunction = (p: any) => {
    if (!p) return "Profissional";
    const baseSpecialty = p.primaryFunction || p.professionalFunction || p.specialty || p.professionalCategory || p.category || p.title;
    if (baseSpecialty) return baseSpecialty;
    const roleTranslated = p.role ? (roleTranslations[p.role] || p.role) : "Profissional";
    return roleTranslated;
  };

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
      }, (error) => {
        console.error("Erro ao carregar profissionais:", error);
        setLoading(false);
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
    const docPdf = new jsPDF();
    docPdf.text(`Lumière OS — Relatório Operacional: ${todayStr}`, 10, 10);

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
      docPdf.text("Nenhum item operatório executado hoje.", 10, 20);
    } else {
      autoTable(docPdf, {
        head: [["Checklist", "Ação do Processo", "Status Operacional"]],
        body: tableData,
        startY: 20
      });
    }

    docPdf.text(
      "Gerado pelo Lumière OS — MVP Excellence",
      10,
      docPdf.internal.pageSize.getHeight() - 10,
    );
    docPdf.save(`checklists_operacionais_${todayStr}.pdf`);
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

  const handleSaveAndNext = async () => {
    if (
      !salonData ||
      !evalProfessionalId ||
      !activeProfessionalEvaluationChecklist ||
      !evalFunction
    )
      return;

    if (attendanceStatus === "present") {
      const allCategories =
        activeProfessionalEvaluationChecklist.categories || [];
      const missing = allCategories.filter((c) => categoryScores[c] === undefined);
      if (missing.length > 0) {
        toast.error("Preencha todas as 8 categorias antes de salvar.");
        setIncompleteValidationCategories(missing);
        return;
      }
    } else if (attendanceStatus === "absent") {
      if (!observations) {
        toast.error("Motivo da falta é obrigatório / Justificativa é obrigatória.");
        return;
      }
    }

    setIncompleteValidationCategories([]);

    const totalScore =
      attendanceStatus === "present"
        ? (Object.values(categoryScores).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number)
        : 0;
    const classification =
      attendanceStatus === "present"
        ? getClassification(totalScore as number)
        : attendanceStatus === "absent"
          ? "Falta registrada"
          : "Não executou a função";
    const maxScore = activeProfessionalEvaluationChecklist.maxScore || 40;

    const runId = `${todayStr}_${evalProfessionalId}_${sanitizeFunctionSlug(evalFunction)}`;
    const existingRun = evaluationRuns.find(
      (r) => r.id === runId || (r.evaluatedProfessionalId === evalProfessionalId && sanitizeFunctionSlug(r.evaluationFunction || r.evaluatedFunction || r.professionalFunction || r.primaryFunction) === sanitizeFunctionSlug(evalFunction))
    );

    const targetPro = professionals.find((p) => p.id === evalProfessionalId);
    const mainFunc = targetPro?.primaryFunction || targetPro?.professionalFunction || targetPro?.specialty || "Função não definida";
    const proFuncs = getEvaluableFunctions(targetPro);

    const runData: any = {
      id: runId,
      checklistId: activeProfessionalEvaluationChecklist.id,
      checklistTitle: activeProfessionalEvaluationChecklist.title,
      checklistType: activeProfessionalEvaluationChecklist.type,
      scoringMode: activeProfessionalEvaluationChecklist.scoringMode,
      date: todayStr,
      evaluationDate: todayStr,
      evaluatedProfessionalId: evalProfessionalId,
      evaluatedProfessionalName: targetPro?.name || "Unknown",
      evaluatedProfessionalEmail: targetPro?.email || "",
      evaluationFunction: evalFunction,
      evaluatedFunction: evalFunction,
      evaluatedPrimaryFunction: mainFunc,
      professionalFunctions: proFuncs,
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
      const runRef = doc(db, `salons/${salonData.id}/checklistRuns`, runId);
      await setDoc(runRef, removeUndefinedDeep(runData));
      toast.success("Avaliação salva");

      const updatedRuns = [
        ...evaluationRuns.filter(r => r.id !== runId),
        { ...runData, id: runId }
      ];

      const pendingTargets = evaluationTargets.filter(
        (t) => !findRunForTarget(t, updatedRuns as any)
      );

      if (pendingTargets.length > 0) {
        const nextTarget = pendingTargets[0];
        setEvalProfessionalId(nextTarget.professionalId);
        setEvalFunction(nextTarget.evaluationFunction);
        
        const nextRun = findRunForTarget(nextTarget, evaluationRuns);
        setAttendanceStatus(nextRun?.attendanceStatus || "present");
        setCategoryScores(nextRun?.categoryScores || {});
        setObservations(nextRun?.observations || nextRun?.absenceReason || "");
        setMobileStep("evaluation");
        setTimeout(scrollEvaluationToTop, 50);
      } else {
        setMobileStep("completed");
      }
    } catch (e) {
      toast.error("Erro ao salvar");
      console.error(e);
    }
  };

  const handleSaveOnly = async () => {
    if (
      !salonData ||
      !evalProfessionalId ||
      !activeProfessionalEvaluationChecklist ||
      !evalFunction
    )
      return;

    if (attendanceStatus === "present") {
      const allCategories =
        activeProfessionalEvaluationChecklist.categories || [];
      const missing = allCategories.filter((c) => categoryScores[c] === undefined);
      if (missing.length > 0) {
        toast.error("Preencha todas as 8 categorias antes de salvar.");
        setIncompleteValidationCategories(missing);
        return;
      }
    } else if (attendanceStatus === "absent") {
      if (!observations) {
        toast.error("Motivo da falta é obrigatório / Justificativa é obrigatória.");
        return;
      }
    }

    setIncompleteValidationCategories([]);

    const totalScore =
      attendanceStatus === "present"
        ? (Object.values(categoryScores).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number)
        : 0;
    const classification =
      attendanceStatus === "present"
        ? getClassification(totalScore as number)
        : attendanceStatus === "absent"
          ? "Falta registrada"
          : "Não executou a função";
    const maxScore = activeProfessionalEvaluationChecklist.maxScore || 40;

    const runId = `${todayStr}_${evalProfessionalId}_${sanitizeFunctionSlug(evalFunction)}`;
    const existingRun = evaluationRuns.find(
      (r) => r.id === runId || (r.evaluatedProfessionalId === evalProfessionalId && sanitizeFunctionSlug(r.evaluationFunction || r.evaluatedFunction || r.professionalFunction || r.primaryFunction) === sanitizeFunctionSlug(evalFunction))
    );

    const targetPro = professionals.find((p) => p.id === evalProfessionalId);
    const mainFunc = targetPro?.primaryFunction || targetPro?.professionalFunction || targetPro?.specialty || "Função não definida";
    const proFuncs = getEvaluableFunctions(targetPro);

    const runData: any = {
      id: runId,
      checklistId: activeProfessionalEvaluationChecklist.id,
      checklistTitle: activeProfessionalEvaluationChecklist.title,
      checklistType: activeProfessionalEvaluationChecklist.type,
      scoringMode: activeProfessionalEvaluationChecklist.scoringMode,
      date: todayStr,
      evaluationDate: todayStr,
      evaluatedProfessionalId: evalProfessionalId,
      evaluatedProfessionalName: targetPro?.name || "Unknown",
      evaluatedProfessionalEmail: targetPro?.email || "",
      evaluationFunction: evalFunction,
      evaluatedFunction: evalFunction,
      evaluatedPrimaryFunction: mainFunc,
      professionalFunctions: proFuncs,
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
      const runRef = doc(db, `salons/${salonData.id}/checklistRuns`, runId);
      await setDoc(runRef, removeUndefinedDeep(runData));
      toast.success("Avaliação salva");
      
      setMobileStep("list");
    } catch (e) {
      toast.error("Erro ao salvar");
      console.error(e);
    }
  };

  const continueNextPending = () => {
    const pendingTargets = evaluationTargets.filter((t) => !findRunForTarget(t, evaluationRuns));

    if (pendingTargets.length > 0) {
      const nextTarget = pendingTargets[0];
      setEvalProfessionalId(nextTarget.professionalId);
      setEvalFunction(nextTarget.evaluationFunction);
      
      const nextRun = findRunForTarget(nextTarget, evaluationRuns);
      setAttendanceStatus(nextRun?.attendanceStatus || "present");
      setCategoryScores(nextRun?.categoryScores || {});
      setObservations(nextRun?.observations || nextRun?.absenceReason || "");
      setMobileStep("evaluation");
      setTimeout(scrollEvaluationToTop, 50);
    } else {
      toast.info("Todos os profissionais e funções já foram avaliados hoje!");
    }
  };

  const handleViewReport = () => {
    setIsEvaluationOpen(false);
    setIsReportsExpanded(true);
    localStorage.setItem("lumiere_checklist_reports_expanded", "true");
    setReportDate(todayStr);
    setTimeout(() => {
      fetchReport();
      const el = document.getElementById("reports-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
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
    const docPdf = new jsPDF();
    docPdf.text(`Relatório de Avaliação Diária: ${reportDate}`, 10, 10);

    // Build the targets list for reporting
    const reportTargets: any[] = [];
    professionals.forEach((p) => {
      const funcs = getEvaluableFunctions(p);
      funcs.forEach((func) => {
        reportTargets.push({
          professional: p,
          function: func
        });
      });
    });

    const totalTargets = reportTargets.length;
    let avaliadosCount = 0;
    let faltasCount = 0;
    let naoExecCount = 0;
    let totalPontos = 0;

    reportTargets.forEach((item) => {
      const p = item.professional;
      const targetFunc = item.function;
      const run = reportRuns.find((r) => {
        const runFunc = r.evaluationFunction || r.evaluatedFunction || r.professionalFunction || r.primaryFunction;
        if (runFunc && r.evaluatedProfessionalId === p.id) {
          return sanitizeFunctionSlug(runFunc) === sanitizeFunctionSlug(targetFunc);
        }
        if (!runFunc && r.evaluatedProfessionalId === p.id) {
          const mainFunc = p.primaryFunction || p.professionalFunction || p.specialty || "Função não definida";
          return targetFunc === mainFunc;
        }
        return false;
      });

      if (run) {
        if (run.attendanceStatus === "absent") {
          faltasCount++;
        } else if (run.attendanceStatus === "not_performed") {
          naoExecCount++;
        } else {
          avaliadosCount++;
          totalPontos += (run.totalScore || 0);
        }
      }
    });

    const pendentesCount = Math.max(0, totalTargets - avaliadosCount - faltasCount - naoExecCount);
    const media = avaliadosCount > 0 ? (totalPontos / avaliadosCount).toFixed(1) : "-";

    const summary = [
      ["Total de Avaliações", totalTargets.toString()],
      ["Avaliadas", avaliadosCount.toString()],
      ["Faltas", faltasCount.toString()],
      ["Não Executadas", naoExecCount.toString()],
      ["Pendentes", pendentesCount.toString()],
      [
        "Perc. de conclusão",
        totalTargets > 0
          ? `${Math.round(((avaliadosCount + faltasCount + naoExecCount) / totalTargets) * 100)}%`
          : "0%",
      ],
      ["Média de pontuação", media],
    ];

    autoTable(docPdf, {
      startY: 20,
      body: summary,
      theme: "plain",
    });

    const tableData = reportTargets.map((item) => {
      const p = item.professional;
      const targetFunc = item.function;
      const run = reportRuns.find((r) => {
        const runFunc = r.evaluationFunction || r.evaluatedFunction || r.professionalFunction || r.primaryFunction;
        if (runFunc && r.evaluatedProfessionalId === p.id) {
          return sanitizeFunctionSlug(runFunc) === sanitizeFunctionSlug(targetFunc);
        }
        if (!runFunc && r.evaluatedProfessionalId === p.id) {
          const mainFunc = p.primaryFunction || p.professionalFunction || p.specialty || "Função não definida";
          return targetFunc === mainFunc;
        }
        return false;
      });

      let statusLabel = "Pendente";
      if (run) {
        if (run.attendanceStatus === "absent") statusLabel = "Falta";
        else if (run.attendanceStatus === "not_performed") statusLabel = "Não Executou";
        else statusLabel = "Avaliado";
      }

      return [
        p.name,
        targetFunc,
        statusLabel,
        run?.attendanceStatus === "present" ? (run.totalScore !== undefined ? run.totalScore : "-") : "-",
        run?.classification || "-",
        run?.observations || run?.absenceReason || "-",
      ];
    });

    autoTable(docPdf, {
      head: [
        [
          "Profissional",
          "Função Avaliada",
          "Status",
          "Pontuação",
          "Classificação",
          "Obs/Motivo",
        ],
      ],
      body: tableData,
      startY: (docPdf as any).lastAutoTable.finalY + 10,
    });

    docPdf.text(
      "Gerado pelo Lumière OS",
      10,
      docPdf.internal.pageSize.getHeight() - 10,
    );
    docPdf.save(`relatorio_${reportDate}.pdf`);
  };

  const filteredProfessionals = React.useMemo(() => {
    return evaluationTargets
      .filter((target) => {
        const run = findRunForTarget(target, evaluationRuns);
        
        let targetFilterStatus: "pendentes" | "avaliados" | "faltas" = "pendentes";
        if (run) {
          if (run.attendanceStatus === "absent" || run.attendanceStatus === "not_performed") {
            targetFilterStatus = "faltas";
          } else {
            targetFilterStatus = "avaliados";
          }
        }

        const matchesSearch = target.professionalName
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
          
        const matchesStatus = filter === "todos" || targetFilterStatus === filter;

        // Target function filter
        const matchesFunction = !selectedFilterFunction || target.evaluationFunction === selectedFilterFunction;

        return matchesSearch && matchesStatus && matchesFunction;
      })
      .sort((a, b) => {
        const runA = findRunForTarget(a, evaluationRuns);
        const runB = findRunForTarget(b, evaluationRuns);
        
        const statusValA = runA ? (runA.attendanceStatus === "absent" ? 2 : runA.attendanceStatus === "not_performed" ? 3 : 4) : 1;
        const statusValB = runB ? (runB.attendanceStatus === "absent" ? 2 : runB.attendanceStatus === "not_performed" ? 3 : 4) : 1;
        
        if (statusValA !== statusValB) {
          return statusValA - statusValB;
        }
        
        return a.professionalName.localeCompare(b.professionalName);
      });
  }, [evaluationTargets, evaluationRuns, searchTerm, filter, selectedFilterFunction]);

  const avaliados = stats.avaliadas;
  const faltas = stats.faltas;
  const pendentes = stats.pendentes;
  const percentual = stats.percentual;
  const totalProsCount = stats.total;

  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center sm:gap-4 flex-wrap pb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-heading font-light text-white">Checklist</h2>
          <Button
            onClick={() => setIsHowToUseOpen(true)}
            variant="ghost"
            size="sm"
            className="text-[#a1a1aa] hover:text-white hover:bg-white/5 border border-white/5 h-8 px-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            <span>Como usar</span>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* A) Avaliação Diária Essenza */}
        {canEvaluateTeam(userData?.role) && (
          <div className="border border-[#D4AF37]/15 bg-zinc-950/60 rounded-2xl overflow-hidden shadow-xl hover:border-[#D4AF37]/30 transition-all">
            {/* Clickable Header */}
            <div 
              onClick={toggleDaily}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/40 transition-all select-none border-b border-white/5"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Award className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white font-heading tracking-tight flex items-center gap-2">
                    Avaliação Diária Essenza
                  </h3>
                  <p className="text-xs text-zinc-404 font-light mt-0.5">
                    Avaliação diária do padrão operacional, postura e excelência de atendimento dos profissionais.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 self-end sm:self-auto shrink-0">
                <div className="text-right hidden md:block">
                  <span className="text-[11px] text-zinc-400 font-light block">Progresso Geral</span>
                  <span className="text-xs font-semibold text-white">
                    {percentual}% concluído ({avaliados + faltas}/{totalProsCount})
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 shrink-0 cursor-pointer">
                  {isDailyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Expanding Body Content */}
            {isDailyExpanded && (
              <div className="p-6 space-y-6">
                {!activeProfessionalEvaluationChecklist ? (
                  <div className="py-8 text-center max-w-md mx-auto space-y-4">
                    <p className="text-zinc-400 text-sm">
                      Nenhuma avaliação diária configurada ou ativa.
                    </p>
                    <Button onClick={handleCreateEssenzaChecklist} className="bg-primary hover:bg-gold-500 text-black font-semibold h-10 px-5 rounded-xl text-xs pb-1 shrink-0">
                      Criar de forma automática
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Compact layout representing total metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-zinc-900/30 border border-white/5 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-0.5">Total de Equipe</span>
                        <span className="text-lg font-heading font-medium text-white">{totalProsCount}</span>
                      </div>
                      <div className="bg-green-500/5 border border-green-500/10 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-green-400 block mb-0.5">Avaliados</span>
                        <span className="text-lg font-heading font-bold text-green-400">{avaliados}</span>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-red-500 block mb-0.5">Faltas</span>
                        <span className="text-lg font-heading font-bold text-red-400">{faltas}</span>
                      </div>
                      <div className="bg-yellow-500/5 border border-yellow-500/10 p-3 rounded-xl text-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-yellow-500 block mb-0.5">Pendentes</span>
                        <span className="text-lg font-heading font-bold text-yellow-500">{pendentes}</span>
                      </div>
                      <div className="bg-primary/5 border border-primary/10 p-3 rounded-xl text-center col-span-2 sm:col-span-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-primary block mb-0.5">Progresso</span>
                        <span className="text-lg font-heading font-bold text-[#D4AF37]">{percentual}%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <div className="flex justify-between text-xs text-zinc-400 font-light">
                         <span>Status de Preenchimento da Rotina</span>
                         <span className="font-semibold">{percentual}% Concluído</span>
                       </div>
                       <Progress value={percentual} className="h-2 bg-white/5" />
                    </div>

                    <Dialog
                      open={isEvaluationOpen}
                      onOpenChange={(open) => {
                        setIsEvaluationOpen(open);
                        if (open) {
                          setFilter("pendentes");
                          setSearchTerm("");
                          setSelectedFilterFunction("");
                          
                          const pendingTargets = evaluationTargets.filter((t) => !findRunForTarget(t, evaluationRuns));
                          if (pendingTargets.length > 0) {
                            const first = pendingTargets[0];
                            setEvalProfessionalId(first.professionalId);
                            setEvalFunction(first.evaluationFunction);
                            const run = findRunForTarget(first, evaluationRuns);
                            setAttendanceStatus(run?.attendanceStatus || "present");
                            setCategoryScores(run?.categoryScores || {});
                            setObservations(run?.observations || run?.absenceReason || "");
                            setMobileStep("evaluation");
                          } else if (evaluationTargets.length > 0) {
                            const first = evaluationTargets[0];
                            setEvalProfessionalId(first.professionalId);
                            setEvalFunction(first.evaluationFunction);
                            const run = findRunForTarget(first, evaluationRuns);
                            setAttendanceStatus(run?.attendanceStatus || "present");
                            setCategoryScores(run?.categoryScores || {});
                            setObservations(run?.observations || run?.absenceReason || "");
                            setMobileStep("list");
                          } else {
                            setEvalProfessionalId("");
                            setEvalFunction("");
                            setMobileStep("list");
                          }
                          setIncompleteValidationCategories([]);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button className="w-full bg-primary hover:bg-gold-500 text-black font-semibold tracking-wide shadow-md transition-all duration-300 rounded-xl h-11 text-xs uppercase font-bold cursor-pointer">
                          {evaluationRuns.length > 0 ? "Continuar Avaliação" : "Iniciar Avaliação Diária"}
                        </Button>
                      </DialogTrigger>
                      
                      <DialogContent className="max-w-5xl md:max-w-6xl w-full h-[100dvh] md:w-[95vw] md:h-[85vh] flex flex-col bg-zinc-950 border-0 md:border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.6)] rounded-none md:rounded-3xl p-0 overflow-hidden text-white font-sans">
                        
                        {/* Fixed header with mobile navigation */}
                        <DialogHeader className="p-5 pb-4 border-b border-white/5 flex flex-row items-center justify-between shrink-0">
                          <div className="flex items-center gap-2">
                            {mobileStep === "evaluation" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setMobileStep("list")}
                                className="h-8 w-8 text-zinc-400 hover:text-white mr-1 -ml-1 md:hidden"
                              >
                                <ArrowLeft className="w-4 h-4" />
                              </Button>
                            )}
                            <DialogTitle className="text-base sm:text-lg font-heading font-medium text-white flex items-center gap-2">
                              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-pulse" />
                              <span>
                                {mobileStep === "completed"
                                  ? "Avaliação Concluída"
                                  : mobileStep === "evaluation"
                                    ? "Ficha de Avaliação"
                                    : "Avaliação Diária Essenza"}
                              </span>
                            </DialogTitle>
                          </div>
                        </DialogHeader>

                        {/* Layout Content wrapper */}
                        {mobileStep === "completed" ? (
                          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center text-white bg-zinc-950 font-sans max-w-xl mx-auto space-y-6">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 animate-bounce mt-4">
                              <CheckCircle2 className="w-8 h-8" />
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-xl md:text-2xl font-heading font-normal tracking-tight text-white">
                                Avaliação Diária Concluída!
                              </h3>
                              <p className="text-xs md:text-sm text-zinc-404 font-light leading-relaxed">
                                Excelente! Todos os colaboradores ativos do estabelecimento foram devidamente avaliados ou tiveram suas faltas registradas hoje no LumièreOS.
                              </p>
                            </div>

                            {/* Summary panel */}
                            <div className="w-full bg-zinc-900/10 border border-white/5 rounded-2xl p-4 md:p-5 space-y-4">
                              <span className="text-[10px] text-primary uppercase font-bold tracking-wider font-mono block">Resumo do Dia</span>
                              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="bg-green-500/5 border border-green-500/10 p-3 rounded-xl">
                                  <span className="text-green-400 font-bold block text-lg">{avaliados}</span>
                                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider block mt-0.5 font-mono">Avaliados</span>
                                </div>
                                <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-xl">
                                  <span className="text-red-400 font-bold block text-lg">{faltas}</span>
                                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider block mt-0.5 font-mono">Faltas</span>
                                </div>
                                <div className="bg-zinc-850 border border-white/5 p-3 rounded-xl">
                                  <span className="text-white font-bold block text-lg">{totalProsCount}</span>
                                  <span className="text-zinc-500 text-[9px] uppercase tracking-wider block mt-0.5 font-mono">Total</span>
                                </div>
                              </div>

                              <div className="space-y-1.5 pt-2">
                                <div className="flex justify-between items-center text-[10px] text-zinc-400 uppercase font-mono">
                                  <span>Progresso Geral</span>
                                  <strong className="text-white">100%</strong>
                                </div>
                                <Progress value={100} className="h-2 bg-zinc-900" />
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2 pb-4">
                              <Button
                                onClick={handleViewReport}
                                className="flex-1 bg-primary hover:bg-gold-500 text-black font-semibold h-11 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                              >
                                Ver Relatório
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setIsEvaluationOpen(false)}
                                className="flex-1 border-white/10 text-white hover:bg-white/5 h-11 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                              >
                                Fechar Janela
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
                            
                            {/* LEFT SIDEBAR: Professionals list & Filters */}
                            <div className={`w-full md:w-5/12 lg:w-4/12 border-r border-white/5 flex flex-col h-full overflow-hidden ${mobileStep === "list" ? "flex" : "hidden md:flex"}`}>
                            
                            {/* Summary panel in left sidebar */}
                            <div className="p-4 bg-zinc-900/10 border-b border-white/5 space-y-3 shrink-0">
                              <div className="grid grid-cols-4 gap-1 text-center font-sans text-xs">
                                <div className="bg-zinc-900/50 p-1 px-1.5 rounded border border-white/5">
                                  <span className="text-[9px] text-zinc-500 font-light block">Equipe</span>
                                  <span className="font-semibold text-white">{totalProsCount}</span>
                                </div>
                                <div className="bg-green-500/5 p-1 px-1.5 rounded border border-green-500/10">
                                  <span className="text-[9px] text-green-400 font-light block">Aval.</span>
                                  <span className="font-semibold text-green-400">{avaliados}</span>
                                </div>
                                <div className="bg-red-500/5 p-1 px-1.5 rounded border border-red-500/10">
                                  <span className="text-[9px] text-red-100 font-light block">Falta</span>
                                  <span className="font-semibold text-red-500">{faltas}</span>
                                </div>
                                <div className="bg-yellow-500/5 p-1 px-1.5 rounded border border-yellow-500/10">
                                  <span className="text-[9px] text-yellow-500 font-semibold block">Pend.</span>
                                  <span className="font-semibold text-yellow-500">{pendentes}</span>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                                  <span>Conclusão</span>
                                  <span>{percentual}%</span>
                                </div>
                                <Progress value={percentual} className="h-1 bg-white/5" />
                              </div>
                            </div>

                            {/* Filters box */}
                            <div className="p-3 bg-zinc-900/5 border-b border-white/5 space-y-2 shrink-0">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                <Input
                                  placeholder="Buscar profissional..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="pl-8.5 h-8.5 bg-background border-white/5 rounded-lg text-xs placeholder:text-zinc-500 text-white focus-visible:ring-1 focus-visible:ring-primary/40"
                                />
                              </div>
                              
                              {/* Task 17: Filtro por função */}
                              {distinctFunctions.length > 0 && (
                                <div className="space-y-1 pt-1">
                                  <label className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-wider font-mono">Filtrar por Função</label>
                                  <select
                                    value={selectedFilterFunction}
                                    onChange={(e) => setSelectedFilterFunction(e.target.value)}
                                    className="w-full bg-zinc-950 border border-white/10 text-xs text-white rounded-lg h-8 px-2 focus:ring-1 focus:ring-primary/40 outline-none"
                                  >
                                    <option value="">Todas as funções</option>
                                    {distinctFunctions.map((func) => (
                                      <option key={func} value={func}>
                                        {func}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div className="flex gap-1 p-0.5 bg-zinc-900/60 border border-white/5 rounded-lg overflow-x-auto select-none pt-1">
                                {(["todos", "pendentes", "avaliados", "faltas"] as const).map((f) => (
                                  <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`flex-1 text-[9px] font-semibold py-1 px-1.5 rounded-md transition-all uppercase tracking-wider whitespace-nowrap active:scale-95 ${
                                      filter === f
                                        ? "bg-primary text-black"
                                        : "text-zinc-400 hover:text-white"
                                    }`}
                                  >
                                    {f === "todos" ? "Todos" : f === "pendentes" ? "Pend" : f === "avaliados" ? "Aval" : "Faltas"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* List block */}
                            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-zinc-950/40 font-sans">
                              {filteredProfessionals.length === 0 ? (
                                <div className="text-center py-12 px-2 text-zinc-500 text-xs font-light">
                                  Nenhum profissional encontrado.
                                </div>
                              ) : (
                                filteredProfessionals.map((target) => {
                                  const p = target.professional;
                                  const funcName = target.evaluationFunction;
                                  const run = findRunForTarget(target, evaluationRuns);
                                  const isSelected = evalProfessionalId === p.id && sanitizeFunctionSlug(evalFunction) === sanitizeFunctionSlug(funcName);
                                  
                                  const status = run
                                    ? run.attendanceStatus === "absent"
                                      ? "falta"
                                      : run.attendanceStatus === "not_performed"
                                        ? "nao_executou"
                                        : "avaliado"
                                    : "pendente";

                                  return (
                                    <div
                                      key={`${p.id}_${sanitizeFunctionSlug(funcName)}`}
                                      onClick={() => {
                                        setEvalProfessionalId(p.id);
                                        setEvalFunction(funcName);
                                        setAttendanceStatus(run?.attendanceStatus || "present");
                                        setCategoryScores(run?.categoryScores || {});
                                        setObservations(run?.observations || run?.absenceReason || "");
                                        setIncompleteValidationCategories([]);
                                        setMobileStep("evaluation");
                                      }}
                                      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none ${
                                        isSelected
                                          ? "bg-primary/10 border-primary/40 shadow-md"
                                          : "bg-zinc-900/30 border-white/5 hover:border-white/10 hover:bg-zinc-900/50"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                                          <p className="text-[10px] text-primary truncate mt-0.5">{funcName}</p>
                                        </div>
                                        
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                          status === "pendente"
                                            ? "bg-yellow-500/15 text-yellow-500 border border-yellow-500/10"
                                            : status === "avaliado"
                                              ? "bg-green-500/15 text-green-400 border border-green-500/10"
                                              : status === "falta"
                                                ? "bg-red-500/15 text-red-400 border border-red-500/10"
                                                : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/10"
                                        }`}>
                                          {status === "pendente" ? "Pente" : status === "avaliado" ? "Avaliado" : status === "falta" ? "Falta" : "Não Exec"}
                                        </span>
                                      </div>
                                      
                                      {run && run.totalScore !== undefined && (
                                        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-white/[0.03] font-mono">
                                          <span>Nota: <strong className="text-white">{run.totalScore}</strong>/40</span>
                                          <span className="text-primary font-bold">{run.classification}</span>
                                        </div>
                                      )}
                                      {run && (run.attendanceStatus === "absent" || run.attendanceStatus === "not_performed") && (
                                        <p className="text-[10px] text-zinc-400 italic mt-2 text-right font-light truncate">
                                          {run.observations || run.absenceReason || (run.attendanceStatus === "absent" ? "Falta registrada" : "Não executou função")}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* RIGHT CONTENT: Selected Professional Evaluation Sheet */}
                          <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-900/10">
                            {evalProfessionalId ? (
                              <>
                                {/* Evaluation Body Scrollable */}
                                <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
                                  
                                  {/* Professional detailed heading bar */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase shrink-0 text-sm">
                                        {professionals.find((p) => p.id === evalProfessionalId)?.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-[9px] uppercase tracking-wider text-[#D4AF37] font-bold font-mono flex items-center gap-1 flex-wrap">
                                          <span>Avaliação da Função:</span>
                                          <span className="bg-primary/20 text-[#D4AF37] px-2 py-0.5 rounded text-[10px] border border-primary/30 uppercase font-semibold font-mono">
                                            {evalFunction}
                                          </span>
                                        </p>
                                        <h3 className="font-heading font-medium text-sm md:text-base text-white mt-1">
                                          {professionals.find((p) => p.id === evalProfessionalId)?.name}
                                        </h3>
                                        <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                          <span>Função Principal: <strong>{professionals.find((p) => p.id === evalProfessionalId)?.primaryFunction || professionals.find((p) => p.id === evalProfessionalId)?.professionalFunction || "Não definida"}</strong></span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Present/Absent quick selector */}
                                    <div className="flex p-0.5 bg-zinc-950 border border-white/10 rounded-lg shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setAttendanceStatus("present")}
                                        className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded select-none transition-all cursor-pointer ${
                                          attendanceStatus === "present"
                                            ? "bg-primary text-black font-semibold"
                                            : "text-zinc-400 hover:text-white"
                                        }`}
                                      >
                                        Presença
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAttendanceStatus("absent")}
                                        className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded select-none transition-all cursor-pointer ${
                                          attendanceStatus === "absent"
                                            ? "bg-red-600 text-white font-semibold"
                                            : "text-zinc-400 hover:text-[#f87171]"
                                        }`}
                                      >
                                        Falta
                                      </button>
                                    </div>
                                  </div>

                                  {attendanceStatus === "present" && (
                                    <div className="space-y-6 animate-fade-in">
                                      
                                      {/* SCORE CALC PANEL */}
                                      {(() => {
                                        const liveScore = Object.values(categoryScores).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
                                        const liveClassification = getClassification(liveScore);
                                        const liveMaxScore = activeProfessionalEvaluationChecklist?.maxScore || 40;
                                        const livePercentage = Math.round((liveScore / liveMaxScore) * 100);
                                        const allDone = activeProfessionalEvaluationChecklist?.categories?.every(
                                          (c) => categoryScores[c] !== undefined
                                        );

                                        return (
                                          <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4 rounded-xl space-y-3 shadow-md">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                              <div>
                                                <span className="text-[10px] text-primary uppercase font-bold tracking-wider font-mono">Tempo Real</span>
                                                <h4 className="text-base font-semibold text-white mt-0.5">
                                                  Total Parcial: {liveScore}/{liveMaxScore} pts <span className="text-xs text-zinc-400 font-light">({livePercentage}%)</span>
                                                </h4>
                                              </div>
                                              
                                              <div className="text-left sm:text-right">
                                                <span className="text-[10px] text-zinc-500 font-light block">Classificação</span>
                                                <span className="text-xs font-bold text-primary uppercase tracking-wide">{liveClassification}</span>
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <Progress value={livePercentage} className="h-1.5 bg-zinc-900" />
                                              {!allDone && (
                                                <p className="text-[10px] text-[#D4AF37] font-semibold italic mt-1 text-right">
                                                  Preencha todas as 8 categorias para finalizar a nota.
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* Legend of grades */}
                                      <div className="bg-zinc-900/30 p-3.5 rounded-xl border border-white/5 space-y-2 select-none">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#d4af37] block font-mono">Legenda Geral de Desempenho</span>
                                        <div className="grid grid-cols-5 gap-1.5 text-[9px] text-center text-zinc-404 leading-tight font-sans">
                                          <div className="p-1 rounded bg-zinc-900/40 border border-white/5">
                                            <span className="font-bold text-red-500 block text-[10px]">1</span>
                                            <span>Inadequado</span>
                                          </div>
                                          <div className="p-1 rounded bg-zinc-900/40 border border-white/5">
                                            <span className="font-bold text-amber-500 block text-[10px]">2</span>
                                            <span>Ruim</span>
                                          </div>
                                          <div className="p-1 rounded bg-zinc-900/40 border border-white/5">
                                            <span className="font-bold text-blue-400 block text-[10px]">3</span>
                                            <span>Bom</span>
                                          </div>
                                          <div className="p-1 rounded bg-zinc-900/40 border border-white/5">
                                            <span className="font-bold text-primary block text-[10px]">4</span>
                                            <span>Muito Bom</span>
                                          </div>
                                          <div className="p-1 rounded bg-zinc-900/40 border border-white/10">
                                            <span className="font-bold text-green-400 block text-[10px]">5</span>
                                            <span>Excelente</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Categories list */}
                                      <div className="space-y-4">
                                        {activeProfessionalEvaluationChecklist?.items
                                          .filter((item, index, self) => self.findIndex((t) => t.category === item.category) === index)
                                          .map((item) => {
                                            const categoryName = item.category || "Geral";
                                            const currentScore = categoryScores[categoryName];
                                            const isBelowThree = currentScore !== undefined && currentScore > 0 && currentScore < 3;
                                            const showCriteria = !!showCategoryCriteria[categoryName];

                                            const categoryDescriptions: Record<string, string[]> = {
                                              "Apresentação Pessoal": [
                                                "O profissional estava com uniforme adequado e aparência impecável?",
                                                "Manteve cuidados com higiene, asseio e boa apresentação?",
                                                "Manifestou postura elegante de acordo com o padrão do salão Essenza?"
                                              ],
                                              "Pontualidade e Organização": [
                                                "Cumpriu o horário de entrada e início do expediente?",
                                                "Preparou com antecedência a estação e lavatório para uso?",
                                                "Evitou atrasos injustificados no fluxo de atendimentos?"
                                              ],
                                              "Atendimento à Cliente": [
                                                "Recebeu a cliente de forma radiante e extremamente educada?",
                                                "Praticou escuta empática das necessidades antes de iniciar?",
                                                "Explicou com calma as etapas e técnicas a serem executadas?"
                                              ],
                                              "Qualidade do Serviço": [
                                                "Demonstrou controle técnico pleno na realização técnica?",
                                                "Atenção minuciosa aos detalhes para que ficasse excelente?",
                                                "Seguiu à risca as instruções e normas recomendadas?"
                                              ],
                                              "Organização do Ambiente": [
                                                "Higienizou e organizou a bancada e espelho pós-finalizar?",
                                                "Manteve descarte correto de materiais e resíduos no lixo?",
                                                "Teve zelo absoluto com ferramentas e estações comuns?"
                                              ],
                                              "Colaboração com a Equipe": [
                                                "Cuidou do respeito com os outros profissionais de equipe?",
                                                "Prestou auxílio aos lavatórios ou recepção quando cabível?",
                                                "Manteve sintonia e clima gentil no cotidiano operacional?"
                                              ],
                                              "Responsabilidades do Dia": [
                                                "Atualizou com exatidão as informações no sistema / prontuários?",
                                                "Cumpriu as tarefas específicas do cronograma de seu dia?",
                                                "Realizou a manutenção básica de consumíveis da estação?"
                                              ],
                                              "Desempenho Comercial": [
                                                "Sugeriu tratamentos, rituais complementares ou combos?",
                                                "Apresentou de forma elegante os produtos Home Care Essenza?",
                                                "Incentivou delicadamente o retorno e novo agendamento?"
                                              ]
                                            };

                                            const criteriaList = categoryDescriptions[categoryName] || [];

                                            return (
                                              <div 
                                                key={categoryName}
                                                className={`p-4 rounded-xl border transition-all duration-300 ${
                                                  isBelowThree 
                                                    ? "bg-yellow-500/10 border-yellow-500/35" 
                                                    : "bg-zinc-900/30 border-white/5 hover:border-white/10"
                                                }`}
                                              >
                                                <div className="flex items-center justify-between gap-2.5 mb-2 flex-wrap">
                                                  <div className="flex items-center gap-1.5 font-sans">
                                                    <span className={`text-xs font-semibold ${isBelowThree ? "text-yellow-500 font-bold" : "text-white"}`}>
                                                      {categoryName}
                                                    </span>
                                                    {isBelowThree && (
                                                      <span className="text-[9px] bg-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse font-mono">
                                                        Alerta
                                                      </span>
                                                    )}
                                                  </div>

                                                  {criteriaList.length > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={() => setShowCategoryCriteria({
                                                        ...showCategoryCriteria,
                                                        [categoryName]: !showCriteria
                                                      })}
                                                      className="text-[10px] text-zinc-500 hover:text-white transition-colors bg-transparent border-0 cursor-pointer pl-2 outline-none font-sans"
                                                    >
                                                      {showCriteria ? "Recolher critérios ▴" : "Ver critérios ▾"}
                                                    </button>
                                                  )}
                                                </div>

                                                {showCriteria && criteriaList.length > 0 && (
                                                  <div className="mb-3.5 p-2.5 bg-zinc-950/50 rounded-lg border-l-2 border-[#D4AF37]/50 text-[10.5px] text-zinc-400 space-y-1 font-light leading-relaxed animate-fade-in select-none">
                                                    {criteriaList.map((crit, cIdx) => (
                                                      <p key={cIdx} className="flex items-start gap-1">
                                                        <span className="text-primary mt-0.5 shrink-0">•</span> {crit}
                                                      </p>
                                                    ))}
                                                  </div>
                                                )}

                                                {/* Grade options */}
                                                <div className="grid grid-cols-5 gap-1.5 bg-zinc-950/20 p-1.5 rounded-xl border border-white/[0.02] font-sans">
                                                  {[1, 2, 3, 4, 5].map((score) => {
                                                    const isSelected = currentScore === score;
                                                    let customCls = "border-transparent bg-zinc-900/30 text-zinc-400 hover:bg-zinc-900/60 hover:text-white";
                                                    
                                                    if (isSelected) {
                                                      if (score === 1) customCls = "bg-red-600 border-red-600 text-white font-bold scale-102";
                                                      else if (score === 2) customCls = "bg-amber-500 border-amber-500 text-black font-bold scale-102";
                                                      else if (score === 3) customCls = "bg-[#0284c7] border-[#0284c7] text-white font-bold scale-102";
                                                      else if (score === 4) customCls = "bg-primary border-primary text-black font-bold scale-102";
                                                      else customCls = "bg-green-600 border-green-600 text-white font-bold scale-102";
                                                    }

                                                    return (
                                                      <button
                                                        key={score}
                                                        type="button"
                                                        onClick={() => setCategoryScores({
                                                          ...categoryScores,
                                                          [categoryName]: score
                                                        })}
                                                        className={`py-2 px-1 rounded-lg text-xs font-semibold hover:border-white/10 tracking-wider transition-all cursor-pointer border ${customCls}`}
                                                      >
                                                        {score}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                      </div>

                                    </div>
                                  )}

                                  {attendanceStatus === "absent" && (
                                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl space-y-3 animate-fade-in font-sans">
                                      <span className="text-xs font-bold text-red-100 uppercase flex items-center gap-1.5 font-mono">
                                        <XCircle className="w-4 h-4" /> Justificativa de Falta Ativa
                                      </span>
                                      <p className="text-xs text-zinc-404 font-light">
                                        Por favor, registre obrigatoriamente a justificativa para a falta deste profissional no campo de Observações abaixo para salvar seu registro operacional com segurança.
                                      </p>
                                    </div>
                                  )}

                                  {attendanceStatus === "not_performed" && (
                                    <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-xl space-y-3 animate-fade-in font-sans">
                                      <span className="text-xs font-bold text-cyan-100 uppercase flex items-center gap-1.5 font-mono">
                                        <Info className="w-4 h-4" /> Dispensa Operacional / Função não Executada
                                      </span>
                                      <p className="text-xs text-zinc-400 font-light">
                                        O profissional não atuou ou esteve dispensado de realizar esta função específica na data de hoje (ex: sem clientes agendados ou escala em outra atividade). Não é necessário preencher as categorias acima.
                                      </p>
                                    </div>
                                  )}

                                  {/* Observations input block */}
                                  <div className="space-y-1.5 mt-6 font-sans">
                                    <Label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block font-mono">
                                      Observações / Justificativa {attendanceStatus === "absent" && <span className="text-red-400 font-bold">*</span>}
                                    </Label>
                                    <Input
                                      placeholder={
                                        attendanceStatus === "absent"
                                          ? "Preencha o motivo detalhado para justificar a falta..."
                                          : attendanceStatus === "not_performed"
                                            ? "Justificativa ou nota sobre a dispensa operacional..."
                                            : "Notas complementares do colaborador para acompanhamento..."
                                      }
                                      value={observations}
                                      onChange={(e) => setObservations(e.target.value)}
                                      className="bg-background border-white/5 rounded-xl text-xs placeholder:text-zinc-600 text-white focus:border-primary/50 text-white h-10 min-h-10"
                                    />
                                  </div>

                                </div>

                                {/* STICKY FOOTER IN THE MODAL */}
                                {(() => {
                                  const curIndex = evaluationTargets.findIndex(
                                    (t) => t.professionalId === evalProfessionalId && sanitizeFunctionSlug(t.evaluationFunction) === sanitizeFunctionSlug(evalFunction)
                                  );
                                  const hasNextPending = evaluationTargets.some((t, idx) => {
                                    if (idx === curIndex) return false;
                                    return !findRunForTarget(t, evaluationRuns);
                                  });
                                  const isAllCategoriesFilled = activeProfessionalEvaluationChecklist?.categories?.every(
                                    (c) => categoryScores[c] !== undefined
                                  );

                                  const canSave = isAllCategoriesFilled || attendanceStatus === "absent" || attendanceStatus === "not_performed";

                                  return (
                                    <div className="shrink-0 p-4 pb-6 bg-zinc-950 border-t border-[#D4AF37]/10 flex items-center justify-between gap-2 z-10 shadow-lg shadow-black/80 font-sans w-full">
                                      
                                      {/* Back or Clear Selection Button */}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setIncompleteValidationCategories([]);
                                          if (window.innerWidth < 768) {
                                            setMobileStep("list");
                                          } else {
                                            setEvalProfessionalId("");
                                            setEvalFunction("");
                                            setAttendanceStatus("");
                                            setCategoryScores({});
                                            setObservations("");
                                          }
                                        }}
                                        className="h-10 rounded-xl text-xs text-[#a1a1aa] hover:text-white px-2.5 flex items-center gap-1 shrink-0 cursor-pointer"
                                      >
                                        <ArrowLeft className="w-4 h-4 mr-0.5" />
                                        <span>Voltar</span>
                                      </Button>

                                      {/* Core Saving Actions */}
                                      <div className="flex gap-2 flex-1 justify-end">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={handleSaveOnly}
                                          className="h-10 rounded-xl font-bold text-xs px-3.5 border-white/10 text-zinc-300 bg-white/5 hover:bg-white/10 shrink-0 cursor-pointer"
                                        >
                                          Salvar rascunho
                                        </Button>

                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={handleSaveAndNext}
                                          className={`h-10 rounded-xl font-bold text-xs px-4 active:scale-98 transition-all shrink-0 cursor-pointer ${
                                            canSave
                                              ? "bg-primary text-black hover:bg-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                                              : "bg-[#D4AF37]/50 border border-[#D4AF37]/20 text-zinc-300 hover:bg-primary hover:text-black"
                                          }`}
                                        >
                                          {hasNextPending ? "Salvar e Próximo" : "Finalizar Tudo"}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none font-sans">
                                <Users className="w-12 h-12 text-zinc-700 mb-4 animate-pulse opacity-40" />
                                <h4 className="text-sm font-semibold text-zinc-400 font-heading">Nenhum profissional focado</h4>
                                <p className="text-xs text-zinc-500 mt-1 max-w-xs font-light tracking-wide leading-relaxed">
                                  Selecione qualquer colaborador ativo na lista da esquerda para carregar sua ficha de avaliação diária e notas.
                                </p>
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* B) Relatórios de Avaliação */}
        {canEvaluateTeam(userData?.role) && (
          <div className="border border-white/5 bg-zinc-950/60 rounded-2xl overflow-hidden shadow-xl hover:border-white/10 transition-all font-sans">
            {/* Header */}
            <div 
              onClick={toggleReports}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/40 transition-all select-none border-b border-white/5"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white font-heading tracking-tight">
                    Relatórios de Avaliação
                  </h3>
                  <p className="text-xs text-zinc-450 font-light mt-0.5">
                    Consulte notas, classificações e observações históricas da equipe.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 self-end sm:self-auto shrink-0">
                <div className="text-right hidden md:block">
                  <span className="text-[11px] text-zinc-400 font-light block">Data de Consulta</span>
                  <span className="text-xs font-semibold text-white">
                    {reportRuns.length > 0 ? `${reportRuns.length} avaliações prontas` : "Busque relatórios por data"}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 shrink-0 cursor-pointer">
                  {isReportsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Content body */}
            {isReportsExpanded && (
              <div className="p-6 space-y-6 animate-fade-in font-sans">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 space-y-1.5 w-full">
                    <Label className="text-xs text-zinc-404 font-medium">Selecionar Data do Relatório</Label>
                    <Input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="h-10 bg-background/50 border-white/5 rounded-xl text-sm text-white focus:border-primary/40 block w-full text-white"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto shrink-0">
                    <Button 
                      onClick={fetchReport} 
                      disabled={loadingReport}
                      className="flex-1 sm:flex-initial h-10 bg-primary hover:bg-gold-500 text-black font-semibold text-xs px-5 rounded-xl cursor-pointer"
                    >
                      {loadingReport ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Search className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Buscar relatório
                    </Button>
                    <Button
                      onClick={generatePDF}
                      disabled={reportRuns.length === 0}
                      variant="outline"
                      className="flex-1 sm:flex-initial h-10 border-white/10 text-xs px-5 rounded-xl text-primary border-primary/20 hover:bg-primary/5 disabled:opacity-40 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Baixar PDF
                    </Button>
                  </div>
                </div>

                {loadingReport ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : reportRuns.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl bg-zinc-950/20">
                    <CalendarDays className="w-10 h-10 text-zinc-650 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-light text-zinc-400 font-sans">
                      Nenhuma avaliação encontrada para esta data.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/5 bg-zinc-950/40">
                    <table className="w-full border-collapse text-left text-xs text-zinc-400 min-w-[700px]">
                      <thead className="bg-zinc-900/60 font-sans uppercase font-bold tracking-wider text-zinc-400 text-[10px] border-b border-white/5">
                        <tr>
                          <th className="p-4">Profissional</th>
                          <th className="p-4">Função</th>
                          <th className="p-4">Status de Presença</th>
                          <th className="p-4 text-center">Pontos</th>
                          <th className="p-4">Classificação</th>
                          <th className="p-4">Justificativa / Comentários</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-sans">
                        {professionals.map((p) => {
                          const run = reportRuns.find((r) => r.evaluatedProfessionalId === p.id);
                          return (
                            <tr key={p.id} className="hover:bg-zinc-900/20 transition-all font-light">
                              <td className="p-4 font-semibold text-white">{p.name}</td>
                              <td className="p-4">{getDisplayFunction(p)}</td>
                              <td className="p-4">
                                {run ? (
                                  run.attendanceStatus === "absent" ? (
                                    <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-red-500/10 font-mono">
                                      Falta
                                    </span>
                                  ) : (
                                    <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-green-500/10 font-mono">
                                      Avaliado
                                    </span>
                                  )
                                ) : (
                                  <span className="text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-yellow-500/10 font-mono">
                                    Pendente
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-center font-mono font-bold text-white">
                                {run?.totalScore !== undefined ? `${run.totalScore}/40` : "-"}
                              </td>
                              <td className="p-4 font-semibold text-primary">{run?.classification || "-"}</td>
                              <td className="p-4 max-w-xs truncate" title={run?.observations || run?.absenceReason || ""}>
                                {run?.observations || run?.absenceReason || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* C) Checklist Operacional */}
        <div className="border border-white/5 bg-zinc-950/60 rounded-2xl overflow-hidden shadow-xl hover:border-white/10 transition-all font-sans">
          {/* Header */}
          <div 
            onClick={toggleOperational}
            className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/40 transition-all select-none border-b border-white/5"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <ListTodo className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white font-heading tracking-tight flex items-center gap-1.5">
                  Checklist Operacional
                </h3>
                <p className="text-xs text-zinc-450 font-light mt-0.5">
                  Garanta a conformidade de processos essenciais como abertura, limpeza e fechamento do salão.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 self-end sm:self-auto shrink-0">
              <div className="text-right hidden md:block">
                <span className="text-[11px] text-zinc-400 font-light block">Rotinas Operativas</span>
                <span className="text-xs font-semibold text-white">
                  {activeOperationalChecklists.length} rotinas ativas
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 shrink-0 cursor-pointer">
                {isOperationalExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Expanded Content */}
          {isOperationalExpanded && (
            <div className="p-6 space-y-6 animate-fade-in font-sans">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-4">
                <div>
                  <h4 className="text-sm font-semibold text-white">Rotinas Cadastradas de Hoje</h4>
                  <p className="text-xs text-zinc-500 font-light">Assegure que os padrões físicos e operacionais estejam ok.</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsManageDialogOpen(true)}
                    className="h-9 rounded-xl border-white/10 text-xs px-3.5 bg-white/5 text-primary hover:bg-white/10 hover:border-primary/50 transition-all font-semibold cursor-pointer"
                  >
                    Gerenciar Rotinas
                  </Button>
                  {activeOperationalChecklists.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateOperationalPDF}
                      className="h-9 rounded-xl border-white/10 text-xs px-3.5 hover:bg-white/5 cursor-pointer"
                    >
                      Exportar Rotinas Hoje (PDF)
                    </Button>
                  )}
                </div>
              </div>

              {activeOperationalChecklists.length === 0 ? (
                <div className="py-12 text-center max-w-xl mx-auto space-y-4">
                  <LayoutTemplate className="w-10 h-10 text-zinc-700 mx-auto mb-3 opacity-30" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Nenhum checklist operacional configurado</h4>
                    <p className="text-xs text-zinc-500 font-light mt-1 w-full text-center">Configure ou importe modelos recomendados abrindo o menu de gerenciamento de rotinas.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsManageDialogOpen(true)}
                    className="bg-primary hover:bg-gold-500 text-black font-semibold text-xs rounded-xl cursor-pointer"
                  >
                    Configurar primeira rotina
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {activeOperationalChecklists.map((chk) => {
                    const run = operationalRuns.find((r) => r.checklistId === chk.id);
                    const completedCount = run?.completedItems?.length || 0;
                    const totalItems = chk.items?.length || 0;
                    const pct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
                    const isFinished = pct === 100;

                    return (
                      <div 
                        key={chk.id} 
                        className="border border-white/5 bg-zinc-900/20 rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:border-white/10"
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <h4 className="text-sm font-semibold text-white">{chk.title}</h4>
                            {chk.description && (
                              <p className="text-[11px] text-zinc-500 font-light mt-0.5">{chk.description}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeactivateChecklist(chk.id)}
                            className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-zinc-400 font-light">Progresso da Atividade</span>
                            <span className="font-semibold text-white">{completedCount} de {totalItems} concluídos ({pct}%)</span>
                          </div>
                          <Progress value={pct} className="h-1.5 bg-white/5" />

                          {isFinished && (
                            <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between gap-2 text-[10px] text-green-400 font-medium animate-fade-in font-sans">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-green-400 animate-pulse animate-spin" /> Rotina totalmente finalizada!
                              </span>
                              <span className="bg-green-500/20 text-green-300 font-mono font-bold px-1.5 py-0.5 rounded text-[9px]">100% Ok</span>
                            </div>
                          )}

                          <div className="space-y-1.5 pt-2 max-h-[180px] overflow-y-auto pr-1">
                            {chk.items.map((item) => {
                              const isCompleted = run?.completedItems?.includes(item.id) || false;
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => toggleOperationalItem(chk, item.id)}
                                  className={`flex items-center gap-2.5 p-2 rounded-lg transition-all duration-200 cursor-pointer text-xs select-none ${
                                    isCompleted
                                      ? "bg-white/5 text-zinc-500"
                                      : "hover:bg-white/[0.03] text-zinc-300 pointer-events-auto"
                                  }`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 select-none" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border border-white/20 hover:border-primary shrink-0 transition-colors bg-background" />
                                  )}
                                  <span className={`font-light select-none ${isCompleted ? "line-through opacity-60" : ""}`}>
                                    {item.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* MODAL CONFIGURACAO ROTINAS OPERACIONAIS */}
      <ManageRotinasDialog
        open={isManageDialogOpen}
        onOpenChange={setIsManageDialogOpen}
        allChecklists={allChecklists}
        salonId={salonData?.id || ""}
      />

      {/* Diálogo Como Usar Checklist */}
      <Dialog open={isHowToUseOpen} onOpenChange={setIsHowToUseOpen}>
        <DialogContent className="max-w-2xl bg-[#0a0a0c]/98 border border-white/10 text-white rounded-2xl shadow-2xl backdrop-blur-xl w-[94vw] sm:w-[90vw] p-0 text-white font-sans">
          <DialogHeader className="border-b border-white/5 p-6 pb-4">
            <DialogTitle className="text-lg md:text-xl font-heading font-light tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Como usar a Avaliação Diária
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4 text-xs md:text-sm leading-relaxed text-[#a1a1aa] overflow-y-auto max-h-[60vh] pr-2">
            <div className="space-y-2">
              <p className="font-semibold text-white">Objetivo Principal:</p>
              <p className="text-[#a1a1aa] font-light text-xs md:text-sm">
                A Avaliação Diária serve para medir a postura, qualidade, organização, atendimento e o desempenho comercial geral de toda a equipe sob os rigorosos padrões premium LumiereOS.
              </p>
            </div>

            <div className="border-t border-white/5 my-3 pt-3 space-y-2 text-xs md:text-sm">
              <p className="font-semibold text-white">Regras de Operação:</p>
              <ul className="list-disc pl-5 space-y-2 font-light text-[#a1a1aa]">
                <li>
                  <strong className="text-white">Avaliação Individual:</strong> Cada profissional ativo do estabelecimento deve ser avaliado <span className="text-primary font-medium">uma vez por dia</span>.
                </li>
                <li>
                  <strong className="text-white">Faltas e Ausências:</strong> Se o profissional faltou no dia, utilize a option <span className="text-red-400 font-medium">"Registrar Falta"</span> para justificar a ausência.
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
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Dica de Produtividade
              </p>
              <p className="text-[11px] text-[#a1a1aa] font-light leading-relaxed">
                Utilize o botão <strong className="text-white">"Salvar e avaliar próximo"</strong> para acelerar a rotina diária ao avaliar vários membros da equipe consecutivamente de forma fluida e veloz.
              </p>
            </div>
          </div>
          <div className="flex justify-end p-6 border-t border-white/5 shrink-0">
            <Button onClick={() => setIsHowToUseOpen(false)} className="bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl text-xs px-5 h-9.5 cursor-pointer">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Goal, Professional, Service, Appointment, ProfessionalGoal } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Target,
  TrendingUp,
  Edit2,
  Users,
  Award,
  DollarSign,
  TrendingDown,
  User,
  Calendar,
  Clock,
  Trash2,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  CheckSquare,
  Briefcase,
  Layers,
  CheckCircle2,
  Info,
  ChevronRight,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// Helper function to calculate real-time goal progress
export function calculateGoalProgress(
  goal: Goal,
  appointments: Appointment[],
  services: Service[],
  professionals: Professional[],
  checklistRuns: any[]
): number {
  if (goal.status === "completed") {
    return goal.targetValue || goal.targetAmount || 0;
  }

  // 1. Determine date range
  const start = goal.startDate || (goal.month ? `${goal.month}-01` : "");
  // Simple end-of-month fallback
  const end = goal.endDate || (goal.month ? `${goal.month}-31` : "");

  const isInRange = (dateStr: string) => {
    if (!dateStr) return false;
    if (goal.month && dateStr.substring(0, 7) === goal.month) return true;
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
  };

  // 2. Filter matching professionals if targetFunction is defined (role-based)
  const matchedProfIds = new Set<string>();
  if (goal.targetFunction) {
    professionals.forEach((p) => {
      if (p.role?.toLowerCase() === goal.targetFunction?.toLowerCase()) {
        matchedProfIds.add(p.id);
      }
    });
  }

  // 3. Filter Appointments (only completed status counts for metrics)
  const filteredApps = appointments.filter((app) => {
    if (app.status !== "completed") return false;
    if (!isInRange(app.date)) return false;

    // Filter by professional scope
    if (goal.goalScope === "professional") {
      if (goal.professionalId && app.professionalId !== goal.professionalId) return false;
    }

    // Filter by team role
    if (goal.goalScope === "team" && goal.targetFunction) {
      if (!matchedProfIds.has(app.professionalId)) return false;
    }

    return true;
  });

  // 4. Filter Checklist evaluation runs
  const filteredRuns = checklistRuns.filter((run) => {
    const runDate = run.date || run.evaluationDate || "";
    if (!isInRange(runDate)) return false;

    if (goal.goalScope === "professional" && goal.professionalId) {
      if (run.evaluatedProfessionalId !== goal.professionalId) return false;
    }

    if (goal.goalScope === "team" && goal.targetFunction) {
      if (run.evaluatedProfessionalId && !matchedProfIds.has(run.evaluatedProfessionalId)) return false;
    }

    return true;
  });

  // 5. Calculate metric based on type
  const targetType = goal.targetType || "revenue";

  switch (targetType) {
    case "revenue":
      return filteredApps.reduce((sum, app) => {
        const srv = services.find((s) => s.id === app.serviceId);
        return sum + (srv ? srv.price : 0);
      }, 0);

    case "appointments":
      return filteredApps.length;

    case "services":
      return filteredApps.length;

    case "products":
      // Fallback to manual value tracker for products
      return goal.currentValue || 0;

    case "checklist":
      if (filteredRuns.length === 0) return 0;
      const totalPct = filteredRuns.reduce(
        (sum, r) => sum + (r.percentage || r.completionPercentage || 0),
        0
      );
      return Math.round(totalPct / filteredRuns.length);

    case "custom":
    default:
      return goal.currentValue || 0;
  }
}

export default function GoalsPage() {
  const { salonData, userData, isPlatformAdmin } = useAuth();

  // Role permissions helpers
  const isOwnerOrManager =
    userData?.role === "owner" ||
    userData?.role === "manager" ||
    userData?.role === "admin" ||
    isPlatformAdmin;

  const isProf = userData?.role === "professional";

  // Navigation state / Tabs
  const [activeTab, setActiveTab] = useState<
    "overview" | "monthly" | "weekly" | "daily" | "professionals"
  >("overview");

  // Selected date references for dynamic scoping
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [selectedDateFilter, setSelectedDateFilter] = useState(
    new Date().toISOString().substring(0, 10)
  );

  // States fetched from Firestore
  const [goals, setGoals] = useState<Goal[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog & goal configuration state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    goalScope: "global" as "global" | "professional" | "team",
    periodType: "monthly" as "daily" | "weekly" | "monthly",
    targetType: "revenue" as "revenue" | "appointments" | "services" | "products" | "checklist" | "custom",
    targetValue: "",
    currentValue: "0",
    professionalId: "",
    targetFunction: "",
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date().toISOString().substring(0, 10),
    trackingMode: "auto" as "auto" | "manual",
    monthRef: new Date().toISOString().substring(0, 7), // YYYY-MM helper
  });

  // Feed active lists in snapshot
  useEffect(() => {
    if (!salonData) return;

    const unsubs: (() => void)[] = [];

    // 1. Fetch ALL Goals (backward-compatible and advanced)
    const qg = query(collection(db, `salons/${salonData.id}/goals`));
    unsubs.push(
      onSnapshot(qg, (snapshot) => {
        const arr: Goal[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Goal));
        setGoals(arr.sort((a, b) => b.createdAt - a.createdAt));
      })
    );

    // 2. Active Professionals
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(
      onSnapshot(qp, (snapshot) => {
        const arr: Professional[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Professional));
        setProfessionals(arr.filter((p) => p.isActive));
      })
    );

    // 3. Services
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    unsubs.push(
      onSnapshot(qs, (snapshot) => {
        const arr: Service[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Service));
        setServices(arr);
      })
    );

    // 4. Appointments
    const qa = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(
      onSnapshot(qa, (snapshot) => {
        const arr: Appointment[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Appointment));
        setAppointments(arr);
      })
    );

    // 5. Checklist Runs
    const qcr = query(collection(db, `salons/${salonData.id}/checklistRuns`));
    unsubs.push(
      onSnapshot(qcr, (snapshot) => {
        const arr: any[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
        setChecklistRuns(arr);
        setLoading(false);
      }, (err) => {
        console.error("Erro ao carregar checklist runs:", err);
        setLoading(false);
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [salonData]);

  // Handle Form changes to align targets beautifully
  useEffect(() => {
    // Automatically set default periods to simplify UX
    if (formData.periodType === "daily") {
      setFormData((prev) => ({
        ...prev,
        startDate: selectedDateFilter,
        endDate: selectedDateFilter,
      }));
    } else if (formData.periodType === "monthly") {
      const year = formData.monthRef.substring(0, 4);
      const month = formData.monthRef.substring(5, 7);
      setFormData((prev) => ({
        ...prev,
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-31`,
      }));
    } else if (formData.periodType === "weekly") {
      // Set to current week (Monday to Sunday)
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now.setDate(now.getDate() + distanceToMon));
      const sunday = new Date(now.setDate(monday.getDate() + 6));
      
      setFormData((prev) => ({
        ...prev,
        startDate: monday.toISOString().substring(0, 10),
        endDate: sunday.toISOString().substring(0, 10),
      }));
    }
  }, [formData.periodType, formData.monthRef, selectedDateFilter]);

  // Master List representation of roles inside professionals
  const uniqueProfessionalRoles = Array.from(
    new Set(professionals.map((p) => p.role).filter(Boolean))
  );

  // Dynamic progress fetcher
  const getGoalLiveValue = (g: Goal) => {
    if (g.trackingMode === "manual" || g.targetType === "products" || g.targetType === "custom") {
      return g.currentValue ?? g.currentAmount ?? 0;
    }
    return calculateGoalProgress(g, appointments, services, professionals, checklistRuns);
  };

  const getGoalProgressPct = (g: Goal) => {
    const target = g.targetValue || g.targetAmount || 1;
    const current = getGoalLiveValue(g);
    return Math.min(Math.round((current / target) * 100), 100);
  };

  // Create or update Advanced goals
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const targetVal = parseFloat(formData.targetValue.replace(",", "."));
      const currentVal = parseFloat(formData.currentValue.replace(",", "."));

      if (isNaN(targetVal) || targetVal <= 0) {
        toast.error("Insira um valor alvo válido maior que zero.");
        return;
      }

      // Automatically construct descriptive title if empty
      let titleConstructed = formData.title.trim();
      const scopeLabel =
        formData.goalScope === "global"
          ? "Global"
          : formData.goalScope === "professional"
          ? `Esp. ${professionals.find((p) => p.id === formData.professionalId)?.name || ""}`
          : `Cargo: ${formData.targetFunction}`;

      const typeLabel =
        formData.targetType === "revenue"
          ? "Faturamento"
          : formData.targetType === "appointments"
          ? "Atendimentos"
          : formData.targetType === "services"
          ? "Serviços"
          : formData.targetType === "products"
          ? "Produtos"
          : formData.targetType === "checklist"
          ? "Auditoria/Checklist"
          : "Meta Extra";

      const frequencyName =
        formData.periodType === "daily"
          ? "Diária"
          : formData.periodType === "weekly"
          ? "Semanal"
          : "Mensal";

      if (!titleConstructed) {
        titleConstructed = `Meta ${frequencyName} de ${typeLabel} - ${scopeLabel}`;
      }

      const payload: any = {
        title: titleConstructed,
        goalScope: formData.goalScope,
        periodType: formData.periodType,
        targetType: formData.targetType,
        targetValue: targetVal,
        currentValue: formData.trackingMode === "manual" ? currentVal : 0,
        // For backwards compatibility
        targetAmount: targetVal,
        currentAmount: formData.trackingMode === "manual" ? currentVal : 0,
        month: formData.startDate.substring(0, 7), // helper compatibility month

        trackingMode: formData.trackingMode,
        startDate: formData.startDate,
        endDate: formData.endDate,
        updatedAt: Date.now(),
        status: "active",
      };

      if (formData.goalScope === "professional") {
        if (!formData.professionalId) {
          toast.error("Por favor, selecione o profissional.");
          return;
        }
        const p = professionals.find((item) => item.id === formData.professionalId);
        payload.professionalId = formData.professionalId;
        payload.professionalName = p?.name || "";
      } else if (formData.goalScope === "team") {
        if (!formData.targetFunction) {
          toast.error("Por favor, selecione ou insira um cargo.");
          return;
        }
        payload.targetFunction = formData.targetFunction;
      }

      if (editingGoal) {
        const ref = doc(db, `salons/${salonData.id}/goals`, editingGoal.id);
        await updateDoc(ref, payload);
        toast.success("Meta atualizada com sucesso!");
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/goals`));
        await setDoc(ref, {
          id: ref.id,
          ...payload,
          createdAt: Date.now(),
        });
        toast.success("Nova meta criada com sucesso!");
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar meta.");
    }
  };

  const resetForm = () => {
    setEditingGoal(null);
    setFormData({
      title: "",
      goalScope: "global",
      periodType: "monthly",
      targetType: "revenue",
      targetValue: "",
      currentValue: "0",
      professionalId: "",
      targetFunction: "",
      startDate: new Date().toISOString().substring(0, 10),
      endDate: new Date().toISOString().substring(0, 10),
      trackingMode: "auto",
      monthRef: new Date().toISOString().substring(0, 7),
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (g: Goal) => {
    setEditingGoal(g);
    setFormData({
      title: g.title || "",
      goalScope: g.goalScope || "global",
      periodType: g.periodType || "monthly",
      targetType: g.targetType || "revenue",
      targetValue: (g.targetValue || g.targetAmount || 0).toString(),
      currentValue: (g.currentValue || g.currentAmount || 0).toString(),
      professionalId: g.professionalId || "",
      targetFunction: g.targetFunction || "",
      startDate: g.startDate || `${g.month}-01`,
      endDate: g.endDate || `${g.month}-31`,
      trackingMode: g.trackingMode || "auto",
      monthRef: g.month || new Date().toISOString().substring(0, 7),
    });
    setIsDialogOpen(true);
  };

  const handleDeleteGoal = async (id: string) => {
    if (!salonData) return;
    if (!window.confirm("Deseja realmente excluir permanentemente esta meta?")) return;
    try {
      await deleteDoc(doc(db, `salons/${salonData.id}/goals`, id));
      toast.success("Meta excluída com sucesso.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir meta.");
    }
  };

  // Calculate dynamic stats for current month
  const currentMonthFilter = selectedMonth; // ex: 2026-06

  const activeGoalsThisMonth = goals.filter((g) => {
    const m = g.month || g.startDate?.substring(0, 7);
    return m === currentMonthFilter;
  });

  // KPI Calculations
  const totalMonthlyTargetsObj = activeGoalsThisMonth
    .filter((g) => (g.targetType || "revenue") === "revenue" && g.goalScope === "global")
    .reduce((sum, g) => sum + (g.targetValue || g.targetAmount || 0), 0);

  // Fallback to average or fallback sum if no global goal defined
  const totalFinancialGoal = totalMonthlyTargetsObj > 0 ? totalMonthlyTargetsObj : 15000;

  // Realized revenue this month
  const totalCompletedMonthRevenue = appointments
    .filter(
      (app) => app.status === "completed" && app.date.substring(0, 7) === currentMonthFilter
    )
    .reduce((total, app) => {
      const srv = services.find((s) => s.id === app.serviceId);
      return total + (srv ? srv.price : 0);
    }, 0);

  const monthProgressPct = Math.min(
    Math.round((totalCompletedMonthRevenue / totalFinancialGoal) * 100),
    100
  );
  const remainingBRL = Math.max(totalFinancialGoal - totalCompletedMonthRevenue, 0);

  // Best Professional this month
  const getProfRevenue = (pId: string) => {
    return appointments
      .filter(
        (app) =>
          app.status === "completed" &&
          app.professionalId === pId &&
          app.date.substring(0, 7) === currentMonthFilter
      )
      .reduce((t, app) => {
        const s = services.find((srv) => srv.id === app.serviceId);
        return t + (s ? s.price : 0);
      }, 0);
  };

  const sortedProfsWithRevenue = [...professionals]
    .map((p) => ({ p, rev: getProfRevenue(p.id) }))
    .sort((a, b) => b.rev - a.rev);

  const bestProfessional = sortedProfsWithRevenue[0]?.rev > 0 ? sortedProfsWithRevenue[0] : null;

  // Filter goals depending on selected view/tab
  const listGoalsByTab = () => {
    // If professional logged in, only show their own goals
    let filtered = goals;
    if (isProf) {
      filtered = goals.filter((g) => g.professionalId === userData?.id || g.goalScope === "global");
    }

    switch (activeTab) {
      case "monthly":
        return filtered.filter((g) => g.periodType === "monthly" || !g.periodType);
      case "weekly":
        return filtered.filter((g) => g.periodType === "weekly");
      case "daily":
        return filtered.filter((g) => g.periodType === "daily");
      case "professionals":
        return filtered.filter((g) => g.goalScope === "professional");
      case "overview":
      default:
        return filtered;
    }
  };

  const getMetricSymbol = (type: string) => {
    switch (type) {
      case "revenue":
        return "R$";
      case "appointments":
        return "Atendimentos";
      case "services":
        return "Serviços";
      case "products":
        return "Itens";
      case "checklist":
        return "%";
      case "custom":
      default:
        return "Meta";
    }
  };

  const renderMetricBadgeType = (type: string) => {
    switch (type) {
      case "revenue":
        return <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Faturamento</span>;
      case "appointments":
        return <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Agendamentos</span>;
      case "services":
        return <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Serviços</span>;
      case "products":
        return <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Venda Produtos</span>;
      case "checklist":
        return <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Auditoria</span>;
      case "custom":
      default:
        return <span className="text-[10px] bg-zinc-500/10 text-zinc-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Personalizado</span>;
    }
  };

  const formatTargetValue = (g: Goal) => {
    const val = g.targetValue || g.targetAmount || 0;
    if (g.targetType === "revenue") {
      return formatBRL(val);
    }
    if (g.targetType === "checklist") {
      return `${val}% de Conformidade`;
    }
    return `${val} ${getMetricSymbol(g.targetType || "revenue")}`;
  };

  const formatCurrentValue = (g: Goal) => {
    const val = getGoalLiveValue(g);
    if (g.targetType === "revenue") {
      return formatBRL(val);
    }
    if (g.targetType === "checklist") {
      return `${val}%`;
    }
    return `${val}`;
  };

  // Find out professionals who are below their monthly targets
  const professionalsBelowTarget = sortedProfsWithRevenue.filter(({ p, rev }) => {
    // find a goal for that professional this month
    const profGoal = goals.find(
      (g) => g.professionalId === p.id && g.periodType === "monthly" && (g.month || g.startDate?.substring(0, 7)) === currentMonthFilter
    );
    if (!profGoal) return false;
    const target = profGoal.targetValue || profGoal.targetAmount || 0;
    return rev < target;
  });

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* Banner & Title with commercial highlights */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 flex-wrap pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-heading font-light tracking-tight text-white leading-tight">
              Metas de Performance da Equipe
            </h2>
            <span className="bg-primary/15 text-primary border border-primary/20 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
              v1.4.6
            </span>
          </div>
          <p className="text-zinc-400 text-xs mt-1 max-w-2xl font-light">
            Monitore objetivos financeiros e de produtividade no salão. Defina metas gerais, diárias, semanais por especialista ou categoria, impulsionando a eficiência integrada do estabelecimento.
          </p>
        </div>

        {/* Action Button for Managers / Owners */}
        {isOwnerOrManager && (
          <Button
            onClick={openCreateDialog}
            className="bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl text-xs h-9.5 px-4.5 flex items-center gap-1.5 transition-all w-full sm:w-auto shrink-0 shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4 text-black" /> Criar Nova Meta
          </Button>
        )}
      </div>

      {isProf && (
        <div className="bg-[#121214] border border-[#D4AF37]/20 p-4 rounded-xl flex items-center gap-3 text-xs text-[#D4AF37] font-light">
          <Info className="w-5 h-5 text-[#D4AF37] shrink-0" />
          <span>
            <strong>Visualização Restrita ao Colaborador:</strong> Você pode acompanhar suas próprias metas diárias, semanais e mensais atribuídas pelo gestor, além do painel global do salão. Alterações e edições estão protegidas administrativamente.
          </span>
        </div>
      )}

      {/* PARTE 6 — KPI Cards at the top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Monthly Goal */}
        <Card className="border border-white/5 bg-[#121214]/40 rounded-2xl p-4.5 space-y-2">
          <p className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">
            Meta Faturamento Mês
          </p>
          <div className="flex items-baseline justify-between">
            <p className="text-xl font-light text-white select-all">
              {formatBRL(totalFinancialGoal)}
            </p>
            <span className="text-[10px] bg-white/5 text-zinc-400 border border-white/10 px-1.5 py-0.5 rounded font-mono">
              {currentMonthFilter}
            </span>
          </div>
          <div className="text-[10px] text-zinc-400 font-light">
            Alvo de faturamento principal do salão
          </div>
        </Card>

        {/* KPI 2: Current Realized */}
        <Card className="border border-white/5 bg-[#121214]/40 rounded-2xl p-4.5 space-y-2">
          <p className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">
            Faturamento Realizado
          </p>
          <div className="flex items-baseline justify-between">
            <p className="text-xl font-medium text-emerald-400 select-all">
              {formatBRL(totalCompletedMonthRevenue)}
            </p>
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> {monthProgressPct}%
            </span>
          </div>
          <Progress value={monthProgressPct} className="h-1 bg-white/15 rounded-full" />
        </Card>

        {/* KPI 3: Remaining BRL */}
        <Card className="border border-white/5 bg-[#121214]/40 rounded-2xl p-4.5 space-y-2">
          <p className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">
            Falta para Bater
          </p>
          <div className="flex items-baseline justify-between">
            <p className="text-xl font-light text-zinc-200 select-all">
              {remainingBRL > 0 ? formatBRL(remainingBRL) : "Metas Batidas!"}
            </p>
            {remainingBRL === 0 && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold font-mono">
                100% OK
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-400 font-light">
            {remainingBRL > 0 ? "Faturamento restante acordado" : "Parabéns, saldo atingido!"}
          </p>
        </Card>

        {/* KPI 4: Best Professional */}
        <Card className="border border-[#D4AF37]/15 bg-[#121214]/40 rounded-2xl p-4.5 space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-1 bg-primary/10 rounded-bl-xl border-l border-b border-[#D4AF37]/20">
            <Award className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">
            Destaque do Mês
          </p>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white truncate">
              {bestProfessional ? bestProfessional.p.name : "Nenhum no momento"}
            </p>
            <p className="text-xs text-primary font-bold font-mono">
              {bestProfessional ? formatBRL(bestProfessional.rev) : "R$ 0,00"}
            </p>
          </div>
          <p className="text-[10px] text-zinc-400 font-light truncate">
            {bestProfessional ? `Função: ${bestProfessional.p.role || "Especialista"}` : "Sem faturamento registrado"}
          </p>
        </Card>
      </div>

      {/* FILTER & TAB BAR SELECTOR */}
      <div className="bg-[#121214]/60 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Responsive tabs */}
        <div className="flex flex-wrap p-1 bg-white/[0.02] border border-white/5 rounded-xl gap-0.5 min-w-0">
          {[
            { id: "overview", label: "Visão Geral" },
            { id: "monthly", label: "Metas Mensais" },
            { id: "weekly", label: "Metas Semanais" },
            { id: "daily", label: "Metas Diárias" },
            { id: "professionals", label: "Por Profissional" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-primary text-black font-bold shadow-md"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Interactive Filter Scopes */}
        <div className="flex items-center gap-3.5 shrink-0 ml-auto md:ml-0">
          <div className="flex items-center gap-2 text-xs font-light text-zinc-400">
            <span>Período Ref:</span>
            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 border border-white/10 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs text-white border-none focus:outline-none cursor-pointer outline-none w-[100px] font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* GOALS PERFORMANCE & ACTION LIST */}
      <div>
        {listGoalsByTab().length === 0 ? (
          <Card className="border border-white/5 bg-[#121214]/25 rounded-2xl py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-white">Nenhuma meta ativa encontrada</h3>
            <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto font-light">
              Não existem metas registradas ou programadas para o filtro selecionado. Use o painel para cadastrar novos alvos de crescimento.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listGoalsByTab().map((g) => {
              const liveValue = getGoalLiveValue(g);
              const progressPct = getGoalProgressPct(g);
              const isOver = progressPct >= 100;
              const targetVal = g.targetValue || g.targetAmount || 1;
              const remainingVal = Math.max(targetVal - liveValue, 0);

              // Date translation descriptions
              const startFormatted = g.startDate
                ? new Date(g.startDate + "T12:00:00").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                : "";

              const endFormatted = g.endDate
                ? new Date(g.endDate + "T12:00:00").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                : "";

              return (
                <Card
                  key={g.id}
                  className="bg-[#121214]/50 border border-white/5 rounded-2xl hover:border-[#D4AF37]/30 transition-all duration-300 p-5 flex flex-col justify-between gap-4.5 overflow-hidden relative group"
                >
                  {/* Subtle color highlight depending on target type */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${
                      isOver ? "bg-emerald-500" : "bg-[#D4AF37]/35"
                    }`}
                  />

                  {/* Header info */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderMetricBadgeType(g.targetType || "revenue")}
                          {g.periodType && (
                            <span className="text-[9px] font-mono uppercase bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-bold">
                              {g.periodType === "daily"
                                ? "Diária"
                                : g.periodType === "weekly"
                                ? "Semanal"
                                : "Mensal"}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-xs text-white pt-1 line-clamp-1 leading-snug">
                          {g.title || "Meta Geral de Fluxo"}
                        </h4>
                      </div>

                      {/* Edit controls if Manager */}
                      {isOwnerOrManager && (
                        <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(g)}
                            className="h-7 w-7 text-zinc-400 hover:text-primary rounded-lg hover:bg-white/5 cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteGoal(g.id)}
                            className="h-7 w-7 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-white/5 cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Scope specificity labels */}
                    {g.goalScope === "professional" && (
                      <div className="flex items-center gap-1 text-[10px] text-[#D4AF37] font-mono leading-tight">
                        <User className="w-3 h-3 text-[#D4AF37]" />
                        <span>Esp. Vinculado: {g.professionalName || "Profissional"}</span>
                      </div>
                    )}

                    {g.goalScope === "team" && g.targetFunction && (
                      <div className="flex items-center gap-1 text-[10px] text-blue-400 font-mono leading-tight">
                        <Briefcase className="w-3 h-3 text-blue-400" />
                        <span>Cargo Coletivo: {g.targetFunction}</span>
                      </div>
                    )}
                  </div>

                  {/* Mid Values Tracking */}
                  <div className="grid grid-cols-2 gap-2 bg-black/20 p-2.5 rounded-xl border border-white/5">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono">
                        Realizado
                      </span>
                      <p className="text-sm font-semibold text-white truncate">
                        {formatCurrentValue(g)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono">
                        Alvo Estimado
                      </span>
                      <p className="text-sm font-bold text-[#D4AF37] truncate">
                        {formatTargetValue(g)}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Progress details */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-[10px] leading-tight">
                      <span className={`font-mono font-bold ${isOver ? "text-emerald-400" : "text-primary"}`}>
                        {progressPct}% COMPLETO
                      </span>

                      {remainingVal > 0 ? (
                        <span className="text-zinc-500 font-light truncate">
                          Falta {g.targetType === "revenue" ? formatBRL(remainingVal) : `${Math.round(remainingVal)} un.`}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5 text-[9px] uppercase font-mono tracking-wider animate-pulse">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Bateu a meta
                        </span>
                      )}
                    </div>
                    <Progress value={progressPct} className={`h-1.5 ${isOver ? "bg-emerald-500/10" : "bg-white/5"}`} />

                    {/* Date limits */}
                    {(startFormatted || endFormatted) && (
                      <div className="flex justify-between text-[9px] text-zinc-500 font-mono font-light pt-0.5">
                        <span>Início: {startFormatted || "-"}</span>
                        <span>Fim: {endFormatted || "-"}</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* SPECIAL INTERACTIVE TAB SECTION FOR COLLABORATOR LISTS */}
      {activeTab === "overview" && isOwnerOrManager && (
        <Card className="border border-white/5 bg-[#121214]/25 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-heading font-semibold text-white">Análise Regional de Ativos de Profissionais</h3>
          </div>
          <p className="text-zinc-400 text-xs font-light leading-snug">
            Abaixo estão os profissionais ativos e seus respectivos saldos de faturamento e auditoria gerados neste mês. Aproveite para planejar incentivos por performance.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-400 p-0 border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase font-mono tracking-wider text-zinc-500 h-9">
                  <th className="pb-2">Colaborador</th>
                  <th className="pb-2">Vínculo / Cargo</th>
                  <th className="pb-2">Faturado no Mês</th>
                  <th className="pb-2">Auditorias Realizadas</th>
                  <th className="pb-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {professionals.map((p) => {
                  const revenue = getProfRevenue(p.id);
                  // count checklistRuns for professional
                  const runsCount = checklistRuns.filter(
                    (r) => r.evaluatedProfessionalId === p.id && (r.date || r.evaluationDate || "").substring(0, 7) === currentMonthFilter
                  ).length;

                  return (
                    <tr key={p.id} className="hover:bg-white/[0.01] transition-colors h-12">
                      <td className="font-semibold text-white py-2 flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary/15 text-primary font-bold flex items-center justify-center text-[10px]">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        {p.name}
                      </td>
                      <td>
                        <span className="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded font-medium">
                          {p.role || "Especialista"}
                        </span>
                      </td>
                      <td className="font-mono text-zinc-300 font-semibold">{formatBRL(revenue)}</td>
                      <td className="text-zinc-400 font-mono">{runsCount} avaliações</td>
                      <td className="text-right py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveTab("professionals");
                          }}
                          className="h-8 rounded-lg text-[10px] hover:text-primary hover:bg-white/5 flex items-center gap-1 px-2.5 ml-auto cursor-pointer"
                        >
                          Ver Detalhes <ChevronRight className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PARTE 6 — DIALOG FOR CREATING / EDITING GOALS */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl bg-[#09090b] border border-white/10 text-white rounded-2xl shadow-2xl p-0 font-sans max-h-[95vh] overflow-y-auto">
          <DialogHeader className="border-b border-white/5 p-6 pb-4 flex items-start gap-1">
            <DialogTitle className="text-lg md:text-xl font-light tracking-tight text-white flex items-center gap-2">
              <Target className="w-5.5 h-5.5 text-primary" /> {editingGoal ? "Configurar e Atualizar Meta" : "Cadastrar Nova Meta Operacional"}
            </DialogTitle>
            <p className="text-zinc-400 text-xs font-light mt-1">
              Combine escopo, periodicidade e tipo de rastreamento para criar alinhamentos inteligentes de equipe.
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveGoal} className="p-6 space-y-5 font-sans">
            {/* Optional Title */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs font-semibold">Título Personalizado (Opcional)</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex de preenchimento automático se deixado vazio"
                className="bg-black/40 border-white/10 text-white text-xs rounded-xl h-9.5 placeholder:text-zinc-650"
              />
            </div>

            {/* Scope selection & Period types */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold">Público / Escopo da Meta</Label>
                <select
                  value={formData.goalScope}
                  onChange={(e: any) =>
                    setFormData((p) => ({ ...p, goalScope: e.target.value, professionalId: "", targetFunction: "" }))
                  }
                  className="w-full bg-[#121214] border border-white/10 text-white rounded-xl text-xs px-3 py-2 h-9.5 cursor-pointer outline-none font-sans"
                >
                  <option value="global">Global (Todo o Salão)</option>
                  <option value="professional">Profissional Específico</option>
                  <option value="team">Por Cargo / Função Coletiva</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold">Frequência da Meta</Label>
                <select
                  value={formData.periodType}
                  onChange={(e: any) => setFormData((p) => ({ ...p, periodType: e.target.value }))}
                  className="w-full bg-[#121214] border border-white/10 text-white rounded-xl text-xs px-3 py-2 h-9.5 cursor-pointer outline-none font-sans"
                >
                  <option value="monthly">Mensal</option>
                  <option value="weekly">Semanal</option>
                  <option value="daily">Diária</option>
                </select>
              </div>
            </div>

            {/* Dynamic scope settings (Professional or Category inputs) */}
            {formData.goalScope === "professional" && (
              <div className="space-y-1.5 bg-[#D4AF37]/5 border border-[#D4AF37]/15 p-3.5 rounded-xl">
                <Label className="text-[#D4AF37] text-xs font-semibold">Escolha o Especialista Vinculado</Label>
                <select
                  required
                  value={formData.professionalId}
                  onChange={(e) => setFormData((p) => ({ ...p, professionalId: e.target.value }))}
                  className="w-full bg-[#121214] border border-white/10 text-white rounded-xl text-xs px-3 py-2 h-9.5 cursor-pointer outline-none font-sans"
                >
                  <option value="" disabled>-- Selecione --</option>
                  {professionals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.role || "Especialista"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.goalScope === "team" && (
              <div className="space-y-1.5 bg-blue-500/5 border border-blue-500/15 p-3.5 rounded-xl">
                <Label className="text-blue-400 text-xs font-semibold flex items-center gap-1">
                  Selecione a Função / Cargo Especializado
                </Label>
                <p className="text-[10px] text-zinc-400 font-light mt-0.5 mb-2">
                  PARTE 7: Atribui de forma concomitante. Todos os membros desempenhando este cargo compartilharão a meta e progredirão em equipe.
                </p>
                <div className="flex gap-2">
                  <select
                    value={formData.targetFunction}
                    onChange={(e) => setFormData((p) => ({ ...p, targetFunction: e.target.value }))}
                    className="w-full bg-[#121214] border border-white/10 text-white rounded-xl text-xs px-3 py-2 h-9.5 cursor-pointer outline-none font-sans"
                  >
                    <option value="">-- Selecione ou digite abaixo --</option>
                    {uniqueProfessionalRoles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Outro cargo"
                    value={formData.targetFunction}
                    onChange={(e) => setFormData((p) => ({ ...p, targetFunction: e.target.value }))}
                    className="bg-black/40 border-white/10 text-white text-xs rounded-xl h-9.5 w-1/2 placeholder:text-zinc-650"
                  />
                </div>
              </div>
            )}

            {/* Target type selection & Value input */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold">Tipo de Métrica</Label>
                <select
                  value={formData.targetType}
                  onChange={(e: any) =>
                    setFormData((p) => ({
                      ...p,
                      targetType: e.target.value,
                      trackingMode: (e.target.value === "products" || e.target.value === "custom") ? "manual" : "auto",
                    }))
                  }
                  className="w-full bg-[#121214] border border-white/10 text-white rounded-xl text-xs px-3 py-2 h-9.5 cursor-pointer outline-none font-sans"
                >
                  <option value="revenue">Faturamento (R$)</option>
                  <option value="appointments">Atendimentos (Quant.)</option>
                  <option value="services">Serviços executados (Quant.)</option>
                  <option value="products">Venda de produtos (Faturamento R$)</option>
                  <option value="checklist">Avaliação Auditoria (% Conformidade)</option>
                  <option value="custom">Métrica Customizada (Manual)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold">Valor Alvo (Atingir)</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={formData.targetValue}
                  onChange={(e) => setFormData((p) => ({ ...p, targetValue: e.target.value }))}
                  placeholder={formData.targetType === "revenue" ? "Ex: 5000" : "Ex: 20"}
                  className="bg-black/40 border-white/10 text-white text-xs rounded-xl h-9.5 placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold">Rastreamento</Label>
                <select
                  value={formData.trackingMode}
                  disabled={formData.targetType === "products" || formData.targetType === "custom"}
                  onChange={(e: any) => setFormData((p) => ({ ...p, trackingMode: e.target.value }))}
                  className="w-full bg-[#121214] border border-white/10 text-white rounded-xl text-xs px-3 py-2 h-9.5 cursor-pointer outline-none font-sans disabled:opacity-45"
                >
                  <option value="auto">Automático (Puxar Dados)</option>
                  <option value="manual">Manual (Informar Valor)</option>
                </select>
              </div>
            </div>

            {/* Date settings and Month Ref selection based on frequency */}
            <div className="bg-[#121214]/40 p-4 rounded-xl border border-white/5 space-y-3.5">
              <h5 className="text-[10px] uppercase font-bold text-primary font-mono tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Definição do Período de Validade
              </h5>
              
              {formData.periodType === "monthly" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">Mês de Referência</Label>
                    <Input
                      type="month"
                      value={formData.monthRef}
                      onChange={(e) => setFormData((p) => ({ ...p, monthRef: e.target.value }))}
                      className="bg-[#09090b] border-white/10 rounded-xl h-9.5"
                    />
                  </div>
                  <div className="space-y-1 text-xs text-zinc-400 font-light pt-6 pl-1.5 flex items-center justify-start leading-tight">
                    Validade automática do dia 1 ao dia 31 deste mês.
                  </div>
                </div>
              ) : formData.periodType === "daily" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-zinc-400">Dia de Referência</Label>
                    <Input
                      type="date"
                      value={selectedDateFilter}
                      onChange={(e) => setSelectedDateFilter(e.target.value)}
                      className="bg-[#09090b] border-white/10 rounded-xl h-9.5"
                    />
                  </div>
                  <div className="space-y-1 text-xs text-zinc-400 font-light pt-6 pl-1.5 flex items-center justify-start leading-tight animate-pulse font-mono">
                    Data: {selectedDateFilter}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-zinc-400">Data de Início</Label>
                    <Input
                      required
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                      className="bg-[#09090b] border-white/10 rounded-xl h-9.5 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-zinc-400">Data de Término</Label>
                    <Input
                      required
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                      className="bg-[#09090b] border-white/10 rounded-xl h-9.5 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {formData.trackingMode === "manual" && (
              <div className="space-y-1.5 bg-[#D4AF37]/5 border border-[#D4AF37]/25 p-4 rounded-xl">
                <Label className="text-[#D4AF37] text-xs font-bold">Progresso Realizado Manual (Atual)</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={formData.currentValue}
                  onChange={(e) => setFormData((p) => ({ ...p, currentValue: e.target.value }))}
                  placeholder="Ex: 15"
                  className="bg-black/40 border-white/10 text-white rounded-xl text-xs h-9.5"
                />
                <p className="text-[10px] text-zinc-500 font-light leading-snug pt-0.5">
                  Insira o andamento atualizado. Você poderá alterar este valor a qualquer momento editando este formulário.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-white/5 select-none font-sans">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="w-1/2 border-white/10 hover:bg-white/5 text-zinc-300 rounded-xl font-semibold text-xs h-10.5 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="w-1/2 bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl text-xs h-10.5 transition-all cursor-pointer shadow-lg"
              >
                {editingGoal ? "Salvar Alterações" : "Ativar Nova Meta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "../../lib/audit";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Goal, Professional, Service, Appointment, ProfessionalGoal } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { normalizeGoal, calculateGoalProgress, GoalProgress, getDaysCount } from "../../lib/goals";
import { canManageGoals } from "../../lib/permissions";
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
  AlertCircle,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function GoalsPage() {
  const { salonData, userData, currentUser } = useAuth();

  // Tabs state
  const [activeTab, setActiveTab] = useState<"salon" | "professionals">("salon");
  const [subTab, setSubTab] = useState<"overview" | "monthly" | "weekly" | "daily" | "by_professional">("overview");
  const [useBusinessDays, setUseBusinessDays] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );

  // States for manual progress updates
  const [selectedProfForProgress, setSelectedProfForProgress] = useState<Professional | null>(null);
  const [selectedGoalForProgress, setSelectedGoalForProgress] = useState<any | null>(null);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [progressUpdateMode, setProgressUpdateMode] = useState<"set" | "add">("set");
  const [manualProgressValue, setManualProgressValue] = useState("");

  // States for general goals
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    month: new Date().toISOString().substring(0, 7), // YYYY-MM
    targetAmount: "",
    currentAmount: "0",
  });

  // States for professional goals
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionalGoals, setProfessionalGoals] = useState<ProfessionalGoal[]>([]);
  const [selectedProf, setSelectedProf] = useState<Professional | null>(null);
  const [profGoalTargetAmount, setProfGoalTargetAmount] = useState("");
  const [isProfGoalDialogOpen, setIsProfGoalDialogOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  if (userData && !canManageGoals(userData.role)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-[#0d0d12]/90 border border-white/10 p-8 rounded-2xl shadow-2xl backdrop-blur-xl text-center">
          <div className="w-16 h-16 bg-red-600/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-heading font-light text-white mb-2 tracking-tight">Acesso Restrito</h2>
          <p className="text-[#a1a1aa] text-sm font-light mb-6 leading-relaxed">
            Seu perfil como <span className="text-primary font-medium">{userData.role === 'receptionist' ? 'Recepcionista' : (userData.role || 'Usuário')}</span> não possui autorização para acessar Metas.
          </p>
          <div className="flex justify-center flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => window.location.href = '/dashboard'}
              className="bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl text-xs px-5 h-10"
            >
              Voltar ao Meu Painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Load all required collections in a single hook
  useEffect(() => {
    if (!salonData) return;

    const unsubs: (() => void)[] = [];

    // 1. General Salon Goals
    const qg = query(collection(db, `salons/${salonData.id}/goals`));
    unsubs.push(
      onSnapshot(qg, (snapshot) => {
        const arr: Goal[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Goal));
        setGoals(arr.sort((a, b) => b.month.localeCompare(a.month)));
      }, (error) => {
        console.error("Erro ao carregar metas gerais:", error);
        setLoading(false);
      })
    );

    // 2. Active Professionals
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(
      onSnapshot(qp, (snapshot) => {
        const arr: Professional[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Professional));
        const filteredPros = arr.filter((p) => {
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
        setProfessionals(filteredPros);
      }, (error) => {
        console.error("Erro ao carregar profissionais:", error);
        setLoading(false);
      })
    );

    // 3. Services
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    unsubs.push(
      onSnapshot(qs, (snapshot) => {
        const arr: Service[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Service));
        setServices(arr);
      }, (error) => {
        console.error("Erro ao carregar serviço:", error);
        setLoading(false);
      })
    );

    // 4. Appointments
    const qa = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(
      onSnapshot(qa, (snapshot) => {
        const arr: Appointment[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Appointment));
        setAppointments(arr);
      }, (error) => {
        console.error("Erro ao carregar agendamentos:", error);
        setLoading(false);
      })
    );

    // 5. Professional Goals
    const qpg = query(collection(db, `salons/${salonData.id}/professionalGoals`));
    unsubs.push(
      onSnapshot(qpg, (snapshot) => {
        const arr: ProfessionalGoal[] = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as ProfessionalGoal));
        setProfessionalGoals(arr);
        setLoading(false);
      }, (err) => {
        console.error("Error fetching professional goals:", err);
        setLoading(false);
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [salonData]);

  // Salon-level Goals Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const target = parseFloat(formData.targetAmount.replace(",", "."));
      const current = parseFloat(formData.currentAmount.replace(",", "."));

      const payload = {
        title: formData.title,
        month: formData.month,
        targetAmount: target,
        currentAmount: current,
        updatedAt: Date.now(),
      };

      if (editingGoal) {
        const ref = doc(db, `salons/${salonData.id}/goals`, editingGoal.id);
        await updateDoc(ref, payload);

        // Audit log
        logAuditEvent(
          salonData.id,
          currentUser?.uid || '',
          userData?.fullName || '',
          currentUser?.email || userData?.email || '',
          userData?.role || 'professional',
          {
            action: 'update',
            targetEntity: 'goals',
            targetId: editingGoal.id,
            description: `${userData?.fullName || 'Usuário'} atualizou a meta do salão "${payload.title}" para R$ ${payload.targetAmount}`,
            details: payload
          }
        ).catch(err => console.error('[Audit] Error logging goal update:', err));

        toast.success("Meta do salão atualizada com sucesso!");
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/goals`));
        const finalData = {
          id: ref.id,
          ...payload,
          createdAt: Date.now(),
        };
        await setDoc(ref, finalData);

        // Audit log
        logAuditEvent(
          salonData.id,
          currentUser?.uid || '',
          userData?.fullName || '',
          currentUser?.email || userData?.email || '',
          userData?.role || 'professional',
          {
            action: 'create',
            targetEntity: 'goals',
            targetId: ref.id,
            description: `${userData?.fullName || 'Usuário'} criou a nova meta do salão "${payload.title}" com alvo de R$ ${payload.targetAmount}`,
            details: finalData
          }
        ).catch(err => console.error('[Audit] Error logging goal create:', err));

        toast.success("Meta do salão criada com sucesso!");
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar meta do salão.");
    }
  };

  const resetForm = () => {
    setEditingGoal(null);
    setFormData({
      title: "",
      month: new Date().toISOString().substring(0, 7),
      targetAmount: "",
      currentAmount: "0",
    });
  };

  const openEdit = (g: Goal) => {
    setEditingGoal(g);
    setFormData({
      title: g.title || "",
      month: g.month,
      targetAmount: g.targetAmount.toString(),
      currentAmount: g.currentAmount.toString(),
    });
    setIsDialogOpen(true);
  };

  // Professional-level Goals Handlers
  const openProfGoalEdit = (prof: Professional, currentTarget: number) => {
    setSelectedProf(prof);
    setProfGoalTargetAmount(currentTarget > 0 ? currentTarget.toString() : "");
    setIsProfGoalDialogOpen(true);
  };

  const handleSaveProfGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData || !selectedProf) return;

    try {
      const target = parseFloat(profGoalTargetAmount.replace(",", "."));
      if (isNaN(target) || target < 0) {
        toast.error("Por favor, digite um valor de faturamento válido.");
        return;
      }

      const docId = `${selectedProf.id}_${selectedMonth}`;
      const existingGoal = professionalGoals.find(
        (g) => g.professionalId === selectedProf.id && g.month === selectedMonth
      );

      if (existingGoal && existingGoal.targetAmount !== target) {
        const confirmed = window.confirm(
          `Você está alterando a meta definida para este profissional (${selectedProf.name}).\n\nMeta Anterior: ${formatBRL(existingGoal.targetAmount)}\nNova Meta: ${formatBRL(target)}\n\nDeseja realmente prosseguir?`
        );
        if (!confirmed) return;
      }

      const payload = {
        id: docId,
        professionalId: selectedProf.id,
        professionalName: selectedProf.name,
        month: selectedMonth,
        targetAmount: target,
        updatedAt: Date.now(),
        createdAt: existingGoal?.createdAt || Date.now(),
      };

      const ref = doc(db, `salons/${salonData.id}/professionalGoals`, docId);
      await setDoc(ref, payload, { merge: true });

      toast.success(`Meta para ${selectedProf.name} definida com sucesso!`);
      setIsProfGoalDialogOpen(false);
      setSelectedProf(null);
      setProfGoalTargetAmount("");
    } catch (err) {
      console.error("Error setting professional goal:", err);
      toast.error("Erro ao salvar meta para o profissional.");
    }
  };

  const openUpdateProgress = (prof: Professional, goalObj?: any) => {
    setSelectedProfForProgress(prof);
    setSelectedGoalForProgress(goalObj || null);
    setProgressUpdateMode("set");
    setManualProgressValue("");
    setIsProgressDialogOpen(true);
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData || !selectedProfForProgress) return;

    try {
      const value = parseFloat(manualProgressValue.replace(",", "."));
      if (isNaN(value) || value < 0) {
        toast.error("Por favor, insira um valor numérico válido.");
        return;
      }

      const docId = `${selectedProfForProgress.id}_${selectedMonth}`;
      const autoRevenue = calculateRevenue(selectedProfForProgress.id);
      
      const currentManualVal = selectedGoalForProgress ? (
        selectedGoalForProgress.currentValue ?? 
        selectedGoalForProgress.realizedValue ?? 
        selectedGoalForProgress.achievedValue ?? 
        0
      ) : 0;

      let newValue = value;
      if (progressUpdateMode === "add") {
        newValue = currentManualVal + value;
      }

      const payload: any = {
        id: docId,
        professionalId: selectedProfForProgress.id,
        professionalName: selectedProfForProgress.name,
        month: selectedMonth,
        currentValue: newValue,
        lastProgressUpdateAt: Date.now(),
        lastProgressUpdatedBy: userData?.fullName || userData?.email || "Manager",
        updatedAt: Date.now(),
      };

      const ref = doc(db, `salons/${salonData.id}/professionalGoals`, docId);
      await setDoc(ref, payload, { merge: true });

      toast.success(`Faturamento de ${selectedProfForProgress.name} atualizado para ${formatBRL(newValue)}!`);
      setIsProgressDialogOpen(false);
      setManualProgressValue("");
      setSelectedProfForProgress(null);
      setSelectedGoalForProgress(null);
    } catch (err) {
      console.error("Error saving manual progress:", err);
      toast.error("Erro ao salvar realizado.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate dynamic stats for currently completed appointments for professionals
  const calculateRevenue = (profId: string) => {
    return appointments
      .filter(
        (app) =>
          app.professionalId === profId &&
          app.status === "completed" &&
          app.date.substring(0, 7) === selectedMonth
      )
      .reduce((total, app) => {
        const srv = services.find((s) => s.id === app.serviceId);
        return total + (srv ? srv.price : 0);
      }, 0);
  };

  // Cumulative sums for Summary Header in professional section
  const totalCompletedProfRevenue = professionals.reduce(
    (sum, p) => sum + calculateRevenue(p.id),
    0
  );

  const totalDefinedProfGoals = professionals.reduce((sum, p) => {
    const goalObj = professionalGoals.find(
      (g) => g.professionalId === p.id && g.month === selectedMonth
    );
    return sum + (goalObj ? goalObj.targetAmount : 0);
  }, 0);

  const totalGoalsCount = professionals.filter((p) => {
    const goalObj = professionalGoals.find(
      (g) => g.professionalId === p.id && g.month === selectedMonth
    );
    return goalObj && goalObj.targetAmount > 0;
  }).length;

  const totalCompletedPct =
    totalDefinedProfGoals > 0
      ? Math.min(
          Math.round((totalCompletedProfRevenue / totalDefinedProfGoals) * 100),
          105
        )
      : 0;

  // HIGH-FIDELITY CALCULATIONS FOR THE UPGRADED PROGRESSION DASHBOARD
  const normalizedProfGoals = professionals.map((p) => {
    const rawGoal = professionalGoals.find(
      (g) => g.professionalId === p.id && g.month === selectedMonth
    );
    const autoRevenue = calculateRevenue(p.id);
    const goalObj = rawGoal ? normalizeGoal(rawGoal, autoRevenue) : {
      id: `${p.id}_${selectedMonth}`,
      professionalId: p.id,
      professionalName: p.name,
      month: selectedMonth,
      targetAmount: 0,
      currentValue: autoRevenue,
      lastProgressUpdateAt: 0,
      lastProgressUpdatedBy: "",
    };
    
    // Check if progress contains manually added fields
    const hasManualProgress = rawGoal && (
      rawGoal.currentValue !== undefined || 
      rawGoal.realizedValue !== undefined || 
      rawGoal.achievedValue !== undefined
    );

    const progress = calculateGoalProgress(goalObj, { useBusinessDays });
    return {
      professional: p,
      goalObj,
      progress,
      autoRevenue,
      hasManualProgress: !!hasManualProgress,
    };
  });

  const activeGoalsCount = normalizedProfGoals.filter(i => i.progress.targetValue > 0).length;
  const totalDefinedGoalsSum = normalizedProfGoals.reduce((sum, i) => sum + i.progress.targetValue, 0);
  const totalRealizedSum = normalizedProfGoals.reduce((sum, i) => sum + i.progress.currentValue, 0);
  const totalRemainingSum = normalizedProfGoals.reduce((sum, i) => sum + i.progress.remainingValue, 0);
  const teamProgressPct = totalDefinedGoalsSum > 0 
    ? Math.min(Math.round((totalRealizedSum / totalDefinedGoalsSum) * 100), 100)
    : 0;

  const professionalsBehind = normalizedProfGoals.filter(
    i => i.progress.targetValue > 0 && (i.progress.status === "behind" || i.progress.status === "attention")
  );
  
  const professionalsOnTrack = normalizedProfGoals.filter(
    i => i.progress.targetValue > 0 && (i.progress.status === "on_track" || i.progress.status === "completed")
  );

  return (
    <div className="space-y-6">
      {/* Banner & Tab Switcher */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 flex-wrap pb-4 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-heading font-light tracking-tight text-white">
            Painel de Metas
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Defina e monitore objetivos financeiros para o salão e para sua equipe de especialistas.
          </p>
        </div>

        {/* Tab selector switcher */}
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("salon")}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeTab === "salon"
                ? "bg-primary text-black font-bold shadow-lg"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            Metas Gerais do Salão
          </button>
          <button
            onClick={() => setActiveTab("professionals")}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeTab === "professionals"
                ? "bg-primary text-black font-bold shadow-lg"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            Metas de Profissionais
          </button>
        </div>
      </div>

      {activeTab === "salon" ? (
        // SALON TAB
        <div className="space-y-6">
          <div className="flex justify-end">
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-gold-400 text-black font-semibold rounded-xl text-xs h-9 px-4">
                  <Plus className="w-4 h-4 mr-1.5" /> Nova Meta do Salão
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-card border border-white/15 rounded-3xl p-6 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="font-heading text-lg font-semibold text-foreground">
                    {editingGoal ? "Editar Meta do Salão" : "Nova Meta do Salão"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Título (Opcional)</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, title: e.target.value }))
                      }
                      className="bg-background border-white/10"
                      placeholder="Ex: Faturamento do Mês"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Mês Referência</Label>
                    <Input
                      required
                      type="month"
                      value={formData.month}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, month: e.target.value }))
                      }
                      className="bg-background border-white/10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Valor da Meta (R$)</Label>
                    <Input
                      required
                      type="number"
                      step="0.01"
                      value={formData.targetAmount}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, targetAmount: e.target.value }))
                      }
                      className="bg-background border-white/10"
                    />
                  </div>
                  {editingGoal && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Valor Realizado Até Agora (R$)
                      </Label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        value={formData.currentAmount}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, currentAmount: e.target.value }))
                        }
                        className="bg-background border-white/10"
                      />
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-gold-400 text-black font-semibold h-11 rounded-xl transition-all"
                  >
                    {editingGoal ? "Salvar Alterações" : "Criar Meta"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {goals.length === 0 ? (
            <Card className="border-white/10 bg-card/40 rounded-2xl shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Sem metas gerais hoje
                </h3>
                <p className="text-muted-foreground text-xs mt-1 max-w-sm">
                  Defina os objetivos globais de faturamento do salão para acompanhar o progresso total.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map((g) => {
                const pct = Math.min(
                  Math.round((g.currentAmount / g.targetAmount) * 100),
                  100
                );
                const remaining = Math.max(g.targetAmount - g.currentAmount, 0);

                return (
                  <Card key={g.id} className="border-white/10 bg-card/35 rounded-2xl shadow-xl relative overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                            {g.month}
                          </p>
                          <CardTitle className="text-base font-semibold mt-1">
                            {g.title || "Faturamento Mensal"}
                          </CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(g)}
                          className="-mt-2 -mr-2 h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Realizado</p>
                          <p className="text-2xl font-light text-foreground select-all">
                            {formatBRL(g.currentAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-0.5">Meta</p>
                          <p className="text-sm text-muted-foreground font-medium select-all">
                            {formatBRL(g.targetAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-primary">{pct}%</span>
                          {remaining > 0 ? (
                            <span className="text-muted-foreground font-light">
                              Falta {formatBRL(remaining)}
                            </span>
                          ) : (
                            <span className="text-green-400 font-semibold flex items-center">
                              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Meta Batida!
                            </span>
                          )}
                        </div>
                        <Progress value={pct} className="h-2 bg-white/5" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // INDIVIDUAL REPRESENTATIVES GOALS TAB (PROFESSIONALS)
        <div className="space-y-6">
          {/* Header Filtering, Calulator Mode & Global Target Cumulative Panel */}
          <Card className="border border-white/10 bg-card/65 rounded-2xl shadow-md p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Indicador Mensal & Configurações de Progressão</p>
                <p className="text-xs text-muted-foreground">
                  Selecione o mês e o método de cálculo de dias úteis para faturamento da equipe.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setUseBusinessDays(false)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all/all ${
                      !useBusinessDays
                        ? "bg-primary text-black font-extrabold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Dias Corridos
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseBusinessDays(true)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all/all ${
                      useBusinessDays
                        ? "bg-primary text-black font-extrabold"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Dias Úteis
                  </button>
                </div>

                {/* Month filter trigger */}
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10 min-w-[150px]">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent border-none text-xs text-foreground focus:outline-none font-medium text-white cursor-pointer w-full"
                  />
                </div>
              </div>
            </div>

            {/* Consolidate Analytics Row */}
            {totalDefinedGoalsSum > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/5">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Metas Definidas
                  </p>
                  <p className="text-base font-semibold text-primary">
                    {activeGoalsCount} de {professionals.length} pros
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Total das Metas
                  </p>
                  <p className="text-base font-semibold text-foreground select-all">
                    {formatBRL(totalDefinedGoalsSum)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Realizado Equipe
                  </p>
                  <p className="text-base font-semibold text-green-400 select-all font-mono">
                    {formatBRL(totalRealizedSum)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Progresso Geral
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-sm font-bold text-white">
                      {teamProgressPct}%
                    </span>
                    <Progress value={teamProgressPct} className="h-1.5 w-16 bg-white/10" />
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Sub-tabs indicators */}
          <div className="flex flex-wrap gap-1.5 border-b border-white/5 pb-2">
            <button
              onClick={() => setSubTab("overview")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all/all flex items-center gap-1.5 ${
                subTab === "overview"
                  ? "bg-white/10 text-white font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Target className="w-3.5 h-3.5" /> Visão Geral
            </button>
            <button
              onClick={() => setSubTab("monthly")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all/all flex items-center gap-1.5 ${
                subTab === "monthly"
                  ? "bg-white/10 text-white font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Metas Mensais
            </button>
            <button
              onClick={() => setSubTab("weekly")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all/all flex items-center gap-1.5 ${
                subTab === "weekly"
                  ? "bg-white/10 text-white font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Ref. Semanais Derivadas
            </button>
            <button
              onClick={() => setSubTab("daily")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all/all flex items-center gap-1.5 ${
                subTab === "daily"
                  ? "bg-white/10 text-white font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Ref. Diárias Derivadas
            </button>
            <button
              onClick={() => setSubTab("by_professional")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all/all flex items-center gap-1.5 ${
                subTab === "by_professional"
                  ? "bg-white/10 text-white font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="w-3.5 h-3.5" /> Por Profissional
            </button>
          </div>

          {professionals.length === 0 ? (
            <Card className="border-white/10 bg-card/45 rounded-2xl shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Sem profissionais ativos
                </h3>
                <p className="text-muted-foreground text-xs mt-1 max-w-sm">
                  Cadastre profissionais na aba de equipe antes de poder definir metas individuais.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* SUBTAB: OVERVIEW */}
              {subTab === "overview" && (
                <div className="space-y-6">
                  {/* General Summary Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-white/5 bg-[#121217] p-5 rounded-2xl space-y-2">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mr-1 block">Metas Coletivas</span>
                      <p className="text-2xl font-bold font-mono text-white select-all">{formatBRL(totalDefinedGoalsSum)}</p>
                      <p className="text-xs text-muted-foreground">Soma das metas individuais</p>
                    </Card>
                    <Card className="border-white/5 bg-[#121217] p-5 rounded-2xl space-y-2">
                      <span className="text-[10px] text-[#A3E635] uppercase font-bold tracking-wider mr-1 block font-sans">Produção Acumulada</span>
                      <p className="text-2xl font-bold font-mono text-[#A3E635] select-all">{formatBRL(totalRealizedSum)}</p>
                      <p className="text-xs text-muted-foreground">Faturado até o momento</p>
                    </Card>
                    <Card className="border-white/5 bg-[#121217] p-5 rounded-2xl space-y-2">
                      <span className="text-[10px] text-amber-500 uppercase font-bold tracking-wider mr-1 block font-sans">Falta Atingir</span>
                      <p className="text-2xl font-bold font-mono text-amber-400 select-all">{formatBRL(totalRemainingSum)}</p>
                      <p className="text-xs text-muted-foreground">Valor restante para faturar</p>
                    </Card>
                    <Card className="border-white/5 bg-[#121217] p-5 rounded-2xl space-y-2">
                      <span className="text-[10px] text-primary uppercase font-bold tracking-wider mr-1 block font-sans">Média Diária Coletiva</span>
                      {(() => {
                        const anyProgress = normalizedProfGoals.find(i => i.progress.totalDays > 0)?.progress;
                        const totalDays = anyProgress?.totalDays || 30;
                        const elapsedDays = anyProgress?.elapsedDays || 0;
                        const remDays = Math.max(totalDays - elapsedDays, 0);
                        const dailyNeeded = remDays > 0 ? totalRemainingSum / remDays : 0;
                        return (
                          <>
                            <p className="text-2xl font-bold font-mono text-primary select-all">{formatBRL(dailyNeeded)}</p>
                            <p className="text-xs text-muted-foreground border-t border-white/5 pt-1 mt-1">Para os {remDays} dias restantes</p>
                          </>
                        );
                      })()}
                    </Card>
                  </div>

                  {/* Pacing lists */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Column 1: Below Pacing */}
                    <Card className="border-white/5 bg-[#15151b] p-5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                        <h4 className="text-sm font-semibold text-rose-400 uppercase tracking-wider font-heading">Abaixo do Ritmo Esperado</h4>
                      </div>
                      {professionalsBehind.length === 0 ? (
                        <p className="text-xs text-zinc-400 py-6 text-center italic font-light">Nenhum profissional abaixo do ritmo. Excelente!</p>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                          {professionalsBehind.map(({ professional, progress }) => (
                            <div key={professional.id} className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-2 flex flex-col justify-between">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-xs font-bold text-white">{professional.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{professional.role || "Especialista"}</p>
                                </div>
                                <span className="text-[10px] bg-red-500/10 text-red-400 font-bold px-2 py-0.5 rounded-md font-mono">
                                  {progress.progressPercent}%
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                                  <span>Falta: {formatBRL(progress.remainingValue)}</span>
                                  <span>Meta: {formatBRL(progress.targetValue)}</span>
                                </div>
                                <Progress value={progress.progressPercent} className="h-1 bg-white/5" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* Column 2: On Track / Success */}
                    <Card className="border-white/5 bg-[#15151b] p-5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                        <Award className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider font-heading">No Ritmo ou Meta Batida</h4>
                      </div>
                      {professionalsOnTrack.length === 0 ? (
                        <p className="text-xs text-zinc-400 py-6 text-center italic font-light">Nenhum profissional no ritmo ideal ainda.</p>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                          {professionalsOnTrack.map(({ professional, progress }) => (
                            <div key={professional.id} className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-2 flex flex-col justify-between">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-xs font-bold text-white">{professional.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{professional.role || "Especialista"}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                                  progress.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-400/10 text-amber-350"
                                }`}>
                                  {progress.progressPercent}%
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                                  <span>Realizado: {formatBRL(progress.currentValue)}</span>
                                  <span>Meta: {formatBRL(progress.targetValue)}</span>
                                </div>
                                <Progress value={progress.progressPercent} className="h-1 bg-white/5" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
              )}

              {/* SUBTAB: MONTHLY */}
              {subTab === "monthly" && (
                <div className="grid gap-4 md:grid-cols-2">
                  {normalizedProfGoals.map(({ professional: p, goalObj, progress, autoRevenue, hasManualProgress }) => {
                    const isSet = progress.targetValue > 0;

                    return (
                      <Card key={p.id} className="border-white/10 bg-card/35 rounded-2xl shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                                {selectedMonth}
                              </p>
                              <CardTitle className="text-base font-bold mt-1 text-white">
                                {p.name}
                              </CardTitle>
                              <span className="inline-block text-[9px] bg-white/5 border border-white/5 text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                                {p.role || "Especialista"}
                              </span>
                            </div>

                            {/* Status Badge */}
                            {isSet && (
                              <div className="space-y-1 text-right">
                                <span className={`inline-block text-[10px] font-bold tracking-wider rounded-md px-2.5 py-1 ${
                                  progress.status === "completed" 
                                    ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                                    : progress.status === "on_track"
                                    ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
                                    : progress.status === "attention"
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}>
                                  {progress.status === "completed" 
                                    ? "META BATIDA" 
                                    : progress.status === "on_track"
                                    ? "EM DIA"
                                    : progress.status === "attention"
                                    ? "ATENÇÃO"
                                    : "ATRASADO"}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4 pt-1 flex-1 flex flex-col justify-between">
                          {isSet ? (
                            <>
                              {/* Numbers Row */}
                              <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5 mt-2">
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Realizado</p>
                                  <p className="text-lg font-bold text-white font-mono">{formatBRL(progress.currentValue)}</p>
                                  <p className="text-[9px] text-muted-foreground font-light text-zinc-400 border-t border-white/5 pt-0.5 mt-0.5">
                                    {hasManualProgress ? "🔒 Lançamento manual" : "⚙️ Dinâmico da agenda"}
                                  </p>
                                </div>
                                <div className="space-y-0.5 text-right">
                                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Meta</p>
                                  <p className="text-lg font-bold text-[#D4AF37] font-mono">{formatBRL(progress.targetValue)}</p>
                                  <p className="text-[9px] text-muted-foreground font-light text-zinc-400 border-t border-white/5 pt-0.5 mt-0.5">Definido pela gerência</p>
                                </div>
                              </div>

                              {/* Progress bar and details */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="font-semibold text-primary">{progress.progressPercent}%</span>
                                  {progress.remainingValue > 0 ? (
                                    <span className="text-muted-foreground font-light text-zinc-300">
                                      Falta {formatBRL(progress.remainingValue)}
                                    </span>
                                  ) : (
                                    <span className="text-green-400 font-semibold">
                                      Excedeu {formatBRL(Math.abs(progress.remainingValue))}!
                                    </span>
                                  )}
                                </div>
                                <Progress value={progress.progressPercent} className="h-2 bg-white/5" />
                              </div>

                              {/* Required daily metrics */}
                              <div className="bg-white/5 p-3 rounded-xl space-y-1 border border-white/5 text-xs text-zinc-300">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Dias úteis calculados:</span>
                                  <span className="font-mono text-white font-medium">{useBusinessDays ? "Sim (Dias Úteis)" : "Não (Corridos)"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Dias Restantes:</span>
                                  <span className="font-semibold text-white">{progress.totalDays - progress.elapsedDays} de {progress.totalDays} dias</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-white/5 mt-0.5">
                                  <span className="text-primary font-bold">Média p/ Dia Necessária:</span>
                                  <span className="font-bold text-primary text-sm font-mono">{progress.remainingValue > 0 ? formatBRL(progress.dailyAverageRequired) : "R$ 0,00"}</span>
                                </div>
                              </div>

                              {/* Actions Block */}
                              <div className="mt-2 pt-2 border-t border-white/5 flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => openUpdateProgress(p, goalObj)}
                                  className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-xs h-9 rounded-xl font-medium text-white transition-all/all"
                                >
                                  Atualizar Realizado
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => openProfGoalEdit(p, progress.targetValue)}
                                  className="h-9 w-9 p-0 text-muted-foreground hover:text-primary rounded-xl flex items-center justify-center border border-white/5"
                                  title="Ajustar meta contratada"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center h-full">
                              <Target className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                              <p className="text-xs text-muted-foreground max-w-xs mb-4">
                                Nenhuma meta contratual definida para este profissional.
                              </p>
                              <Button
                                variant="outline"
                                onClick={() => openProfGoalEdit(p, 0)}
                                className="w-full border-dashed border-white/15 hover:border-primary/45 hover:bg-primary/5 text-xs h-9 font-semibold rounded-xl text-muted-foreground hover:text-primary transition-all/all"
                              >
                                Definir uma meta para {p.name.split(" ")[0]}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* SUBTAB: WEEKLY */}
              {subTab === "weekly" && (
                <div className="space-y-4">
                  <div className="bg-[#121217] border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white font-heading">Referências Semanais Derivadas</h4>
                      <p className="text-xs text-muted-foreground">
                        Metas sugeridas semanais baseadas estritamente na meta mensal do profissional calculadas proporcionalmente de maneira segura.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {normalizedProfGoals.map(({ professional: p, progress }) => {
                      if (progress.targetValue === 0) return null;

                      // Derived weekly is roughly proportional to the total count of days, considering a 7 day span
                      const weekRatio = 7 / progress.totalDays;
                      const weeklyRefTarget = progress.targetValue * weekRatio;
                      const weeklyRefRealized = progress.currentValue * weekRatio;
                      
                      return (
                        <Card key={p.id} className="border-white/5 bg-[#15151b] p-5 rounded-2xl space-y-4 flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="flex justify-between items-start border-b border-white/5 pb-2.5">
                              <div>
                                <p className="text-xs font-bold text-white">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground">Faturamento contratual: {formatBRL(progress.targetValue)}</p>
                              </div>
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full font-mono">
                                7 Dias Estimado
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                              <div className="space-y-1">
                                <span className="text-zinc-400 font-sans block">Realizado Semanal (Pacing):</span>
                                <p className="text-sm font-bold text-zinc-200 font-mono">{formatBRL(weeklyRefRealized)}</p>
                              </div>
                              <div className="space-y-1 text-right">
                                <span className="text-primary font-bold font-sans block">Ref. Semanal Sugerida:</span>
                                <p className="text-sm font-bold text-primary font-mono">{formatBRL(weeklyRefTarget)}</p>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => {
                              toast.success(`Referência semanal de ${formatBRL(weeklyRefTarget)} simulada! Nenhuma alteração foi gravada em banco.`);
                            }}
                            className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-xs h-9 rounded-xl font-medium text-white transition-all/all mt-4"
                          >
                            Criar meta semanal a partir da mensal (Simular)
                          </Button>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBTAB: DAILY */}
              {subTab === "daily" && (
                <div className="space-y-4">
                  <div className="bg-[#121217] border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white font-heading">Referências Diárias Derivadas</h4>
                      <p className="text-xs text-muted-foreground">
                        Faturamento mínimo ideal por dia útil ou corrido de trabalho necessário para faturar 100% da meta.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {normalizedProfGoals.map(({ professional: p, progress }) => {
                      if (progress.targetValue === 0) return null;

                      const dailyRefTarget = progress.targetValue / progress.totalDays;
                      const dailyRefRealized = progress.currentValue / Math.max(progress.elapsedDays, 1);

                      return (
                        <Card key={p.id} className="border-white/5 bg-[#15151b] p-5 rounded-2xl space-y-4 flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="flex justify-between items-start border-b border-white/5 pb-2.5">
                              <div>
                                <p className="text-xs font-bold text-white">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground font-light">Soma de dias: {progress.totalDays} ({useBusinessDays ? "Dias Úteis" : "Dias Corridos"})</p>
                              </div>
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full font-mono">
                                Pacing Diário
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                              <div className="space-y-1">
                                <span className="text-zinc-400 font-sans block">Média Faturada Diária:</span>
                                <p className="text-sm font-bold text-green-400 font-mono">{formatBRL(dailyRefRealized)}</p>
                              </div>
                              <div className="space-y-1 text-right">
                                <span className="text-primary font-bold font-sans block">Média Sugerida por Dia:</span>
                                <p className="text-sm font-bold text-primary font-mono">{formatBRL(dailyRefTarget)}</p>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => {
                              toast.success(`Meta diária de ${formatBRL(dailyRefTarget)} simulada para ${p.name}!`);
                            }}
                            className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-xs h-9 rounded-xl font-medium text-white transition-all/all mt-4"
                          >
                            Criar meta diária a partir da mensal (Simular)
                          </Button>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBTAB: BY PROFESSIONAL */}
              {subTab === "by_professional" && (
                <div className="space-y-6">
                  {/* Combobox or select professional */}
                  <div className="flex items-center gap-3 bg-[#121217] p-4 rounded-3xl border border-white/5 max-w-sm">
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <select
                      value={selectedProf?.id || ""}
                      onChange={(e) => {
                        const found = professionals.find(p => p.id === e.target.value);
                        setSelectedProf(found || null);
                      }}
                      className="bg-transparent border-none text-xs text-white focus:outline-none font-medium cursor-pointer w-full"
                    >
                      <option value="" className="bg-[#121217] text-zinc-300">Selecione um Profissional...</option>
                      {professionals.map(p => (
                        <option key={p.id} value={p.id} className="bg-[#121217] text-white font-sans text-xs">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProf ? (() => {
                    const matchedItem = normalizedProfGoals.find(i => i.professional.id === selectedProf.id);
                    if (!matchedItem || matchedItem.progress.targetValue === 0) {
                      return (
                        <div className="bg-[#15151b] p-8 rounded-3xl border border-white/5 text-center text-zinc-400 select-none max-w-sm">
                          <Target className="w-10 h-10 mx-auto mb-3 opacity-30 text-primary" />
                          <p className="text-sm font-medium">Nenhuma meta ativa definida para {selectedProf.name} em {selectedMonth}</p>
                          <Button
                            onClick={() => openProfGoalEdit(selectedProf, 0)}
                            className="mt-4 bg-primary text-black font-bold text-xs h-9 rounded-xl font-sans"
                          >
                            Definir Meta Agora
                          </Button>
                        </div>
                      );
                    }

                    const { progress, hasManualProgress } = matchedItem;

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Summary Column */}
                        <Card className="lg:col-span-1 border-white/5 bg-[#15151b] p-5 rounded-3xl space-y-6 flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="space-y-1.5 flex flex-col">
                              <span className="inline-block self-start text-[10px] bg-primary/10 text-primary uppercase font-extrabold tracking-wider px-3 py-1 rounded-full">Meta Individual Ativa</span>
                              <h3 className="text-xl font-extrabold text-white pt-2">{selectedProf.name}</h3>
                              <p className="text-xs text-muted-foreground font-sans">{selectedProf.role || "Especialista"}</p>
                            </div>

                            <div className="space-y-1 border-t border-white/5 pt-4">
                              <span className="text-xs text-zinc-400">Total Faturado</span>
                              <p className="text-3xl font-bold text-white select-all font-mono">{formatBRL(progress.currentValue)}</p>
                              <p className="text-[10px] text-zinc-500 font-sans font-light mt-1 leading-relaxed">{hasManualProgress ? "🔒 Lançado manualmente pelo gestor" : "⚙️ Calculado dinamicamente através da agenda"}</p>
                            </div>

                            <div className="space-y-1 pt-1">
                              <span className="text-zinc-400 text-xs block">Objetivo Contratado</span>
                              <p className="text-lg font-bold text-primary select-all font-mono">{formatBRL(progress.targetValue)}</p>
                            </div>

                            <div className="space-y-1.5 pt-2">
                              <div className="flex justify-between text-xs text-zinc-300">
                                <span className="font-sans">Aderência</span>
                                <span className="font-bold font-mono">{progress.progressPercent}%</span>
                              </div>
                              <Progress value={progress.progressPercent} className="h-2.5 bg-black/50" />
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => openUpdateProgress(selectedProf, matchedItem.goalObj)}
                            className="w-full bg-[#121217] border border-white/10 hover:bg-white/5 text-xs font-semibold h-10 rounded-xl mt-4"
                          >
                            Ajustar Faturamento Manual
                          </Button>
                        </Card>

                        {/* Calculations & Timeline details Column */}
                        <Card className="lg:col-span-2 border-white/5 bg-[#15151b] p-6 rounded-3xl space-y-6">
                          <h4 className="text-sm font-semibold text-white border-b border-white/5 pb-2.5 font-heading">Projeções & Plano de Ação</h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-black/35 p-4 rounded-2xl border border-white/5 space-y-1.5 flex flex-col justify-between">
                              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Restante p/ Atingir</span>
                              <p className="text-xl font-bold font-mono text-white mt-1">{formatBRL(progress.remainingValue)}</p>
                              <p className="text-xs text-muted-foreground border-t border-white/5 pt-1 mt-1 font-sans">
                                {progress.remainingValue > 0 ? "Faltante para atingimento pleno do objetivo." : "Meta 100% batida! Parabéns!"}
                              </p>
                            </div>

                            <div className="bg-black/35 p-4 rounded-2xl border border-white/5 space-y-1.5 flex flex-col justify-between">
                              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Média Diária Necessária</span>
                              <p className="text-xl font-bold font-mono text-primary mt-1">{formatBRL(progress.dailyAverageRequired)}</p>
                              <p className="text-xs text-muted-foreground border-t border-white/5 pt-1 mt-1 font-sans">
                                Nos próximos {progress.totalDays - progress.elapsedDays} dias ({useBusinessDays ? "úteis" : "corridos"}).
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 text-xs text-zinc-200">
                            <div className="flex justify-between">
                              <span className="text-zinc-400 font-sans">Total de dias do período de referência:</span>
                              <span className="font-semibold text-white font-mono">{progress.totalDays} dias ({useBusinessDays ? "Sem Finais de Semana" : "Dias Corridos"})</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-2">
                              <span className="text-zinc-400 font-sans block">Dias já transcorridos do mês:</span>
                              <span className="font-semibold text-white font-mono">{progress.elapsedDays} dias</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-2">
                              <span className="text-zinc-400 font-sans block">Última alteração de progresso:</span>
                              <span className="font-semibold text-zinc-300 font-sans">
                                {matchedItem.goalObj?.lastProgressUpdateAt 
                                  ? `${new Date(matchedItem.goalObj.lastProgressUpdateAt).toLocaleDateString()} por ${matchedItem.goalObj.lastProgressUpdatedBy || "Gerente"}`
                                  : "Nenhuma modificação manual feita nesta meta"}
                              </span>
                            </div>
                          </div>

                          {progress.progressPercent >= 100 && (
                            <div className="flex gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl items-center text-xs text-green-400 mt-2">
                              <Award className="w-5 h-5 text-green-400 shrink-0" />
                              <p className="leading-relaxed font-sans">Este profissional já excedeu o faturamento contratado para {selectedMonth}. Excelente performance registrada!</p>
                            </div>
                          )}
                        </Card>
                      </div>
                    );
                  })() : (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/5 rounded-3xl">
                      <p className="text-xs italic font-sans font-light">Nenhum profissional selecionado para faturamento analítico.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual progress override / update Dialog */}
      <Dialog
        open={isProgressDialogOpen}
        onOpenChange={(open) => {
          setIsProgressDialogOpen(open);
          if (!open) {
            setSelectedProfForProgress(null);
            setSelectedGoalForProgress(null);
            setManualProgressValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] bg-card border border-white/15 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Atualizar Realizado Manualmente
            </DialogTitle>
          </DialogHeader>
          {selectedProfForProgress && (
            <form onSubmit={handleSaveProgress} className="space-y-5 pt-3">
              <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/10 text-xs">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mr-1 block">Profissional</span>
                <p className="text-sm font-bold text-white mt-1 leading-none">{selectedProfForProgress.name}</p>
                <p className="text-xs text-primary font-medium mt-1 select-none">{selectedProfForProgress.role || "Especialista"}</p>
              </div>

              {/* Modes of update */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-semibold">Tipo de Atualização</Label>
                <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setProgressUpdateMode("set")}
                    className={`py-2 rounded-lg text-xs font-bold transition-all/all ${
                      progressUpdateMode === "set"
                        ? "bg-primary text-black font-extrabold shadow-md"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Definir Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setProgressUpdateMode("add")}
                    className={`py-2 rounded-lg text-xs font-bold transition-all/all ${
                      progressUpdateMode === "add"
                        ? "bg-primary text-black font-extrabold shadow-md"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Somar Valor
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground italic px-1 pt-1 leading-snug">
                  {progressUpdateMode === "set" 
                    ? "Substitui o faturamento atual pelo novo valor digitado." 
                    : "Soma o novo valor digitado diretamente ao faturamento acumulado atualmente."}
                </p>
              </div>

              {/* Input */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Valor em Reais (R$)
                </Label>
                <Input
                  required
                  type="text"
                  value={manualProgressValue}
                  onChange={(e) => setManualProgressValue(e.target.value)}
                  className="bg-background border-white/10 rounded-xl font-mono text-zinc-100"
                  placeholder="Ex: 1250,50 ou 1250"
                  autoFocus
                />
              </div>

              <div className="mt-4 pt-2 border-t border-white/5 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProgressDialogOpen(false)}
                  className="flex-1 text-xs h-11 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary text-black font-bold text-xs h-11 rounded-xl shadow-md hover:bg-yellow-450"
                >
                  Gravar Progresso
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for setting professional goals */}
      <Dialog
        open={isProfGoalDialogOpen}
        onOpenChange={(open) => {
          setIsProfGoalDialogOpen(open);
          if (!open) {
            setSelectedProf(null);
            setProfGoalTargetAmount("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] bg-card border border-white/15 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Meta de Faturamento Contratual
            </DialogTitle>
          </DialogHeader>
          {selectedProf && (
            <form onSubmit={handleSaveProfGoal} className="space-y-5 pt-3">
              <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider leading-none">
                  Profissional
                </p>
                <p className="text-sm font-bold text-white mt-1 border-b border-white/5 pb-1 select-none">{selectedProf.name}</p>
                <p className="text-xs text-primary font-medium mt-1 leading-relaxed select-none">{selectedProf.role}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">
                  Mês de Referência
                </Label>
                <Input
                  disabled
                  value={selectedMonth}
                  className="bg-white/5 border-white/10 text-xs text-muted-foreground rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">
                  Meta de Faturamento (R$)
                </Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={profGoalTargetAmount}
                  onChange={(e) => setProfGoalTargetAmount(e.target.value)}
                  className="bg-background border-white/10 rounded-xl"
                  placeholder="Ex: 8500"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-gold-400 text-black font-semibold h-11 rounded-xl transition-all shadow-md mt-2"
              >
                Salvar Meta de Equipe
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function GoalsPage() {
  const { salonData } = useAuth();
  
  // Tabs state
  const [activeTab, setActiveTab] = useState<"salon" | "professionals">("salon");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );

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
        toast.success("Meta do salão atualizada com sucesso!");
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/goals`));
        await setDoc(ref, {
          id: ref.id,
          ...payload,
          createdAt: Date.now(),
        });
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
      const payload = {
        id: docId,
        professionalId: selectedProf.id,
        professionalName: selectedProf.name,
        month: selectedMonth,
        targetAmount: target,
        updatedAt: Date.now(),
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
          100
        )
      : 0;

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
          {/* Header Filtering & Global Target Cumulative Panel */}
          <Card className="border border-white/10 bg-card/65 rounded-2xl shadow-md p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Indicador Mensal</p>
                <p className="text-xs text-muted-foreground">
                  Selecione o mês para visualizar o faturamento consolidado da equipe.
                </p>
              </div>

              {/* Month filter trigger */}
              <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10 max-w-[200px]">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none text-xs text-foreground focus:outline-none font-medium text-white cursor-pointer w-full"
                />
              </div>
            </div>

            {/* Consolidate Analytics Row */}
            {totalDefinedProfGoals > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/5">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Metas Definidas
                  </p>
                  <p className="text-base font-semibold text-primary">
                    {totalGoalsCount} de {professionals.length} pros
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Total das Metas
                  </p>
                  <p className="text-base font-semibold text-foreground">
                    {formatBRL(totalDefinedProfGoals)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Faturado Equipe
                  </p>
                  <p className="text-base font-semibold text-green-400">
                    {formatBRL(totalCompletedProfRevenue)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Progresso Geral
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-sm font-bold text-white">
                      {totalCompletedPct}%
                    </span>
                    <Progress value={totalCompletedPct} className="h-1.5 w-16 bg-white/10" />
                  </div>
                </div>
              </div>
            )}
          </Card>

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
            <div className="grid gap-4 md:grid-cols-2">
              {professionals.map((p) => {
                const currentAmount = calculateRevenue(p.id);
                const goalObj = professionalGoals.find(
                  (g) => g.professionalId === p.id && g.month === selectedMonth
                );
                const targetAmount = goalObj ? goalObj.targetAmount : 0;
                
                const pct = targetAmount > 0 ? Math.min(Math.round((currentAmount / targetAmount) * 100), 100) : 0;
                const remaining = Math.max(targetAmount - currentAmount, 0);

                return (
                  <Card key={p.id} className="border-white/10 bg-card/40 rounded-2xl shadow-md overflow-hidden relative group">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center select-none text-primary font-bold">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{p.name}</p>
                          <p className="text-[10px] font-medium text-primary mt-0.5 uppercase tracking-wide">
                            {p.role || "Especialista"}
                          </p>
                        </div>
                      </div>

                      {/* Goal Edit Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openProfGoalEdit(p, targetAmount)}
                        className="h-8 w-8 hover:bg-white/10 text-muted-foreground hover:text-primary transition-all rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Revenue Detail Tracker */}
                      <div className="flex justify-between items-end border-t border-white/5 pt-3.5">
                        <div className="space-y-0.5">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">
                            Faturado no mês
                          </p>
                          <p className="text-xl font-medium text-white">
                            {formatBRL(currentAmount)}
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">
                            Meta faturamento
                          </p>
                          <p className="text-sm font-semibold text-muted-foreground">
                            {targetAmount > 0 ? formatBRL(targetAmount) : "Não definida"}
                          </p>
                        </div>
                      </div>

                      {/* Goal Progress Representation */}
                      {targetAmount > 0 ? (
                        <div className="space-y-2 pt-1 border-t border-white/5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-primary">{pct}% da meta</span>
                            {remaining > 0 ? (
                              <span className="text-muted-foreground font-light text-[11px]">
                                Falta {formatBRL(remaining)}
                              </span>
                            ) : (
                              <span className="text-green-400 font-bold text-[11px] flex items-center">
                                <Award className="w-3.5 h-3.5 mr-1" /> Meta Batida!
                              </span>
                            )}
                          </div>
                          <Progress value={pct} className="h-2 bg-white/5" />
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-white/5 text-center">
                          <Button
                            variant="outline"
                            onClick={() => openProfGoalEdit(p, 0)}
                            className="w-full border-dashed border-white/15 hover:border-primary/45 hover:bg-primary/5 text-xs h-9 font-semibold rounded-xl text-muted-foreground hover:text-primary transition-all"
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
        </div>
      )}

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
              Meta de Faturamento
            </DialogTitle>
          </DialogHeader>
          {selectedProf && (
            <form onSubmit={handleSaveProfGoal} className="space-y-5 pt-3">
              <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">
                  Profissional
                </p>
                <p className="text-sm font-bold text-white">{selectedProf.name}</p>
                <p className="text-xs text-primary font-medium mt-0.5">{selectedProf.role}</p>
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
                  Meta de Inaturamento (R$)
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
                className="w-full bg-primary hover:bg-gold-400 text-black font-semibold h-11 rounded-xl transition-all shadow-md"
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

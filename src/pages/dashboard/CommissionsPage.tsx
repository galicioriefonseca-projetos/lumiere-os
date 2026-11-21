import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
} from "firebase/firestore";
import {
  Appointment,
  CommissionAdjustment,
  CommissionPayout,
  Professional,
  ProfessionalGoal,
  Service,
} from "../../types";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Loader2,
  Percent,
  PiggyBank,
  Plus,
  Printer,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatBRL } from "@/lib/utils";
import { canEditCommissionRules } from "../../lib/permissions";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calculateCommission } from "../../lib/commissions";
import { applyXPGain } from "../../lib/gamification";
import { payCommissionsBatchApi } from "@/services/operationsService";
import * as XLSX from "xlsx";

type CommissionsTab = "payable" | "history";

function monthToDateRange(ym: string): { start: string; end: string } {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr) || new Date().getFullYear();
  const m = Number(mStr) || new Date().getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default function CommissionsPage() {
  const { salonData, userData } = useAuth();
  const salonId = salonData?.id || "";

  const [activeTab, setActiveTab] = useState<CommissionsTab>("payable");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionalGoals, setProfessionalGoals] = useState<ProfessionalGoal[]>([]);
  const [adjustments, setAdjustments] = useState<CommissionAdjustment[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [loading, setLoading] = useState(true);

  const initialMonth = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [startDate, setStartDate] = useState(() => monthToDateRange(initialMonth).start);
  const [endDate, setEndDate] = useState(() => monthToDateRange(initialMonth).end);
  const [selectedProfId, setSelectedProfId] = useState<string>("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  // Selection for batch payout
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<Set<string>>(new Set());
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("Pix");
  const [payoutDate, setPayoutDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [payoutCashRegister, setPayoutCashRegister] = useState("Caixa Principal");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payingBatch, setPayingBatch] = useState(false);

  // Adjustment (Bonus/Discount) Modal
  const [adjustmentProf, setAdjustmentProf] = useState<Professional | null>(null);
  const [adjType, setAdjType] = useState<"bonus" | "discount">("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjDescription, setAdjDescription] = useState("");
  const [adjDate, setAdjDate] = useState(() => new Date().toISOString().substring(0, 10));

  // Rate Adjust & Extrato Modals
  const [adjustingProf, setAdjustingProf] = useState<Professional | null>(null);
  const [newCommissionRate, setNewCommissionRate] = useState<number>(50);
  const [selectedExtratoProf, setSelectedExtratoProf] = useState<Professional | null>(null);

  // Quick Production Launch Modal
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [launchProfessional, setLaunchProfessional] = useState<Professional | null>(null);
  const [launchValue, setLaunchValue] = useState("");
  const [launchMode, setLaunchMode] = useState<"set" | "add">("set");
  const [launchMonth, setLaunchMonth] = useState(initialMonth);

  const isOwnerOrManager =
    userData?.role === "owner" ||
    userData?.role === "manager" ||
    userData?.role === "platform_admin";

  const handleMonthSelect = (ym: string) => {
    setSelectedMonth(ym);
    const bounds = monthToDateRange(ym);
    setStartDate(bounds.start);
    setEndDate(bounds.end);
    setSelectedPayoutIds(new Set());
  };

  useEffect(() => {
    if (!salonId) return;
    setLoading(true);
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, `salons/${salonId}/appointments`)),
        (snap) => {
          const arr: Appointment[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Appointment));
          setAppointments(arr.filter((a) => a.status === "completed"));
          setLoading(false);
        },
        (err) => {
          console.error("Erro ao carregar lançamentos para comissões:", err);
          setLoading(false);
        }
      )
    );

    unsubs.push(
      onSnapshot(query(collection(db, `salons/${salonId}/professionals`)), (snap) => {
        const arr: Professional[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Professional));
        setProfessionals(arr);
      })
    );

    unsubs.push(
      onSnapshot(query(collection(db, `salons/${salonId}/services`)), (snap) => {
        const arr: Service[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Service));
        setServices(arr);
      })
    );

    unsubs.push(
      onSnapshot(query(collection(db, `salons/${salonId}/professionalGoals`)), (snap) => {
        const arr: ProfessionalGoal[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as ProfessionalGoal));
        setProfessionalGoals(arr);
      })
    );

    unsubs.push(
      onSnapshot(query(collection(db, `salons/${salonId}/commissionAdjustments`)), (snap) => {
        const arr: CommissionAdjustment[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as CommissionAdjustment));
        setAdjustments(arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      })
    );

    unsubs.push(
      onSnapshot(query(collection(db, `salons/${salonId}/commissionPayouts`)), (snap) => {
        const arr: CommissionPayout[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as CommissionPayout));
        setPayouts(arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [salonId]);

  const availableMonths = useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = -5; i <= 1; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      months.push({
        value: `${y}-${m}`,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      });
    }
    return months;
  }, []);

  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    professionals.forEach((p) => {
      if (p.role) set.add(p.role);
    });
    return Array.from(set).sort();
  }, [professionals]);

  const getApptPrice = (app: Appointment) => {
    if (app.price !== undefined) return app.price;
    const match = services.find((s) => s.id === app.serviceId);
    return match ? match.price : 0;
  };

  const getPropCommissionRate = (prof: Professional) =>
    prof.commissionRate !== undefined ? prof.commissionRate : 50;

  const isInDateRange = (dateStr: string) => {
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      const inRange = isInDateRange(app.date);
      const matchesProf = selectedProfId === "all" || app.professionalId === selectedProfId;
      return inRange && matchesProf;
    });
  }, [appointments, startDate, endDate, selectedProfId]);

  const professionalsReport = useMemo(() => {
    const list: Professional[] = [];

    professionals.forEach((p) => {
      const isActive = p.isActive !== false;
      const hasSalesInRange = appointments.some(
        (app) => app.professionalId === p.id && isInDateRange(app.date)
      );
      const hasGoalInMonth = professionalGoals.some(
        (g) => g.professionalId === p.id && g.month === selectedMonth
      );
      const hasAdjInRange = adjustments.some(
        (adj) => adj.professionalId === p.id && isInDateRange(adj.date)
      );
      if (isActive || hasSalesInRange || hasGoalInMonth || hasAdjInRange) {
        list.push({ ...p });
      }
    });

    appointments.forEach((app) => {
      if (app.professionalId && isInDateRange(app.date)) {
        if (!list.some((p) => p.id === app.professionalId)) {
          list.push({
            id: app.professionalId,
            name: app.professionalName || "Profissional",
            role: "Especialista",
            phone: "",
            isActive: false,
            commissionRate: 50,
            specialties: [],
            createdAt: 0,
            updatedAt: 0,
          });
        }
      }
    });

    let filteredList = isOwnerOrManager
      ? list
      : list.filter((p) => userData?.professionalId && p.id === userData.professionalId);

    if (selectedProfId !== "all") {
      filteredList = filteredList.filter((p) => p.id === selectedProfId);
    }

    if (selectedRoleFilter !== "all") {
      filteredList = filteredList.filter((p) => p.role === selectedRoleFilter);
    }

    return filteredList
      .map((prof) => {
        const profAppts = appointments.filter(
          (app) => app.professionalId === prof.id && isInDateRange(app.date)
        );

        const monthBounds = monthToDateRange(selectedMonth);
        const isExactMonth =
          startDate === monthBounds.start && endDate === monthBounds.end;
        const profGoal = isExactMonth
          ? professionalGoals.find(
              (g) => g.professionalId === prof.id && g.month === selectedMonth
            ) || null
          : null;

        const summary = calculateCommission(
          prof,
          profAppts,
          profGoal,
          services
        );

        const profAdjs = adjustments.filter(
          (a) => a.professionalId === prof.id && isInDateRange(a.date)
        );
        const bonusesTotal = profAdjs
          .filter((a) => a.type === "bonus")
          .reduce((s, a) => s + Number(a.amount || 0), 0);
        const discountsTotal = profAdjs
          .filter((a) => a.type === "discount")
          .reduce((s, a) => s + Number(a.amount || 0), 0);

        const paidTotal = payouts.reduce((sum, payout) => {
          const item = (payout.items || []).find((i) => i.professionalId === prof.id);
          if (!item) return sum;
          const overlaps =
            (!startDate || payout.periodEnd >= startDate) &&
            (!endDate || payout.periodStart <= endDate);
          return overlaps ? sum + Number(item.netAmount || 0) : sum;
        }, 0);

        const netCommissionTotal = Math.max(
          0,
          summary.commissionValue + bonusesTotal - discountsTotal
        );
        const remainingPayable = Math.max(0, netCommissionTotal - paidTotal);

        return {
          ...prof,
          totalRevenue: summary.totalProduction,
          baseCommission: summary.commissionValue,
          bonusesTotal,
          discountsTotal,
          paidTotal,
          totalCommission: netCommissionTotal,
          remainingPayable,
          netEstablishment: summary.totalProduction - netCommissionTotal,
          salesCount: profAppts.length,
          componentSummary: summary,
          profAdjustments: profAdjs,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [
    professionals,
    appointments,
    professionalGoals,
    adjustments,
    payouts,
    services,
    startDate,
    endDate,
    selectedMonth,
    selectedProfId,
    selectedRoleFilter,
    isOwnerOrManager,
    userData?.professionalId,
  ]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCommission = 0;
    let totalRemainingToPay = 0;
    let totalBonuses = 0;
    let totalDiscounts = 0;

    professionalsReport.forEach((p) => {
      totalRevenue += p.totalRevenue;
      totalCommission += p.totalCommission;
      totalRemainingToPay += p.remainingPayable;
      totalBonuses += p.bonusesTotal;
      totalDiscounts += p.discountsTotal;
    });

    const totalNetEstablishment = totalRevenue - totalCommission;
    const ticketsCount = filteredAppointments.length;
    const avgTicket = ticketsCount > 0 ? totalRevenue / ticketsCount : 0;

    return {
      totalRevenue,
      totalCommission,
      totalRemainingToPay,
      totalBonuses,
      totalDiscounts,
      totalNetEstablishment,
      ticketsCount,
      avgTicket,
    };
  }, [professionalsReport, filteredAppointments]);

  const selectedPayoutRows = useMemo(
    () => professionalsReport.filter((p) => selectedPayoutIds.has(p.id) && p.remainingPayable > 0),
    [professionalsReport, selectedPayoutIds]
  );

  const selectedPayoutTotal = useMemo(
    () => selectedPayoutRows.reduce((sum, p) => sum + p.remainingPayable, 0),
    [selectedPayoutRows]
  );

  const toggleSelectProf = (id: string) => {
    setSelectedPayoutIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPayable = () => {
    const payablePros = professionalsReport.filter((p) => p.remainingPayable > 0);
    const allSelected =
      payablePros.length > 0 && payablePros.every((p) => selectedPayoutIds.has(p.id));
    if (allSelected) {
      setSelectedPayoutIds(new Set());
    } else {
      setSelectedPayoutIds(new Set(payablePros.map((p) => p.id)));
    }
  };

  const handleConfirmBatchPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || selectedPayoutRows.length === 0) return;

    setPayingBatch(true);
    try {
      const combinedNotes = [
        payoutDate ? `Data pagto: ${new Date(`${payoutDate}T12:00:00`).toLocaleDateString("pt-BR")}` : "",
        payoutNotes.trim(),
      ]
        .filter(Boolean)
        .join(" · ");

      await payCommissionsBatchApi({
        salonId,
        periodStart: startDate || `${selectedMonth}-01`,
        periodEnd: endDate || `${selectedMonth}-31`,
        paymentMethod: payoutMethod,
        cashRegisterName: payoutCashRegister,
        notes: combinedNotes || undefined,
        items: selectedPayoutRows.map((row) => ({
          professionalId: row.id,
          professionalName: row.name,
          role: row.role || "Especialista",
          rateioAmount: Number(row.baseCommission.toFixed(2)),
          bonusAmount: Number(row.bonusesTotal.toFixed(2)),
          discountAmount: Number(row.discountsTotal.toFixed(2)),
          netAmount: Number(row.remainingPayable.toFixed(2)),
          adjustmentsAppliedIds: row.profAdjustments
            .filter((a) => a.status !== "settled")
            .map((a) => a.id),
        })),
      });

      toast.success(
        `Repasse de ${formatBRL(selectedPayoutTotal)} pago para ${selectedPayoutRows.length} profissional(is) e lançado no Financeiro!`
      );
      setIsPayoutModalOpen(false);
      setSelectedPayoutIds(new Set());
      setPayoutNotes("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar pagamento de comissões.";
      toast.error(msg);
    } finally {
      setPayingBatch(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || !adjustmentProf) return;

    const val = parseFloat(adjAmount.replace(",", "."));
    if (isNaN(val) || val <= 0 || !adjDescription.trim()) {
      toast.error("Informe um valor positivo e o motivo do lançamento.");
      return;
    }

    try {
      const ref = doc(collection(db, `salons/${salonId}/commissionAdjustments`));
      const payload: CommissionAdjustment = {
        id: ref.id,
        professionalId: adjustmentProf.id,
        professionalName: adjustmentProf.name,
        type: adjType,
        amount: Number(val.toFixed(2)),
        description: adjDescription.trim(),
        date: adjDate,
        month: adjDate.substring(0, 7),
        status: "pending",
        createdByName: userData?.fullName || userData?.email || "Gestor",
        createdAt: Date.now(),
      };
      await setDoc(ref, payload);
      toast.success(
        `${adjType === "bonus" ? "Bônus" : "Desconto"} de ${formatBRL(val)} registrado para ${adjustmentProf.name}!`
      );
      setAdjustmentProf(null);
      setAdjAmount("");
      setAdjDescription("");
    } catch {
      toast.error("Erro ao salvar bônus/desconto.");
    }
  };

  const handleDeleteAdjustment = async (adjId: string) => {
    if (!salonId || !isOwnerOrManager) return;
    try {
      await deleteDoc(doc(db, `salons/${salonId}/commissionAdjustments`, adjId));
      toast.success("Ajuste removido.");
    } catch {
      toast.error("Erro ao remover ajuste.");
    }
  };

  const handleConfirmLaunchProduction = async () => {
    if (!salonId || !launchProfessional) return;
    const value = parseFloat(launchValue.replace(",", "."));
    if (isNaN(value) || value < 0) {
      toast.error("Por favor, insira um valor numérico válido.");
      return;
    }

    try {
      const docId = `${launchProfessional.id}_${launchMonth}`;
      const existingGoal = professionalGoals.find(
        (g) => g.professionalId === launchProfessional.id && g.month === launchMonth
      );
      const currentManualVal = existingGoal?.currentValue ?? 0;
      const newValue = launchMode === "add" ? currentManualVal + value : value;

      const payload: Record<string, unknown> = {
        id: docId,
        professionalId: launchProfessional.id,
        professionalName: launchProfessional.name,
        month: launchMonth,
        currentValue: newValue,
        lastProgressUpdateAt: Date.now(),
        lastProgressUpdatedBy: userData?.fullName || userData?.email || "Manager",
        updatedAt: Date.now(),
      };

      const targetAmount = existingGoal?.targetAmount ?? 0;
      if (targetAmount > 0 && newValue >= targetAmount && !existingGoal?.goalXPAwardedAt) {
        payload.goalXPAwardedAt = Date.now();
        try {
          await applyXPGain(salonId, launchProfessional.id, "MONTHLY_GOAL_HIT", undefined, {
            fullName: launchProfessional.name || "Colaborador",
            role: launchProfessional.role || "professional",
            reason: "Meta faturamento mensal batida",
          });
          toast.success(`${launchProfessional.name} bateu a meta! +500 XP`);
        } catch {
          // Non-blocking XP error
        }
      }

      await setDoc(doc(db, `salons/${salonId}/professionalGoals`, docId), payload, {
        merge: true,
      });

      toast.success(`Produção de ${launchProfessional.name} atualizada para ${formatBRL(newValue)}!`);
      setIsLaunchModalOpen(false);
      setLaunchValue("");
      setLaunchProfessional(null);
    } catch {
      toast.error("Erro ao salvar faturamento manual.");
    }
  };

  const handleSaveCommissionRate = async () => {
    if (!salonId || !adjustingProf) return;
    if (!canEditCommissionRules(userData?.role)) {
      toast.error("Você não tem permissão para alterar a taxa de comissão.");
      return;
    }

    try {
      await setDoc(
        doc(db, `salons/${salonId}/professionals`, adjustingProf.id),
        { commissionRate: newCommissionRate, updatedAt: Date.now() },
        { merge: true }
      );
      toast.success(`Taxa de ${adjustingProf.name} atualizada para ${newCommissionRate}%!`);
      setAdjustingProf(null);
    } catch {
      toast.error("Erro ao atualizar taxa de comissão.");
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = professionalsReport.map((p) => ({
        Profissional: p.name,
        Cargo: p.role || "Especialista",
        Atendimentos: p.salesCount,
        "Taxa (%)": getPropCommissionRate(p),
        "Produção Bruta (R$)": p.totalRevenue,
        "Comissão Base (R$)": p.baseCommission,
        "Bônus (+)": p.bonusesTotal,
        "Descontos (-)": p.discountsTotal,
        "Já Pago (R$)": p.paidTotal,
        "Saldo a Pagar (R$)": p.remainingPayable,
        "Retido Salão (R$)": p.netEstablishment,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Comissoes");
      XLSX.writeFile(wb, `comissoes-lumiere-${startDate}-a-${endDate}.xlsx`);
      toast.success("Planilha de comissões exportada!");
    } catch {
      toast.error("Erro ao exportar Excel.");
    }
  };

  const chartData = useMemo(
    () =>
      professionalsReport
        .filter((p) => p.totalRevenue > 0)
        .map((p) => ({
          name: p.name.split(" ")[0],
          "Produção Bruta": p.totalRevenue,
          "Repasse Líquido": p.totalCommission,
          "Saldo Salão": p.netEstablishment,
        })),
    [professionalsReport]
  );

  const extratoItems = useMemo(() => {
    if (!selectedExtratoProf) return [];
    return appointments
      .filter(
        (app) => app.professionalId === selectedExtratoProf.id && isInDateRange(app.date)
      )
      .sort(
        (a, b) =>
          new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime()
      );
  }, [selectedExtratoProf, appointments, startDate, endDate]);

  const extratoAdjustments = useMemo(() => {
    if (!selectedExtratoProf) return [];
    return adjustments.filter(
      (adj) => adj.professionalId === selectedExtratoProf.id && isInDateRange(adj.date)
    );
  }, [selectedExtratoProf, adjustments, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-[#6B6B6B] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#8A6D36]" />
        <p className="text-xs font-medium">Carregando comissões e repasses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header & Controls */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-[#171717] flex items-center gap-2">
              <Percent className="w-5 h-5 text-[#8A6D36]" />
              Comissões, Bônus & Repasses
            </h2>
            <p className="text-[#6B6B6B] text-xs mt-1">
              Calcule repasses por período personalizado, aplique bônus ou vales e quite pagamentos em lote direto para o Financeiro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="h-9 px-3.5 border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] rounded-xl text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#6B6B6B]" /> Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportExcel}
              className="h-9 px-3.5 border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] rounded-xl text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Exportar Excel
            </Button>
          </div>
        </div>

        {/* Navigation Tabs + Filters */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-t border-[#E5E2DC] pt-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("payable")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                activeTab === "payable"
                  ? "bg-[#171717] text-white"
                  : "bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]"
              )}
            >
              <Wallet className="w-3.5 h-3.5" /> Comissões a Pagar
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                activeTab === "history"
                  ? "bg-[#171717] text-white"
                  : "bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]"
              )}
            >
              <History className="w-3.5 h-3.5" /> Histórico de Pagamentos ({payouts.length})
            </button>
          </div>

          {activeTab === "payable" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl px-2.5 h-9">
                <Calendar className="w-3.5 h-3.5 text-[#8A6D36]" />
                <Select value={selectedMonth} onValueChange={handleMonthSelect}>
                  <SelectTrigger className="bg-transparent border-0 h-auto p-0 focus:ring-0 text-[#171717] font-semibold text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E5E2DC]">
                    {availableMonths.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-34 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl tabular-nums"
              />
              <span className="text-[#6B6B6B]">até</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-34 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl tabular-nums"
              />

              {availableRoles.length > 0 && (
                <Select value={selectedRoleFilter} onValueChange={setSelectedRoleFilter}>
                  <SelectTrigger className="h-9 w-36 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl">
                    <SelectValue placeholder="Todos os Cargos" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E5E2DC]">
                    <SelectItem value="all">Todos os Cargos</SelectItem>
                    {availableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={selectedProfId} onValueChange={setSelectedProfId}>
                <SelectTrigger className="h-9 w-44 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E5E2DC]">
                  <SelectItem value="all">Todos os Colaboradores</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: COMISSÕES A PAGAR */}
      {activeTab === "payable" && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E2DC] shadow-xs rounded-2xl p-5">
              <span className="text-[11px] font-bold uppercase text-[#6B6B6B] tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#8A6D36]" /> Produção Bruta
              </span>
              <h3 className="text-2xl font-bold text-[#171717] mt-1.5 tabular-nums">
                {formatBRL(stats.totalRevenue)}
              </h3>
              <p className="text-[11px] text-[#6B6B6B] mt-1 tabular-nums">
                {stats.ticketsCount} atendimentos · Ticket médio {formatBRL(stats.avgTicket)}
              </p>
            </div>

            <div className="bg-white border border-[#E5E2DC] shadow-xs rounded-2xl p-5">
              <span className="text-[11px] font-bold uppercase text-[#6B6B6B] tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-rose-600" /> Comissão Líquida Equipe
              </span>
              <h3 className="text-2xl font-bold text-rose-600 mt-1.5 tabular-nums">
                {formatBRL(stats.totalCommission)}
              </h3>
              <p className="text-[11px] text-[#6B6B6B] mt-1 tabular-nums">
                Bônus: +{formatBRL(stats.totalBonuses)} · Desc.: -{formatBRL(stats.totalDiscounts)}
              </p>
            </div>

            <div className="bg-white border border-[#E5E2DC] shadow-xs rounded-2xl p-5">
              <span className="text-[11px] font-bold uppercase text-[#6B6B6B] tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-700" /> Saldo Pendente de Pagamento
              </span>
              <h3 className="text-2xl font-bold text-amber-700 mt-1.5 tabular-nums">
                {formatBRL(stats.totalRemainingToPay)}
              </h3>
              <p className="text-[11px] text-[#6B6B6B] mt-1">
                Aberto para acerto no período
              </p>
            </div>

            <div className="bg-[#FAF9F7] border border-[#B89B5E]/40 shadow-xs rounded-2xl p-5">
              <span className="text-[11px] font-bold uppercase text-[#8A6D36] tracking-wider flex items-center gap-1.5">
                <PiggyBank className="w-3.5 h-3.5" /> Retido no Caixa (Salão)
              </span>
              <h3 className="text-2xl font-bold text-[#171717] mt-1.5 tabular-nums">
                {formatBRL(stats.totalNetEstablishment)}
              </h3>
              <p className="text-[11px] text-[#6B6B6B] mt-1">
                Parcela do estabelecimento
              </p>
            </div>
          </div>

          {/* Selected Professionals Payout Bar */}
          {isOwnerOrManager && selectedPayoutRows.length > 0 && (
            <div className="bg-[#171717] text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0" />
                <div>
                  <p className="text-xs font-bold">
                    {selectedPayoutRows.length}{" "}
                    {selectedPayoutRows.length === 1
                      ? "profissional selecionado"
                      : "profissionais selecionados"}{" "}
                    para fechamento
                  </p>
                  <p className="text-[11px] text-white/75 tabular-nums">
                    Total líquido a pagar:{" "}
                    <strong className="text-[#D4AF37]">{formatBRL(selectedPayoutTotal)}</strong>
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setIsPayoutModalOpen(true)}
                className="bg-[#B89B5E] hover:bg-[#9E8248] text-[#171717] font-bold text-xs h-9 px-4 rounded-xl whitespace-nowrap"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1" /> Pagar Profissionais Selecionados
              </Button>
            </div>
          )}

          {/* Table + Chart */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white border border-[#E5E2DC] shadow-xs rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-[#E5E2DC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#171717] font-heading">
                    Repartição de Comissões por Profissional
                  </h3>
                  <p className="text-xs text-[#6B6B6B]">
                    Marque os profissionais para pagar em lote ou lance bônus e descontos individuais.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[820px]">
                  <thead className="bg-[#FAF9F7] text-[#6B6B6B] border-b border-[#E5E2DC] font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      {isOwnerOrManager && (
                        <th className="p-3.5 pl-4 w-9">
                          <input
                            type="checkbox"
                            onChange={toggleSelectAllPayable}
                            checked={
                              professionalsReport.some((p) => p.remainingPayable > 0) &&
                              professionalsReport
                                .filter((p) => p.remainingPayable > 0)
                                .every((p) => selectedPayoutIds.has(p.id))
                            }
                            className="rounded border-[#D1CCC2] cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="p-3.5">Profissional</th>
                      <th className="p-3.5 text-center">Taxa</th>
                      <th className="p-3.5 text-right">Bruto</th>
                      <th className="p-3.5 text-right">Bônus / Desc.</th>
                      <th className="p-3.5 text-right">Já Pago</th>
                      <th className="p-3.5 text-right">A Pagar</th>
                      <th className="p-3.5 text-right pr-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC]">
                    {professionalsReport.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-xs text-[#6B6B6B]">
                          Nenhum profissional com produção ou cadastro ativo encontrado.
                        </td>
                      </tr>
                    ) : (
                      professionalsReport.map((p) => {
                        const rate = getPropCommissionRate(p);
                        const isPayable = p.remainingPayable > 0;
                        return (
                          <tr key={p.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                            {isOwnerOrManager && (
                              <td className="p-3.5 pl-4">
                                <input
                                  type="checkbox"
                                  disabled={!isPayable}
                                  checked={selectedPayoutIds.has(p.id)}
                                  onChange={() => toggleSelectProf(p.id)}
                                  className="rounded border-[#D1CCC2] cursor-pointer disabled:opacity-30"
                                />
                              </td>
                            )}
                            <td className="p-3.5">
                              <div className="font-semibold text-[#171717]">{p.name}</div>
                              <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                                {p.role || "Especialista"} · {p.salesCount} atend.
                              </div>
                            </td>
                            <td className="p-3.5 text-center tabular-nums">
                              <span className="font-bold text-[#8A6D36]">{rate}%</span>
                            </td>
                            <td className="p-3.5 text-right font-semibold text-[#171717] tabular-nums">
                              {formatBRL(p.totalRevenue)}
                            </td>
                            <td className="p-3.5 text-right tabular-nums text-[11px]">
                              {p.bonusesTotal > 0 || p.discountsTotal > 0 ? (
                                <div className="space-y-0.5">
                                  {p.bonusesTotal > 0 && (
                                    <span className="text-emerald-700 font-semibold block">
                                      +{formatBRL(p.bonusesTotal)}
                                    </span>
                                  )}
                                  {p.discountsTotal > 0 && (
                                    <span className="text-rose-600 font-semibold block">
                                      -{formatBRL(p.discountsTotal)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#6B6B6B]">—</span>
                              )}
                            </td>
                            <td className="p-3.5 text-right text-emerald-700 font-medium tabular-nums">
                              {formatBRL(p.paidTotal)}
                            </td>
                            <td className="p-3.5 text-right font-bold tabular-nums">
                              <span
                                className={
                                  p.remainingPayable > 0 ? "text-rose-600" : "text-emerald-700"
                                }
                              >
                                {formatBRL(p.remainingPayable)}
                              </span>
                            </td>
                            <td className="p-3.5 pr-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                {isOwnerOrManager && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setAdjustmentProf(p);
                                        setAdjType("bonus");
                                        setAdjAmount("");
                                        setAdjDescription("");
                                      }}
                                      className="h-7 px-2 border-[#E5E2DC] bg-white text-[10px] font-semibold rounded-lg whitespace-nowrap"
                                      title="Lançar bônus ou desconto"
                                    >
                                      + Bônus/Desc.
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setLaunchProfessional(p);
                                        setLaunchMonth(selectedMonth);
                                        setLaunchValue("");
                                        setIsLaunchModalOpen(true);
                                      }}
                                      className="h-7 px-2 text-[#6B6B6B] hover:text-[#171717] text-[10px]"
                                    >
                                      Lançar
                                    </Button>
                                  </>
                                )}
                                {canEditCommissionRules(userData?.role) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setAdjustingProf(p);
                                      setNewCommissionRate(getPropCommissionRate(p));
                                    }}
                                    className="h-7 w-7 text-[#6B6B6B] hover:text-[#8A6D36]"
                                    title="Alterar taxa (%)"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedExtratoProf(p)}
                                  className="h-7 px-2 border-[#E5E2DC] bg-white text-[10px] font-semibold rounded-lg"
                                >
                                  Extrato
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white border border-[#E5E2DC] shadow-xs rounded-2xl p-5 flex flex-col">
              <h3 className="text-base font-bold text-[#171717] font-heading mb-1">
                Comparativo de Repasses
              </h3>
              <p className="text-xs text-[#6B6B6B] mb-4">
                Produção bruta versus comissão repassada e margem do salão.
              </p>
              <div className="h-[290px] w-full flex-1">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#6B6B6B]">
                    Sem dados suficientes para exibir o gráfico.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                      <XAxis dataKey="name" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v: number) => formatBRL(v)}
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderColor: "#E5E2DC",
                          borderRadius: "12px",
                          fontSize: "12px",
                          color: "#171717",
                        }}
                      />
                      <Bar dataKey="Produção Bruta" fill="#171717" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Repasse Líquido" fill="#B89B5E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTÓRICO DE PAGAMENTOS */}
      {activeTab === "history" && (
        <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#E5E2DC]">
            <h3 className="text-base font-bold text-[#171717]">
              Histórico de Pagamentos de Comissões ({payouts.length})
            </h3>
            <p className="text-xs text-[#6B6B6B]">
              Cada fechamento em lote gera um recibo auditável e registra a despesa correspondente no Financeiro.
            </p>
          </div>
          {payouts.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B6B6B]">
              Nenhum pagamento de comissão registrado até o momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[740px]">
                <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold text-[#6B6B6B]">
                  <tr>
                    <th className="p-3.5 pl-5">Data Pagto</th>
                    <th className="p-3.5">Período Apurado</th>
                    <th className="p-3.5">Profissionais Quitados</th>
                    <th className="p-3.5">Forma / Caixa</th>
                    <th className="p-3.5">Responsável</th>
                    <th className="p-3.5 pr-5 text-right">Total Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {payouts.map((po) => (
                    <tr key={po.id} className="hover:bg-[#FAF9F7]">
                      <td className="p-3.5 pl-5 font-medium text-[#171717] tabular-nums">
                        {new Date(po.paidAt || po.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3.5 text-[#6B6B6B] tabular-nums">
                        {po.periodStart} a {po.periodEnd}
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          {(po.items || []).map((i) => (
                            <div key={i.professionalId} className="text-[#171717] tabular-nums">
                              <strong>{i.professionalName}</strong>: {formatBRL(i.netAmount)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 text-[#6B6B6B]">
                        {po.paymentMethod} · {po.cashRegisterName || "Caixa Principal"}
                      </td>
                      <td className="p-3.5 text-[#6B6B6B]">{po.paidByName || "Gestão"}</td>
                      <td className="p-3.5 pr-5 text-right font-bold text-emerald-700 tabular-nums">
                        {formatBRL(po.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Batch Payout Settlement Modal */}
      <Dialog open={isPayoutModalOpen} onOpenChange={setIsPayoutModalOpen}>
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#8A6D36]" /> Confirmar Pagamento em Lote
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Esta ação quitará os repasses selecionados e lançará a despesa no fluxo de caixa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmBatchPayout} className="space-y-4 pt-2 text-xs">
            <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto">
              {selectedPayoutRows.map((row) => (
                <div key={row.id} className="flex justify-between tabular-nums">
                  <span className="font-medium text-[#171717]">{row.name}</span>
                  <span className="font-bold text-[#171717]">
                    {formatBRL(row.remainingPayable)}
                  </span>
                </div>
              ))}
              <div className="border-t border-[#E5E2DC] pt-1.5 flex justify-between font-bold text-sm">
                <span>Total Geral</span>
                <span className="text-emerald-700 tabular-nums">
                  {formatBRL(selectedPayoutTotal)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[#171717]">Data do Pagamento *</Label>
                <Input
                  type="date"
                  required
                  value={payoutDate}
                  onChange={(e) => setPayoutDate(e.target.value)}
                  className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[#171717]">Forma de Pagamento</Label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E5E2DC]">
                    <SelectItem value="Pix">Pix</SelectItem>
                    <SelectItem value="Transferência">Transferência Bancária</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro (Caixa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[#171717]">Caixa de Origem</Label>
              <Select value={payoutCashRegister} onValueChange={setPayoutCashRegister}>
                <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E5E2DC]">
                  <SelectItem value="Caixa Principal">Caixa Principal</SelectItem>
                  <SelectItem value="Conta Bancária">Conta Bancária</SelectItem>
                  <SelectItem value="Cofre">Cofre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[#171717]">Observações (Opcional)</Label>
              <Input
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="Ex: Repasse quinzenal..."
                className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPayoutModalOpen(false)}
                className="rounded-xl border-[#E5E2DC] text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={payingBatch}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs h-9 px-5"
              >
                {payingBatch ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Processando...
                  </>
                ) : (
                  "Confirmar e Pagar"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bonus / Discount Modal */}
      <Dialog
        open={Boolean(adjustmentProf)}
        onOpenChange={(open) => !open && setAdjustmentProf(null)}
      >
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-[#171717]">
              Bônus ou Desconto ({adjustmentProf?.name})
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Adicione bonificações, premiações de meta ou descontos (vales, taxas) na comissão do profissional.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAdjustment} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl">
              <button
                type="button"
                onClick={() => setAdjType("bonus")}
                className={cn(
                  "py-2 rounded-lg font-semibold cursor-pointer",
                  adjType === "bonus"
                    ? "bg-emerald-700 text-white"
                    : "text-[#6B6B6B]"
                )}
              >
                + Bônus / Prêmio
              </button>
              <button
                type="button"
                onClick={() => setAdjType("discount")}
                className={cn(
                  "py-2 rounded-lg font-semibold cursor-pointer",
                  adjType === "discount"
                    ? "bg-rose-600 text-white"
                    : "text-[#6B6B6B]"
                )}
              >
                - Desconto / Vale
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[#171717]">Valor (R$) *</Label>
                <Input
                  required
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="100,00"
                  className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[#171717]">Data *</Label>
                <Input
                  required
                  type="date"
                  value={adjDate}
                  onChange={(e) => setAdjDate(e.target.value)}
                  className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[#171717]">Descrição / Motivo *</Label>
              <Input
                required
                value={adjDescription}
                onChange={(e) => setAdjDescription(e.target.value)}
                placeholder="Ex: Prêmio meta semanal, Adiantamento / Vale"
                className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustmentProf(null)}
                className="rounded-xl border-[#E5E2DC] text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold rounded-xl text-xs h-9 px-5"
              >
                Salvar Lançamento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Production Launch Modal */}
      <Dialog
        open={isLaunchModalOpen}
        onOpenChange={(open) => !open && setIsLaunchModalOpen(false)}
      >
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#8A6D36]" /> Lançar Produção Manual
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Registre faturamento manual para {launchProfessional?.name}.
            </DialogDescription>
          </DialogHeader>

          {launchProfessional && (
            <div className="py-2 space-y-4 text-xs">
              <div className="space-y-1">
                <Label className="text-[#171717]">Valor de Produção (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={launchValue}
                  onChange={(e) => setLaunchValue(e.target.value)}
                  className="bg-[#FAF9F7] border-[#E5E2DC] h-9 rounded-xl tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLaunchMode("set")}
                  className={cn(
                    "px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer",
                    launchMode === "set"
                      ? "bg-[#171717] text-white border-[#171717]"
                      : "bg-[#FAF9F7] border-[#E5E2DC] text-[#6B6B6B]"
                  )}
                >
                  Substituir total
                </button>
                <button
                  type="button"
                  onClick={() => setLaunchMode("add")}
                  className={cn(
                    "px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer",
                    launchMode === "add"
                      ? "bg-[#171717] text-white border-[#171717]"
                      : "bg-[#FAF9F7] border-[#E5E2DC] text-[#6B6B6B]"
                  )}
                >
                  Somar ao atual
                </button>
              </div>

              <div className="space-y-1">
                <Label className="text-[#171717]">Mês de Referência</Label>
                <Select value={launchMonth} onValueChange={setLaunchMonth}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC] h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E5E2DC]">
                    {availableMonths.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsLaunchModalOpen(false)}
                  className="rounded-xl border-[#E5E2DC] text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmLaunchProduction}
                  className="bg-[#171717] hover:bg-[#2c2c2c] text-white rounded-xl font-semibold text-xs h-9 px-5"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Commission Rate Modal */}
      <Dialog
        open={!!adjustingProf}
        onOpenChange={(open) => !open && setAdjustingProf(null)}
      >
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#171717] text-lg flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#8A6D36]" /> Taxa de Comissão ({adjustingProf?.name})
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Defina o percentual de comissão padrão deste colaborador.
            </DialogDescription>
          </DialogHeader>

          {adjustingProf && (
            <div className="py-3 space-y-5">
              <div className="flex justify-between items-center bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E2DC]">
                <div>
                  <h4 className="text-sm font-bold text-[#171717]">{adjustingProf.name}</h4>
                  <p className="text-xs text-[#6B6B6B]">{adjustingProf.role || "Profissional"}</p>
                </div>
                <span className="text-2xl font-bold text-[#8A6D36] tabular-nums">
                  {newCommissionRate}%
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  value={newCommissionRate}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(e) => setNewCommissionRate(Number(e.target.value))}
                  className="w-full accent-[#B89B5E] cursor-pointer"
                />
                <div className="flex justify-between text-xs text-[#6B6B6B] tabular-nums">
                  <span>{newCommissionRate}% profissional</span>
                  <span>{100 - newCommissionRate}% salão</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAdjustingProf(null)}
                  className="rounded-xl border-[#E5E2DC] text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveCommissionRate}
                  className="bg-[#171717] hover:bg-[#2c2c2c] text-white rounded-xl font-semibold text-xs h-9 px-5"
                >
                  Salvar Taxa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extrato Detalhado Modal */}
      <Dialog
        open={!!selectedExtratoProf}
        onOpenChange={(open) => !open && setSelectedExtratoProf(null)}
      >
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#171717] text-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8A6D36]" /> Extrato Detalhado ({selectedExtratoProf?.name})
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Período: {startDate} a {endDate}
            </DialogDescription>
          </DialogHeader>

          {selectedExtratoProf && (
            <div className="space-y-4 pt-2 text-xs">
              {extratoAdjustments.length > 0 && (
                <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3 space-y-2">
                  <h4 className="font-bold text-[#171717]">Bônus & Descontos no Período</h4>
                  <div className="divide-y divide-[#E5E2DC]">
                    {extratoAdjustments.map((adj) => (
                      <div key={adj.id} className="py-1.5 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-[#171717]">{adj.description}</span>
                          <span className="text-[11px] text-[#6B6B6B] ml-2 tabular-nums">
                            {new Date(`${adj.date}T12:00:00`).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-bold tabular-nums",
                              adj.type === "bonus" ? "text-emerald-700" : "text-rose-600"
                            )}
                          >
                            {adj.type === "bonus" ? "+" : "-"}
                            {formatBRL(adj.amount)}
                          </span>
                          {isOwnerOrManager && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAdjustment(adj.id)}
                              className="text-[#6B6B6B] hover:text-rose-600 cursor-pointer"
                              title="Remover ajuste"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-[#E5E2DC] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-[#FAF9F7] text-[#6B6B6B] border-b border-[#E5E2DC] font-semibold">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Serviço/Produto</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC]">
                    {extratoItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[#6B6B6B]">
                          Nenhum atendimento concluído neste período.
                        </td>
                      </tr>
                    ) : (
                      extratoItems.map((item) => {
                        const price = getApptPrice(item);
                        const rate = getPropCommissionRate(selectedExtratoProf);
                        const comm = price * (rate / 100);
                        return (
                          <tr key={item.id} className="hover:bg-[#FAF9F7]">
                            <td className="p-3 text-[#6B6B6B] tabular-nums whitespace-nowrap">
                              {new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="p-3 font-medium text-[#171717]">
                              {item.clientName || "Consumidor Final"}
                            </td>
                            <td className="p-3 text-[#171717]">{item.serviceName}</td>
                            <td className="p-3 text-right font-medium tabular-nums">
                              {formatBRL(price)}
                            </td>
                            <td className="p-3 text-right font-bold text-[#8A6D36] tabular-nums">
                              {formatBRL(comm)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

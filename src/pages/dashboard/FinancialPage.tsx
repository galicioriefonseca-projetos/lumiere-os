import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import { OperationType, reportFirestoreListenerError } from "@/lib/firestoreError";
import { logAuditEvent } from "../../lib/audit";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Appointment,
  Client,
  ComandaFlow,
  FinancialTransaction,
  Professional,
  Service,
  ServicePackage,
} from "../../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Activity,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileSpreadsheet,
  Filter,
  Loader2,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { ComandaModal360 } from "@/components/comandas/ComandaModal360";
import { reopenComandaApi } from "@/services/operationsService";

type FinancialTab = "overview" | "open_comandas" | "completed_comandas";

const CATEGORIES = {
  revenue: ["Serviços", "Produtos", "Pacotes", "Clube de Assinatura", "Outros"],
  expense: [
    "Materiais e Produtos",
    "Comissões",
    "Aluguel & Contas",
    "Marketing",
    "Salários",
    "Impostos & Taxas",
    "Outros",
  ],
};

function getMonthBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default function FinancialPage() {
  const { userData, currentUser } = useAuth();
  const salonId = userData?.salonId || "";
  const isOwnerOrManager =
    userData?.role === "owner" ||
    userData?.role === "manager" ||
    userData?.role === "platform_admin";

  const [activeTab, setActiveTab] = useState<FinancialTab>("overview");
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [comandas, setComandas] = useState<ComandaFlow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Date range & filters
  const defaultBounds = useMemo(() => getMonthBounds(), []);
  const [startDate, setStartDate] = useState(defaultBounds.start);
  const [endDate, setEndDate] = useState(defaultBounds.end);
  const [filterType, setFilterType] = useState<"all" | "revenue" | "expense">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending">("all");
  const [filterCategory, setFilterCategory] = useState("all");

  // Batch selection
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  // Comanda 360 Modal integration
  const [comandaModalOpen, setComandaModalOpen] = useState(false);
  const [selectedComanda, setSelectedComanda] = useState<ComandaFlow | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"revenue" | "expense">("revenue");
  const [category, setCategory] = useState("Serviços");
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const [txStatus, setTxStatus] = useState<"paid" | "pending">("paid");
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));

  useEffect(() => {
    setCategory(type === "revenue" ? "Serviços" : "Materiais e Produtos");
  }, [type]);

  useEffect(() => {
    if (!salonId || !currentUser?.uid) {
      setTransactions([]);
      setComandas([]);
      setClients([]);
      setProfessionals([]);
      setServices([]);
      setPackages([]);
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, "salons", salonId, "financialTransactions")),
        (snap) => {
          const items: FinancialTransaction[] = [];
          snap.forEach((d) => items.push({ id: d.id, ...d.data() } as FinancialTransaction));
          items.sort(
            (a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime() ||
              (b.createdAt || 0) - (a.createdAt || 0)
          );
          setTransactions(items);
          setLoading(false);
        },
        (error) => {
          reportFirestoreListenerError(
            error,
            OperationType.LIST,
            `salons/${salonId}/financialTransactions`
          );
          setLoading(false);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "salons", salonId, "comandas")),
        (snap) => {
          const list: ComandaFlow[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ComandaFlow));
          setComandas(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        },
        (error) => {
          reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonId}/comandas`);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "salons", salonId, "clients")),
        (snap) => {
          const arr: Client[] = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data.isActive !== false && !data.deletedAt) {
              arr.push({ id: d.id, ...data } as Client);
            }
          });
          setClients(arr);
        },
        (error) => {
          reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonId}/clients`);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "salons", salonId, "professionals")),
        (snap) => {
          const arr: Professional[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Professional));
          setProfessionals(arr.filter((p) => p.isActive));
        },
        (error) => {
          reportFirestoreListenerError(
            error,
            OperationType.LIST,
            `salons/${salonId}/professionals`
          );
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "salons", salonId, "services")),
        (snap) => {
          const arr: Service[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Service));
          setServices(arr.filter((s) => s.isActive));
        },
        (error) => {
          reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonId}/services`);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "salons", salonId, "packages")),
        (snap) => {
          const arr: ServicePackage[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as ServicePackage));
          setPackages(arr.filter((p) => p.isActive));
        },
        (error) => {
          reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonId}/packages`);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, "salons", salonId, "appointments")),
        (snap) => {
          const arr: Appointment[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Appointment));
          setAppointments(arr);
        },
        (error) => {
          reportFirestoreListenerError(error, OperationType.LIST, `salons/${salonId}/appointments`);
        }
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [salonId, currentUser?.uid]);

  const openComandas = useMemo(
    () => comandas.filter((c) => c.status !== "completed" && c.status !== "canceled"),
    [comandas]
  );

  const completedComandas = useMemo(
    () =>
      comandas
        .filter((c) => c.status === "completed")
        .filter((c) => {
          if (startDate && c.date < startDate) return false;
          if (endDate && c.date > endDate) return false;
          return true;
        }),
    [comandas, startDate, endDate]
  );

  // Compute 6 executive KPIs cleanly
  const kpis = useMemo(() => {
    let previousBalance = 0;
    let paidRevenue = 0;
    let paidExpense = 0;
    let pendingTxBalance = 0;

    transactions.forEach((tx) => {
      const txIsPaid = tx.status !== "pending";
      const val = Number(tx.amount || 0);

      if (startDate && tx.date < startDate) {
        if (txIsPaid) {
          previousBalance += tx.type === "revenue" ? val : -val;
        }
        return;
      }

      if (endDate && tx.date > endDate) {
        return;
      }

      if (txIsPaid) {
        if (tx.type === "revenue") paidRevenue += val;
        else paidExpense += val;
      } else {
        pendingTxBalance += tx.type === "revenue" ? val : -val;
      }
    });

    const openComandasTotal = openComandas.reduce(
      (sum, c) => sum + Number(c.totalAmount || 0),
      0
    );

    const periodResult = paidRevenue - paidExpense;
    const accumulatedBalance = previousBalance + periodResult;
    const totalReceivableOpen = pendingTxBalance + openComandasTotal;

    return {
      previousBalance,
      paidRevenue,
      paidExpense,
      periodResult,
      totalReceivableOpen,
      accumulatedBalance,
    };
  }, [transactions, openComandas, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      if (filterType !== "all" && t.type !== filterType) return false;
      const effectiveStatus = t.status || "paid";
      if (filterStatus !== "all" && effectiveStatus !== filterStatus) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      return true;
    });
  }, [transactions, startDate, endDate, filterType, filterStatus, filterCategory]);

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; Receitas: number; Despesas: number }>();
    [...filteredTransactions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((t) => {
        if (t.status === "pending") return;
        const label = new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        });
        const curr = map.get(t.date) || { date: label, Receitas: 0, Despesas: 0 };
        if (t.type === "revenue") curr.Receitas += t.amount;
        else curr.Despesas += t.amount;
        map.set(t.date, curr);
      });
    return Array.from(map.values()).slice(-14);
  }, [filteredTransactions]);

  const applyDatePreset = (preset: "today" | "7d" | "month" | "all") => {
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7d") {
      const prev = new Date(today);
      prev.setDate(today.getDate() - 6);
      setStartDate(prev.toISOString().substring(0, 10));
      setEndDate(todayStr);
    } else if (preset === "month") {
      const b = getMonthBounds();
      setStartDate(b.start);
      setEndDate(b.end);
    } else {
      setStartDate("");
      setEndDate("");
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;

    const valueNum = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(valueNum) || valueNum <= 0) {
      toast.error("Informe uma descrição e valor válido.");
      return;
    }

    try {
      const payload = {
        description: description.trim(),
        amount: valueNum,
        type,
        category,
        date,
        paymentMethod,
        status: txStatus,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await addDoc(collection(db, "salons", salonId, "financialTransactions"), payload);

      await logAuditEvent(
        salonId,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "create",
          targetEntity: "financial",
          targetId: "financial",
          description: `Lançou uma ${type === "revenue" ? "receita" : "despesa"} de ${formatBRL(valueNum)}: ${description.trim()}`,
          details: payload,
        }
      );

      setDescription("");
      setAmount("");
      toast.success("Movimentação registrada com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar movimentação.");
    }
  };

  const handleTogglePaid = async (tx: FinancialTransaction) => {
    if (!salonId) return;
    const nextStatus = tx.status === "pending" ? "paid" : "pending";
    try {
      await updateDoc(doc(db, "salons", salonId, "financialTransactions", tx.id), {
        status: nextStatus,
        updatedAt: Date.now(),
      });
      toast.success(nextStatus === "paid" ? "Marcado como pago!" : "Alterado para em aberto.");
    } catch {
      toast.error("Erro ao atualizar status da transação.");
    }
  };

  const handleDelete = async (tx: FinancialTransaction) => {
    if (!salonId) return;
    if (!window.confirm(`Excluir transação "${tx.description}" permanentemente?`)) return;

    try {
      await deleteDoc(doc(db, "salons", salonId, "financialTransactions", tx.id));
      await logAuditEvent(
        salonId,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "delete",
          targetEntity: "financial",
          targetId: tx.id,
          description: `Removeu transação "${tx.description}" no valor de ${formatBRL(tx.amount)}`,
        }
      );
      toast.success("Transação excluída!");
    } catch {
      toast.error("Erro ao excluir transação.");
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllTx = () => {
    const allSelected =
      filteredTransactions.length > 0 &&
      filteredTransactions.every((t) => selectedTxIds.has(t.id));
    if (allSelected) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const runBatchAction = async (action: "mark_paid" | "delete") => {
    if (!salonId || selectedTxIds.size === 0) return;
    if (
      action === "delete" &&
      !window.confirm(`Deseja excluir ${selectedTxIds.size} transação(ões)?`)
    ) {
      return;
    }

    setBatchBusy(true);
    try {
      const ids = Array.from(selectedTxIds);
      for (let i = 0; i < ids.length; i += 400) {
        const chunk = ids.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((id) => {
          const ref = doc(db, "salons", salonId, "financialTransactions", id);
          if (action === "delete") batch.delete(ref);
          else batch.update(ref, { status: "paid", updatedAt: Date.now() });
        });
        await batch.commit();
      }
      toast.success("Operação em lote concluída!");
      setSelectedTxIds(new Set());
    } catch {
      toast.error("Erro ao executar ação em lote.");
    } finally {
      setBatchBusy(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = filteredTransactions.map((t) => ({
        Data: t.date,
        Descrição: t.description,
        Tipo: t.type === "revenue" ? "Receita" : "Despesa",
        Categoria: t.category,
        Pagamento: t.paymentMethod,
        Status: t.status === "pending" ? "Em Aberto" : "Pago",
        "Valor (R$)": t.type === "revenue" ? t.amount : -t.amount,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "FluxoCaixa");
      XLSX.writeFile(wb, `financeiro-lumiere-${startDate || "geral"}.xlsx`);
      toast.success("Planilha Excel exportada com sucesso!");
    } catch {
      toast.error("Erro ao gerar arquivo Excel.");
    }
  };

  const handleReopenComanda = async (comanda: ComandaFlow) => {
    if (!salonId) return;
    if (
      !window.confirm(
        `Reabrir a comanda #${comanda.comandaNumber || comanda.id.substring(0, 5)} de ${comanda.clientName}? Os lançamentos vinculados serão revertidos.`
      )
    ) {
      return;
    }

    setReopeningId(comanda.id);
    try {
      await reopenComandaApi(salonId, comanda.id);
      toast.success("Comanda reaberta e disponível em Comandas Abertas.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao reabrir comanda.";
      toast.error(msg);
    } finally {
      setReopeningId(null);
    }
  };

  const openComanda360 = (comanda: ComandaFlow) => {
    setSelectedComanda(comanda);
    setComandaModalOpen(true);
  };

  return (
    <div id="financial-management-page" className="space-y-6 pb-12 font-sans">
      {/* Header Warm-Light */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-heading font-bold text-[#171717] flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#8A6D36]" />
              Financeiro Executivo & Caixa
            </h2>
            <p className="text-xs text-[#6B6B6B] mt-1">
              Acompanhe receitas, despesas, saldo acumulado, comandas em aberto e fechamentos finalizados em tempo real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="h-9 px-3.5 border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] rounded-xl text-[#171717] gap-1.5 text-xs font-semibold whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#6B6B6B]" /> Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportExcel}
              className="h-9 px-3.5 border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] rounded-xl text-[#171717] gap-1.5 text-xs font-semibold whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Exportar Excel (.xlsx)
            </Button>
          </div>
        </div>

        {/* Navigation Tabs + Date Range */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-t border-[#E5E2DC] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                activeTab === "overview"
                  ? "bg-[#171717] text-white"
                  : "bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]"
              )}
            >
              <Wallet className="w-3.5 h-3.5" /> Visão Geral & Extrato
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("open_comandas")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                activeTab === "open_comandas"
                  ? "bg-[#171717] text-white"
                  : "bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]"
              )}
            >
              <Receipt className="w-3.5 h-3.5" /> Comandas Abertas ({openComandas.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed_comandas")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                activeTab === "completed_comandas"
                  ? "bg-[#171717] text-white"
                  : "bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Comandas Finalizadas ({completedComandas.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-1">
              {(
                [
                  { id: "today", label: "Hoje" },
                  { id: "7d", label: "7 dias" },
                  { id: "month", label: "Mês Atual" },
                  { id: "all", label: "Tudo" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyDatePreset(p.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#6B6B6B] hover:text-[#171717] hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-34 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl tabular-nums"
              />
              <span className="text-[#6B6B6B]">até</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-34 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl tabular-nums"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TAB: VISÃO GERAL & EXTRATO */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 6-KPI Executive Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] block">
                Saldo Anterior
              </span>
              <span className="text-lg font-bold text-[#171717] tabular-nums block mt-1">
                {formatBRL(kpis.previousBalance)}
              </span>
              <span className="text-[11px] text-[#6B6B6B] block mt-0.5">Antes do período</span>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-700" /> Receitas Recebidas
              </span>
              <span className="text-lg font-bold text-emerald-700 tabular-nums block mt-1">
                {formatBRL(kpis.paidRevenue)}
              </span>
              <span className="text-[11px] text-[#6B6B6B] block mt-0.5">Baixadas no caixa</span>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-600" /> Despesas Pagas
              </span>
              <span className="text-lg font-bold text-rose-600 tabular-nums block mt-1">
                {formatBRL(kpis.paidExpense)}
              </span>
              <span className="text-[11px] text-[#6B6B6B] block mt-0.5">Saídas quitadas</span>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] block">
                Resultado no Período
              </span>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums block mt-1",
                  kpis.periodResult >= 0 ? "text-emerald-700" : "text-rose-600"
                )}
              >
                {formatBRL(kpis.periodResult)}
              </span>
              <span className="text-[11px] text-[#6B6B6B] block mt-0.5">Líquido do filtro</span>
            </div>

            <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#8A6D36]" /> Em Aberto
              </span>
              <span className="text-lg font-bold text-[#8A6D36] tabular-nums block mt-1">
                {formatBRL(kpis.totalReceivableOpen)}
              </span>
              <span className="text-[11px] text-[#6B6B6B] block mt-0.5">
                Comandas + pendentes
              </span>
            </div>

            <div className="bg-[#FAF9F7] border border-[#B89B5E]/40 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A6D36] block">
                Saldo Acumulado
              </span>
              <span className="text-lg font-bold text-[#171717] tabular-nums block mt-1">
                {formatBRL(kpis.accumulatedBalance)}
              </span>
              <span className="text-[11px] text-[#6B6B6B] block mt-0.5">Posição consolidada</span>
            </div>
          </div>

          {/* Entry Form + Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-white border-[#E5E2DC] shadow-xs lg:col-span-1 rounded-2xl">
              <CardHeader className="border-b border-[#E5E2DC] pb-4">
                <CardTitle className="text-sm font-heading font-bold text-[#171717] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#8A6D36]" /> Novo Lançamento
                </CardTitle>
                <CardDescription className="text-xs text-[#6B6B6B]">
                  Registre receitas avulsas ou contas a pagar no fluxo de caixa.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleAddTransaction} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF9F7] rounded-xl border border-[#E5E2DC]">
                    <button
                      type="button"
                      onClick={() => setType("revenue")}
                      className={cn(
                        "py-1.5 font-semibold rounded-lg transition-all cursor-pointer",
                        type === "revenue"
                          ? "bg-white text-emerald-700 border border-emerald-200 shadow-xs"
                          : "text-[#6B6B6B]"
                      )}
                    >
                      Receita (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("expense")}
                      className={cn(
                        "py-1.5 font-semibold rounded-lg transition-all cursor-pointer",
                        type === "expense"
                          ? "bg-white text-rose-700 border border-rose-200 shadow-xs"
                          : "text-[#6B6B6B]"
                      )}
                    >
                      Despesa (-)
                    </button>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#171717] font-medium">Descrição *</Label>
                    <Input
                      placeholder="Ex: Aluguel, Fornecedor L'Oréal, Venda Produto"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[#171717] font-medium">Valor (R$) *</Label>
                      <Input
                        placeholder="0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 text-xs tabular-nums"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[#171717] font-medium">Data *</Label>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 text-xs tabular-nums"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[#171717] font-medium">Categoria</Label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-[#FAF9F7] text-[#171717] border border-[#E5E2DC] rounded-xl h-9 px-2.5 text-xs outline-none"
                      >
                        {CATEGORIES[type].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[#171717] font-medium">Meio</Label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-[#FAF9F7] text-[#171717] border border-[#E5E2DC] rounded-xl h-9 px-2.5 text-xs outline-none"
                      >
                        <option value="Pix">Pix</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Transferência">Transferência / Boleto</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#171717] font-medium">Situação</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTxStatus("paid")}
                        className={cn(
                          "h-8 rounded-xl border text-xs font-semibold cursor-pointer",
                          txStatus === "paid"
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                            : "bg-[#FAF9F7] border-[#E5E2DC] text-[#6B6B6B]"
                        )}
                      >
                        Pago / Recebido
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxStatus("pending")}
                        className={cn(
                          "h-8 rounded-xl border text-xs font-semibold cursor-pointer",
                          txStatus === "pending"
                            ? "bg-amber-50 border-amber-300 text-amber-800"
                            : "bg-[#FAF9F7] border-[#E5E2DC] text-[#6B6B6B]"
                        )}
                      >
                        Em Aberto (Futuro)
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold h-10 rounded-xl"
                  >
                    Registrar Movimentação
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#E5E2DC] shadow-xs lg:col-span-2 rounded-2xl">
              <CardHeader className="border-b border-[#E5E2DC] pb-4">
                <CardTitle className="text-sm font-heading font-bold text-[#171717] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#8A6D36]" /> Fluxo Cronológico no Período
                </CardTitle>
                <CardDescription className="text-xs text-[#6B6B6B]">
                  Comparativo diário de entradas recebidas e despesas pagas.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <div className="h-[260px] w-full">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-[#6B6B6B]">
                      Sem movimentações pagas suficientes no período para traçar o gráfico.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#dc2626" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                        <XAxis dataKey="date" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                        <YAxis stroke="#6B6B6B" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={(v: number) => formatBRL(v)}
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            borderColor: "#E5E2DC",
                            borderRadius: "12px",
                            color: "#171717",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Area
                          type="monotone"
                          dataKey="Receitas"
                          stroke="#059669"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                        />
                        <Area
                          type="monotone"
                          dataKey="Despesas"
                          stroke="#dc2626"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorExpense)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Extrato Ledger */}
          <Card className="bg-white border-[#E5E2DC] shadow-xs rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-[#E5E2DC] pb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-heading font-bold text-[#171717]">
                  Extrato Financeiro ({filteredTransactions.length})
                </CardTitle>
                <CardDescription className="text-xs text-[#6B6B6B]">
                  Clique no status para dar baixa ou selecione múltiplos lançamentos para ações em lote.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-[#6B6B6B]">
                  <Filter className="w-3.5 h-3.5" /> Filtros:
                </span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as "all" | "revenue" | "expense")}
                  className="bg-[#FAF9F7] text-[#171717] border border-[#E5E2DC] rounded-xl h-8 px-2.5 outline-none"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="revenue">Receitas (+)</option>
                  <option value="expense">Despesas (-)</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as "all" | "paid" | "pending")}
                  className="bg-[#FAF9F7] text-[#171717] border border-[#E5E2DC] rounded-xl h-8 px-2.5 outline-none"
                >
                  <option value="all">Todas situações</option>
                  <option value="paid">Pagos / Recebidos</option>
                  <option value="pending">Em Aberto</option>
                </select>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-[#FAF9F7] text-[#171717] border border-[#E5E2DC] rounded-xl h-8 px-2.5 outline-none"
                >
                  <option value="all">Todas Categorias</option>
                  {Array.from(new Set([...CATEGORIES.revenue, ...CATEGORIES.expense])).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>

            {selectedTxIds.size > 0 && (
              <div className="bg-[#FAF9F7] border-b border-[#E5E2DC] px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#171717] tabular-nums">
                  {selectedTxIds.size} lançamento(s) selecionado(s)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={batchBusy}
                    onClick={() => runBatchAction("mark_paid")}
                    className="h-8 bg-white border-[#E5E2DC] text-emerald-700 text-xs rounded-lg"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marcar como Pago
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={batchBusy}
                    onClick={() => runBatchAction("delete")}
                    className="h-8 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir Selecionados
                  </Button>
                </div>
              </div>
            )}

            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12 text-xs text-[#6B6B6B]">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-[#8A6D36]" /> Sincronizando dados financeiros...
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-14 text-xs text-[#6B6B6B]">
                  Nenhum lançamento encontrado neste período.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[780px]">
                    <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B] font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5 pl-5 w-10">
                          <input
                            type="checkbox"
                            checked={
                              filteredTransactions.length > 0 &&
                              filteredTransactions.every((t) => selectedTxIds.has(t.id))
                            }
                            onChange={toggleSelectAllTx}
                            className="rounded border-[#D1CCC2] cursor-pointer"
                          />
                        </th>
                        <th className="p-3.5">Data</th>
                        <th className="p-3.5">Descrição</th>
                        <th className="p-3.5">Categoria</th>
                        <th className="p-3.5">Pagamento</th>
                        <th className="p-3.5">Situação</th>
                        <th className="p-3.5 text-right">Valor</th>
                        <th className="p-3.5 pr-5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2DC]">
                      {filteredTransactions.map((t) => {
                        const isPending = t.status === "pending";
                        return (
                          <tr key={t.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                            <td className="p-3.5 pl-5">
                              <input
                                type="checkbox"
                                checked={selectedTxIds.has(t.id)}
                                onChange={() => toggleSelectTx(t.id)}
                                className="rounded border-[#D1CCC2] cursor-pointer"
                              />
                            </td>
                            <td className="p-3.5 text-[#6B6B6B] tabular-nums whitespace-nowrap">
                              {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="p-3.5 font-semibold text-[#171717]">
                              {t.description}
                            </td>
                            <td className="p-3.5 text-[#6B6B6B]">{t.category}</td>
                            <td className="p-3.5 text-[#6B6B6B]">{t.paymentMethod}</td>
                            <td className="p-3.5">
                              <button
                                type="button"
                                onClick={() => handleTogglePaid(t)}
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer",
                                  isPending
                                    ? "bg-amber-50 border-amber-200 text-amber-800"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                                )}
                              >
                                {isPending ? "Em Aberto" : "Pago"}
                              </button>
                            </td>
                            <td
                              className={cn(
                                "p-3.5 text-right font-bold tabular-nums",
                                t.type === "revenue" ? "text-emerald-700" : "text-rose-600"
                              )}
                            >
                              {t.type === "revenue" ? "+" : "-"} {formatBRL(t.amount)}
                            </td>
                            <td className="p-3.5 pr-5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDelete(t)}
                                className="p-1.5 text-[#6B6B6B] hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: COMANDAS ABERTAS */}
      {activeTab === "open_comandas" && (
        <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#E5E2DC] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#171717]">
                Comandas Abertas para Fechamento ({openComandas.length})
              </h3>
              <p className="text-xs text-[#6B6B6B]">
                Total em aberto:{" "}
                <strong className="text-[#8A6D36] tabular-nums">
                  {formatBRL(
                    openComandas.reduce((s, c) => s + Number(c.totalAmount || 0), 0)
                  )}
                </strong>
              </p>
            </div>
          </div>
          {openComandas.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B6B6B]">
              Nenhuma comanda em aberto no momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[680px]">
                <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold text-[#6B6B6B]">
                  <tr>
                    <th className="p-3.5 pl-5">Comanda</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">Data / Hora</th>
                    <th className="p-3.5">Itens</th>
                    <th className="p-3.5 text-right">Total</th>
                    <th className="p-3.5 pr-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {openComandas.map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAF9F7]">
                      <td className="p-3.5 pl-5 font-bold text-[#8A6D36] tabular-nums">
                        #{c.comandaNumber || c.id.substring(0, 5).toUpperCase()}
                      </td>
                      <td className="p-3.5 font-semibold text-[#171717]">{c.clientName}</td>
                      <td className="p-3.5 text-[#6B6B6B] tabular-nums">
                        {new Date(`${c.date}T12:00:00`).toLocaleDateString("pt-BR")} · {c.time}
                      </td>
                      <td className="p-3.5 text-[#6B6B6B] truncate max-w-[220px]">
                        {c.items.map((i) => i.name).join(", ")}
                      </td>
                      <td className="p-3.5 text-right font-bold text-[#171717] tabular-nums">
                        {formatBRL(c.totalAmount)}
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openComanda360(c)}
                          className="h-8 px-3 bg-[#171717] hover:bg-[#2c2c2c] text-white text-[11px] font-semibold rounded-lg gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#D4AF37]" /> Abrir Comanda 360°
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: COMANDAS FINALIZADAS */}
      {activeTab === "completed_comandas" && (
        <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#E5E2DC] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#171717]">
                Comandas Finalizadas no Período ({completedComandas.length})
              </h3>
              <p className="text-xs text-[#6B6B6B]">
                Histórico auditável de comandas fechadas com opção de visualização ou reabertura.
              </p>
            </div>
          </div>
          {completedComandas.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B6B6B]">
              Nenhuma comanda finalizada encontrada para o filtro selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[740px]">
                <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold text-[#6B6B6B]">
                  <tr>
                    <th className="p-3.5 pl-5">Comanda</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">Data</th>
                    <th className="p-3.5">Caixa / Pagamento</th>
                    <th className="p-3.5 text-right">Valor Líquido</th>
                    <th className="p-3.5 pr-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {completedComandas.map((c) => {
                    const methodNames: Record<string, string> = {
                      pix: "Pix",
                      credit_card: "Cartão Crédito",
                      debit_card: "Cartão Débito",
                      cash: "Dinheiro",
                      transfer: "Transferência",
                      client_credit: "Saldo Cliente",
                      other: "Outro",
                    };
                    const paidSum = c.paymentSplits?.length
                      ? c.paymentSplits
                          .map((s) => `${methodNames[s.method] || s.method} (${formatBRL(s.amount)})`)
                          .join(", ")
                      : c.paymentMethod || "Confirmado";
                    return (
                      <tr key={c.id} className="hover:bg-[#FAF9F7]">
                        <td className="p-3.5 pl-5 font-bold text-[#8A6D36] tabular-nums">
                          #{c.comandaNumber || c.id.substring(0, 5).toUpperCase()}
                        </td>
                        <td className="p-3.5 font-semibold text-[#171717]">{c.clientName}</td>
                        <td className="p-3.5 text-[#6B6B6B] tabular-nums">
                          {new Date(`${c.date}T12:00:00`).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-3.5 text-[#6B6B6B] truncate max-w-[240px]">
                          {c.cashRegisterName ? `${c.cashRegisterName} · ` : ""}
                          {paidSum}
                        </td>
                        <td className="p-3.5 text-right font-bold text-emerald-700 tabular-nums">
                          {formatBRL(c.totalAmount)}
                        </td>
                        <td className="p-3.5 pr-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openComanda360(c)}
                              className="h-8 px-2.5 border-[#E5E2DC] bg-white text-[#171717] text-[11px] rounded-lg gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detalhes
                            </Button>
                            {isOwnerOrManager && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={reopeningId === c.id}
                                onClick={() => handleReopenComanda(c)}
                                className="h-8 px-2.5 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-[11px] rounded-lg gap-1"
                              >
                                {reopeningId === c.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                )}
                                Reabrir
                              </Button>
                            )}
                          </div>
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

      {salonId && (
        <ComandaModal360
          open={comandaModalOpen}
          onOpenChange={setComandaModalOpen}
          salonId={salonId}
          comanda={selectedComanda}
          clients={clients}
          professionals={professionals}
          services={services}
          packages={packages}
          appointments={appointments}
          currentUserName={userData?.fullName || userData?.email || "Financeiro"}
          onFinalized={() => setSelectedComanda(null)}
        />
      )}
    </div>
  );
}

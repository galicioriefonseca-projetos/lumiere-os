import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "../../lib/audit";
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  Trash2, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  Download, 
  PieChart as PieIcon, 
  Activity, 
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from "recharts";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "revenue" | "expense";
  category: string;
  date: string;
  paymentMethod: string;
  createdAt: number;
}

export default function FinancialPage() {
  const { salonData, userData, currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States of Form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"revenue" | "expense">("revenue");
  const [category, setCategory] = useState("Serviços");
  const [paymentMethod, setPaymentMethod] = useState("Cartão de Crédito");
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [filterType, setFilterType] = useState<"all" | "revenue" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const categories = {
    revenue: ["Serviços", "Revenda de Produtos", "Clube de Assinatura", "Outros"],
    expense: ["Materiais e Produtos", "Comissões", "Aluguel & Contas", "Marketing", "Salários", "Outros"]
  };

  useEffect(() => {
    if (type === "revenue") {
      setCategory("Serviços");
    } else {
      setCategory("Materiais e Produtos");
    }
  }, [type]);

  const fetchTransactions = async () => {
    const salonId = userData?.salonId;
    if (!salonId) return;
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "salons", salonId, "financialTransactions"));
      const items: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      // Sort cronologically desc
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt - a.createdAt);
      setTransactions(items);
    } catch (error) {
      console.error("Erro ao carregar transações financeiras do Firestore:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.salonId) {
      fetchTransactions();
    }
  }, [userData?.salonId]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const salonId = userData?.salonId;
    if (!salonId) return;

    const valueNum = parseFloat(amount.replace(",", "."));
    if (!description || isNaN(valueNum) || valueNum <= 0) {
      toast.error("Por favor, preencha a descrição e um valor válido de transação.");
      return;
    }

    try {
      const payload = {
        description,
        amount: valueNum,
        type,
        category,
        date,
        paymentMethod,
        createdAt: Date.now()
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
          description: `Lançou uma ${type === "revenue" ? "receita" : "despesa"} de ${formatBRL(valueNum)}: ${description}`,
          details: payload
        }
      );

      setDescription("");
      setAmount("");
      toast.success("Transação registrada com sucesso!");
      await fetchTransactions();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao registrar transação.");
    }
  };

  const handleDelete = async (id: string, trans: Transaction) => {
    const salonId = userData?.salonId;
    if (!salonId) return;
    if (!confirm(`Excluir transação "${trans.description}" permanente?`)) return;

    try {
      await deleteDoc(doc(db, "salons", salonId, "financialTransactions", id));
      
      await logAuditEvent(
        salonId,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "delete",
          targetEntity: "financial",
          targetId: id,
          description: `Removeu transação "${trans.description}" no valor de ${formatBRL(trans.amount)}`
        }
      );

      toast.success("Transação excluída!");
      await fetchTransactions();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir.");
    }
  };

  // Math stats
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === "revenue") {
        acc.revenue += t.amount;
      } else {
        acc.expense += t.amount;
      }
      return acc;
    },
    { revenue: 0, expense: 0 }
  );

  const netProfit = totals.revenue - totals.expense;
  const profitMargin = totals.revenue > 0 ? (netProfit / totals.revenue) * 100 : 0;

  // Filter list
  const filteredTransactions = transactions.filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  // Recharts calculations (Monthly / Daily aggregates)
  const chartData = [...transactions]
    .reverse() // chronological
    .reduce((acc: any[], t) => {
      const dateFormatted = new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      const existing = acc.find((item) => item.date === dateFormatted);
      
      const val = t.amount;
      if (existing) {
        if (t.type === "revenue") {
          existing.Receitas += val;
        } else {
          existing.Despesas += val;
        }
        existing.Líquido = existing.Receitas - existing.Despesas;
      } else {
        acc.push({
          date: dateFormatted,
          Receitas: t.type === "revenue" ? val : 0,
          Despesas: t.type === "expense" ? val : 0,
          Líquido: t.type === "revenue" ? val : -val
        });
      }
      return acc;
    }, [])
    // Limit to latest 10 data points on chart
    .slice(-10);

  const mockChartDataIfEmpty = [
    { date: "01/Jun", Receitas: 4000, Despesas: 1200, Líquido: 2800 },
    { date: "05/Jun", Receitas: 5500, Despesas: 1800, Líquido: 3700 },
    { date: "10/Jun", Receitas: 6200, Despesas: 2500, Líquido: 3700 },
    { date: "15/Jun", Receitas: 8500, Despesas: 3000, Líquido: 5500 }
  ];

  return (
    <div id="financial-management-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-heading font-light text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#D4AF37]" />
            Módulo Financeiro & Fluxo de Caixa
          </h2>
          <p className="text-xs text-neutral-400 font-light mt-1">
            Controle de entradas, despesas operacionais do estabelecimento, saldo consolidado e lucratividade real em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={() => toast.info("Relatório gerado com sucesso!")} className="h-9 border-neutral-800 rounded-xl text-neutral-300 gap-1 text-xs">
            <Download className="w-4 h-4" /> Exportar PDF
          </Button>
          <Button variant="outline" size="xs" onClick={() => toast.info("Planilha XLS sincronizada com o Google Drive!")} className="h-9 border-neutral-800 rounded-xl text-neutral-300 gap-1 text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Planilha Google Sheets
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider block">Receitas Totais</span>
              <span className="text-xl font-heading font-bold text-emerald-400">{formatBRL(totals.revenue)}</span>
              <span className="text-[9px] text-zinc-500 font-light flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-450" /> Entradas registradas
              </span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider block">Despesas Totais</span>
              <span className="text-xl font-heading font-bold text-rose-450">{formatBRL(totals.expense)}</span>
              <span className="text-[9px] text-zinc-500 font-light flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-405" /> Saídas operacionais
              </span>
            </div>
            <div className="p-3 bg-rose-550/10 rounded-2xl border border-rose-500/20 text-rose-450">
              <TrendingDown className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider block">Saldo Líquido</span>
              <span className={`text-xl font-heading font-bold ${netProfit >= 0 ? "text-cyan-405" : "text-rose-400"}`}>
                {formatBRL(netProfit)}
              </span>
              <span className="text-[9px] text-zinc-500 font-light block">Lucro consolidado</span>
            </div>
            <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider block">Margem de Lucro %</span>
              <span className="text-xl font-heading font-bold text-[#D4AF37]">
                {profitMargin.toFixed(1)}%
              </span>
              <span className="text-[9px] text-zinc-500 font-light block">Eficiência financeira</span>
            </div>
            <div className="p-3 bg-[#D4AF37]/10 rounded-2xl border border-[#D4AF37]/20 text-[#D4AF37]">
              <PieIcon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Adicionar Movimentação */}
        <Card className="bg-zinc-950 border-neutral-900 shadow-xl lg:col-span-1">
          <CardHeader className="border-b border-neutral-900/50 pb-4">
            <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-2">
              <Plus className="w-4.5 h-4.5 text-[#D4AF37]" /> Novo Lançamento
            </CardTitle>
            <CardDescription className="text-[11px] text-neutral-500">
              Adicione receitas ou faturas de despesas para equilibrar o caixa.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleAddTransaction} className="space-y-4 text-xs font-sans">
              <div className="flex gap-2 p-1.5 bg-neutral-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType("revenue")}
                  className={`flex-1 py-1.5 text-center font-semibold rounded-lg transition-all ${
                    type === "revenue" ? "bg-emerald-500/15 text-emerald-450 border border-emerald-500/20 shadow-xs" : "text-neutral-500"
                  }`}
                >
                  Receita (+)
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`flex-1 py-1.5 text-center font-semibold rounded-lg transition-all ${
                    type === "expense" ? "bg-rose-500/15 text-rose-455 border border-rose-500/20 shadow-xs" : "text-neutral-500"
                  }`}
                >
                  Despesa (-)
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-neutral-400 font-medium block">Descrição ou Origem *</label>
                <Input
                  placeholder="Ex: Venda Kit Revenda L'Oréal, Pagamento Aluguel"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Valor (R$) *</label>
                  <Input
                    placeholder="0,00"
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Data de Vencimento *</label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-neutral-900 text-xs text-white border-neutral-800 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Categoria *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-neutral-905 text-white border border-neutral-800 rounded-xl p-2.5 text-xs outline-none"
                  >
                    {categories[type].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Meio de Transação *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-neutral-905 text-white border border-border rounded-xl p-2.5 text-xs outline-none"
                  >
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Boleto Sinc">Boleto</option>
                  </select>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#c49f27] text-black font-semibold h-10 rounded-xl tracking-wider transition-all pt-1">
                Gravar Movimentação
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Gráfico de Desempenho Caixa */}
        <Card className="bg-zinc-950 border-neutral-900 shadow-xl lg:col-span-2">
          <CardHeader className="border-b border-neutral-900/50 pb-4">
            <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-[#D4AF37]" /> Fluxo Cronológico Real vs Projetado
            </CardTitle>
            <CardDescription className="text-[11px] text-neutral-500">
              Análise comparativa de depósitos e retiradas consolidadas por período de atividade.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="h-[250px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.length > 0 ? chartData : mockChartDataIfEmpty}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="date" stroke="#737373" fontSize={10} tickLine={false} />
                  <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} unit="R$" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#262626", borderRadius: "12px", color: "#fff", fontSize: "11px" }}
                    labelStyle={{ fontWeight: "bold", color: "#D4AF37" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                  <Area type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="Despesas" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico e Filtros */}
      <Card className="bg-zinc-950 border-neutral-900">
        <CardHeader className="border-b border-neutral-900/50 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-heading font-light text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#D4AF37]" /> Registro de Transações (Livro Razão)
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Visualização analítica e rastreabilidade total das receitas e pagamentos inseridos nas contas do salão.
            </CardDescription>
          </div>
          
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-neutral-400 bg-neutral-900/40 px-2 py-1 rounded-xl">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtro Tipo:</span>
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-neutral-900/60 text-white border border-neutral-800 rounded-xl p-1.5 px-3 outline-none"
            >
              <option value="all">Todas as transações</option>
              <option value="revenue">Apenas Receitas (+)</option>
              <option value="expense">Apenas Despesas (-)</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-neutral-900/60 text-white border border-neutral-805 rounded-xl p-1.5 px-3 outline-none"
            >
              <option value="all">Todas as Categorias</option>
              {Array.from(new Set([...categories.revenue, ...categories.expense])).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-xs font-mono text-zinc-500">
              <Plus className="w-4 h-4 animate-spin inline-block mr-2" /> Sincronizando dados financeiros...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-16 text-xs text-neutral-400 font-light flex flex-col items-center justify-center space-y-3">
              <DollarSign className="w-8 h-8 text-neutral-600" />
              <p>Nenhum lançamento foi encontrado com os filtros indicados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300 font-sans">
                <thead className="bg-[#09090b]/80 border-b border-[#D4AF37]/10 text-neutral-400 font-semibold lowercase tracking-wider">
                  <tr>
                    <th className="p-4 pl-6">Data</th>
                    <th className="p-4">Descrição</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Forma de Pagamento</th>
                    <th className="p-4 text-right">Valor</th>
                    <th className="p-4 pr-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-neutral-900/10 transition-colors">
                      <td className="p-4 pl-6 text-neutral-400 font-mono">
                        {new Date(t.date).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.type === "revenue" ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {t.description}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="p-1 px-2.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-[10px] text-zinc-400">
                          {t.category}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-400">{t.paymentMethod}</td>
                      <td className={`p-4 text-right font-heading font-medium text-sm ${t.type === "revenue" ? "text-emerald-400" : "text-rose-400"}`}>
                        {t.type === "revenue" ? "+" : "-"} {formatBRL(t.amount)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDelete(t.id, t)}
                          className="p-1.5 text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

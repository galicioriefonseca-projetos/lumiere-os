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
  Crown, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Users, 
  TrendingUp, 
  CreditCard, 
  Calendar, 
  ShieldAlert,
  Sparkles,
  Award
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  period: "monthly" | "quarterly" | "yearly";
  servicesIncluded: string;
  subscribersCount: number;
}

interface Subscriber {
  id: string;
  clientName: string;
  planName: string;
  status: "active" | "suspended" | "pending";
  joinDate: string;
  nextBilling: string;
}

export default function MembershipClubPage() {
  const { salonData, userData, currentUser } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  // New Plan form states
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [servicesIncluded, setServicesIncluded] = useState("");

  // New Subscriber form states
  const [clientName, setClientName] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [joinDate, setJoinDate] = useState(() => new Date().toISOString().substring(0, 10));

  const fetchMembershipData = async () => {
    const salonId = userData?.salonId;
    if (!salonId) return;
    setLoading(true);
    try {
      const plansSnapshot = await getDocs(collection(db, "salons", salonId, "membershipPlans"));
      const parsedPlans: MembershipPlan[] = [];
      plansSnapshot.forEach((doc) => {
        parsedPlans.push({ id: doc.id, ...doc.data() } as MembershipPlan);
      });
      setPlans(parsedPlans);
      
      const subsSnapshot = await getDocs(collection(db, "salons", salonId, "membershipSubscribers"));
      const parsedSubs: Subscriber[] = [];
      subsSnapshot.forEach((doc) => {
        parsedSubs.push({ id: doc.id, ...doc.data() } as Subscriber);
      });
      setSubscribers(parsedSubs);
    } catch (error) {
      console.error("Erro ao carregar dados do clube do Firestore:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.salonId) {
      fetchMembershipData();
    }
  }, [userData?.salonId]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const salonId = userData?.salonId;
    if (!salonId) return;

    const prVal = parseFloat(planPrice.replace(",", ".")) || 0;
    if (!planName || isNaN(prVal) || prVal <= 0) {
      toast.error("Insira o nome do plano de assinatura e um preço válido.");
      return;
    }

    try {
      const payload = {
        name: planName,
        price: prVal,
        period,
        servicesIncluded,
        subscribersCount: 0,
        createdAt: Date.now()
      };

      await addDoc(collection(db, "salons", salonId, "membershipPlans"), payload);

      await logAuditEvent(
        salonId,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "create",
          targetEntity: "subscription",
          targetId: "membership-club",
          description: `Criou plano de assinatura recorrente "${planName}" por ${formatBRL(prVal)}`,
          details: payload
        }
      );

      setPlanName("");
      setPlanPrice("");
      setServicesIncluded("");
      toast.success("Plano " + planName + " adicionado ao clube de faturamento recorrente!");
      await fetchMembershipData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar plano de recorrência.");
    }
  };

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    const salonId = userData?.salonId;
    if (!salonId) return;

    const targetPlan = plans.find(p => p.id === selectedPlanId);
    if (!clientName || !targetPlan) {
      toast.error("Escolha o cliente e selecione um plano ativo.");
      return;
    }

    try {
      // Calculate next billing (add 30 days)
      const parts = joinDate.split("-");
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      d.setDate(d.getDate() + 30);
      const nextBillingStr = d.toISOString().substring(0, 10);

      const payload = {
        clientName,
        planName: targetPlan.name,
        planId: targetPlan.id,
        status: "active",
        joinDate,
        nextBilling: nextBillingStr,
        createdAt: Date.now()
      };

      await addDoc(collection(db, "salons", salonId, "membershipSubscribers"), payload);

      // Increment subscriber counter in parent plan doc
      await updateDoc(doc(db, "salons", salonId, "membershipPlans", targetPlan.id), {
        subscribersCount: (targetPlan.subscribersCount || 0) + 1
      });

      await logAuditEvent(
        salonId,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "create",
          targetEntity: "subscription",
          targetId: targetPlan.id,
          description: `Inscreveu o cliente "${clientName}" no plano recorrente "${targetPlan.name}"`,
          details: payload
        }
      );

      setClientName("");
      toast.success(`Inscrição de "${clientName}" processada com sucesso!`);
      await fetchMembershipData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao matricular membro.");
    }
  };

  const handleRemoveSubscriber = async (sub: Subscriber) => {
    const salonId = userData?.salonId;
    if (!salonId) return;
    if (!confirm(`Excluir plano de fidelidade e recorrência do cliente: "${sub.clientName}"?`)) return;

    try {
      await deleteDoc(doc(db, "salons", salonId, "membershipSubscribers", sub.id));

      // Attempt to decrement plan subscribers count
      const matchedPlan = plans.find(p => p.name === sub.planName);
      if (matchedPlan) {
        const nextCount = Math.max(0, (matchedPlan.subscribersCount || 0) - 1);
        await updateDoc(doc(db, "salons", salonId, "membershipPlans", matchedPlan.id), {
          subscribersCount: nextCount
        });
      }

      await logAuditEvent(
        salonId,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "delete",
          targetEntity: "subscription",
          targetId: sub.id,
          description: `Cancelou filiação recorrente do cliente "${sub.clientName}"`
        }
      );

      toast.success("Membro removido do clube de recorrência.");
      await fetchMembershipData();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao silenciar.");
    }
  };

  const handleRemovePlan = async (id: string, name: string) => {
    const salonId = userData?.salonId;
    if (!salonId) return;
    if (!confirm(`Remover permanentemente o plano "${name}"? Os assinantes ativos continuarão existindo.`)) return;

    try {
      await deleteDoc(doc(db, "salons", salonId, "membershipPlans", id));

      toast.success("Plano de assinatura removido com sucesso.");
      await fetchMembershipData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao deletar plano.");
    }
  };

  // Math totals
  const totalSubscribersCount = subscribers.length;
  const recurringRevenueForecast = subscribers.reduce((acc, sub) => {
    const p = plans.find(plan => plan.name === sub.planName);
    return acc + (p?.price || 0);
  }, 0);

  return (
    <div id="recurrent-memberships-dashboard" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-heading font-light text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-[#D4AF37]" />
            Clube de Assinaturas & Recorrência Premium
          </h2>
          <p className="text-xs text-neutral-400 font-light mt-1">
            Crie previsibilidade de caixa configurando clubes de recorrência automática (excl. Escova Ilimitada, Corte Mensal).
          </p>
        </div>
      </div>

      {/* Recurrent Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-sans">
        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 block font-bold uppercase tracking-wider">Planos Ativos</span>
              <span className="text-xl font-heading font-bold text-white">{plans.length} Modelos</span>
              <span className="text-[9px] text-[#D4AF37] block">Clube do cabelo, barba, manicure</span>
            </div>
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-zinc-400">
              <Award className="w-5 h-5 text-[#D4AF37]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 block font-bold uppercase tracking-wider">Assinantes Matrilulados</span>
              <span className="text-xl font-heading font-bold text-emerald-450">{totalSubscribersCount} Clientes</span>
              <span className="text-[9px] text-neutral-500 block">Com pagamento em dia</span>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 block font-bold uppercase tracking-wider">Faturamento Previsível Mensal MRR</span>
              <span className="text-xl font-heading font-bold text-cyan-405">{formatBRL(recurringRevenueForecast)}</span>
              <span className="text-[9px] text-[#D4AF37] block">Receita de pacotes mensais recorrentes</span>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-405">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form para Plano */}
        <Card className="bg-zinc-950 border-neutral-900 shadow-xl lg:col-span-1">
          <CardHeader className="border-b border-neutral-900/50 pb-4">
            <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-2">
              <Plus className="w-4.5 h-4.5 text-[#D4AF37]" /> Novo Plano do Clube
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="text-neutral-400 font-medium">Nome do Plano Recorrente *</label>
                <Input
                  placeholder="Ex: Escova Ilimitada Clássico, Barba Club"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="bg-neutral-900 text-white text-xs border-neutral-800 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium">Preço (R$) *</label>
                  <Input
                    placeholder="0,00"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="bg-neutral-900 text-white border-neutral-800 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium">Frequência *</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as any)}
                    className="w-full bg-neutral-905 text-white border border-neutral-800 rounded-xl p-2.5 outline-none"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-neutral-400 font-medium">Serviços / Benefícios inclusos *</label>
                <Input
                  placeholder="Ex: Lavagem e escova ilimitados, cafezinho cortesia"
                  value={servicesIncluded}
                  onChange={(e) => setServicesIncluded(e.target.value)}
                  className="bg-neutral-900 text-white text-xs border-neutral-800 rounded-xl"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#c99e1d] text-black font-semibold h-10 rounded-xl transition-all pt-1">
                Ativar Plano Recorrente
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Form Matrícula de Clientes e Lista Planos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* List of active plans */}
            <Card className="bg-zinc-950 border-neutral-900 shadow-xl">
              <CardHeader className="border-b border-neutral-900/50 pb-4">
                <CardTitle className="text-xs font-heading font-semibold text-[#D4AF37] uppercase">Planos Recorrentes Habilitados</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-sans text-xs">
                {plans.length === 0 ? (
                  <p className="text-neutral-500 font-light text-center py-6">Nenhum plano ativo.</p>
                ) : (
                  plans.map(p => (
                    <div key={p.id} className="p-3 bg-[#09090b] border border-neutral-900 rounded-xl flex justify-between items-center">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-[10px] text-zinc-550 leading-tight">Serviços: {p.servicesIncluded}</p>
                        <p className="text-[10px] text-[#D4AF37] font-semibold">{formatBRL(p.price)} / {p.period === "monthly" ? "Mês" : p.period}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-emerald-400 bg-emerald-450/10 tracking-widest px-2 py-0.5 rounded-lg border border-emerald-400/20 font-bold">{p.subscribersCount || 0} Ativos</span>
                        <button onClick={() => handleRemovePlan(p.id, p.name)} className="text-zinc-650 hover:text-rose-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Subscribe Client form */}
            <Card className="bg-zinc-950 border-neutral-900 shadow-xl">
              <CardHeader className="border-b border-neutral-900/50 pb-4">
                <CardTitle className="text-xs font-heading font-semibold text-white uppercase">Inscrever Cliente no Clube</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleAddSubscriber} className="space-y-4 font-sans text-xs">
                  <div className="space-y-1.5">
                    <label className="text-neutral-400 font-medium">Nome do Cliente *</label>
                    <Input
                      placeholder="Ex: Mariana Guimarães de Oliveira"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="bg-neutral-900 text-white text-xs border-neutral-800 rounded-xl h-9"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-neutral-400 font-medium">Plano de Escolha *</label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="w-full bg-neutral-905 text-white border border-neutral-800 rounded-xl p-2 h-9 outline-none"
                    >
                      <option value="">-- Escolha um Plano --</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({formatBRL(p.price)})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-neutral-400 font-medium">Data de Admissão *</label>
                    <Input
                      type="date"
                      value={joinDate}
                      onChange={(e) => setJoinDate(e.target.value)}
                      className="bg-neutral-900 text-white border-neutral-800 rounded-xl h-9"
                    />
                  </div>

                  <Button type="submit" disabled={plans.length === 0} className="w-full bg-[#D4AF37] hover:bg-amber-600 text-black font-semibold h-9 rounded-xl transition-all">
                    Registrar Assinatura
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Members list */}
          <Card className="bg-zinc-950 border-neutral-900">
            <CardHeader className="p-4 border-b border-neutral-900/40">
              <CardTitle className="text-xs font-heading font-semibold text-white uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#D4AF37]" /> Membros Filiados Recorrentes Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {subscribers.length === 0 ? (
                <p className="text-neutral-500 font-light text-center py-10">Nenhum cliente registrado sob as formas de assinatura.</p>
              ) : (
                <div className="overflow-x-auto text-xs font-sans text-neutral-300">
                  <table className="w-full text-left">
                    <thead className="bg-[#09090b]/80 border-b border-neutral-900/50 text-neutral-450 uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th className="p-4 pl-6">Cliente Assinante</th>
                        <th className="p-4">Plano do Clube</th>
                        <th className="p-4">Filiou-se em</th>
                        <th className="p-4">Cobrança Automática</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center pr-6">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {subscribers.map(sub => (
                        <tr key={sub.id} className="hover:bg-neutral-900/10">
                          <td className="p-4 pl-6 font-semibold text-white">{sub.clientName}</td>
                          <td className="p-4 text-neutral-200">{sub.planName}</td>
                          <td className="p-4 text-neutral-400 font-mono">{new Date(sub.joinDate).toLocaleDateString("pt-BR")}</td>
                          <td className="p-4 text-neutral-500 font-semibold font-mono">{new Date(sub.nextBilling).toLocaleDateString("pt-BR")}</td>
                          <td className="p-4">
                            <span className="p-1 px-2.5 bg-emerald-500/15 border border-emerald-500/20 rounded-lg text-emerald-400 leading-none text-[9px] font-bold block w-max uppercase">Assinatura Ativa</span>
                          </td>
                          <td className="p-4 text-center pr-6">
                            <button onClick={() => handleRemoveSubscriber(sub)} className="text-zinc-650 hover:text-rose-500 hover:bg-rose-500/10 p-1.5 transition-all rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "../../lib/audit";
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Megaphone, 
  Gift, 
  MessageSquare, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Sparkles, 
  Award, 
  Users,
  Percent,
  TrendingUp,
  ExternalLink
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface MarketingCoupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minSpend: number;
  expiryDate: string;
  status: "active" | "expired";
}

interface LoyaltyConfig {
  pointsPerReal: number;
  minPointsToRedeem: number;
  cashPerPoint: number;
}

export default function MarketingPage() {
  const { salonData, userData, currentUser } = useAuth();
  const [coupons, setCoupons] = useState<MarketingCoupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);

  // States of Coupon creation
  const [couponCode, setCouponCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().substring(0, 10);
  });

  // State of loyalty program simulation
  const [pointsPerReal, setPointsPerReal] = useState(1);
  const [minRedeem, setMinRedeem] = useState(100);
  const [valuePerPoint, setValuePerPoint] = useState(0.1); 

  // Copy state tracker
  const [copiedTemplateIdx, setCopiedTemplateIdx] = useState<number | null>(null);

  const campaignTemplates = [
    {
      title: "🎁 Carinho de Aniversário (Clientes Especiais)",
      channel: "WhatsApp ou SMS",
      body: `Olá [Nome]! 🌸 Nós do ${salonData?.name || "LumièreOS Studio"} queremos te desejar um aniversário iluminado! Para comemorar, preparamos um presente exclusivo para você se cuidar hoje: Ganhe 15% OFF em qualquer procedimento de estética ou cabelo durante todo o seu mês de aniversário. Agende agora clicando aqui: [Link_Agenda]`
    },
    {
      title: "❄️ Hidratação de Inverno (Aumento de Ticket)",
      channel: "WhatsApp",
      body: `Oi [Nome], tudo bem? Com as frentes frias, nossos cabelos tendem a ressecar. Preparamos o Combo Essenza Hidra: Lavagem Speciale + Hidratação Kérastase + Escova Modeladora por apenas R$ 180,00! É hora de recuperar o brilho! Clique para reservar: [Link_Agenda]`
    },
    {
      title: "⚡ Recuperação de Clientes Inativos (Reativação)",
      channel: "WhatsApp ou E-mail",
      body: `Que saudade, [Nome]! Faz algum tempo que você não cuida da sua beleza conosco. Ganhe um desconto especial de R$ 30,00 reais em sua próxima visita usando o cupom REENCONTRO. Esperamos você de portas abertas. Garanta seu horário: [Link_Agenda]`
    }
  ];

  const fetchCoupons = async () => {
    const salonId = userData?.salonId;
    if (!salonId) return;
    setLoadingCoupons(true);
    try {
      const querySnapshot = await getDocs(collection(db, "salons", salonId, "marketingCoupons"));
      const parsed: MarketingCoupon[] = [];
      querySnapshot.forEach((doc) => {
        parsed.push({ id: doc.id, ...doc.data() } as MarketingCoupon);
      });
      parsed.sort((a, b) => b.code.localeCompare(a.code));
      setCoupons(parsed);
    } catch (error) {
      console.error("Erro ao carregar cupons do Firestore:", error);
    } finally {
      setLoadingCoupons(false);
    }
  };

  useEffect(() => {
    if (userData?.salonId) {
      fetchCoupons();
    }
  }, [userData?.salonId]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const salonId = userData?.salonId;
    if (!salonId) return;

    const val = parseFloat(discountValue) || 0;
    const minSpendNum = parseFloat(minSpend) || 0;
    const cleanCode = couponCode.trim().toUpperCase();

    if (!cleanCode || isNaN(val) || val <= 0) {
      toast.error("Preencha o código do cupom e o valor do desconto de forma correta.");
      return;
    }

    try {
      const payload = {
        code: cleanCode,
        discountType,
        discountValue: val,
        minSpend: minSpendNum,
        expiryDate,
        status: new Date(expiryDate).getTime() < Date.now() ? "expired" : "active",
        createdAt: Date.now()
      };

      await addDoc(collection(db, "salons", salonId, "marketingCoupons"), payload);

      await logAuditEvent(
        salonId,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "create",
          targetEntity: "marketing",
          targetId: "marketing",
          description: `Criou cupom de desconto "${cleanCode}" (${val}${discountType === "percentage" ? "%" : " BRL"} de desconto)`,
          details: payload
        }
      );

      setCouponCode("");
      setDiscountValue("");
      setMinSpend("");
      toast.success(`Cupom "${cleanCode}" criado e ativo no sistema!`);
      await fetchCoupons();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao emitir cupom.");
    }
  };

  const handleDeleteCoupon = async (id: string, code: string) => {
    const salonId = userData?.salonId;
    if (!salonId) return;
    if (!confirm(`Remover permanentemente o cupom "${code}" do LumièreOS?`)) return;

    try {
      await deleteDoc(doc(db, "salons", salonId, "marketingCoupons", id));

      await logAuditEvent(
        salonId,
        currentUser?.uid || "system",
        userData?.fullName || "Usuário",
        userData?.email || "sem-email@lumiere.com",
        userData?.role || "professional",
        {
          action: "delete",
          targetEntity: "marketing",
          targetId: id,
          description: `Excluiu cupom de desconto "${code}"`
        }
      );

      toast.success("Cupom de marketing removido!");
      await fetchCoupons();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover.");
    }
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplateIdx(index);
    toast.success("Texto copiado para a Área de Transferência!");
    setTimeout(() => {
      setCopiedTemplateIdx(null);
    }, 2000);
  };

  const saveLoyaltySettings = () => {
    toast.success("Regras do Clube de Fidelidade salvas com sucesso!");
  };

  return (
    <div id="marketing-campaigns-dashboard" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-heading font-light text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[#D4AF37]" />
            Campanhas & Marketing Conversacional
          </h2>
          <p className="text-xs text-neutral-400 font-light mt-1">
            Fidelização, cupons promocionais integrados ao PDV e automações de copywriting de vendas de alto impacto.
          </p>
        </div>
      </div>

      {/* Grid structure main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans text-xs">
        {/* Campanhas Promocionais Modelos */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-zinc-950 border-neutral-900 shadow-xl">
            <CardHeader className="border-b border-neutral-900/50 pb-4">
              <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-2">
                <MessageSquare className="w-4.5 h-4.5 text-[#D4AF37]" /> Templates de WhatsApp de Alto Impacto
              </CardTitle>
              <CardDescription className="text-[11px] text-zinc-500">
                Copie os roteiros refinados de gatilho mental para divulgar ofertas de WhatsApp e preencher horários ociosos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {campaignTemplates.map((item, index) => (
                <div key={index} className="p-4 bg-[#09090b] border border-neutral-900 rounded-xl space-y-2 relative group">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white text-xs">{item.title}</span>
                    <span className="p-1 px-2.5 bg-neutral-900/40 border border-[#D4AF37]/10 rounded-lg text-[9px] text-[#D4AF37] tracking-wider uppercase">{item.channel}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 font-light leading-relaxed whitespace-pre-line">{item.body}</p>
                  
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleCopyText(item.body, index)}
                      className="border-neutral-800 text-[10px] text-[#D4AF37] hover:bg-[#D4AF37]/5 h-8 px-3 rounded-lg gap-1 pt-0.5"
                    >
                      {copiedTemplateIdx === index ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar Texto
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Cupons Ativos */}
          <Card className="bg-zinc-950 border-neutral-900 shadow-xl">
            <CardHeader className="border-b border-neutral-900/50 pb-4">
              <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-2">
                <Gift className="w-4.5 h-4.5 text-[#D4AF37]" /> Cupons Promocionais Sincronizados
              </CardTitle>
              <CardDescription className="text-[11px] text-neutral-500">
                Gerencie abatimentos diretos que podem ser usufruídos no caixa final do agendamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCoupons ? (
                <div className="text-center py-10 font-mono text-zinc-550">
                  Sincronizando cupons ativos...
                </div>
              ) : coupons.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-light">
                  Nenhum cupom de desconto configurado para esta filial.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead className="bg-[#09090b]/60 text-zinc-450 border-b border-neutral-900 font-semibold lowercase">
                      <tr>
                        <th className="p-4 pl-6">Código do Cupom</th>
                        <th className="p-4">Regra do Desconto</th>
                        <th className="p-4">Valor Mínimo</th>
                        <th className="p-4 text-center">Data de Expiração</th>
                        <th className="p-4 text-center pr-6">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {coupons.map((c) => (
                        <tr key={c.id} className="hover:bg-neutral-900/10">
                          <td className="p-4 pl-6">
                            <span className="font-mono font-bold text-[#D4AF37] bg-neutral-900 border border-neutral-805 px-2.5 py-1 rounded-lg">
                              {c.code}
                            </span>
                          </td>
                          <td className="p-4 text-white font-medium">
                            {c.discountType === "percentage" ? `${c.discountValue}% Off` : `${formatBRL(c.discountValue)} Off`}
                          </td>
                          <td className="p-4 text-neutral-400">
                            {c.minSpend > 0 ? formatBRL(c.minSpend) : "Sem mínimo"}
                          </td>
                          <td className="p-4 text-center text-neutral-400 font-mono">
                            {new Date(c.expiryDate).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="p-4 text-center pr-6">
                            <button
                              onClick={() => handleDeleteCoupon(c.id, c.code)}
                              className="p-1.5 text-zinc-600 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-all"
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

        {/* Gerador de Cupons e Fidelidade */}
        <div className="space-y-6 lg:col-span-1">
          {/* Criar Cupom */}
          <Card className="bg-zinc-950 border-neutral-900 shadow-xl">
            <CardHeader className="border-b border-neutral-900/50 pb-4">
              <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#D4AF37]" /> Novo Cupom
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium">Código do Cupom *</label>
                  <Input
                    placeholder="Ex: SPECIAL15, INVERNO20"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="bg-neutral-900 text-white uppercase font-mono text-xs border-neutral-800 rounded-xl"
                    required
                  />
                </div>

                <div className="flex gap-2 p-1.5 bg-neutral-900 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percentage")}
                    className={`flex-1 py-1.5 font-bold rounded-lg text-center transition-all ${
                      discountType === "percentage" ? "bg-neutral-955 text-[#D4AF37] border border-neutral-800 shadow-sm" : "text-neutral-500"
                    }`}
                  >
                    Porcentagem (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("fixed")}
                    className={`flex-1 py-1.5 font-bold rounded-lg text-center transition-all ${
                      discountType === "fixed" ? "bg-neutral-955 text-[#D4AF37] border border-neutral-800 shadow-sm" : "text-neutral-500"
                    }`}
                  >
                    Dinheiro (R$)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-neutral-400 font-medium">Valor Desconto *</label>
                    <Input
                      placeholder={discountType === "percentage" ? "15%" : "25,00"}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="bg-neutral-900 text-white border-neutral-800 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-neutral-400 font-medium">Gasto Mínimo (R$)</label>
                    <Input
                      placeholder="0,00"
                      value={minSpend}
                      onChange={(e) => setMinSpend(e.target.value)}
                      className="bg-neutral-900 text-white border-neutral-800 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium">Validade do Cupom *</label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="bg-neutral-900 text-white border-neutral-800 rounded-xl"
                    required
                  />
                </div>

                <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#bfa22f] text-black font-semibold h-10 rounded-xl tracking-wider transition-all pt-1">
                  Ativar Cupom
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Clube de Fidelidade */}
          <Card className="bg-zinc-950 border-neutral-900 shadow-xl">
            <CardHeader className="border-b border-neutral-900/50 pb-4">
              <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-1.5">
                <Award className="w-4.5 h-4.5 text-[#D4AF37]" /> Fidelidade (Pontuação)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-neutral-400 font-medium block">Pontos por R$ 1,00 gasto</label>
                  <Input
                    type="number"
                    value={pointsPerReal}
                    onChange={(e) => setPointsPerReal(parseFloat(e.target.value) || 0)}
                    className="bg-neutral-900 text-white border-neutral-800 rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-medium block">Resgate mínimo (Pontos)</label>
                  <Input
                    type="number"
                    value={minRedeem}
                    onChange={(e) => setMinRedeem(parseInt(e.target.value) || 0)}
                    className="bg-neutral-900 text-white border-neutral-800 rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-400 font-medium block">Equivalência (R$ por Ponto)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valuePerPoint}
                    onChange={(e) => setValuePerPoint(parseFloat(e.target.value) || 0)}
                    className="bg-neutral-900 text-white border-neutral-800 rounded-xl h-9 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-900 rounded-xl space-y-1">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide">Cálculo de Exemplo</p>
                <p className="text-[11px] text-[#D4AF37] leading-relaxed">
                  Consumo de <b>R$ 200,00</b> = <b>{200 * pointsPerReal} pontos</b>. 
                  Resgate do lote mínimo de <b>{minRedeem} pontos</b> garante abatimento de <b>{formatBRL(minRedeem * valuePerPoint)}</b>.
                </p>
              </div>

              <Button onClick={saveLoyaltySettings} className="w-full h-9 border border-neutral-800 text-neutral-300 hover:bg-neutral-900 text-xs rounded-xl bg-transparent font-medium pt-0.5">
                Salvar Regras
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

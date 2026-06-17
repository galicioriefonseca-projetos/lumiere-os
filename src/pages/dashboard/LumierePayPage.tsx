import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  CreditCard, 
  QrCode, 
  ArrowUpRight, 
  Sparkles, 
  Scale, 
  Percent, 
  TrendingUp, 
  ArrowDownLeft, 
  Layers, 
  DollarSign, 
  Hourglass,
  PiggyBank
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

export default function LumierePayPage() {
  const { salonData, userData } = useAuth();
  
  // States of simulated split billing calculator
  const [chargeAmount, setChargeAmount] = useState("");
  const [salonCut, setSalonCut] = useState("60");
  const [proCut, setProCut] = useState("40");
  const [selectedPro, setSelectedPro] = useState("Profissional Geral");

  // Charge simulation
  const [machineAmount, setMachineAmount] = useState("");
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [payoutsMade, setPayoutsMade] = useState<any[]>([
    { id: "1", date: "Hoje", description: "Corte Feminino + Coloração", total: 320.00, salon: 192.00, professional: 128.00, proName: "Clara Siqueira", status: "pago" },
    { id: "2", date: "Ontem", description: "Design de Sobrancelha Premium", total: 95.00, salon: 57.00, professional: 38.00, proName: "Thiago Mendes", status: "pago" },
    { id: "3", date: "14/Jun", description: "Limpeza de Pele Profunda", total: 180.00, salon: 108.00, professional: 72.00, proName: "Juliana Estetic", status: "pendente" }
  ]);

  const [availableWithdrawal, setAvailableWithdrawal] = useState(1450.50);

  const handleSimulateSplit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(chargeAmount.replace(",", "."));
    const salonPct = parseFloat(salonCut);
    const proPct = parseFloat(proCut);

    if (isNaN(total) || total <= 0) {
      toast.error("Insira o valor bruto do atendimento para simular.");
      return;
    }
    if (salonPct + proPct !== 100) {
      toast.error("A soma do split (Salão + Profissional) precisa ser exatamente 100%.");
      return;
    }

    const calculatedSalon = (total * salonPct) / 100;
    const calculatedPro = (total * proPct) / 100;

    const newPayout = {
      id: String(Date.now()),
      date: "Hoje",
      description: `Simulação Split - ${selectedPro}`,
      total,
      salon: calculatedSalon,
      professional: calculatedPro,
      proName: selectedPro,
      status: "pendente"
    };

    setPayoutsMade((prev) => [newPayout, ...prev]);
    toast.success("Split de comissão simulado e inserido no fluxo de recebimentos!");
    setChargeAmount("");
  };

  const handleTriggerWithdrawal = () => {
    if (availableWithdrawal <= 0) {
      toast.error("Você não possui saldo livre para efetuar saques no momento.");
      return;
    }
    toast.success(`Solicitação de Saque de ${formatBRL(availableWithdrawal)} enviado para processamento PIX na sua conta bancária cadastrada!`);
    setAvailableWithdrawal(0);
  };

  const generateQRCodePix = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(machineAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Indique um valor para faturamento na maquininha virtual.");
      return;
    }
    setQrCodeGenerated(true);
    toast.success("PIX QR Code de " + formatBRL(amt) + " gerado com sucesso!");
  };

  return (
    <div id="lumierepay-payout-split-terminal" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-heading font-light text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#D4AF37]" />
            LumièrePay - Divisão e Split de Recebimentos (AvecPay)
          </h2>
          <p className="text-xs text-neutral-400 font-light mt-1">
            Mitigação de bitributação através do split automático de comissões aos profissionais de forma instantânea e maquininha de cartão.
          </p>
        </div>
      </div>

      {/* Financial Pay overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 block font-bold uppercase tracking-wider">Saldo Pronto para Saque</span>
              <span className="text-xl font-heading font-bold text-emerald-450">{formatBRL(availableWithdrawal)}</span>
              <span className="text-[9px] text-neutral-500 block">Isento de taxa de antecipação</span>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
              <PiggyBank className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 block font-bold uppercase tracking-wider">Split Processando (48h)</span>
              <span className="text-xl font-heading font-bold text-amber-450">{formatBRL(740.00)}</span>
              <span className="text-[9px] text-[#D4AF37] block">Aguardando liquidação bancária</span>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl shrink-0">
              <Hourglass className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090b] border-neutral-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-550 block font-bold uppercase tracking-wider">Saques Efetuados</span>
              <span className="text-xl font-heading font-bold text-zinc-300">{formatBRL(12530.00)}</span>
              <span className="text-[9px] text-zinc-500 block">Transferências PIX efetuadas</span>
            </div>
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-zinc-400 shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#D4AF37]/5 to-[#09090b] border-[#D4AF37]/15">
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
            <div className="space-y-0.5">
              <span className="text-[10px] text-neutral-400 block font-bold uppercase tracking-wider">Liquidação Imediata</span>
              <p className="text-[11px] text-zinc-400 leading-normal font-light">Efetuar resgate do saldo disponível direto no PIX cadastrado do proprietário.</p>
            </div>
            <Button 
              onClick={handleTriggerWithdrawal}
              disabled={availableWithdrawal <= 0}
              className="w-full bg-[#D4AF37] hover:bg-[#c99f1c] text-black font-semibold h-8 rounded-xl text-xs flex items-center justify-center gap-1 leading-none tracking-wide pt-0.5"
            >
              <ArrowDownLeft className="w-4 h-4" /> Solicitar Saque
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulador de Split */}
        <Card className="bg-zinc-950 border-neutral-900 shadow-xl lg:col-span-1">
          <CardHeader className="border-b border-neutral-900/50 pb-4">
            <CardTitle className="text-sm font-heading font-semibold text-white uppercase flex items-center gap-1.5">
              <Scale className="w-4.5 h-4.5 text-[#D4AF37]" /> Divisor Split de Comissões
            </CardTitle>
            <CardDescription className="text-[11px] text-neutral-500">
              Insira o total cobrado de um serviço e veja a fragmentação instantânea de repasse.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleSimulateSplit} className="space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="text-neutral-400 font-medium block">Valor Bruto do Procedimento *</label>
                <Input
                  placeholder="Ex: 150,00"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  className="bg-neutral-900 text-white text-xs border-neutral-800 rounded-xl h-10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-neutral-400 font-medium block">Profissional Beneficiado *</label>
                <select
                  value={selectedPro}
                  onChange={(e) => setSelectedPro(e.target.value)}
                  className="w-full bg-neutral-905 text-white border border-neutral-800 rounded-xl p-2.5 h-10 outline-none"
                >
                  <option value="Clara Siqueira (Cabeleireira)">Clara Siqueira (Cabelo)</option>
                  <option value="Thiago Mendes (Barbeiro)">Thiago Mendes (Barba)</option>
                  <option value="Juliana Estetic (Esteticista)">Juliana Estetic (Estética)</option>
                  <option value="Manicure Parceira">Manicure Geral</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Cota do Salão (%)</label>
                  <Input
                    type="number"
                    value={salonCut}
                    onChange={(e) => setSalonCut(e.target.value)}
                    className="bg-neutral-900 text-white border-neutral-800 rounded-xl h-10"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium block">Cota do Profissional (%)</label>
                  <Input
                    type="number"
                    value={proCut}
                    onChange={(e) => setProCut(e.target.value)}
                    className="bg-neutral-900 text-white border-neutral-800 rounded-xl h-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-amber-600 text-black font-semibold h-10 rounded-xl transition-all pt-1">
                Calcular e Depositar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Maquininha Virtual Terminal POS & Ledger */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* virtual machine card */}
            <Card className="bg-zinc-950 border-neutral-900 shadow-xl">
              <CardHeader className="border-b border-neutral-900/50 pb-4">
                <CardTitle className="text-xs font-heading font-semibold text-white uppercase flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#D4AF37]" /> Maquininha Virtual LumièrePay
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 font-sans text-xs">
                <form onSubmit={generateQRCodePix} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-neutral-400 font-medium">Faturamento Direto (R$)</label>
                    <Input
                      placeholder="Ex: 80,00"
                      value={machineAmount}
                      onChange={(e) => setMachineAmount(e.target.value)}
                      className="bg-neutral-900 text-white border-neutral-800 rounded-xl h-9"
                    />
                  </div>

                  <Button type="submit" className="w-full h-9 border border-neutral-800 hover:bg-neutral-900 text-neutral-300 rounded-xl bg-transparent transition-all leading-none pt-0.5">
                    Simular Transação PIX / Cartão
                  </Button>
                </form>

                {qrCodeGenerated && (
                  <div className="pt-4 flex flex-col items-center justify-center space-y-2 mt-2 border-t border-neutral-900/60 p-2 rounded-xl bg-[#09090b]/80">
                    <QrCode className="w-24 h-24 text-white p-1 bg-white rounded-lg" />
                    <p className="text-[10px] text-emerald-400 font-bold block animate-pulse uppercase">⚡ QR Code Pix Dinâmico Gerado</p>
                    <p className="text-[9px] text-zinc-500">Leia via banco do cliente para concluir faturamento.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Split specifications description */}
            <Card className="bg-zinc-950 border-neutral-900 shadow-xl">
              <CardHeader className="border-b border-neutral-900/50 pb-4">
                <CardTitle className="text-xs font-heading font-semibold text-[#D4AF37] uppercase">Vantagens de Bitributação</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-sans text-xs text-zinc-400 font-light leading-relaxed">
                <p>
                  O LumièrePay opera com <b>repasse fiscal integrado (Lei do Salão Parceiro)</b>. O imposto sobre serviços do salão cai de 15% para <b>6%</b> médios, pois a porção tributável referente às comissões é repartida diretamente em nota fiscal simplificada emitida aos profissionais subcontratados.
                </p>
                <div className="p-3 bg-neutral-950 rounded-xl text-[10px] space-y-1 block border border-neutral-900">
                  <p className="font-bold text-white uppercase tracking-wider">💳 Máquinas Credenciadas</p>
                  <p>Taxa especial débito: <b>1.19%</b> | Crédito à vista: <b>2.38%</b> • Transferência via PIX diário gratuito.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ledger of Split transactions */}
          <Card className="bg-zinc-950 border-neutral-900">
            <CardHeader className="p-4 border-b border-neutral-900/40 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-heading font-semibold text-white uppercase flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#D4AF37]" /> Extrato do Repasse Split LumièrePay
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto text-xs font-sans text-neutral-350">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-neutral-900 font-light">
                    {payoutsMade.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-900/10">
                        <td className="p-4 pl-6 font-mono text-[10px] text-zinc-500">{p.date}</td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">{p.description}</span>
                            <span className="text-[10px] text-zinc-500 uppercase">Profissional Parceiro: {p.proName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col font-mono text-[11px]">
                            <span className="text-zinc-500">Total: {formatBRL(p.total)}</span>
                            <span className="text-emerald-400">Salão Cut: {formatBRL(p.salon)}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right pr-6">
                          <div className="flex flex-col items-end">
                            <span className="text-[#D4AF37] font-semibold font-mono">{formatBRL(p.professional)}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-lg font-bold leading-none mt-1 ${
                              p.status === "pago" ? "bg-emerald-500/10 text-emerald-450" : "bg-amber-500/10 text-amber-550"
                            }`}>
                              {p.status === "pago" ? "Split Sinc" : "Processando"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

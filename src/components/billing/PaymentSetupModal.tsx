import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  Headphones, 
  Lock, 
  TrendingUp, 
  QrCode, 
  FileText, 
  Calendar, 
  Clock, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface PaymentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonData: any;
  onSuccess?: () => void;
}

type Cycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';
type Method = 'CREDIT_CARD' | 'PIX' | 'BOLETO';

export function PaymentSetupModal({
  isOpen,
  onClose,
  salonData,
  onSuccess
}: PaymentSetupModalProps) {
  const isEssenza = /essenza/i.test(String(salonData?.name || ''));
  const basePrice = Number(salonData?.billing?.value || 397);

  const [selectedCycle, setSelectedCycle] = useState<Cycle>('SEMIANNUALLY');
  const [selectedMethod, setSelectedMethod] = useState<Method>('CREDIT_CARD');
  const [submitting, setSubmitting] = useState(false);

  // Cálculo de valores com descontos reais (SEM 2 meses grátis)
  // Semestral: 10% OFF
  // Anual: 15% OFF
  const cycleData = {
    MONTHLY: {
      name: 'Mensal',
      discountPct: 0,
      monthlyEq: basePrice,
      totalCycle: basePrice,
      savings: 0,
      badge: 'Flexibilidade Mensal',
      perks: [
        'Cobrança mensal no dia 02',
        'Acesso completo a todos os módulos e agenda',
        'Suporte técnico via chamado e WhatsApp em horário comercial',
        'Cancelamento flexível a cada ciclo mensal'
      ]
    },
    SEMIANNUALLY: {
      name: 'Semestral',
      discountPct: 10,
      monthlyEq: Math.round(basePrice * 0.90 * 100) / 100,
      totalCycle: Math.round(basePrice * 6 * 0.90),
      savings: Math.round(basePrice * 6 * 0.10),
      badge: '10% OFF • Mais Recomendado',
      perks: [
        '10% de Desconto Real em todas as mensalidades',
        'Economia imediata de R$ ' + Math.round(basePrice * 6 * 0.10).toLocaleString('pt-BR') + ' no semestre',
        'Atendimento VIP Prioritário com linha direta no WhatsApp',
        'Auditoria Semestral de Indicadores & Lucratividade do salão',
        'Estabilidade garantida por 6 meses sem risco de bloqueio'
      ]
    },
    YEARLY: {
      name: 'Anual',
      discountPct: 15,
      monthlyEq: Math.round(basePrice * 0.85 * 100) / 100,
      totalCycle: Math.round(basePrice * 12 * 0.85),
      savings: Math.round(basePrice * 12 * 0.15),
      badge: '15% OFF • Maior Economia',
      perks: [
        '15% de Desconto Máximo em todas as mensalidades',
        'Maior Economia: R$ ' + Math.round(basePrice * 12 * 0.15).toLocaleString('pt-BR') + ' economizados no ano',
        'Congelamento de Tarifa garantido por 12 meses (sem reajustes)',
        'Consultoria Estratégica Individual de Metas & Comissões da Equipe',
        'Atendimento VIP Dedicado com linha direta exclusiva',
        'Parcelamento sem juros em até 12x no cartão de crédito'
      ]
    }
  };

  const currentCycleInfo = cycleData[selectedCycle];

  const handleSavePaymentPreference = async () => {
    if (!salonData?.id) {
      toast.error('Identificador do salão não encontrado.');
      return;
    }

    try {
      setSubmitting(true);
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : null;

      // 1. Tenta atualizar via rota backend
      if (idToken) {
        try {
          const res = await fetch('/api/billing/update-payment-method', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              salonId: salonData.id,
              paymentMethod: selectedMethod,
              billingCycle: selectedCycle,
              planId: salonData?.billing?.planId || salonData?.plan || 'essential'
            })
          });

          const data = await res.json();
          if (data.checkoutUrl) {
            toast.success('Forma de pagamento selecionada! Redirecionando para o ambiente seguro...');
            window.location.assign(data.checkoutUrl);
            return;
          }
        } catch (apiErr) {
          console.warn('[PaymentSetupModal] Backend call fallback to Firestore update', apiErr);
        }
      }

      // 2. Grava a definição diretamente no Firestore do salão
      const salonRef = doc(db, 'salons', salonData.id);
      await updateDoc(salonRef, {
        'billing.paymentMethod': selectedMethod,
        'billing.billingCycle': selectedCycle,
        'billing.paymentMethodDefined': true,
        'billing.paymentMethodConfiguredAt': new Date().toISOString(),
        'billing.discountApplied': currentCycleInfo.discountPct,
        'billing.cycleSavings': currentCycleInfo.savings,
        'billing.updatedAt': new Date().toISOString(),
        updatedAt: Date.now()
      });

      toast.success(
        `Forma de pagamento definida com sucesso! Ciclo ${currentCycleInfo.name} com ${selectedMethod === 'CREDIT_CARD' ? 'Cartão de Crédito' : selectedMethod === 'PIX' ? 'PIX' : 'Boleto'}.`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao definir forma de pagamento:', err);
      toast.error(err.message || 'Falha ao salvar preferências de faturamento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#DFC498] bg-[#DFC498]/10 px-2.5 py-0.5 rounded-full border border-[#DFC498]/20 font-mono">
              Faturamento Inteligente LumièreOS
            </span>
            {isEssenza && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                Essenza Studio di Bellezza • Vencimento Dia 02
              </span>
            )}
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#DFC498]" />
            Defina sua Forma de Pagamento & Escolha suas Vantagens
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8FAEA2] leading-relaxed">
            Selecione a periodicidade que melhor se adapta ao fluxo de caixa do seu negócio. Planos semestrais e anuais garantem descontos reais e suporte VIP prioritário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* PASSO 1: ESCOLHA DA PERIODICIDADE (COM VANTAGENS DESTACADAS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#DFC498] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> 1. Escolha a Periodicidade (Ciclo)
              </label>
              <span className="text-[11px] text-[#8FAEA2]">Sem taxas ocultas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Opção Mensal */}
              <div 
                onClick={() => setSelectedCycle('MONTHLY')}
                className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedCycle === 'MONTHLY'
                    ? 'bg-[#DFC498]/10 border-[#DFC498] shadow-lg shadow-[#DFC498]/5 ring-1 ring-[#DFC498]'
                    : 'bg-black/30 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Mensal</span>
                    {selectedCycle === 'MONTHLY' && <CheckCircle2 className="w-4 h-4 text-[#DFC498]" />}
                  </div>
                  <p className="text-xl font-bold text-white">
                    R$ {cycleData.MONTHLY.monthlyEq.toLocaleString('pt-BR')}
                    <span className="text-[10px] font-normal text-[#8FAEA2]">/mês</span>
                  </p>
                  <span className="text-[10px] text-[#8FAEA2] block">Vencimento todo dia 02</span>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-[#8FAEA2]">
                  Flexibilidade mensal padrão
                </div>
              </div>

              {/* Opção Semestral */}
              <div 
                onClick={() => setSelectedCycle('SEMIANNUALLY')}
                className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedCycle === 'SEMIANNUALLY'
                    ? 'bg-[#DFC498]/15 border-[#DFC498] shadow-xl shadow-[#DFC498]/10 ring-2 ring-[#DFC498]'
                    : 'bg-black/30 border-white/10 hover:border-[#DFC498]/40'
                }`}
              >
                <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-[#DFC498] to-[#997C4D] text-[#04140F] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
                  10% OFF • Mais Vendido
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Semestral</span>
                    {selectedCycle === 'SEMIANNUALLY' && <CheckCircle2 className="w-4 h-4 text-[#DFC498]" />}
                  </div>
                  <p className="text-xl font-bold text-[#DFC498]">
                    R$ {cycleData.SEMIANNUALLY.monthlyEq.toLocaleString('pt-BR')}
                    <span className="text-[10px] font-normal text-[#8FAEA2]">/mês</span>
                  </p>
                  <span className="text-[10px] text-emerald-400 font-medium block">
                    Economize R$ {cycleData.SEMIANNUALLY.savings.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-zinc-300">
                  + Suporte Prioritário VIP WhatsApp
                </div>
              </div>

              {/* Opção Anual */}
              <div 
                onClick={() => setSelectedCycle('YEARLY')}
                className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedCycle === 'YEARLY'
                    ? 'bg-[#DFC498]/15 border-[#DFC498] shadow-xl shadow-[#DFC498]/10 ring-2 ring-[#DFC498]'
                    : 'bg-black/30 border-white/10 hover:border-[#DFC498]/40'
                }`}
              >
                <div className="absolute -top-2.5 right-3 bg-emerald-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
                  15% OFF • Máxima Economia
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Anual</span>
                    {selectedCycle === 'YEARLY' && <CheckCircle2 className="w-4 h-4 text-[#DFC498]" />}
                  </div>
                  <p className="text-xl font-bold text-emerald-400">
                    R$ {cycleData.YEARLY.monthlyEq.toLocaleString('pt-BR')}
                    <span className="text-[10px] font-normal text-[#8FAEA2]">/mês</span>
                  </p>
                  <span className="text-[10px] text-emerald-400 font-medium block">
                    Economize R$ {cycleData.YEARLY.savings.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-zinc-300">
                  + Tarifa Congelada 12 Meses
                </div>
              </div>
            </div>

            {/* Caixa com Vantagens Exclusivas da Opção Selecionada */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#DFC498]" /> Vantagens Inclusas no Ciclo {currentCycleInfo.name}:
                </span>
                {currentCycleInfo.savings > 0 && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold">
                    Economia Real: R$ {currentCycleInfo.savings.toLocaleString('pt-BR')}
                  </Badge>
                )}
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#8FAEA2] pt-1">
                {currentCycleInfo.perks.map((perk, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-zinc-200">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* PASSO 2: ESCOLHA DA FORMA DE PAGAMENTO */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#DFC498] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> 2. Escolha o Método de Cobrança
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cartão de Crédito */}
              <div 
                onClick={() => setSelectedMethod('CREDIT_CARD')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                  selectedMethod === 'CREDIT_CARD'
                    ? 'bg-[#DFC498]/10 border-[#DFC498] ring-1 ring-[#DFC498]'
                    : 'bg-black/30 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CreditCard className="w-4 h-4 text-[#DFC498]" />
                  <span className="text-[10px] font-bold text-[#DFC498] uppercase">Recomendado</span>
                </div>
                <h4 className="text-xs font-bold text-white">Cartão de Crédito</h4>
                <p className="text-[11px] text-[#8FAEA2] leading-tight">
                  Cobrança automática no dia 02. Zero risco de esquecimento ou bloqueio da agenda.
                </p>
              </div>

              {/* PIX */}
              <div 
                onClick={() => setSelectedMethod('PIX')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                  selectedMethod === 'PIX'
                    ? 'bg-[#DFC498]/10 border-[#DFC498] ring-1 ring-[#DFC498]'
                    : 'bg-black/30 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Instantâneo</span>
                </div>
                <h4 className="text-xs font-bold text-white">PIX Automático / Chave</h4>
                <p className="text-[11px] text-[#8FAEA2] leading-tight">
                  QR Code e chave Pix enviados 3 dias antes do dia 02 no WhatsApp e e-mail.
                </p>
              </div>

              {/* Boleto */}
              <div 
                onClick={() => setSelectedMethod('BOLETO')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                  selectedMethod === 'BOLETO'
                    ? 'bg-[#DFC498]/10 border-[#DFC498] ring-1 ring-[#DFC498]'
                    : 'bg-black/30 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-bold text-blue-400 uppercase">Bancário</span>
                </div>
                <h4 className="text-xs font-bold text-white">Boleto Bancário</h4>
                <p className="text-[11px] text-[#8FAEA2] leading-tight">
                  Boleto com linha digitável enviado com 5 dias úteis de antecedência do dia 02.
                </p>
              </div>
            </div>
          </div>

          {/* Resumo Final & CTA */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-black/50 via-[#0A261E] to-black/50 border border-[#DFC498]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-[#8FAEA2]">Resumo da Contratação:</div>
              <div className="text-base font-bold text-white">
                Plano {currentCycleInfo.name} • Total R$ {currentCycleInfo.totalCycle.toLocaleString('pt-BR')}
                {currentCycleInfo.discountPct > 0 && (
                  <span className="text-xs text-emerald-400 font-semibold ml-2">
                    ({currentCycleInfo.discountPct}% OFF aplicado)
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#8FAEA2]">
                {isEssenza ? 'Vencimentos fixos todo dia 02 de cada ciclo.' : 'Próximo vencimento calculado automaticamente.'}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="border-white/10 text-[#8FAEA2] hover:text-white rounded-xl text-xs h-10 px-4"
              >
                Decidir Depois
              </Button>

              <Button
                onClick={handleSavePaymentPreference}
                disabled={submitting}
                className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold rounded-xl text-xs h-10 px-6 gap-2 shadow-lg shadow-[#DFC498]/20 flex-1 sm:flex-none cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    Confirmar e Ativar Vantagens <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

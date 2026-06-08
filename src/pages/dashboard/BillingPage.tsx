import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Payment, PlanType } from '../../types';
import { BILLING_CONFIG } from '../../config/billing';
import { PLANS_CONFIG } from '../../config/plans';
import { 
  formatCurrencyBRL, 
  getPlanAmount, 
  getPlanLabel, 
  getFounderPriceInfo,
  getSubscriptionStatusLabel,
  getPaymentStatusLabel
} from '../../lib/billing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  CreditCard, 
  Key, 
  Copy, 
  MessageCircle, 
  CheckCircle2, 
  CalendarDays, 
  History, 
  FileText, 
  DollarSign, 
  AlertTriangle, 
  Activity, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Info,
  Loader2
} from 'lucide-react';

export default function BillingPage() {
  const { currentUser, userData, salonData, isPlatformAdmin } = useAuth();
  
  // Real Payments history from subcollection
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Local state for actions
  const [isReportingPay, setIsReportingPay] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Novo estado para assinatura MP
  const [isCreatingMP, setIsCreatingMP] = useState(false);

  useEffect(() => {
    if (!salonData) return;

    // Listen to real-time payments list
    const q = query(collection(db, `salons/${salonData.id}/payments`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const arr: Payment[] = [];
      snapshot.forEach((doc) => {
        arr.push({ id: doc.id, ...doc.data() } as Payment);
      });
      // Sort payments descendently by reported/createdAt date
      arr.sort((a, b) => (b.reportedAt || b.createdAt) - (a.reportedAt || a.createdAt));
      setPayments(arr);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar pagamentos da subcoleção:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [salonData]);

  const isAuthorized = userData?.role === 'owner' || isPlatformAdmin || userData?.role === 'admin';
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center text-zinc-400">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <ShieldCheck className="w-8 h-8 text-red-500 animate-pulse" />
        </div>
        <h3 className="text-xl font-heading mb-2 text-white">Acesso Reservado</h3>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
          Operação não autorizada. Essa seção com gestão de cobranças de assinatura do LumièreOS é reservada exclusivamente para a proprietária (owner) ou administradores do sistema.
        </p>
      </div>
    );
  }

  if (!salonData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-400">
        <AlertTriangle className="w-12 h-12 text-[#D4AF37] mb-4 animate-bounce" />
        <h3 className="text-lg font-semibold text-white">Salão não localizado</h3>
        <p className="text-sm text-zinc-500 mt-1">Carregue suas configurações antes de acessar faturamento.</p>
      </div>
    );
  }

  const currentPlanConfig = PLANS_CONFIG[salonData.plan as PlanType] || PLANS_CONFIG.start;
  const currentPlanAmount = getPlanAmount(salonData.plan as PlanType);
  const isStripeActive = false;

  const handleCopyPIX = () => {
    navigator.clipboard.writeText(BILLING_CONFIG.pixKey);
    setCopiedKey(true);
    toast.success('Chave PIX copiada com sucesso!');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleWhatsAppSupport = () => {
    const text = `Olá, vim pela área financeira do LumiereOS. Gostaria de tirar dúvidas ou validar pagamento para o salão: *${salonData.name}* (ID: ${salonData.id}).`;
    window.open(`https://wa.me/${BILLING_CONFIG.supportWhatsApp}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleReportPayment = async () => {
    if (!currentUser || !userData) {
      toast.error("Autenticação necessária.");
      return;
    }
    setIsReportingPay(true);
    try {
      const paymentRef = doc(collection(db, `salons/${salonData.id}/payments`));
      const newPayment = {
        id: paymentRef.id,
        salonId: salonData.id,
        plan: salonData.plan,
        amount: currentPlanAmount,
        method: 'pix',
        status: 'reported',
        reportedByUserId: currentUser.uid,
        reportedByEmail: currentUser.email || '',
        reportedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        provider: 'manual_pix'
      };

      await setDoc(paymentRef, newPayment);
      
      const salonRef = doc(db, 'salons', salonData.id);
      await updateDoc(salonRef, {
        paymentStatus: 'reported',
        subscriptionStatus: 'pending_payment',
        updatedAt: Date.now(),
      });

      toast.success('Notificação de pagamento enviada com sucesso! Nossa equipe financeira irá validar.');
    } catch (error: any) {
      console.error('Erro ao reportar PIX:', error);
      toast.error('Erro ao registrar aviso de pagamento: ' + (error.message || error));
    } finally {
      setIsReportingPay(false);
    }
  };

  const handleCreateMPSubscription = async () => {
    if (!currentUser || !userData) return toast.error("Autenticação necessária.");
    setIsCreatingMP(true);
    try {
      const token = await currentUser.getIdToken();
      // Em ambiente de preview/dev a API local e Vercel usam mesmo base path do app
      const response = await fetch('/api/mercadopago/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          salonId: salonData.id,
          plan: salonData.plan
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar assinatura com Mercado Pago');
      }

      if (data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        throw new Error('Link de pagamento não retornado');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Não foi possível iniciar a assinatura pelo Mercado Pago. Você ainda pode usar o sistema normalmente e falar com o suporte.');
    } finally {
      setIsCreatingMP(false);
    }
  };

  // Stripe integration handlers removed for complete offline manual PIX faturamento system

  // Human date formatting helpers
  const formatDate = (ms: number | undefined | null) => {
    if (!ms) return '-';
    return new Date(ms).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-heading">Minha Assinatura</h2>
          <p className="text-sm text-zinc-400">Gerencie seu plano premium, histórico de faturas e pagamentos corporativos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleWhatsAppSupport} variant="outline" size="sm" className="border-white/10 hover:bg-white/5 font-sans h-9 rounded-xl flex items-center gap-1.5 text-zinc-300">
            <MessageCircle className="w-4.5 h-4.5 text-green-500" />
            <span>Suporte Financeiro</span>
          </Button>
        </div>
      </div>

      {/* Institutional Message */}
      <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/25 p-4 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5 filter drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]" />
        <p className="text-xs md:text-sm text-zinc-300 leading-relaxed font-sans">
          Esta área reúne informações da sua assinatura. No momento, a cobrança é acompanhada diretamente pela equipe <b>Galiciori e Fonseca Estratégia Digital</b>.
        </p>
      </div>

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column (Plano Atual + Próxima Cobrança + Métodos) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section 1: Plano Atual Info */}
          <Card id="billing-current-plan" className="bg-gradient-to-br from-[#0c0d12] to-[#040405] border-[#D4AF37]/25 shadow-[0_4px_30px_rgba(212,175,55,0.02)] rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-5 opacity-5 pointer-events-none">
              <Zap className="w-36 h-36 text-[#D4AF37]" />
            </div>
            
            <CardHeader className="border-b border-white/5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] px-2.5 py-1 bg-[#D4AF37]/10 rounded-full border border-[#D4AF37]/20">
                    SaaS Corporativo
                  </span>
                  <CardTitle className="text-xl font-bold text-white mt-2.5 font-heading">
                    {getPlanLabel(salonData.plan)}
                  </CardTitle>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#D4AF37] font-sans">
                    {formatCurrencyBRL(currentPlanAmount)}
                  </span>
                  <span className="text-xs text-zinc-400 block font-light">/mensal</span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6 space-y-6">
              {/* Features and status checklist inline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Parâmetros do Plano</p>
                  <ul className="space-y-2.5 text-xs text-zinc-300">
                    <li className="flex items-center gap-2 font-sans font-light">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                      <span>Limite de profissionais: <b>{currentPlanConfig.maxProfessionals === 999 ? 'Ilimitados' : `${currentPlanConfig.maxProfessionals} Profissionais`}</b></span>
                    </li>
                    <li className="flex items-center gap-2 font-sans font-light">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                      <span>Regulamento de rede: <b>Acesso Completo</b></span>
                    </li>
                    <li className="flex items-center gap-2 font-sans font-light">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                      <span>Futuras atualizações inclusas: <b>{currentPlanConfig.includesFutureUpdates ? 'Sim' : 'Somente correções'}</b></span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Status de Ativação</p>
                  <div className="bg-zinc-900/50 rounded-xl p-3.5 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Assinatura:</span>
                      <span className="font-semibold text-[#D4AF37] capitalize">
                        {getSubscriptionStatusLabel(salonData.subscriptionStatus)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Renovação prevista:</span>
                      <span className="font-semibold text-white">
                        {salonData.nextBillingDate ? formatDate(salonData.nextBillingDate) : formatDate(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Método de pagamento:</span>
                      <span className="font-semibold text-[#D4AF37]">
                        {salonData.billingProvider === 'mercadopago' ? 'Cartão / Mercado Pago' : isStripeActive ? 'Cartão de Crédito Recorrente' : 'PIX Manual'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {salonData.plan === 'founder' && (
                <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/25 p-3.5 rounded-xl flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5 filter drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]" />
                  <p className="text-xs text-[#D4AF37]/95 leading-relaxed font-sans">
                    <b>Parceiro Fundador:</b> Você possui acesso prioritário garantido no programa piloto Essenza. {getFounderPriceInfo(salonData)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Formas de Pagamento & Gateway Interactions */}
          <div id="billing-gateways-container" className="space-y-4">
            <h3 className="text-base font-semibold text-white font-heading flex items-center gap-2">
              <CreditCard className="w-4.5 h-4.5 text-[#D4AF37]" />
              Método de faturamento
            </h3>
            
            <div className="bg-gradient-to-br from-[#0c0d12] to-[#040405] border border-[#D4AF37]/20 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37] px-2 py-0.5 bg-[#D4AF37]/10 rounded-md border border-[#D4AF37]/20">
                      PIX / Acompanhamento Manual
                    </span>
                    <span className="text-[10px] uppercase font-bold text-green-400 px-2 py-0.5 bg-green-400/10 border border-green-400/20 rounded-md">Ativo</span>
                  </div>
                  <h4 className="text-base font-heading font-semibold text-white mt-1.5">Pagamento registrado via PIX</h4>
                  <p className="text-xs text-zinc-300 font-light font-sans">
                    Sua assinatura está em acompanhamento administrativo.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <Button 
                    onClick={handleWhatsAppSupport} 
                    className="bg-green-600 hover:bg-green-700 text-white font-sans text-xs font-semibold px-4 py-2 h-9 rounded-xl flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Suporte Financeiro</span>
                  </Button>
                </div>
              </div>

              <div className="border-t border-white/5 pt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Plano Atual</p>
                  <p className="text-xs text-white font-bold mt-1.5 capitalize">{getPlanLabel(salonData.plan)}</p>
                </div>
                <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Status do Plano</p>
                  <p className="text-xs text-green-400 font-bold mt-1.5">Ativo / Regular</p>
                </div>
                <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Forma de Pagamento</p>
                  <p className="text-xs text-[#D4AF37] font-bold mt-1.5">PIX / Acompanhamento Manual</p>
                </div>
              </div>

              {/* PIX Details Copy & Confirm inside the same container */}
              <div className="border-t border-white/5 pt-5 space-y-4">
                <p className="text-xs font-semibold text-zinc-400">Deseja informar um novo pagamento via PIX?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5 text-xs text-zinc-300">
                    <span className="truncate font-mono font-medium flex-1">{BILLING_CONFIG.pixKey}</span>
                    <button 
                      onClick={handleCopyPIX} 
                      className="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer"
                      title="Copiar Chave PIX"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <Button 
                    onClick={handleReportPayment} 
                    disabled={isReportingPay}
                    variant="outline" 
                    className="text-xs h-9 border-[#D4AF37]/25 hover:border-[#D4AF37]/45 text-[#D4AF37] hover:bg-[#D4AF37]/5 rounded-xl cursor-pointer font-semibold"
                  >
                    {isReportingPay ? 'Registrando dados...' : 'Confirmar Novo Pagamento PIX'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Histórico de Cobranças (Tabela Responsiva que vira Cards no celular) */}
          <div id="billing-history-container" className="space-y-4">
            <h3 className="text-base font-semibold text-white font-heading flex items-center gap-2">
              <History className="w-4.5 h-4.5 text-[#D4AF37]" />
              Histórico de Cobranças
            </h3>
            
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
              </div>
            ) : payments.length === 0 ? (
              <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-8 text-center text-zinc-500 text-xs">
                Nenhuma transação registrada no histórico do salão.
              </div>
            ) : (
              <div>
                {/* Desktop view table */}
                <div className="hidden md:block overflow-hidden border border-white/5 rounded-2xl bg-zinc-900/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-900/60 border-b border-white/5 text-zinc-400 font-medium">
                        <th className="p-4">Plano</th>
                        <th className="p-4">Data Relatada</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Meio de Transmissão</th>
                        <th className="p-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.01] transition-all">
                          <td className="p-4 font-semibold capitalize text-white">Plano {p.plan}</td>
                          <td className="p-4 text-zinc-400">{formatDate(p.reportedAt || p.createdAt)}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-nowrap select-none capitalize ${
                              p.status === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                              p.status === 'reported' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {getPaymentStatusLabel(p.status)}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-zinc-400 text-[11px]">{p.provider === 'mercadopago' ? 'Assinatura Mercado Pago' : p.provider === 'stripe' ? 'Cartão Integrado (Stripe)' : 'PIX Manual'}</td>
                          <td className="p-4 text-right font-bold text-[#D4AF37]">{formatCurrencyBRL(p.amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view Cards (transforming table into card stack) */}
                <div className="md:hidden space-y-3">
                  {payments.map((p) => (
                    <div key={p.id} className="bg-zinc-900/30 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white capitalize">Plano {p.plan}</span>
                        <span className="text-xs font-black text-[#D4AF37]">{formatCurrencyBRL(p.amount || 0)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 border-t border-white/5 pt-2.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Data de registro</p>
                          <p className="text-zinc-300 font-light mt-0.5">{formatDate(p.reportedAt || p.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Transmissão</p>
                          <p className="text-zinc-300 font-light mt-0.5">{p.provider === 'mercadopago' ? 'Mercado Pago' : p.provider === 'stripe' ? 'Stripe' : 'PIX'}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[11px]">
                        <span className="text-zinc-400">Situação:</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          p.status === 'paid' ? 'bg-green-500/10 text-green-400' : 
                          p.status === 'reported' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {getPaymentStatusLabel(p.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right column (Próximas faturas + Notas fiscais) */}
        <div className="space-y-8">
          
          {/* Section 4: Próximas Faturas */}
          <Card className="bg-zinc-950 border-white/5 rounded-2xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-white font-heading flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#D4AF37]" />
                Próximas Faturas
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">Cobranças agendadas de acordo com as datas de faturamento ativo.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {salonData.subscriptionStatus === 'trial' ? (
                <div className="space-y-3">
                  <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl">
                    <p className="text-xs text-amber-400 flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Período de Demonstração Ativo
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-1 font-light leading-relaxed">
                      Nenhuma fatura oficial foi gerada ainda. O faturamento iniciará ao término do período de avaliação.
                    </p>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-1">
                    <span className="text-zinc-400">Previsão 1ª Fatura:</span>
                    <span className="font-semibold text-white">
                      {salonData.trialEndsAt ? formatDate(salonData.trialEndsAt) : formatDate(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                    </span>
                  </div>
                </div>
              ) : salonData.subscriptionStatus === 'active' ? (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-green-500/5 rounded-xl border border-green-500/15 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-white">Próximo Vencimento</span>
                      <span className="font-bold text-[#D4AF37]">{formatCurrencyBRL(currentPlanAmount)}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-light mt-0.5">
                      Vencimento: <b>{salonData.nextBillingDate ? formatDate(salonData.nextBillingDate) : formatDate(Date.now() + 28 * 24 * 60 * 60 * 1000)}</b>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 text-xs text-center py-4">
                  Nenhuma próxima fatura encontrada.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 5: Notas Fiscais */}
          <Card className="bg-zinc-950 border-white/5 rounded-2xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold text-white font-heading flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D4AF37]" />
                Notas Fiscais (NFS-e)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3 text-zinc-500">
              <div className="flex items-center gap-2 p-1 text-xs">
                <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="text-zinc-400 leading-relaxed font-light">
                  Emissão de notas fiscais eletrônicas de serviços será disponibilizada de forma automatizada em uma próxima etapa nacional.
                </span>
              </div>
              <div className="bg-zinc-900/30 p-4 border border-dashed border-white/5 rounded-xl text-center text-xs">
                Nenhuma nota fiscal encontrada.
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}

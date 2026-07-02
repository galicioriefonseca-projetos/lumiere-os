import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Check, 
  CreditCard, 
  AlertTriangle, 
  ShieldCheck, 
  ExternalLink, 
  Loader2, 
  Users, 
  Calendar, 
  Coins, 
  Lock, 
  Zap, 
  Info,
  Clock,
  Copy
} from 'lucide-react';
import { PLANS_CONFIG } from '../../config/plans';
import { toast } from 'sonner';
import { billingService } from '../../services/billing/BillingService';

export default function SubscriptionPage() {
  const { salonData, refreshUserData } = useAuth();
  
  // States for activation flow
  const [isActivating, setIsActivating] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [document, setDocument] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix' | 'boleto'>('credit_card');
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  useEffect(() => {
    if (salonData?.plan) {
      setSelectedPlan(salonData.plan);
    }
  }, [salonData]);

  if (!salonData) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = salonData.plan || 'start';
  const planInfo = PLANS_CONFIG[currentPlan as keyof typeof PLANS_CONFIG] || PLANS_CONFIG.start;

  // Compute actual overdue days
  let daysOverdue = 0;
  const isOverdueState = salonData.subscriptionStatus === 'overdue' || salonData.paymentStatus === 'overdue';

  if (isOverdueState) {
    if (salonData.nextBillingDate && salonData.nextBillingDate < Date.now()) {
      daysOverdue = Math.floor((Date.now() - salonData.nextBillingDate) / (24 * 60 * 60 * 1000));
    } else {
      // Simulate overdue days based on dia 10 (vencimento oficial da cliente atual)
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const tenthOfThisMonth = new Date(currentYear, currentMonth, 10).getTime();
      
      if (Date.now() > tenthOfThisMonth) {
        daysOverdue = Math.floor((Date.now() - tenthOfThisMonth) / (24 * 60 * 60 * 1000));
      } else {
        const tenthOfPrevMonth = new Date(currentYear, currentMonth - 1, 10).getTime();
        daysOverdue = Math.floor((Date.now() - tenthOfPrevMonth) / (24 * 60 * 60 * 1000));
      }
    }
    // Guarantee at least 1 day if status is overdue
    if (daysOverdue <= 0) daysOverdue = 1;
  }

  // Formatting helpers
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (ts: number | undefined) => {
    if (!ts) return 'Não configurado';
    return new Date(ts).toLocaleDateString('pt-BR');
  };
  const handleActivate = async () => {
    if (!salonData.id) return;

    setIsActivating(true);
    try {
      toast.info('Sincronizando com o gateway Cakto...');
      
      // Step 1: Create subscription checkout on Cakto
      const subResult = await billingService.createSubscription(salonData.id, salonData.ownerEmail || '', {
        planId: selectedPlan,
        paymentMethod: paymentMethod,
      }) as any;

      // Step 2: Refresh and handle response
      await refreshUserData();
      
      toast.success('Assinatura iniciada com sucesso! Redirecionando...');
      setShowActivationModal(false);

      // Open checkout URL if returned
      const url = subResult.checkoutUrl || salonData.caktoCheckoutUrl;
      if (url) {
        window.open(url, '_blank');
      }
    } catch (err: any) {
      console.error("[Billing Page] Erro na ativação:", err);
      toast.error(err.message || 'Falha ao processar assinatura via Cakto.');
    } finally {
      setIsActivating(false);
    }
  };

  // Status mapping
  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'trial':
        return 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20';
      case 'pending_payment':
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'overdue':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'canceled':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'trial': return 'Período de Testes (7 dias)';
      case 'pending_payment':
      case 'pending': return 'Pagamento Pendente';
      case 'overdue': return 'Vencida / Atrasada';
      case 'canceled': return 'Cancelada';
      default: return status || 'Pendente';
    }
  };

  // Overdue status styling
  const isSuspended = daysOverdue > 15;
  const isPremiumBlocked = daysOverdue > 7;
  const isStrongWarning = daysOverdue >= 4 && daysOverdue <= 7;
  const isSoftWarning = daysOverdue > 0 && daysOverdue <= 3;

  const currentCheckoutUrl = salonData.caktoCheckoutUrl || salonData.asaasCheckoutUrl;

  return (
    <div className="relative min-h-screen bg-background space-y-6 pb-12 select-none text-white">
      
      {/* FULL-SCREEN SUSPENSION OVERLAY (Acima de 15 dias) */}
      {isSuspended && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="max-w-md w-full bg-zinc-950 border border-red-500/20 p-8 rounded-2xl shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Acesso Suspenso</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Sua assinatura do LumièreOS está atrasada há <span className="text-red-400 font-bold">{daysOverdue} dias</span> (vencimento oficial dia 10). O acesso ao sistema está temporariamente suspenso.
              </p>
            </div>
            
            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-left space-y-2 text-xs text-zinc-400">
              <p className="flex items-center gap-2 text-white font-medium">
                <Info className="w-3.5 h-3.5 text-red-400" /> Como regularizar:
              </p>
              <p>1. Clique em "Regularizar Agora" abaixo.</p>
              <p>2. Complete o faturamento via checkout seguro.</p>
              <p>3. Após a compensação, seu acesso será restabelecido imediatamente.</p>
            </div>

            <div className="flex flex-col gap-3">
              {currentCheckoutUrl ? (
                <button 
                  type="button"
                  onClick={() => window.open(currentCheckoutUrl, '_blank')}
                  className="w-full bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold h-11 rounded-xl flex items-center justify-center gap-2 transition-colors duration-150"
                >
                  <CreditCard className="w-4 h-4" /> Pagar Assinatura (Fatura Pix/Cartão) <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowActivationModal(true)}
                  className="w-full bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold h-11 rounded-xl flex items-center justify-center gap-2 transition-colors duration-150"
                >
                  <Zap className="w-4 h-4" /> Regularizar Agora
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-heading text-white">Minha Assinatura</h1>
          <p className="text-sm text-zinc-400 mt-1">Gerencie seu plano LumièreOS, limites de colaboradores e faturamento.</p>
        </div>
        
        {/* Real-time status display */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Status atual:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${getBadgeClass(salonData.subscriptionStatus)}`}>
            {getStatusText(salonData.subscriptionStatus)}
          </span>
        </div>
      </div>

      {/* WARNING BANNERS BASED ON OVERDUE DAYS */}
      {isPremiumBlocked && !isSuspended && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-400 shrink-0">
              <Lock className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Recursos Premium Bloqueados!</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Seu pagamento está em atraso há <span className="text-red-400 font-bold">{daysOverdue} dias</span> (limite de 7 dias tolerado).
                Insights de IA, relatórios executivos e gamificação estão bloqueados temporariamente até a regularização.
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="bg-red-500 hover:bg-red-600 text-white shrink-0 font-medium text-xs px-3 py-1.5 rounded-lg transition-colors duration-150"
            onClick={() => currentCheckoutUrl ? window.open(currentCheckoutUrl, '_blank') : setShowActivationModal(true)}
          >
            Pagar Fatura Pendente
          </button>
        </div>
      )}

      {isStrongWarning && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Alerta de Pagamento em Atraso</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Vencimento em atraso há <span className="text-orange-400 font-bold">{daysOverdue} dias</span>. 
                Regularize sua assinatura nas próximas 48h para evitar o bloqueio automático de recursos avançados do sistema.
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="bg-orange-500 hover:bg-orange-600 text-white shrink-0 font-medium text-xs px-3 py-1.5 rounded-lg transition-colors duration-150"
            onClick={() => currentCheckoutUrl ? window.open(currentCheckoutUrl, '_blank') : setShowActivationModal(true)}
          >
            Regularizar Assinatura
          </button>
        </div>
      )}

      {isSoftWarning && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Cobrança em Atraso (Dia 10)</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Sua faturamento de vencimento mensal (todo dia 10) está pendente há <span className="text-yellow-400 font-bold">{daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}</span>.
                Seu acesso continua ativo por tolerância. Regularize assim que puder para evitar problemas futuros.
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="bg-[#D4AF37] hover:bg-[#Bca032] text-black shrink-0 font-medium text-xs px-3 py-1.5 rounded-lg transition-colors duration-150"
            onClick={() => currentCheckoutUrl ? window.open(currentCheckoutUrl, '_blank') : setShowActivationModal(true)}
          >
            Ver Fatura Pix / Cartão
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL 1: PLAN CARDS & LIMITS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-black/40 text-white shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6 md:flex-row md:justify-between md:items-start md:space-y-0">
              <div>
                <h3 className="font-semibold tracking-tight text-white text-xl">Seu Plano Atual</h3>
                <p className="text-sm text-zinc-500">Detalhes operacionais e nível de acesso atual.</p>
              </div>
              <div className="flex flex-col items-start md:items-end">
                <span className="text-[#D4AF37] font-bold text-lg">{planInfo.name}</span>
                <span className="text-zinc-500 text-xs">{formatMoney(planInfo.monthlyAmount)} / mês</span>
              </div>
            </div>
            
            <div className="p-6 pt-0 space-y-6">
              {/* Limit status visual */}
              <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400 flex items-center gap-2"><Users className="w-4 h-4 text-[#D4AF37]" /> Limite de Profissionais</span>
                  <span className="text-white font-medium font-mono">
                    {planInfo.maxProfessionals === 999 ? 'Ilimitado' : `${planInfo.maxProfessionals} colaboradores`}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#D4AF37] h-full" 
                    style={{ width: planInfo.maxProfessionals === 999 ? '100%' : '50%' }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500">Sua conta suporta a inclusão de até {planInfo.maxProfessionals === 999 ? 'infinitos' : planInfo.maxProfessionals} profissionais no painel operacional.</p>
              </div>

              {/* Access status metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-900/30 border border-zinc-800/60 rounded-xl space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" /> Próximo Vencimento
                  </span>
                  <p className="text-sm font-semibold text-white">
                    {salonData.nextBillingDate ? formatDate(salonData.nextBillingDate) : 'Todo dia 10'}
                  </p>
                </div>

                <div className="p-3 bg-zinc-900/30 border border-zinc-800/60 rounded-xl space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-zinc-400" /> Forma de Faturamento
                  </span>
                  <p className="text-sm font-semibold text-white uppercase flex items-center gap-1 text-xs">
                    {salonData.billingProvider === 'cakto' ? '💳 CAKTO RECORRENTE' : salonData.billingProvider === 'asaas' ? '💳 ASAAS LEGADO' : '💸 PIX MANUAL / OUTROS'}
                  </p>
                </div>
              </div>

              {/* Plan inclusions list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Recursos inclusos no seu plano:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {planInfo.features.map((feat: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2.5 text-sm text-zinc-300">
                      <div className="w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-400 shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE RECURRENT LINK */}
          {(salonData.caktoCheckoutUrl || salonData.asaasCheckoutUrl) && (
            <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 text-white shadow-sm">
              <div className="flex flex-col space-y-1.5 p-6">
                <h3 className="font-semibold tracking-tight text-white text-md flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#D4AF37]" /> Link de Assinatura Ativo
                </h3>
                <p className="text-xs text-zinc-400">Você possui um fluxo de faturamento recorrente ativo via {salonData.billingProvider === 'cakto' ? 'Cakto' : 'Asaas'}.</p>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    type="button"
                    onClick={() => window.open(salonData.caktoCheckoutUrl || salonData.asaasCheckoutUrl, '_blank')}
                    className="bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold flex items-center justify-center gap-2 rounded-xl text-xs flex-1 h-10 transition-colors duration-150"
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir Checkout / Atualizar Forma de Pagamento no {salonData.billingProvider === 'cakto' ? 'Cakto' : 'Asaas'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(salonData.caktoCheckoutUrl || salonData.asaasCheckoutUrl || '');
                      toast.success('Link de checkout copiado!');
                    }}
                    className="border border-zinc-800 hover:bg-zinc-900 text-zinc-400 text-xs h-10 px-4 rounded-xl transition-colors duration-150 flex items-center justify-center"
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copiar Link
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* PANEL 2: BILLING & CALL TO ACTION */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-black/40 text-white shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <h3 className="font-semibold tracking-tight text-white text-lg">Ativação & Cobrança</h3>
              <p className="text-sm text-zinc-500">Inicie ou atualize seu faturamento recorrente via Cakto.</p>
            </div>
            <div className="p-6 pt-0 space-y-4">
              
              <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-[#D4AF37] font-semibold text-xs uppercase tracking-wider">
                  <Zap className="w-4 h-4" /> Benefícios Cakto
                </div>
                <ul className="text-xs text-zinc-400 space-y-2">
                  <li className="flex items-center gap-2">✔ Cobrança recorrente todo mês sem consumir limite do cartão</li>
                  <li className="flex items-center gap-2">✔ Recebimento imediato via Pix ou Cartão de Crédito</li>
                  <li className="flex items-center gap-2">✔ Alertas automáticos no faturamento</li>
                </ul>
              </div>

              {!salonData.caktoSubscriptionId ? (
                <button 
                  type="button"
                  onClick={() => setShowActivationModal(true)}
                  className="w-full bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold h-11 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors duration-150"
                >
                  <Zap className="w-4 h-4 fill-black" /> Ativar Assinatura Recorrente Cakto
                </button>
              ) : (
                <div className="space-y-3">
                  <button 
                    type="button"
                    onClick={() => {
                      if (salonData.caktoCheckoutUrl) {
                        window.open(salonData.caktoCheckoutUrl, '_blank');
                      } else {
                        toast.error('Nenhum link de checkout encontrado para esta assinatura Cakto.');
                      }
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-medium h-11 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors duration-150"
                  >
                    <CreditCard className="w-4 h-4" /> Atualizar Forma de Pagamento
                  </button>
                  <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg text-[10px] text-zinc-500 leading-normal">
                    <span>Sua assinatura está ativa via Cakto (ID: <code className="text-green-400 select-all font-mono">{salonData.caktoSubscriptionId}</code>). Qualquer alteração ou pagamento efetuado refletirá no sistema automaticamente via webhook.</span>
                  </div>
                </div>
              )}

              {salonData.asaasSubscriptionId && (
                <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80 space-y-2 text-xs text-zinc-400">
                  <p className="font-semibold text-zinc-300">Cobrança Legada Ativa (Asaas)</p>
                  <p className="text-[10px] leading-normal">Sua conta possui faturamento configurado pelo Asaas (ID: <code className="text-amber-400 font-mono select-all">{salonData.asaasSubscriptionId}</code>). O acesso de faturamento permanece garantido por este canal.</p>
                  {salonData.asaasCheckoutUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(salonData.asaasCheckoutUrl, '_blank')}
                      className="text-[#D4AF37] text-[10px] font-bold hover:underline flex items-center gap-1 mt-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" /> Abrir Link Legado do Asaas
                    </button>
                  )}
                </div>
              )}

              {/* Informative footer */}
              <p className="text-[10px] text-zinc-500 text-center leading-normal">
                Ao ativar você concorda com nossos Termos de Uso e Política de Privacidade. Cancelamento pode ser solicitado a qualquer momento sem taxas ocultas.
              </p>

            </div>
          </div>
        </div>

      </div>

      {/* ACTIVATION MODAL */}
      {showActivationModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#D4AF37]" /> Ativar Faturamento LumièreOS
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Gere sua assinatura recorrente segura na Cakto.</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowActivationModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-medium text-zinc-400">Plano Recomendado / Selecionado</label>
                <select 
                  value={selectedPlan} 
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="start">Plano Start (R$ 197/mês)</option>
                  <option value="studio">Plano Studio (R$ 397/mês)</option>
                  <option value="performance">Plano Performance (R$ 697/mês)</option>
                  <option value="network">Plano Network (R$ 1497/mês)</option>
                  <option value="founder">Plano Founder (R$ 297/mês)</option>
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-medium text-zinc-400">Método de Pagamento</label>
                <select 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="bg-zinc-950 border border-zinc-800 text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="credit_card">💳 Cartão de Crédito Recorrente</option>
                  <option value="pix">⚡ PIX Integrado</option>
                  <option value="boleto">📄 Boleto Bancário</option>
                </select>
              </div>

              <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80 space-y-1 text-[11px] text-zinc-400 leading-normal">
                <p className="font-semibold text-white flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Segurança dos Seus Dados</p>
                <p>O LumièreOS não armazena dados de pagamento. Todo o processamento é executado de forma criptografada pelo checkout seguro da Cakto.</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button 
                type="button"
                onClick={() => setShowActivationModal(false)}
                className="text-zinc-400 hover:text-white text-xs px-4 py-2 transition-colors duration-150"
                disabled={isActivating}
              >
                Voltar
              </button>
              <button 
                type="button"
                onClick={handleActivate}
                disabled={isActivating}
                className="bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold rounded-xl flex items-center justify-center gap-2 px-5 h-10 text-xs transition-colors duration-150"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-black" /> Confirmar e Ir para Pagamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

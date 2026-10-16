import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, AlertTriangle, Sparkles, ShieldAlert, ArrowRight, X, Gift, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateBR } from '@/lib/utils';
import { PaymentSetupModal } from '@/components/billing/PaymentSetupModal';

interface DashboardSubscriptionBannerProps {
  salonData: any;
  isPlatformAdmin: boolean;
}

export function DashboardSubscriptionBanner({ 
  salonData, 
  isPlatformAdmin
}: DashboardSubscriptionBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // Platform admin não necessita de banner de assinatura
  if (isPlatformAdmin || !salonData) return null;

  const isEssenza = /essenza/i.test(String(salonData?.name || ''));
  const isPreview = salonData?.subscriptionStatus === 'preview';
  const plan = salonData?.plan || 'Performance';
  
  // Status financeiro
  const billingStatus = String(salonData?.billing?.status || salonData?.subscriptionStatus || salonData?.paymentStatus || '').toUpperCase();
  const isOverdue = ['OVERDUE', 'ATRASADO', 'VENCIDO'].includes(billingStatus);
  const isPendingPayment = ['PENDING_PAYMENT', 'PENDING', 'AGUARDANDO_PAGAMENTO'].includes(billingStatus) || salonData?.paymentStatus === 'pending';
  
  // Forma de pagamento pendente / não definida
  const isPaymentMethodUndefined = !salonData?.billing?.paymentMethod || 
    salonData?.billing?.paymentMethod === 'UNDEFINED' || 
    salonData?.billing?.paymentMethodDefined === false;

  // Resolução da data de vencimento do Essenza (Sempre dia 02 de cada mês)
  const today = new Date();
  const currentDay = today.getDate();
  const isDueDay = currentDay === 2;
  const isPastDueDay = currentDay > 2;

  // No Essenza, a data de vencimento é sempre dia 02
  const essenzaDueDateStr = salonData?.billing?.nextDueDate || '2026-10-02';
  const formattedEssenzaDate = formatDateBR(essenzaDueDateStr);

  // 1. BANNER DE ESTÍMULO: FORMA DE PAGAMENTO NÃO DEFINIDA (ESSENZA E DEMAIS SALÕES)
  if (isPaymentMethodUndefined && !dismissed) {
    return (
      <>
        <div className="mb-6 space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-[#DFC498]/50 bg-gradient-to-r from-[#0A261E] via-[#0D3328] to-[#0A261E] p-4 sm:p-5 shadow-2xl shadow-[#DFC498]/10">
            <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[#DFC498]/10 blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#DFC498]/20 border border-[#DFC498]/40 flex items-center justify-center text-[#DFC498] shrink-0 mt-0.5 shadow-inner">
                  <Sparkles className="w-5 h-5 text-[#DFC498] animate-pulse" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#DFC498] font-mono flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#DFC498]" />
                      Forma de Pagamento Pendente • Escolha seu Ciclo
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                      Até 15% OFF + Suporte VIP
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
                      {isEssenza ? 'Vencimento Fixo: Dia 02' : 'Evite Interrupções'}
                    </span>
                  </div>

                  <h3 className="text-sm md:text-base font-semibold text-white tracking-tight">
                    {isEssenza 
                      ? 'Defina a forma de pagamento do Essenza Studio di Bellezza e ative vantagens exclusivas.' 
                      : 'Configure a sua forma de pagamento preferida para manter sua conta 100% ativa.'}
                  </h3>
                  
                  <p className="text-xs text-[#8FAEA2] leading-relaxed font-light max-w-3xl">
                    Selecione como prefere efetuar o acerto da sua assinatura. Optando pelo <strong className="text-white font-medium">Semestral (10% OFF)</strong> ou <strong className="text-white font-medium">Anual (15% OFF com Tarifa Congelada)</strong>, você economiza até R$ 714,00 e ganha atendimento VIP prioritário via WhatsApp para você e sua equipe.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 self-start md:self-center">
                <Button 
                  size="sm" 
                  onClick={() => setIsSetupModalOpen(true)}
                  className="w-full md:w-auto bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold rounded-xl text-xs h-9.5 px-5 transition-all font-sans cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#DFC498]/20 border border-[#DFC498]/40"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Definir Pagamento & Vantagens
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>

                <button
                  onClick={() => setDismissed(true)}
                  className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-900/50"
                  title="Minimizar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <PaymentSetupModal
          isOpen={isSetupModalOpen}
          onClose={() => setIsSetupModalOpen(false)}
          salonData={salonData}
          onSuccess={() => {
            setIsSetupModalOpen(false);
            window.location.reload();
          }}
        />
      </>
    );
  }

  // Alerta específico do Essenza
  if (isEssenza && (isPendingPayment || isDueDay || isPastDueDay || isOverdue)) {
    if (dismissed && !isOverdue && !isDueDay) return null;

    return (
      <div className="mb-6 space-y-3">
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-zinc-950 to-zinc-950 p-4 sm:p-5 shadow-2xl shadow-amber-500/10">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-inner">
                <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    Aviso de Vencimento • Prevenção de Bloqueio
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-medium">
                    Vencimento Fixo: Todo dia 02 ({formattedEssenzaDate})
                  </span>
                  <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
                    Ação Necessária
                  </span>
                </div>

                <h3 className="text-sm md:text-base font-semibold text-white tracking-tight">
                  O pagamento da assinatura deve ser efetuado para evitar bloqueios no sistema.
                </h3>
                
                <p className="text-xs text-zinc-300 leading-relaxed font-light max-w-3xl">
                  A mensalidade do <strong className="text-white font-medium">Essenza Studio di Bellezza</strong> vence sempre no dia <strong className="text-amber-300 font-medium">02 de cada mês</strong>. Efetue o pagamento pontualmente para manter a agenda, relatórios, checklists e acessos da equipe liberados sem interrupções operacionais.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 self-start md:self-center">
              <Button 
                size="sm" 
                onClick={() => navigate('/dashboard/assinatura')}
                className="w-full md:w-auto bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold rounded-xl text-xs h-9.5 px-5 transition-all font-sans cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 border border-[#D4AF37]/30"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Efetuar Pagamento
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>

              {!isOverdue && !isDueDay && (
                <button
                  onClick={() => setDismissed(true)}
                  className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-900/50"
                  title="Minimizar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Alerta para outros salões com mensalidade vencida ou pagamento pendente
  if (isOverdue || (isPendingPayment && !isPreview)) {
    return (
      <div className="mb-6 space-y-3">
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/30 via-zinc-950 to-zinc-950 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-red-500/5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 font-mono">
                  {isOverdue ? 'Assinatura em Atraso' : 'Pagamento Pendente'}
                </span>
                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/35 px-2 py-0.5 rounded-full font-mono">
                  Evite Bloqueio
                </span>
              </div>
              <p className="text-sm font-semibold text-white">
                Regularize o pagamento da sua assinatura para evitar a suspensão preventiva de recursos.
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed font-light">
                O acesso à agenda, relatórios e automações pode ser pausado temporariamente caso o pagamento não seja confirmado.
              </p>
            </div>
          </div>

          <Button 
            size="sm" 
            onClick={() => navigate('/dashboard/assinatura')}
            className="w-full md:w-auto bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold rounded-xl text-xs h-9.5 px-4 shrink-0 transition-all font-sans cursor-pointer flex items-center justify-center gap-2 shadow-lg"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Regularizar Assinatura
          </Button>
        </div>
      </div>
    );
  }

  // Período preview
  if (isPreview) {
    return (
      <div className="space-y-4 mb-6">
        <div className="bg-amber-500/10 border border-amber-500/20 px-4 md:px-8 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left font-sans shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
          <div className="flex items-start gap-3 text-[#D4AF37]">
            <AlertTriangle className="w-5 h-5 text-[#D4AF37] mt-0.5 shrink-0 animate-pulse" />
            <div className="space-y-1">
              <span className="font-semibold text-sm text-[#D4AF37] block">
                Garantia de 7 dias pela Asaas • Plano {plan}
              </span>
              <span className="text-xs text-zinc-300 leading-relaxed font-light block">
                Sua conta piloto premium está ativa com suporte total. Aproveite a segurança da <strong>Garantia de 7 dias pela Asaas</strong> ou realize o upgrade definitivo. Ativação automática após confirmação do pagamento.
              </span>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={() => navigate('/dashboard/assinatura')}
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs h-9 px-4 shrink-0 transition-all font-sans cursor-pointer flex items-center gap-1.5 self-start sm:self-center shadow-lg"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Fazer Upgrade
          </Button>
        </div>

        <div className="bg-gradient-to-r from-[#D4AF37]/15 to-transparent border border-[#D4AF37]/25 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 shadow-[0_4px_15px_rgba(212,175,55,0.02)]">
          <div className="text-center sm:text-left space-y-1">
            <h4 className="font-semibold flex items-center justify-center sm:justify-start gap-2 text-sm text-[#D4AF37] leading-none">
              <Sparkles className="w-4 h-4 animate-pulse text-[#D4AF37]" />
              Ativação após confirmação do pagamento
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-light">
              Seu salão está operando com Garantia de 7 dias pela Asaas. Adquira acesso vitalício ou mensal contínuo.
            </p>
          </div>
          <Button 
            size="sm" 
            onClick={() => navigate('/dashboard/assinatura')}
            className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-bold rounded-xl text-xs h-9.5 px-4 shrink-0 transition-all shadow-[0_4px_15px_rgba(212,175,55,0.15)] border border-[#D4AF37]/20"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Assinar Agora
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

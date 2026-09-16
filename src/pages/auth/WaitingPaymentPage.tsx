import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Clock,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  Building2,
  CreditCard,
  QrCode,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import { toast } from 'sonner';

function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Acorde suave ascendente)
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.12 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.7);
    });
  } catch {
    // Falha silenciosa para navegadores com restrição de autoplay
  }
}

const PLAN_NAMES: Record<string, string> = {
  essential: 'Plano Essencial',
  professional: 'Plano Gestão',
  performance_plus: 'Plano Performance',
  multiunit: 'Plano Multiunidade'
};

export default function WaitingPaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentCallback = searchParams.get('payment'); // 'success' | 'cancelled' | 'expired'
  const { currentUser, salonData, userData, refreshUserData } = useAuth();

  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [copiedLink, setCopiedLink] = useState(false);
  const pollCountRef = useRef(0);
  const approvedHandledRef = useRef(false);

  // Determina se o pagamento já foi registrado e aprovado pelo Asaas
  const isPaymentConfirmed = Boolean(
    (userData?.role && (userData.role as string) !== 'pending') ||
    userData?.onboardingStatus === 'pending_setup' ||
    userData?.onboardingStatus === 'completed' ||
    salonData?.subscriptionStatus === 'active' ||
    salonData?.activationStatus === 'active' ||
    salonData?.paymentStatus === 'paid' ||
    (salonData as any)?.paymentStatus === 'confirmed' ||
    (salonData as any)?.status === 'active' ||
    salonData?.billing?.status === 'ACTIVE'
  );

  // Monitora confirmação do pagamento em tempo real
  useEffect(() => {
    if (isPaymentConfirmed && !approvedHandledRef.current) {
      approvedHandledRef.current = true;
      setIsApproved(true);
      playSuccessChime();
      toast.success('Pagamento confirmado pelo Asaas! Acesso liberado.');
    }
  }, [isPaymentConfirmed]);

  // Contagem regressiva e navegação automática quando aprovado
  useEffect(() => {
    if (!isApproved) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard/configurar-empresa', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isApproved, navigate]);

  // Polling automático a cada 3 segundos enquanto aguarda aprovação
  useEffect(() => {
    if (isApproved) return;

    const pollInterval = setInterval(async () => {
      try {
        await refreshUserData();
        if (salonData?.id && currentUser) {
          const idToken = await currentUser.getIdToken().catch(() => null);
          if (idToken) {
            const res = await fetch(`/api/billing/subscription-status?salonId=${salonData.id}`, {
              headers: { Authorization: `Bearer ${idToken}` }
            }).catch(() => null);
            if (res && res.ok) {
              const data = await res.json().catch(() => ({}));
              if (data.isActive || data.subscriptionStatus === 'active' || data.status === 'active') {
                await refreshUserData();
              }
            }
          }
        }
      } catch {
        // Polling silencioso de fundo
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isApproved, refreshUserData, salonData?.id, currentUser]);

  const handleVerify = async () => {
    if (checking || isApproved) return;
    setChecking(true);
    setStatusMessage(null);

    try {
      await refreshUserData();
      pollCountRef.current += 1;

      if (!isPaymentConfirmed) {
        setStatusMessage(
          pollCountRef.current >= 2
            ? 'Ainda aguardando conciliação do Asaas. Pagamentos via Cartão e Pix costumam ser confirmados em até 1 minuto. Assim que confirmado, esta tela atualizará sozinha.'
            : 'Sincronização realizada. Aguardando confirmação do Asaas. A tela atualizará automaticamente assim que aprovado.'
        );
      }
    } catch {
      setStatusMessage('Não foi possível verificar agora. Tentaremos novamente em instantes de forma automática.');
    } finally {
      setChecking(false);
    }
  };

  const checkoutUrl = salonData?.billing?.checkoutUrl || salonData?.providerCheckoutUrl || salonData?.billing?.invoiceUrl || '';

  const handleOpenCheckout = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://asaas.com.br', '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyCheckoutLink = async () => {
    if (!checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopiedLink(true);
      toast.success('Link de pagamento copiado para a área de transferência!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const planId = salonData?.plan || 'essential';
  const planDisplayName = PLAN_NAMES[planId] || 'Plano Lumière';

  return (
    <AuthLayout showBackButton backTo="/login" backText="Voltar ao login">
      <div className="w-full max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {isApproved ? (
            /* Tela Comemorativa de Acesso Liberado */
            <motion.div
              key="approved"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="w-full bg-[#0d0d12]/95 border border-[#D4AF37]/30 p-6 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl text-center relative overflow-hidden"
            >
              {/* Efeito de brilho de fundo */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Ícone de Sucesso Animado */}
              <div className="relative mx-auto mb-6 w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#D4AF37]/20 animate-ping opacity-75" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-[#D4AF37]/20 to-emerald-500/20 border border-[#D4AF37]/40 flex items-center justify-center shadow-lg shadow-[#D4AF37]/10">
                  <CheckCircle2 className="w-10 h-10 text-[#D4AF37]" />
                </div>
              </div>

              {/* Tag comemorativa */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-xs font-semibold tracking-wider uppercase mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pagamento Aprovado pelo Asaas</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2">
                Acesso Liberado com Sucesso!
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-md mx-auto mb-6">
                Identificamos a liquidação da sua assinatura. Sua licença LumièreOS está pronta e ativa. Agora vamos personalizar os dados da sua empresa para liberar seu painel completo.
              </p>

              {/* Barra de progresso do redirecionamento */}
              <div className="bg-black/40 border border-white/5 p-4 rounded-2xl mb-6 text-left">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <Building2 className="w-4 h-4 text-[#D4AF37]" />
                    Próxima etapa: Cadastro da Empresa
                  </span>
                  <span className="font-mono text-[#D4AF37] font-semibold">
                    Em {countdown}s...
                  </span>
                </div>
                <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3, ease: 'linear' }}
                    className="h-full bg-gradient-to-r from-[#D4AF37] to-amber-400"
                  />
                </div>
              </div>

              <button
                onClick={() => navigate('/dashboard/configurar-empresa', { replace: true })}
                className="w-full py-3.5 px-5 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(212,175,55,0.25)] cursor-pointer"
              >
                <span>Cadastrar Minha Empresa Agora</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            /* Tela de Espera Ativa (Polling e Conexão em Tempo Real) */
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <AuthCard
                title="Aguardando Confirmação"
                subtitle="Seu acesso será liberado automaticamente aqui assim que o pagamento for registrado."
              >
                <div className="space-y-5 font-sans text-left">
                  {/* Status Indicator com Radar Pulsante */}
                  {paymentCallback === 'cancelled' && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-semibold">Checkout cancelado ou fechado no Asaas</p>
                        <p className="text-zinc-400 text-[11px] mt-0.5">
                          A janela foi encerrada antes da finalização. Você pode reabrir o link abaixo a qualquer momento para concluir o pagamento.
                        </p>
                      </div>
                    </div>
                  )}

                  {paymentCallback === 'expired' && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <p className="font-semibold">Sessão do checkout expirada</p>
                        <p className="text-zinc-400 text-[11px] mt-0.5">
                          O tempo limite para pagamento expirou. Clique em verificar ou reabra a página para atualizar.
                        </p>
                      </div>
                    </div>
                  )}

                  {paymentCallback === 'success' && !isPaymentConfirmed && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                      <div>
                        <p className="font-semibold">Pagamento registrado no Asaas!</p>
                        <p className="text-zinc-400 text-[11px] mt-0.5">
                          Aguardando a confirmação do webhook do gateway para desbloquear o sistema automaticamente...
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex gap-3.5 items-start">
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute inset-0" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500 relative" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                          Monitorando em Tempo Real
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Conexão com Asaas
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Fique nesta tela. Pagamentos via <b>Pix</b> e <b>Cartão de Crédito</b> costumam ser confirmados em menos de 1 minuto. Assim que confirmado, seu acesso será liberado instantaneamente.
                      </p>
                    </div>
                  </div>

                  {/* Resumo da Licença Contratada */}
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                    <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Resumo da Assinatura
                    </span>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white text-sm font-medium">
                        <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                        <span>{planDisplayName}</span>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        Aguardando Pagamento
                      </span>
                    </div>
                    {salonData?.billing?.value ? (
                      <p className="text-xs text-zinc-400 pt-1 border-t border-white/5 flex justify-between">
                        <span>Valor:</span>
                        <span className="text-white font-medium">
                          R$ {salonData.billing.value.toFixed(2).replace('.', ',')}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  {/* Ações de Pagamento e Verificação */}
                  <div className="space-y-2.5 pt-1">
                    {checkoutUrl && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleOpenCheckout}
                          className="w-full py-3 px-3.5 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-semibold text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Pagar via Pix / Fatura</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyCheckoutLink}
                          className="w-full py-3 px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-zinc-300 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                          <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={checking}
                      onClick={handleVerify}
                      className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${checking ? 'animate-spin' : ''}`} />
                      <span>{checking ? 'Consultando Asaas...' : 'Já realisei o pagamento, verificar agora'}</span>
                    </button>
                  </div>

                  {/* Feedback message se houver */}
                  {statusMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-neutral-900/90 border border-white/10 text-xs text-zinc-300 leading-relaxed flex items-start gap-2"
                    >
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{statusMessage}</span>
                    </motion.div>
                  )}

                  {/* Mensagem de Isenção de E-mail */}
                  <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                    Não é necessário aguardar e-mail de ativação. A aprovação da sua conta acontecerá diretamente nesta tela assim que a conciliação for concluída.
                  </p>

                  {/* Rodapé de Segurança */}
                  <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-white/5 text-[11px] text-zinc-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Ambiente Seguro com Criptografia de Ponta a Ponta</span>
                  </div>
                </div>
              </AuthCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthLayout>
  );
}

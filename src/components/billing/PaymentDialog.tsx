import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, MessageCircle, CheckCircle2, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BILLING_CONFIG } from '../../config/billing';
import { formatCurrencyBRL, getPlanAmount, getPlanLabel, getFounderPriceInfo } from '../../lib/billing';
import { doc, collection, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  salonData: any;
}

export function PaymentDialog({ isOpen, onClose, salonData }: PaymentDialogProps) {
  const { currentUser, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'pix' | 'card'>('pix');
  const [isReporting, setIsReporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStagingCheckout, setIsStagingCheckout] = useState(false);
  const [isStagingPortal, setIsStagingPortal] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [stripePortalUrl, setStripePortalUrl] = useState<string | null>(null);

  if (!salonData) return null;

  const planAmount = getPlanAmount(salonData.plan);
  const planLabel = getPlanLabel(salonData.plan);
  const founderText = getFounderPriceInfo(salonData);

  const handleCopyPIX = () => {
    navigator.clipboard.writeText(BILLING_CONFIG.pixKey);
    setCopied(true);
    toast.success('Chave PIX copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = `Olá, vim pelo LumiereOS e gostaria de falar sobre minha assinatura do salão *${salonData.name}*.`;
    window.open(`https://wa.me/${BILLING_CONFIG.supportWhatsApp}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleReportPayment = async () => {
    if (!currentUser || !userData) return;
    setIsReporting(true);

    try {
      const paymentRef = doc(collection(db, `salons/${salonData.id}/payments`));
      
      const newPayment = {
        id: paymentRef.id,
        salonId: salonData.id,
        plan: salonData.plan,
        amount: planAmount,
        method: 'pix',
        status: 'reported',
        reportedByUserId: currentUser.uid,
        reportedByEmail: currentUser.email,
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

      toast.success('Pagamento informado. Nossa equipe irá validar sua assinatura.');
      onClose();
    } catch (error) {
      console.error('Error reporting payment:', error);
      toast.error('Erro ao informar pagamento. Tente novamente ou entre em contato com o suporte.');
    } finally {
      setIsReporting(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (!currentUser || !salonData) {
      toast.error("Para iniciar o pagamento, você precisar estar autenticado e com os dados do salão carregados.");
      return;
    }
    setIsStagingCheckout(true);
    setCheckoutError(null);
    setStripeCheckoutUrl(null);
    
    // Safety Timeout controller (15 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          salonId: salonData.id,
          plan: salonData.plan,
          userId: currentUser.uid,
        })
      });
      
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Não foi possível iniciar o checkout.");
      }

      if (!data) {
        throw new Error("Não foi possível processar a resposta do servidor de pagamento.");
      }

      const checkoutUrl = data.checkoutUrl || data.url;
      if (!checkoutUrl) {
        throw new Error("Checkout não retornou uma URL válida de redirecionamento.");
      }

      setStripeCheckoutUrl(checkoutUrl);

      // Tenta abrir em nova aba para contornar restrições de iFrame do Stripe
      const stripeWindow = window.open(checkoutUrl, '_blank');
      if (stripeWindow) {
        stripeWindow.focus();
        toast.success("O checkout seguro do Stripe foi aberto em uma nova aba.");
      } else {
        // Fallback de redirecionamento na aba atual se o popup for bloqueado pelo browser
        try {
          if (window.top) {
            window.top.location.href = checkoutUrl;
          } else {
            window.location.href = checkoutUrl;
          }
        } catch {
          window.location.href = checkoutUrl;
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[Stripe Checkout Erro]:', err.message || err);
      
      const errMsg = err.name === 'AbortError' 
        ? "Tempo limite de resposta excedido. O servidor demorou muito para responder." 
        : (err.message || "Erro interno ao processar link de checkout.");
        
      setCheckoutError("Não foi possível abrir o checkout do cartão. Tente novamente ou use PIX manual.");
      toast.error(errMsg);
    } finally {
      setIsStagingCheckout(false);
    }
  };

  const handleStripePortal = async () => {
    if (!currentUser || !salonData) {
      toast.error("Para acessar o portal, você precisa estar autenticado e com os dados do salão carregados.");
      return;
    }
    setIsStagingPortal(true);
    setStripePortalUrl(null);
    
    // Safety Timeout controller (15 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          salonId: salonData.id,
          userId: currentUser.uid
        })
      });
      
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Erro ao carregar o portal do cliente.");
      }

      if (!data) {
        throw new Error("Não foi possível processar a resposta do portal.");
      }

      const portalUrl = data.url || data.portalUrl || data.checkoutUrl;
      if (!portalUrl) {
        throw new Error("Portal não retornou uma URL válida.");
      }

      setStripePortalUrl(portalUrl);

      const portalWindow = window.open(portalUrl, '_blank');
      if (portalWindow) {
        portalWindow.focus();
        toast.success("O portal financeiro do Stripe foi aberto em uma nova aba.");
      } else {
        try {
          if (window.top) {
            window.top.location.href = portalUrl;
          } else {
            window.location.href = portalUrl;
          }
        } catch {
          window.location.href = portalUrl;
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[Stripe Portal Erro]:', err.message || err);
      
      const errMsg = err.name === 'AbortError' 
        ? "Tempo limite de conexão excedido ao abrir portal de faturamento." 
        : (err.message || "Erro de conexão ao carregar portal de gerenciamento.");
        
      toast.error(errMsg);
    } finally {
      setIsStagingPortal(false);
    }
  };

  const isAlreadyReported = salonData.paymentStatus === 'reported';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-zinc-800 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-light tracking-tight text-white flex items-center gap-2">
            Pagamento da Assinatura
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Mantenha seu acesso ativo utilizando PIX ou Cartão automático.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Plan Info Summary */}
          <div className="bg-zinc-900/55 rounded-xl p-4 border border-zinc-800/60 flex justify-between items-center">
            <div>
              <p className="text-xs text-zinc-500 mb-1 font-mono tracking-wide uppercase">Plano Selecionado</p>
              <p className="text-base font-semibold text-white">{planLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500 mb-1 font-mono tracking-wide uppercase">Valor Mensal</p>
              <p className="text-lg font-bold text-[#D4AF37]">
                {formatCurrencyBRL(planAmount)}
                <span className="text-xs font-normal text-zinc-500">/mês</span>
              </p>
            </div>
          </div>

          {founderText && (
            <div className="bg-[#D4AF37]/10 text-[#D4AF37] text-xs p-3 rounded-lg border border-[#D4AF37]/20 font-sans">
              {founderText}
            </div>
          )}

          {/* Premium Selector Tabs */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-850">
            <button
              onClick={() => setActiveTab('pix')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'pix'
                  ? 'bg-zinc-900 text-[#D4AF37] shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              PIX Manual
            </button>
            <button
              onClick={() => setActiveTab('card')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'card'
                  ? 'bg-zinc-900 text-[#D4AF37] shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Cartão Recorrente
            </button>
          </div>

          {/* Tab Contents: PIX */}
          {activeTab === 'pix' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Transfira para as coordenadas pix abaixo e informe o pagamento para validação:
              </p>
              
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 relative overflow-hidden space-y-3">
                <div className="absolute inset-y-0 left-0 w-0.5 bg-[#D4AF37]"></div>
                
                <div className="grid grid-cols-2 gap-3 pl-1.5 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">Chave</span>
                    <span className="font-semibold text-white uppercase text-xs">{BILLING_CONFIG.pixKeyType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">Beneficiário</span>
                    <span className="font-semibold text-white text-xs block truncate">{BILLING_CONFIG.receiverName}</span>
                  </div>
                </div>

                <div className="space-y-1 pl-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">Chave PIX</span>
                  <div className="flex items-center gap-2">
                    <code className="bg-black px-2 py-1.5 rounded text-xs text-[#D4AF37] font-mono select-all flex-1 border border-zinc-850 break-all leading-normal">
                      {BILLING_CONFIG.pixKey}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleCopyPIX}
                      className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-850 shrink-0"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                {BILLING_CONFIG.paymentInstructions}
              </p>

              <div className="space-y-3 pt-1">
                <Button
                  className="w-full bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 h-11 text-xs font-bold tracking-wide"
                  onClick={handleReportPayment}
                  disabled={isReporting || isAlreadyReported}
                >
                  {isReporting ? 'Informando...' : isAlreadyReported ? 'Pagamento Informado' : 'Informar Pagamento'}
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full h-11 border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white group text-xs font-semibold"
                  onClick={handleWhatsApp}
                >
                  <MessageCircle className="w-4 h-4 mr-2 text-zinc-500 group-hover:text-green-500" />
                  Falar com o Suporte
                </Button>
              </div>
            </div>
          )}

          {/* Tab Contents: Stripe Credit Card */}
          {activeTab === 'card' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Cadastre seu cartão uma vez e a cobrança mensal da mensalidade ocorrerá de forma 100% automatizada.
              </p>

              {checkoutError && (
                <div className="bg-red-500/10 text-red-400 text-xs p-3 rounded-lg border border-red-500/20 leading-relaxed font-sans">
                  {checkoutError}
                </div>
              )}

              {salonData.billingProvider === 'stripe' && salonData.billingMode === 'recurring_card' ? (
                <div className="bg-emerald-500/10 text-emerald-400 text-xs p-4 rounded-xl border border-emerald-500/20 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">Assinatura no Cartão Ativa</p>
                    <p className="text-xs text-emerald-400/80 mt-1 leading-relaxed">
                      Seu salão está associado ao plano recorrente integrado via Stripe. Seus acessos estão garantidos!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 flex items-start gap-3 text-xs leading-relaxed text-zinc-400">
                  <CreditCard className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-200 font-medium block">Autogerenciável e Seguro</span>
                    <span>Nenhum dado sensível de cartão transita pelo LumiereOS. Você será direcionado à página oficial de checkout da Stripe.</span>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-1">
                {salonData.billingProvider === 'stripe' && salonData.stripeCustomerId ? (
                  <>
                    <Button
                      className="w-full bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 h-11 text-xs font-bold tracking-wide"
                      onClick={handleStripePortal}
                      disabled={isStagingPortal}
                    >
                      {isStagingPortal ? 'Direcionando para o Portal...' : 'Gerenciar Cartão / Assinatura'}
                    </Button>
                    
                    {stripePortalUrl && (
                      <div className="text-center p-2.5 bg-zinc-900/30 border border-zinc-800/80 rounded-xl">
                        <p className="text-[11px] text-zinc-400 font-light">
                          Se o portal da Stripe não abriu automaticamente, clique no link seguro:
                        </p>
                        <a
                          href={stripePortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#D4AF37] hover:text-amber-400 hover:underline font-semibold block mt-1"
                        >
                          Acesssar de Forma Direta e Segura →
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 h-11 text-xs font-bold tracking-wide animate-pulse"
                      onClick={handleStripeCheckout}
                      disabled={isStagingCheckout}
                    >
                      {isStagingCheckout 
                        ? 'Preparando Link de Pagamento...' 
                        : checkoutError 
                          ? 'Tentar novamente' 
                          : 'Ativar Cartão Recorrente'}
                    </Button>

                    {stripeCheckoutUrl && (
                      <div className="text-center p-3 bg-zinc-900/30 border border-[#D4AF37]/15 rounded-xl">
                        <p className="text-[11px] text-zinc-400 font-light">
                          Se o link de faturamento seguro não abriu automaticamente:
                        </p>
                        <a
                          href={stripeCheckoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#D4AF37] hover:text-amber-400 hover:underline font-semibold block mt-1.5"
                        >
                          Ir para o Checkout Oficial da Stripe →
                        </a>
                      </div>
                    )}
                  </>
                )}

                <Button
                  variant="outline"
                  className="w-full h-11 border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white group text-xs font-semibold"
                  onClick={handleWhatsApp}
                >
                  <MessageCircle className="w-4 h-4 mr-2 text-zinc-500 group-hover:text-green-500" />
                  Falar com o Suporte
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, MessageCircle, CheckCircle2 } from 'lucide-react';
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
  const [isReporting, setIsReporting] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const isAlreadyReported = salonData.paymentStatus === 'reported';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-zinc-800 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-light tracking-tight text-white flex items-center gap-2">
            Pagamento da Assinatura
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Realize o pagamento para manter seu acesso ativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Plan Info */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50 flex justify-between items-center">
            <div>
              <p className="text-sm text-zinc-500 mb-1 font-mono tracking-wide uppercase">Plano Atual</p>
              <p className="text-lg font-medium text-white">{planLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500 mb-1 font-mono tracking-wide uppercase">Valor</p>
              <p className="text-xl font-bold text-[#D4AF37]">{formatCurrencyBRL(planAmount)}<span className="text-xs font-normal text-zinc-500">/mês</span></p>
            </div>
          </div>

          {founderText && (
            <div className="bg-[#D4AF37]/10 text-[#D4AF37] text-sm p-3 rounded-lg border border-[#D4AF37]/20">
              {founderText}
            </div>
          )}

          {/* PIX Details */}
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              Realize um PIX para a chave abaixo e clique em "Informar pagamento":
            </p>
            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 relative group overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1 bg-[#D4AF37]"></div>
              
              <div className="mb-3 space-y-1 pl-2">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Tipo de Chave</p>
                <p className="text-sm font-medium text-white uppercase">{BILLING_CONFIG.pixKeyType}</p>
              </div>

              <div className="mb-4 space-y-1 pl-2">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Beneficiário</p>
                <p className="text-sm font-medium text-white">{BILLING_CONFIG.receiverName}</p>
              </div>

              <div className="space-y-1 pl-2">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Chave PIX</p>
                <div className="flex items-center gap-2">
                  <code className="bg-black/50 px-2 py-1 rounded text-sm text-[#D4AF37] font-mono select-all flex-1 border border-white/5 break-all">
                    {BILLING_CONFIG.pixKey}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleCopyPIX}
                    className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-500 text-center">
            {BILLING_CONFIG.paymentInstructions}
          </p>

          <div className="space-y-3 pt-2">
            <Button
              className="w-full bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 h-12 text-sm font-bold tracking-wide"
              onClick={handleReportPayment}
              disabled={isReporting || isAlreadyReported}
            >
              {isReporting ? 'Informando...' : isAlreadyReported ? 'Pagamento Informado' : 'Informar Pagamento'}
            </Button>
            
            <Button
              variant="outline"
              className="w-full h-12 border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white group"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="w-4 h-4 mr-2 text-zinc-500 group-hover:text-green-500" />
              Falar com o Suporte
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

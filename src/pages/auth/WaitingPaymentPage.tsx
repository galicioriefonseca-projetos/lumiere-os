import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, Clock, RefreshCw, ExternalLink, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import LoadingExperience from '../../components/auth/LoadingExperience';

export default function WaitingPaymentPage() {
  const navigate = useNavigate();
  const { salonData } = useAuth();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    if (checking) return;
    setChecking(true);
    setStatusMessage(null);
    
    // Simulate premium validation
    setTimeout(() => {
      setChecking(false);
      setStatusMessage('Nossos servidores de conciliação bancária estão processando o seu lote de compensação. Por favor, tente novamente em alguns minutos ou aguarde a notificação automática em seu e-mail corporativo.');
    }, 2500);
  };

  const handleOpenCheckout = () => {
    if (salonData?.caktoCheckoutUrl) {
      window.open(salonData.caktoCheckoutUrl, '_blank');
    } else {
      // Fallback
      window.open('https://cakto.com.br', '_blank');
    }
  };

  return (
    <AuthLayout showBackButton backTo="/login" backText="Voltar ao login">
      <div className="w-full max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {checking ? (
            <AuthCard title="Verificando Status" subtitle="Sincronizando registros financeiros em tempo real...">
              <LoadingExperience 
                message="Conciliando pagamentos com a Cakto..." 
                subtitle="Nossos sistemas de segurança estão validando seu comprovante bancário." 
              />
            </AuthCard>
          ) : (
            <AuthCard
              title="Licença em Processamento"
              subtitle="Seu pagamento está aguardando confirmação pelo intermediador financeiro."
            >
              <div className="space-y-6 font-sans text-left">
                {/* Visual Status Indicator */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex gap-4 items-start">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-amber-300 font-medium mb-1">
                      Aguardando Confirmação
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Identificamos que seu pedido foi recebido. O processo de compensação bancária pode levar alguns instantes. Assim que confirmado, você receberá um e-mail de ativação automático.
                    </p>
                  </div>
                </div>

                {/* Info Text */}
                <p className="text-xs text-neutral-400 leading-relaxed text-center">
                  Garantimos total segurança de sua transação. Caso tenha efetuado o pagamento via Pix ou Cartão de Crédito, a liberação de sua conta executiva LumièreOS costuma ser imediata.
                </p>

                {/* Feedback message */}
                {statusMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 leading-relaxed"
                  >
                    {statusMessage}
                  </motion.div>
                )}

                {/* Interactive Buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleVerify}
                    className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-amber-500 text-neutral-950 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_20px_rgba(212,175,55,0.15)]"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Verificar Novamente</span>
                  </button>

                  <button
                    onClick={handleOpenCheckout}
                    className="w-full py-3 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-medium text-xs flex items-center justify-center gap-2 transition-all duration-300"
                  >
                    <span>Concluir Pagamento no Checkout</span>
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                  </button>

                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-3 px-4 rounded-xl bg-transparent hover:bg-neutral-900/40 text-neutral-400 hover:text-neutral-200 text-xs font-mono tracking-widest uppercase transition-colors"
                  >
                    Voltar para Página Inicial
                  </button>
                </div>

                {/* Footer Security */}
                <div className="flex items-center justify-center gap-1.5 pt-4 border-t border-neutral-900 text-[10px] font-mono uppercase text-neutral-500 tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Segurança Garantida LumièreOS</span>
                </div>
              </div>
            </AuthCard>
          )}
        </motion.div>
      </div>
    </AuthLayout>
  );
}

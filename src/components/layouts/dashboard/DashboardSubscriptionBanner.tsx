import { useNavigate } from 'react-router-dom';
import { CreditCard, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardSubscriptionBannerProps {
  salonData: any;
  isPlatformAdmin: boolean;
}

export function DashboardSubscriptionBanner({ 
  salonData, 
  isPlatformAdmin
}: DashboardSubscriptionBannerProps) {
  const navigate = useNavigate();

  // If the user is a platform admin, they don't need a subscription banner
  if (isPlatformAdmin) return null;

  const isPreview = salonData?.subscriptionStatus === 'preview';
  const plan = salonData?.plan || 'Premium';

  // Even though disabled for MVP, we preserve the structural design with new terms
  const showBanner = isPreview;

  if (!showBanner) return null;

  return (
    <div className="space-y-4 mb-6">
      {/* High priority banner styled as dynamic alert */}
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
          onClick={() => navigate('/dashboard/minha-conta')}
          className="bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs h-9 px-4 shrink-0 transition-all font-sans cursor-pointer flex items-center gap-1.5 self-start sm:self-center shadow-lg"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Fazer Upgrade
        </Button>
      </div>

      {/* Decorative secondary info panel if needed */}
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
          onClick={() => navigate('/dashboard/minha-conta')}
          className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-bold rounded-xl text-xs h-9.5 px-4 shrink-0 transition-all shadow-[0_4px_15px_rgba(212,175,55,0.15)] border border-[#D4AF37]/20"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Assinar Agora
        </Button>
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SubscriptionBannerProps {
  className?: string;
}

export function SubscriptionBanner({ className = '' }: SubscriptionBannerProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F3D32] to-[#17473A] border border-[#2D7362]/50 p-6 shadow-xl", className)}>
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#DFC498] to-[#997C4D] flex items-center justify-center text-[#04140F]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white leading-tight">
              Garanta acesso contínuo e suporte VIP
            </h3>
            <p className="text-sm text-[#8FAEA2] max-w-lg">
              Escolha o plano anual até o dia 02, garanta <strong>15% de desconto</strong> e blindagem de preço por 1 ano. 
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/dashboard/assinatura')}
          className="bg-[#D4AF37] hover:bg-[#C5A880] text-[#04140F] font-bold h-11 px-6 rounded-xl shadow-lg transition-all active:scale-95 shrink-0"
        >
          Definir Pagamento <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      {/* Decoração */}
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#DFC498]/5 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#1A5B4C]/20 blur-3xl" />
    </div>
  );
}

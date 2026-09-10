import { HelpCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardQuickActionsProps {
  onOpenGuide: () => void;
  onOpenRoadmap: () => void;
}

export function DashboardQuickActions({
  onOpenGuide,
  onOpenRoadmap,
}: DashboardQuickActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* WhatsApp Integration Status badge */}
      <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-sans text-[11px] font-bold rounded-xl h-8.5 shrink-0 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        WhatsApp Conectado 💬
      </div>

      {/* Guia do Sistema Button */}
      <Button
        id="lumiere-guide-trigger"
        size="sm"
        variant="outline"
        onClick={onOpenGuide}
        className="text-xs h-8.5 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all font-semibold rounded-xl bg-white/[0.02] hidden sm:flex items-center gap-1.5 shrink-0 px-3"
      >
        <HelpCircle className="w-4 h-4 text-[#D4AF37]" />
        <span className="hidden sm:inline">Guia do Sistema</span>
        <span className="sm:hidden">Ajuda</span>
      </Button>

      {/* Próximas Atualizações Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={onOpenRoadmap}
        className="text-xs h-8.5 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all font-semibold rounded-xl bg-white/[0.02] hidden sm:flex items-center gap-1.5 shrink-0 px-3"
      >
        <Sparkles className="w-4 h-4 text-[#D4AF37]" />
        <span className="hidden sm:inline">Próximas Atualizações</span>
        <span className="sm:hidden">Roadmap</span>
      </Button>
    </div>
  );
}

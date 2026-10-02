import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLumi } from '../../../lumi/hooks/useLumi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LumiMascotAvatar } from '../../lumi/LumiMascotAvatar';

export function DashboardLumiWidget() {
  const { salonData } = useAuth();
  const { loading: isAnalyzing, runAnalysis: runLumiAnalysis } = useLumi(salonData?.id);
  const [isRotating, setIsRotating] = useState(false);

  const handleManualAnalyze = async () => {
    if (isAnalyzing || isRotating) return;
    setIsRotating(true);
    try {
      await runLumiAnalysis();
      toast.success("Mascote Lumi atualizou as análises com os últimos dados!");
    } catch (err) {
      console.error(err);
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div 
      className="p-3.5 bg-zinc-950/40 hover:bg-zinc-950/80 border border-white/5 hover:border-[#D4AF37]/30 rounded-2xl transition-all duration-300 flex flex-col gap-2 group shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
      id="lumiere-intelligence-widget"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LumiMascotAvatar size="sm" mood="happy" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Copiloto</span>
            <span className="text-xs font-bold text-[#D4AF37] tracking-tight">Lumi Gestão</span>
          </div>
        </div>
        <button
          onClick={handleManualAnalyze}
          disabled={isAnalyzing || isRotating}
          className="p-1 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-[#D4AF37] transition-all focus:outline-none"
          title="Sincronizar e re-analisar métricas"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (isAnalyzing || isRotating) && "animate-spin text-[#D4AF37]")} />
        </button>
      </div>

      <div className="flex items-center justify-between mt-0.5 text-[9px] text-zinc-500 font-mono">
        <span className="flex items-center gap-1 text-emerald-400 font-semibold select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Ativa & Online
        </span>
        <span className="uppercase text-[#D4AF37] select-none font-bold">
          Motor Nativo
        </span>
      </div>

      <p className="text-[9.5px] text-zinc-400 font-light leading-relaxed mt-0.5 group-hover:text-zinc-300 transition-colors">
        Consultoria autônoma de faturamento, metas, agenda e equipe em tempo real.
      </p>
    </div>
  );
}

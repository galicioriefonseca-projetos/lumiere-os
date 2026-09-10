import { useState } from 'react';
import { Sparkles, Brain, Cpu, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLumi } from '../../../lumi/hooks/useLumi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function DashboardLumiWidget() {
  const { salonData } = useAuth();
  const { loading: isAnalyzing, activeProvider, runAnalysis: runLumiAnalysis } = useLumi(salonData?.id);
  const [isRotating, setIsRotating] = useState(false);

  const handleManualAnalyze = async () => {
    if (isAnalyzing || isRotating) return;
    setIsRotating(true);
    try {
      await runLumiAnalysis();
      toast.success("Módulo Lumi Intelligence atualizado com as últimas métricas!");
    } catch (err) {
      console.error(err);
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div 
      className="p-3.5 bg-zinc-950/40 hover:bg-zinc-950/80 border border-white/5 hover:border-[#D4AF37]/20 rounded-2xl transition-all duration-300 flex flex-col gap-2 group shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
      id="lumiere-intelligence-widget"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="p-1.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] group-hover:scale-105 transition-transform">
            <Brain className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">AI Engine</span>
            <span className="text-xs font-bold text-[#D4AF37] tracking-tight">Lumi Intelligence</span>
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

      <div className="flex items-center justify-between mt-1 text-[9px] text-zinc-500 font-mono">
        <span className="flex items-center gap-1 text-emerald-400 font-semibold select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Operativo
        </span>
        <span className="uppercase flex items-center gap-1 select-none">
          <Cpu className="w-2.5 h-2.5 text-zinc-600" />
          {activeProvider === 'gemini' ? 'Google Gemini' : 'Mock Engine'}
        </span>
      </div>

      <p className="text-[9.5px] text-zinc-400 font-light leading-relaxed mt-0.5 group-hover:text-zinc-300 transition-colors">
        Insights de faturamento, metas, comissões e checklists operacionais gerados em tempo real.
      </p>
    </div>
  );
}

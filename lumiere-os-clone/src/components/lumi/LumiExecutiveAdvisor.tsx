import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { HealthScore } from '../../lumi/types';
import { SupportedProvider } from '../../lumi/hooks/useLumi';
import { getHealthScoreColor } from '../../lumi/utils/formatters';
import { 
  Sparkles, 
  RefreshCw, 
  Cpu, 
  Brain,
  TrendingUp,
  AlertTriangle,
  Award,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface LumiExecutiveAdvisorProps {
  userName?: string;
  healthScore: HealthScore | null;
  aiNarrative: string;
  topOpportunity?: string;
  topAttention?: string;
  topProfessional?: string;
  mainRecommendation?: { title: string; action: string; url: string };
  onRunAnalysis: () => void;
  isLoading: boolean;
  activeProvider: string;
  providerType: SupportedProvider;
  onSwitchProvider: (type: SupportedProvider) => void;
}

export function LumiExecutiveAdvisor({
  userName,
  healthScore,
  aiNarrative,
  topOpportunity = "Sem dados suficientes",
  topAttention = "Sem dados suficientes",
  topProfessional = "Sem dados suficientes",
  mainRecommendation,
  onRunAnalysis,
  isLoading,
  activeProvider,
  providerType,
  onSwitchProvider
}: LumiExecutiveAdvisorProps) {
  const navigate = useNavigate();
  const score = healthScore?.score ?? 0;
  const healthColor = getHealthScoreColor(score);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getStatusText = (scoreValue: number) => {
    if (scoreValue >= 80) return { label: 'Excelente', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (scoreValue >= 60) return { label: 'Estável', badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Atenção', badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
  };

  const status = getStatusText(score);

  return (
    <Card className="border-[#D4AF37]/20 bg-gradient-to-br from-[#0e0e12] via-[#08080a] to-[#050507] rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden backdrop-blur-md relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF37]/5 to-transparent pointer-events-none rounded-3xl" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <CardContent className="p-6 md:p-8 space-y-8">
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#D4AF37]/15 to-[#D4AF37]/5 rounded-2xl border border-[#D4AF37]/25 shadow-inner">
              <Brain className="w-6 h-6 text-[#D4AF37] animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white font-heading tracking-tight">
                {getGreeting()}, {userName ? userName.split(' ')[0] : 'Gestor'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-[#D4AF37]/20 border border-[#D4AF37]/35 text-[#D4AF37] px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                  Lumi Intelligence Engine
                </span>
                <span className="text-[10px] text-zinc-500 font-light">
                  Consultoria Estratégica Ativa
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 select-none shrink-0">
            {import.meta.env.VITE_ENABLE_DEMO_DATA === 'true' && (
              <div className="flex items-center bg-black/40 border border-white/5 rounded-xl p-0.5">
                <button
                  onClick={() => onSwitchProvider('mock')}
                  className={cn(
                    "px-2.5 py-1 text-[9px] font-bold rounded-lg uppercase tracking-wider font-mono transition-all",
                    providerType === 'mock' ? "bg-[#D4AF37] text-black" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Mock
                </button>
                <button
                  onClick={() => onSwitchProvider('gemini')}
                  className={cn(
                    "px-2.5 py-1 text-[9px] font-bold rounded-lg uppercase tracking-wider font-mono transition-all",
                    providerType === 'gemini' ? "bg-[#D4AF37] text-black" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Gemini
                </button>
              </div>
            )}
            <Button
              size="sm"
              onClick={onRunAnalysis}
              disabled={isLoading}
              className="rounded-xl bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/20 h-8 px-3 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1.5"
            >
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
              {isLoading ? 'Analisando...' : 'Reanalisar'}
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Health Score & Highlights */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center space-y-6">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="rgba(255, 255, 255, 0.02)"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className={cn("transition-all duration-1000 ease-out", healthColor.fill)}
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={263.89}
                  strokeDashoffset={263.89 - (263.89 * score) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-5xl font-light tracking-tight text-white leading-none">
                  {score}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest font-mono mt-2">
                  Health Score
                </span>
              </div>
            </div>
            <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border", status.badge)}>
              Status: {status.label}
            </span>
          </div>

          {/* Right Column: Insights & Narrative */}
          <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono">
                  Resumo Executivo Diário
                </h3>
              </div>
              <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.015] hover:border-white/10 transition-all duration-300 shadow-inner">
                <p className="text-zinc-300 font-light text-sm leading-relaxed">
                  {isLoading ? (
                    <span className="text-zinc-500 font-mono text-[11px] animate-pulse flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Consultando arquitetura de negócios... Compilando métricas...
                    </span>
                  ) : (
                    aiNarrative || 'Clique em "Reanalisar" para iniciar a varredura do motor Lumi de Inteligência Operacional.'
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-3 p-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/5">
                <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 font-mono mb-1">Destaque</h4>
                  <p className="text-xs text-emerald-100/70 leading-relaxed font-light">{topOpportunity}</p>
                </div>
              </div>
              
              <div className="flex gap-3 p-4 rounded-2xl border border-rose-500/10 bg-rose-500/5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-rose-400 font-mono mb-1">Atenção</h4>
                  <p className="text-xs text-rose-100/70 leading-relaxed font-light">{topAttention}</p>
                </div>
              </div>

              <div className="flex gap-3 p-4 rounded-2xl border border-violet-500/10 bg-violet-500/5">
                <Award className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-violet-400 font-mono mb-1">Time</h4>
                  <p className="text-xs text-violet-100/70 leading-relaxed font-light">Melhor desempenho: <span className="font-semibold">{topProfessional}</span></p>
                </div>
              </div>

              {mainRecommendation && (
                <div className="flex gap-3 p-4 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 relative group cursor-pointer" onClick={() => navigate(mainRecommendation.url)}>
                  <div className="absolute top-2 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <Zap className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] font-mono mb-1">Recomendação</h4>
                    <p className="text-xs text-zinc-300 leading-relaxed font-light">{mainRecommendation.title}</p>
                    <span className="text-[10px] text-[#D4AF37] mt-1 inline-block font-semibold">{mainRecommendation.action}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono mt-4 pt-4 border-t border-white/5">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-[#D4AF37]" /> Provider Ativo: <span className="text-zinc-300">{activeProvider}</span>
              </span>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

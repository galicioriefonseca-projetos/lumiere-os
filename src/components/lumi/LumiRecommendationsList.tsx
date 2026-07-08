import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Recommendation } from '../../lumi/types';
import { 
  Zap, 
  ArrowRight, 
  Settings, 
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface LumiRecommendationsListProps {
  recommendations: Recommendation[];
}

export function LumiRecommendationsList({ recommendations }: LumiRecommendationsListProps) {
  const navigate = useNavigate();
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);

  // Dynamic mapping of Effort based on Category & ID
  const getEffort = (rec: Recommendation) => {
    switch (rec.id) {
      case 'rec_expand_team':
        return { label: 'Médio Esforço', color: 'text-amber-400 bg-amber-500/10' };
      case 'rec_tue_morning_promo':
        return { label: 'Baixo Esforço', color: 'text-emerald-400 bg-emerald-500/10' };
      case 'rec_upsell_combos':
        return { label: 'Baixo Esforço', color: 'text-emerald-400 bg-emerald-500/10' };
      case 'rec_vip_retention':
        return { label: 'Médio Esforço', color: 'text-amber-400 bg-amber-500/10' };
      case 'rec_restock_urgent':
        return { label: 'Baixo Esforço', color: 'text-emerald-400 bg-emerald-500/10' };
      default:
        return { label: 'Baixo Esforço', color: 'text-emerald-400 bg-emerald-500/10' };
    }
  };

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'medium':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'low':
      default:
        return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  return (
    <>
      <Card className="border-white/5 bg-[#0c0c0f]/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <CardHeader className="border-b border-white/5 p-5 pb-4 bg-white/[0.01]">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-[#D4AF37]" />
            <div>
              <CardTitle className="text-sm font-semibold text-white font-heading">
                Recomendações de Crescimento
              </CardTitle>
              <p className="text-[10px] text-zinc-500 font-light mt-0.5">
                Plano tático com estimativa de impacto e esforço operacional
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {recommendations.length === 0 || (recommendations.length === 1 && recommendations[0].id === 'rec_onboard_complete') ? (
            <div className="p-8 text-center text-zinc-500 text-xs font-sans space-y-2 leading-relaxed">
              <p className="font-semibold text-zinc-300">Ainda não há dados suficientes para gerar este indicador.</p>
              <p className="text-[11px] text-zinc-400">A Lumi começará a gerar insights após coletar dados reais da operação.</p>
              <p className="text-[11px] text-[#D4AF37]/80">Cadastre clientes, agendamentos, metas ou vendas para ativar esta análise.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, idx) => {
                const effort = getEffort(rec);
                return (
                  <motion.div
                    key={rec.id || idx}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-[#0c0c0f] to-[#08080a] hover:border-[#D4AF37]/30 transition-all duration-300 flex flex-col justify-between space-y-4 shadow-lg group relative overflow-hidden"
                  >
                    {/* Glowing Accent */}
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[#D4AF37]/5 rounded-full blur-xl pointer-events-none group-hover:bg-[#D4AF37]/10 transition-all duration-500" />
                    
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider font-mono", getImpactColor(rec.impact))}>
                          Impacto {rec.impact === 'high' ? 'Alto' : rec.impact === 'medium' ? 'Médio' : 'Baixo'}
                        </span>
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-transparent uppercase tracking-wider font-mono", effort.color)}>
                          {effort.label}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <h4 className="text-sm font-semibold text-white leading-snug group-hover:text-[#D4AF37] transition-colors">
                          {rec.title}
                        </h4>
                        <p className="text-xs text-zinc-400 font-light leading-relaxed line-clamp-2">
                          {rec.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.03] flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                        Categoria: {rec.category}
                      </span>
                      
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedRec(rec)}
                        className="text-xs text-[#D4AF37] hover:text-white hover:bg-[#D4AF37]/10 rounded-xl h-8 px-3 font-semibold flex items-center gap-1 font-sans"
                      >
                        Ver detalhes
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedRec} onOpenChange={(open) => !open && setSelectedRec(null)}>
        {selectedRec && (
          <DialogContent className="border-[#D4AF37]/25 bg-[#0a0a0d] text-white rounded-3xl max-w-lg p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-lg">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider font-mono", getImpactColor(selectedRec.impact))}>
                  {selectedRec.impact === 'high' ? 'Alto Impacto' : 'Médio Impacto'}
                </span>
                <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono", getEffort(selectedRec).color)}>
                  {getEffort(selectedRec).label}
                </span>
              </div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-white font-heading mt-2">
                {selectedRec.title}
              </DialogTitle>
              <DialogDescription className="text-zinc-400 font-light text-xs leading-relaxed mt-2">
                {selectedRec.description}
              </DialogDescription>
            </DialogHeader>

            <div className="my-5 p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3.5">
              <h5 className="text-xs uppercase tracking-wider font-bold text-[#D4AF37] font-mono flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                Roteiro de Implementação
              </h5>
              
              <ul className="space-y-2.5 text-xs text-zinc-300 font-light">
                <li className="flex gap-2">
                  <span className="text-[#D4AF37] font-bold font-mono">1.</span>
                  <span>Acesse o módulo recomendado clicando no botão de ação abaixo.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#D4AF37] font-bold font-mono">2.</span>
                  <span>Revise as configurações atuais e implemente as diretrizes sugeridas pela Lumi.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#D4AF37] font-bold font-mono">3.</span>
                  <span>Monitore os KPIs no painel de "Business Health" para avaliar o retorno de ROI após 7 dias.</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedRec(null)}
                className="rounded-xl border-white/10 hover:border-white/20 text-white bg-transparent text-xs h-10 px-4"
              >
                Fechar
              </Button>
              {selectedRec.actionUrl && (
                <Button
                  onClick={() => {
                    setSelectedRec(null);
                    if (selectedRec.actionUrl) {
                      navigate(`/dashboard${selectedRec.actionUrl}`);
                    }
                  }}
                  className="rounded-xl bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs h-10 px-5 shadow-[0_4px_15px_rgba(212,175,55,0.15)]"
                >
                  {selectedRec.actionText}
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

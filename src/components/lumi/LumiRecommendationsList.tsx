import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, Settings, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Recommendation } from '../../lumi/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface LumiRecommendationsListProps {
  recommendations: Recommendation[];
}

function resolveDashboardPath(url: string): string {
  if (url.startsWith('/dashboard')) return url;
  if (url.startsWith('/')) return `/dashboard${url === '/' ? '' : url}`;
  return `/dashboard/${url}`;
}

function getEffortLabel(rec: Recommendation): string {
  switch (rec.id) {
    case 'rec_expand_team':
    case 'rec_vip_retention':
      return 'Esforço médio';
    default:
      return 'Esforço baixo';
  }
}

function getCategoryLabel(category: Recommendation['category']): string {
  switch (category) {
    case 'marketing':
      return 'Marketing';
    case 'finance':
      return 'Financeiro';
    case 'hr':
      return 'Equipe';
    case 'stock':
      return 'Estoque';
    default:
      return 'Operação';
  }
}

function getImpactTone(impact: Recommendation['impact']): { label: string; className: string } {
  switch (impact) {
    case 'high':
      return { label: 'Impacto alto', className: 'text-[#8A6D36]' };
    case 'medium':
      return { label: 'Impacto médio', className: 'text-[#171717]' };
    default:
      return { label: 'Impacto baixo', className: 'text-[#6B6B6B]' };
  }
}

export function LumiRecommendationsList({ recommendations }: LumiRecommendationsListProps) {
  const navigate = useNavigate();
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);

  const isInsufficient =
    recommendations.length === 0 ||
    (recommendations.length === 1 && recommendations[0].id === 'rec_onboard_complete');

  return (
    <>
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#E5E2DC] pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#8A6D36]" />
            <div>
              <h3 className="text-sm font-semibold text-[#171717]">Recomendações de Crescimento</h3>
              <p className="text-xs text-[#6B6B6B]">
                Ações táticas priorizadas por impacto e facilidade de execução
              </p>
            </div>
          </div>
        </div>

        {isInsufficient ? (
          <div className="py-8 text-center space-y-1.5 text-xs text-[#6B6B6B]">
            <p className="font-semibold text-[#171717]">
              Ainda não há dados suficientes para gerar recomendações.
            </p>
            <p>
              Com mais atendimentos e histórico de vendas, as oportunidades de receita aparecerão
              aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec, idx) => {
              const impact = getImpactTone(rec.impact);
              const effort = getEffortLabel(rec);

              return (
                <div
                  key={rec.id || idx}
                  className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-4 flex flex-col justify-between gap-4 hover:border-[#8A6D36]/50 transition-colors"
                >
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-[#6B6B6B]">
                      <span className={cn('font-semibold', impact.className)}>{impact.label}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{effort}</span>
                    </p>
                    <h4 className="text-sm font-semibold text-[#171717] leading-snug">
                      {rec.title}
                    </h4>
                    <p className="text-xs text-[#4A4A4A] leading-relaxed line-clamp-2">
                      {rec.description}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[#E5E2DC] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#6B6B6B]">
                      {getCategoryLabel(rec.category)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedRec(rec)}
                      className="text-xs font-semibold text-[#8A6D36] hover:text-[#6E5629] inline-flex items-center gap-1"
                    >
                      Ver detalhes
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedRec} onOpenChange={(open) => !open && setSelectedRec(null)}>
        {selectedRec && (
          <DialogContent className="border-[#E5E2DC] bg-white text-[#171717] rounded-2xl max-w-lg p-6 shadow-xl">
            <DialogHeader className="space-y-2">
              <p className="text-xs font-medium text-[#6B6B6B]">
                <span className={cn('font-semibold', getImpactTone(selectedRec.impact).className)}>
                  {getImpactTone(selectedRec.impact).label}
                </span>
                <span aria-hidden="true"> · </span>
                <span>{getEffortLabel(selectedRec)}</span>
              </p>
              <DialogTitle className="text-lg font-semibold text-[#171717] font-heading">
                {selectedRec.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#4A4A4A] leading-relaxed">
                {selectedRec.description}
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-3">
              <h5 className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-[#8A6D36]" />
                Roteiro de Implementação
              </h5>

              <ol className="space-y-2 text-xs text-[#4A4A4A]">
                <li className="flex gap-2">
                  <span className="font-semibold text-[#8A6D36] tabular-nums">1.</span>
                  <span>Acesse o módulo indicado no botão abaixo para aplicar o ajuste.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-[#8A6D36] tabular-nums">2.</span>
                  <span>Revise serviços, horários ou clientes envolvidos na oportunidade.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-[#8A6D36] tabular-nums">3.</span>
                  <span>Acompanhe a evolução do faturamento e ocupação nos próximos 7 dias.</span>
                </li>
              </ol>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                variant="outline"
                onClick={() => setSelectedRec(null)}
                className="rounded-lg border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] text-xs h-10 px-4"
              >
                Fechar
              </Button>
              {selectedRec.actionUrl && (
                <Button
                  onClick={() => {
                    const target = resolveDashboardPath(selectedRec.actionUrl!);
                    setSelectedRec(null);
                    navigate(target);
                  }}
                  className="rounded-lg bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold text-xs h-10 px-4 gap-1.5"
                >
                  {selectedRec.actionText || 'Abrir módulo'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

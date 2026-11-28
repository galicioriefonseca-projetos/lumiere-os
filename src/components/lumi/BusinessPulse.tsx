import React from 'react';
import { Calendar, DollarSign, ListTodo, ShieldCheck, Users, Zap } from 'lucide-react';
import type { HealthScore } from '../../lumi/types';

interface BusinessPulseProps {
  healthScore: HealthScore | null;
}

function getScoreTone(score: number): { bar: string; text: string } {
  if (score >= 80) return { bar: 'bg-emerald-600', text: 'text-emerald-700' };
  if (score >= 55) return { bar: 'bg-[#8A6D36]', text: 'text-[#8A6D36]' };
  return { bar: 'bg-red-600', text: 'text-red-700' };
}

export function BusinessPulse({ healthScore }: BusinessPulseProps) {
  if (!healthScore) {
    return (
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-6 text-center text-xs text-[#6B6B6B]">
        Calculando pilares operacionais...
      </div>
    );
  }

  const pillars = [
    {
      key: 'agenda',
      label: 'Agenda',
      score: healthScore.areas.agenda,
      description: healthScore.breakdown.agenda,
      icon: Calendar,
    },
    {
      key: 'financeiro',
      label: 'Financeiro',
      score: healthScore.areas.financeiro,
      description: healthScore.breakdown.financeiro,
      icon: DollarSign,
    },
    {
      key: 'equipe',
      label: 'Equipe',
      score: healthScore.areas.equipe,
      description: healthScore.breakdown.equipe,
      icon: Zap,
    },
    {
      key: 'clientes',
      label: 'Clientes',
      score: healthScore.areas.clientes,
      description: healthScore.breakdown.clientes,
      icon: Users,
    },
    {
      key: 'operacao',
      label: 'Operação',
      score: healthScore.areas.operacao,
      description: healthScore.breakdown.operacao,
      icon: ListTodo,
    },
  ];

  return (
    <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E2DC] pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#8A6D36]" />
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">Saúde dos 5 Pilares</h3>
            <p className="text-xs text-[#6B6B6B]">
              Score ponderado com base na operação atual do salão
            </p>
          </div>
        </div>
        <span className="text-sm font-bold text-[#171717] tabular-nums">
          Índice Geral: {healthScore.score}/100
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          const tone = getScoreTone(pillar.score);
          return (
            <div
              key={pillar.key}
              className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-4 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717]">
                  <Icon className="w-3.5 h-3.5 text-[#8A6D36]" />
                  {pillar.label}
                </span>
                <span className={`text-sm font-bold tabular-nums ${tone.text}`}>
                  {pillar.score}%
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-[#E5E2DC] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${tone.bar}`}
                  style={{ width: `${Math.min(100, Math.max(0, pillar.score))}%` }}
                />
              </div>

              <p className="text-[11px] text-[#4A4A4A] leading-snug line-clamp-3">
                {pillar.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

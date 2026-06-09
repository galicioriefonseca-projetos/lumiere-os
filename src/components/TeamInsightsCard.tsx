import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, RefreshCw, AlertCircle, Users } from 'lucide-react';
import { Professional } from '../types';

interface TeamInsightsCardProps {
  professionals: Professional[];
}

export function TeamInsightsCard({ professionals }: TeamInsightsCardProps) {
  const { salonData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const businessTypeMap: Record<string, string> = {
    salon: 'Salão de Beleza',
    clinic: 'Clínica de Estética',
    barbershop: 'Barbearia',
    studio: 'Studio',
    other: 'Estabelecimento de Beleza',
  };

  const businessTypeTranslated = salonData?.businessType
    ? businessTypeMap[salonData.businessType] || salonData.businessType
    : 'Salão';

  const generateInsight = async () => {
    if (!salonData) return;
    setLoading(true);
    setError(null);

    const activeProfessionals = professionals.filter(p => p.isActive);
    const rolesSummary = activeProfessionals.reduce((acc, prof) => {
      const role = prof.primaryFunction || 'Não definida';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const rolesString = Object.entries(rolesSummary)
      .map(([role, count]) => `${count}x ${role}`)
      .join(', ');

    try {
      const response = await fetch('/api/gemini-team-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salonName: salonData.name,
          businessTypeTranslated,
          professionalsCount: activeProfessionals.length,
          rolesSummary: rolesString || 'Nenhuma função definida.',
          recentEvaluations: 'Dados de avaliação em processamento', // placeholder for now or can be queried
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido ao carregar análise de equipe.');
      }

      if (data && data.text) {
        setInsight(data.text);
      } else {
        throw new Error('Retorno vazio da inteligência artificial.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar insights de equipe do Gemini:', err);
      setError(err?.message || 'Falha de comunicação com o servidor Lumière AI. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card id="gemini-team-insight-card" className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border border-indigo-500/15 rounded-3xl transition-all duration-300 hover:border-indigo-500/30">
      <div className="absolute top-0 right-0 -translate-y-6 translate-x-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      
      <CardContent className="p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/25 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-white tracking-wide flex items-center gap-1.5 leading-none">
                Lumière AI <span className="text-xs text-indigo-400 font-mono hidden sm:inline">— Desempenho da Equipe</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1 font-light">Consultoria para liderança de alta performance</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!insight && !loading && (
              <Button
                onClick={generateInsight}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-9 px-4 rounded-xl shadow-[0_2px_10px_rgba(79,70,229,0.2)] select-none"
              >
                Gerar Conselho de Liderança
              </Button>
            )}

            {insight && !loading && (
              <Button
                onClick={generateInsight}
                variant="outline"
                className="border-white/10 hover:border-indigo-500/40 text-slate-300 hover:text-white bg-white/[0.02] text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Nova Análise
              </Button>
            )}
          </div>
        </div>

        {loading && (
          <div className="py-6 flex flex-col items-center justify-center gap-3.5 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Analisando composição da equipe...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-200 font-medium">Ops! Não foi possível gerar o insight</p>
              <p className="text-[11px] text-red-300/80 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {insight && !loading && (
          <div className="relative p-5 rounded-2xl border border-indigo-500/10 bg-white/[0.02] overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500/45 rounded-l-2xl" />
            <p className="text-sm text-slate-200 italic font-light leading-relaxed pl-1">
              "{insight}"
            </p>
            <div className="mt-3.5 flex items-center gap-1.5 text-[10px] text-indigo-400 font-semibold tracking-wider uppercase font-mono pl-1 opacity-85">
              <Users className="w-3.5 h-3.5" /> Diretriz de Gestão
            </div>
          </div>
        )}

        {!insight && !loading && !error && (
          <div className="py-4 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.005]">
            <p className="text-xs text-muted-foreground font-light px-4 leading-relaxed">
              Descubra como potencializar seus talentos. Solicite uma análise da composição da sua equipe usando inteligência artificial do LumièreOS.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

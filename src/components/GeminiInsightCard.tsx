import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';

interface GeminiInsightCardProps {
  checklistPct: number;
  goalCurrent: number;
  goalTarget: number;
  professionalsCount: number;
}

export function GeminiInsightCard({
  checklistPct,
  goalCurrent,
  goalTarget,
  professionalsCount,
}: GeminiInsightCardProps) {
  const { salonData, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthlyCount, setMonthlyCount] = useState<number>(0);
  const [loadingCount, setLoadingCount] = useState(false);

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

  const goalPercentage = goalTarget > 0 ? Math.round((goalCurrent / goalTarget) * 100) : 0;

  // Query monthly appointments from Firestore
  useEffect(() => {
    if (!salonData?.id) return;

    async function fetchMonthlyAppointments() {
      setLoadingCount(true);
      try {
        const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
        const appointmentsRef = collection(db, `salons/${salonData!.id}/appointments`);
        
        // Fetch appointments starting with this month prefix
        // Since dates are stored as "YYYY-MM-DD", we can use string bounds
        const q = query(
          appointmentsRef,
          where('date', '>=', `${currentMonthStr}-01`),
          where('date', '<=', `${currentMonthStr}-31`)
        );
        
        const snap = await getDocs(q);
        setMonthlyCount(snap.docs.length);
      } catch (err) {
        console.error('Erro ao buscar agendamentos mensais para o insight:', err);
      } finally {
        setLoadingCount(false);
      }
    }

    fetchMonthlyAppointments();
  }, [salonData?.id]);

  const generateInsight = async () => {
    if (!salonData) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salonName: salonData.name,
          businessTypeTranslated,
          monthlyCount,
          checklistPct,
          goalPercentage,
          goalCurrent,
          goalTarget,
          professionalsCount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido ao carregar análise estratégica.');
      }

      if (data && data.text) {
        setInsight(data.text);
      } else {
        throw new Error('Retorno vazio da inteligência artificial.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar insights do Gemini:', err);
      setError(err?.message || 'Falha de comunicação com o servidor Lumière AI. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card id="gemini-insight-card" className="relative overflow-hidden bg-gradient-to-br from-[#0c0c0e] via-[#09090b] to-[#040405] border border-[#D4AF37]/15 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[#D4AF37]/30">
      <div className="absolute top-0 right-0 -translate-y-6 translate-x-6 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />
      
      <CardContent className="p-6 md:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/25 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.1)]">
              <Sparkles className="w-5 h-5 text-[#D4AF37] animate-pulse" />
            </div>
            <div>
              <h3 className="font-heading text-base font-semibold text-white tracking-wide flex items-center gap-1.5 leading-none">
                Insights do Lumière <span className="text-xs bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/35 px-2 py-0.5 rounded font-mono uppercase tracking-widest scale-90">AI</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1 font-light">Consultoria estratégica de desempenho em tempo real</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!insight && !loading && (
              <Button
                id="btn-generate-insight"
                onClick={generateInsight}
                disabled={loadingCount}
                className="bg-[#D4AF37] hover:bg-amber-500 text-black font-semibold text-xs h-9 px-4 rounded-xl shadow-[0_2px_10px_rgba(212,175,55,0.2)] select-none"
              >
                {loadingCount ? 'Carregando Métricas...' : 'Gerar Insight'}
              </Button>
            )}

            {insight && !loading && (
              <Button
                id="btn-update-insight"
                onClick={generateInsight}
                variant="outline"
                className="border-white/10 hover:border-[#D4AF37]/40 text-slate-300 hover:text-white bg-white/[0.02] text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar Análise
              </Button>
            )}
          </div>
        </div>

        {loading && (
          <div className="py-6 flex flex-col items-center justify-center gap-3.5 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
            <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Lumière AI está analisando seus resultados...</p>
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
          <div className="relative p-5 rounded-2xl border border-[#D4AF37]/10 bg-white/[0.01] overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#D4AF37]/45 rounded-l-2xl" />
            <p className="text-sm text-slate-200 italic font-light leading-relaxed pl-1">
              "{insight}"
            </p>
            <div className="mt-3.5 flex items-center gap-1.5 text-[10px] text-[#D4AF37] font-semibold tracking-wider uppercase font-mono pl-1 opacity-85">
              <TrendingUp className="w-3.5 h-3.5" /> Sugestão Estratégica Ativa
            </div>
          </div>
        )}

        {!insight && !loading && !error && (
          <div className="py-3 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.005]">
            <p className="text-xs text-muted-foreground font-light px-4 leading-relaxed">
              Consolide sua gestão. Clique no botão de geração de insights para obter uma consultoria instantânea e insights profundos sobre o desempenho do seu salão este mês.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

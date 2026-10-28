import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Phone, 
  Navigation, 
  Globe, 
  Search, 
  MapPin, 
  Calendar as CalendarIcon, 
  Sparkles, 
  Star, 
  FileText, 
  ExternalLink, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Filter, 
  Layers, 
  Eye, 
  CheckCircle2, 
  RotateCcw,
  BarChart3,
  PieChart as PieChartIcon,
  HelpCircle
} from 'lucide-react';
import { ClientReport } from '../../types';

interface ReportsAnalyticsTabProps {
  reports: ClientReport[];
  agencyName: string;
  clientName: string;
  onOpenReportDetails: (report: ClientReport) => void;
}

const COLORS = {
  gold: '#DFC498',
  emerald: '#10B981',
  blue: '#38BDF8',
  purple: '#A855F7',
  amber: '#F59E0B',
  darkBg: '#0A261E',
  cardBg: '#061A14'
};

const PIE_COLORS = ['#10B981', '#DFC498', '#38BDF8', '#A855F7'];

export default function ReportsAnalyticsTab({
  reports,
  agencyName,
  clientName,
  onOpenReportDetails
}: ReportsAnalyticsTabProps) {
  // Estado de Filtro de Calendário
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'last3' | 'last6' | 'year' | 'custom'>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [selectedChartType, setSelectedChartType] = useState<'area' | 'bar'>('area');
  
  // Modo de Comparação Específica entre Dois Meses
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [compareMonthA, setCompareMonthA] = useState<string>('');
  const [compareMonthB, setCompareMonthB] = useState<string>('');

  // Ordenar relatórios cronologicamente (do mais antigo ao mais recente para gráficos)
  const chronologicalReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : a.createdAt;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : b.createdAt;
      return dateA - dateB;
    });
  }, [reports]);

  // Aplicar filtros de data (Preset ou Calendário Customizado)
  const filteredReports = useMemo(() => {
    if (!chronologicalReports.length) return [];

    if (dateRangePreset === 'all' && !startDateFilter && !endDateFilter) {
      return chronologicalReports;
    }

    if (dateRangePreset === 'last3') {
      return chronologicalReports.slice(-3);
    }

    if (dateRangePreset === 'last6') {
      return chronologicalReports.slice(-6);
    }

    if (dateRangePreset === 'year') {
      const currentYear = new Date().getFullYear();
      return chronologicalReports.filter(r => {
        if (r.year) return r.year === currentYear;
        const d = r.startDate ? new Date(r.startDate) : new Date(r.createdAt);
        return d.getFullYear() === currentYear;
      });
    }

    // Filtro por Data Inicial e Final do Calendário
    return chronologicalReports.filter(r => {
      const reportDateStr = r.startDate || (r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '');
      if (!reportDateStr) return true;

      if (startDateFilter && reportDateStr < startDateFilter) return false;
      if (endDateFilter && reportDateStr > endDateFilter) return false;
      return true;
    });
  }, [chronologicalReports, dateRangePreset, startDateFilter, endDateFilter]);

  // Lista de relatórios ordenados do mais recente para o mais antigo (para exibição de cards)
  const latestFirstReports = useMemo(() => {
    return [...filteredReports].reverse();
  }, [filteredReports]);

  // Relatório mais recente e o anterior para comparativo padrão
  const currentReport = latestFirstReports[0] || null;
  const previousReport = latestFirstReports[1] || null;

  // Se o usuário estiver no modo de comparação personalizada de meses:
  const reportA = useMemo(() => {
    if (!compareMonthA) return currentReport;
    return reports.find(r => r.id === compareMonthA) || currentReport;
  }, [reports, compareMonthA, currentReport]);

  const reportB = useMemo(() => {
    if (!compareMonthB) return previousReport;
    return reports.find(r => r.id === compareMonthB) || previousReport;
  }, [reports, compareMonthB, previousReport]);

  // Cálculo de variação percentual
  const calcVariation = (current: number = 0, previous: number = 0) => {
    if (!previous || previous === 0) {
      return current > 0 ? { pct: 100, isUp: true, isZero: false, diff: current } : { pct: 0, isUp: false, isZero: true, diff: 0 };
    }
    const diff = current - previous;
    const pct = Number(((diff / previous) * 100).toFixed(1));
    return {
      pct: Math.abs(pct),
      isUp: diff >= 0,
      isZero: diff === 0,
      diff
    };
  };

  // Métricas agregadas do período selecionado
  const aggregatedStats = useMemo(() => {
    let searchImpressions = 0;
    let mapsImpressions = 0;
    let totalImpressions = 0;
    let calls = 0;
    let directionRequests = 0;
    let websiteClicks = 0;
    let reviewsCount = 0;
    let ratingsSum = 0;
    let ratingCount = 0;

    filteredReports.forEach(r => {
      const gmb = r.gmbMetrics;
      if (gmb) {
        searchImpressions += gmb.searchImpressions || 0;
        mapsImpressions += gmb.mapsImpressions || 0;
        totalImpressions += (gmb.searchImpressions || 0) + (gmb.mapsImpressions || 0);
        calls += gmb.calls || 0;
        directionRequests += gmb.directionRequests || 0;
        websiteClicks += gmb.websiteClicks || 0;
        if (gmb.reviewsCount) reviewsCount = Math.max(reviewsCount, gmb.reviewsCount);
        if (gmb.rating) {
          ratingsSum += gmb.rating;
          ratingCount++;
        }
      } else if (r.metrics) {
        calls += r.metrics.leads || 0;
        totalImpressions += r.metrics.reach || 0;
        websiteClicks += r.metrics.conversions || 0;
      }
    });

    const avgRating = ratingCount > 0 ? (ratingsSum / ratingCount).toFixed(1) : (currentReport?.gmbMetrics?.rating?.toFixed(1) || '5.0');

    return {
      searchImpressions,
      mapsImpressions,
      totalImpressions,
      calls,
      directionRequests,
      websiteClicks,
      reviewsCount: reviewsCount || currentReport?.gmbMetrics?.reviewsCount || 0,
      avgRating
    };
  }, [filteredReports, currentReport]);

  // Variações do mês atual vs anterior (ou mês A vs mês B no modo comparativo)
  const comparisonSourceA = comparisonMode ? reportA : currentReport;
  const comparisonSourceB = comparisonMode ? reportB : previousReport;

  const currentGmb = comparisonSourceA?.gmbMetrics || {};
  const prevGmb = comparisonSourceB?.gmbMetrics || {};

  const currentTotalViews = (currentGmb.searchImpressions || 0) + (currentGmb.mapsImpressions || 0);
  const prevTotalViews = (prevGmb.searchImpressions || 0) + (prevGmb.mapsImpressions || 0);

  const viewsVar = calcVariation(currentTotalViews, prevTotalViews);
  const callsVar = calcVariation(currentGmb.calls || 0, prevGmb.calls || 0);
  const routesVar = calcVariation(currentGmb.directionRequests || 0, prevGmb.directionRequests || 0);
  const webVar = calcVariation(currentGmb.websiteClicks || 0, prevGmb.websiteClicks || 0);

  // Formatação para gráficos Recharts
  const chartData = useMemo(() => {
    return filteredReports.map(r => {
      const gmb = r.gmbMetrics || {};
      const periodLabel = r.period.replace('/ 20', '/').replace(' / ', '/');
      const searchViews = gmb.searchImpressions || 0;
      const mapsViews = gmb.mapsImpressions || 0;
      const totalViews = searchViews + mapsViews || (r.metrics?.reach || 0);
      const callsCount = gmb.calls || (r.metrics?.leads || 0);
      const routesCount = gmb.directionRequests || 0;
      const webClicks = gmb.websiteClicks || (r.metrics?.conversions || 0);

      return {
        id: r.id,
        period: periodLabel,
        fullPeriod: r.period,
        searchViews,
        mapsViews,
        totalViews,
        calls: callsCount,
        routes: routesCount,
        webClicks,
        rating: gmb.rating || 5.0
      };
    });
  }, [filteredReports]);

  // Dados para Gráfico de Distribuição de Ações (Pie Chart)
  const actionsPieData = useMemo(() => {
    const totalCalls = aggregatedStats.calls;
    const totalRoutes = aggregatedStats.directionRequests;
    const totalClicks = aggregatedStats.websiteClicks;
    const total = totalCalls + totalRoutes + totalClicks;

    if (total === 0) return [];

    return [
      { name: 'Rotas GPS (Visitas)', value: totalRoutes, color: '#10B981' },
      { name: 'Ligações Telefônicas', value: totalCalls, color: '#DFC498' },
      { name: 'Cliques no Site/WhatsApp', value: totalClicks, color: '#38BDF8' }
    ];
  }, [aggregatedStats]);

  // Top Keywords consolidadas de todos os relatórios filtrados
  const topKeywordsList = useMemo(() => {
    const kwMap = new Map<string, number>();
    filteredReports.forEach(r => {
      const kws = r.gmbMetrics?.topKeywords;
      if (Array.isArray(kws)) {
        kws.forEach((item: any) => {
          if (typeof item === 'string') {
            kwMap.set(item, (kwMap.get(item) || 0) + 50);
          } else if (item && item.keyword) {
            kwMap.set(item.keyword, (kwMap.get(item.keyword) || 0) + (item.count || 20));
          }
        });
      }
    });

    return Array.from(kwMap.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredReports]);

  // Se não houver relatórios cadastrados
  if (reports.length === 0) {
    return (
      <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-16">
        <CardContent className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#DFC498]/10 border border-[#DFC498]/20 flex items-center justify-center mx-auto text-[#DFC498]">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Nenhum relatório de desempenho publicado</h3>
            <p className="text-xs text-[#8FAEA2] max-w-md mx-auto leading-relaxed">
              Assim que a equipe da <strong className="text-white">{agencyName}</strong> fizer o upload do PDF de desempenho do Google Meu Negócio, você poderá visualizar gráficos interativos, comparativo de meses e filtros por datas no calendário.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* BARRA SUPERIOR: CONTROLE DE DATAS NO CALENDÁRIO E MODO COMPARATIVO */}
      <div className="bg-[#0A261E] border border-[#17473A] p-4 sm:p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#DFC498] bg-[#DFC498]/10 px-2.5 py-0.5 rounded-full border border-[#DFC498]/20">
              <Sparkles className="w-3.5 h-3.5" /> Google Meu Negócio • Inteligência de Dados
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Desempenho e Comparativo Mensal
            </h2>
            <p className="text-xs text-[#8FAEA2]">
              Transformação automática dos dados do Google em gráficos, métricas de conversão e histórico de crescimento.
            </p>
          </div>

          {/* Atalhos Rápidos de Calendário */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-[#8FAEA2] mr-1 hidden sm:inline flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5 text-[#DFC498]" /> Período:
            </span>

            <Button
              size="sm"
              variant={dateRangePreset === 'all' ? 'default' : 'outline'}
              onClick={() => {
                setDateRangePreset('all');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className={`h-8 text-xs rounded-xl ${
                dateRangePreset === 'all'
                  ? 'bg-[#DFC498] text-[#04140F] font-bold hover:bg-[#C5A880]'
                  : 'border-white/10 text-[#8FAEA2] hover:text-white hover:bg-white/5'
              }`}
            >
              Todos os Meses ({reports.length})
            </Button>

            <Button
              size="sm"
              variant={dateRangePreset === 'last3' ? 'default' : 'outline'}
              onClick={() => {
                setDateRangePreset('last3');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className={`h-8 text-xs rounded-xl ${
                dateRangePreset === 'last3'
                  ? 'bg-[#DFC498] text-[#04140F] font-bold hover:bg-[#C5A880]'
                  : 'border-white/10 text-[#8FAEA2] hover:text-white hover:bg-white/5'
              }`}
            >
              Últimos 3 Meses
            </Button>

            <Button
              size="sm"
              variant={dateRangePreset === 'last6' ? 'default' : 'outline'}
              onClick={() => {
                setDateRangePreset('last6');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className={`h-8 text-xs rounded-xl ${
                dateRangePreset === 'last6'
                  ? 'bg-[#DFC498] text-[#04140F] font-bold hover:bg-[#C5A880]'
                  : 'border-white/10 text-[#8FAEA2] hover:text-white hover:bg-white/5'
              }`}
            >
              Últimos 6 Meses
            </Button>

            <Button
              size="sm"
              variant={dateRangePreset === 'custom' ? 'default' : 'outline'}
              onClick={() => setDateRangePreset('custom')}
              className={`h-8 text-xs rounded-xl gap-1.5 ${
                dateRangePreset === 'custom'
                  ? 'bg-[#DFC498] text-[#04140F] font-bold hover:bg-[#C5A880]'
                  : 'border-white/10 text-[#8FAEA2] hover:text-white hover:bg-white/5'
              }`}
            >
              <Filter className="w-3 h-3" /> Filtrar Datas
            </Button>
          </div>
        </div>

        {/* SELETOR DE CALENDÁRIO PERSONALIZADO (Quando custom ou quando cliente quiser filtrar) */}
        {(dateRangePreset === 'custom' || startDateFilter || endDateFilter) && (
          <div className="bg-black/30 border border-white/10 p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <span className="text-xs text-white font-medium flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-[#DFC498]" /> Selecionar Datas no Calendário:
              </span>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={e => {
                    setStartDateFilter(e.target.value);
                    setDateRangePreset('custom');
                  }}
                  className="bg-[#061A14] border border-[#17473A] text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-[#DFC498] outline-none"
                  placeholder="Data Inicial"
                />
                <span className="text-xs text-[#8FAEA2]">até</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={e => {
                    setEndDateFilter(e.target.value);
                    setDateRangePreset('custom');
                  }}
                  className="bg-[#061A14] border border-[#17473A] text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-[#DFC498] outline-none"
                  placeholder="Data Final"
                />
              </div>
            </div>

            {(startDateFilter || endDateFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setDateRangePreset('all');
                }}
                className="h-8 text-xs text-[#8FAEA2] hover:text-white gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Limpar Filtro
              </Button>
            )}
          </div>
        )}

        {/* TOGGLE MODO COMPARATIVO DE MESES */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#17473A]/60">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setComparisonMode(!comparisonMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                comparisonMode 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-white/5 text-[#8FAEA2] hover:text-white border border-white/10'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {comparisonMode ? 'Modo Comparativo Ativo' : 'Ativar Comparativo Direto Mês a Mês'}
            </button>
            <span className="text-[11px] text-[#8FAEA2]">
              {comparisonMode 
                ? 'Escolha dois períodos específicos para analisar a evolução detalhada lado a lado.'
                : 'Comparando automaticamente o período atual com o anterior.'}
            </span>
          </div>

          {comparisonMode && reports.length >= 2 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#8FAEA2] text-[11px]">Mês Base:</span>
                <select
                  value={compareMonthA || currentReport?.id}
                  onChange={e => setCompareMonthA(e.target.value)}
                  className="bg-[#061A14] border border-[#17473A] text-white text-xs rounded-lg px-2 py-1 outline-none"
                >
                  {reports.map(r => (
                    <option key={r.id} value={r.id}>{r.period}</option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-[#DFC498] font-bold">vs</span>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#8FAEA2] text-[11px]">Comparar com:</span>
                <select
                  value={compareMonthB || previousReport?.id}
                  onChange={e => setCompareMonthB(e.target.value)}
                  className="bg-[#061A14] border border-[#17473A] text-white text-xs rounded-lg px-2 py-1 outline-none"
                >
                  {reports.map(r => (
                    <option key={r.id} value={r.id}>{r.period}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CARDS COMPARATIVOS MÊS A MÊS COM VARIAÇÃO PERCENTUAL (Δ%) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8FAEA2] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#DFC498]" /> 
            {comparisonMode 
              ? `Comparativo: ${comparisonSourceA?.period || 'Atual'} vs ${comparisonSourceB?.period || 'Anterior'}`
              : `Métricas do Período (${currentReport?.period || 'Consolidado'}) e Comparativo com Mês Anterior`}
          </span>
          {comparisonSourceB && (
            <span className="text-[11px] text-[#8FAEA2]">
              Base anterior: <strong className="text-white">{comparisonSourceB.period}</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CARD 1: VISUALIZAÇÕES TOTAIS (PESQUISA + MAPAS) */}
          <Card className="bg-[#0A261E] border-[#17473A] shadow-md hover:border-[#DFC498]/40 transition-all">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#DFC498]" /> Visualizações Google
                </span>
                {comparisonSourceB && (
                  <Badge className={`text-[10px] font-bold px-1.5 py-0.5 flex items-center gap-0.5 ${
                    viewsVar.isUp 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : viewsVar.isZero
                      ? 'bg-white/5 text-[#8FAEA2]'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {viewsVar.isUp ? <ArrowUpRight className="w-3 h-3" /> : viewsVar.isZero ? <Minus className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {viewsVar.pct}%
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {currentTotalViews ? currentTotalViews.toLocaleString('pt-BR') : aggregatedStats.totalImpressions.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-[#8FAEA2]">Buscas + Maps</span>
              </div>
              <div className="text-[11px] text-[#8FAEA2] flex items-center justify-between pt-1 border-t border-white/5">
                <span>Google Maps: <strong className="text-white">{currentGmb.mapsImpressions?.toLocaleString('pt-BR') || 0}</strong></span>
                <span>Pesquisa: <strong className="text-white">{currentGmb.searchImpressions?.toLocaleString('pt-BR') || 0}</strong></span>
              </div>
            </CardContent>
          </Card>

          {/* CARD 2: LIGAÇÕES TELEFÔNICAS */}
          <Card className="bg-[#0A261E] border-[#17473A] shadow-md hover:border-[#DFC498]/40 transition-all">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Ligações Telefônicas
                </span>
                {comparisonSourceB && (
                  <Badge className={`text-[10px] font-bold px-1.5 py-0.5 flex items-center gap-0.5 ${
                    callsVar.isUp 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : callsVar.isZero
                      ? 'bg-white/5 text-[#8FAEA2]'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {callsVar.isUp ? <ArrowUpRight className="w-3 h-3" /> : callsVar.isZero ? <Minus className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {callsVar.pct}%
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {currentGmb.calls !== undefined ? currentGmb.calls : aggregatedStats.calls}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">Contatos Diretos</span>
              </div>
              <div className="text-[11px] text-[#8FAEA2] flex items-center justify-between pt-1 border-t border-white/5">
                <span>Mês Anterior: <strong className="text-white">{prevGmb.calls || 0}</strong></span>
                <span className={callsVar.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {callsVar.diff >= 0 ? `+${callsVar.diff}` : callsVar.diff} chamadas
                </span>
              </div>
            </CardContent>
          </Card>

          {/* CARD 3: SOLICITAÇÕES DE ROTAS (GPS / WAZE) */}
          <Card className="bg-[#0A261E] border-[#17473A] shadow-md hover:border-[#DFC498]/40 transition-all">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#DFC498]" /> Rotas no Mapa (GPS)
                </span>
                {comparisonSourceB && (
                  <Badge className={`text-[10px] font-bold px-1.5 py-0.5 flex items-center gap-0.5 ${
                    routesVar.isUp 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : routesVar.isZero
                      ? 'bg-white/5 text-[#8FAEA2]'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {routesVar.isUp ? <ArrowUpRight className="w-3 h-3" /> : routesVar.isZero ? <Minus className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {routesVar.pct}%
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {currentGmb.directionRequests !== undefined ? currentGmb.directionRequests : aggregatedStats.directionRequests}
                </span>
                <span className="text-[10px] text-[#DFC498] font-medium">Visitas Presenciais</span>
              </div>
              <div className="text-[11px] text-[#8FAEA2] flex items-center justify-between pt-1 border-t border-white/5">
                <span>Mês Anterior: <strong className="text-white">{prevGmb.directionRequests || 0}</strong></span>
                <span className={routesVar.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {routesVar.diff >= 0 ? `+${routesVar.diff}` : routesVar.diff} rotas
                </span>
              </div>
            </CardContent>
          </Card>

          {/* CARD 4: CLIQUES NO SITE / WHATSAPP & AVALIAÇÃO */}
          <Card className="bg-[#0A261E] border-[#17473A] shadow-md hover:border-[#DFC498]/40 transition-all">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" /> Cliques no Website
                </span>
                {comparisonSourceB && (
                  <Badge className={`text-[10px] font-bold px-1.5 py-0.5 flex items-center gap-0.5 ${
                    webVar.isUp 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : webVar.isZero
                      ? 'bg-white/5 text-[#8FAEA2]'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {webVar.isUp ? <ArrowUpRight className="w-3 h-3" /> : webVar.isZero ? <Minus className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {webVar.pct}%
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {currentGmb.websiteClicks !== undefined ? currentGmb.websiteClicks : aggregatedStats.websiteClicks}
                </span>
                <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {currentGmb.rating || aggregatedStats.avgRating} ★
                </div>
              </div>
              <div className="text-[11px] text-[#8FAEA2] flex items-center justify-between pt-1 border-t border-white/5">
                <span>Mês Anterior: <strong className="text-white">{prevGmb.websiteClicks || 0}</strong></span>
                <span>Avaliações: <strong className="text-white">{currentGmb.reviewsCount || aggregatedStats.reviewsCount}</strong></span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SEÇÃO PRINCIPAL DE GRÁFICOS VISUAIS (RECHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO 1: EVOLUÇÃO DE VISIBILIDADE (LINHA OU ÁREA) - OCUPA 2 COLUNAS */}
        <Card className="lg:col-span-2 bg-[#0A261E] border-[#17473A] shadow-xl">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#DFC498]" />
                  Evolução de Visualizações no Google
                </CardTitle>
                <CardDescription className="text-xs text-[#8FAEA2]">
                  Comparativo de impressões no Google Maps vs Pesquisa Google ao longo do tempo.
                </CardDescription>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedChartType('area')}
                  className={`h-7 px-2.5 text-xs rounded-lg ${selectedChartType === 'area' ? 'bg-[#DFC498]/20 text-[#DFC498]' : 'text-[#8FAEA2]'}`}
                >
                  Área
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedChartType('bar')}
                  className={`h-7 px-2.5 text-xs rounded-lg ${selectedChartType === 'bar' ? 'bg-[#DFC498]/20 text-[#DFC498]' : 'text-[#8FAEA2]'}`}
                >
                  Barras
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {selectedChartType === 'area' ? (
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMaps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorSearch" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DFC498" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#DFC498" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#17473A" vertical={false} />
                    <XAxis dataKey="period" stroke="#8FAEA2" fontSize={11} tickLine={false} />
                    <YAxis stroke="#8FAEA2" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#061A14', borderColor: '#17473A', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val: any, name: any) => [
                        Number(val).toLocaleString('pt-BR'),
                        name === 'mapsViews' ? 'Google Maps' : name === 'searchViews' ? 'Pesquisa Google' : 'Total'
                      ]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      formatter={(val) => val === 'mapsViews' ? 'Google Maps' : val === 'searchViews' ? 'Pesquisa Google' : val}
                    />
                    <Area type="monotone" dataKey="mapsViews" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMaps)" name="mapsViews" />
                    <Area type="monotone" dataKey="searchViews" stroke="#DFC498" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSearch)" name="searchViews" />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#17473A" vertical={false} />
                    <XAxis dataKey="period" stroke="#8FAEA2" fontSize={11} tickLine={false} />
                    <YAxis stroke="#8FAEA2" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#061A14', borderColor: '#17473A', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val: any, name: any) => [
                        Number(val).toLocaleString('pt-BR'),
                        name === 'mapsViews' ? 'Google Maps' : name === 'searchViews' ? 'Pesquisa Google' : 'Total'
                      ]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      formatter={(val) => val === 'mapsViews' ? 'Google Maps' : val === 'searchViews' ? 'Pesquisa Google' : val}
                    />
                    <Bar dataKey="mapsViews" fill="#10B981" radius={[6, 6, 0, 0]} name="mapsViews" />
                    <Bar dataKey="searchViews" fill="#DFC498" radius={[6, 6, 0, 0]} name="searchViews" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICO 2: PROPORÇÃO DE AÇÕES (PIE / DONUT CHART) - OCUPA 1 COLUNA */}
        <Card className="bg-[#0A261E] border-[#17473A] shadow-xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#DFC498]" />
              Distribuição de Ações
            </CardTitle>
            <CardDescription className="text-xs text-[#8FAEA2]">
              O que os clientes fizeram no perfil durante o período selecionado.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0 flex-1 flex flex-col justify-center">
            {actionsPieData.length > 0 ? (
              <>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={actionsPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {actionsPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#061A14', borderColor: '#17473A', borderRadius: '10px', fontSize: '11px' }}
                        formatter={(val: any) => [Number(val).toLocaleString('pt-BR'), 'Total']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  {actionsPieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[#8FAEA2]">{item.name}</span>
                      </div>
                      <span className="font-bold text-white">{item.value.toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-[#8FAEA2] text-xs">
                Nenhum dado de conversão disponível para o período.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICO 3: AÇÕES DE CONVERSÃO MÊS A MÊS (BAR CHART) & RANKING DE PALAVRAS-CHAVE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO DE CONVERSÕES: ROTAS, LIGAÇÕES E CLIQUES NO SITE */}
        <Card className="lg:col-span-2 bg-[#0A261E] border-[#17473A] shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              Conversões Mês a Mês: Rotas, Ligações & Cliques
            </CardTitle>
            <CardDescription className="text-xs text-[#8FAEA2]">
              Crescimento de contatos e visitas que geram faturamento real para {clientName}.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#17473A" vertical={false} />
                  <XAxis dataKey="period" stroke="#8FAEA2" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8FAEA2" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#061A14', borderColor: '#17473A', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(val: any, name: any) => [
                      Number(val).toLocaleString('pt-BR'),
                      name === 'routes' ? 'Rotas GPS' : name === 'calls' ? 'Ligações' : 'Cliques Site'
                    ]}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    formatter={(val) => val === 'routes' ? 'Rotas GPS' : val === 'calls' ? 'Ligações' : 'Cliques no Site'}
                  />
                  <Bar dataKey="routes" fill="#10B981" radius={[4, 4, 0, 0]} name="routes" />
                  <Bar dataKey="calls" fill="#DFC498" radius={[4, 4, 0, 0]} name="calls" />
                  <Bar dataKey="webClicks" fill="#38BDF8" radius={[4, 4, 0, 0]} name="webClicks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* RANKING DE PALAVRAS-CHAVE DO GOOGLE */}
        <Card className="bg-[#0A261E] border-[#17473A] shadow-xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-[#DFC498]" />
              Termos Mais Buscados no Google
            </CardTitle>
            <CardDescription className="text-xs text-[#8FAEA2]">
              Palavras-chave que levaram novos clientes até a sua empresa.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0 flex-1 flex flex-col justify-center space-y-3">
            {topKeywordsList.length > 0 ? (
              topKeywordsList.map((kw, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-medium truncate max-w-[200px]">
                      {i + 1}. {kw.keyword}
                    </span>
                    <span className="text-[#DFC498] font-mono text-[11px] font-bold">
                      {kw.count.toLocaleString('pt-BR')} buscas
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#DFC498] to-emerald-400 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(15, (kw.count / (topKeywordsList[0].count || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-[#8FAEA2] text-xs">
                Termos de pesquisa sendo mapeados nos próximos relatórios.
              </div>
            )}

            {currentReport?.gmbMetrics?.targetKeyword && (
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[11px] text-[#8FAEA2] mt-2">
                Palavra-chave foco monitorada: <strong className="text-[#DFC498] font-mono block text-xs mt-0.5">{currentReport.gmbMetrics.targetKeyword}</strong>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TABELA COMPARATIVA MÊS A MÊS LADO A LADO */}
      <Card className="bg-[#0A261E] border-[#17473A] shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#17473A]/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#DFC498]" />
                Tabela Comparativa Mês a Mês
              </CardTitle>
              <CardDescription className="text-xs text-[#8FAEA2]">
                Acompanhamento detalhado da evolução de todas as métricas consolidadas por período.
              </CardDescription>
            </div>
            <span className="text-xs text-[#8FAEA2]">
              Exibindo <strong className="text-white">{filteredReports.length}</strong> período(s) analisado(s)
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-[#17473A] text-[#8FAEA2]">
                <th className="p-3.5 font-semibold text-white">Métrica de Performance</th>
                {filteredReports.map(rep => (
                  <th key={rep.id} className="p-3.5 font-semibold text-center text-[#DFC498] whitespace-nowrap">
                    {rep.period}
                  </th>
                ))}
                {filteredReports.length >= 2 && (
                  <th className="p-3.5 font-semibold text-right text-emerald-400">
                    Variação Recente (Δ%)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17473A]/40 text-[#E1EDE8]">
              {/* LINHA 1: PESQUISA GOOGLE */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-[#DFC498]" /> Pesquisa Google (Impressões)
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-medium">
                    {(rep.gmbMetrics?.searchImpressions || 0).toLocaleString('pt-BR')}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    {(() => {
                      const curr = latestFirstReports[0]?.gmbMetrics?.searchImpressions || 0;
                      const prev = latestFirstReports[1]?.gmbMetrics?.searchImpressions || 0;
                      const v = calcVariation(curr, prev);
                      return (
                        <span className={`inline-flex items-center gap-0.5 ${v.isUp ? 'text-emerald-400' : v.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                          {v.isUp ? '+' : '-'}{v.pct}%
                        </span>
                      );
                    })()}
                  </td>
                )}
              </tr>

              {/* LINHA 2: GOOGLE MAPS */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Google Maps (Impressões)
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-medium">
                    {(rep.gmbMetrics?.mapsImpressions || 0).toLocaleString('pt-BR')}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    {(() => {
                      const curr = latestFirstReports[0]?.gmbMetrics?.mapsImpressions || 0;
                      const prev = latestFirstReports[1]?.gmbMetrics?.mapsImpressions || 0;
                      const v = calcVariation(curr, prev);
                      return (
                        <span className={`inline-flex items-center gap-0.5 ${v.isUp ? 'text-emerald-400' : v.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                          {v.isUp ? '+' : '-'}{v.pct}%
                        </span>
                      );
                    })()}
                  </td>
                )}
              </tr>

              {/* LINHA 3: ROTAS NO MAPA (GPS) */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-[#DFC498]" /> Solicitações de Rotas (GPS)
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-bold text-emerald-400">
                    {rep.gmbMetrics?.directionRequests || 0}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    {(() => {
                      const curr = latestFirstReports[0]?.gmbMetrics?.directionRequests || 0;
                      const prev = latestFirstReports[1]?.gmbMetrics?.directionRequests || 0;
                      const v = calcVariation(curr, prev);
                      return (
                        <span className={`inline-flex items-center gap-0.5 ${v.isUp ? 'text-emerald-400' : v.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                          {v.isUp ? '+' : '-'}{v.pct}%
                        </span>
                      );
                    })()}
                  </td>
                )}
              </tr>

              {/* LINHA 4: LIGAÇÕES TELEFÔNICAS */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Chamadas Telefônicas Diretas
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-bold text-white">
                    {rep.gmbMetrics?.calls || 0}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    {(() => {
                      const curr = latestFirstReports[0]?.gmbMetrics?.calls || 0;
                      const prev = latestFirstReports[1]?.gmbMetrics?.calls || 0;
                      const v = calcVariation(curr, prev);
                      return (
                        <span className={`inline-flex items-center gap-0.5 ${v.isUp ? 'text-emerald-400' : v.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                          {v.isUp ? '+' : '-'}{v.pct}%
                        </span>
                      );
                    })()}
                  </td>
                )}
              </tr>

              {/* LINHA 5: CLIQUES NO WEBSITE */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-blue-400" /> Cliques no Website / Contato
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-medium text-blue-300">
                    {rep.gmbMetrics?.websiteClicks || 0}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    {(() => {
                      const curr = latestFirstReports[0]?.gmbMetrics?.websiteClicks || 0;
                      const prev = latestFirstReports[1]?.gmbMetrics?.websiteClicks || 0;
                      const v = calcVariation(curr, prev);
                      return (
                        <span className={`inline-flex items-center gap-0.5 ${v.isUp ? 'text-emerald-400' : v.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                          {v.isUp ? '+' : '-'}{v.pct}%
                        </span>
                      );
                    })()}
                  </td>
                )}
              </tr>

              {/* LINHA 6: AVALIAÇÃO & REVIEWS */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Nota Média & Total de Avaliações
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono text-amber-300">
                    {rep.gmbMetrics?.rating ? `${rep.gmbMetrics.rating} ★ (${rep.gmbMetrics.reviewsCount || 0})` : '-'}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono text-[#8FAEA2]">
                    {(() => {
                      const currReviews = latestFirstReports[0]?.gmbMetrics?.reviewsCount || 0;
                      const prevReviews = latestFirstReports[1]?.gmbMetrics?.reviewsCount || 0;
                      const diff = currReviews - prevReviews;
                      return diff >= 0 ? `+${diff} novas` : `${diff}`;
                    })()}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* RESUMO EXECUTIVO GERADO POR IA */}
      {currentReport?.summary && (
        <Card className="bg-gradient-to-br from-[#0A261E] to-[#061A14] border border-[#DFC498]/30 shadow-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-[#DFC498]/10 text-[#DFC498] border-[#DFC498]/20 flex items-center gap-1 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> Análise Executiva da Agência {agencyName}
              </Badge>
              <span className="text-xs text-[#8FAEA2]">
                Referência: <strong className="text-white">{currentReport.period}</strong>
              </span>
            </div>
            <CardTitle className="text-base font-bold text-white pt-1">
              Síntese do Período & Recomendações Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-[#E1EDE8] leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
              {currentReport.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* LISTAGEM INDIVIDUAL DE RELATÓRIOS DO PERÍODO COM BOTÃO DE DETALHES & DOWNLOAD */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#DFC498]" />
            Arquivos e Relatórios Oficiais Publicados ({latestFirstReports.length})
          </h3>
          <span className="text-xs text-[#8FAEA2]">
            Clique em "Ver Detalhes" para abrir o modal completo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {latestFirstReports.map(rep => (
            <Card
              key={rep.id}
              className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/40 transition-all shadow-md flex flex-col justify-between"
            >
              <CardHeader className="pb-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-[#DFC498]/10 text-[#DFC498] border-[#DFC498]/20 font-mono text-[11px]">
                      {rep.period}
                    </Badge>
                    {rep.gmbMetrics?.rankingPosition && (
                      <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px] flex items-center gap-1 font-semibold">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        Google Maps #{rep.gmbMetrics.rankingPosition}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-[#8FAEA2]">
                    {new Date(rep.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <CardTitle className="text-sm font-bold text-white line-clamp-1">
                  {rep.title}
                </CardTitle>
                <CardDescription className="text-xs text-[#8FAEA2] line-clamp-2">
                  {rep.summary}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {rep.gmbMetrics && (
                  <div className="grid grid-cols-3 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-[#8FAEA2] block">Rotas GPS</span>
                      <span className="font-bold text-emerald-400">{rep.gmbMetrics.directionRequests || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8FAEA2] block">Ligações</span>
                      <span className="font-bold text-white">{rep.gmbMetrics.calls || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8FAEA2] block">Cliques Site</span>
                      <span className="font-bold text-blue-400">{rep.gmbMetrics.websiteClicks || 0}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    onClick={() => onOpenReportDetails(rep)}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/10 text-white hover:bg-white/5 rounded-xl text-xs h-9"
                  >
                    Ver Relatório Detalhado
                  </Button>

                  {rep.externalUrl && (
                    <Button
                      onClick={() => window.open(rep.externalUrl, '_blank')}
                      size="sm"
                      className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold rounded-xl text-xs h-9 gap-1.5 shadow"
                    >
                      Looker Studio <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

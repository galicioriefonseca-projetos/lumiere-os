import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  TrendingUp, 
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
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Filter, 
  Eye, 
  RotateCcw,
  BarChart3,
  PieChart as PieChartIcon,
  HelpCircle,
  MessageSquare,
  CalendarCheck,
  Smartphone,
  Monitor,
  Zap,
  Info,
  BookOpen
} from 'lucide-react';
import { ClientReport } from '../../types';

interface ReportsAnalyticsTabProps {
  reports: ClientReport[];
  agencyName: string;
  clientName: string;
  onOpenReportDetails: (report: ClientReport) => void;
}

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
  
  // Seleção do Mês em Foco (Para o usuário selecionar um mês específico no calendário/dropdown)
  const [selectedActiveMonthId, setSelectedActiveMonthId] = useState<string>('');

  // Modo de Comparação Específica entre Dois Meses
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [compareMonthA, setCompareMonthA] = useState<string>('');
  const [compareMonthB, setCompareMonthB] = useState<string>('');

  // Modal explicativo "O que significa cada coisa"
  const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);

  // Ordenar relatórios cronologicamente (do mais antigo ao mais recente para gráficos)
  const chronologicalReports = useMemo(() => {
    const getReportTime = (r: ClientReport): number => {
      if (r.startDate) {
        const parts = r.startDate.split('-');
        if (parts.length === 3) {
          return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
        }
        return new Date(r.startDate).getTime();
      }
      if (r.year && r.month) {
        return new Date(r.year, r.month - 1, 1).getTime();
      }
      return r.createdAt || 0;
    };

    return [...reports].sort((a, b) => getReportTime(a) - getReportTime(b));
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

  // Lista de relatórios ordenados do mais recente para o mais antigo
  const latestFirstReports = useMemo(() => {
    return [...filteredReports].reverse();
  }, [filteredReports]);

  // Relatório do Mês Ativo Selecionado (ou o mais recente por padrão)
  const activeReport = useMemo(() => {
    if (selectedActiveMonthId) {
      const found = reports.find(r => r.id === selectedActiveMonthId);
      if (found) return found;
    }
    return latestFirstReports[0] || null;
  }, [reports, selectedActiveMonthId, latestFirstReports]);

  // Localizar o mês imediatamente anterior ao mês ativo para comparativo
  const previousReportOfActive = useMemo(() => {
    if (!activeReport) return null;
    const activeIndex = chronologicalReports.findIndex(r => r.id === activeReport.id);
    if (activeIndex > 0) {
      return chronologicalReports[activeIndex - 1];
    }
    return null;
  }, [activeReport, chronologicalReports]);

  // Se o usuário estiver no modo de comparação manual de 2 meses:
  const reportA = useMemo(() => {
    if (!compareMonthA) return activeReport;
    return reports.find(r => r.id === compareMonthA) || activeReport;
  }, [reports, compareMonthA, activeReport]);

  const reportB = useMemo(() => {
    if (!compareMonthB) return previousReportOfActive;
    return reports.find(r => r.id === compareMonthB) || previousReportOfActive;
  }, [reports, compareMonthB, previousReportOfActive]);

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

  // Fontes de comparação ativas
  const currentSource = comparisonMode ? reportA : activeReport;
  const previousSource = comparisonMode ? reportB : previousReportOfActive;

  const currentGmb = currentSource?.gmbMetrics || {};
  const prevGmb = previousSource?.gmbMetrics || {};

  // Interações no Perfil da Empresa
  const currentInteractions = currentGmb.totalInteractions || (
    Number(currentGmb.calls || 0) +
    Number(currentGmb.directionRequests || 0) +
    Number(currentGmb.websiteClicks || 0) +
    Number(currentGmb.chatClicks || 0) +
    Number(currentGmb.bookings || 0)
  );

  const prevInteractions = prevGmb.totalInteractions || (
    Number(prevGmb.calls || 0) +
    Number(prevGmb.directionRequests || 0) +
    Number(prevGmb.websiteClicks || 0) +
    Number(prevGmb.chatClicks || 0) +
    Number(prevGmb.bookings || 0)
  );

  const interactionsVar = calcVariation(currentInteractions, prevInteractions);

  // Pessoas que Visualizaram o Perfil da Empresa
  const currentViewers = currentGmb.peopleViewedProfile || (
    (currentGmb.searchImpressions || 0) + (currentGmb.mapsImpressions || 0)
  ) || (currentSource?.metrics?.reach || 0);

  const prevViewers = prevGmb.peopleViewedProfile || (
    (prevGmb.searchImpressions || 0) + (prevGmb.mapsImpressions || 0)
  ) || (previousSource?.metrics?.reach || 0);

  const viewersVar = calcVariation(currentViewers, prevViewers);

  // Variações específicas das ações do Google Meu Negócio
  const callsVar = calcVariation(currentGmb.calls || 0, prevGmb.calls || 0);
  const chatVar = calcVariation(currentGmb.chatClicks || 0, prevGmb.chatClicks || 0);
  const bookingsVar = calcVariation(currentGmb.bookings || 0, prevGmb.bookings || 0);
  const routesVar = calcVariation(currentGmb.directionRequests || 0, prevGmb.directionRequests || 0);
  const webVar = calcVariation(currentGmb.websiteClicks || 0, prevGmb.websiteClicks || 0);

  // Formatação para gráficos Recharts com base nos relatórios filtrados
  const chartData = useMemo(() => {
    return filteredReports.map(r => {
      const gmb = r.gmbMetrics || {};
      const periodLabel = r.period.replace('/ 20', '/').replace(' / ', '/').replace(' de 20', '/');
      const searchViews = gmb.searchImpressions || 0;
      const mapsViews = gmb.mapsImpressions || 0;
      const totalViews = gmb.peopleViewedProfile || (searchViews + mapsViews) || (r.metrics?.reach || 0);
      const callsCount = gmb.calls || (r.metrics?.leads || 0);
      const chatCount = gmb.chatClicks || 0;
      const bookingsCount = gmb.bookings || 0;
      const routesCount = gmb.directionRequests || 0;
      const webClicks = gmb.websiteClicks || (r.metrics?.conversions || 0);
      const totalActions = gmb.totalInteractions || (callsCount + chatCount + bookingsCount + routesCount + webClicks);

      return {
        id: r.id,
        period: periodLabel,
        fullPeriod: r.period,
        searchViews,
        mapsViews,
        totalViews,
        totalActions,
        calls: callsCount,
        chat: chatCount,
        bookings: bookingsCount,
        routes: routesCount,
        webClicks,
        rating: gmb.rating || 5.0
      };
    });
  }, [filteredReports]);

  // Histórico mensal de interações do GMN (se o relatório possuir a tabela de meses do Google, ou sintetizada da série)
  const monthlyInteractionsHistory = useMemo(() => {
    if (activeReport?.gmbMetrics?.monthlyInteractions && activeReport.gmbMetrics.monthlyInteractions.length > 0) {
      return activeReport.gmbMetrics.monthlyInteractions;
    }
    // Fallback gerado a partir dos relatórios existentes no sistema
    return chronologicalReports.map(r => ({
      month: r.period,
      interactions: r.gmbMetrics?.totalInteractions || (
        Number(r.gmbMetrics?.calls || 0) +
        Number(r.gmbMetrics?.directionRequests || 0) +
        Number(r.gmbMetrics?.websiteClicks || 0) +
        Number(r.gmbMetrics?.chatClicks || 0) +
        Number(r.gmbMetrics?.bookings || 0)
      )
    }));
  }, [activeReport, chronologicalReports]);

  // Dados para Gráfico de Distribuição de Ações (Pie Chart)
  const actionsPieData = useMemo(() => {
    const totalCalls = currentGmb.calls || 0;
    const totalRoutes = currentGmb.directionRequests || 0;
    const totalClicks = currentGmb.websiteClicks || 0;
    const totalChat = currentGmb.chatClicks || 0;
    const totalBookings = currentGmb.bookings || 0;
    const total = totalCalls + totalRoutes + totalClicks + totalChat + totalBookings;

    if (total === 0) return [];

    const list = [
      { name: 'Rotas GPS (Visitas)', value: totalRoutes, color: '#10B981' },
      { name: 'Chamadas Telefônicas', value: totalCalls, color: '#DFC498' },
      { name: 'Cliques no Website', value: totalClicks, color: '#38BDF8' }
    ];

    if (totalChat > 0) list.push({ name: 'Cliques no Chat', value: totalChat, color: '#A855F7' });
    if (totalBookings > 0) list.push({ name: 'Agendamentos', value: totalBookings, color: '#EC4899' });

    return list;
  }, [currentGmb]);

  // Top Keywords consolidadas
  const topKeywordsList = useMemo(() => {
    const kws = currentGmb.topKeywords;
    if (Array.isArray(kws) && kws.length > 0) {
      return kws.map((item: any) => {
        if (typeof item === 'string') return { keyword: item, count: 50 };
        return { keyword: item.keyword, count: item.count || 20 };
      }).slice(0, 6);
    }

    const kwMap = new Map<string, number>();
    filteredReports.forEach(r => {
      const list = r.gmbMetrics?.topKeywords;
      if (Array.isArray(list)) {
        list.forEach((item: any) => {
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
  }, [currentGmb, filteredReports]);

  // Se não houver relatórios cadastrados
  if (reports.length === 0) {
    return (
      <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-16">
        <CardContent className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#DFC498]/10 border border-[#DFC498]/20 flex items-center justify-center mx-auto text-[#DFC498]">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Nenhum relatório de desempenho do Google publicado</h3>
            <p className="text-xs text-[#8FAEA2] max-w-md mx-auto leading-relaxed">
              Assim que a equipe da <strong className="text-white">{agencyName}</strong> fizer o upload do PDF de desempenho do Google Business Profile, você poderá navegar pelos meses anteriores no calendário, visualizar gráficos comparativos e entender cada métrica.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* BARRA SUPERIOR: CONTROLE DE SELEÇÃO DE MÊS NO CALENDÁRIO, COMPARATIVO & GLOSSÁRIO */}
      <div className="bg-[#0A261E] border border-[#17473A] p-4 sm:p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#DFC498] bg-[#DFC498]/10 px-2.5 py-0.5 rounded-full border border-[#DFC498]/20">
              <Sparkles className="w-3.5 h-3.5" /> Google Business Profile • Relatórios Oficiais
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Desempenho & Comparativo Mensal do Google
            </h2>
            <p className="text-xs text-[#8FAEA2]">
              Organização dos dados de desempenho do Google Meu Negócio com gráficos de evolução, comparativos e explicações didáticas.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* BOTÃO EXPLICATIVO: O QUE SIGNIFICA CADA COISA */}
            <Button
              size="sm"
              onClick={() => setIsGlossaryModalOpen(true)}
              className="bg-[#DFC498]/15 hover:bg-[#DFC498]/25 text-[#DFC498] border border-[#DFC498]/30 font-semibold text-xs h-9 rounded-xl gap-1.5 shadow"
            >
              <HelpCircle className="w-4 h-4 text-[#DFC498]" /> O que significa cada métrica?
            </Button>

            {/* SELETOR PRINCIPAL DE MÊS (CALENDÁRIO DE MESES ANTERIORES) */}
            <div className="flex items-center gap-2 bg-[#061A14] border border-[#17473A] px-3 py-1.5 rounded-xl">
              <CalendarIcon className="w-4 h-4 text-[#DFC498]" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-[#8FAEA2] tracking-wider">Mês Selecionado</span>
                <select
                  value={activeReport?.id || ''}
                  onChange={e => setSelectedActiveMonthId(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer pr-2"
                >
                  {latestFirstReports.map(r => (
                    <option key={r.id} value={r.id} className="bg-[#0A261E] text-white">
                      {r.period} {r.id === latestFirstReports[0]?.id ? '★ (Mais recente)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ATALHOS RÁPIDOS DE FILTRAGEM & MODO COMPARATIVO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#17473A]/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-[#8FAEA2] mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#DFC498]" /> Exibir nos gráficos:
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
              Todos ({reports.length})
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
          </div>

          {/* TOGGLE MODO COMPARATIVO DIRETO */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setComparisonMode(!comparisonMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                comparisonMode 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-white/5 text-[#8FAEA2] hover:text-white border border-white/10'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {comparisonMode ? 'Modo Comparativo Ativo' : 'Comparar 2 Meses Lado a Lado'}
            </button>
          </div>
        </div>

        {/* MODO COMPARATIVO: SELEÇÃO DE MÊS A VS MÊS B */}
        {comparisonMode && reports.length >= 2 && (
          <div className="bg-black/30 border border-white/10 p-3 rounded-xl flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-[#DFC498] font-bold flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-[#DFC498]" /> Selecione os 2 meses para comparar:
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#8FAEA2] text-[11px]">Mês A:</span>
                <select
                  value={compareMonthA || activeReport?.id}
                  onChange={e => setCompareMonthA(e.target.value)}
                  className="bg-[#061A14] border border-[#17473A] text-white text-xs rounded-lg px-2 py-1 outline-none font-bold"
                >
                  {reports.map(r => (
                    <option key={r.id} value={r.id}>{r.period}</option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-[#DFC498] font-bold">vs</span>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#8FAEA2] text-[11px]">Mês B:</span>
                <select
                  value={compareMonthB || previousReportOfActive?.id || reports[1]?.id}
                  onChange={e => setCompareMonthB(e.target.value)}
                  className="bg-[#061A14] border border-[#17473A] text-white text-xs rounded-lg px-2 py-1 outline-none font-bold"
                >
                  {reports.map(r => (
                    <option key={r.id} value={r.id}>{r.period}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BLOCO DESTAQUE 1: INTERAÇÕES NO PERFIL DA EMPRESA (COM AS 5 AÇÕES DO GMN) */}
      <Card className="bg-[#0A261E] border border-[#17473A] shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#17473A]/80 bg-gradient-to-r from-[#0A261E] to-[#0D3328]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-[#DFC498]/20 text-[#DFC498] border-[#DFC498]/30 font-bold text-xs uppercase tracking-wider">
                  Visão Geral de Desempenho
                </Badge>
                <span className="text-xs text-[#8FAEA2]">
                  Mês: <strong className="text-white">{currentSource?.period}</strong>
                </span>
              </div>
              <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 pt-1">
                <Zap className="w-5 h-5 text-[#DFC498]" />
                Interações no Perfil da Empresa
              </CardTitle>
              <CardDescription className="text-xs text-[#8FAEA2]">
                Ações concretas realizadas pelos clientes após encontrar sua empresa no Google.
              </CardDescription>
            </div>

            {/* Número Total de Interações e Variação */}
            <div className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-xl border border-white/10 self-start sm:self-auto">
              <div className="text-right">
                <span className="text-[10px] text-[#8FAEA2] uppercase tracking-wider block font-medium">Total de Interações</span>
                <span className="text-2xl font-bold text-[#DFC498] font-mono leading-none">
                  {currentInteractions.toLocaleString('pt-BR')}
                </span>
              </div>
              {previousSource && (
                <div className="border-l border-white/10 pl-3">
                  <Badge className={`text-xs font-bold px-2 py-1 flex items-center gap-0.5 ${
                    interactionsVar.isUp 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : interactionsVar.isZero
                      ? 'bg-white/5 text-[#8FAEA2]'
                      : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}>
                    {interactionsVar.isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : interactionsVar.isZero ? <Minus className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {interactionsVar.pct}%
                  </Badge>
                  <span className="text-[9px] text-[#8FAEA2] block mt-0.5 text-center">vs {previousSource.period}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* AS 5 AÇÕES DO GOOGLE MEU NEGÓCIO */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1. CHAMADAS */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-[#17473A] space-y-2 relative group hover:border-[#DFC498]/40 transition">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#DFC498]" /> Chamadas
                </span>
                {previousSource && (
                  <span className={`text-[10px] font-bold ${callsVar.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {callsVar.isUp ? '+' : ''}{callsVar.pct}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white font-mono">
                  {currentGmb.calls || 0}
                </span>
                <span className="text-[10px] text-[#8FAEA2]">ligações</span>
              </div>
              <p className="text-[10px] text-[#8FAEA2] leading-tight pt-1 border-t border-white/5">
                Pessoas que tocaram para ligar para seu estabelecimento.
              </p>
            </div>

            {/* 2. CLIQUES NO CHAT */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-[#17473A] space-y-2 hover:border-[#DFC498]/40 transition">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-purple-400" /> Cliques no Chat
                </span>
                {previousSource && (
                  <span className={`text-[10px] font-bold ${chatVar.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {chatVar.isUp ? '+' : ''}{chatVar.pct}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white font-mono">
                  {currentGmb.chatClicks || 0}
                </span>
                <span className="text-[10px] text-purple-400">mensagens</span>
              </div>
              <p className="text-[10px] text-[#8FAEA2] leading-tight pt-1 border-t border-white/5">
                Início de conversas diretas de clientes pelo Google.
              </p>
            </div>

            {/* 3. AGENDAMENTOS */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-[#17473A] space-y-2 hover:border-[#DFC498]/40 transition">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-pink-400" /> Agendamentos
                </span>
                {previousSource && (
                  <span className={`text-[10px] font-bold ${bookingsVar.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {bookingsVar.isUp ? '+' : ''}{bookingsVar.pct}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white font-mono">
                  {currentGmb.bookings || 0}
                </span>
                <span className="text-[10px] text-pink-400">reservas</span>
              </div>
              <p className="text-[10px] text-[#8FAEA2] leading-tight pt-1 border-t border-white/5">
                Cliques diretos no botão de agendamento online.
              </p>
            </div>

            {/* 4. ORIENTAÇÕES / ROTAS */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-[#17473A] space-y-2 hover:border-[#DFC498]/40 transition">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-emerald-400" /> Orientações
                </span>
                {previousSource && (
                  <span className={`text-[10px] font-bold ${routesVar.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {routesVar.isUp ? '+' : ''}{routesVar.pct}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-400 font-mono">
                  {currentGmb.directionRequests || 0}
                </span>
                <span className="text-[10px] text-emerald-400">rotas GPS</span>
              </div>
              <p className="text-[10px] text-[#8FAEA2] leading-tight pt-1 border-t border-white/5">
                Pessoas que abriram rota no Maps/Waze para ir até você.
              </p>
            </div>

            {/* 5. CLIQUES NO WEBSITE */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-[#17473A] space-y-2 hover:border-[#DFC498]/40 transition">
              <div className="flex items-center justify-between text-[#8FAEA2]">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-400" /> Cliques no Site
                </span>
                {previousSource && (
                  <span className={`text-[10px] font-bold ${webVar.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {webVar.isUp ? '+' : ''}{webVar.pct}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-400 font-mono">
                  {currentGmb.websiteClicks || 0}
                </span>
                <span className="text-[10px] text-blue-400">visitas</span>
              </div>
              <p className="text-[10px] text-[#8FAEA2] leading-tight pt-1 border-t border-white/5">
                Acessos ao seu site ou link de agendamento online.
              </p>
            </div>
          </div>

          {/* HISTÓRICO MÊS A MÊS DE INTERAÇÕES (EXATAMENTE COMO NO GOOGLE MEU NEGÓCIO) */}
          {monthlyInteractionsHistory.length > 0 && (
            <div className="bg-[#061A14] p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-[#DFC498]" /> Histórico de Interações Mês a Mês
                </span>
                <span className="text-[11px] text-[#8FAEA2]">
                  Evolução do volume de ações diretas dos clientes
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {monthlyInteractionsHistory.map((item, idx) => (
                  <div key={idx} className="bg-black/30 p-2.5 rounded-lg border border-white/5 text-center">
                    <span className="text-[10px] text-[#8FAEA2] block truncate">{item.month}</span>
                    <span className="text-base font-bold text-[#DFC498] font-mono">{item.interactions}</span>
                    <span className="text-[9px] text-zinc-500 block">interações</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOCO DESTAQUE 2: COMO AS PESSOAS DESCOBRIRAM SUA EMPRESA (VISUALIZAÇÕES, PLATAFORMA E DISPOSITIVO) */}
      <Card className="bg-[#0A261E] border border-[#17473A] shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#17473A]/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                Como as pessoas descobriram sua empresa
              </CardTitle>
              <CardDescription className="text-xs text-[#8FAEA2]">
                Número de pessoas que visualizaram o Perfil da Empresa e detalhes sobre plataformas e dispositivos.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-xl border border-white/10 self-start sm:self-auto">
              <div className="text-right">
                <span className="text-[10px] text-[#8FAEA2] uppercase tracking-wider block font-medium">Pessoas que Visualizaram</span>
                <span className="text-2xl font-bold text-white font-mono leading-none">
                  {currentViewers.toLocaleString('pt-BR')}
                </span>
              </div>
              {previousSource && (
                <div className="border-l border-white/10 pl-3">
                  <Badge className={`text-xs font-bold px-2 py-1 flex items-center gap-0.5 ${
                    viewersVar.isUp 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : viewersVar.isZero
                      ? 'bg-white/5 text-[#8FAEA2]'
                      : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}>
                    {viewersVar.isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : viewersVar.isZero ? <Minus className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {viewersVar.pct}%
                  </Badge>
                  <span className="text-[9px] text-[#8FAEA2] block mt-0.5 text-center">vs {previousSource.period}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#DFC498]" /> Detalhes sobre a plataforma e o dispositivo
            </h4>
            <p className="text-xs text-[#8FAEA2]">
              A plataforma e os dispositivos que as pessoas usaram para encontrar seu perfil no Google neste período.
            </p>
          </div>

          {/* BARRAS DE PROPORÇÃO POR PLATAFORMA E DISPOSITIVO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Pesquisa Google - Dispositivos Móveis */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" /> Pesquisa – Mobile
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  {currentGmb.platformBreakdown?.searchMobile?.percentage || 54}%
                </span>
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {(currentGmb.platformBreakdown?.searchMobile?.count || Math.round(currentViewers * 0.54)).toLocaleString('pt-BR')}
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${currentGmb.platformBreakdown?.searchMobile?.percentage || 54}%` }}
                />
              </div>
              <span className="text-[10px] text-[#8FAEA2] block">Pesquisa Google em celulares</span>
            </div>

            {/* 2. Google Maps - Dispositivos Móveis */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#DFC498]" /> Google Maps – Mobile
                </span>
                <span className="font-bold text-[#DFC498] font-mono">
                  {currentGmb.platformBreakdown?.mapsMobile?.percentage || 20}%
                </span>
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {(currentGmb.platformBreakdown?.mapsMobile?.count || Math.round(currentViewers * 0.20)).toLocaleString('pt-BR')}
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#DFC498] rounded-full"
                  style={{ width: `${currentGmb.platformBreakdown?.mapsMobile?.percentage || 20}%` }}
                />
              </div>
              <span className="text-[10px] text-[#8FAEA2] block">Aplicativo Maps em celulares</span>
            </div>

            {/* 3. Pesquisa Google - Computadores */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-blue-400" /> Pesquisa – PC
                </span>
                <span className="font-bold text-blue-400 font-mono">
                  {currentGmb.platformBreakdown?.searchDesktop?.percentage || 16}%
                </span>
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {(currentGmb.platformBreakdown?.searchDesktop?.count || Math.round(currentViewers * 0.16)).toLocaleString('pt-BR')}
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${currentGmb.platformBreakdown?.searchDesktop?.percentage || 16}%` }}
                />
              </div>
              <span className="text-[10px] text-[#8FAEA2] block">Pesquisa em desktops/notebooks</span>
            </div>

            {/* 4. Google Maps - Computadores */}
            <div className="bg-[#061A14] p-3.5 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-purple-400" /> Google Maps – PC
                </span>
                <span className="font-bold text-purple-400 font-mono">
                  {currentGmb.platformBreakdown?.mapsDesktop?.percentage || 9}%
                </span>
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {(currentGmb.platformBreakdown?.mapsDesktop?.count || Math.round(currentViewers * 0.09)).toLocaleString('pt-BR')}
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-400 rounded-full"
                  style={{ width: `${currentGmb.platformBreakdown?.mapsDesktop?.percentage || 9}%` }}
                />
              </div>
              <span className="text-[10px] text-[#8FAEA2] block">Google Maps web em computadores</span>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  Comparativo de impressões no Google Maps vs Pesquisa Google ao longo dos meses.
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

        {/* GRÁFICO 2: PROPORÇÃO DE AÇÕES (DONUT CHART) - OCUPA 1 COLUNA */}
        <Card className="bg-[#0A261E] border-[#17473A] shadow-xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#DFC498]" />
              Distribuição de Ações
            </CardTitle>
            <CardDescription className="text-xs text-[#8FAEA2]">
              Divisão de interações geradas em {currentSource?.period}.
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

                <div className="space-y-1.5 pt-2 border-t border-white/5">
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

      {/* GRÁFICO 3: AÇÕES DE CONVERSÃO MÊS A MÊS & RANKING DE PALAVRAS-CHAVE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO DE CONVERSÕES: ROTAS, LIGAÇÕES E CLIQUES NO SITE */}
        <Card className="lg:col-span-2 bg-[#0A261E] border-[#17473A] shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              Conversões Mês a Mês: Rotas, Ligações & Cliques
            </CardTitle>
            <CardDescription className="text-xs text-[#8FAEA2]">
              Crescimento de contatos e visitas presenciais para {clientName}.
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
              Consultas de pesquisa que exibiram seu perfil aos clientes.
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
                      style={{ width: `${Math.min(100, Math.max(15, (kw.count / (topKeywordsList[0]?.count || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-[#8FAEA2] text-xs">
                Termos de pesquisa em monitoramento.
              </div>
            )}

            {currentGmb.targetKeyword && (
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[11px] text-[#8FAEA2] mt-2">
                Palavra-chave foco: <strong className="text-[#DFC498] font-mono block text-xs mt-0.5">{currentGmb.targetKeyword}</strong>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TABELA COMPARATIVA MÊS A MÊS COM TODAS AS MÉTRICAS DO GMN */}
      <Card className="bg-[#0A261E] border-[#17473A] shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#17473A]/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#DFC498]" />
                Tabela Comparativa Mês a Mês Completa
              </CardTitle>
              <CardDescription className="text-xs text-[#8FAEA2]">
                Evolução comparativa de todas as métricas oficiais do Google Meu Negócio.
              </CardDescription>
            </div>
            <span className="text-xs text-[#8FAEA2]">
              Exibindo <strong className="text-white">{filteredReports.length}</strong> mês(es) cadastrado(s)
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-[#17473A] text-[#8FAEA2]">
                <th className="p-3.5 font-semibold text-white">Métrica Oficial do Google</th>
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
              {/* INTERAÇÕES TOTAIS */}
              <tr className="hover:bg-white/[0.02] bg-[#DFC498]/5">
                <td className="p-3.5 font-bold text-white flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#DFC498]" /> Total de Interações no Perfil
                </td>
                {filteredReports.map(rep => {
                  const gmb = rep.gmbMetrics || {};
                  const total = gmb.totalInteractions || (
                    Number(gmb.calls || 0) + Number(gmb.directionRequests || 0) + Number(gmb.websiteClicks || 0) + Number(gmb.chatClicks || 0) + Number(gmb.bookings || 0)
                  );
                  return (
                    <td key={rep.id} className="p-3.5 text-center font-mono font-bold text-[#DFC498]">
                      {total.toLocaleString('pt-BR')}
                    </td>
                  );
                })}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    <span className={`inline-flex items-center gap-0.5 ${interactionsVar.isUp ? 'text-emerald-400' : interactionsVar.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                      {interactionsVar.isUp ? '+' : '-'}{interactionsVar.pct}%
                    </span>
                  </td>
                )}
              </tr>

              {/* PESSOAS QUE VISUALIZARAM */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-blue-400" /> Pessoas que Visualizaram o Perfil
                </td>
                {filteredReports.map(rep => {
                  const val = rep.gmbMetrics?.peopleViewedProfile || ((rep.gmbMetrics?.searchImpressions || 0) + (rep.gmbMetrics?.mapsImpressions || 0));
                  return (
                    <td key={rep.id} className="p-3.5 text-center font-mono font-medium">
                      {val.toLocaleString('pt-BR')}
                    </td>
                  );
                })}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    <span className={`inline-flex items-center gap-0.5 ${viewersVar.isUp ? 'text-emerald-400' : viewersVar.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                      {viewersVar.isUp ? '+' : '-'}{viewersVar.pct}%
                    </span>
                  </td>
                )}
              </tr>

              {/* ROTAS NO MAPA */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" /> Solicitações de Rotas (GPS / Waze)
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-bold text-emerald-400">
                    {rep.gmbMetrics?.directionRequests || 0}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    <span className={`inline-flex items-center gap-0.5 ${routesVar.isUp ? 'text-emerald-400' : routesVar.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                      {routesVar.isUp ? '+' : '-'}{routesVar.pct}%
                    </span>
                  </td>
                )}
              </tr>

              {/* CHAMADAS */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#DFC498]" /> Chamadas Telefônicas Diretas
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-bold text-white">
                    {rep.gmbMetrics?.calls || 0}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    <span className={`inline-flex items-center gap-0.5 ${callsVar.isUp ? 'text-emerald-400' : callsVar.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                      {callsVar.isUp ? '+' : '-'}{callsVar.pct}%
                    </span>
                  </td>
                )}
              </tr>

              {/* CLIQUES NO SITE */}
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
                    <span className={`inline-flex items-center gap-0.5 ${webVar.isUp ? 'text-emerald-400' : webVar.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                      {webVar.isUp ? '+' : '-'}{webVar.pct}%
                    </span>
                  </td>
                )}
              </tr>

              {/* CLIQUES NO CHAT */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> Cliques no Chat
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-medium text-purple-300">
                    {rep.gmbMetrics?.chatClicks || 0}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    <span className={`inline-flex items-center gap-0.5 ${chatVar.isUp ? 'text-emerald-400' : chatVar.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                      {chatVar.isUp ? '+' : '-'}{chatVar.pct}%
                    </span>
                  </td>
                )}
              </tr>

              {/* AGENDAMENTOS */}
              <tr className="hover:bg-white/[0.02]">
                <td className="p-3.5 font-medium flex items-center gap-2">
                  <CalendarCheck className="w-3.5 h-3.5 text-pink-400" /> Agendamentos Solicitados
                </td>
                {filteredReports.map(rep => (
                  <td key={rep.id} className="p-3.5 text-center font-mono font-medium text-pink-300">
                    {rep.gmbMetrics?.bookings || 0}
                  </td>
                ))}
                {filteredReports.length >= 2 && (
                  <td className="p-3.5 text-right font-bold font-mono">
                    <span className={`inline-flex items-center gap-0.5 ${bookingsVar.isUp ? 'text-emerald-400' : bookingsVar.isZero ? 'text-[#8FAEA2]' : 'text-red-400'}`}>
                      {bookingsVar.isUp ? '+' : '-'}{bookingsVar.pct}%
                    </span>
                  </td>
                )}
              </tr>

              {/* AVALIAÇÃO & REVIEWS */}
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

      {/* RESUMO EXECUTIVO DO MÊS SELECIONADO GERADO POR IA */}
      {currentSource?.summary && (
        <Card className="bg-gradient-to-br from-[#0A261E] to-[#061A14] border border-[#DFC498]/30 shadow-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-[#DFC498]/10 text-[#DFC498] border-[#DFC498]/20 flex items-center gap-1 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> Análise Executiva da Agência {agencyName}
              </Badge>
              <span className="text-xs text-[#8FAEA2]">
                Referência: <strong className="text-white">{currentSource.period}</strong>
              </span>
            </div>
            <CardTitle className="text-base font-bold text-white pt-1">
              Síntese do Período & Recomendações Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs sm:text-sm text-[#E1EDE8] leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
              {currentSource.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* LISTAGEM INDIVIDUAL DE RELATÓRIOS DO PERÍODO COM BOTÃO DE DETALHES & DOWNLOAD */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#DFC498]" />
            Relatórios Mensais Publicados ({latestFirstReports.length})
          </h3>
          <span className="text-xs text-[#8FAEA2]">
            Clique em "Ver Detalhes" para abrir o resumo completo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {latestFirstReports.map(rep => (
            <Card
              key={rep.id}
              className={`bg-[#0A261E] border transition-all shadow-md flex flex-col justify-between ${
                rep.id === activeReport?.id ? 'border-[#DFC498] ring-1 ring-[#DFC498]/40' : 'border-[#17473A] hover:border-[#DFC498]/40'
              }`}
            >
              <CardHeader className="pb-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-[#DFC498]/10 text-[#DFC498] border-[#DFC498]/20 font-mono text-[11px]">
                      {rep.period}
                    </Badge>
                    {rep.id === activeReport?.id && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                        Mês em Foco
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

      {/* MODAL DIDÁTICO: O QUE SIGNIFICA CADA MÉTRICA */}
      <Dialog open={isGlossaryModalOpen} onOpenChange={setIsGlossaryModalOpen}>
        <DialogContent className="max-w-2xl bg-[#061A14] border-[#17473A] text-white p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#DFC498] text-xs font-bold uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-[#DFC498]" /> Guia Oficial do Google Meu Negócio
            </div>
            <DialogTitle className="text-xl font-bold text-white">
              O que significa cada métrica de desempenho?
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Entenda como cada indicador do Google reflete em faturamento e novos clientes no seu salão ou clínica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            {/* 1. Interações no Perfil */}
            <div className="bg-[#0A261E] p-3.5 rounded-xl border border-[#17473A] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Zap className="w-4 h-4 text-[#DFC498]" /> Interações no Perfil da Empresa
              </div>
              <p className="text-[#E1EDE8] leading-relaxed">
                É a soma total de todas as ações deliberadas que um cliente tomou após encontrar o seu salão no Google (ligar, pedir rota no GPS, mandar mensagem no chat, agendar ou visitar seu site). É o melhor termômetro do interesse real de compra.
              </p>
            </div>

            {/* 2. Chamadas */}
            <div className="bg-[#0A261E] p-3.5 rounded-xl border border-[#17473A] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Phone className="w-4 h-4 text-[#DFC498]" /> Chamadas (Ligações Telefônicas)
              </div>
              <p className="text-[#E1EDE8] leading-relaxed">
                Mostra quantas pessoas clicaram no botão "Ligar" do seu perfil diretamente do Google. São clientes com alta intenção que ligaram para tirar dúvidas, consultar disponibilidade ou agendar serviços imediatamente.
              </p>
            </div>

            {/* 3. Orientações (Rotas GPS) */}
            <div className="bg-[#0A261E] p-3.5 rounded-xl border border-[#17473A] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Navigation className="w-4 h-4 text-emerald-400" /> Orientações (Solicitações de Rota no Mapa)
              </div>
              <p className="text-[#E1EDE8] leading-relaxed">
                Indica o número de pessoas que abriram a rota no Google Maps ou Waze para ir presencialmente até o endereço físico do seu estabelecimento. Representa fluxo real de clientes na sua porta!
              </p>
            </div>

            {/* 4. Cliques no Website */}
            <div className="bg-[#0A261E] p-3.5 rounded-xl border border-[#17473A] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Globe className="w-4 h-4 text-blue-400" /> Cliques no Website
              </div>
              <p className="text-[#E1EDE8] leading-relaxed">
                Mede quantas pessoas clicaram para acessar seu site, link da bio, cardápio de serviços ou sistema de agendamento online.
              </p>
            </div>

            {/* 5. Cliques no Chat */}
            <div className="bg-[#0A261E] p-3.5 rounded-xl border border-[#17473A] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <MessageSquare className="w-4 h-4 text-purple-400" /> Cliques no Chat
              </div>
              <p className="text-[#E1EDE8] leading-relaxed">
                Clientes que iniciaram uma conversa de mensagem com sua empresa pela ferramenta oficial de mensagens do Google.
              </p>
            </div>

            {/* 6. Agendamentos */}
            <div className="bg-[#0A261E] p-3.5 rounded-xl border border-[#17473A] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <CalendarCheck className="w-4 h-4 text-pink-400" /> Agendamentos
              </div>
              <p className="text-[#E1EDE8] leading-relaxed">
                Número de pessoas que clicaram no botão de reserva ou agendamento de horários integrado ao perfil do Google.
              </p>
            </div>

            {/* 7. Pessoas que Visualizaram e Dispositivos Móveis */}
            <div className="bg-[#0A261E] p-3.5 rounded-xl border border-[#17473A] space-y-1.5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Eye className="w-4 h-4 text-emerald-400" /> Pessoas que Visualizaram o Perfil & Dispositivos Móveis
              </div>
              <p className="text-[#E1EDE8] leading-relaxed">
                Alcance total único de quantas pessoas viram o seu perfil na Pesquisa Google e no Google Maps. A divisão mostra que mais de 70% a 80% das buscas por beleza acontecem em smartphones (dispositivos móveis), provando a importância de ter um perfil com fotos de alta qualidade e botões de contato ágeis.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => setIsGlossaryModalOpen(false)}
              className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold h-10 rounded-xl text-xs"
            >
              Entendi todas as métricas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

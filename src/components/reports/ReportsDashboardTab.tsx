import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Maximize2,
  Printer,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBRL } from '@/lib/utils';
import {
  computeReportsDashboard,
  exportReportToPdf,
  exportRowsToCsv,
  type DashboardDatasetInput,
  type PeriodFilterMode,
  type ReportPeriodFilter,
} from '@/services/reportsEngine';
import { generateAiReportDiagnosis } from '@/services/lumiAiService';
import type { SheetCellValue } from '@/services/googleWorkspaceService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ReportsDashboardTabProps {
  salonName: string;
  data: DashboardDatasetInput;
  filter: ReportPeriodFilter;
  onChangeFilter: (next: ReportPeriodFilter) => void;
  onOpenSheetsExport: (payload: {
    title: string;
    tabTitle: string;
    datasetLabel: string;
    headers: string[];
    rows: SheetCellValue[][];
  }) => void;
}

type WidgetKey =
  | 'evolution'
  | 'origins'
  | 'bestClients'
  | 'ageBrackets'
  | 'quality'
  | 'professionalsAndServices';

const CHART_COLORS = ['#8A6D36', '#171717', '#4B5563', '#0F766E', '#B45309', '#6D28D9'];

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs text-[#6B6B6B] tabular-nums">Sem base anterior</span>;
  }
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
        positive ? 'text-emerald-700' : 'text-red-700'
      }`}
    >
      {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {positive ? `+${delta}%` : `${delta}%`} vs período anterior
    </span>
  );
}

export function ReportsDashboardTab({
  salonName,
  data,
  filter,
  onChangeFilter,
  onOpenSheetsExport,
}: ReportsDashboardTabProps) {
  const [hiddenWidgets, setHiddenWidgets] = useState<Record<WidgetKey, boolean>>({
    evolution: false,
    origins: false,
    bestClients: false,
    ageBrackets: false,
    quality: false,
    professionalsAndServices: false,
  });
  const [expandedWidget, setExpandedWidget] = useState<WidgetKey | null>(null);
  const [diagnosisText, setDiagnosisText] = useState<string | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  const metrics = useMemo(() => computeReportsDashboard(data, filter), [data, filter]);

  const toggleWidget = (key: WidgetKey) => {
    setHiddenWidgets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSetMode = (mode: PeriodFilterMode) => {
    onChangeFilter({ ...filter, mode });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    exportReportToPdf({
      title: `Relatório Executivo — ${salonName}`,
      subtitle: `Período: ${metrics.window.label}${filter.comparePrevious ? ` (Comparado a ${metrics.window.prevLabel})` : ''}`,
      kpis: [
        { label: 'Faturamento', value: formatBRL(metrics.totalRevenue) },
        { label: 'Ticket Médio', value: formatBRL(metrics.averageTicket) },
        { label: 'Clientes Atendidos', value: String(metrics.attendedClientsCount) },
        { label: 'Concluídos', value: String(metrics.completedCount) },
      ],
      headers: ['Profissional', 'Função', 'Atendimentos', 'Cancelamentos', 'Faturamento (R$)', 'Ticket Médio (R$)'],
      rows: metrics.professionalStats.map((p) => [
        p.name,
        p.role,
        p.count,
        p.canceledCount,
        Number(p.revenue.toFixed(2)),
        Number(p.avgTicket.toFixed(2)),
      ]),
      filenameSlug: `dashboard_executivo_${metrics.window.startYmd}_${metrics.window.endYmd}`,
    });
    toast.success('PDF consolidado exportado com sucesso.');
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `dashboard_profissionais_${metrics.window.startYmd}_${metrics.window.endYmd}`,
      ['Profissional', 'Função', 'Atendimentos', 'Cancelamentos', 'Participação (%)', 'Faturamento (R$)', 'Ticket Médio (R$)'],
      metrics.professionalStats.map((p) => [
        p.name,
        p.role,
        p.count,
        p.canceledCount,
        `${p.sharePct}%`,
        Number(p.revenue.toFixed(2)),
        Number(p.avgTicket.toFixed(2)),
      ])
    );
    toast.success('Planilha CSV exportada com sucesso.');
  };

  const handleOpenSheets = () => {
    const rows: SheetCellValue[][] = metrics.professionalStats.map((p) => [
      p.name,
      p.role,
      metrics.window.label,
      p.count,
      p.canceledCount,
      Number(p.revenue.toFixed(2)),
      Number(p.avgTicket.toFixed(2)),
    ]);
    rows.push([
      'TOTAL CONSOLIDADO',
      '—',
      metrics.window.label,
      metrics.completedCount,
      metrics.canceledCount,
      Number(metrics.totalRevenue.toFixed(2)),
      Number(metrics.averageTicket.toFixed(2)),
    ]);

    onOpenSheetsExport({
      title: `Relatório Executivo ${salonName} - ${metrics.window.label}`,
      tabTitle: 'Dashboard',
      datasetLabel: `Desempenho Executivo (${metrics.window.label})`,
      headers: [
        'Profissional',
        'Função',
        'Período',
        'Atendimentos',
        'Cancelamentos/Faltas',
        'Faturamento (R$)',
        'Ticket Médio (R$)',
      ],
      rows,
    });
  };

  const handleGenerateDiagnosis = async () => {
    setDiagnosisLoading(true);
    try {
      const result = await generateAiReportDiagnosis({
        salonName,
        periodLabel: metrics.window.label,
        totalRevenue: metrics.totalRevenue,
        completedCount: metrics.completedCount,
        canceledOrNoShowCount: metrics.canceledCount,
        uniqueClientsCount: metrics.attendedClientsCount,
        averageTicket: metrics.averageTicket,
        topProfessionalName: metrics.professionalStats[0]?.name,
        topServiceName: metrics.topServices[0]?.name,
        revenueDeltaPct: metrics.revenueDeltaPct,
      });
      setDiagnosisText(result.diagnosis);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar diagnóstico Lumi IA.';
      toast.error(message);
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const hiddenCount = Object.values(hiddenWidgets).filter(Boolean).length;

  const showAllWidgets = () => {
    setHiddenWidgets({
      evolution: false,
      origins: false,
      bestClients: false,
      ageBrackets: false,
      quality: false,
      professionalsAndServices: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Mode & Date Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-1">
              {(
                [
                  { id: 'period', label: 'Período' },
                  { id: 'month', label: 'Mês' },
                  { id: 'day', label: 'Dia' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSetMode(m.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    filter.mode === m.id
                      ? 'bg-[#171717] text-white'
                      : 'text-[#4A4A4A] hover:text-[#171717]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {filter.mode === 'period' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => onChangeFilter({ ...filter, startDate: e.target.value })}
                  aria-label="Data inicial"
                  className="h-10 rounded-lg border border-[#E5E2DC] bg-white px-3 text-xs font-medium text-[#171717] tabular-nums"
                />
                <span className="text-xs text-[#6B6B6B]">até</span>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => onChangeFilter({ ...filter, endDate: e.target.value })}
                  aria-label="Data final"
                  className="h-10 rounded-lg border border-[#E5E2DC] bg-white px-3 text-xs font-medium text-[#171717] tabular-nums"
                />
              </div>
            )}

            {filter.mode === 'month' && (
              <input
                type="month"
                value={filter.month}
                onChange={(e) => onChangeFilter({ ...filter, month: e.target.value })}
                aria-label="Mês de referência"
                className="h-10 rounded-lg border border-[#E5E2DC] bg-white px-3 text-xs font-medium text-[#171717] tabular-nums"
              />
            )}

            {filter.mode === 'day' && (
              <input
                type="date"
                value={filter.day}
                onChange={(e) => onChangeFilter({ ...filter, day: e.target.value })}
                aria-label="Dia específico"
                className="h-10 rounded-lg border border-[#E5E2DC] bg-white px-3 text-xs font-medium text-[#171717] tabular-nums"
              />
            )}

            <label className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] cursor-pointer text-xs font-medium text-[#171717]">
              <input
                type="checkbox"
                checked={filter.comparePrevious}
                onChange={(e) =>
                  onChangeFilter({ ...filter, comparePrevious: e.target.checked })
                }
                className="rounded border-[#E5E2DC] accent-[#171717]"
              />
              <span className="whitespace-nowrap">Comparar com período anterior</span>
            </label>
          </div>

          {/* Export & AI Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateDiagnosis}
              disabled={diagnosisLoading}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#171717] hover:bg-[#2B2B2B] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-[#D4B87A]" />
              {diagnosisLoading ? 'Analisando...' : 'Diagnóstico Lumi IA'}
            </button>

            <button
              type="button"
              onClick={handleOpenSheets}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Google Sheets
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-[#8A6D36]" />
              PDF
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-[#4A4A4A]" />
              CSV
            </button>

            <button
              type="button"
              onClick={handlePrint}
              aria-label="Imprimir relatório"
              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#4A4A4A] transition-colors print:hidden shrink-0"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6B6B] border-t border-[#E5E2DC] pt-3">
          <span>
            Janela ativa: <strong className="text-[#171717]">{metrics.window.label}</strong>
            {filter.comparePrevious && (
              <>
                {' '}
                · Comparativo: <strong className="text-[#171717]">{metrics.window.prevLabel}</strong>
              </>
            )}
          </span>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={showAllWidgets}
              className="text-xs font-semibold text-[#8A6D36] hover:underline"
            >
              Mostrar {hiddenCount} {hiddenCount === 1 ? 'bloco oculto' : 'blocos ocultos'}
            </button>
          )}
        </div>
      </div>

      {/* Lumi IA Diagnosis Output */}
      {diagnosisText && (
        <div className="rounded-xl border border-[#D8C79F] bg-[#FAF7F0] p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8A6D36]">
              <Sparkles className="w-4 h-4" />
              Diagnóstico Estratégico Lumi IA · {metrics.window.label}
            </div>
            <button
              type="button"
              onClick={() => setDiagnosisText(null)}
              aria-label="Fechar diagnóstico"
              className="p-1 text-[#6B6B6B] hover:text-[#171717]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-[#171717] leading-relaxed whitespace-pre-line">{diagnosisText}</p>
        </div>
      )}

      {/* 5 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-1.5">
          <p className="text-xs font-medium text-[#6B6B6B]">Faturamento Efetivo</p>
          <p className="text-2xl font-bold text-[#171717] tabular-nums">
            {formatBRL(metrics.totalRevenue)}
          </p>
          {filter.comparePrevious ? (
            <DeltaBadge delta={metrics.revenueDeltaPct} />
          ) : (
            <p className="text-xs text-[#6B6B6B] truncate">{metrics.window.label}</p>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-1.5">
          <p className="text-xs font-medium text-[#6B6B6B]">Ticket Médio</p>
          <p className="text-2xl font-bold text-[#171717] tabular-nums">
            {formatBRL(metrics.averageTicket)}
          </p>
          {filter.comparePrevious ? (
            <DeltaBadge delta={metrics.ticketDeltaPct} />
          ) : (
            <p className="text-xs text-[#6B6B6B]">Por atendimento concluído</p>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-1.5">
          <p className="text-xs font-medium text-[#6B6B6B]">Clientes Atendidos</p>
          <p className="text-2xl font-bold text-[#171717] tabular-nums">
            {metrics.attendedClientsCount}
          </p>
          {filter.comparePrevious ? (
            <DeltaBadge delta={metrics.clientsDeltaPct} />
          ) : (
            <p className="text-xs text-[#6B6B6B]">Clientes únicos no período</p>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-1.5">
          <p className="text-xs font-medium text-[#6B6B6B]">Agendamentos Concluídos</p>
          <p className="text-2xl font-bold text-[#171717] tabular-nums">
            {metrics.completedCount}
          </p>
          {filter.comparePrevious ? (
            <DeltaBadge delta={metrics.completedDeltaPct} />
          ) : (
            <p className="text-xs text-[#6B6B6B]">Produções finalizadas</p>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-1.5">
          <p className="text-xs font-medium text-[#6B6B6B]">Cancelamentos &amp; Faltas</p>
          <p className="text-2xl font-bold text-[#171717] tabular-nums">
            {metrics.canceledCount}
          </p>
          {filter.comparePrevious ? (
            <DeltaBadge delta={metrics.canceledDeltaPct} />
          ) : (
            <p className="text-xs text-[#6B6B6B]">No-shows ou cancelados</p>
          )}
        </div>
      </div>

      {/* Modular Dashboard Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Evolução no Período */}
        {!hiddenWidgets.evolution && (
          <div className="lg:col-span-2 rounded-xl border border-[#E5E2DC] bg-white p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 pb-4 border-b border-[#E5E2DC]">
              <div>
                <h3 className="text-sm font-semibold text-[#171717] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#8A6D36]" />
                  Evolução Comparativa de Faturamento
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  {filter.comparePrevious
                    ? `Linha dourada: período atual · Linha tracejada: ${metrics.window.prevLabel}`
                    : `Evolução ao longo de ${metrics.window.label}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpandedWidget('evolution')}
                  aria-label="Expandir evolução"
                  className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleWidget('evolution')}
                  aria-label="Ocultar evolução"
                  className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="pt-4 h-72 w-full">
              {metrics.evolutionSeries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[#6B6B6B]">
                  Nenhum faturamento concluído no período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.evolutionSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="atelierRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B89B5E" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#B89B5E" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                    <XAxis dataKey="label" stroke="#6B6B6B" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#6B6B6B"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E2DC',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: '#171717',
                      }}
                      formatter={(val: number | string, name: string) => [
                        formatBRL(Number(val)),
                        name === 'faturamento' ? 'Período Atual' : 'Período Anterior',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="faturamento"
                      stroke="#8A6D36"
                      strokeWidth={2.5}
                      fill="url(#atelierRevGrad)"
                    />
                    {filter.comparePrevious && (
                      <Area
                        type="monotone"
                        dataKey="anterior"
                        stroke="#6B6B6B"
                        strokeDasharray="5 5"
                        strokeWidth={1.75}
                        fill="transparent"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* 2. Como nos Conheceram */}
        {!hiddenWidgets.origins && (
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 pb-4 border-b border-[#E5E2DC]">
              <div>
                <h3 className="text-sm font-semibold text-[#171717]">Como nos Conheceram</h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Origem dos clientes atendidos ou cadastrados no período
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpandedWidget('origins')}
                  aria-label="Expandir origens"
                  className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleWidget('origins')}
                  aria-label="Ocultar origens"
                  className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </div>

            {metrics.originsBreakdown.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-xs text-[#6B6B6B]">
                Sem origens informadas neste recorte.
              </div>
            ) : (
              <div className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.originsBreakdown}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {metrics.originsBreakdown.map((item, idx) => (
                          <Cell key={item.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number | string) => [`${value} clientes`, 'Volume']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 border-t border-[#E5E2DC] pt-3">
                  {metrics.originsBreakdown.slice(0, 5).map((item, idx) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-xs gap-2"
                    >
                      <span className="flex items-center gap-2 text-[#171717] truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="font-semibold text-[#171717] tabular-nums shrink-0">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Middle Row: Ranking Melhores Clientes + Faixa Etária + Qualidade */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Ranking de Melhores Clientes */}
        {!hiddenWidgets.bestClients && (
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 pb-4 border-b border-[#E5E2DC]">
              <div>
                <h3 className="text-sm font-semibold text-[#171717] flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#8A6D36]" />
                  Ranking Melhores Clientes
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Maiores faturamentos no período
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpandedWidget('bestClients')}
                  aria-label="Expandir ranking de clientes"
                  className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleWidget('bestClients')}
                  aria-label="Ocultar ranking de clientes"
                  className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </div>

            {metrics.bestClients.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6B6B6B]">
                Nenhum cliente com atendimento concluído neste período.
              </div>
            ) : (
              <div className="pt-3 max-h-72 overflow-y-auto divide-y divide-[#E5E2DC]">
                {metrics.bestClients.slice(0, 10).map((client, idx) => (
                  <div
                    key={`${client.clientId || client.name}_${idx}`}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#171717] truncate">
                        {idx + 1}. {client.name}
                      </p>
                      <p className="text-[11px] text-[#6B6B6B] tabular-nums">
                        {client.visits} {client.visits === 1 ? 'visita' : 'visitas'} · Ticket{' '}
                        {formatBRL(client.avgTicket)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#171717] tabular-nums shrink-0">
                      {formatBRL(client.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Faixa Etária da Base */}
        {!hiddenWidgets.ageBrackets && (
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 pb-4 border-b border-[#E5E2DC]">
              <div>
                <h3 className="text-sm font-semibold text-[#171717] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#8A6D36]" />
                  Faixa Etária da Base
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Distribuição dos clientes com data de nascimento
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleWidget('ageBrackets')}
                aria-label="Ocultar faixa etária"
                className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-4 space-y-2.5 flex-1">
              {metrics.ageBrackets.map((b) => (
                <div key={b.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#171717] font-medium">{b.name}</span>
                    <span className="text-[#4A4A4A] font-semibold tabular-nums">
                      {b.count} ({b.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#F2EFE9] overflow-hidden">
                    <div
                      className="h-full bg-[#8A6D36] rounded-full transition-all"
                      style={{ width: `${Math.min(100, b.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
              {metrics.ageUnknownCount > 0 && (
                <p className="text-[11px] text-[#6B6B6B] pt-2 border-t border-[#E5E2DC] tabular-nums">
                  {metrics.ageUnknownCount} cliente(s) ativo(s) sem data de nascimento cadastrada.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 5. Qualidade & Avaliações */}
        {!hiddenWidgets.quality && (
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 pb-4 border-b border-[#E5E2DC]">
              <div>
                <h3 className="text-sm font-semibold text-[#171717] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#8A6D36]" />
                  Avaliações &amp; Padrão Operacional
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Checklists operacionais e pesquisas CSAT pós-atendimento
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleWidget('quality')}
                aria-label="Ocultar avaliações"
                className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-4 grid grid-cols-2 gap-3 flex-1">
              <div className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-4 flex flex-col justify-between">
                <span className="text-xs font-medium text-[#6B6B6B]">Média Checklists</span>
                <p className="text-3xl font-bold text-[#171717] tabular-nums my-2">
                  {metrics.evaluationMetrics.avgChecklistPct}%
                </p>
                <span className="text-[11px] text-[#6B6B6B] tabular-nums">
                  {metrics.evaluationMetrics.checklistCount} auditoria(s) no período
                </span>
              </div>

              <div className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] p-4 flex flex-col justify-between">
                <span className="text-xs font-medium text-[#6B6B6B]">Nota CSAT Clientes</span>
                <p className="text-3xl font-bold text-[#171717] tabular-nums my-2">
                  {metrics.evaluationMetrics.csatCount > 0
                    ? `${metrics.evaluationMetrics.avgCsatRating}/5`
                    : '—'}
                </p>
                <span className="text-[11px] text-[#6B6B6B] tabular-nums">
                  {metrics.evaluationMetrics.csatCount} resposta(s) avaliada(s)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Profissionais & Serviços Mais Rentáveis */}
      {!hiddenWidgets.professionalsAndServices && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5">
            <div className="flex items-start justify-between gap-2 pb-4 border-b border-[#E5E2DC]">
              <div>
                <h3 className="text-sm font-semibold text-[#171717] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#8A6D36]" />
                  Desempenho por Profissional
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Atendimentos concluídos, participação e ticket médio
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleWidget('professionalsAndServices')}
                aria-label="Ocultar desempenho de profissionais e serviços"
                className="p-2 text-[#6B6B6B] hover:text-[#171717] rounded-lg hover:bg-[#FAF9F7]"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>

            {metrics.professionalStats.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6B6B6B]">
                Nenhum profissional encontrado.
              </div>
            ) : (
              <div className="pt-3 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E2DC] text-[#6B6B6B]">
                      <th className="py-2 pr-3 font-medium">Profissional</th>
                      <th className="py-2 px-2 font-medium text-right">Concluídos</th>
                      <th className="py-2 px-2 font-medium text-right">Faltas/Canc.</th>
                      <th className="py-2 px-2 font-medium text-right">Ticket</th>
                      <th className="py-2 pl-2 font-medium text-right">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC]">
                    {metrics.professionalStats.map((prof) => (
                      <tr key={prof.id} className="hover:bg-[#FAF9F7]">
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-[#171717]">{prof.name}</p>
                          <p className="text-[11px] text-[#6B6B6B] tabular-nums">
                            {prof.sharePct}% da receita
                          </p>
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-[#171717] tabular-nums">
                          {prof.count}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#6B6B6B] tabular-nums">
                          {prof.canceledCount}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#4A4A4A] tabular-nums">
                          {formatBRL(prof.avgTicket)}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-bold text-[#171717] tabular-nums">
                          {formatBRL(prof.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E5E2DC] bg-white p-5">
            <div className="pb-4 border-b border-[#E5E2DC]">
              <h3 className="text-sm font-semibold text-[#171717]">Top Serviços por Faturamento</h3>
              <p className="text-xs text-[#6B6B6B] mt-0.5">
                Procedimentos que mais geraram receita em {metrics.window.label}
              </p>
            </div>

            {metrics.topServices.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6B6B6B]">
                Nenhum serviço concluído neste período.
              </div>
            ) : (
              <div className="pt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.topServices.slice(0, 7).map((s) => ({
                      name: s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name,
                      revenue: Math.round(s.revenue),
                      count: s.count,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#6B6B6B"
                      fontSize={11}
                      tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#171717"
                      fontSize={11}
                      width={110}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: number | string) => [formatBRL(Number(val)), 'Faturamento']}
                    />
                    <Bar dataKey="revenue" fill="#8A6D36" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded Widget Dialog */}
      <Dialog
        open={Boolean(expandedWidget)}
        onOpenChange={(open) => {
          if (!open) setExpandedWidget(null);
        }}
      >
        <DialogContent className="sm:max-w-[780px] bg-white border border-[#E5E2DC] text-[#171717]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#171717]">
              {expandedWidget === 'evolution' && `Evolução de Faturamento · ${metrics.window.label}`}
              {expandedWidget === 'origins' && `Canais de Origem · ${metrics.window.label}`}
              {expandedWidget === 'bestClients' && `Ranking Completo de Clientes · ${metrics.window.label}`}
            </DialogTitle>
          </DialogHeader>

          {expandedWidget === 'evolution' && (
            <div className="h-96 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.evolutionSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                  <XAxis dataKey="label" stroke="#6B6B6B" fontSize={12} />
                  <YAxis stroke="#6B6B6B" fontSize={12} />
                  <Tooltip
                    formatter={(val: number | string, name: string) => [
                      formatBRL(Number(val)),
                      name === 'faturamento' ? 'Atual' : 'Anterior',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="faturamento"
                    stroke="#8A6D36"
                    strokeWidth={2.5}
                    fill="#B89B5E"
                    fillOpacity={0.22}
                  />
                  {filter.comparePrevious && (
                    <Area
                      type="monotone"
                      dataKey="anterior"
                      stroke="#6B6B6B"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      fill="transparent"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {expandedWidget === 'origins' && (
            <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
              {metrics.originsBreakdown.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between border-b border-[#E5E2DC] pb-2 text-sm"
                >
                  <span className="font-medium text-[#171717]">{item.name}</span>
                  <span className="font-semibold text-[#171717] tabular-nums">
                    {item.count} clientes ({item.pct}%)
                  </span>
                </div>
              ))}
            </div>
          )}

          {expandedWidget === 'bestClients' && (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Cliente</th>
                    <th className="py-2.5 px-3 font-semibold">WhatsApp</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Visitas</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Ticket Médio</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Gasto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {metrics.bestClients.map((c, idx) => (
                    <tr key={`${c.clientId || c.name}_${idx}`}>
                      <td className="py-2.5 px-3 tabular-nums text-[#6B6B6B]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#171717]">{c.name}</td>
                      <td className="py-2.5 px-3 text-[#4A4A4A] tabular-nums">{c.phone || '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{c.visits}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatBRL(c.avgTicket)}</td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums">{formatBRL(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

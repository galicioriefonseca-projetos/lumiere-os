import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Eye,
  FileSpreadsheet,
  Search,
  Star,
} from 'lucide-react';
import {
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
import {
  buildCatalogReportDataset,
  exportReportToPdf,
  exportRowsToCsv,
  REPORTS_CATALOG,
  type CatalogReportDefinition,
  type DashboardDatasetInput,
  type ReportCategory,
} from '@/services/reportsEngine';
import type { SheetCellValue } from '@/services/googleWorkspaceService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ReportsCatalogTabProps {
  mode: 'favorites' | 'todos';
  favoriteCodes: string[];
  onToggleFavorite: (code: string) => void;
  data: DashboardDatasetInput;
  defaultStartDate: string;
  defaultEndDate: string;
  salonName: string;
  onOpenSheetsExport: (payload: {
    title: string;
    tabTitle: string;
    datasetLabel: string;
    headers: string[];
    rows: SheetCellValue[][];
  }) => void;
}

const CATEGORIES: Array<'Todas' | ReportCategory> = [
  'Todas',
  'Clientes',
  'Profissionais',
  'Agenda',
  'Financeiro',
  'CRM & IA',
];

const CHART_COLORS = ['#8A6D36', '#171717', '#4B5563', '#0F766E', '#B45309', '#6D28D9'];

export function ReportsCatalogTab({
  mode,
  favoriteCodes,
  onToggleFavorite,
  data,
  defaultStartDate,
  defaultEndDate,
  salonName,
  onOpenSheetsExport,
}: ReportsCatalogTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | ReportCategory>('Todas');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [activeReport, setActiveReport] = useState<CatalogReportDefinition | null>(null);
  const [viewerStartDate, setViewerStartDate] = useState(defaultStartDate);
  const [viewerEndDate, setViewerEndDate] = useState(defaultEndDate);
  const [viewerP2StartDate, setViewerP2StartDate] = useState(defaultStartDate);
  const [viewerP2EndDate, setViewerP2EndDate] = useState(defaultEndDate);

  const filteredReports = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return REPORTS_CATALOG.filter((item) => {
      if (mode === 'favorites' && !favoriteCodes.includes(item.code)) return false;
      if (selectedCategory !== 'Todas' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.code.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [mode, favoriteCodes, selectedCategory, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedReports = filteredReports.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openReportViewer = (report: CatalogReportDefinition) => {
    setViewerStartDate(defaultStartDate);
    setViewerEndDate(defaultEndDate);
    setViewerP2StartDate(defaultStartDate);
    setViewerP2EndDate(defaultEndDate);
    setActiveReport(report);
  };

  const activeDataset = useMemo(() => {
    if (!activeReport) return null;
    return buildCatalogReportDataset(activeReport.code, data, {
      startDate: viewerStartDate,
      endDate: viewerEndDate,
      period2StartDate: viewerP2StartDate,
      period2EndDate: viewerP2EndDate,
    });
  }, [activeReport, data, viewerStartDate, viewerEndDate, viewerP2StartDate, viewerP2EndDate]);

  const handleDownloadPdf = () => {
    if (!activeDataset) return;
    exportReportToPdf({
      title: `${activeDataset.definition.code} · ${activeDataset.definition.title}`,
      subtitle: `${salonName} · ${activeDataset.periodLabel}`,
      kpis: activeDataset.kpis,
      headers: activeDataset.headers,
      rows: activeDataset.rows,
      filenameSlug: activeDataset.filenameSlug,
    });
    toast.success('Relatório PDF exportado.');
  };

  const handleDownloadCsv = () => {
    if (!activeDataset) return;
    exportRowsToCsv(activeDataset.filenameSlug, activeDataset.headers, activeDataset.rows);
    toast.success('Arquivo CSV exportado.');
  };

  const handleSendToSheets = () => {
    if (!activeDataset) return;
    onOpenSheetsExport({
      title: `${activeDataset.definition.code} ${activeDataset.definition.title} - ${salonName}`,
      tabTitle: `Rel ${activeDataset.definition.code}`,
      datasetLabel: `${activeDataset.definition.title} (${activeDataset.periodLabel})`,
      headers: activeDataset.headers,
      rows: activeDataset.rows,
    });
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por código (ex: 0007), nome ou palavra-chave..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] text-xs text-[#171717] placeholder:text-[#6B6B6B] focus:outline-none focus:border-[#8A6D36]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Registros por página"
              className="h-9 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs font-medium text-[#171717]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>por página</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[#171717] text-white'
                  : 'bg-[#FAF9F7] border border-[#E5E2DC] text-[#4A4A4A] hover:text-[#171717]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {pagedReports.length === 0 ? (
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-[#171717]">
            {mode === 'favorites'
              ? 'Nenhum relatório favoritado para os filtros atuais.'
              : 'Nenhum relatório encontrado com os filtros aplicados.'}
          </p>
          <p className="text-xs text-[#6B6B6B]">
            {mode === 'favorites'
              ? 'Clique na estrela de qualquer relatório na aba "Todos" para fixá-lo aqui.'
              : 'Tente limpar a busca ou selecionar outra categoria.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-xl border border-[#E5E2DC] bg-white overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B]">
                <tr>
                  <th className="py-3 px-4 font-semibold w-20">Código</th>
                  <th className="py-3 px-4 font-semibold w-32">Categoria</th>
                  <th className="py-3 px-4 font-semibold">Relatório</th>
                  <th className="py-3 px-4 font-semibold">Descrição</th>
                  <th className="py-3 px-4 font-semibold text-right w-36">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {pagedReports.map((item) => {
                  const isFav = favoriteCodes.includes(item.code);
                  return (
                    <tr key={item.code} className="hover:bg-[#FAF9F7]/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#171717] tabular-nums">
                        {item.code}
                      </td>
                      <td className="py-3.5 px-4 text-[#4A4A4A]">{item.category}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#171717]">{item.title}</p>
                        {item.hasChart && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#8A6D36] mt-0.5">
                            <BarChart3 className="w-3 h-3" />
                            Gráfico interativo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#4A4A4A] max-w-md leading-relaxed">
                        {item.description}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleFavorite(item.code)}
                            aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                            className={`h-9 w-9 inline-flex items-center justify-center rounded-lg border transition-colors ${
                              isFav
                                ? 'border-[#D8C79F] bg-[#FAF7F0] text-[#8A6D36]'
                                : 'border-[#E5E2DC] bg-white text-[#6B6B6B] hover:text-[#171717]'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${isFav ? 'fill-[#8A6D36]' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openReportViewer(item)}
                            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold transition-colors whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Visualizar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {pagedReports.map((item) => {
              const isFav = favoriteCodes.includes(item.code);
              return (
                <div
                  key={item.code}
                  className="rounded-xl border border-[#E5E2DC] bg-white p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[11px] font-medium text-[#6B6B6B] tabular-nums">
                        {item.code} · {item.category}
                        {item.hasChart ? ' · Gráfico' : ''}
                      </p>
                      <h4 className="text-sm font-semibold text-[#171717]">{item.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(item.code)}
                      aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      className={`h-10 w-10 inline-flex items-center justify-center rounded-lg border shrink-0 ${
                        isFav
                          ? 'border-[#D8C79F] bg-[#FAF7F0] text-[#8A6D36]'
                          : 'border-[#E5E2DC] bg-white text-[#6B6B6B]'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-[#8A6D36]' : ''}`} />
                    </button>
                  </div>

                  <p className="text-xs text-[#4A4A4A] leading-relaxed">{item.description}</p>

                  <button
                    type="button"
                    onClick={() => openReportViewer(item)}
                    className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#171717] text-white text-xs font-semibold"
                  >
                    <Eye className="w-4 h-4" />
                    Visualizar Relatório
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6B6B]">
            <span className="tabular-nums">
              Mostrando {pagedReports.length} de {filteredReports.length} relatório(s)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-9 px-3 rounded-lg border border-[#E5E2DC] bg-white text-[#171717] font-medium disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 px-3 rounded-lg border border-[#E5E2DC] bg-white text-[#171717] font-medium disabled:opacity-40"
              >
                Próximo
              </button>
            </div>
          </div>
        </>
      )}

      {/* Interactive Report Viewer Modal */}
      <Dialog
        open={Boolean(activeReport)}
        onOpenChange={(open) => {
          if (!open) setActiveReport(null);
        }}
      >
        <DialogContent className="sm:max-w-[920px] bg-white border border-[#E5E2DC] text-[#171717] max-h-[90vh] overflow-y-auto">
          {activeReport && activeDataset && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="text-xs font-medium text-[#6B6B6B] tabular-nums">
                  {activeReport.code} · {activeReport.category}
                </div>
                <DialogTitle className="text-lg font-semibold text-[#171717]">
                  {activeReport.title}
                </DialogTitle>
                <p className="text-xs text-[#4A4A4A]">{activeReport.description}</p>
              </DialogHeader>

              {/* Date Range & Export Bar */}
              <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-3.5 space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
                        {activeReport.supportsDualPeriod ? 'Período 1 — Início' : 'Data Início'}
                      </label>
                      <input
                        type="date"
                        value={viewerStartDate}
                        onChange={(e) => setViewerStartDate(e.target.value)}
                        className="h-9 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
                        {activeReport.supportsDualPeriod ? 'Período 1 — Fim' : 'Data Fim'}
                      </label>
                      <input
                        type="date"
                        value={viewerEndDate}
                        onChange={(e) => setViewerEndDate(e.target.value)}
                        className="h-9 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717] tabular-nums"
                      />
                    </div>

                    {activeReport.supportsDualPeriod && (
                      <>
                        <div>
                          <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
                            Período 2 — Início
                          </label>
                          <input
                            type="date"
                            value={viewerP2StartDate}
                            onChange={(e) => setViewerP2StartDate(e.target.value)}
                            className="h-9 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717] tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
                            Período 2 — Fim
                          </label>
                          <input
                            type="date"
                            value={viewerP2EndDate}
                            onChange={(e) => setViewerP2EndDate(e.target.value)}
                            className="h-9 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717] tabular-nums"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSendToSheets}
                      className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-white hover:bg-[#F5F1E9] text-xs font-semibold text-[#171717]"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                      Google Sheets
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCsv}
                      className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E5E2DC] bg-white hover:bg-[#F5F1E9] text-xs font-semibold text-[#171717]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-[#171717] hover:bg-[#2B2B2B] text-white text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Strip */}
              {activeDataset.kpis.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeDataset.kpis.map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-lg border border-[#E5E2DC] bg-white p-3.5"
                    >
                      <p className="text-[11px] font-medium text-[#6B6B6B]">{kpi.label}</p>
                      <p className="text-lg font-bold text-[#171717] tabular-nums mt-0.5">
                        {kpi.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Optional Interactive Chart */}
              {activeDataset.chartData && activeDataset.chartData.length > 0 && (
                <div className="rounded-xl border border-[#E5E2DC] bg-white p-4">
                  <p className="text-xs font-semibold text-[#171717] mb-3">
                    Visualização Gráfica
                  </p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {activeDataset.chartType === 'pie' ? (
                        <PieChart>
                          <Pie
                            data={activeDataset.chartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={80}
                          >
                            {activeDataset.chartData.map((entry, idx) => (
                              <Cell
                                key={entry.name}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      ) : (
                        <BarChart data={activeDataset.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                          <XAxis dataKey="name" stroke="#6B6B6B" fontSize={11} />
                          <YAxis stroke="#6B6B6B" fontSize={11} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#8A6D36" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="rounded-xl border border-[#E5E2DC] overflow-hidden">
                {activeDataset.rows.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#6B6B6B]">
                    Nenhum registro encontrado para este relatório no intervalo selecionado.
                  </div>
                ) : (
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B]">
                        <tr>
                          {activeDataset.headers.map((header) => (
                            <th
                              key={header}
                              className="py-2.5 px-3 font-semibold whitespace-nowrap"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2DC]">
                        {activeDataset.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-[#FAF9F7]">
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="py-2 px-3 text-[#171717] tabular-nums whitespace-nowrap"
                              >
                                {typeof cell === 'number' && !Number.isInteger(cell)
                                  ? cell.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                  : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

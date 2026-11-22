import React, { useMemo, useRef, useState } from 'react';
import {
  InventoryItem,
  StockInventoryItemCount,
  StockInventoryScanLog,
  StockInventorySession,
  StockLocation,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  finalizeInventoryAuditApi,
  saveInventoryAuditDraft,
} from '@/services/inventoryService';
import {
  formatDateBR,
  STOCK_LOCATION_LABELS,
  STOCK_LOCATION_OPTIONS,
} from './inventoryConstants';
import { formatBRL, cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Loader2,
  Minus,
  Plus,
  Save,
  Search,
} from 'lucide-react';

interface InventoryAuditTabProps {
  salonId: string;
  items: InventoryItem[];
  sessions: StockInventorySession[];
  responsibleName: string;
  canManage: boolean;
}

function buildInitialCounts(
  inventoryItems: InventoryItem[],
  locationFilter: 'all' | StockLocation
): StockInventoryItemCount[] {
  return inventoryItems
    .filter((item) =>
      locationFilter === 'all' ? true : (item.stockLocation || 'resale') === locationFilter
    )
    .map((item) => ({
      productId: item.id,
      productName: item.name,
      sku: item.sku || '',
      barcode: item.barcode || '',
      stockLocation: item.stockLocation || 'resale',
      systemQty: Number(item.quantity || 0),
      countedQty: Number(item.quantity || 0),
      diffQty: 0,
      unitCost: Number(item.costPrice || 0),
      financialImpact: 0,
      counted: false,
    }));
}

export const InventoryAuditTab: React.FC<InventoryAuditTabProps> = ({
  salonId,
  items,
  sessions,
  responsibleName,
  canManage,
}) => {
  // List filters
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Active workspace state
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [readOnlyMode, setReadOnlyMode] = useState(false);

  const [sessionNumber, setSessionNumber] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().substring(0, 10));
  const [locationFilter, setLocationFilter] = useState<'all' | StockLocation>('all');
  const [notes, setNotes] = useState('');
  const [counts, setCounts] = useState<StockInventoryItemCount[]>([]);
  const [scanLogs, setScanLogs] = useState<StockInventoryScanLog[]>([]);

  const [onlyUncounted, setOnlyUncounted] = useState(false);
  const [onlyZeroStock, setOnlyZeroStock] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  const [savingDraft, setSavingDraft] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      if (!q) return true;
      return (
        (s.sessionNumber || '').toLowerCase().includes(q) ||
        (s.responsibleName || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
      );
    });
  }, [sessions, searchQuery, startDate, endDate]);

  const startNewAudit = () => {
    const nextNum = `INV-${String(sessions.length + 1).padStart(4, '0')}`;
    setActiveSessionId(undefined);
    setSessionNumber(nextNum);
    setSessionDate(new Date().toISOString().substring(0, 10));
    setLocationFilter('all');
    setNotes('');
    setCounts(buildInitialCounts(items, 'all'));
    setScanLogs([]);
    setOnlyUncounted(false);
    setOnlyZeroStock(false);
    setTableSearch('');
    setBarcodeInput('');
    setReadOnlyMode(false);
    setWorkspaceOpen(true);
    setTimeout(() => scanInputRef.current?.focus(), 80);
  };

  const openExistingSession = (session: StockInventorySession) => {
    setActiveSessionId(session.id);
    setSessionNumber(session.sessionNumber);
    setSessionDate(session.date);
    setLocationFilter(session.stockLocationFilter || 'all');
    setNotes(session.notes || '');
    setCounts(session.items || []);
    setScanLogs(session.scanLogs || []);
    setOnlyUncounted(false);
    setOnlyZeroStock(false);
    setTableSearch('');
    setBarcodeInput('');
    setReadOnlyMode(session.status === 'completed');
    setWorkspaceOpen(true);
  };

  const handleChangeLocationScope = (nextLoc: 'all' | StockLocation) => {
    setLocationFilter(nextLoc);
    if (!readOnlyMode) {
      setCounts(buildInitialCounts(items, nextLoc));
      setScanLogs([]);
    }
  };

  const updateItemCount = (productId: string, nextCountedQty: number, markCounted = true) => {
    if (readOnlyMode) return;
    const safeQty = Math.max(0, Number(nextCountedQty.toFixed(3)));
    setCounts((prev) =>
      prev.map((row) => {
        if (row.productId !== productId) return row;
        const diffQty = Number((safeQty - row.systemQty).toFixed(3));
        const financialImpact = Number((diffQty * row.unitCost).toFixed(2));
        return {
          ...row,
          countedQty: safeQty,
          diffQty,
          financialImpact,
          counted: markCounted,
        };
      })
    );
  };

  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnlyMode) return;
    const raw = barcodeInput.trim();
    if (!raw) return;
    const q = raw.toLowerCase();

    // Priority: exact barcode -> exact SKU -> partial SKU/barcode/name
    const matched =
      counts.find((c) => (c.barcode || '').toLowerCase() === q) ||
      counts.find((c) => (c.sku || '').toLowerCase() === q) ||
      counts.find(
        (c) =>
          c.productName.toLowerCase().includes(q) ||
          (c.barcode || '').toLowerCase().includes(q) ||
          (c.sku || '').toLowerCase().includes(q)
      );

    if (!matched) {
      toast.error(`Nenhum produto encontrado para o código "${raw}" neste escopo.`);
      setBarcodeInput('');
      scanInputRef.current?.focus();
      return;
    }

    const baseQty = matched.counted ? matched.countedQty : 0;
    const nextQty = Number((baseQty + 1).toFixed(3));
    updateItemCount(matched.productId, nextQty, true);

    const newLog: StockInventoryScanLog = {
      id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      query: raw,
      productId: matched.productId,
      productName: matched.productName,
      delta: 1,
      scannedAt: Date.now(),
    };
    setScanLogs((prev) => [newLog, ...prev].slice(0, 60));
    toast.success(`+1 · ${matched.productName} (Contado: ${nextQty})`);
    setBarcodeInput('');
    scanInputRef.current?.focus();
  };

  const visibleCounts = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return counts.filter((row) => {
      if (onlyUncounted && row.counted) return false;
      if (onlyZeroStock && row.systemQty > 0) return false;
      if (!q) return true;
      return (
        row.productName.toLowerCase().includes(q) ||
        (row.sku || '').toLowerCase().includes(q) ||
        (row.barcode || '').toLowerCase().includes(q)
      );
    });
  }, [counts, onlyUncounted, onlyZeroStock, tableSearch]);

  const auditSummary = useMemo(() => {
    let countedItems = 0;
    let missingUnits = 0;
    let surplusUnits = 0;
    let balanceImpact = 0;

    for (const row of counts) {
      if (!row.counted) continue;
      countedItems += 1;
      const diff = Number((row.countedQty - row.systemQty).toFixed(3));
      if (diff < 0) missingUnits += Math.abs(diff);
      if (diff > 0) surplusUnits += diff;
      balanceImpact += Number((diff * row.unitCost).toFixed(2));
    }

    return {
      countedItems,
      totalItems: counts.length,
      missingUnits: Number(missingUnits.toFixed(2)),
      surplusUnits: Number(surplusUnits.toFixed(2)),
      balanceImpact: Number(balanceImpact.toFixed(2)),
    };
  }, [counts]);

  const handleSaveDraft = async () => {
    if (!canManage) {
      toast.error('Apenas gestores podem salvar auditorias de inventário.');
      return;
    }
    setSavingDraft(true);
    try {
      const id = await saveInventoryAuditDraft(
        salonId,
        {
          sessionNumber,
          date: sessionDate,
          stockLocationFilter: locationFilter,
          status: 'draft',
          responsibleName,
          items: counts,
          scanLogs,
          missingUnitsTotal: auditSummary.missingUnits,
          surplusUnitsTotal: auditSummary.surplusUnits,
          balanceImpactAmount: auditSummary.balanceImpact,
          notes,
        },
        activeSessionId
      );
      setActiveSessionId(id);
      toast.success(`Rascunho ${sessionNumber} salvo com sucesso.`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar rascunho de inventário.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFinalizeAudit = async () => {
    if (!canManage) {
      toast.error('Apenas gestores podem finalizar inventários e ajustar saldos.');
      return;
    }
    if (auditSummary.countedItems === 0) {
      toast.error('Contabilize ou bipe pelo menos 1 produto antes de finalizar.');
      return;
    }
    setFinalizing(true);
    try {
      await finalizeInventoryAuditApi({
        salonId,
        sessionId: activeSessionId,
        sessionNumber,
        date: sessionDate,
        stockLocationFilter: locationFilter,
        notes,
        scanLogs,
        items: counts,
        responsibleName,
      });
      toast.success(
        `Inventário ${sessionNumber} finalizado! Saldos divergentes foram ajustados no Kardex.`
      );
      setWorkspaceOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao finalizar inventário.';
      toast.error(msg);
    } finally {
      setFinalizing(false);
    }
  };

  // ==================== WORKSPACE VIEW ====================
  if (workspaceOpen) {
    return (
      <div className="space-y-4">
        {/* Top Navigation & Session Meta */}
        <div className="bg-white border border-[#E5E2DC] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWorkspaceOpen(false)}
              className="h-8 px-2.5 text-xs border-[#E5E2DC] bg-white text-[#171717] rounded-lg whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar
            </Button>
            <div>
              <h3 className="text-sm font-heading font-bold text-[#171717] flex items-center gap-2">
                Auditoria Física {sessionNumber}
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    readOnlyMode ? 'text-emerald-700' : 'text-[#8A6D36]'
                  )}
                >
                  · {readOnlyMode ? 'Finalizado' : 'Em Contagem'}
                </span>
              </h3>
              <p className="text-[11px] text-[#6B6B6B]">
                Responsável: {responsibleName} · {auditSummary.countedItems} de{' '}
                {auditSummary.totalItems} produtos contados
              </p>
            </div>
          </div>

          {!readOnlyMode && canManage && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingDraft || finalizing}
                onClick={handleSaveDraft}
                className="h-9 px-3.5 text-xs border-[#E5E2DC] bg-white text-[#171717] rounded-lg font-semibold whitespace-nowrap shrink-0"
              >
                {savingDraft ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5 text-[#6B6B6B]" />
                )}
                Salvar Rascunho
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={savingDraft || finalizing}
                onClick={handleFinalizeAudit}
                className="h-9 px-4 text-xs bg-[#171717] hover:bg-[#2B2B2B] text-white rounded-lg font-semibold whitespace-nowrap shrink-0"
              >
                {finalizing ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37]" />
                )}
                Finalizar Inventário
              </Button>
            </div>
          )}
        </div>

        {/* Scope & Barcode Scanner Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bg-white border border-[#E5E2DC] rounded-xl p-4 space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[#6B6B6B]">Data da Auditoria</Label>
                <Input
                  type="date"
                  disabled={readOnlyMode}
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="bg-white border-[#E5E2DC] h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[#6B6B6B]">Local de Estoque</Label>
                <Select
                  disabled={readOnlyMode}
                  value={locationFilter}
                  onValueChange={(v) => handleChangeLocationScope(v as 'all' | StockLocation)}
                >
                  <SelectTrigger className="bg-white border-[#E5E2DC] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                    <SelectItem value="all">Todos os locais</SelectItem>
                    {STOCK_LOCATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[#6B6B6B]">Observações</Label>
                <Input
                  disabled={readOnlyMode}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Contagem mensal prateleira revenda"
                  className="bg-white border-[#E5E2DC] h-9 text-xs"
                />
              </div>
            </div>

            {/* Barcode Reader Input */}
            {!readOnlyMode && (
              <form
                onSubmit={handleBarcodeScanSubmit}
                className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <div className="flex items-center gap-2 flex-1">
                  <Barcode className="w-5 h-5 text-[#8A6D36] shrink-0" />
                  <Input
                    ref={scanInputRef}
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Bipar código EAN / SKU ou digitar nome e pressionar Enter (+1)..."
                    className="bg-white border-[#E5E2DC] h-9 text-xs font-mono"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 px-4 bg-[#171717] hover:bg-[#2B2B2B] text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
                >
                  + Contabilizar (Enter)
                </Button>
              </form>
            )}

            {/* Quick table filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B6B6B]">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyUncounted}
                    onChange={(e) => setOnlyUncounted(e.target.checked)}
                    className="accent-[#171717]"
                  />
                  <span>Somente itens não contabilizados</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyZeroStock}
                    onChange={(e) => setOnlyZeroStock(e.target.checked)}
                    className="accent-[#171717]"
                  />
                  <span>Somente estoque zerado</span>
                </label>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-2.5 top-2.5" />
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filtrar lista..."
                  className="pl-8 h-8 text-xs bg-white border-[#E5E2DC] rounded-lg"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-[#E5E2DC] rounded-xl overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs min-w-[660px]">
                <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold text-[#6B6B6B] sticky top-0 z-10">
                  <tr>
                    <th className="p-3">Produto</th>
                    <th className="p-3">SKU / EAN</th>
                    <th className="p-3 text-center">Sistema</th>
                    <th className="p-3 text-center w-36">Contagem Física</th>
                    <th className="p-3 text-center">Divergência</th>
                    <th className="p-3 text-right">Impacto (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {visibleCounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#6B6B6B]">
                        Nenhum produto corresponde aos filtros desta auditoria.
                      </td>
                    </tr>
                  ) : (
                    visibleCounts.map((row) => {
                      const diff = Number((row.countedQty - row.systemQty).toFixed(3));
                      const impact = Number((diff * row.unitCost).toFixed(2));
                      return (
                        <tr
                          key={row.productId}
                          className={cn(
                            'transition-colors',
                            row.counted ? 'bg-white' : 'bg-[#FAF9F7]/40 hover:bg-[#FAF9F7]'
                          )}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full shrink-0',
                                  row.counted ? 'bg-emerald-600' : 'bg-[#D6D2C9]'
                                )}
                                title={row.counted ? 'Contado' : 'Aguardando contagem'}
                              />
                              <div>
                                <div className="font-semibold text-[#171717]">{row.productName}</div>
                                <div className="text-[11px] text-[#6B6B6B]">
                                  {STOCK_LOCATION_LABELS[row.stockLocation || 'resale']}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-[#6B6B6B]">
                            <div>{row.sku || '-'}</div>
                            {row.barcode && <div className="text-[10px]">{row.barcode}</div>}
                          </td>
                          <td className="p-3 text-center font-mono tabular-nums text-[#6B6B6B]">
                            {row.systemQty}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              {!readOnlyMode && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItemCount(row.productId, Math.max(0, row.countedQty - 1), true)
                                  }
                                  className="w-7 h-7 flex items-center justify-center border border-[#E5E2DC] rounded hover:bg-[#FAF9F7] text-[#171717]"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              )}
                              <Input
                                type="number"
                                step="1"
                                min={0}
                                disabled={readOnlyMode}
                                value={row.countedQty}
                                onChange={(e) =>
                                  updateItemCount(
                                    row.productId,
                                    Math.max(0, parseFloat(e.target.value) || 0),
                                    true
                                  )
                                }
                                className="w-16 h-7 text-center font-mono font-bold text-xs bg-white border-[#E5E2DC] tabular-nums"
                              />
                              {!readOnlyMode && (
                                <button
                                  type="button"
                                  onClick={() => updateItemCount(row.productId, row.countedQty + 1, true)}
                                  className="w-7 h-7 flex items-center justify-center border border-[#E5E2DC] rounded hover:bg-[#FAF9F7] text-[#171717]"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center font-mono font-semibold tabular-nums">
                            {!row.counted ? (
                              <span className="text-[#9E9E9E]">—</span>
                            ) : diff === 0 ? (
                              <span className="text-emerald-700">0</span>
                            ) : (
                              <span className={diff > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold tabular-nums">
                            {!row.counted ? (
                              <span className="text-[#9E9E9E]">—</span>
                            ) : (
                              <span
                                className={
                                  impact === 0
                                    ? 'text-[#6B6B6B]'
                                    : impact > 0
                                      ? 'text-emerald-700'
                                      : 'text-rose-600'
                                }
                              >
                                {formatBRL(impact)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel: Scan Log & Summary */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Divergence Balance Card */}
            <div className="bg-white border border-[#E5E2DC] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B6B6B]">
                Resumo de Divergências
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#FAF9F7] border border-[#E5E2DC] rounded-lg">
                  <span className="text-[11px] text-[#6B6B6B] block">Quantidade a Menos</span>
                  <span className="text-base font-bold font-mono text-rose-600 tabular-nums">
                    -{auditSummary.missingUnits}
                  </span>
                </div>
                <div className="p-3 bg-[#FAF9F7] border border-[#E5E2DC] rounded-lg">
                  <span className="text-[11px] text-[#6B6B6B] block">Quantidade a Mais</span>
                  <span className="text-base font-bold font-mono text-emerald-700 tabular-nums">
                    +{auditSummary.surplusUnits}
                  </span>
                </div>
              </div>
              <div className="p-3.5 bg-[#FAF9F7] border border-[#E5E2DC] rounded-lg flex items-center justify-between">
                <span className="text-xs font-semibold text-[#171717]">Saldo Financeiro (Custo)</span>
                <span
                  className={cn(
                    'text-base font-bold font-mono tabular-nums',
                    auditSummary.balanceImpact < 0
                      ? 'text-rose-600'
                      : auditSummary.balanceImpact > 0
                        ? 'text-emerald-700'
                        : 'text-[#171717]'
                  )}
                >
                  {formatBRL(auditSummary.balanceImpact)}
                </span>
              </div>
            </div>

            {/* Live Scan Log */}
            <div className="bg-white border border-[#E5E2DC] rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-[#FAF9F7] border-b border-[#E5E2DC] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#171717]">Log de Leitura EAN</span>
                <span className="text-[11px] font-mono text-[#6B6B6B]">{scanLogs.length} bips</span>
              </div>
              <div className="divide-y divide-[#E5E2DC] max-h-[340px] overflow-y-auto text-xs">
                {scanLogs.length === 0 ? (
                  <div className="p-6 text-center text-[#6B6B6B] text-[11px]">
                    Nenhuma leitura realizada nesta sessão. Bipe um código ou ajuste a contagem na tabela.
                  </div>
                ) : (
                  scanLogs.map((log) => (
                    <div key={log.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#171717] truncate">{log.productName}</p>
                        <p className="text-[11px] font-mono text-[#6B6B6B]">
                          Cód: {log.query} ·{' '}
                          {new Date(log.scannedAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 shrink-0">
                        +{log.delta}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== SESSIONS LIST VIEW ====================
  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E5E2DC] rounded-xl p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-[#6B6B6B]">Data Início</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-xs bg-white border-[#E5E2DC] w-36"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-[#6B6B6B]">Data Fim</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 text-xs bg-white border-[#E5E2DC] w-36"
            />
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nº sessão ou responsável..."
              className="pl-8 h-9 text-xs bg-white border-[#E5E2DC]"
            />
          </div>
        </div>

        {canManage && (
          <Button
            type="button"
            onClick={startNewAudit}
            className="h-9 px-4 bg-[#171717] hover:bg-[#2B2B2B] text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37]" />
            Novo Inventário Físico
          </Button>
        )}
      </div>

      <div className="bg-white border border-[#E5E2DC] rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[760px]">
          <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold text-[#6B6B6B]">
            <tr>
              <th className="p-3.5">Nº Sessão</th>
              <th className="p-3.5">Data</th>
              <th className="p-3.5">Escopo</th>
              <th className="p-3.5">Responsável</th>
              <th className="p-3.5 text-center">Contados</th>
              <th className="p-3.5 text-center">Divergência</th>
              <th className="p-3.5 text-right">Saldo (R$)</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2DC]">
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-10 text-center text-[#6B6B6B]">
                  <ClipboardCheck className="w-8 h-8 text-[#D6D2C9] mx-auto mb-2" />
                  Nenhuma auditoria de inventário encontrada. Inicie um novo inventário físico com leitor EAN.
                </td>
              </tr>
            ) : (
              filteredSessions.map((session) => {
                const countedCount = (session.items || []).filter((i) => i.counted).length;
                const impact = Number(session.balanceImpactAmount || 0);
                return (
                  <tr key={session.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-[#171717]">
                      {session.sessionNumber}
                    </td>
                    <td className="p-3.5 font-mono text-[#6B6B6B]">{formatDateBR(session.date)}</td>
                    <td className="p-3.5 text-[#6B6B6B]">
                      {session.stockLocationFilter === 'all'
                        ? 'Todos os locais'
                        : STOCK_LOCATION_LABELS[session.stockLocationFilter]}
                    </td>
                    <td className="p-3.5 text-[#171717] font-medium">{session.responsibleName}</td>
                    <td className="p-3.5 text-center font-mono tabular-nums">
                      {countedCount}/{(session.items || []).length}
                    </td>
                    <td className="p-3.5 text-center font-mono tabular-nums text-[11px]">
                      <span className="text-rose-600 mr-1.5">-{session.missingUnitsTotal || 0}</span>
                      <span className="text-emerald-700">+{session.surplusUnitsTotal || 0}</span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-semibold tabular-nums">
                      <span
                        className={
                          impact < 0
                            ? 'text-rose-600'
                            : impact > 0
                              ? 'text-emerald-700'
                              : 'text-[#6B6B6B]'
                        }
                      >
                        {formatBRL(impact)}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          session.status === 'completed' ? 'text-emerald-700' : 'text-[#8A6D36]'
                        )}
                      >
                        {session.status === 'completed' ? 'Finalizado' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openExistingSession(session)}
                        className="h-7 px-2.5 text-[11px] border-[#E5E2DC] bg-white text-[#171717] rounded-lg whitespace-nowrap"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        {session.status === 'completed' ? 'Visualizar' : 'Continuar'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

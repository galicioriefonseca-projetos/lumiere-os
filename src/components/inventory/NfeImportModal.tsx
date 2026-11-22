import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InventoryItem,
  NfeParsedInvoice,
  PurchaseOrderItem,
  StockLocation,
  Supplier,
} from '@/types';
import { parseNfeXmlApi, receivePurchaseOrderApi } from '@/services/inventoryService';
import { STOCK_LOCATION_OPTIONS } from './inventoryConstants';
import { formatBRL } from '@/lib/utils';
import { toast } from 'sonner';
import { CheckCircle2, FileCode2, Loader2, Upload } from 'lucide-react';

interface NfeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  inventoryItems: InventoryItem[];
  suppliers: Supplier[];
  operatorName: string;
}

interface DraftNfeLine extends PurchaseOrderItem {
  matchedBy?: string;
}

export const NfeImportModal: React.FC<NfeImportModalProps> = ({
  open,
  onOpenChange,
  salonId,
  inventoryItems,
  suppliers,
  operatorName,
}) => {
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<NfeParsedInvoice | null>(null);
  const [matchedSupplierId, setMatchedSupplierId] = useState('');
  const [lines, setLines] = useState<DraftNfeLine[]>([]);
  const [receiveImmediately, setReceiveImmediately] = useState(true);
  const [recordFinancialExpense, setRecordFinancialExpense] = useState(true);
  const [xmlText, setXmlText] = useState('');

  const matchProductForNfeItem = (ean: string, code: string, name: string): { product?: InventoryItem; reason?: string } => {
    if (ean) {
      const byEan = inventoryItems.find((p) => p.barcode && p.barcode.trim() === ean.trim());
      if (byEan) return { product: byEan, reason: 'EAN' };
    }
    if (code) {
      const byCode = inventoryItems.find(
        (p) =>
          (p.sku && p.sku.trim().toLowerCase() === code.trim().toLowerCase()) ||
          p.supplierLinks?.some((l) => l.supplierCode?.trim().toLowerCase() === code.trim().toLowerCase())
      );
      if (byCode) return { product: byCode, reason: 'Código' };
    }
    const cleanName = name.trim().toLowerCase();
    const byName = inventoryItems.find((p) => p.name.trim().toLowerCase() === cleanName);
    if (byName) return { product: byName, reason: 'Nome exato' };
    return {};
  };

  const processXmlString = async (raw: string) => {
    if (!raw.trim()) return;
    setParsing(true);
    try {
      const parsed = await parseNfeXmlApi(salonId, raw);
      setInvoice(parsed);

      const cleanDoc = (parsed.supplier.document || '').replace(/\D/g, '');
      const existingSup = suppliers.find(
        (s) =>
          (cleanDoc && (s.document || '').replace(/\D/g, '') === cleanDoc) ||
          s.tradeName.trim().toLowerCase() === parsed.supplier.tradeName.trim().toLowerCase()
      );
      setMatchedSupplierId(existingSup?.id || '');

      const mappedLines: DraftNfeLine[] = parsed.items.map((item, idx) => {
        const match = matchProductForNfeItem(item.ean, item.code, item.name);
        return {
          id: `nfe_line_${idx}_${Date.now()}`,
          productId: match.product?.id || '',
          productName: match.product?.name || item.name,
          sku: item.code || match.product?.sku || '',
          barcode: item.ean || match.product?.barcode || '',
          brand: match.product?.brand || parsed.supplier.tradeName,
          category: match.product?.category || 'Uso Técnico Clínico',
          stockLocation: match.product?.stockLocation || 'resale',
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          expirationDate: '',
          createNewProduct: !match.product,
          matchedBy: match.reason,
        };
      });
      setLines(mappedLines);
      toast.success(`NF-e #${parsed.invoiceNumber} lida com ${mappedLines.length} item(ns).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao interpretar arquivo XML.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setXmlText(text);
      void processXmlString(text);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleProductLinkChange = (lineId: string, selectedProductId: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        if (!selectedProductId) {
          return { ...line, productId: '', createNewProduct: true, matchedBy: undefined };
        }
        const prod = inventoryItems.find((i) => i.id === selectedProductId);
        return {
          ...line,
          productId: selectedProductId,
          createNewProduct: false,
          stockLocation: prod?.stockLocation || line.stockLocation,
          matchedBy: 'Manual',
        };
      })
    );
  };

  const handleConfirmImport = async () => {
    if (!invoice || lines.length === 0) return;
    setSaving(true);
    try {
      const selectedSup = suppliers.find((s) => s.id === matchedSupplierId);
      const todayStr = new Date().toISOString().substring(0, 10);

      await receivePurchaseOrderApi({
        salonId,
        orderNumber: `NFE-${invoice.invoiceNumber}`,
        supplierId: selectedSup?.id,
        supplierName: selectedSup?.tradeName || invoice.supplier.tradeName,
        supplierDocument: invoice.supplier.document,
        createSupplierPayload: selectedSup
          ? undefined
          : {
              tradeName: invoice.supplier.tradeName,
              companyName: invoice.supplier.companyName,
              document: invoice.supplier.document,
              phone: invoice.supplier.phone,
              zipCode: invoice.supplier.zipCode,
              state: invoice.supplier.state,
              city: invoice.supplier.city,
              address: invoice.supplier.address,
              number: invoice.supplier.number,
              neighborhood: invoice.supplier.neighborhood,
            },
        origin: 'nfe_xml',
        invoiceNumber: invoice.invoiceNumber,
        invoiceKey: invoice.invoiceKey,
        orderDate: invoice.issueDate || todayStr,
        receivedDate: todayStr,
        receiveImmediately,
        recordFinancialExpense: receiveImmediately && recordFinancialExpense,
        notes: `Importado via XML NF-e #${invoice.invoiceNumber}`,
        items: lines.map(({ matchedBy: _ignored, ...rest }) => rest),
        operatorName,
      });

      toast.success(
        receiveImmediately
          ? `NF-e #${invoice.invoiceNumber} recebida e lançada no estoque!`
          : `Pedido de compra NF-e #${invoice.invoiceNumber} salvo como pendente.`
      );
      setInvoice(null);
      setLines([]);
      setXmlText('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao concluir importação NF-e.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-4xl rounded-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E5E2DC] shrink-0">
          <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-[#8A6D36]" />
            Importar XML de Nota Fiscal (NF-e)
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B6B6B]">
            Importe o XML da NF-e do fornecedor para cadastrar produtos novos, vincular aos itens existentes e dar entrada automática no estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {!invoice ? (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#E5E2DC] hover:border-[#8A6D36] rounded-xl bg-[#FAF9F7] cursor-pointer transition-colors">
                <Upload className="w-7 h-7 text-[#8A6D36] mb-2" />
                <span className="font-semibold text-[#171717]">
                  Clique para selecionar o arquivo .xml da NF-e
                </span>
                <span className="text-[11px] text-[#6B6B6B] mt-1">
                  Padrão SEFAZ brasileiro (&lt;nfeProc&gt; ou &lt;infNFe&gt;)
                </span>
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="space-y-2">
                <span className="font-semibold text-[#171717] block">
                  Ou cole o conteúdo XML diretamente:
                </span>
                <textarea
                  value={xmlText}
                  onChange={(e) => setXmlText(e.target.value)}
                  rows={5}
                  placeholder="<nfeProc>...</nfeProc>"
                  className="w-full p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] font-mono text-[11px]"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={parsing || !xmlText.trim()}
                    onClick={() => processXmlString(xmlText)}
                    className="h-9 px-4 bg-[#171717] text-white text-xs rounded-lg"
                  >
                    {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Ler XML da NF-e
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Invoice & Supplier Header */}
              <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-[11px] text-[#6B6B6B] block">Nota Fiscal</span>
                  <span className="text-sm font-bold text-[#171717] font-mono tabular-nums">
                    NF-e #{invoice.invoiceNumber}
                  </span>
                  <span className="text-[11px] text-[#6B6B6B] block mt-0.5">
                    Emissão: {invoice.issueDate}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B6B6B] block">Emitente (XML)</span>
                  <span className="font-semibold text-[#171717] block">{invoice.supplier.tradeName}</span>
                  <span className="text-[11px] text-[#6B6B6B] font-mono tabular-nums">
                    CNPJ: {invoice.supplier.document || 'Não informado'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-[#6B6B6B] block">Fornecedor no LumièreOS</span>
                  <select
                    value={matchedSupplierId}
                    onChange={(e) => setMatchedSupplierId(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg bg-white border border-[#E5E2DC] text-xs"
                  >
                    <option value="">+ Cadastrar "{invoice.supplier.tradeName}" automaticamente</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        Vincular a: {s.tradeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lines reconciliation table */}
              <div className="border border-[#E5E2DC] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B] font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Item na NF-e</th>
                      <th className="py-2.5 px-3">Vincular ao Estoque</th>
                      <th className="py-2.5 px-3">Local</th>
                      <th className="py-2.5 px-3">Validade</th>
                      <th className="py-2.5 px-3 text-right">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Custo Un.</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC]">
                    {lines.map((line) => (
                      <tr key={line.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-[#171717]">{line.productName}</div>
                          <div className="text-[11px] text-[#6B6B6B] font-mono">
                            Cód: {line.sku || '-'} {line.barcode ? `· EAN ${line.barcode}` : ''}
                            {line.matchedBy ? ` · Match (${line.matchedBy})` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 min-w-[200px]">
                          <select
                            value={line.productId || ''}
                            onChange={(e) => handleProductLinkChange(line.id, e.target.value)}
                            className="w-full h-8 px-2 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs"
                          >
                            <option value="">+ Criar Novo Produto</option>
                            {inventoryItems.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} (Saldo: {inv.quantity})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={line.stockLocation || 'resale'}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.id === line.id
                                    ? { ...l, stockLocation: e.target.value as StockLocation }
                                    : l
                                )
                              )
                            }
                            className="h-8 px-2 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs"
                          >
                            {STOCK_LOCATION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <Input
                            type="date"
                            value={line.expirationDate || ''}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.id === line.id ? { ...l, expirationDate: e.target.value } : l
                                )
                              )
                            }
                            className="h-8 text-xs bg-[#FAF9F7] border-[#E5E2DC] w-32"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {line.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatBRL(line.unitCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                          {formatBRL(line.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Receipt options */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 font-medium text-[#171717] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={receiveImmediately}
                      onChange={(e) => setReceiveImmediately(e.target.checked)}
                    />
                    Dar entrada imediata no estoque ao importar
                  </label>
                  {receiveImmediately && (
                    <label className="flex items-center gap-2 text-[#6B6B6B] cursor-pointer pl-5">
                      <input
                        type="checkbox"
                        checked={recordFinancialExpense}
                        onChange={(e) => setRecordFinancialExpense(e.target.checked)}
                      />
                      Lançar valor total como despesa paga no Financeiro
                    </label>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#6B6B6B] block">Total da Nota Fiscal</span>
                  <span className="text-lg font-heading font-bold text-[#171717] font-mono tabular-nums">
                    {formatBRL(invoice.totalValue)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E5E2DC] bg-[#FAF9F7] flex items-center justify-between">
          <div>
            {invoice && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setInvoice(null);
                  setLines([]);
                }}
                className="h-9 text-xs text-[#6B6B6B]"
              >
                Escolher outro XML
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 border-[#E5E2DC] text-xs rounded-lg"
            >
              Cancelar
            </Button>
            {invoice && (
              <Button
                type="button"
                disabled={saving}
                onClick={handleConfirmImport}
                className="h-9 px-5 bg-[#171717] hover:bg-[#2b2b2b] text-white text-xs font-semibold rounded-lg"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Concluir Importação da NF-e
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

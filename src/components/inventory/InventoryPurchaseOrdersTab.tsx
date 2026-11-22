import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InventoryItem, PurchaseOrder, PurchaseOrderItem, Supplier } from '@/types';
import { receivePurchaseOrderApi } from '@/services/inventoryService';
import { formatDateBR, getStockHealth } from './inventoryConstants';
import { cn, formatBRL } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CheckCircle2,
  FileCode2,
  Loader2,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';

interface InventoryPurchaseOrdersTabProps {
  salonId: string;
  orders: PurchaseOrder[];
  inventoryItems: InventoryItem[];
  suppliers: Supplier[];
  operatorName: string;
  onOpenNfeImport: () => void;
  prefilledCriticalItems?: InventoryItem[] | null;
  onClearPrefilledCritical?: () => void;
}

const STATUS_LABEL: Record<PurchaseOrder['status'], string> = {
  draft: 'Rascunho',
  ordered: 'Aguardando Entrega',
  received: 'Recebido no Estoque',
  canceled: 'Cancelado',
};

export const InventoryPurchaseOrdersTab: React.FC<InventoryPurchaseOrdersTabProps> = ({
  salonId,
  orders,
  inventoryItems,
  suppliers,
  operatorName,
  onOpenNfeImport,
  prefilledCriticalItems,
  onClearPrefilledCritical,
}) => {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);

  // Manual Order Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().substring(0, 10));
  const [expectedDate, setExpectedDate] = useState('');
  const [receiveNow, setReceiveNow] = useState(false);
  const [recordExpense, setRecordExpense] = useState(false);
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<PurchaseOrderItem[]>([]);
  const [pickProductId, setPickProductId] = useState('');
  const [pickQty, setPickQty] = useState('1');
  const [pickCost, setPickCost] = useState('0');

  useEffect(() => {
    if (!prefilledCriticalItems || prefilledCriticalItems.length === 0) return;
    const mapped: PurchaseOrderItem[] = prefilledCriticalItems.map((item, idx) => {
      const qty = Math.max(1, getStockHealth(item).suggestedOrderQty);
      const cost = Number(item.costPrice || 0);
      return {
        id: `restock_${idx}_${Date.now()}`,
        productId: item.id,
        productName: item.name,
        sku: item.sku,
        barcode: item.barcode,
        brand: item.brand,
        category: item.category,
        stockLocation: item.stockLocation || 'resale',
        quantity: qty,
        unitCost: cost,
        totalCost: Number((qty * cost).toFixed(2)),
      };
    });
    setOrderNumber(`PC-${Math.floor(1000 + Math.random() * 9000)}`);
    setOrderDate(new Date().toISOString().substring(0, 10));
    setDraftItems(mapped);
    setReceiveNow(false);
    setNotes('Reposição automática de itens abaixo do estoque mínimo');
    setManualModalOpen(true);
    onClearPrefilledCritical?.();
  }, [prefilledCriticalItems, onClearPrefilledCritical]);

  const openNewManualOrder = () => {
    setOrderNumber(`PC-${Math.floor(1000 + Math.random() * 9000)}`);
    setSupplierId(suppliers[0]?.id || '');
    setCustomSupplierName('');
    setOrderDate(new Date().toISOString().substring(0, 10));
    setExpectedDate('');
    setReceiveNow(false);
    setRecordExpense(false);
    setNotes('');
    setDraftItems([]);
    setPickProductId(inventoryItems[0]?.id || '');
    setPickQty('1');
    setPickCost(inventoryItems[0] ? String(inventoryItems[0].costPrice || 0) : '0');
    setManualModalOpen(true);
  };

  const handleAddDraftItem = () => {
    const prod = inventoryItems.find((i) => i.id === pickProductId);
    if (!prod) {
      toast.error('Selecione um produto.');
      return;
    }
    const qty = Number.parseFloat(pickQty.replace(',', '.')) || 0;
    const cost = Number.parseFloat(pickCost.replace(',', '.')) || 0;
    if (qty <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    setDraftItems((prev) => [
      ...prev,
      {
        id: `po_item_${Date.now()}_${Math.random()}`,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        brand: prod.brand,
        category: prod.category,
        stockLocation: prod.stockLocation || 'resale',
        quantity: qty,
        unitCost: cost,
        totalCost: Number((qty * cost).toFixed(2)),
      },
    ]);
  };

  const handleSaveManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === supplierId);
    const supName = sup?.tradeName || customSupplierName.trim() || 'Fornecedor Geral';
    if (draftItems.length === 0) {
      toast.error('Adicione ao menos 1 produto ao pedido de compra.');
      return;
    }

    setSavingOrder(true);
    try {
      await receivePurchaseOrderApi({
        salonId,
        orderNumber: orderNumber.trim() || `PC-${Date.now()}`,
        supplierId: sup?.id,
        supplierName: supName,
        supplierDocument: sup?.document,
        origin: 'manual',
        orderDate,
        expectedDeliveryDate: expectedDate || undefined,
        receivedDate: orderDate,
        receiveImmediately: receiveNow,
        recordFinancialExpense: receiveNow && recordExpense,
        notes: notes.trim(),
        items: draftItems,
        operatorName,
      });

      toast.success(
        receiveNow
          ? 'Pedido criado e recebido imediatamente no estoque!'
          : 'Pedido de compra salvo como Aguardando Entrega.'
      );
      setManualModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar pedido de compra.');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleConfirmReceiveOrder = async (order: PurchaseOrder) => {
    setReceivingOrderId(order.id);
    try {
      const todayStr = new Date().toISOString().substring(0, 10);
      await receivePurchaseOrderApi({
        salonId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        supplierDocument: order.supplierDocument,
        origin: order.origin,
        invoiceNumber: order.invoiceNumber,
        invoiceKey: order.invoiceKey,
        orderDate: order.orderDate,
        expectedDeliveryDate: order.expectedDeliveryDate,
        receivedDate: todayStr,
        receiveImmediately: true,
        recordFinancialExpense: true,
        notes: order.notes || 'Recebimento confirmado de pedido de compra',
        items: order.items,
        operatorName,
      });
      toast.success(`Pedido #${order.orderNumber} recebido no estoque!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar recebimento.');
    } finally {
      setReceivingOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (startDate && o.orderDate < startDate) return false;
      if (endDate && o.orderDate > endDate) return false;
      if (!q) return true;
      return (
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.supplierName || '').toLowerCase().includes(q) ||
        (o.invoiceNumber || '').toLowerCase().includes(q)
      );
    });
  }, [orders, search, startDate, endDate]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={openNewManualOrder}
              className="h-9 px-4 bg-[#171717] hover:bg-[#2b2b2b] text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Pedido Manual
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onOpenNfeImport}
              className="h-9 px-4 border-[#D4AF37]/60 bg-[#FAF7EE] text-[#8A6D36] hover:bg-[#F3ECD8] rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <FileCode2 className="w-3.5 h-3.5 mr-1.5" /> Importar XML de NF-e
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-36 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              title="Data Início"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-36 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              title="Data Fim"
            />
            <div className="relative w-56">
              <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nº, NF-e ou fornecedor..."
                className="h-9 pl-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <ShoppingCart className="w-8 h-8 text-[#8A6D36]/50 mx-auto" />
            <p className="text-sm font-semibold text-[#171717]">Nenhum pedido de compra registrado</p>
            <p className="text-xs text-[#6B6B6B] max-w-md mx-auto">
              Crie um pedido de reposição manual ou importe o XML de Nota Fiscal Eletrônica para dar entrada automática em lote.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B] font-semibold">
                <tr>
                  <th className="py-3 px-4">Nº Pedido / Origem</th>
                  <th className="py-3 px-3">Fornecedor</th>
                  <th className="py-3 px-3">Data Pedido</th>
                  <th className="py-3 px-3">Entrega / Recebimento</th>
                  <th className="py-3 px-3 text-right">Itens</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-[#171717]">{order.orderNumber}</div>
                      <div className="text-[11px] text-[#6B6B6B]">
                        {order.origin === 'nfe_xml'
                          ? `XML NF-e ${order.invoiceNumber || ''}`
                          : order.origin === 'auto_restock'
                            ? 'Reposição Automática'
                            : 'Manual'}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#171717]">{order.supplierName}</td>
                    <td className="py-3 px-3 font-mono tabular-nums text-[#6B6B6B]">
                      {formatDateBR(order.orderDate)}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-[#6B6B6B]">
                      {order.receivedDate
                        ? `Recebido em ${formatDateBR(order.receivedDate)}`
                        : order.expectedDeliveryDate
                          ? `Prev: ${formatDateBR(order.expectedDeliveryDate)}`
                          : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {order.items?.length || 0}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-[#171717]">
                      {formatBRL(order.totalCost || 0)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          order.status === 'received'
                            ? 'text-emerald-700'
                            : order.status === 'canceled'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                        )}
                      >
                        {STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {order.status !== 'received' && order.status !== 'canceled' ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={receivingOrderId === order.id}
                          onClick={() => handleConfirmReceiveOrder(order)}
                          className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-lg whitespace-nowrap"
                        >
                          {receivingOrderId === order.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <PackageCheck className="w-3.5 h-3.5 mr-1" />
                          )}
                          Dar Entrada
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Novo Pedido Manual */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-2xl rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E5E2DC] shrink-0">
            <DialogTitle className="font-heading text-lg font-bold text-[#171717]">
              Novo Pedido de Compra
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Monte o pedido para seu fornecedor e decida se deseja recebê-lo agora ou apenas acompanhar a entrega.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveManualOrder} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nº Pedido</Label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data do Pedido</Label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Previsão de Entrega</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fornecedor</Label>
                {suppliers.length > 0 ? (
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs"
                  >
                    <option value="">Outro / Informar manualmente</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.tradeName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={customSupplierName}
                    onChange={(e) => setCustomSupplierName(e.target.value)}
                    placeholder="Nome do fornecedor"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  />
                )}
              </div>
              {suppliers.length > 0 && !supplierId && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nome do Fornecedor</Label>
                  <Input
                    value={customSupplierName}
                    onChange={(e) => setCustomSupplierName(e.target.value)}
                    placeholder="Digite o fornecedor"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  />
                </div>
              )}
            </div>

            {/* Add Item Picker */}
            <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-2.5">
              <span className="text-[11px] font-semibold text-[#171717] block">
                Adicionar Produto ao Pedido
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div className="sm:col-span-2 space-y-1">
                  <select
                    value={pickProductId}
                    onChange={(e) => {
                      setPickProductId(e.target.value);
                      const prod = inventoryItems.find((i) => i.id === e.target.value);
                      if (prod) setPickCost(String(prod.costPrice || 0));
                    }}
                    className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E5E2DC] text-xs"
                  >
                    <option value="">Selecione um produto...</option>
                    {inventoryItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} (Saldo: {i.quantity})
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={pickQty}
                  onChange={(e) => setPickQty(e.target.value)}
                  placeholder="Qtd"
                  className="h-9 bg-white border-[#E5E2DC] text-xs font-mono tabular-nums"
                />
                <div className="flex gap-2">
                  <Input
                    value={pickCost}
                    onChange={(e) => setPickCost(e.target.value)}
                    placeholder="Custo R$"
                    className="h-9 bg-white border-[#E5E2DC] text-xs font-mono tabular-nums"
                  />
                  <Button
                    type="button"
                    onClick={handleAddDraftItem}
                    className="h-9 px-3 bg-[#171717] text-white text-xs rounded-lg shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Draft items table */}
            {draftItems.length > 0 && (
              <div className="border border-[#E5E2DC] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B] font-semibold">
                    <tr>
                      <th className="py-2 px-3">Produto</th>
                      <th className="py-2 px-3 text-right">Qtd</th>
                      <th className="py-2 px-3 text-right">Custo Un.</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC]">
                    {draftItems.map((line) => (
                      <tr key={line.id}>
                        <td className="py-2 px-3 font-medium text-[#171717]">{line.productName}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{line.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatBRL(line.unitCost)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                          {formatBRL(line.totalCost)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setDraftItems((prev) => prev.filter((item) => item.id !== line.id))
                            }
                            className="p-1 text-[#6B6B6B] hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Observações</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condição de pagamento, prazo ou observações..."
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-2">
              <label className="flex items-center gap-2 font-medium text-[#171717] cursor-pointer">
                <input
                  type="checkbox"
                  checked={receiveNow}
                  onChange={(e) => setReceiveNow(e.target.checked)}
                />
                Já recebi os itens (dar entrada imediata no estoque)
              </label>
              {receiveNow && (
                <label className="flex items-center gap-2 text-[#6B6B6B] cursor-pointer pl-5">
                  <input
                    type="checkbox"
                    checked={recordExpense}
                    onChange={(e) => setRecordExpense(e.target.checked)}
                  />
                  Lançar compra como despesa paga no Financeiro
                </label>
              )}
            </div>

            <div className="pt-2 border-t border-[#E5E2DC] flex items-center justify-between">
              <div className="text-xs">
                Total do Pedido:{' '}
                <strong className="font-mono tabular-nums text-sm text-[#171717]">
                  {formatBRL(draftItems.reduce((acc, i) => acc + i.totalCost, 0))}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManualModalOpen(false)}
                  className="h-9 px-4 border-[#E5E2DC] text-xs rounded-lg"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingOrder}
                  className="h-9 px-5 bg-[#171717] text-white text-xs font-semibold rounded-lg"
                >
                  {savingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Salvar Pedido
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

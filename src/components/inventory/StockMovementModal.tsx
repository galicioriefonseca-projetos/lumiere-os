import React, { useEffect, useState } from 'react';
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
import { InventoryItem, Professional, Supplier } from '@/types';
import { recordStockMovementApi } from '@/services/inventoryService';
import { formatBRL } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';

interface StockMovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  direction: 'in' | 'out';
  items: InventoryItem[];
  preselectedProduct?: InventoryItem | null;
  suppliers: Supplier[];
  professionals: Professional[];
  operatorName: string;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  open,
  onOpenChange,
  salonId,
  direction,
  items,
  preselectedProduct,
  suppliers,
  professionals,
  operatorName,
}) => {
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState('');
  const [movementDate, setMovementDate] = useState(new Date().toISOString().substring(0, 10));
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [assignProfessional, setAssignProfessional] = useState(false);
  const [professionalId, setProfessionalId] = useState('');
  const [recordFinancialExpense, setRecordFinancialExpense] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    const defaultItem = preselectedProduct || items[0] || null;
    setProductId(defaultItem?.id || '');
    setMovementDate(new Date().toISOString().substring(0, 10));
    setQuantity('1');
    setUnitCost(defaultItem ? String(defaultItem.costPrice || 0) : '');
    setExpirationDate(defaultItem?.nextExpirationDate || '');
    setSupplierId(defaultItem?.supplierId || '');
    setAssignProfessional(false);
    setProfessionalId('');
    setRecordFinancialExpense(false);
    setNotes('');
  }, [open, preselectedProduct, items, direction]);

  const selectedProduct = items.find((i) => i.id === productId);
  const qtyNum = Number.parseFloat(quantity.replace(',', '.')) || 0;
  const costNum = Number.parseFloat(unitCost.replace(',', '.')) || 0;

  const handleProductSelect = (id: string) => {
    setProductId(id);
    const prod = items.find((i) => i.id === id);
    if (prod) {
      setUnitCost(String(prod.costPrice || 0));
      if (prod.nextExpirationDate) setExpirationDate(prod.nextExpirationDate);
      if (prod.supplierId) setSupplierId(prod.supplierId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast.error('Selecione o produto para movimentar.');
      return;
    }
    if (qtyNum <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }
    if (!notes.trim() || notes.trim().length < 2) {
      toast.error('A observação é obrigatória para auditoria do Kardex.');
      return;
    }
    if (direction === 'out' && assignProfessional && !professionalId) {
      toast.error('Selecione o profissional responsável pela retirada.');
      return;
    }

    const sup = suppliers.find((s) => s.id === supplierId);
    const prof = professionals.find((p) => p.id === professionalId);

    setSaving(true);
    try {
      const result = await recordStockMovementApi({
        salonId,
        productId,
        direction,
        quantity: qtyNum,
        movementDate,
        notes: notes.trim(),
        unitCost: direction === 'in' ? costNum : undefined,
        expirationDate: direction === 'in' && expirationDate ? expirationDate : undefined,
        supplierId: direction === 'in' && sup ? sup.id : undefined,
        supplierName: direction === 'in' && sup ? sup.tradeName : undefined,
        professionalId: direction === 'out' && assignProfessional && prof ? prof.id : undefined,
        professionalName: direction === 'out' && assignProfessional && prof ? prof.name : undefined,
        recordFinancialExpense: direction === 'in' ? recordFinancialExpense : false,
        performedByName: operatorName,
      });

      toast.success(
        direction === 'in'
          ? `Entrada de ${qtyNum} ${selectedProduct?.unit || 'un'} registrada. Saldo atual: ${result.newQuantity}.`
          : `Saída de ${qtyNum} ${selectedProduct?.unit || 'un'} registrada. Saldo atual: ${result.newQuantity}.`
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao movimentar estoque.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-lg rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
            {direction === 'in' ? (
              <ArrowUpCircle className="w-5 h-5 text-emerald-700" />
            ) : (
              <ArrowDownCircle className="w-5 h-5 text-rose-700" />
            )}
            {direction === 'in' ? 'Registrar Entrada de Produto' : 'Registrar Saída de Produto'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B6B6B]">
            Toda movimentação atualiza o saldo e gera um registro permanente no histórico Kardex.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Produto *</Label>
              <select
                value={productId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717]"
                required
              >
                <option value="">Selecione um produto...</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Atual: {item.quantity} {item.unit || 'un'})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">
                Data {direction === 'in' ? 'de Entrada' : 'de Saída'}
              </Label>
              <Input
                type="date"
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                required
              />
            </div>
          </div>

          {selectedProduct && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-[11px] text-[#6B6B6B]">
              <span>
                Saldo atual:{' '}
                <strong className="text-[#171717] font-mono tabular-nums">
                  {selectedProduct.quantity} {selectedProduct.unit || 'un'}
                </strong>
              </span>
              <span>
                Saldo previsto:{' '}
                <strong
                  className={
                    direction === 'in'
                      ? 'text-emerald-700 font-mono tabular-nums'
                      : 'text-rose-700 font-mono tabular-nums'
                  }
                >
                  {direction === 'in'
                    ? selectedProduct.quantity + qtyNum
                    : Math.max(0, selectedProduct.quantity - qtyNum)}{' '}
                  {selectedProduct.unit || 'un'}
                </strong>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">
                {direction === 'in' ? 'Quanto entrou *' : 'Quanto saiu *'}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
                required
              />
            </div>

            {direction === 'in' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Custo Unit. (R$)</Label>
                  <Input
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="0,00"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Validade do Lote</Label>
                  <Input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 flex flex-col justify-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#171717] font-medium">
                  <input
                    type="checkbox"
                    checked={assignProfessional}
                    onChange={(e) => setAssignProfessional(e.target.checked)}
                    className="rounded border-[#E5E2DC]"
                  />
                  Registrar saída para um profissional (consumo interno)
                </label>
              </div>
            )}
          </div>

          {direction === 'in' && suppliers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Fornecedor (opcional)</Label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717]"
              >
                <option value="">Sem fornecedor vinculado</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tradeName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {direction === 'out' && assignProfessional && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#171717]">Profissional Responsável *</Label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717]"
                required
              >
                <option value="">Selecione o profissional...</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#171717]">
              Observação <span className="text-[#6B6B6B] font-normal">(obrigatório)</span>
            </Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={255}
              rows={3}
              placeholder={
                direction === 'in'
                  ? 'Ex: Reposição semanal NF 4412, bonificação fornecedor...'
                  : 'Ex: Uso no lavatório / coloração, avaria, amostra...'
              }
              className="w-full p-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#8A6D36]"
              required
            />
            <div className="text-right text-[10px] text-[#6B6B6B] tabular-nums">{notes.length}/255</div>
          </div>

          {direction === 'in' && costNum * qtyNum > 0 && (
            <label className="flex items-center justify-between gap-2 p-3 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] cursor-pointer">
              <span className="flex items-center gap-2 text-xs text-[#171717]">
                <input
                  type="checkbox"
                  checked={recordFinancialExpense}
                  onChange={(e) => setRecordFinancialExpense(e.target.checked)}
                />
                Lançar saída financeira automaticamente em Contas Pagas
              </span>
              <span className="font-mono tabular-nums font-bold text-[#171717]">
                {formatBRL(costNum * qtyNum)}
              </span>
            </label>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 border-[#E5E2DC] text-[#171717] rounded-lg text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-9 px-5 bg-[#171717] hover:bg-[#2b2b2b] text-white rounded-lg text-xs font-semibold"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Confirmar {direction === 'in' ? 'Entrada' : 'Saída'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

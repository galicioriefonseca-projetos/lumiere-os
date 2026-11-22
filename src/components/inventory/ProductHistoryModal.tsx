import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InventoryItem, StockMovement } from '@/types';
import { exportRowsToCsv, subscribeStockMovements } from '@/services/inventoryService';
import { formatDateBR } from './inventoryConstants';
import { formatBRL } from '@/lib/utils';
import { Download, History, MinusCircle, PlusCircle } from 'lucide-react';

interface ProductHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  product: InventoryItem | null;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  open,
  onOpenChange,
  salonId,
  product,
}) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || !salonId || !product?.id) return;
    setLoading(true);
    const unsub = subscribeStockMovements(
      salonId,
      (list) => {
        setMovements(list);
        setLoading(false);
      },
      product.id,
      () => setLoading(false)
    );
    return () => unsub();
  }, [open, salonId, product?.id]);

  const filtered = movements.filter((m) => {
    if (!search.trim()) return true;
    const t = search.toLowerCase();
    return (
      (m.reason || '').toLowerCase().includes(t) ||
      (m.notes || '').toLowerCase().includes(t) ||
      (m.performedByName || '').toLowerCase().includes(t) ||
      (m.professionalName || '').toLowerCase().includes(t) ||
      (m.supplierName || '').toLowerCase().includes(t)
    );
  });

  const handleExport = () => {
    if (!product) return;
    exportRowsToCsv(
      `kardex_${product.sku || product.id}.csv`,
      ['Data', 'Qtde', 'Saldo Anterior', 'Novo Saldo', 'Motivo', 'Observacao', 'Responsavel', 'Profissional', 'Validade', 'Custo Unitario', 'Fornecedor'],
      filtered.map((m) => [
        formatDateBR(m.movementDate),
        m.quantityDelta,
        m.previousQuantity,
        m.newQuantity,
        m.reason,
        m.notes || '',
        m.performedByName,
        m.professionalName || '',
        formatDateBR(m.expirationDate),
        (m.unitCost || 0).toFixed(2),
        m.supplierName || '',
      ])
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-4xl rounded-2xl p-0 overflow-hidden max-h-[88vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E5E2DC] shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
                <History className="w-5 h-5 text-[#8A6D36]" />
                Histórico Kardex · {product?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B6B6B]">
                Auditoria completa de entradas, vendas em comanda, requisições da equipe e inventários físicos.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar histórico..."
                className="h-8 px-3 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs w-44"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleExport}
                disabled={filtered.length === 0}
                className="h-8 px-3 border-[#E5E2DC] text-xs whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-[#6B6B6B]">Carregando histórico Kardex...</div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-xs text-[#6B6B6B]">
              Nenhuma movimentação registrada no histórico para este produto ainda.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B] font-semibold sticky top-0">
                <tr>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-3 text-right">Qtde</th>
                  <th className="py-3 px-3 text-right">Saldo</th>
                  <th className="py-3 px-3">Motivo / Obs.</th>
                  <th className="py-3 px-3">Responsável</th>
                  <th className="py-3 px-3">Prof.</th>
                  <th className="py-3 px-3">Validade</th>
                  <th className="py-3 px-3 text-right">Custo</th>
                  <th className="py-3 px-4">Fornecedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {filtered.map((m) => {
                  const isEntry = m.quantityDelta >= 0;
                  return (
                    <tr key={m.id} className="hover:bg-[#FAF9F7]/70">
                      <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                        {formatDateBR(m.movementDate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        <span className={isEntry ? 'text-emerald-700 inline-flex items-center gap-1' : 'text-rose-700 inline-flex items-center gap-1'}>
                          {isEntry ? <PlusCircle className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                          {isEntry ? `+${m.quantityDelta}` : m.quantityDelta}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B6B6B] whitespace-nowrap">
                        {m.previousQuantity} → <strong className="text-[#171717]">{m.newQuantity}</strong>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#171717]">{m.reason}</div>
                        {m.notes && <div className="text-[11px] text-[#6B6B6B]">{m.notes}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-[#171717]">{m.performedByName}</td>
                      <td className="py-2.5 px-3 text-[#6B6B6B]">{m.professionalName || '-'}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#6B6B6B]">
                        {formatDateBR(m.expirationDate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {m.unitCost ? formatBRL(m.unitCost) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-[#6B6B6B]">{m.supplierName || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-[#E5E2DC] bg-[#FAF9F7] flex items-center justify-between text-xs">
          <span className="text-[#6B6B6B] tabular-nums">{filtered.length} registro(s) exibido(s)</span>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 bg-[#171717] text-white rounded-lg text-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InventoryItem, StockLocation } from '@/types';
import {
  getExpirationHealth,
  getStockHealth,
  STOCK_LOCATION_LABELS,
  STOCK_LOCATION_OPTIONS,
} from './inventoryConstants';
import { deleteInventoryProduct, exportRowsToCsv } from '@/services/inventoryService';
import { cn, formatBRL } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Edit3,
  History,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';

interface InventoryProductsTabProps {
  salonId: string;
  items: InventoryItem[];
  loading: boolean;
  onOpenNewProduct: () => void;
  onEditProduct: (item: InventoryItem) => void;
  onOpenMovement: (direction: 'in' | 'out', item?: InventoryItem) => void;
  onOpenHistory: (item: InventoryItem) => void;
  onGenerateRestockOrder: (criticalItems: InventoryItem[]) => void;
}

type ProductFilterMode = 'all' | 'low_stock' | 'expiring';

export const InventoryProductsTab: React.FC<InventoryProductsTabProps> = ({
  salonId,
  items,
  loading,
  onOpenNewProduct,
  onEditProduct,
  onOpenMovement,
  onOpenHistory,
  onGenerateRestockOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<'all' | StockLocation>('all');
  const [filterMode, setFilterMode] = useState<ProductFilterMode>('all');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (locationFilter !== 'all' && (item.stockLocation || 'resale') !== locationFilter) {
        return false;
      }

      if (filterMode === 'low_stock') {
        const health = getStockHealth(item);
        if (health.status === 'ok') return false;
      }

      if (filterMode === 'expiring') {
        const exp = getExpirationHealth(item.nextExpirationDate);
        if (exp.status !== 'expired' && exp.status !== 'expiring_soon') return false;
      }

      if (!q) return true;
      return (
        (item.name || '').toLowerCase().includes(q) ||
        (item.brand || '').toLowerCase().includes(q) ||
        (item.line || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        (item.barcode || '').toLowerCase().includes(q) ||
        (item.supplier || '').toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, locationFilter, filterMode]);

  const criticalItems = useMemo(
    () => items.filter((item) => getStockHealth(item).status !== 'ok'),
    [items]
  );

  const handleDelete = async (item: InventoryItem) => {
    try {
      await deleteInventoryProduct(salonId, item.id);
      toast.success(`Produto "${item.name}" removido do estoque.`);
    } catch {
      toast.error('Não foi possível excluir este produto.');
    }
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      'estoque_lumiere_produtos.csv',
      [
        'SKU',
        'EAN',
        'Produto',
        'Local',
        'Marca',
        'Categoria',
        'Saldo Atual',
        'Estoque Minimo',
        'Sugestao Compra',
        'Custo',
        'Preco Revenda',
        'Proximo Vencimento',
        'Fornecedor',
      ],
      filteredItems.map((item) => {
        const health = getStockHealth(item);
        return [
          item.sku || '',
          item.barcode || '',
          item.name,
          STOCK_LOCATION_LABELS[item.stockLocation || 'resale'],
          item.brand || '',
          item.category || '',
          item.quantity,
          item.minQuantity,
          health.suggestedOrderQty,
          (item.costPrice || 0).toFixed(2),
          (item.sellingPrice || 0).toFixed(2),
          item.nextExpirationDate || '',
          item.supplier || '',
        ];
      })
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={onOpenNewProduct}
              className="h-9 px-4 bg-[#171717] hover:bg-[#2b2b2b] text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Cadastrar Produto
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenMovement('in')}
              disabled={items.length === 0}
              className="h-9 px-3.5 border-[#E5E2DC] text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" /> Registrar Entrada
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenMovement('out')}
              disabled={items.length === 0}
              className="h-9 px-3.5 border-[#E5E2DC] text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <ArrowDownCircle className="w-3.5 h-3.5 mr-1.5" /> Registrar Saída
            </Button>
            {criticalItems.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onGenerateRestockOrder(criticalItems)}
                className="h-9 px-3.5 border-[#D4AF37]/60 bg-[#FAF7EE] text-[#8A6D36] hover:bg-[#F3ECD8] rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Repor Críticos ({criticalItems.length})
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
              className="h-9 px-3 border-[#E5E2DC] text-[#171717] rounded-lg text-xs whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-[#E5E2DC]">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value as 'all' | StockLocation)}
              className="h-9 px-3 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717] font-medium"
            >
              <option value="all">Todos os locais de estoque</option>
              {STOCK_LOCATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 bg-[#FAF9F7] border border-[#E5E2DC] rounded-lg">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  filterMode === 'all' ? 'bg-white text-[#171717] shadow-xs' : 'text-[#6B6B6B] hover:text-[#171717]'
                )}
              >
                Todos ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('low_stock')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  filterMode === 'low_stock'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-[#6B6B6B] hover:text-[#171717]'
                )}
              >
                Estoque crítico ({criticalItems.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('expiring')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  filterMode === 'expiring'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-[#6B6B6B] hover:text-[#171717]'
                )}
              >
                Vencimento próximo
              </button>
            </div>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nome, marca, SKU ou EAN..."
              className="h-9 pl-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 px-6 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 bg-[#FAF9F7] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <Package className="w-8 h-8 text-[#8A6D36]/50 mx-auto" />
            <p className="text-sm font-semibold text-[#171717]">
              Nenhum produto encontrado para este filtro
            </p>
            <p className="text-xs text-[#6B6B6B] max-w-md mx-auto">
              Cadastre seus produtos de revenda e insumos técnicos ou importe diretamente pelo XML da Nota Fiscal na aba Pedidos de Compra.
            </p>
            <Button
              type="button"
              onClick={onOpenNewProduct}
              className="h-9 px-4 bg-[#171717] text-white text-xs rounded-lg"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Cadastrar Primeiro Produto
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B] font-semibold">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-3">Próx. Vencimento</th>
                  <th className="py-3 px-3">Categoria / Local</th>
                  <th className="py-3 px-3 text-right">Custo / Revenda</th>
                  <th className="py-3 px-3 text-right">Mínimo</th>
                  <th className="py-3 px-3 text-right">Em Estoque</th>
                  <th className="py-3 px-3">Cód. Interno / EAN</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {filteredItems.map((item) => {
                  const stockHealth = getStockHealth(item);
                  const expHealth = getExpirationHealth(item.nextExpirationDate);
                  return (
                    <tr key={item.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#171717]">{item.name}</div>
                        <div className="text-[11px] text-[#6B6B6B] flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>{item.brand || 'Sem marca'}</span>
                          {item.line && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{item.line}</span>
                            </>
                          )}
                          {item.supplier && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Forn: {item.supplier}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'text-xs font-mono tabular-nums',
                            expHealth.status === 'expired'
                              ? 'text-rose-700 font-semibold'
                              : expHealth.status === 'expiring_soon'
                                ? 'text-amber-700 font-semibold'
                                : 'text-[#6B6B6B]'
                          )}
                        >
                          {expHealth.label}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-[#171717] font-medium">{item.category || 'Geral'}</div>
                        <div className="text-[11px] text-[#6B6B6B]">
                          {STOCK_LOCATION_LABELS[item.stockLocation || 'resale']}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-[#6B6B6B] text-[11px]">
                          Custo: {formatBRL(item.costPrice || 0)}
                        </div>
                        <div className="text-[#171717] font-semibold">
                          Venda: {formatBRL(item.sellingPrice || 0)}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#6B6B6B] whitespace-nowrap">
                        {item.minQuantity} {item.unit || 'un'}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div
                          className={cn(
                            'inline-flex items-center justify-end gap-1 font-mono tabular-nums font-bold',
                            stockHealth.status === 'out' || stockHealth.status === 'critical'
                              ? 'text-rose-700'
                              : 'text-[#171717]'
                          )}
                        >
                          {stockHealth.status !== 'ok' && (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span>
                            {item.quantity} {item.unit || 'un'}
                          </span>
                        </div>
                        {stockHealth.suggestedOrderQty > 0 && (
                          <div className="text-[10px] text-rose-700 font-medium">
                            Sug. compra: +{stockHealth.suggestedOrderQty}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums text-[11px] text-[#6B6B6B]">
                        <div>{item.sku || '-'}</div>
                        {item.barcode && <div className="text-[10px]">EAN {item.barcode}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenMovement('in', item)}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                            title="Registrar Entrada"
                          >
                            <ArrowUpCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenMovement('out', item)}
                            className="p-1.5 text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Registrar Saída"
                          >
                            <ArrowDownCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditProduct(item)}
                            className="p-1.5 text-[#6B6B6B] hover:text-[#171717] hover:bg-[#FAF9F7] rounded-md transition-colors cursor-pointer"
                            title="Editar Produto"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenHistory(item)}
                            className="p-1.5 text-[#8A6D36] hover:bg-[#FAF7EE] rounded-md transition-colors cursor-pointer"
                            title="Histórico Kardex"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-[#6B6B6B] hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Excluir Produto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

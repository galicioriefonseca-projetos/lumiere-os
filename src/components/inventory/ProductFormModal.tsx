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
import {
  InventoryItem,
  ProductSupplierLink,
  StockLocation,
  Supplier,
} from '@/types';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  STOCK_LOCATION_OPTIONS,
} from './inventoryConstants';
import { saveInventoryProduct } from '@/services/inventoryService';
import { cn, formatBRL } from '@/lib/utils';
import { toast } from 'sonner';
import { Barcode, Building2, Loader2, Package, Plus, Trash2 } from 'lucide-react';

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  editingProduct: InventoryItem | null;
  suppliers: Supplier[];
  onSaved?: (productId: string) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  open,
  onOpenChange,
  salonId,
  editingProduct,
  suppliers,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'suppliers'>('info');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [stockLocation, setStockLocation] = useState<StockLocation>('resale');
  const [brand, setBrand] = useState('');
  const [line, setLine] = useState('');
  const [category, setCategory] = useState('Uso Técnico Clínico');
  const [unit, setUnit] = useState('un');
  const [quantity, setQuantity] = useState('0');
  const [minQuantity, setMinQuantity] = useState('2');
  const [idealQuantity, setIdealQuantity] = useState('10');
  const [costPrice, setCostPrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [nextExpirationDate, setNextExpirationDate] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [characteristics, setCharacteristics] = useState('');
  const [description, setDescription] = useState('');
  const [primarySupplier, setPrimarySupplier] = useState('');
  const [primarySupplierId, setPrimarySupplierId] = useState('');

  // Linked suppliers
  const [supplierLinks, setSupplierLinks] = useState<ProductSupplierLink[]>([]);
  const [draftSupId, setDraftSupId] = useState('');
  const [draftSupCode, setDraftSupCode] = useState('');
  const [draftSupDesc, setDraftSupDesc] = useState('');
  const [draftSupCost, setDraftSupCost] = useState('');

  useEffect(() => {
    if (!open) return;
    setActiveTab('info');
    if (editingProduct) {
      setName(editingProduct.name || '');
      setBarcode(editingProduct.barcode || '');
      setSku(editingProduct.sku || '');
      setStockLocation(editingProduct.stockLocation || 'resale');
      setBrand(editingProduct.brand || '');
      setLine(editingProduct.line || '');
      setCategory(editingProduct.category || 'Uso Técnico Clínico');
      setUnit(editingProduct.unit || 'un');
      setQuantity(String(editingProduct.quantity ?? 0));
      setMinQuantity(String(editingProduct.minQuantity ?? 2));
      setIdealQuantity(String(editingProduct.idealQuantity ?? Math.max((editingProduct.minQuantity || 2) * 2, 6)));
      setCostPrice(String(editingProduct.costPrice ?? 0));
      setSellingPrice(String(editingProduct.sellingPrice ?? 0));
      setNextExpirationDate(editingProduct.nextExpirationDate || '');
      setBatchCode(editingProduct.batchCode || '');
      setCharacteristics(editingProduct.characteristics || '');
      setDescription(editingProduct.description || '');
      setPrimarySupplier(editingProduct.supplier || '');
      setPrimarySupplierId(editingProduct.supplierId || '');
      setSupplierLinks(editingProduct.supplierLinks || []);
    } else {
      setName('');
      setBarcode('');
      setSku('');
      setStockLocation('resale');
      setBrand('');
      setLine('');
      setCategory('Home Care / Revenda');
      setUnit('un');
      setQuantity('0');
      setMinQuantity('2');
      setIdealQuantity('8');
      setCostPrice('');
      setSellingPrice('');
      setNextExpirationDate('');
      setBatchCode('');
      setCharacteristics('');
      setDescription('');
      setPrimarySupplier('');
      setPrimarySupplierId('');
      setSupplierLinks([]);
    }
    setDraftSupId('');
    setDraftSupCode('');
    setDraftSupDesc('');
    setDraftSupCost('');
  }, [open, editingProduct]);

  const handleAddSupplierLink = () => {
    const sup = suppliers.find((s) => s.id === draftSupId);
    if (!sup) {
      toast.error('Selecione um fornecedor para vincular.');
      return;
    }
    const parsedCost = Number.parseFloat(draftSupCost.replace(',', '.')) || 0;
    const newLink: ProductSupplierLink = {
      id: `${sup.id}_${Date.now()}`,
      supplierId: sup.id,
      supplierName: sup.tradeName,
      supplierCode: draftSupCode.trim(),
      supplierDescription: draftSupDesc.trim() || name.trim(),
      costPrice: parsedCost,
    };
    setSupplierLinks((prev) => [
      ...prev.filter((l) => l.supplierId !== sup.id),
      newLink,
    ]);
    if (!primarySupplier) {
      setPrimarySupplier(sup.tradeName);
      setPrimarySupplierId(sup.id);
    }
    setDraftSupId('');
    setDraftSupCode('');
    setDraftSupDesc('');
    setDraftSupCost('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome do produto.');
      return;
    }

    const qtyNum = Number.parseFloat(quantity.replace(',', '.')) || 0;
    const minNum = Number.parseFloat(minQuantity.replace(',', '.')) || 0;
    const idealNum = Number.parseFloat(idealQuantity.replace(',', '.')) || Math.max(minNum * 2, 5);
    const costNum = Number.parseFloat(costPrice.replace(',', '.')) || 0;
    const sellNum = Number.parseFloat(sellingPrice.replace(',', '.')) || 0;

    setSaving(true);
    try {
      const resolvedSku = sku.trim() || `SKU-${Math.floor(10000 + Math.random() * 89999)}`;
      const selectedSup = suppliers.find((s) => s.id === primarySupplierId);

      const savedId = await saveInventoryProduct(
        salonId,
        {
          name: name.trim(),
          brand: brand.trim(),
          line: line.trim(),
          sku: resolvedSku,
          barcode: barcode.trim(),
          category,
          stockLocation,
          unit,
          characteristics: characteristics.trim(),
          description: description.trim(),
          quantity: Math.max(0, qtyNum),
          minQuantity: Math.max(0, minNum),
          idealQuantity: Math.max(minNum, idealNum),
          costPrice: Math.max(0, costNum),
          sellingPrice: Math.max(0, sellNum),
          supplier: selectedSup?.tradeName || primarySupplier.trim() || supplierLinks[0]?.supplierName || '',
          supplierId: selectedSup?.id || primarySupplierId || supplierLinks[0]?.supplierId || '',
          supplierLinks,
          nextExpirationDate: nextExpirationDate || '',
          batchCode: batchCode.trim(),
        },
        editingProduct?.id
      );

      toast.success(
        editingProduct
          ? `Produto "${name.trim()}" atualizado com sucesso.`
          : `Produto "${name.trim()}" cadastrado no estoque.`
      );
      onSaved?.(savedId);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-2xl rounded-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[#E5E2DC] shrink-0">
          <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#8A6D36]" />
            {editingProduct ? `Editar Produto: ${editingProduct.name}` : 'Cadastrar Novo Produto'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B6B6B]">
            Configure dados fiscais, código de barras EAN, localização de estoque, validade e múltiplos fornecedores.
          </DialogDescription>

          <div className="flex items-center gap-1 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                activeTab === 'info'
                  ? 'bg-[#171717] text-white'
                  : 'bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]'
              )}
            >
              Informações do Produto
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('suppliers')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                activeTab === 'suppliers'
                  ? 'bg-[#171717] text-white'
                  : 'bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] border border-[#E5E2DC]'
              )}
            >
              Fornecedores e Códigos ({supplierLinks.length})
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {activeTab === 'info' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Nome do Produto *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Máscara Kérastase Chronologiste 500ml"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Código de Barras (EAN)</Label>
                  <div className="relative">
                    <Barcode className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-2.5 top-2.5" />
                    <Input
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="789..."
                      className="h-9 pl-8 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Local de Estoque</Label>
                  <select
                    value={stockLocation}
                    onChange={(e) => setStockLocation(e.target.value as StockLocation)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717]"
                  >
                    {STOCK_LOCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Código Interno (SKU)</Label>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Auto se vazio"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Unidade</Label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717]"
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Marca</Label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex: L'Oréal, Kérastase"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Linha</Label>
                  <Input
                    value={line}
                    onChange={(e) => setLine(e.target.value)}
                    placeholder="Ex: Nutritive"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Categoria</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717]"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 border-t border-[#E5E2DC]">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Em Estoque</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Estoque Mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Estoque Ideal</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={idealQuantity}
                    onChange={(e) => setIdealQuantity(e.target.value)}
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Custo (R$)</Label>
                  <Input
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0,00"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Preço Venda (R$)</Label>
                  <Input
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0,00"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Próximo Vencimento</Label>
                  <Input
                    type="date"
                    value={nextExpirationDate}
                    onChange={(e) => setNextExpirationDate(e.target.value)}
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Lote Atual</Label>
                  <Input
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    placeholder="Ex: L2026-09"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Fornecedor Principal</Label>
                  {suppliers.length > 0 ? (
                    <select
                      value={primarySupplierId}
                      onChange={(e) => {
                        const sup = suppliers.find((s) => s.id === e.target.value);
                        setPrimarySupplierId(e.target.value);
                        setPrimarySupplier(sup?.tradeName || '');
                      }}
                      className="w-full h-9 px-2.5 rounded-lg bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#171717]"
                    >
                      <option value="">Selecionar fornecedor...</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.tradeName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={primarySupplier}
                      onChange={(e) => setPrimarySupplier(e.target.value)}
                      placeholder="Nome do fornecedor"
                      className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Característica / Uso</Label>
                  <Input
                    value={characteristics}
                    onChange={(e) => setCharacteristics(e.target.value)}
                    placeholder="Ex: Uso profissional pós-química"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#171717]">Observações</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notas sobre dosagem, rendimento ou armazenamento"
                    className="h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[#6B6B6B] leading-relaxed">
                Um produto pode ser comprado de diferentes distribuidoras, cada qual com seu código na Nota Fiscal e custo negociado. Vincule aqui para agilizar o casamento automático na importação de XML.
              </p>

              <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-[#171717]">Fornecedor</Label>
                    <select
                      value={draftSupId}
                      onChange={(e) => setDraftSupId(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-white border border-[#E5E2DC] text-xs"
                    >
                      <option value="">Selecione um fornecedor...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.tradeName} {s.document ? `(${s.document})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-[#171717]">Código no Fornecedor</Label>
                    <Input
                      value={draftSupCode}
                      onChange={(e) => setDraftSupCode(e.target.value)}
                      placeholder="Código cProd na NF-e"
                      className="h-9 bg-white border-[#E5E2DC] text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-[11px] font-semibold text-[#171717]">Descrição na Nota do Fornecedor</Label>
                    <Input
                      value={draftSupDesc}
                      onChange={(e) => setDraftSupDesc(e.target.value)}
                      placeholder="Descrição conforme aparece no pedido/XML"
                      className="h-9 bg-white border-[#E5E2DC] text-xs"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] font-semibold text-[#171717]">Custo (R$)</Label>
                      <Input
                        value={draftSupCost}
                        onChange={(e) => setDraftSupCost(e.target.value)}
                        placeholder="0,00"
                        className="h-9 bg-white border-[#E5E2DC] text-xs font-mono tabular-nums"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddSupplierLink}
                      className="h-9 px-3 bg-[#171717] hover:bg-[#2b2b2b] text-white rounded-lg text-xs shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Vincular
                    </Button>
                  </div>
                </div>
              </div>

              {supplierLinks.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-[#E5E2DC] rounded-xl text-xs text-[#6B6B6B]">
                  <Building2 className="w-6 h-6 mx-auto mb-2 text-[#8A6D36]/60" />
                  Nenhum fornecedor vinculado especificamente a este produto ainda.
                </div>
              ) : (
                <div className="border border-[#E5E2DC] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Fornecedor</th>
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3 text-right">Custo</th>
                        <th className="py-2.5 px-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2DC]">
                      {supplierLinks.map((link) => (
                        <tr key={link.id} className="hover:bg-[#FAF9F7]">
                          <td className="py-2.5 px-3 font-medium text-[#171717]">{link.supplierName}</td>
                          <td className="py-2.5 px-3 font-mono text-[#6B6B6B]">{link.supplierCode || '-'}</td>
                          <td className="py-2.5 px-3 text-[#6B6B6B]">{link.supplierDescription || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                            {formatBRL(link.costPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setSupplierLinks((prev) => prev.filter((item) => item.id !== link.id))
                              }
                              className="p-1 text-[#6B6B6B] hover:text-rose-600 rounded cursor-pointer"
                              title="Desvincular fornecedor"
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
            </div>
          )}

          <div className="pt-4 border-t border-[#E5E2DC] flex items-center justify-end gap-2">
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
              {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

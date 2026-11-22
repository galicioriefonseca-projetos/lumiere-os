import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InventoryItem, Supplier } from '@/types';
import { deleteSupplier, exportRowsToCsv } from '@/services/inventoryService';
import { toast } from 'sonner';
import { Building2, Download, Edit3, Plus, Search, Trash2 } from 'lucide-react';

interface InventorySuppliersTabProps {
  salonId: string;
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  onNewSupplier: () => void;
  onEditSupplier: (supplier: Supplier) => void;
}

export const InventorySuppliersTab: React.FC<InventorySuppliersTabProps> = ({
  salonId,
  suppliers,
  inventoryItems,
  onNewSupplier,
  onEditSupplier,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        (s.tradeName || '').toLowerCase().includes(q) ||
        (s.companyName || '').toLowerCase().includes(q) ||
        (s.document || '').toLowerCase().includes(q) ||
        (s.contactName || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const linkedCountBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inventoryItems) {
      const ids = new Set<string>();
      if (item.supplierId) ids.add(item.supplierId);
      for (const link of item.supplierLinks || []) {
        if (link.supplierId) ids.add(link.supplierId);
      }
      ids.forEach((id) => map.set(id, (map.get(id) || 0) + 1));
    }
    return map;
  }, [inventoryItems]);

  const handleDelete = async (sup: Supplier) => {
    try {
      await deleteSupplier(salonId, sup.id);
      toast.success(`Fornecedor "${sup.tradeName}" removido.`);
    } catch {
      toast.error('Erro ao excluir fornecedor.');
    }
  };

  const handleExport = () => {
    exportRowsToCsv(
      'fornecedores_lumiere.csv',
      ['Nome Fantasia', 'Razao Social', 'CNPJ/CPF', 'Responsavel', 'Email', 'Telefone', 'Celular', 'Cidade', 'UF'],
      filtered.map((s) => [
        s.tradeName,
        s.companyName || '',
        s.document || '',
        s.contactName || '',
        s.email || '',
        s.phone || '',
        s.mobile || '',
        s.city || '',
        s.state || '',
      ])
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={onNewSupplier}
            className="h-9 px-4 bg-[#171717] hover:bg-[#2b2b2b] text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar Fornecedor
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="h-9 px-3 border-[#E5E2DC] text-[#171717] rounded-lg text-xs whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, CNPJ, cidade..."
            className="h-9 pl-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs"
          />
        </div>
      </div>

      <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <Building2 className="w-8 h-8 text-[#8A6D36]/50 mx-auto" />
            <p className="text-sm font-semibold text-[#171717]">Nenhum fornecedor cadastrado</p>
            <p className="text-xs text-[#6B6B6B] max-w-md mx-auto">
              Cadastre distribuidoras de cosméticos e insumos ou importe um XML de NF-e para criar o fornecedor automaticamente.
            </p>
            <Button
              type="button"
              onClick={onNewSupplier}
              className="h-9 px-4 bg-[#171717] text-white text-xs rounded-lg"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Cadastrar Fornecedor
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[#6B6B6B] font-semibold">
                <tr>
                  <th className="py-3 px-4">Empresa / CNPJ</th>
                  <th className="py-3 px-3">Responsável</th>
                  <th className="py-3 px-3">E-mail</th>
                  <th className="py-3 px-3">Telefone / Celular</th>
                  <th className="py-3 px-3">Cidade / UF</th>
                  <th className="py-3 px-3 text-right">Itens Vinculados</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#171717]">{s.tradeName}</div>
                      <div className="text-[11px] text-[#6B6B6B] font-mono tabular-nums">
                        {s.document || s.companyName || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[#171717]">{s.contactName || '-'}</td>
                    <td className="py-3 px-3 text-[#6B6B6B]">{s.email || '-'}</td>
                    <td className="py-3 px-3 font-mono tabular-nums text-[#6B6B6B]">
                      <div>{s.mobile || s.phone || '-'}</div>
                    </td>
                    <td className="py-3 px-3 text-[#6B6B6B]">
                      {s.city ? `${s.city}/${s.state || ''}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-[#171717]">
                      {linkedCountBySupplier.get(s.id) || 0}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditSupplier(s)}
                          className="p-1.5 text-[#6B6B6B] hover:text-[#171717] hover:bg-[#FAF9F7] rounded-md cursor-pointer"
                          title="Editar Fornecedor"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="p-1.5 text-[#6B6B6B] hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                          title="Remover Fornecedor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComandaFlow } from '@/types';
import { formatBRL } from '@/lib/utils';
import { Eye, Plus, Receipt, Search } from 'lucide-react';

interface OpenComandasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comandas: ComandaFlow[];
  onSelectComanda: (comanda: ComandaFlow) => void;
  onNewComanda?: () => void;
}

export const OpenComandasModal: React.FC<OpenComandasModalProps> = ({
  open,
  onOpenChange,
  comandas,
  onSelectComanda,
  onNewComanda,
}) => {
  const [search, setSearch] = useState('');

  const openComandas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return comandas
      .filter((c) => c.status !== 'completed' && c.status !== 'canceled')
      .filter((c) => {
        if (!q) return true;
        const num = String(c.comandaNumber || c.id.substring(0, 5)).toLowerCase();
        return (
          c.clientName.toLowerCase().includes(q) ||
          num.includes(q) ||
          c.date.includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [comandas, search]);

  const totalOpenAmount = useMemo(
    () => openComandas.reduce((sum, c) => sum + Number(c.totalAmount || 0), 0),
    [openComandas]
  );

  const stageLabel = (status: ComandaFlow['status']) => {
    switch (status) {
      case 'checked_in':
        return 'Recepção';
      case 'in_service':
        return 'Em Atendimento';
      case 'checkout_pending':
        return 'No Caixa';
      default:
        return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl p-6">
        <DialogHeader className="border-b border-[#E5E2DC] pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <DialogTitle className="font-heading text-base font-bold text-[#171717] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#8A6D36]" />
                Comandas Abertas ({openComandas.length})
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B6B6B] mt-0.5">
                Total em aberto para fechamento:{' '}
                <strong className="text-[#171717] tabular-nums">{formatBRL(totalOpenAmount)}</strong>
              </DialogDescription>
            </div>
            {onNewComanda && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onNewComanda();
                }}
                className="h-8 px-3 bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs font-semibold rounded-xl shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" /> Nova Comanda
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="relative mt-3">
          <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, número ou data..."
            className="pl-9 h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl"
          />
        </div>

        <div className="flex-1 overflow-y-auto mt-3 border border-[#E5E2DC] rounded-xl">
          {openComandas.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B6B6B]">
              Nenhuma comanda em aberto encontrada.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold text-[#6B6B6B]">
                <tr>
                  <th className="p-3">Comanda</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Estágio</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {openComandas.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-[#6B6B6B] tabular-nums whitespace-nowrap">
                      #{c.comandaNumber || c.id.substring(0, 5).toUpperCase()} ·{' '}
                      {c.date ? c.date.split('-').reverse().join('/') : '—'}
                    </td>
                    <td className="p-3 font-semibold text-[#171717]">
                      {c.clientName}
                      <span className="block text-[10px] font-normal text-[#6B6B6B]">
                        {c.items.length} {c.items.length === 1 ? 'item' : 'itens'}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-[#6B6B6B]">{stageLabel(c.status)}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#171717] tabular-nums">
                      {formatBRL(c.totalAmount)}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                          onSelectComanda(c);
                        }}
                        className="h-7 px-2.5 text-[11px] border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] text-[#171717] rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-[#8A6D36]" /> Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

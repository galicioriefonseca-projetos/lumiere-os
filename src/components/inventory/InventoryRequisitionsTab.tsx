import React, { useMemo, useState } from 'react';
import {
  InventoryItem,
  Professional,
  StockRequisition,
  StockRequisitionStatus,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createStockRequisition,
  reviewStockRequisitionsBatchApi,
} from '@/services/inventoryService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Check,
  CheckCheck,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';

interface InventoryRequisitionsTabProps {
  salonId: string;
  items: InventoryItem[];
  requisitions: StockRequisition[];
  professionals: Professional[];
  currentUserId: string;
  currentUserName: string;
  canManage: boolean;
}

export const InventoryRequisitionsTab: React.FC<InventoryRequisitionsTabProps> = ({
  salonId,
  items,
  requisitions,
  professionals,
  currentUserId,
  currentUserName,
  canManage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StockRequisitionStatus>('pending');
  const [processingBatch, setProcessingBatch] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [savingReq, setSavingReq] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [professionalId, setProfessionalId] = useState('none');
  const [serviceName, setServiceName] = useState('');
  const [comandaNumber, setComandaNumber] = useState('');
  const [notes, setNotes] = useState('');

  const pendingRequisitions = useMemo(
    () => requisitions.filter((r) => r.status === 'pending'),
    [requisitions]
  );

  const filteredRequisitions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requisitions.filter((req) => {
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (req.productName || '').toLowerCase().includes(q) ||
        (req.requesterName || '').toLowerCase().includes(q) ||
        (req.professionalName || '').toLowerCase().includes(q) ||
        (req.serviceName || '').toLowerCase().includes(q) ||
        (req.notes || '').toLowerCase().includes(q)
      );
    });
  }, [requisitions, searchQuery, statusFilter]);

  const handleOpenCreate = () => {
    setProductId(items[0]?.id || '');
    setQuantity('1');
    setProfessionalId('none');
    setServiceName('');
    setComandaNumber('');
    setNotes('');
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = items.find((i) => i.id === productId);
    if (!product) {
      toast.error('Selecione um produto do estoque.');
      return;
    }
    const qtyNum = parseFloat(quantity.replace(',', '.')) || 0;
    if (qtyNum <= 0) {
      toast.error('Informe uma quantidade válida maior que zero.');
      return;
    }

    const prof = professionals.find((p) => p.id === professionalId);
    const parsedComanda = parseInt(comandaNumber, 10);

    setSavingReq(true);
    try {
      await createStockRequisition(salonId, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku || '',
        quantity: qtyNum,
        requesterId: currentUserId,
        requesterName: currentUserName,
        professionalId: prof?.id || '',
        professionalName: prof?.name || '',
        serviceName: serviceName.trim(),
        ...(Number.isFinite(parsedComanda) && parsedComanda > 0
          ? { comandaNumber: parsedComanda }
          : {}),
        notes: notes.trim(),
      });
      toast.success('Solicitação de saída enviada para aprovação.');
      setCreateOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar solicitação de saída.');
    } finally {
      setSavingReq(false);
    }
  };

  const handleSingleReview = async (reqId: string, decision: 'approved' | 'rejected') => {
    if (!canManage) {
      toast.error('Apenas gestores podem aprovar ou recusar solicitações.');
      return;
    }
    setProcessingId(reqId);
    try {
      await reviewStockRequisitionsBatchApi(salonId, [reqId], decision, currentUserName);
      toast.success(
        decision === 'approved'
          ? 'Solicitação aprovada e saldo deduzido no Kardex!'
          : 'Solicitação recusada.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar solicitação.';
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAll = async () => {
    if (!canManage || pendingRequisitions.length === 0) return;
    setProcessingBatch(true);
    try {
      const count = await reviewStockRequisitionsBatchApi(
        salonId,
        pendingRequisitions.map((r) => r.id),
        'approved',
        currentUserName
      );
      toast.success(
        `${count} ${count === 1 ? 'solicitação aprovada' : 'solicitações aprovadas'} e deduzidas do estoque.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar solicitações em lote.';
      toast.error(msg);
    } finally {
      setProcessingBatch(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-[#E5E2DC] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'pending', label: `Pendentes (${pendingRequisitions.length})` },
              { id: 'approved', label: 'Aprovadas' },
              { id: 'rejected', label: 'Recusadas' },
              { id: 'all', label: 'Todas' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer border',
                statusFilter === f.id
                  ? 'bg-[#171717] text-white border-[#171717]'
                  : 'bg-[#FAF9F7] text-[#6B6B6B] border-[#E5E2DC] hover:text-[#171717]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produto, profissional..."
              className="pl-8 h-9 text-xs bg-white border-[#E5E2DC]"
            />
          </div>

          {canManage && pendingRequisitions.length > 0 && (
            <Button
              type="button"
              disabled={processingBatch}
              onClick={handleApproveAll}
              className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
            >
              {processingBatch ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              )}
              Aprovar Tudo ({pendingRequisitions.length})
            </Button>
          )}

          <Button
            type="button"
            onClick={handleOpenCreate}
            className="h-9 px-4 bg-[#171717] hover:bg-[#2B2B2B] text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5 text-[#D4AF37]" />
            Nova Solicitação
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E2DC] rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[780px]">
          <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold text-[#6B6B6B]">
            <tr>
              <th className="p-3.5">Produto</th>
              <th className="p-3.5 text-center">Quantidade</th>
              <th className="p-3.5">Solicitante</th>
              <th className="p-3.5">Profissional</th>
              <th className="p-3.5">Serviço / Comanda</th>
              <th className="p-3.5">Observação</th>
              <th className="p-3.5">Status</th>
              {canManage && <th className="p-3.5 text-center">Ação</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2DC]">
            {filteredRequisitions.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="p-10 text-center text-[#6B6B6B]">
                  <ClipboardList className="w-8 h-8 text-[#D6D2C9] mx-auto mb-2" />
                  Nenhuma solicitação de saída encontrada neste filtro.
                </td>
              </tr>
            ) : (
              filteredRequisitions.map((req) => (
                <tr key={req.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-[#171717]">{req.productName}</div>
                    {req.productSku && (
                      <div className="text-[11px] font-mono text-[#6B6B6B]">{req.productSku}</div>
                    )}
                  </td>
                  <td className="p-3.5 text-center font-mono font-bold tabular-nums text-[#171717]">
                    {req.quantity}
                  </td>
                  <td className="p-3.5 text-[#171717]">{req.requesterName}</td>
                  <td className="p-3.5 text-[#6B6B6B]">{req.professionalName || 'Uso Geral'}</td>
                  <td className="p-3.5 text-[#6B6B6B]">
                    <div>{req.serviceName || '-'}</div>
                    {req.comandaNumber && (
                      <div className="text-[11px] font-mono text-[#8A6D36]">
                        Comanda #{req.comandaNumber}
                      </div>
                    )}
                  </td>
                  <td className="p-3.5 text-[#6B6B6B] max-w-[200px] truncate" title={req.notes || ''}>
                    {req.notes || '-'}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={cn(
                        'font-semibold',
                        req.status === 'approved'
                          ? 'text-emerald-700'
                          : req.status === 'rejected'
                            ? 'text-rose-600'
                            : 'text-[#8A6D36]'
                      )}
                    >
                      {req.status === 'approved'
                        ? 'Aprovada'
                        : req.status === 'rejected'
                          ? 'Recusada'
                          : 'Pendente'}
                    </span>
                    {req.reviewedByName && (
                      <div className="text-[10px] text-[#6B6B6B]">por {req.reviewedByName}</div>
                    )}
                  </td>
                  {canManage && (
                    <td className="p-3.5 text-center">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            disabled={processingId === req.id || processingBatch}
                            onClick={() => handleSingleReview(req.id, 'approved')}
                            className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Aprovar saída e deduzir estoque"
                          >
                            {processingId === req.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={processingId === req.id || processingBatch}
                            onClick={() => handleSingleReview(req.id, 'rejected')}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                            title="Recusar solicitação"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#9E9E9E]">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Requisition Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold text-[#171717]">
              Nova Solicitação de Saída de Estoque
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Solicite a retirada de insumos técnicos ou produtos para atendimento na bancada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs mt-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-[#6B6B6B]">Produto *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="bg-white border-[#E5E2DC] h-9 text-xs">
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.quantity} {item.unit || 'un'} em estoque)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[#6B6B6B]">Quantidade *</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-white border-[#E5E2DC] h-9 text-xs font-mono tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[#6B6B6B]">Profissional</Label>
                <Select value={professionalId} onValueChange={setProfessionalId}>
                  <SelectTrigger className="bg-white border-[#E5E2DC] h-9 text-xs">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                    <SelectItem value="none">Uso Geral / Bancada</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[#6B6B6B]">Serviço Vinculado</Label>
                <Input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Ex: Coloração / Mechas"
                  className="bg-white border-[#E5E2DC] h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[#6B6B6B]">Nº Comanda (Opcional)</Label>
                <Input
                  type="number"
                  min={1}
                  value={comandaNumber}
                  onChange={(e) => setComandaNumber(e.target.value)}
                  placeholder="Ex: 1042"
                  className="bg-white border-[#E5E2DC] h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-[#6B6B6B]">Observação</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo ou detalhe da retirada..."
                className="bg-white border-[#E5E2DC] h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="h-9 px-4 text-xs border-[#E5E2DC] rounded-lg"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingReq}
                className="h-9 px-4 bg-[#171717] hover:bg-[#2B2B2B] text-white text-xs font-semibold rounded-lg"
              >
                {savingReq && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Enviar Solicitação
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

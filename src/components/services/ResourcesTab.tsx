import React, { useMemo, useState } from 'react';
import { SalonResource, SalonResourceType } from '@/types';
import { db } from '@/lib/firebase';
import { collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DoorOpen,
  Edit2,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from 'lucide-react';

interface ResourcesTabProps {
  salonId: string;
  resources: SalonResource[];
  canEdit: boolean;
}

const RESOURCE_TYPE_LABELS: Record<SalonResourceType, string> = {
  room: 'Sala / Gabinete',
  equipment: 'Equipamento',
  chair: 'Cadeira / Estação',
  other: 'Outro / Cabine',
};

export const ResourcesTab: React.FC<ResourcesTabProps> = ({
  salonId,
  resources,
  canEdit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<SalonResource | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<SalonResourceType>('room');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');

  const filteredResources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return resources
      .filter((r) => {
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          RESOURCE_TYPE_LABELS[r.type].toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [resources, searchQuery]);

  const resetForm = () => {
    setEditingResource(null);
    setName('');
    setType('room');
    setDescription('');
    setQuantity('1');
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (res: SalonResource) => {
    setEditingResource(res);
    setName(res.name);
    setType(res.type || 'room');
    setDescription(res.description || '');
    setQuantity(String(res.quantity || 1));
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || !canEdit) return;

    const cleanName = name.trim();
    const numericQty = Math.max(1, parseInt(quantity, 10) || 1);

    if (!cleanName) {
      toast.error('Informe o nome da sala ou equipamento.');
      return;
    }

    try {
      const now = Date.now();
      if (editingResource) {
        await updateDoc(doc(db, `salons/${salonId}/resources`, editingResource.id), {
          name: cleanName,
          type,
          description: description.trim(),
          quantity: numericQty,
          updatedAt: now,
        });
        toast.success('Recurso atualizado!');
      } else {
        const ref = doc(collection(db, `salons/${salonId}/resources`));
        await setDoc(ref, {
          id: ref.id,
          name: cleanName,
          type,
          description: description.trim(),
          quantity: numericQty,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        toast.success('Recurso cadastrado com sucesso!');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar recurso.');
    }
  };

  const toggleActive = async (res: SalonResource) => {
    if (!canEdit) return;
    try {
      await updateDoc(doc(db, `salons/${salonId}/resources`, res.id), {
        isActive: !res.isActive,
        updatedAt: Date.now(),
      });
      toast.success(`Recurso ${!res.isActive ? 'ativado' : 'inativado'}.`);
    } catch {
      toast.error('Erro ao alterar status.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || !canEdit) return;
    try {
      await deleteDoc(doc(db, `salons/${salonId}/resources`, deleteId));
      toast.success('Recurso excluído.');
      setDeleteId(null);
    } catch {
      toast.error('Erro ao excluir recurso.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E5E2DC] rounded-2xl p-4 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar sala, cabine, cadeira ou equipamento..."
            className="pl-9 h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#6B6B6B] tabular-nums">
            {filteredResources.length} {filteredResources.length === 1 ? 'recurso' : 'recursos'}
          </span>
          {canEdit && (
            <Button
              type="button"
              onClick={openCreate}
              className="h-9 px-4 bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs font-semibold rounded-xl gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4AF37]" /> Adicionar Recurso
            </Button>
          )}
        </div>
      </div>

      {filteredResources.length === 0 ? (
        <div className="bg-white border border-[#E5E2DC] rounded-2xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF9F7] border border-[#E5E2DC] flex items-center justify-center mx-auto text-[#8A6D36]">
            <DoorOpen className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#171717]">Nenhuma sala ou equipamento cadastrado</h3>
            <p className="text-xs text-[#6B6B6B] max-w-md mx-auto">
              Cadastre cabines de estética, lavatórios, laser ou estações de trabalho para vincular diretamente nos agendamentos da agenda.
            </p>
          </div>
          {canEdit && (
            <Button
              type="button"
              onClick={openCreate}
              className="bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs font-semibold rounded-xl h-9 px-4"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" /> Cadastrar Primeiro Recurso
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                <tr>
                  <th className="p-3.5 pl-5">Sala ou Equipamento</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Descrição</th>
                  <th className="p-3.5 text-center">Quantidade</th>
                  <th className="p-3.5 text-right pr-5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {filteredResources.map((res) => (
                  <tr
                    key={res.id}
                    className={cn(
                      'hover:bg-[#FAF9F7]/80 transition-colors',
                      !res.isActive && 'opacity-50'
                    )}
                  >
                    <td className="p-3.5 pl-5 font-semibold text-[#171717]">{res.name}</td>
                    <td className="p-3.5 text-[#8A6D36] font-medium">
                      {RESOURCE_TYPE_LABELS[res.type] || 'Sala'}
                    </td>
                    <td className="p-3.5 text-[#6B6B6B]">
                      {res.description || '—'}
                    </td>
                    <td className="p-3.5 text-center font-semibold text-[#171717] tabular-nums">
                      {res.quantity}
                    </td>
                    <td className="p-3.5 pr-5">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(res)}
                            className="h-7 w-7 text-[#6B6B6B] hover:text-[#171717]"
                            title="Editar recurso"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(res)}
                            className="h-7 w-7 text-[#6B6B6B] hover:text-[#8A6D36]"
                            title={res.isActive ? 'Inativar' : 'Ativar'}
                          >
                            {res.isActive ? (
                              <PowerOff className="w-3.5 h-3.5 text-rose-600" />
                            ) : (
                              <Power className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(res.id)}
                            className="h-7 w-7 text-[#6B6B6B] hover:text-rose-600"
                            title="Excluir recurso"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-[#8A6D36]" />
              {editingResource ? 'Editar Recurso' : 'Novo Recurso (Sala ou Equipamento)'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Controle espaços físicos ou equipamentos compartilhados pelos profissionais.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[#171717] font-medium">Nome da Sala ou Equipamento *</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cabine 01 - Estética, Lavatório VIP, Laser Soprano"
                className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#171717] font-medium">Tipo *</Label>
                <Select value={type} onValueChange={(v) => setType(v as SalonResourceType)}>
                  <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E5E2DC]">
                    <SelectItem value="room">Sala / Gabinete</SelectItem>
                    <SelectItem value="equipment">Equipamento</SelectItem>
                    <SelectItem value="chair">Cadeira / Estação</SelectItem>
                    <SelectItem value="other">Outro / Cabine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#171717] font-medium">Quantidade *</Label>
                <Input
                  required
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#171717] font-medium">Descrição (Opcional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Equipada com maca elétrica e vapor de ozônio"
                className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E2DC]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="h-9 px-4 rounded-xl border-[#E5E2DC] text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="h-9 px-5 rounded-xl bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs font-semibold"
              >
                {editingResource ? 'Salvar Alterações' : 'Cadastrar Recurso'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700">Excluir Recurso?</DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Esta ação removerá o recurso permanentemente do catálogo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="h-9 rounded-xl border-[#E5E2DC] text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              className="h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

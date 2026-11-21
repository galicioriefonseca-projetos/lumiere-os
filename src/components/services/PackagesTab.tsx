import React, { useMemo, useState } from 'react';
import { Service, ServicePackage, PackageIncludedService } from '@/types';
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
import { formatBRL, cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CalendarClock,
  Check,
  Edit2,
  Globe,
  Package,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from 'lucide-react';

interface PackagesTabProps {
  salonId: string;
  packages: ServicePackage[];
  services: Service[];
  canEdit: boolean;
}

export const PackagesTab: React.FC<PackagesTabProps> = ({
  salonId,
  packages,
  services,
  canEdit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<ServicePackage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [onlineBookingEnabled, setOnlineBookingEnabled] = useState(true);
  const [includedServices, setIncludedServices] = useState<PackageIncludedService[]>([]);

  const serviceOptions = useMemo(
    () => services.filter((s) => s.isActive && (!s.type || s.type === 'service')),
    [services]
  );

  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return packages
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [packages, searchQuery]);

  const resetForm = () => {
    setEditingPkg(null);
    setName('');
    setDescription('');
    setPrice('');
    setValidityDays('30');
    setOnlineBookingEnabled(true);
    setIncludedServices([]);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (pkg: ServicePackage) => {
    setEditingPkg(pkg);
    setName(pkg.name);
    setDescription(pkg.description || '');
    setPrice(String(pkg.price));
    setValidityDays(String(pkg.validityDays || 30));
    setOnlineBookingEnabled(pkg.onlineBookingEnabled !== false);
    setIncludedServices(pkg.includedServices || []);
    setIsDialogOpen(true);
  };

  const toggleServiceInPackage = (svc: Service) => {
    const exists = includedServices.find((i) => i.serviceId === svc.id);
    if (exists) {
      setIncludedServices((prev) => prev.filter((i) => i.serviceId !== svc.id));
    } else {
      setIncludedServices((prev) => [
        ...prev,
        { serviceId: svc.id, serviceName: svc.name, sessions: 1 },
      ]);
    }
  };

  const updateSessionsCount = (serviceId: string, sessions: number) => {
    setIncludedServices((prev) =>
      prev.map((item) =>
        item.serviceId === serviceId
          ? { ...item, sessions: Math.max(1, Math.min(99, sessions || 1)) }
          : item
      )
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || !canEdit) return;

    const cleanName = name.trim();
    const numericPrice = parseFloat(price.replace(',', '.')) || 0;
    const numericValidity = parseInt(validityDays, 10) || 30;

    if (!cleanName) {
      toast.error('Informe o nome do pacote ou assinatura.');
      return;
    }

    try {
      const now = Date.now();
      if (editingPkg) {
        await updateDoc(doc(db, `salons/${salonId}/packages`, editingPkg.id), {
          name: cleanName,
          description: description.trim(),
          price: numericPrice,
          validityDays: numericValidity,
          includedServices,
          onlineBookingEnabled,
          updatedAt: now,
        });
        toast.success('Pacote atualizado com sucesso!');
      } else {
        const ref = doc(collection(db, `salons/${salonId}/packages`));
        await setDoc(ref, {
          id: ref.id,
          name: cleanName,
          description: description.trim(),
          price: numericPrice,
          validityDays: numericValidity,
          includedServices,
          onlineBookingEnabled,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        toast.success('Pacote cadastrado no catálogo!');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar pacote.');
    }
  };

  const toggleActive = async (pkg: ServicePackage) => {
    if (!canEdit) return;
    try {
      await updateDoc(doc(db, `salons/${salonId}/packages`, pkg.id), {
        isActive: !pkg.isActive,
        updatedAt: Date.now(),
      });
      toast.success(`Pacote ${!pkg.isActive ? 'ativado' : 'inativado'}.`);
    } catch {
      toast.error('Erro ao alterar status do pacote.');
    }
  };

  const toggleOnline = async (pkg: ServicePackage) => {
    if (!canEdit) return;
    const nextVal = pkg.onlineBookingEnabled === false;
    try {
      await updateDoc(doc(db, `salons/${salonId}/packages`, pkg.id), {
        onlineBookingEnabled: nextVal,
        updatedAt: Date.now(),
      });
      toast.success(nextVal ? 'Disponível para venda/agendamento online.' : 'Ocultado do agendamento online.');
    } catch {
      toast.error('Erro ao alterar disponibilidade online.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || !canEdit) return;
    try {
      await deleteDoc(doc(db, `salons/${salonId}/packages`, deleteId));
      toast.success('Pacote removido.');
      setDeleteId(null);
    } catch {
      toast.error('Erro ao excluir pacote.');
    }
  };

  const suggestedSum = useMemo(() => {
    return includedServices.reduce((sum, item) => {
      const match = services.find((s) => s.id === item.serviceId);
      return sum + (match ? match.price * item.sessions : 0);
    }, 0);
  }, [includedServices, services]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E5E2DC] rounded-2xl p-4 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar pacote, combo ou assinatura..."
            className="pl-9 h-9 bg-[#FAF9F7] border-[#E5E2DC] text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#6B6B6B] tabular-nums">
            {filteredPackages.length} {filteredPackages.length === 1 ? 'pacote' : 'pacotes'}
          </span>
          {canEdit && (
            <Button
              type="button"
              onClick={openCreate}
              className="h-9 px-4 bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs font-semibold rounded-xl gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4AF37]" /> Novo Pacote
            </Button>
          )}
        </div>
      </div>

      {/* Packages Table / Empty State */}
      {filteredPackages.length === 0 ? (
        <div className="bg-white border border-[#E5E2DC] rounded-2xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF9F7] border border-[#E5E2DC] flex items-center justify-center mx-auto text-[#8A6D36]">
            <Package className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#171717]">Nenhum pacote cadastrado</h3>
            <p className="text-xs text-[#6B6B6B] max-w-md mx-auto">
              Crie assinaturas mensais, combos de escova, pacotes de sessões estéticas ou planos recorrentes com validade controlada.
            </p>
          </div>
          {canEdit && (
            <Button
              type="button"
              onClick={openCreate}
              className="bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs font-semibold rounded-xl h-9 px-4"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" /> Criar Primeiro Pacote
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E5E2DC] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                <tr>
                  <th className="p-3.5 pl-5">Pacote / Assinatura</th>
                  <th className="p-3.5">Serviços Inclusos</th>
                  <th className="p-3.5 text-center">Validade</th>
                  <th className="p-3.5 text-right">Valor</th>
                  <th className="p-3.5 text-center">Online</th>
                  <th className="p-3.5 text-right pr-5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC]">
                {filteredPackages.map((pkg) => {
                  const totalSessions = (pkg.includedServices || []).reduce(
                    (s, i) => s + (i.sessions || 1),
                    0
                  );
                  return (
                    <tr
                      key={pkg.id}
                      className={cn(
                        'hover:bg-[#FAF9F7]/80 transition-colors',
                        !pkg.isActive && 'opacity-50'
                      )}
                    >
                      <td className="p-3.5 pl-5">
                        <div className="font-semibold text-[#171717]">{pkg.name}</div>
                        {pkg.description && (
                          <div className="text-[11px] text-[#6B6B6B] line-clamp-1 mt-0.5">
                            {pkg.description}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        {pkg.includedServices && pkg.includedServices.length > 0 ? (
                          <div className="space-y-0.5 text-[11px] text-[#171717]">
                            <span className="font-semibold text-[#8A6D36] tabular-nums">
                              {totalSessions} {totalSessions === 1 ? 'sessão' : 'sessões'}
                            </span>
                            <p className="text-[#6B6B6B] truncate max-w-[260px]">
                              {pkg.includedServices
                                .map((s) => `${s.sessions}x ${s.serviceName}`)
                                .join(' · ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#6B6B6B]">Uso flexível</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center text-[#171717] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="w-3.5 h-3.5 text-[#8A6D36]" />
                          {pkg.validityDays} dias
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-bold text-[#171717] tabular-nums">
                        {formatBRL(pkg.price)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => toggleOnline(pkg)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer disabled:cursor-default',
                            pkg.onlineBookingEnabled !== false
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-[#FAF9F7] border-[#E5E2DC] text-[#6B6B6B]'
                          )}
                        >
                          <Globe className="w-3 h-3" />
                          {pkg.onlineBookingEnabled !== false ? 'Ativo' : 'Oculto'}
                        </button>
                      </td>
                      <td className="p-3.5 pr-5">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(pkg)}
                              className="h-7 w-7 text-[#6B6B6B] hover:text-[#171717]"
                              title="Editar pacote"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleActive(pkg)}
                              className="h-7 w-7 text-[#6B6B6B] hover:text-[#8A6D36]"
                              title={pkg.isActive ? 'Inativar' : 'Ativar'}
                            >
                              {pkg.isActive ? (
                                <PowerOff className="w-3.5 h-3.5 text-rose-600" />
                              ) : (
                                <Power className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(pkg.id)}
                              className="h-7 w-7 text-[#6B6B6B] hover:text-rose-600"
                              title="Excluir pacote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Package Modal */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-[#171717] flex items-center gap-2">
              <Package className="w-4 h-4 text-[#8A6D36]" />
              {editingPkg ? 'Editar Pacote' : 'Novo Pacote / Assinatura'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Defina valor promocional, prazo de validade e sessões inclusas no combo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-[#171717] font-medium">Nome do Pacote *</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Clube Escova M (4 sessões)"
                className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#171717] font-medium">Valor do Pacote (R$) *</Label>
                <Input
                  required
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="280,00"
                  className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#171717] font-medium">Validade (dias) *</Label>
                <Input
                  required
                  type="number"
                  min={1}
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9 tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#171717] font-medium">Descrição (Opcional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Direito a 4 escovas durante o mês de vigência"
                className="bg-[#FAF9F7] border-[#E5E2DC] rounded-xl h-9"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[#171717] font-medium">Serviços Inclusos</Label>
                {suggestedSum > 0 && (
                  <span className="text-[11px] text-[#6B6B6B] tabular-nums">
                    Soma avulsa: <strong className="text-[#171717]">{formatBRL(suggestedSum)}</strong>
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto border border-[#E5E2DC] rounded-xl divide-y divide-[#E5E2DC] bg-[#FAF9F7]/50">
                {serviceOptions.length === 0 ? (
                  <p className="p-3 text-center text-[#6B6B6B]">Nenhum serviço ativo cadastrado.</p>
                ) : (
                  serviceOptions.map((svc) => {
                    const selected = includedServices.find((i) => i.serviceId === svc.id);
                    return (
                      <div
                        key={svc.id}
                        className="p-2.5 flex items-center justify-between gap-2 bg-white/80"
                      >
                        <button
                          type="button"
                          onClick={() => toggleServiceInPackage(svc)}
                          className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <span
                            className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                              selected
                                ? 'bg-[#171717] border-[#171717] text-white'
                                : 'border-[#D1CCC2] bg-white'
                            )}
                          >
                            {selected && <Check className="w-3 h-3" />}
                          </span>
                          <span className="font-medium text-[#171717] truncate">{svc.name}</span>
                          <span className="text-[11px] text-[#6B6B6B] tabular-nums shrink-0">
                            {formatBRL(svc.price)}
                          </span>
                        </button>
                        {selected && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-[#6B6B6B]">Sessões:</span>
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              value={selected.sessions}
                              onChange={(e) =>
                                updateSessionsCount(svc.id, parseInt(e.target.value, 10))
                              }
                              className="w-14 h-7 text-center text-xs bg-[#FAF9F7] border-[#E5E2DC] tabular-nums"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#171717] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={onlineBookingEnabled}
                onChange={(e) => setOnlineBookingEnabled(e.target.checked)}
                className="rounded border-[#D1CCC2]"
              />
              Exibir este pacote para agendamento/venda online
            </label>

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
                {editingPkg ? 'Salvar Alterações' : 'Cadastrar Pacote'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700">Excluir Pacote?</DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B]">
              Esta ação removerá o pacote permanentemente do catálogo.
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

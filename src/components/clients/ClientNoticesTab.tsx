import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchBar } from '@/components/ui/search-bar';
import { toast } from 'sonner';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Calendar,
  Edit2,
  Info,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import type { Client, ClientNotice, ClientNoticeSeverity } from '@/types';
import { deleteClientNotice, saveClientNotice } from '@/services/clientsService';
import { cn } from '@/lib/utils';

interface ClientNoticesTabProps {
  salonId: string;
  notices: ClientNotice[];
  clients: Client[];
  currentUserId: string;
  currentUserName: string;
}

export const ClientNoticesTab: React.FC<ClientNoticesTabProps> = ({
  salonId,
  notices,
  clients,
  currentUserId,
  currentUserName,
}) => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<ClientNotice | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<ClientNoticeSeverity>('warning');
  const [onSchedule, setOnSchedule] = useState(true);
  const [onComanda, setOnComanda] = useState(true);
  const [targetType, setTargetType] = useState<'clients' | 'tags' | 'all'>('clients');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [clientFilterQuery, setClientFilterQuery] = useState('');

  const activeClients = useMemo(
    () =>
      clients
        .filter((c) => !c.deletedAt && !c.archived && c.status !== 'inactive')
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [clients]
  );

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    activeClients.forEach((c) => {
      (c.tags || []).forEach((t) => {
        if (t.trim()) tagSet.add(t.trim().toLowerCase());
      });
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [activeClients]);

  const filteredNotices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notices;
    return notices.filter(
      (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
    );
  }, [notices, search]);

  const filteredPickerClients = useMemo(() => {
    const q = clientFilterQuery.trim().toLowerCase();
    if (!q) return activeClients.slice(0, 60);
    return activeClients
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
      .slice(0, 60);
  }, [activeClients, clientFilterQuery]);

  const openNewNoticeModal = () => {
    setEditingNotice(null);
    setTitle('');
    setMessage('');
    setSeverity('warning');
    setOnSchedule(true);
    setOnComanda(true);
    setTargetType('clients');
    setSelectedClientIds([]);
    setSelectedTags([]);
    setClientFilterQuery('');
    setModalOpen(true);
  };

  const openEditNoticeModal = (notice: ClientNotice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setMessage(notice.message);
    setSeverity(notice.severity || 'warning');
    setOnSchedule(Boolean(notice.triggers?.onSchedule));
    setOnComanda(Boolean(notice.triggers?.onComanda));
    setTargetType(notice.targetType || 'clients');
    setSelectedClientIds(notice.clientIds || []);
    setSelectedTags(notice.targetTags || []);
    setClientFilterQuery('');
    setModalOpen(true);
  };

  const togglePickerClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  const togglePickerTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId) return;
    if (!title.trim() || !message.trim()) {
      toast.error('Preencha título e mensagem do aviso.');
      return;
    }
    if (!onSchedule && !onComanda) {
      toast.error('Selecione ao menos um evento de disparo (Agenda ou Comanda).');
      return;
    }
    if (targetType === 'clients' && selectedClientIds.length === 0) {
      toast.error('Selecione ao menos um cliente para este aviso.');
      return;
    }
    if (targetType === 'tags' && selectedTags.length === 0) {
      toast.error('Selecione ao menos uma tag/grupo para este aviso.');
      return;
    }

    setSaving(true);
    try {
      await saveClientNotice(salonId, {
        id: editingNotice?.id,
        createdAt: editingNotice?.createdAt,
        title: title.trim(),
        message: message.trim(),
        severity,
        triggers: { onSchedule, onComanda },
        targetType,
        clientIds: targetType === 'clients' ? selectedClientIds : [],
        targetTags: targetType === 'tags' ? selectedTags : [],
        isActive: editingNotice ? editingNotice.isActive : true,
        createdBy: editingNotice?.createdBy || currentUserId,
        createdByName: editingNotice?.createdByName || currentUserName,
      });
      toast.success(editingNotice ? 'Aviso atualizado!' : 'Aviso de atendimento criado!');
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar aviso.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (notice: ClientNotice) => {
    if (!salonId) return;
    try {
      await saveClientNotice(salonId, {
        ...notice,
        isActive: !notice.isActive,
      });
      toast.success(notice.isActive ? 'Aviso pausado.' : 'Aviso reativado.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status do aviso.');
    }
  };

  const handleDelete = async (notice: ClientNotice) => {
    if (!salonId) return;
    if (!window.confirm(`Deseja excluir o aviso "${notice.title}"?`)) return;
    try {
      await deleteClientNotice(salonId, notice.id);
      toast.success('Aviso excluído.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir aviso.');
    }
  };

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clients]);

  return (
    <div className="space-y-4">
      <div className="bg-[#0b0b0d] border border-zinc-800/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#D4AF37]" />
            Avisos Automáticos de Atendimento
          </h3>
          <p className="text-xs text-zinc-400">
            Configure alertas de alergias, restrições financeiras, preferências VIP ou protocolos que aparecem automaticamente quando a recepção seleciona o cliente na Agenda ou na Comanda.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar aviso..."
            className="bg-[#121215] border-zinc-800 text-white w-56"
          />
          <Button
            type="button"
            onClick={openNewNoticeModal}
            className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs h-10 px-4"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar Aviso
          </Button>
        </div>
      </div>

      {filteredNotices.length === 0 ? (
        <div className="bg-[#0b0b0d] border border-zinc-800/80 rounded-2xl py-16 px-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#121215] border border-zinc-800 flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h4 className="text-base font-medium text-zinc-200">
            {search ? 'Nenhum aviso encontrado na busca' : 'Nenhum aviso de atendimento configurado'}
          </h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Crie alertas para que toda a equipe seja avisada instantaneamente ao agendar ou abrir uma comanda para determinados clientes ou grupos.
          </p>
          {!search && (
            <Button
              type="button"
              onClick={openNewNoticeModal}
              className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold text-xs h-9 px-4"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Primeiro Aviso
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-[#0b0b0d] border border-zinc-800/80 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-zinc-300">
              <thead>
                <tr className="bg-[#121215] border-b border-zinc-800 text-zinc-400 font-semibold">
                  <th className="p-4">Título & Nível</th>
                  <th className="p-4">Mensagem de Alerta</th>
                  <th className="p-4">Eventos de Disparo</th>
                  <th className="p-4">Destinatários</th>
                  <th className="p-4">Cadastro</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredNotices.map((notice) => {
                  const Icon =
                    notice.severity === 'critical'
                      ? AlertOctagon
                      : notice.severity === 'info'
                        ? Info
                        : AlertTriangle;
                  const iconColor =
                    notice.severity === 'critical'
                      ? 'text-rose-400'
                      : notice.severity === 'info'
                        ? 'text-[#D4AF37]'
                        : 'text-amber-400';

                  const targetSummary =
                    notice.targetType === 'all'
                      ? 'Todos os clientes'
                      : notice.targetType === 'tags'
                        ? `Tags: ${(notice.targetTags || []).map((t) => `#${t}`).join(', ')}`
                        : (notice.clientIds || []).length === 1
                          ? clientNameMap.get(notice.clientIds[0]) || '1 cliente'
                          : `${(notice.clientIds || []).length} clientes selecionados`;

                  return (
                    <tr
                      key={notice.id}
                      className={cn(
                        'hover:bg-[#121215]/60 transition-colors',
                        !notice.isActive && 'opacity-50'
                      )}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Icon className={cn('w-4 h-4 shrink-0', iconColor)} />
                          <div>
                            <div className="font-semibold text-white">{notice.title}</div>
                            <div className="text-[11px] text-zinc-500">
                              {notice.isActive ? 'Ativo' : 'Pausado'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="text-zinc-300 line-clamp-2">{notice.message}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 text-[11px] text-zinc-300">
                          {notice.triggers?.onSchedule && (
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-[#D4AF37]" /> Na Agenda
                            </span>
                          )}
                          {notice.triggers?.onComanda && (
                            <span className="inline-flex items-center gap-1.5">
                              <Receipt className="w-3 h-3 text-emerald-400" /> Na Comanda
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-zinc-300">{targetSummary}</td>
                      <td className="p-4 text-zinc-400 tabular-nums">
                        {new Date(notice.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(notice)}
                            className="h-8 w-8 text-zinc-400 hover:text-white"
                            title={notice.isActive ? 'Pausar aviso' : 'Ativar aviso'}
                          >
                            {notice.isActive ? (
                              <PauseCircle className="w-4 h-4" />
                            ) : (
                              <PlayCircle className="w-4 h-4 text-emerald-400" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditNoticeModal(notice)}
                            className="h-8 w-8 text-zinc-400 hover:text-[#D4AF37]"
                            title="Editar aviso"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(notice)}
                            className="h-8 w-8 text-zinc-400 hover:text-rose-400"
                            title="Excluir aviso"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Notice Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[680px] bg-[#0c0c0e] border border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-800 bg-[#121215] shrink-0">
            <DialogTitle className="font-heading text-lg font-medium text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#D4AF37]" />
              {editingNotice ? 'Editar Aviso de Atendimento' : 'Adicionar Aviso'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {/* Left side: Title, Message, Severity */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">
                    Título <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Alergia a Amônia / Cliente VIP"
                    className="bg-[#121215] border-zinc-800 text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">
                    Alerta <span className="text-rose-500">*</span>
                  </Label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ex: Utilizar apenas coloração sem amônia. Confirmar teste de mecha antes do procedimento."
                    className="w-full rounded-lg border border-zinc-800 bg-[#121215] p-3 text-sm text-zinc-100 focus:outline-none focus:border-[#D4AF37]/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Nível de Prioridade</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'info', label: 'Informativo' },
                        { id: 'warning', label: 'Atenção' },
                        { id: 'critical', label: 'Crítico' },
                      ] as const
                    ).map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setSeverity(lvl.id)}
                        className={cn(
                          'py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors',
                          severity === lvl.id
                            ? lvl.id === 'critical'
                              ? 'bg-rose-500/15 border-rose-500 text-rose-300'
                              : lvl.id === 'info'
                                ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                                : 'bg-amber-500/15 border-amber-500 text-amber-300'
                            : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right side: Events & Target Selection */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-300">Eventos de Disparo</Label>
                  <div className="space-y-2 bg-[#121215] border border-zinc-800 rounded-xl p-3">
                    <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onSchedule}
                        onChange={(e) => setOnSchedule(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-700 accent-[#D4AF37]"
                      />
                      Ao selecionar na agenda
                    </label>
                    <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onComanda}
                        onChange={(e) => setOnComanda(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-700 accent-[#D4AF37]"
                      />
                      Ao selecionar na comanda
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-zinc-300">Tipo de Destinatário</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'clients', label: 'Clientes' },
                        { id: 'tags', label: 'Grupos / Tags' },
                        { id: 'all', label: 'Todos' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTargetType(opt.id)}
                        className={cn(
                          'py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors',
                          targetType === opt.id
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                            : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {targetType === 'clients' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-zinc-300">
                        Clientes ({selectedClientIds.length} selecionado(s))
                      </Label>
                    </div>
                    <Input
                      value={clientFilterQuery}
                      onChange={(e) => setClientFilterQuery(e.target.value)}
                      placeholder="Filtrar cliente por nome ou telefone..."
                      className="bg-[#121215] border-zinc-800 text-white text-xs h-8"
                    />
                    <div className="max-h-40 overflow-y-auto bg-[#121215] border border-zinc-800 rounded-xl divide-y divide-zinc-800/60">
                      {filteredPickerClients.length === 0 ? (
                        <p className="p-3 text-xs text-zinc-500 text-center">
                          Nenhum cliente encontrado.
                        </p>
                      ) : (
                        filteredPickerClients.map((c) => {
                          const checked = selectedClientIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className="flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-zinc-900/60"
                            >
                              <span className="truncate text-zinc-200">{c.name}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePickerClient(c.id)}
                                className="h-4 w-4 rounded border-zinc-700 accent-[#D4AF37]"
                              />
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {targetType === 'tags' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-300">
                      Grupos / Tags ({selectedTags.length} selecionada(s))
                    </Label>
                    {availableTags.length === 0 ? (
                      <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400">
                        Nenhuma tag encontrada nos clientes cadastrados. Adicione tags nos clientes (ex: #vip, #loira) para usá-las aqui.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 bg-[#121215] border border-zinc-800 rounded-xl p-3 max-h-40 overflow-y-auto">
                        {availableTags.map((tag) => {
                          const selected = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => togglePickerTag(tag)}
                              className={cn(
                                'px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-colors',
                                selected
                                  ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                                  : 'bg-[#0c0c0e] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              )}
                            >
                              #{tag}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {targetType === 'all' && (
                  <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400">
                    Este aviso será exibido para <strong className="text-zinc-200">todos os clientes</strong> selecionados nos eventos marcados acima.
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-800 bg-[#121215] flex justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold px-6"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Salvar Aviso
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

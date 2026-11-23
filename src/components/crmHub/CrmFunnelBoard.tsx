import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  Appointment,
  Client,
  CrmAttendant,
  CrmConversation,
  CrmFunnelStage,
  CrmOpportunity,
  CrmOrigin,
  CrmSettings,
} from '@/types';
import {
  addOpportunityNote,
  CLOSE_REASONS_BY_STAGE,
  createOrOpenConversation,
  deleteOpportunity,
  deleteOpportunityNote,
  FUNNEL_STAGE_META,
  moveOpportunityStage,
  ORIGIN_LABELS,
  requestAiAssistApi,
  updateOpportunityValue,
} from '@/services/crmService';
import { normalizePhoneKey } from '@/services/clientsService';

interface CrmFunnelBoardProps {
  salonId: string;
  currentUserUid: string;
  currentUserName: string;
  canDeleteCards: boolean;
  opportunities: CrmOpportunity[];
  conversations: CrmConversation[];
  clients: Client[];
  appointments: Appointment[];
  attendants: CrmAttendant[];
  settings: CrmSettings;
  selectedOpportunityId: string | null;
  onSelectOpportunity: (id: string | null) => void;
  onJumpToConversation: (conversationId: string) => void;
}

const ORDERED_STAGES: CrmFunnelStage[] = [
  'awaiting_reply',
  'in_service',
  'interested',
  'scheduled',
  'lost',
  'other',
];

function formatMoney(v: number): string {
  return Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWaitShort(ts?: number): string {
  if (!ts) return '';
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function CrmFunnelBoard({
  salonId,
  currentUserUid,
  currentUserName,
  canDeleteCards,
  opportunities,
  conversations,
  clients,
  appointments,
  attendants,
  settings,
  selectedOpportunityId,
  onSelectOpportunity,
  onJumpToConversation,
}: CrmFunnelBoardProps) {
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | CrmOrigin>('all');
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [attendantFilter, setAttendantFilter] = useState<string>('all');
  const [draggedOppId, setDraggedOppId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CrmFunnelStage | null>(null);
  const [mobileStage, setMobileStage] = useState<CrmFunnelStage>('awaiting_reply');

  const [closeModalTarget, setCloseModalTarget] = useState<{
    opportunity: CrmOpportunity;
    targetStage: 'scheduled' | 'lost' | 'other';
  } | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [closeComment, setCloseComment] = useState('');
  const [movingStage, setMovingStage] = useState(false);

  const [detailTab, setDetailTab] = useState<'summary' | 'notes' | 'history'>('summary');
  const [editValueInput, setEditValueInput] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [qualifyingAi, setQualifyingAi] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createOrigin, setCreateOrigin] = useState<CrmOrigin>('attendant');
  const [createStage, setCreateStage] = useState<CrmFunnelStage>('interested');
  const [createService, setCreateService] = useState('');
  const [createValue, setCreateValue] = useState('');
  const [creating, setCreating] = useState(false);

  const clientVisitsByPhone = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach((a) => {
      if (a.isBlock || a.status === 'canceled' || a.status === 'no_show') return;
      const key = normalizePhoneKey(a.clientPhone || '');
      if (key) map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [appointments]);

  const filteredOpps = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400000 : 0;
    return opportunities.filter((o) => {
      if (cutoff > 0 && o.updatedAt < cutoff && o.createdAt < cutoff) return false;
      if (originFilter !== 'all' && o.origin !== originFilter) return false;
      if (attendantFilter !== 'all' && o.assignedAttendantId !== attendantFilter) return false;
      if (q) {
        const hit =
          o.clientName.toLowerCase().includes(q) ||
          o.clientPhone.toLowerCase().includes(q) ||
          String(o.opportunityNumber).includes(q) ||
          (o.serviceInterest || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [opportunities, search, originFilter, periodDays, attendantFilter]);

  const selectedOpp = useMemo(
    () => opportunities.find((o) => o.id === selectedOpportunityId) || null,
    [opportunities, selectedOpportunityId]
  );

  const selectedConv = useMemo(
    () =>
      selectedOpp?.conversationId
        ? conversations.find((c) => c.id === selectedOpp.conversationId) || null
        : null,
    [selectedOpp, conversations]
  );

  const openDetailModal = (opp: CrmOpportunity) => {
    setDetailTab('summary');
    setEditValueInput(String(opp.estimatedValue || 0));
    setNewNoteText('');
    onSelectOpportunity(opp.id);
  };

  const requestStageTransition = async (opp: CrmOpportunity, targetStage: CrmFunnelStage) => {
    if (opp.stage === targetStage) return;
    if (targetStage === 'scheduled' || targetStage === 'lost' || targetStage === 'other') {
      setCloseReason(CLOSE_REASONS_BY_STAGE[targetStage][0] || '');
      setCloseComment('');
      setCloseModalTarget({ opportunity: opp, targetStage });
      return;
    }
    try {
      await moveOpportunityStage(salonId, opp, targetStage, currentUserName, { manual: true });
      toast.success(`Card #${opp.opportunityNumber} movido para ${FUNNEL_STAGE_META[targetStage].label}`);
    } catch {
      toast.error('Erro ao mover card.');
    }
  };

  const confirmCloseTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeModalTarget) return;
    setMovingStage(true);
    try {
      await moveOpportunityStage(
        salonId,
        closeModalTarget.opportunity,
        closeModalTarget.targetStage,
        currentUserName,
        {
          closeReason: closeReason.trim(),
          closeComment: closeComment.trim(),
          manual: true,
        }
      );
      toast.success(
        `Oportunidade #${closeModalTarget.opportunity.opportunityNumber} marcada como ${FUNNEL_STAGE_META[closeModalTarget.targetStage].label}.`
      );
      setCloseModalTarget(null);
    } catch {
      toast.error('Erro ao fechar oportunidade.');
    } finally {
      setMovingStage(false);
    }
  };

  const handleSaveDetailValue = async () => {
    if (!selectedOpp) return;
    setSavingDetail(true);
    try {
      const parsed = Math.max(0, Number(editValueInput.replace(',', '.')) || 0);
      await updateOpportunityValue(salonId, selectedOpp, parsed, currentUserName);
      toast.success('Valor atualizado!');
    } catch {
      toast.error('Erro ao atualizar valor.');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp || !newNoteText.trim()) return;
    setSavingDetail(true);
    try {
      await addOpportunityNote(
        salonId,
        selectedOpp,
        newNoteText.trim(),
        currentUserUid,
        currentUserName
      );
      setNewNoteText('');
      toast.success('Nota registrada!');
    } catch {
      toast.error('Erro ao salvar nota.');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleAiQualifyOpportunity = async () => {
    if (!selectedOpp) return;
    setQualifyingAi(true);
    try {
      const transcript = selectedConv?.lastMessageText
        ? [{ direction: 'inbound' as const, body: selectedConv.lastMessageText }]
        : [
            {
              direction: 'inbound' as const,
              body: selectedOpp.serviceInterest || 'Interesse em atendimento no salão.',
            },
          ];
      const res = await requestAiAssistApi({
        salonId,
        clientName: selectedOpp.clientName,
        clientVisitsCount: clientVisitsByPhone.get(normalizePhoneKey(selectedOpp.clientPhone)) || 0,
        action: 'qualify_opportunity',
        transcript,
        tone: settings.aiConfig.tone,
        customInstructions: settings.aiConfig.qualificationInstructions,
        opportunityId: selectedOpp.id,
      });
      setEditValueInput(String(res.estimatedValue || 0));
      toast.success('Lumi IA qualificou o interesse e atualizou a estimativa!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao qualificar com Lumi IA.');
    } finally {
      setQualifyingAi(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedOpp) return;
    try {
      await deleteOpportunity(salonId, selectedOpp.id);
      onSelectOpportunity(null);
      toast.success('Oportunidade excluída.');
    } catch {
      toast.error('Permissão insuficiente ou erro ao excluir card.');
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createPhone.trim()) return;
    setCreating(true);
    try {
      const matchedClient = clients.find(
        (c) => normalizePhoneKey(c.phone) === normalizePhoneKey(createPhone)
      );
      await createOrOpenConversation({
        salonId,
        client: matchedClient,
        name: createName.trim(),
        phone: createPhone.trim(),
        origin: createOrigin,
        initialStage: createStage,
        estimatedValue: Math.max(0, Number(createValue.replace(',', '.')) || 0),
        serviceInterest: createService.trim(),
        attendantId: currentUserUid,
        attendantName: currentUserName,
      });
      setIsCreateOpen(false);
      setCreateName('');
      setCreatePhone('');
      setCreateService('');
      setCreateValue('');
      toast.success('Oportunidade adicionada ao funil!');
    } catch {
      toast.error('Erro ao criar oportunidade.');
    } finally {
      setCreating(false);
    }
  };

  const totalOppsCount = filteredOpps.length;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:flex-1 sm:min-w-[260px]">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, telefone, #número ou serviço..."
              className="pl-8 h-9 text-xs bg-background border-border"
            />
          </div>

          <select
            aria-label="Filtrar por origem"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as 'all' | CrmOrigin)}
            className="h-9 flex-1 sm:flex-initial min-w-[130px] rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
          >
            <option value="all">Todas as origens</option>
            <option value="receptivo">Receptivo</option>
            <option value="confirmacao">Confirmação</option>
            <option value="marketing">Marketing</option>
            <option value="attendant">Atendente</option>
          </select>

          <select
            aria-label="Filtrar por período"
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="h-9 flex-1 sm:flex-initial min-w-[130px] rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={0}>Todo o período</option>
          </select>

          <select
            aria-label="Filtrar por atendente"
            value={attendantFilter}
            onChange={(e) => setAttendantFilter(e.target.value)}
            className="h-9 w-full sm:w-auto sm:flex-initial rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
          >
            <option value="all">Todos os atendentes</option>
            {attendants.map((a) => (
              <option key={a.id} value={a.userId || a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="h-9 w-full sm:w-auto px-3.5 bg-[#171717] hover:bg-[#2A2A2A] text-white text-xs font-medium rounded-lg gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Nova oportunidade
        </Button>
      </div>

      {/* Mobile Stage Selector Strip */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {ORDERED_STAGES.map((stageId) => {
          const meta = FUNNEL_STAGE_META[stageId];
          const count = filteredOpps.filter((o) => o.stage === stageId).length;
          const isActive = mobileStage === stageId;
          return (
            <button
              key={stageId}
              type="button"
              onClick={() => setMobileStage(stageId)}
              className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                isActive
                  ? 'bg-[#171717] text-white border-[#171717]'
                  : 'bg-card text-foreground border-border'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: meta.dotColor }}
              />
              <span>{meta.shortLabel}</span>
              <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/15 text-white' : 'bg-secondary text-muted-foreground'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="md:overflow-x-auto pb-2">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:min-w-[1180px]">
          {ORDERED_STAGES.map((stageId) => {
            const meta = FUNNEL_STAGE_META[stageId];
            const columnOpps = filteredOpps.filter((o) => o.stage === stageId);
            const columnRevenue = columnOpps.reduce(
              (acc, o) => acc + Number(o.estimatedValue || 0),
              0
            );
            const columnPct =
              totalOppsCount > 0 ? Math.round((columnOpps.length / totalOppsCount) * 100) : 0;

            return (
              <div
                key={stageId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stageId);
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  const id = draggedOppId || e.dataTransfer.getData('text/plain');
                  const opp = opportunities.find((o) => o.id === id);
                  if (opp) void requestStageTransition(opp, stageId);
                  setDraggedOppId(null);
                }}
                className={`rounded-xl border transition-colors flex-col min-h-[420px] md:min-h-[540px] ${
                  mobileStage === stageId ? 'flex' : 'hidden md:flex'
                } ${
                  dragOverStage === stageId
                    ? 'border-[#B89B5E] bg-[#F5F1E9]/60'
                    : 'border-border bg-secondary/45'
                }`}
              >
                <div className="p-3 bg-card rounded-t-xl border-b border-border space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: meta.dotColor }}
                      />
                      <span className="text-xs font-semibold text-foreground truncate">
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {columnOpps.length} ({columnPct}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    R$ {formatMoney(columnRevenue)}
                  </p>
                </div>

                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[620px]">
                  {columnOpps.length === 0 ? (
                    <div className="py-10 text-center text-[11px] text-muted-foreground">
                      Nenhuma oportunidade nesta etapa
                    </div>
                  ) : (
                    columnOpps.map((opp) => {
                      const visits =
                        clientVisitsByPhone.get(normalizePhoneKey(opp.clientPhone)) || 0;
                      const waitingHours = opp.waitingSince
                        ? (Date.now() - opp.waitingSince) / 3600000
                        : 0;
                      const isOverdue =
                        stageId === 'awaiting_reply' &&
                        waitingHours >= settings.funnelRules.awaitingReplyAlertHours;

                      return (
                        <div
                          key={opp.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedOppId(opp.id);
                            e.dataTransfer.setData('text/plain', opp.id);
                          }}
                          onClick={() => openDetailModal(opp)}
                          className="bg-card border border-border hover:border-[#B89B5E]/70 rounded-xl p-3 space-y-2 cursor-pointer transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-foreground block truncate">
                                {opp.clientName}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                #{opp.opportunityNumber} · {ORIGIN_LABELS[opp.origin]}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-foreground tabular-nums shrink-0">
                              {opp.valueSource === 'ai' && opp.estimatedValue > 0 ? '≈ ' : ''}
                              R$ {formatMoney(opp.estimatedValue)}
                            </span>
                          </div>

                          {opp.serviceInterest && (
                            <p className="text-[11px] text-foreground truncate">
                              {opp.serviceInterest}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground">
                            <span>
                              {visits > 0 ? `Já é cliente · ${visits} visitas` : 'Novo contato'}
                              {opp.isRescheduled ? ' · Remarcada' : ''}
                            </span>
                            {opp.waitingSince ? (
                              <span
                                className={`tabular-nums font-medium ${
                                  isOverdue ? 'text-rose-700' : 'text-amber-700'
                                }`}
                              >
                                espera {formatWaitShort(opp.waitingSince)}
                              </span>
                            ) : (
                              <span>{opp.assignedAttendantName || 'Sem atendente'}</span>
                            )}
                          </div>

                          {opp.linkedAppointmentDate && (
                            <div className="pt-1.5 border-t border-border/70 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium tabular-nums">
                              <CalendarCheck className="w-3.5 h-3.5" />
                              {opp.linkedAppointmentDate.split('-').reverse().join('/')} às{' '}
                              {opp.linkedAppointmentTime}
                            </div>
                          )}

                          {/* Quick 1-tap stage switcher for touchscreens */}
                          <div
                            className="md:hidden pt-1.5 border-t border-border/60 flex items-center justify-between gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] text-muted-foreground font-medium">Mover etapa:</span>
                            <select
                              aria-label={`Mover etapa de ${opp.clientName}`}
                              value={opp.stage}
                              onChange={(e) => {
                                const nextStage = e.target.value as CrmFunnelStage;
                                void requestStageTransition(opp, nextStage);
                              }}
                              className="h-7 rounded-md border border-border bg-secondary px-2 text-[11px] text-foreground"
                            >
                              {ORDERED_STAGES.map((st) => (
                                <option key={st} value={st}>
                                  {FUNNEL_STAGE_META[st].shortLabel}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedOpp)}
        onOpenChange={(open) => {
          if (!open) onSelectOpportunity(null);
        }}
      >
        <DialogContent className="sm:max-w-xl bg-card border-border">
          {selectedOpp && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 pr-6">
                  <div>
                    <DialogTitle className="text-foreground flex items-center gap-2">
                      <span>{selectedOpp.clientName}</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        #{selectedOpp.opportunityNumber}
                      </span>
                    </DialogTitle>
                    <DialogDescription className="tabular-nums mt-1">
                      {selectedOpp.clientPhone} · Origem: {ORIGIN_LABELS[selectedOpp.origin]} ·
                      Responsável: {selectedOpp.assignedAttendantName || 'Não atribuído'}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex items-center gap-1 border-b border-border pb-2">
                {(
                  [
                    { id: 'summary', label: 'Resumo & Ações' },
                    { id: 'notes', label: `Notas (${selectedOpp.notes?.length || 0})` },
                    { id: 'history', label: `Histórico (${selectedOpp.history?.length || 0})` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDetailTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      detailTab === t.id
                        ? 'bg-[#F5F1E9] text-[#8A6D36] border border-[#D8C79F]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {detailTab === 'summary' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Etapa do Funil</Label>
                      <select
                        value={selectedOpp.stage}
                        onChange={(e) =>
                          void requestStageTransition(selectedOpp, e.target.value as CrmFunnelStage)
                        }
                        className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                      >
                        {ORDERED_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {FUNNEL_STAGE_META[st].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs">Valor estimado (R$)</Label>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Input
                          value={editValueInput}
                          onChange={(e) => setEditValueInput(e.target.value)}
                          className="h-9 text-xs tabular-nums"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={savingDetail}
                          onClick={handleSaveDetailValue}
                          className="h-9 px-3 text-xs"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {selectedConv?.lastMessageText && (
                    <div className="p-3 rounded-xl bg-secondary/60 border border-border space-y-1">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                        Última mensagem na conversa
                      </span>
                      <p className="text-xs text-foreground">{selectedConv.lastMessageText}</p>
                    </div>
                  )}

                  {selectedOpp.closeReason && (
                    <div className="p-3 rounded-xl bg-secondary/60 border border-border text-xs">
                      <span className="font-semibold text-foreground">
                        Motivo do encerramento: {selectedOpp.closeReason}
                      </span>
                      {selectedOpp.closeComment && (
                        <p className="text-muted-foreground mt-1">{selectedOpp.closeComment}</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedOpp.conversationId && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const convId = selectedOpp.conversationId!;
                            onSelectOpportunity(null);
                            onJumpToConversation(convId);
                          }}
                          className="h-8 text-xs bg-[#171717] text-white gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Abrir no Inbox WhatsApp
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={qualifyingAi}
                        onClick={handleAiQualifyOpportunity}
                        className="h-8 text-xs border-[#D8C79F] bg-[#F5F1E9] text-[#7A5E29] gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {qualifyingAi ? 'Qualificando...' : 'Qualificar ticket com Lumi IA'}
                      </Button>
                    </div>

                    {canDeleteCards && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleDeleteCard}
                        className="h-8 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'notes' && (
                <div className="space-y-3">
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <Textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      rows={2}
                      placeholder="Registre um detalhe interno sobre este atendimento..."
                      className="text-xs"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={savingDetail || !newNoteText.trim()}>
                        Adicionar nota
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(selectedOpp.notes || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Nenhuma nota registrada ainda.
                      </p>
                    ) : (
                      [...(selectedOpp.notes || [])]
                        .sort((a, b) => b.createdAt - a.createdAt)
                        .map((note) => (
                          <div
                            key={note.id}
                            className="p-2.5 rounded-lg bg-secondary/60 border border-border text-xs flex items-start justify-between gap-2"
                          >
                            <div>
                              <p className="text-foreground">{note.text}</p>
                              <span className="text-[10px] text-muted-foreground">
                                {note.authorName} ·{' '}
                                {new Date(note.createdAt).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteOpportunityNote(salonId, selectedOpp, note.id)}
                              className="text-muted-foreground hover:text-rose-700 p-1"
                              title="Remover nota"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'history' && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(selectedOpp.history || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Sem eventos registrados no histórico.
                    </p>
                  ) : (
                    [...(selectedOpp.history || [])]
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((entry) => (
                        <div
                          key={entry.id}
                          className="p-2.5 rounded-lg bg-secondary/50 border border-border text-xs flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-medium text-foreground">{entry.detail}</p>
                            <span className="text-[10px] text-muted-foreground">
                              Por {entry.actorName}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {new Date(entry.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(closeModalTarget)}
        onOpenChange={(open) => {
          if (!open) setCloseModalTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border-border">
          {closeModalTarget && (
            <form onSubmit={confirmCloseTransition} className="space-y-3">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  Mover para {FUNNEL_STAGE_META[closeModalTarget.targetStage].label}
                </DialogTitle>
                <DialogDescription>
                  Informe o motivo estruturado para alimentar os painéis de conversão e perda do funil.
                </DialogDescription>
              </DialogHeader>

              <div>
                <Label className="text-xs">Motivo *</Label>
                <select
                  required
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                >
                  {CLOSE_REASONS_BY_STAGE[closeModalTarget.targetStage].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Comentário (opcional)</Label>
                <Textarea
                  value={closeComment}
                  onChange={(e) => setCloseComment(e.target.value)}
                  rows={2}
                  placeholder="Detalhes adicionais sobre o resultado..."
                  className="mt-1 text-xs"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCloseModalTarget(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={movingStage}>
                  {movingStage ? 'Salvando...' : 'Confirmar etapa'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova oportunidade no funil</DialogTitle>
            <DialogDescription>
              Cria o card comercial vinculado automaticamente a uma conversa no Inbox WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOpportunity} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Nome do cliente"
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">WhatsApp *</Label>
                <Input
                  required
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Etapa inicial</Label>
                <select
                  value={createStage}
                  onChange={(e) => setCreateStage(e.target.value as CrmFunnelStage)}
                  className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                >
                  {ORDERED_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {FUNNEL_STAGE_META[st].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Origem</Label>
                <select
                  value={createOrigin}
                  onChange={(e) => setCreateOrigin(e.target.value as CrmOrigin)}
                  className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                >
                  <option value="attendant">Atendente</option>
                  <option value="receptivo">Receptivo</option>
                  <option value="confirmacao">Confirmação</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Serviço desejado</Label>
                <Input
                  value={createService}
                  onChange={(e) => setCreateService(e.target.value)}
                  placeholder="Ex.: Harmonização, Corte..."
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Valor estimado (R$)</Label>
                <Input
                  value={createValue}
                  onChange={(e) => setCreateValue(e.target.value)}
                  placeholder="0,00"
                  className="mt-1 h-9 text-xs tabular-nums"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Criando...' : 'Criar oportunidade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

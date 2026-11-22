import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Calendar,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  PauseCircle,
  Pin,
  PlayCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  Zap,
} from 'lucide-react';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
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
  CrmMessage,
  CrmOpportunity,
  CrmOrigin,
  CrmQuickReply,
  CrmSettings,
} from '@/types';
import {
  assumeConversation,
  createOrOpenConversation,
  FUNNEL_STAGE_META,
  linkConversationClient,
  markConversationRead,
  moveOpportunityStage,
  ORIGIN_LABELS,
  requestAiAssistApi,
  returnConversationToAi,
  sendCrmMessageApi,
  subscribeCrmMessages,
  toggleClientAiPause,
  toggleConversationPin,
} from '@/services/crmService';
import { formatWhatsAppHref, normalizePhoneKey } from '@/services/clientsService';

interface CrmInboxViewProps {
  salonId: string;
  salonName: string;
  currentUserUid: string;
  currentUserName: string;
  conversations: CrmConversation[];
  opportunities: CrmOpportunity[];
  clients: Client[];
  appointments: Appointment[];
  quickReplies: CrmQuickReply[];
  attendants: CrmAttendant[];
  settings: CrmSettings;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onOpenClientDrawer: (client: Client) => void;
  onOpenOpportunityModal: (opportunityId: string) => void;
}

type OwnershipTab = 'all' | 'mine' | 'unassigned';
type StatusFilter = 'all' | 'handoff' | 'ai' | 'unread';

function formatRelativeTime(ts?: number): string {
  if (!ts) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatMessageTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatWaitDuration(ts?: number): string {
  if (!ts) return '0 min';
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function CrmInboxView({
  salonId,
  salonName,
  currentUserUid,
  currentUserName,
  conversations,
  opportunities,
  clients,
  appointments,
  quickReplies,
  attendants,
  settings,
  selectedConversationId,
  onSelectConversation,
  onOpenClientDrawer,
  onOpenOpportunityModal,
}: CrmInboxViewProps) {
  const [search, setSearch] = useState('');
  const [ownershipTab, setOwnershipTab] = useState<OwnershipTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastWaLink, setLastWaLink] = useState<string | null>(null);
  const [useSignature, setUseSignature] = useState(settings.teamRules.requireSignature);
  const [showContextPanel, setShowContextPanel] = useState(true);

  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<{
    detectedService: string;
    estimatedValue: number;
    intentSummary: string;
  } | null>(null);

  // Quick note inline save inside Client Context Panel
  const [editingClientNote, setEditingClientNote] = useState('');
  const [savingClientNote, setSavingClientNote] = useState(false);

  // New conversation dialog
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatClientId, setNewChatClientId] = useState<string>('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatOrigin, setNewChatOrigin] = useState<CrmOrigin>('attendant');
  const [newChatService, setNewChatService] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);

  // Inline client registration from unlinked WhatsApp number
  const [isRegisterClientOpen, setIsRegisterClientOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [registeringClient, setRegisteringClient] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentAttendant = useMemo(
    () => attendants.find((a) => a.userId === currentUserUid || a.id === currentUserUid),
    [attendants, currentUserUid]
  );

  useEffect(() => {
    setUseSignature(
      currentAttendant ? currentAttendant.useSignature : settings.teamRules.requireSignature
    );
  }, [currentAttendant, settings.teamRules.requireSignature]);

  const oppMap = useMemo(() => {
    const map = new Map<string, CrmOpportunity>();
    opportunities.forEach((o) => map.set(o.id, o));
    return map;
  }, [opportunities]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (settings.teamRules.privateConversations && currentAttendant?.permission !== 'admin') {
        if (
          conv.assignedAttendantId &&
          conv.assignedAttendantId !== currentUserUid &&
          conv.assignedAttendantId !== currentAttendant?.id
        ) {
          return false;
        }
      }
      if (ownershipTab === 'mine') {
        const isMine =
          conv.assignedAttendantId === currentUserUid ||
          (currentAttendant && conv.assignedAttendantId === currentAttendant.id);
        if (!isMine) return false;
      } else if (ownershipTab === 'unassigned') {
        if (conv.assignedAttendantId) return false;
      }

      if (statusFilter === 'handoff' && conv.handlingMode !== 'handoff') return false;
      if (statusFilter === 'ai' && conv.handlingMode !== 'ai') return false;
      if (statusFilter === 'unread' && conv.unreadCount <= 0) return false;

      if (q) {
        const matchName = conv.clientName.toLowerCase().includes(q);
        const matchPhone = conv.clientPhone.toLowerCase().includes(q);
        const matchPreview = (conv.lastMessageText || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchPreview) return false;
      }
      return true;
    });
  }, [
    conversations,
    search,
    ownershipTab,
    statusFilter,
    currentUserUid,
    currentAttendant,
    settings.teamRules.privateConversations,
  ]);

  const activeConversation = useMemo(
    () =>
      conversations.find((c) => c.id === selectedConversationId) ||
      filteredConversations[0] ||
      null,
    [conversations, filteredConversations, selectedConversationId]
  );

  const activeOpportunity = useMemo(() => {
    if (!activeConversation) return undefined;
    if (activeConversation.opportunityId) {
      return oppMap.get(activeConversation.opportunityId);
    }
    return opportunities.find((o) => o.conversationId === activeConversation.id);
  }, [activeConversation, oppMap, opportunities]);

  const linkedClient = useMemo(() => {
    if (!activeConversation) return null;
    if (activeConversation.clientId) {
      const byId = clients.find((c) => c.id === activeConversation.clientId);
      if (byId) return byId;
    }
    const phoneKey = normalizePhoneKey(activeConversation.clientPhone);
    if (!phoneKey) return null;
    return clients.find((c) => normalizePhoneKey(c.phone) === phoneKey) || null;
  }, [activeConversation, clients]);

  useEffect(() => {
    setEditingClientNote(linkedClient?.notes || '');
  }, [linkedClient?.id, linkedClient?.notes]);

  const clientAppointments = useMemo(() => {
    if (!linkedClient) return { upcoming: [] as Appointment[], past: [] as Appointment[], visitsLast3Months: 0 };
    const todayYmd = new Date().toISOString().slice(0, 10);
    const threeMonthsAgoYmd = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const mine = appointments.filter(
      (a) =>
        !a.isBlock &&
        (a.clientId === linkedClient.id ||
          (linkedClient.phone && normalizePhoneKey(a.clientPhone) === normalizePhoneKey(linkedClient.phone)))
    );

    const upcoming = mine
      .filter((a) => a.date >= todayYmd && a.status !== 'canceled' && a.status !== 'no_show')
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    const past = mine
      .filter((a) => a.date < todayYmd || a.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

    const visitsLast3Months = mine.filter(
      (a) => a.date >= threeMonthsAgoYmd && a.date <= todayYmd && a.status !== 'canceled' && a.status !== 'no_show'
    ).length;

    return { upcoming, past, visitsLast3Months };
  }, [linkedClient, appointments]);

  // Subscribe messages of active conversation
  useEffect(() => {
    if (!salonId || !activeConversation) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setLastWaLink(null);
    setAiNotice(null);
    setAiRecommendation(null);
    const unsub = subscribeCrmMessages(
      salonId,
      activeConversation.id,
      (list) => {
        setMessages(list);
        setLoadingMessages(false);
      },
      () => setLoadingMessages(false)
    );
    if (activeConversation.unreadCount > 0) {
      markConversationRead(salonId, activeConversation.id).catch(() => {});
    }
    return () => unsub();
  }, [salonId, activeConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConversation?.id]);

  // Quick reply "/" autocomplete matching
  const slashFilter = useMemo(() => {
    if (!composerText.startsWith('/')) return null;
    const term = composerText.slice(1).split(/\s/)[0].toLowerCase();
    return quickReplies.filter(
      (qr) =>
        qr.shortcut.toLowerCase().includes(term) ||
        qr.title.toLowerCase().includes(term)
    );
  }, [composerText, quickReplies]);

  const applyQuickReply = (qr: CrmQuickReply) => {
    const firstName = activeConversation?.clientName.split(/\s+/)[0] || 'Cliente';
    const hydrated = qr.body
      .replace(/\{cliente\}/g, firstName)
      .replace(/\{salao\}/g, salonName || 'Nosso Salão');
    setComposerText(hydrated);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConversation || !composerText.trim() || sending) return;
    const text = composerText.trim();
    setSending(true);
    setLastWaLink(null);
    try {
      const result = await sendCrmMessageApi({
        salonId,
        conversation: activeConversation,
        body: text,
        attendantId: currentUserUid,
        attendantName: currentUserName,
        useSignature,
        senderType: 'attendant',
      });
      setComposerText('');
      if (result.sentViaCloudApi) {
        toast.success('Mensagem enviada via WhatsApp Business!');
      } else {
        setLastWaLink(result.waLink);
        toast.success('Registrada no chat! Clique no botão para abrir no WhatsApp Web.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleAiAssist = async (action: 'suggest_reply' | 'recovery_draft') => {
    if (!activeConversation) return;
    setAiSuggesting(true);
    setAiNotice(null);
    try {
      const transcript = messages.slice(-14).map((m) => ({
        direction: m.direction,
        body: m.body,
      }));
      const res = await requestAiAssistApi({
        salonId,
        clientName: activeConversation.clientName,
        clientVisitsCount: clientAppointments.visitsLast3Months,
        action,
        transcript,
        tone: settings.aiConfig.tone,
        customInstructions: settings.aiConfig.qualificationInstructions,
        opportunityId: activeOpportunity?.id,
      });
      setComposerText(res.suggestedReply);
      setAiRecommendation({
        detectedService: res.detectedService,
        estimatedValue: res.estimatedValue,
        intentSummary: res.intentSummary,
      });
      toast.success('Lumi IA preparou uma sugestão personalizada.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na Lumi IA.';
      setAiNotice(msg);
      toast.error(msg);
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleAssumeOrReturnAi = async () => {
    if (!activeConversation) return;
    try {
      if (activeConversation.handlingMode === 'ai') {
        await assumeConversation(salonId, activeConversation, currentUserUid, currentUserName);
        toast.success('Atendimento assumido por você.');
      } else {
        await returnConversationToAi(salonId, activeConversation, currentUserName);
        toast.success('Conversa devolvida para a Lumi IA.');
      }
    } catch {
      toast.error('Não foi possível alterar o modo de atendimento.');
    }
  };

  const handleToggleAiPause = async () => {
    if (!activeConversation) return;
    const next = !activeConversation.aiPausedForClient;
    try {
      await toggleClientAiPause(salonId, activeConversation.id, next);
      toast.success(next ? 'IA pausada para este cliente.' : 'IA reativada para este cliente.');
    } catch {
      toast.error('Erro ao alterar status da IA.');
    }
  };

  const handleTogglePin = async (conv: CrmConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleConversationPin(salonId, conv.id, !conv.isPinned);
    } catch {
      toast.error('Erro ao fixar conversa.');
    }
  };

  const handleSaveClientNote = async () => {
    if (!linkedClient) return;
    setSavingClientNote(true);
    try {
      await updateDoc(doc(db, `salons/${salonId}/clients`, linkedClient.id), {
        notes: editingClientNote.trim(),
        updatedAt: Date.now(),
      });
      toast.success('Observação do cliente salva.');
    } catch {
      toast.error('Erro ao salvar observação.');
    } finally {
      setSavingClientNote(false);
    }
  };

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatName.trim() || !newChatPhone.trim()) {
      toast.error('Informe nome e WhatsApp do contato.');
      return;
    }
    setCreatingChat(true);
    try {
      const pickedClient = clients.find((c) => c.id === newChatClientId) || null;
      const { conversationId } = await createOrOpenConversation({
        salonId,
        client: pickedClient,
        name: newChatName.trim(),
        phone: newChatPhone.trim(),
        origin: newChatOrigin,
        serviceInterest: newChatService.trim(),
        attendantId: currentUserUid,
        attendantName: currentUserName,
        initialMessage: newChatMessage.trim(),
      });
      setIsNewChatOpen(false);
      setNewChatClientId('');
      setNewChatName('');
      setNewChatPhone('');
      setNewChatService('');
      setNewChatMessage('');
      onSelectConversation(conversationId);
      toast.success('Conversa iniciada no Inbox!');
    } catch {
      toast.error('Erro ao criar conversa.');
    } finally {
      setCreatingChat(false);
    }
  };

  const handleRegisterAndLinkClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !regName.trim() || !regPhone.trim()) return;
    setRegisteringClient(true);
    try {
      const ref = doc(collection(db, `salons/${salonId}/clients`));
      const now = Date.now();
      const newClient: Client = {
        id: ref.id,
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        birthDate: regBirthDate.trim(),
        crmStage: 'in_service',
        source: 'whatsapp',
        status: 'active',
        archived: false,
        tags: ['WhatsApp CRM'],
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(ref, newClient);
      await linkConversationClient(salonId, activeConversation.id, newClient, activeOpportunity?.id);
      setIsRegisterClientOpen(false);
      toast.success('Cliente cadastrado na base e vinculado ao atendimento!');
    } catch {
      toast.error('Erro ao cadastrar cliente.');
    } finally {
      setRegisteringClient(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px] lg:h-[calc(100vh-220px)]">
      {/* COLUNA 1: LISTA DE CONVERSAS */}
      <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-border flex flex-col bg-secondary/40 min-h-[300px] lg:min-h-0">
        <div className="p-3.5 border-b border-border space-y-3 bg-card">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">Conversas</h3>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {filteredConversations.length} ativas ·{' '}
                {conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? 1 : 0), 0)} não lidas
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsNewChatOpen(true)}
              className="h-8 px-2.5 bg-foreground hover:bg-foreground/90 text-background text-xs font-medium rounded-lg gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Nova
            </Button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente ou telefone..."
              className="pl-8 h-8 text-xs bg-background border-border"
            />
          </div>

          {/* Ownership Segmented Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-secondary p-1 rounded-lg border border-border">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'mine', label: 'Minhas' },
                { id: 'unassigned', label: 'Livres' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOwnershipTab(tab.id)}
                className={`py-1 px-2 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  ownershipTab === tab.id
                    ? 'bg-card text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Compact Status Filter */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'all', label: 'Tudo' },
                { id: 'handoff', label: 'Transbordo IA' },
                { id: 'ai', label: 'Lumi IA' },
                { id: 'unread', label: 'Não lidas' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  statusFilter === f.id
                    ? 'bg-[#F5F1E9] text-[#8A6D36] border-[#D8C79F]'
                    : 'bg-transparent text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/70">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <MessageSquare className="w-7 h-7 text-muted-foreground/50 mx-auto" />
              <p className="text-xs font-medium text-foreground">Nenhuma conversa nesta visão</p>
              <p className="text-[11px] text-muted-foreground">
                Mensagens recebidas via WhatsApp aparecem aqui automaticamente ou inicie uma nova conversa.
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id;
              const opp = conv.opportunityId ? oppMap.get(conv.opportunityId) : undefined;
              const stageMeta = opp ? FUNNEL_STAGE_META[opp.stage] : null;
              return (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectConversation(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectConversation(conv.id);
                  }}
                  className={`p-3 cursor-pointer transition-colors flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-card shadow-[inset_3px_0_0_#B89B5E]'
                      : 'hover:bg-card/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#F5F1E9] border border-[#E5DCC8] text-[#8A6D36] flex items-center justify-center text-xs font-semibold shrink-0">
                        {conv.clientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {conv.clientName}
                          </span>
                          {conv.isPinned && (
                            <Pin className="w-3 h-3 text-[#9F844A] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate tabular-nums">
                          {conv.clientPhone}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-md bg-[#171717] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                            {conv.unreadCount}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(conv, e)}
                          title={conv.isPinned ? 'Desafixar conversa' : 'Fixar no topo'}
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                        >
                          <Pin className={`w-3 h-3 ${conv.isPinned ? 'text-[#9F844A]' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground truncate">
                    {conv.lastMessageText || 'Sem mensagens'}
                  </p>

                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      {conv.handlingMode === 'ai' ? (
                        <>
                          <Bot className="w-3 h-3 text-[#9F844A]" /> Lumi IA
                        </>
                      ) : conv.handlingMode === 'handoff' ? (
                        <>
                          <Zap className="w-3 h-3 text-amber-600" /> Transbordo IA
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3 text-emerald-700" />{' '}
                          {conv.assignedAttendantName || 'Equipe'}
                        </>
                      )}
                      {stageMeta ? ` · ${stageMeta.shortLabel}` : ''}
                    </span>
                    {conv.status === 'awaiting_reply' && conv.lastInboundAt && (
                      <span className="text-amber-700 font-medium tabular-nums shrink-0">
                        espera {formatWaitDuration(conv.lastInboundAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUNA 2: THREAD DO WHATSAPP + COPILOTO LUMI IA */}
      <div
        className={`${
          showContextPanel ? 'lg:col-span-6' : 'lg:col-span-9'
        } flex flex-col bg-background min-h-[420px] lg:min-h-0`}
      >
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#9F844A]" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">
              Selecione ou inicie um atendimento
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Todas as mensagens recebidas pelo webhook do WhatsApp e atendimentos da equipe são sincronizados em tempo real neste Inbox 360°.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsNewChatOpen(true)}
              className="bg-foreground text-background hover:bg-foreground/90 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Iniciar conversa WhatsApp
            </Button>
          </div>
        ) : (
          <>
            {/* Header da conversa ativa */}
            <div className="px-4 py-3 bg-card border-b border-border flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {activeConversation.clientName}
                  </h3>
                  {activeOpportunity && (
                    <button
                      type="button"
                      onClick={() => onOpenOpportunityModal(activeOpportunity.id)}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-border bg-secondary hover:bg-accent text-foreground tabular-nums cursor-pointer"
                    >
                      #{activeOpportunity.opportunityNumber} ·{' '}
                      {FUNNEL_STAGE_META[activeOpportunity.stage]?.shortLabel}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 tabular-nums">
                  <span>{activeConversation.clientPhone}</span>
                  <span>·</span>
                  <span>Origem: {ORIGIN_LABELS[activeConversation.origin] || 'Receptivo'}</span>
                  {activeConversation.assignedAttendantName && (
                    <>
                      <span>·</span>
                      <span>Atendente: {activeConversation.assignedAttendantName}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {activeOpportunity && (
                  <select
                    aria-label="Etapa no funil"
                    value={activeOpportunity.stage}
                    onChange={(e) =>
                      moveOpportunityStage(
                        salonId,
                        activeOpportunity,
                        e.target.value as CrmFunnelStage,
                        currentUserName
                      )
                        .then(() => toast.success('Etapa atualizada!'))
                        .catch(() => toast.error('Erro ao mover etapa.'))
                    }
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {Object.values(FUNNEL_STAGE_META).map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleAiPause}
                  className="h-8 px-2.5 text-xs border-border gap-1"
                  title={
                    activeConversation.aiPausedForClient
                      ? 'Reativar Lumi IA para este cliente'
                      : 'Pausar Lumi IA para este cliente'
                  }
                >
                  {activeConversation.aiPausedForClient ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-emerald-700" /> Reativar IA
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-amber-700" /> Pausar IA
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAssumeOrReturnAi}
                  className="h-8 px-2.5 text-xs border-border gap-1"
                >
                  {activeConversation.handlingMode === 'ai' ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-[#9F844A]" /> Assumir
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 text-[#9F844A]" /> Devolver à IA
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowContextPanel((v) => !v)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title={showContextPanel ? 'Ocultar painel do cliente' : 'Exibir painel do cliente'}
                >
                  {showContextPanel ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Stream de mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F6F5F2]/70">
              {loadingMessages ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Carregando histórico da conversa...
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Nenhuma mensagem registrada nesta conversa ainda. Envie a primeira mensagem abaixo ou use a Lumi IA.
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.direction === 'system' || msg.senderType === 'system') {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="text-[11px] text-muted-foreground bg-card border border-border px-3 py-1 rounded-md">
                          {msg.body} · {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  }

                  const isOutbound = msg.direction === 'outbound';
                  const isAi = msg.senderType === 'ai';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed border ${
                          isOutbound
                            ? isAi
                              ? 'bg-[#F5F1E9] text-foreground border-[#D8C79F]'
                              : 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-card text-foreground border-border'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] opacity-75">
                          {isAi ? (
                            <>
                              <Bot className="w-3 h-3 text-[#9F844A]" />
                              <span className="font-semibold text-[#8A6D36]">
                                {settings.aiConfig.agentName || 'Lumi IA'}
                              </span>
                            </>
                          ) : isOutbound ? (
                            <span className="font-medium">
                              {msg.senderName || currentUserName}
                            </span>
                          ) : (
                            <span className="font-semibold text-foreground">
                              {activeConversation.clientName}
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70 tabular-nums">
                          <span>{formatMessageTime(msg.createdAt)}</span>
                          {isOutbound &&
                            (msg.deliveryStatus === 'read' ? (
                              <CheckCheck className="w-3 h-3" />
                            ) : (
                              <Check className="w-3 h-3" />
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Lumi IA Copiloto + Alerta WhatsApp Web Fallback */}
            {(aiNotice || aiRecommendation || lastWaLink) && (
              <div className="px-4 py-2 bg-secondary/80 border-t border-border space-y-1.5">
                {aiNotice && (
                  <p className="text-[11px] text-amber-800 flex items-center justify-between gap-2">
                    <span>{aiNotice}</span>
                    <button
                      type="button"
                      onClick={() => setAiNotice(null)}
                      className="text-[10px] underline"
                    >
                      Fechar
                    </button>
                  </p>
                )}
                {aiRecommendation && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-foreground">
                    <span>
                      <strong className="text-[#8A6D36]">Lumi IA:</strong>{' '}
                      {aiRecommendation.intentSummary}
                      {aiRecommendation.detectedService
                        ? ` · Interesse: ${aiRecommendation.detectedService}`
                        : ''}
                      {aiRecommendation.estimatedValue > 0
                        ? ` · Ticket est.: R$ ${aiRecommendation.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiRecommendation(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Dispensar
                    </button>
                  </div>
                )}
                {lastWaLink && (
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-muted-foreground">
                      Cloud API não vinculada — envie diretamente pelo WhatsApp Web:
                    </span>
                    <a
                      href={lastWaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                    >
                      Abrir no WhatsApp <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Composer + /atalho autocomplete */}
            <form onSubmit={handleSendMessage} className="p-3 bg-card border-t border-border relative">
              {slashFilter && slashFilter.length > 0 && (
                <div className="absolute left-3 right-3 bottom-full mb-1.5 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto z-20 divide-y divide-border">
                  {slashFilter.map((qr) => (
                    <button
                      key={qr.id}
                      type="button"
                      onClick={() => applyQuickReply(qr)}
                      className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#8A6D36] font-mono">
                          /{qr.shortcut}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{qr.title}</span>
                      </div>
                      <span className="text-[11px] text-foreground line-clamp-1">{qr.body}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={aiSuggesting}
                    onClick={() => handleAiAssist('suggest_reply')}
                    className="h-7 px-2.5 text-[11px] border-[#D8C79F] bg-[#F5F1E9] hover:bg-[#EDE6D6] text-[#7A5E29] gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {aiSuggesting ? 'Lumi analisando...' : 'Sugerir resposta com Lumi IA'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setComposerText('/')}
                    className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border bg-background cursor-pointer"
                  >
                    /atalhos
                  </button>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useSignature}
                    onChange={(e) => setUseSignature(e.target.checked)}
                    className="rounded border-border accent-[#9F844A]"
                  />
                  Assinar como {currentUserName.split(/\s+/)[0]}
                </label>
              </div>

              <div className="flex items-end gap-2">
                <Textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Digite sua resposta ou / para atalhos rápidos... (Enter envia)"
                  className="min-h-[56px] max-h-[140px] resize-none text-xs bg-background border-border"
                />
                <Button
                  type="submit"
                  disabled={!composerText.trim() || sending}
                  className="h-10 px-4 bg-[#171717] hover:bg-[#2A2A2A] text-white text-xs font-medium rounded-lg shrink-0 gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sending ? 'Enviando' : 'Enviar'}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* COLUNA 3: PAINEL DO CLIENTE 360° */}
      {showContextPanel && (
        <div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto p-4 space-y-4">
          {!activeConversation ? (
            <p className="text-xs text-muted-foreground">
              Os dados do cliente, visitas nos últimos 3 meses, agendamentos e oportunidade do funil aparecerão aqui.
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                    Painel do Cliente
                  </span>
                  <h4 className="text-sm font-semibold text-foreground truncate mt-0.5">
                    {linkedClient?.name || activeConversation.clientName}
                  </h4>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {activeConversation.clientPhone}
                  </p>
                </div>
                {formatWhatsAppHref(activeConversation.clientPhone) && (
                  <a
                    href={formatWhatsAppHref(activeConversation.clientPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-emerald-700 hover:underline flex items-center gap-1 shrink-0"
                  >
                    WhatsApp <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Vínculo na base de clientes */}
              {linkedClient ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-secondary/70 border border-border">
                      <span className="text-[10px] text-muted-foreground block">
                        Visitas (90 dias)
                      </span>
                      <span className="text-base font-semibold text-foreground tabular-nums">
                        {clientAppointments.visitsLast3Months}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-secondary/70 border border-border">
                      <span className="text-[10px] text-muted-foreground block">Aniversário</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {linkedClient.birthDate
                          ? linkedClient.birthDate.split('-').reverse().join('/')
                          : 'Não informado'}
                      </span>
                    </div>
                  </div>

                  {linkedClient.tags && linkedClient.tags.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
                        Preferências / Tags
                      </span>
                      <p className="text-xs text-foreground">
                        {linkedClient.tags.join(' · ')}
                      </p>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenClientDrawer(linkedClient)}
                    className="w-full h-8 text-xs border-border justify-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-[#9F844A]" /> Abrir Ficha / Anamnese / Prontuário
                  </Button>

                  {/* Próximos horários */}
                  <div className="pt-2 border-t border-border space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                      Próximos agendamentos ({clientAppointments.upcoming.length})
                    </span>
                    {clientAppointments.upcoming.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Nenhum horário futuro marcado.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {clientAppointments.upcoming.slice(0, 3).map((ap) => (
                          <div
                            key={ap.id}
                            className="p-2 rounded-lg bg-secondary/50 border border-border text-[11px]"
                          >
                            <div className="flex items-center justify-between font-medium text-foreground">
                              <span className="truncate">{ap.serviceName}</span>
                              <span className="tabular-nums shrink-0 ml-1">
                                {ap.date.split('-').reverse().slice(0, 2).join('/')} · {ap.time}
                              </span>
                            </div>
                            <span className="text-muted-foreground">
                              {ap.professionalName} ·{' '}
                              {ap.status === 'confirmed' ? 'Confirmado' : 'Agendado'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Últimos atendimentos */}
                  {clientAppointments.past.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                        Últimos serviços realizados
                      </span>
                      {clientAppointments.past.slice(0, 3).map((ap) => (
                        <div
                          key={ap.id}
                          className="flex items-center justify-between text-[11px] text-muted-foreground"
                        >
                          <span className="truncate">{ap.serviceName}</span>
                          <span className="tabular-nums shrink-0 ml-2">
                            {ap.date.split('-').reverse().slice(0, 2).join('/')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Observações do cliente */}
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                      Observações rápidas
                    </span>
                    <Textarea
                      value={editingClientNote}
                      onChange={(e) => setEditingClientNote(e.target.value)}
                      rows={3}
                      placeholder="Preferências, alergias, horários favoritos..."
                      className="text-xs bg-background border-border"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingClientNote}
                      onClick={handleSaveClientNote}
                      className="w-full h-7 text-[11px] border-border"
                    >
                      {savingClientNote ? 'Salvando...' : 'Salvar observação'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-secondary/70 border border-border space-y-2.5">
                  <p className="text-xs font-medium text-foreground">
                    Contato ainda não cadastrado na base
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Cadastre em 1 clique para vincular histórico de visitas, anamnese e campanhas automáticas.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setRegName(activeConversation.clientName);
                      setRegPhone(activeConversation.clientPhone);
                      setRegEmail('');
                      setRegBirthDate('');
                      setIsRegisterClientOpen(true);
                    }}
                    className="w-full h-8 text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Cadastrar na base
                  </Button>
                </div>
              )}

              {/* Resumo da Oportunidade no Funil */}
              {activeOpportunity && (
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Oportunidade #{activeOpportunity.opportunityNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenOpportunityModal(activeOpportunity.id)}
                      className="text-[11px] font-medium text-[#8A6D36] hover:underline cursor-pointer"
                    >
                      Ver card
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/70 border border-border text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Etapa</span>
                      <span className="font-medium text-foreground">
                        {FUNNEL_STAGE_META[activeOpportunity.stage]?.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Valor est.</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        R${' '}
                        {Number(activeOpportunity.estimatedValue || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {activeOpportunity.serviceInterest && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Interesse</span>
                        <span className="text-foreground truncate">
                          {activeOpportunity.serviceInterest}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={aiSuggesting}
                    onClick={() => handleAiAssist('recovery_draft')}
                    className="w-full h-8 text-[11px] border-[#D8C79F] bg-[#F5F1E9] hover:bg-[#EDE6D6] text-[#7A5E29] gap-1"
                  >
                    <Clock className="w-3.5 h-3.5" /> Gerar follow-up IA para retomada
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MODAL NOVA CONVERSA */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova conversa no Inbox</DialogTitle>
            <DialogDescription>
              Selecione um cliente já cadastrado ou informe um novo contato para abrir o chat e a oportunidade no funil.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateChat} className="space-y-3">
            <div>
              <Label className="text-xs">Cliente cadastrado (opcional)</Label>
              <select
                value={newChatClientId}
                onChange={(e) => {
                  const id = e.target.value;
                  setNewChatClientId(id);
                  const found = clients.find((c) => c.id === id);
                  if (found) {
                    setNewChatName(found.name);
                    setNewChatPhone(found.phone || '');
                  }
                }}
                className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
              >
                <option value="">Novo contato / digitar manualmente</option>
                {clients
                  .filter((c) => !c.deletedAt && !c.archived)
                  .slice(0, 120)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input
                  required
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="Ex.: Mariana Souza"
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">WhatsApp *</Label>
                <Input
                  required
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Origem</Label>
                <select
                  value={newChatOrigin}
                  onChange={(e) => setNewChatOrigin(e.target.value as CrmOrigin)}
                  className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                >
                  <option value="attendant">Atendente</option>
                  <option value="receptivo">Receptivo</option>
                  <option value="confirmacao">Confirmação</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Serviço de interesse</Label>
                <Input
                  value={newChatService}
                  onChange={(e) => setNewChatService(e.target.value)}
                  placeholder="Ex.: Mechas, Manicure..."
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Primeira mensagem (opcional)</Label>
              <Textarea
                value={newChatMessage}
                onChange={(e) => setNewChatMessage(e.target.value)}
                rows={2}
                placeholder="Ex.: Olá! Vi que você demonstrou interesse..."
                className="mt-1 text-xs"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewChatOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creatingChat}>
                {creatingChat ? 'Abrindo...' : 'Iniciar atendimento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CADASTRAR NA BASE */}
      <Dialog open={isRegisterClientOpen} onOpenChange={setIsRegisterClientOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Cadastrar cliente na base</DialogTitle>
            <DialogDescription>
              Salva o contato na base oficial do salão e vincula automaticamente a esta conversa e oportunidade.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterAndLinkClient} className="space-y-3">
            <div>
              <Label className="text-xs">Nome completo *</Label>
              <Input
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">WhatsApp *</Label>
              <Input
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Data de nascimento</Label>
                <Input
                  type="date"
                  value={regBirthDate}
                  onChange={(e) => setRegBirthDate(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRegisterClientOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={registeringClient}>
                {registeringClient ? 'Salvando...' : 'Salvar e vincular'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

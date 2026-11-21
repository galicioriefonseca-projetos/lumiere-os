import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  GoogleWorkspaceAccount,
  WorkspaceAuthError,
  clearWorkspaceToken,
  connectGoogleWorkspace,
  subscribeWorkspaceAuth,
} from '@/services/googleWorkspaceService';
import {
  GmailDraftSummary,
  GmailMessageDetail,
  GmailMessageSummary,
  GmailProfile,
  createGmailDraft,
  deleteGmailDraft,
  getGmailMessageDetail,
  getGmailProfile,
  gmailComposeSchema,
  listGmailDrafts,
  listGmailMessages,
  modifyGmailMessageLabels,
  sendGmailDraft,
  sendGmailMessage,
  trashGmailMessage,
} from '@/services/gmailService';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  WorkspaceConfirmDetails,
  WorkspaceConfirmDialog,
} from './WorkspaceConfirmDialog';
import {
  Archive,
  CheckCircle2,
  FileEdit,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  MailOpen,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

export interface GmailSentEvent {
  to: string;
  subject: string;
  bodyText: string;
  messageId: string;
}

interface GmailWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'inbox' | 'compose' | 'drafts';
  initialSearchQuery?: string;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  recipientLabel?: string;
  onEmailSent?: (info: GmailSentEvent) => Promise<void> | void;
}

type MailboxFilter = 'INBOX' | 'SENT' | 'STARRED' | 'ALL';

interface PendingGmailAction {
  confirmDetails: WorkspaceConfirmDetails;
  execute: () => Promise<void>;
}

function extractEmailAddress(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  if (match && match[1]) return match[1].trim();
  return headerValue.trim();
}

function stripHtmlTagsSafe(html: string): string {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style').forEach((el) => el.remove());
      return (doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    } catch {
      // Fallback abaixo se DOMParser falhar
    }
  }
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatMessageDate(dateMs: number, fallbackDate: string): string {
  if (dateMs > 0) {
    return new Date(dateMs).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return fallbackDate || '';
}

export function GmailWorkspaceDialog({
  open,
  onOpenChange,
  initialTab = 'inbox',
  initialSearchQuery = '',
  initialTo = '',
  initialSubject = '',
  initialBody = '',
  recipientLabel,
  onEmailSent,
}: GmailWorkspaceDialogProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose' | 'drafts'>(initialTab);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<GoogleWorkspaceAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [gmailProfile, setGmailProfile] = useState<GmailProfile | null>(null);

  // Inbox / Messages State
  const [mailboxFilter, setMailboxFilter] = useState<MailboxFilter>('INBOX');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<GmailMessageDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  // Drafts State
  const [drafts, setDrafts] = useState<GmailDraftSummary[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);

  // Compose State
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState(initialBody);
  const [replyThreadId, setReplyThreadId] = useState<string | undefined>(undefined);
  const [replyInReplyTo, setReplyInReplyTo] = useState<string | undefined>(undefined);
  const [replyReferences, setReplyReferences] = useState<string | undefined>(undefined);

  // Confirmation Dialog State
  const [pendingAction, setPendingAction] = useState<PendingGmailAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  useEffect(() => {
    return subscribeWorkspaceAuth((state) => {
      setIsConnected(state.isConnected);
      setAccount(state.account);
      if (!state.isConnected) {
        setGmailProfile(null);
        setMessages([]);
        setDrafts([]);
        setSelectedDetail(null);
        setSelectedMessageId(null);
      }
    });
  }, []);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setSearchQuery(initialSearchQuery);
      setTo(initialTo);
      setCc('');
      setSubject(initialSubject);
      setBodyText(initialBody);
      setReplyThreadId(undefined);
      setReplyInReplyTo(undefined);
      setReplyReferences(undefined);
      setShowHtmlPreview(false);
    }
  }, [open, initialTab, initialSearchQuery, initialTo, initialSubject, initialBody]);

  const loadMailbox = async (overrideQuery?: string, overrideFilter?: MailboxFilter) => {
    setIsLoadingMessages(true);
    try {
      const effectiveFilter = overrideFilter ?? mailboxFilter;
      const effectiveQuery = overrideQuery ?? searchQuery;
      const labelIds = effectiveFilter === 'ALL' ? undefined : [effectiveFilter];

      const [profileRes, listRes] = await Promise.all([
        gmailProfile ? Promise.resolve(gmailProfile) : getGmailProfile().catch(() => null),
        listGmailMessages({
          q: effectiveQuery,
          labelIds,
          maxResults: 20,
        }),
      ]);

      if (profileRes) setGmailProfile(profileRes);
      setMessages(listRes.messages);

      if (
        listRes.messages.length > 0 &&
        (!selectedMessageId || !listRes.messages.some((m) => m.id === selectedMessageId))
      ) {
        const firstId = listRes.messages[0].id;
        setSelectedMessageId(firstId);
        void loadMessageDetail(firstId);
      } else if (listRes.messages.length === 0) {
        setSelectedMessageId(null);
        setSelectedDetail(null);
      }
    } catch (err) {
      if (err instanceof WorkspaceAuthError && err.needsReauth) {
        toast.error(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar mensagens do Gmail.';
        toast.error(msg);
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadDraftsList = async () => {
    setIsLoadingDrafts(true);
    try {
      const items = await listGmailDrafts();
      setDrafts(items);
    } catch (err) {
      if (err instanceof WorkspaceAuthError && err.needsReauth) {
        toast.error(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar rascunhos do Gmail.';
        toast.error(msg);
      }
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const loadMessageDetail = async (messageId: string) => {
    setSelectedMessageId(messageId);
    setShowHtmlPreview(false);
    setIsLoadingDetail(true);
    try {
      const detail = await getGmailMessageDetail(messageId);
      setSelectedDetail(detail);
    } catch (err) {
      if (err instanceof WorkspaceAuthError && err.needsReauth) {
        toast.error(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao abrir conteúdo do e-mail.';
        toast.error(msg);
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!open || !isConnected) return;
    if (activeTab === 'inbox') {
      void loadMailbox();
    } else if (activeTab === 'drafts') {
      void loadDraftsList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isConnected, activeTab, mailboxFilter]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await connectGoogleWorkspace();
      toast.success(
        res.account.email
          ? `Gmail conectado (${res.account.email})`
          : 'Conta Gmail conectada com sucesso!'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao conectar com o Gmail.';
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartReply = (detail: GmailMessageDetail) => {
    const replyTarget = extractEmailAddress(detail.from);
    const nextSubject = detail.subject.toLowerCase().startsWith('re:')
      ? detail.subject
      : `Re: ${detail.subject}`;

    setTo(replyTarget);
    setCc('');
    setSubject(nextSubject);
    setReplyThreadId(detail.threadId);
    setReplyInReplyTo(detail.messageIdHeader || undefined);
    setReplyReferences(
      [detail.referencesHeader, detail.messageIdHeader].filter(Boolean).join(' ') || undefined
    );
    setBodyText(
      `\n\n--- Em ${formatMessageDate(detail.internalDateMs, detail.date)}, ${detail.from} escreveu ---\n${
        detail.bodyText || stripHtmlTagsSafe(detail.bodyHtml)
      }`
    );
    setActiveTab('compose');
  };

  const handleRequestSendEmail = () => {
    const validation = gmailComposeSchema.safeParse({
      to,
      cc,
      subject,
      bodyText,
      threadId: replyThreadId,
      inReplyTo: replyInReplyTo,
      references: replyReferences,
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || 'Verifique os campos do e-mail.');
      return;
    }

    const validated = validation.data;

    setPendingAction({
      confirmDetails: {
        title: 'Confirmar envio de e-mail pelo Gmail',
        description: `Este e-mail será enviado diretamente pela sua conta ${
          gmailProfile?.emailAddress || account?.email || 'Google'
        }.`,
        targetName: validated.to,
        sheetTabName: validated.subject,
        affectedCountLabel: `${validated.to.split(',').filter((x) => x.trim()).length} destinatário(s)`,
        confirmLabel: 'Enviar E-mail Agora',
      },
      execute: async () => {
        const result = await sendGmailMessage(validated);
        toast.success(`E-mail enviado para ${validated.to}!`);
        if (onEmailSent) {
          await onEmailSent({
            to: validated.to,
            subject: validated.subject,
            bodyText: validated.bodyText,
            messageId: result.id,
          });
        }
        setTo(initialTo);
        setCc('');
        setSubject('');
        setBodyText('');
        setReplyThreadId(undefined);
        setReplyInReplyTo(undefined);
        setReplyReferences(undefined);
        setActiveTab('inbox');
      },
    });
  };

  const handleRequestSaveDraft = () => {
    const validation = gmailComposeSchema.safeParse({
      to,
      cc,
      subject,
      bodyText,
      threadId: replyThreadId,
      inReplyTo: replyInReplyTo,
      references: replyReferences,
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || 'Verifique os campos antes de salvar rascunho.');
      return;
    }

    const validated = validation.data;

    setPendingAction({
      confirmDetails: {
        title: 'Salvar rascunho no Gmail?',
        description: 'Um novo rascunho será criado na sua caixa do Gmail para edição ou envio futuro.',
        targetName: validated.to,
        sheetTabName: validated.subject,
        confirmLabel: 'Salvar Rascunho',
      },
      execute: async () => {
        await createGmailDraft(validated);
        toast.success('Rascunho salvo no seu Gmail!');
        setActiveTab('drafts');
      },
    });
  };

  const handleRequestToggleRead = (msg: GmailMessageDetail) => {
    const markingAsRead = msg.isUnread;
    setPendingAction({
      confirmDetails: {
        title: markingAsRead ? 'Marcar e-mail como lido?' : 'Marcar e-mail como não lido?',
        description: `O marcador de leitura da mensagem "${msg.subject}" será atualizado no seu Gmail.`,
        targetName: msg.from,
        sheetTabName: msg.subject,
        confirmLabel: markingAsRead ? 'Marcar como Lido' : 'Marcar como Não Lido',
      },
      execute: async () => {
        await modifyGmailMessageLabels({
          messageId: msg.id,
          addLabelIds: markingAsRead ? [] : ['UNREAD'],
          removeLabelIds: markingAsRead ? ['UNREAD'] : [],
        });
        toast.success(markingAsRead ? 'Marcado como lido.' : 'Marcado como não lido.');
        await Promise.all([loadMessageDetail(msg.id), loadMailbox()]);
      },
    });
  };

  const handleRequestToggleStar = (msg: GmailMessageDetail) => {
    const addingStar = !msg.isStarred;
    setPendingAction({
      confirmDetails: {
        title: addingStar ? 'Destacar e-mail com estrela?' : 'Remover estrela do e-mail?',
        description: `O marcador de destaque da mensagem "${msg.subject}" será alterado no seu Gmail.`,
        targetName: msg.from,
        sheetTabName: msg.subject,
        confirmLabel: addingStar ? 'Adicionar Estrela' : 'Remover Estrela',
      },
      execute: async () => {
        await modifyGmailMessageLabels({
          messageId: msg.id,
          addLabelIds: addingStar ? ['STARRED'] : [],
          removeLabelIds: addingStar ? [] : ['STARRED'],
        });
        toast.success(addingStar ? 'Estrela adicionada!' : 'Estrela removida.');
        await Promise.all([loadMessageDetail(msg.id), loadMailbox()]);
      },
    });
  };

  const handleRequestArchive = (msg: GmailMessageDetail) => {
    setPendingAction({
      confirmDetails: {
        title: 'Arquivar e-mail no Gmail?',
        description:
          'A mensagem será removida da Caixa de Entrada (INBOX), permanecendo acessível em Todos os E-mails.',
        targetName: msg.from,
        sheetTabName: msg.subject,
        confirmLabel: 'Arquivar Mensagem',
      },
      execute: async () => {
        await modifyGmailMessageLabels({
          messageId: msg.id,
          removeLabelIds: ['INBOX'],
        });
        toast.success('E-mail arquivado no Gmail!');
        await loadMailbox();
      },
    });
  };

  const handleRequestTrash = (msg: GmailMessageDetail) => {
    setPendingAction({
      confirmDetails: {
        title: 'Mover e-mail para a lixeira do Gmail?',
        description: 'A mensagem selecionada será movida para a Lixeira da sua conta Gmail.',
        targetName: msg.from,
        sheetTabName: msg.subject,
        warningText: 'E-mails na lixeira do Gmail são excluídos definitivamente após 30 dias.',
        confirmLabel: 'Mover para Lixeira',
        destructive: true,
      },
      execute: async () => {
        await trashGmailMessage(msg.id);
        toast.success('E-mail movido para a lixeira.');
        await loadMailbox();
      },
    });
  };

  const handleRequestSendDraft = (draft: GmailDraftSummary) => {
    setPendingAction({
      confirmDetails: {
        title: 'Enviar rascunho agora?',
        description: 'Este rascunho será disparado imediatamente para o destinatário configurado.',
        targetName: draft.message.to || '(Sem destinatário)',
        sheetTabName: draft.message.subject,
        confirmLabel: 'Enviar Rascunho',
      },
      execute: async () => {
        await sendGmailDraft(draft.draftId);
        toast.success('Rascunho enviado com sucesso!');
        await loadDraftsList();
      },
    });
  };

  const handleRequestDeleteDraft = (draft: GmailDraftSummary) => {
    setPendingAction({
      confirmDetails: {
        title: 'Excluir rascunho permanentemente?',
        description: 'O rascunho selecionado será removido do seu Gmail.',
        targetName: draft.message.to || '(Sem destinatário)',
        sheetTabName: draft.message.subject,
        warningText: 'Esta ação apaga o rascunho imediatamente e não pode ser desfeita.',
        confirmLabel: 'Excluir Rascunho',
        destructive: true,
      },
      execute: async () => {
        await deleteGmailDraft(draft.draftId);
        toast.success('Rascunho excluído.');
        await loadDraftsList();
      },
    });
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    setIsExecutingAction(true);
    try {
      await pendingAction.execute();
      setPendingAction(null);
    } catch (err) {
      if (err instanceof WorkspaceAuthError && err.needsReauth) {
        toast.error(err.message);
        setPendingAction(null);
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao executar operação no Gmail.';
        toast.error(msg);
      }
    } finally {
      setIsExecutingAction(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[880px] bg-white border border-[#E5E2DC] text-[#171717] shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-semibold text-[#171717] flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#B89B5E] shrink-0" />
              Central Gmail Workspace
              {recipientLabel && (
                <span className="text-xs font-medium bg-[#F5F1E9] text-[#8A6D36] border border-[#D8C79F] px-2.5 py-0.5 rounded-full">
                  {recipientLabel}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {!isConnected ? (
            <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-8 text-center space-y-4 my-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F1E9] border border-[#D8C79F]">
                <Mail className="h-6 w-6 text-[#8A6D36]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold text-[#171717]">
                  Conecte seu Gmail ao LumièreOS
                </h4>
                <p className="text-xs text-[#6B6B6B] max-w-md mx-auto leading-relaxed">
                  Autorize o acesso ao Gmail para ler mensagens, responder clientes diretamente do CRM, salvar rascunhos e organizar sua caixa de entrada com segurança.
                </p>
              </div>
              <div className="flex justify-center pt-1">
                <GoogleSignInButton
                  onClick={() => void handleConnect()}
                  loading={isConnecting}
                  label="Conectar Gmail com o Google"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Barra de Conta Conectada */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-[#171717] truncate">
                    Gmail conectado: {gmailProfile?.emailAddress || account?.email || 'Conta Google'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleConnect()}
                    disabled={isConnecting}
                    className="h-7 px-2 text-[11px] text-[#8A6D36] hover:bg-[#F5F1E9]"
                  >
                    Trocar conta
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => clearWorkspaceToken()}
                    className="h-7 px-2 text-[11px] text-[#6B6B6B] hover:text-red-600 hover:bg-red-50 gap-1"
                  >
                    <LogOut className="h-3 w-3" />
                    Desconectar
                  </Button>
                </div>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'inbox' | 'compose' | 'drafts')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3 bg-[#F0EFEC] p-1 rounded-lg">
                  <TabsTrigger value="inbox" className="text-xs font-medium gap-1.5">
                    <Inbox className="w-3.5 h-3.5" />
                    Mensagens
                  </TabsTrigger>
                  <TabsTrigger value="compose" className="text-xs font-medium gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    Escrever E-mail
                  </TabsTrigger>
                  <TabsTrigger value="drafts" className="text-xs font-medium gap-1.5">
                    <FileEdit className="w-3.5 h-3.5" />
                    Rascunhos
                  </TabsTrigger>
                </TabsList>

                {/* Aba 1: Caixa de Entrada & Mensagens */}
                <TabsContent value="inbox" className="space-y-3 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'INBOX', label: 'Entrada' },
                          { id: 'SENT', label: 'Enviados' },
                          { id: 'STARRED', label: 'Com Estrela' },
                          { id: 'ALL', label: 'Todos' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setMailboxFilter(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            mailboxFilter === item.id
                              ? 'bg-[#171717] text-white border-[#171717]'
                              : 'bg-white text-[#4A4A4A] border-[#E5E2DC] hover:bg-[#FAF9F7]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void loadMailbox(searchQuery, mailboxFilter);
                            }
                          }}
                          placeholder="Buscar por remetente ou assunto..."
                          className="pl-8 h-8 bg-white border-[#E5E2DC] text-[#171717] text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoadingMessages}
                        onClick={() => void loadMailbox(searchQuery, mailboxFilter)}
                        className="h-8 px-2.5 border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9]"
                      >
                        {isLoadingMessages ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 min-h-[360px]">
                    {/* Lista de E-mails */}
                    <div className="md:col-span-5 rounded-xl border border-[#E5E2DC] bg-white max-h-[420px] overflow-y-auto divide-y divide-[#E5E2DC]">
                      {isLoadingMessages ? (
                        <div className="flex items-center justify-center py-12 gap-2 text-xs text-[#6B6B6B]">
                          <Loader2 className="w-4 h-4 animate-spin text-[#9F844A]" />
                          Carregando mensagens...
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="py-12 px-4 text-center text-xs text-[#6B6B6B]">
                          Nenhuma mensagem encontrada para este filtro.
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isSelected = selectedMessageId === msg.id;
                          return (
                            <button
                              key={msg.id}
                              type="button"
                              onClick={() => void loadMessageDetail(msg.id)}
                              className={`w-full text-left p-3 transition space-y-1 ${
                                isSelected
                                  ? 'bg-[#F5F1E9] border-l-2 border-l-[#B89B5E]'
                                  : 'hover:bg-[#FAF9F7]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-xs truncate ${
                                    msg.isUnread
                                      ? 'font-bold text-[#171717]'
                                      : 'font-medium text-[#4A4A4A]'
                                  }`}
                                >
                                  {mailboxFilter === 'SENT'
                                    ? `Para: ${msg.to || '(sem destinatário)'}`
                                    : msg.from}
                                </span>
                                <span className="text-[10px] text-[#6B6B6B] shrink-0">
                                  {formatMessageDate(msg.internalDateMs, msg.date)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {msg.isUnread && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#B89B5E] shrink-0" />
                                )}
                                <p
                                  className={`text-xs truncate ${
                                    msg.isUnread
                                      ? 'font-semibold text-[#171717]'
                                      : 'text-[#171717]'
                                  }`}
                                >
                                  {msg.subject}
                                </p>
                              </div>
                              <p className="text-[11px] text-[#6B6B6B] line-clamp-2">
                                {msg.snippet || '(Sem prévia de texto)'}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Leitor de Mensagem Selecionada */}
                    <div className="md:col-span-7 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-4 flex flex-col justify-between max-h-[420px] overflow-y-auto">
                      {isLoadingDetail ? (
                        <div className="flex items-center justify-center h-full py-16 gap-2 text-xs text-[#6B6B6B]">
                          <Loader2 className="w-4 h-4 animate-spin text-[#9F844A]" />
                          Carregando conteúdo do e-mail...
                        </div>
                      ) : !selectedDetail ? (
                        <div className="flex flex-col items-center justify-center h-full py-16 text-center text-xs text-[#6B6B6B] gap-2">
                          <Mail className="w-7 h-7 text-[#9F844A]/60" />
                          Selecione uma mensagem ao lado para ler e responder.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1.5 border-b border-[#E5E2DC] pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-semibold text-[#171717] leading-snug">
                                {selectedDetail.subject}
                              </h4>
                              <span className="text-[10px] text-[#6B6B6B] shrink-0">
                                {formatMessageDate(
                                  selectedDetail.internalDateMs,
                                  selectedDetail.date
                                )}
                              </span>
                            </div>
                            <p className="text-xs text-[#4A4A4A]">
                              <strong>De:</strong> {selectedDetail.from}
                            </p>
                            {selectedDetail.to && (
                              <p className="text-xs text-[#6B6B6B]">
                                <strong>Para:</strong> {selectedDetail.to}
                              </p>
                            )}
                          </div>

                          {/* Ações da Mensagem (todas protegidas por confirmação quando mutam) */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleStartReply(selectedDetail)}
                              className="h-7 px-2.5 bg-[#171717] hover:bg-[#2B2B2B] text-white text-xs gap-1"
                            >
                              <Reply className="w-3.5 h-3.5" />
                              Responder
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRequestToggleRead(selectedDetail)}
                              className="h-7 px-2.5 border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9] text-xs gap-1"
                            >
                              <MailOpen className="w-3.5 h-3.5" />
                              {selectedDetail.isUnread ? 'Marcar Lido' : 'Marcar Não Lido'}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRequestToggleStar(selectedDetail)}
                              className="h-7 px-2.5 border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9] text-xs gap-1"
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  selectedDetail.isStarred ? 'fill-[#B89B5E] text-[#B89B5E]' : ''
                                }`}
                              />
                              {selectedDetail.isStarred ? 'Com Estrela' : 'Destacar'}
                            </Button>

                            {selectedDetail.labelIds.includes('INBOX') && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRequestArchive(selectedDetail)}
                                className="h-7 px-2.5 border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9] text-xs gap-1"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                Arquivar
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRequestTrash(selectedDetail)}
                              className="h-7 px-2.5 border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs gap-1 ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Lixeira
                            </Button>
                          </div>

                          {/* Corpo da Mensagem (Seguro contra XSS) */}
                          <div className="space-y-2">
                            {selectedDetail.bodyHtml && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setShowHtmlPreview((prev) => !prev)}
                                  className="text-[11px] font-medium text-[#8A6D36] hover:underline"
                                >
                                  {showHtmlPreview
                                    ? 'Ver texto simples'
                                    : 'Visualizar layout HTML (sandbox)'}
                                </button>
                              </div>
                            )}

                            {showHtmlPreview && selectedDetail.bodyHtml ? (
                              <iframe
                                title="Conteúdo HTML do e-mail"
                                sandbox=""
                                srcDoc={selectedDetail.bodyHtml}
                                className="w-full h-56 rounded-lg border border-[#E5E2DC] bg-white"
                              />
                            ) : (
                              <div className="rounded-lg border border-[#E5E2DC] bg-white p-3.5 max-h-60 overflow-y-auto">
                                <pre className="whitespace-pre-wrap break-words font-sans text-xs text-[#171717] leading-relaxed">
                                  {selectedDetail.bodyText ||
                                    stripHtmlTagsSafe(selectedDetail.bodyHtml) ||
                                    selectedDetail.snippet ||
                                    '(Mensagem sem conteúdo textual)'}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Aba 2: Escrever E-mail */}
                <TabsContent value="compose" className="space-y-3 pt-3">
                  <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-4 space-y-3">
                    {replyThreadId && (
                      <div className="flex items-center justify-between text-xs bg-[#F5F1E9] border border-[#D8C79F] text-[#8A6D36] px-3 py-1.5 rounded-lg">
                        <span>Respondendo dentro da conversa selecionada</span>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyThreadId(undefined);
                            setReplyInReplyTo(undefined);
                            setReplyReferences(undefined);
                          }}
                          className="underline font-semibold"
                        >
                          Desvincular resposta
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="gmail-to" className="text-xs text-[#171717]">
                          Para (destinatário) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="gmail-to"
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          placeholder="cliente@email.com"
                          className="h-9 bg-white border-[#E5E2DC] text-[#171717] text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="gmail-cc" className="text-xs text-[#171717]">
                          Cópia / Cc (opcional)
                        </Label>
                        <Input
                          id="gmail-cc"
                          value={cc}
                          onChange={(e) => setCc(e.target.value)}
                          placeholder="gerencia@salao.com"
                          className="h-9 bg-white border-[#E5E2DC] text-[#171717] text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gmail-subject" className="text-xs text-[#171717]">
                        Assunto <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="gmail-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Ex: Confirmação de atendimento / Retorno exclusivo"
                        className="h-9 bg-white border-[#E5E2DC] text-[#171717] text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gmail-body" className="text-xs text-[#171717]">
                        Mensagem <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="gmail-body"
                        rows={7}
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        placeholder="Escreva sua mensagem para o cliente ou parceiro..."
                        className="bg-white border-[#E5E2DC] text-[#171717] text-xs leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRequestSaveDraft}
                      className="border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9] text-xs gap-1.5"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      Salvar Rascunho
                    </Button>
                    <Button
                      type="button"
                      onClick={handleRequestSendEmail}
                      className="bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold text-xs gap-1.5 px-4"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar pelo Gmail
                    </Button>
                  </div>
                </TabsContent>

                {/* Aba 3: Rascunhos */}
                <TabsContent value="drafts" className="space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#6B6B6B]">
                      Rascunhos armazenados na sua conta Gmail.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoadingDrafts}
                      onClick={() => void loadDraftsList()}
                      className="h-8 px-3 border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9] text-xs gap-1.5"
                    >
                      {isLoadingDrafts ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Atualizar
                    </Button>
                  </div>

                  <div className="rounded-xl border border-[#E5E2DC] bg-white divide-y divide-[#E5E2DC] max-h-80 overflow-y-auto">
                    {isLoadingDrafts ? (
                      <div className="flex items-center justify-center py-10 gap-2 text-xs text-[#6B6B6B]">
                        <Loader2 className="w-4 h-4 animate-spin text-[#9F844A]" />
                        Carregando rascunhos...
                      </div>
                    ) : drafts.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[#6B6B6B]">
                        Nenhum rascunho encontrado na sua conta Gmail.
                      </div>
                    ) : (
                      drafts.map((draft) => (
                        <div
                          key={draft.draftId}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF9F7]"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-xs font-semibold text-[#171717] truncate">
                              {draft.message.subject || '(Sem assunto)'}
                            </p>
                            <p className="text-[11px] text-[#6B6B6B] truncate">
                              Para: {draft.message.to || '(Não definido)'} — {draft.message.snippet}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleRequestSendDraft(draft)}
                              className="h-8 px-3 bg-[#171717] hover:bg-[#2B2B2B] text-white text-xs gap-1"
                            >
                              <Send className="w-3 h-3" />
                              Enviar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRequestDeleteDraft(draft)}
                              className="h-8 px-2.5 border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <WorkspaceConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingAction(null);
        }}
        details={pendingAction?.confirmDetails || null}
        loading={isExecutingAction}
        onConfirm={handleConfirmPendingAction}
      />
    </>
  );
}

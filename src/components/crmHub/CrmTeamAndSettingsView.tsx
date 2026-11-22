import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Bot,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Zap,
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
import type { CrmAttendant, CrmQuickReply, CrmSettings } from '@/types';
import {
  deleteQuickReply,
  removeCrmAttendant,
  saveCrmAttendant,
  saveCrmSettings,
  saveQuickReply,
  seedDefaultQuickReplies,
} from '@/services/crmService';

interface ProfessionalSummary {
  id: string;
  name: string;
  email?: string;
  userId?: string;
}

interface CrmTeamAndSettingsViewProps {
  salonId: string;
  currentUserUid: string;
  currentUserName: string;
  attendants: CrmAttendant[];
  quickReplies: CrmQuickReply[];
  settings: CrmSettings;
  professionals: ProfessionalSummary[];
}

type SettingsTab = 'attendants' | 'quick_replies' | 'automations' | 'ai' | 'guide';

const GUIDE_SECTIONS = [
  {
    id: 'inbox',
    title: 'Chat Omnichannel & /atalhos',
    summary:
      'Responda mensagens recebidas automaticamente do WhatsApp em 3 colunas: Fila, Chat + Lumi IA e Painel 360° do cliente.',
    items: [
      'Use Todas, Minhas e Livres para distribuir atendimentos sem abrir outras abas.',
      'Digite / no campo de mensagem para inserir respostas rápidas do salão ou pessoais.',
      'Clique em "Sugerir resposta com Lumi IA" para gerar rascunhos com os serviços e valores reais cadastrados.',
    ],
  },
  {
    id: 'funnel',
    title: 'Funil de Oportunidades',
    summary:
      'Cada conversa abre ou atualiza um card no funil com valor estimado, tempo de espera e vínculo com agendamentos.',
    items: [
      'Arraste cards entre etapas ou use o modal de fechamento (Agendado / Perdido / Outros) com motivos estruturados.',
      'Cards em "Aguardando resposta" além do limite configurado destacam o alerta de SLA automaticamente.',
      'Confirmações via webhook movem ou atualizam a agenda sem retrabalho.',
    ],
  },
  {
    id: 'campaigns',
    title: 'Campanhas Automáticas',
    summary:
      'Cinco réguas inteligentes: Confirmação, Aniversário, Retorno de Serviço, Clientes Inativos e Pós-atendimento CSAT.',
    items: [
      'Use "Calcular público elegível" antes de disparar para auditar quem receberá e evitar bloqueios.',
      'Respeite janelas de horário e limite diário configurável por campanha.',
    ],
  },
  {
    id: 'analytics',
    title: 'Painéis & Gargalos',
    summary:
      'Monitore SLA da 1ª resposta, receita potencial do funil, conversão por origem e produtividade por atendente.',
    items: [
      'A fila "Esperando resposta agora" permite saltar em 1 clique diretamente para o chat do cliente parado.',
    ],
  },
];

export function CrmTeamAndSettingsView({
  salonId,
  currentUserUid,
  currentUserName,
  attendants,
  quickReplies,
  settings,
  professionals,
}: CrmTeamAndSettingsViewProps) {
  const [tab, setTab] = useState<SettingsTab>('attendants');
  const [draftSettings, setDraftSettings] = useState<CrmSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  // Add attendant modal
  const [isAddAttOpen, setIsAddAttOpen] = useState(false);
  const [selectedProfId, setSelectedProfId] = useState('');
  const [attName, setAttName] = useState('');
  const [attEmail, setAttEmail] = useState('');
  const [attPerm, setAttPerm] = useState<'admin' | 'attendant' | 'viewer'>('attendant');
  const [savingAtt, setSavingAtt] = useState(false);

  // Quick reply modal
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrEditingId, setQrEditingId] = useState<string | undefined>(undefined);
  const [qrShortcut, setQrShortcut] = useState('');
  const [qrTitle, setQrTitle] = useState('');
  const [qrBody, setQrBody] = useState('');
  const [qrScope, setQrScope] = useState<'salon' | 'personal'>('salon');
  const [savingQr, setSavingQr] = useState(false);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveCrmSettings(salonId, draftSettings);
      toast.success('Configurações do CRM salvas!');
    } catch {
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddAttendant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attName.trim()) return;
    setSavingAtt(true);
    try {
      const prof = professionals.find((p) => p.id === selectedProfId);
      const id = prof?.userId || prof?.id || `att_${Date.now()}`;
      await saveCrmAttendant(salonId, {
        id,
        userId: prof?.userId || '',
        professionalId: prof?.id || '',
        name: attName.trim(),
        email: attEmail.trim(),
        permission: attPerm,
        isOnline: true,
        useSignature: true,
        canDeleteCards: attPerm === 'admin',
        canAssumeConversations: attPerm !== 'viewer',
        conversationsHandled: 0,
        messagesSent: 0,
        avgFirstResponseMs: 0,
        scheduledCount: 0,
        generatedRevenue: 0,
      });
      setIsAddAttOpen(false);
      setSelectedProfId('');
      setAttName('');
      setAttEmail('');
      toast.success('Atendente adicionado à equipe do CRM!');
    } catch {
      toast.error('Erro ao adicionar atendente.');
    } finally {
      setSavingAtt(false);
    }
  };

  const handleToggleAttendantField = async (
    att: CrmAttendant,
    field: 'isOnline' | 'useSignature' | 'canDeleteCards' | 'canAssumeConversations'
  ) => {
    try {
      await saveCrmAttendant(salonId, { ...att, [field]: !att[field] });
    } catch {
      toast.error('Erro ao atualizar permissão do atendente.');
    }
  };

  const handleSaveQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrShortcut.trim() || !qrTitle.trim() || !qrBody.trim()) return;
    setSavingQr(true);
    try {
      await saveQuickReply(salonId, {
        id: qrEditingId,
        shortcut: qrShortcut,
        title: qrTitle,
        body: qrBody,
        scope: qrScope,
        ownerUid: qrScope === 'personal' ? currentUserUid : '',
        ownerName: qrScope === 'personal' ? currentUserName : '',
      });
      setIsQrOpen(false);
      toast.success('Resposta rápida salva!');
    } catch {
      toast.error('Erro ao salvar resposta rápida.');
    } finally {
      setSavingQr(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Navegação interna */}
      <div className="bg-card border border-border rounded-xl p-2 flex flex-wrap items-center gap-1">
        {(
          [
            { id: 'attendants', label: 'Atendentes & Equipe', icon: Users },
            { id: 'quick_replies', label: `Respostas Rápidas (/)`, icon: Zap },
            { id: 'automations', label: 'Regras & Automações', icon: Settings },
            { id: 'ai', label: 'Lumi IA no CRM', icon: Bot },
            { id: 'guide', label: 'Guia do CRM', icon: BookOpen },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === t.id
                ? 'bg-[#F5F1E9] text-[#8A6D36] border border-[#D8C79F]'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ATENDENTES & EQUIPE */}
      {tab === 'attendants' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Atendentes do Inbox &amp; Funil
              </h4>
              <p className="text-xs text-muted-foreground">
                Vincule profissionais do salão para atender no WhatsApp, assinar mensagens e gerenciar cards.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsAddAttOpen(true)}
              className="h-8 px-3 bg-[#171717] text-white text-xs gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" /> Vincular atendente
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {attendants.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum atendente vinculado ainda. Clique em &ldquo;Vincular atendente&rdquo; para habilitar sua equipe.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50 text-muted-foreground">
                      <th className="py-2.5 px-4 font-medium">Nome</th>
                      <th className="py-2.5 px-4 font-medium">Perfil</th>
                      <th className="py-2.5 px-4 font-medium">Presença</th>
                      <th className="py-2.5 px-4 font-medium">Assinatura</th>
                      <th className="py-2.5 px-4 font-medium">Excluir Cards</th>
                      <th className="py-2.5 px-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attendants.map((att) => (
                      <tr key={att.id}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-foreground">{att.name}</p>
                          <span className="text-[11px] text-muted-foreground">
                            {att.email || 'Sem e-mail'}
                          </span>
                        </td>
                        <td className="py-3 px-4 capitalize text-muted-foreground">
                          {att.permission === 'admin'
                            ? 'Administrador'
                            : att.permission === 'viewer'
                              ? 'Observador'
                              : 'Atendente'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => void handleToggleAttendantField(att, 'isOnline')}
                            className={`text-[11px] font-medium px-2 py-0.5 rounded border cursor-pointer ${
                              att.isOnline
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-secondary text-muted-foreground border-border'
                            }`}
                          >
                            {att.isOnline ? 'Online' : 'Offline'}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={att.useSignature}
                            onChange={() => void handleToggleAttendantField(att, 'useSignature')}
                            className="accent-[#9F844A]"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={att.canDeleteCards}
                            onChange={() => void handleToggleAttendantField(att, 'canDeleteCards')}
                            className="accent-[#9F844A]"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              removeCrmAttendant(salonId, att.id).then(() =>
                                toast.success('Atendente removido.')
                              )
                            }
                            className="text-muted-foreground hover:text-rose-700 p-1"
                            title="Remover do CRM"
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

          {/* Regras Globais de Equipe */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Regras da Equipe no Inbox</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftSettings.teamRules.requireSignature}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      teamRules: { ...draftSettings.teamRules, requireSignature: e.target.checked },
                    })
                  }
                  className="mt-0.5 accent-[#9F844A]"
                />
                <span>
                  <strong className="block text-foreground">Assinar mensagens por padrão</strong>
                  Identifica o nome do atendente no WhatsApp ao enviar resposta.
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftSettings.teamRules.autoAssignOnReply}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      teamRules: {
                        ...draftSettings.teamRules,
                        autoAssignOnReply: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 accent-[#9F844A]"
                />
                <span>
                  <strong className="block text-foreground">Atribuir ao responder</strong>
                  Vincula automaticamente o chat livre a quem enviar a primeira resposta.
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftSettings.teamRules.privateConversations}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      teamRules: {
                        ...draftSettings.teamRules,
                        privateConversations: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 accent-[#9F844A]"
                />
                <span>
                  <strong className="block text-foreground">Conversas privadas por atendente</strong>
                  Cada atendente enxerga apenas suas conversas e as não atribuídas.
                </span>
              </label>
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" disabled={savingSettings} onClick={handleSaveSettings}>
                {savingSettings ? 'Salvando...' : 'Salvar regras da equipe'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESPOSTAS RÁPIDAS */}
      {tab === 'quick_replies' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Respostas Rápidas (atalho <code className="font-mono text-[#8A6D36]">/</code>)
              </h4>
              <p className="text-xs text-muted-foreground">
                Digite <code className="font-mono">/</code> no Inbox WhatsApp para inserir textos padronizados em 1 segundo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {quickReplies.length === 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    seedDefaultQuickReplies(salonId).then(() =>
                      toast.success('4 modelos padrão carregados!')
                    )
                  }
                  className="h-8 text-xs gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#9F844A]" /> Carregar sugestões padrão
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setQrEditingId(undefined);
                  setQrShortcut('');
                  setQrTitle('');
                  setQrBody('');
                  setQrScope('salon');
                  setIsQrOpen(true);
                }}
                className="h-8 px-3 bg-[#171717] text-white text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Nova resposta rápida
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {quickReplies.length === 0 ? (
              <div className="md:col-span-2 bg-card border border-border rounded-xl p-8 text-center text-xs text-muted-foreground">
                O salão ainda não possui respostas rápidas. Crie a primeira ou carregue as sugestões padrão.
              </div>
            ) : (
              quickReplies.map((qr) => (
                <div
                  key={qr.id}
                  className="bg-card border border-border rounded-xl p-4 space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-[#8A6D36]">
                        /{qr.shortcut}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {qr.scope === 'salon' ? 'Salão (todos)' : 'Pessoal'}
                      </span>
                    </div>
                    <h5 className="text-xs font-semibold text-foreground mt-1">{qr.title}</h5>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {qr.body}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setQrEditingId(qr.id);
                        setQrShortcut(qr.shortcut);
                        setQrTitle(qr.title);
                        setQrBody(qr.body);
                        setQrScope(qr.scope);
                        setIsQrOpen(true);
                      }}
                      className="h-7 text-[11px]"
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        deleteQuickReply(salonId, qr.id).then(() => toast.success('Removida.'))
                      }
                      className="h-7 text-[11px] text-rose-700 hover:bg-rose-50"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REGRAS & AUTOMAÇÕES DO FUNIL */}
      {tab === 'automations' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Prazos &amp; Automações do Funil Comercial
            </h4>
            <p className="text-xs text-muted-foreground">
              Defina os gatilhos de SLA, alertas de espera e estimativa automática de valor.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Alerta em &ldquo;Aguardando resposta&rdquo; (horas)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={draftSettings.funnelRules.awaitingReplyAlertHours}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    funnelRules: {
                      ...draftSettings.funnelRules,
                      awaitingReplyAlertHours: Number(e.target.value) || 24,
                    },
                  })
                }
                className="mt-1 h-9 text-xs tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs">Card parado em atendimento (dias)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={draftSettings.funnelRules.inServiceStalledDays}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    funnelRules: {
                      ...draftSettings.funnelRules,
                      inServiceStalledDays: Number(e.target.value) || 2,
                    },
                  })
                }
                className="mt-1 h-9 text-xs tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs">Encerrar sem retorno como Perdido (dias)</Label>
              <Input
                type="number"
                min={3}
                max={90}
                value={draftSettings.funnelRules.autoLostDays}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    funnelRules: {
                      ...draftSettings.funnelRules,
                      autoLostDays: Number(e.target.value) || 14,
                    },
                  })
                }
                className="mt-1 h-9 text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={draftSettings.funnelRules.autoEstimateWithAi}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    funnelRules: {
                      ...draftSettings.funnelRules,
                      autoEstimateWithAi: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 accent-[#9F844A]"
              />
              <span>
                <strong className="block text-foreground">Estimar ticket com Lumi IA</strong>
                Quando o cliente citar um serviço sem valor fixo, calcula com base no catálogo real.
              </span>
            </label>
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 border border-border cursor-pointer">
              <input
                type="checkbox"
                checked={draftSettings.funnelRules.autoLinkClientByPhone}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    funnelRules: {
                      ...draftSettings.funnelRules,
                      autoLinkClientByPhone: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 accent-[#9F844A]"
              />
              <span>
                <strong className="block text-foreground">Vincular cliente pelo WhatsApp</strong>
                Cruza automaticamente o número recebido via webhook com a base oficial do salão.
              </span>
            </label>
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={savingSettings} onClick={handleSaveSettings}>
              {savingSettings ? 'Salvando...' : 'Salvar automações'}
            </Button>
          </div>
        </div>
      )}

      {/* TAB 4: LUMI IA NO CRM */}
      {tab === 'ai' && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Lumi IA — Assistente Inteligente do WhatsApp &amp; Funil
              </h4>
              <p className="text-xs text-muted-foreground">
                Personalize nome, tom de voz e diretrizes de atendimento sem alucinar preços.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={draftSettings.aiConfig.enabled}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    aiConfig: { ...draftSettings.aiConfig, enabled: e.target.checked },
                  })
                }
                className="accent-[#9F844A]"
              />
              Ativar Copiloto Lumi IA
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome da assistente</Label>
              <Input
                value={draftSettings.aiConfig.agentName}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    aiConfig: { ...draftSettings.aiConfig, agentName: e.target.value },
                  })
                }
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Tom de voz</Label>
              <select
                value={draftSettings.aiConfig.tone}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    aiConfig: {
                      ...draftSettings.aiConfig,
                      tone: e.target.value as 'acolhedor' | 'sofisticado' | 'objetivo',
                    },
                  })
                }
                className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
              >
                <option value="sofisticado">Sofisticado &amp; Atencioso</option>
                <option value="acolhedor">Acolhedor &amp; Próximo</option>
                <option value="objetivo">Objetivo &amp; Direto</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Saudação padrão sugerida</Label>
            <Textarea
              value={draftSettings.aiConfig.greetingMessage}
              onChange={(e) =>
                setDraftSettings({
                  ...draftSettings,
                  aiConfig: { ...draftSettings.aiConfig, greetingMessage: e.target.value },
                })
              }
              rows={2}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <Label className="text-xs">Instruções de atendimento &amp; qualificação</Label>
            <Textarea
              value={draftSettings.aiConfig.qualificationInstructions}
              onChange={(e) =>
                setDraftSettings({
                  ...draftSettings,
                  aiConfig: {
                    ...draftSettings.aiConfig,
                    qualificationInstructions: e.target.value,
                  },
                })
              }
              rows={3}
              className="mt-1 text-xs"
            />
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={savingSettings} onClick={handleSaveSettings}>
              {savingSettings ? 'Salvando...' : 'Salvar configurações da Lumi IA'}
            </Button>
          </div>
        </div>
      )}

      {/* TAB 5: GUIA DO CRM */}
      {tab === 'guide' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GUIDE_SECTIONS.map((sec) => (
            <div key={sec.id} className="bg-card border border-border rounded-xl p-5 space-y-2.5">
              <h4 className="text-sm font-semibold text-foreground">{sec.title}</h4>
              <p className="text-xs text-muted-foreground">{sec.summary}</p>
              <ul className="space-y-1.5 pt-1 text-xs text-foreground list-disc pl-4">
                {sec.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* MODAL VINCULAR ATENDENTE */}
      <Dialog open={isAddAttOpen} onOpenChange={setIsAddAttOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Vincular atendente ao CRM</DialogTitle>
            <DialogDescription>
              Escolha um profissional da equipe ou cadastre manualmente um atendente para o Inbox.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAttendant} className="space-y-3">
            <div>
              <Label className="text-xs">Profissional cadastrado (opcional)</Label>
              <select
                value={selectedProfId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedProfId(id);
                  const found = professionals.find((p) => p.id === id);
                  if (found) {
                    setAttName(found.name);
                    setAttEmail(found.email || '');
                  }
                }}
                className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
              >
                <option value="">Selecionar profissional ou preencher abaixo</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Nome do atendente *</Label>
              <Input
                required
                value={attName}
                onChange={(e) => setAttName(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={attEmail}
                  onChange={(e) => setAttEmail(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Perfil de permissão</Label>
                <select
                  value={attPerm}
                  onChange={(e) => setAttPerm(e.target.value as 'admin' | 'attendant' | 'viewer')}
                  className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                >
                  <option value="attendant">Atendente</option>
                  <option value="admin">Administrador</option>
                  <option value="viewer">Somente leitura</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddAttOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAtt}>
                {savingAtt ? 'Salvando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL RESPOSTA RÁPIDA */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {qrEditingId ? 'Editar resposta rápida' : 'Nova resposta rápida'}
            </DialogTitle>
            <DialogDescription>
              Use um atalho curto (sem espaços) para acionar rapidamente com &ldquo;/&rdquo; no chat.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveQuickReply} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Atalho *</Label>
                <Input
                  required
                  value={qrShortcut}
                  onChange={(e) => setQrShortcut(e.target.value.replace(/^\/+/, ''))}
                  placeholder="ex: pix"
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Visibilidade</Label>
                <select
                  value={qrScope}
                  onChange={(e) => setQrScope(e.target.value as 'salon' | 'personal')}
                  className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                >
                  <option value="salon">Todo o salão</option>
                  <option value="personal">Apenas para mim</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Título *</Label>
              <Input
                required
                value={qrTitle}
                onChange={(e) => setQrTitle(e.target.value)}
                placeholder="Ex.: Chave PIX para sinal"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Mensagem *</Label>
              <Textarea
                required
                value={qrBody}
                onChange={(e) => setQrBody(e.target.value)}
                rows={4}
                placeholder="Use {cliente} para personalizar automaticamente com o primeiro nome..."
                className="mt-1 text-xs"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsQrOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingQr}>
                {savingQr ? 'Salvando...' : 'Salvar modelo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

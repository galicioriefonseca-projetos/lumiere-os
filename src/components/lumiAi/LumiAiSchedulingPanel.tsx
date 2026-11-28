import React, { useMemo, useState } from 'react';
import {
  Bot,
  CalendarCheck2,
  CheckCircle2,
  ExternalLink,
  Send,
  Settings2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Appointment, Client, CrmCampaign, CrmSettings } from '@/types';
import {
  CampaignEvaluationResult,
  dispatchCampaignApi,
  evaluateCampaignAudienceApi,
  saveCrmCampaign,
  saveCrmSettings,
} from '@/services/crmService';
import { generateAiCampaignCopy } from '@/services/lumiAiService';

interface LumiAiSchedulingPanelProps {
  salonId: string;
  salonName: string;
  campaigns: CrmCampaign[];
  settings: CrmSettings;
  clients: Client[];
  appointments: Appointment[];
}

export function LumiAiSchedulingPanel({
  salonId,
  salonName,
  campaigns,
  settings,
  clients,
  appointments,
}: LumiAiSchedulingPanelProps) {
  const confirmationCampaign = useMemo(
    () => campaigns.find((c) => c.type === 'confirmation') || campaigns[0],
    [campaigns]
  );

  const [savingAutoSched, setSavingAutoSched] = useState(false);
  const [savingConf, setSavingConf] = useState(false);

  const [drawerMode, setDrawerMode] = useState<'auto_schedule' | 'confirmation' | null>(null);
  const [draftSettings, setDraftSettings] = useState<CrmSettings>(settings);
  const [draftConf, setDraftConf] = useState<CrmCampaign | null>(null);

  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [evaluation, setEvaluation] = useState<CampaignEvaluationResult | null>(null);
  const [waLinks, setWaLinks] = useState<Array<{ clientName: string; waLink: string }>>([]);

  const autoSchedEnabled = Boolean(
    settings.aiConfig.autoScheduleViaWhatsapp ?? settings.aiConfig.enabled
  );

  const handleToggleAutoSchedule = async () => {
    setSavingAutoSched(true);
    try {
      const next = !autoSchedEnabled;
      await saveCrmSettings(salonId, {
        ...settings,
        aiConfig: {
          ...settings.aiConfig,
          autoScheduleViaWhatsapp: next,
        },
      });
      toast.success(
        next
          ? 'Agendamento automático via Lumi IA ativado.'
          : 'Agendamento automático pausado.'
      );
    } catch {
      toast.error('Erro ao atualizar configuração de agendamento.');
    } finally {
      setSavingAutoSched(false);
    }
  };

  const handleToggleConfirmation = async () => {
    if (!confirmationCampaign) return;
    setSavingConf(true);
    try {
      const updated = { ...confirmationCampaign, enabled: !confirmationCampaign.enabled };
      await saveCrmCampaign(salonId, updated);
      toast.success(
        updated.enabled
          ? 'Confirmação automática ativada.'
          : 'Confirmação automática pausada.'
      );
    } catch {
      toast.error('Erro ao atualizar confirmação automática.');
    } finally {
      setSavingConf(false);
    }
  };

  const openAutoScheduleDrawer = () => {
    setDraftSettings(settings);
    setDrawerMode('auto_schedule');
  };

  const openConfirmationDrawer = () => {
    if (!confirmationCampaign) return;
    setDraftConf({
      ...confirmationCampaign,
      config: {
        ...confirmationCampaign.config,
        daysBefore: confirmationCampaign.config.daysBefore || 1,
        allowReschedule: confirmationCampaign.config.allowReschedule ?? true,
        allowCancel: confirmationCampaign.config.allowCancel ?? true,
      },
    });
    setEvaluation(null);
    setWaLinks([]);
    setDrawerMode('confirmation');
  };

  const handleSaveAutoSchedule = async () => {
    setSavingAutoSched(true);
    try {
      await saveCrmSettings(salonId, draftSettings);
      toast.success('Regras do agendamento via Lumi IA salvas.');
      setDrawerMode(null);
    } catch {
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSavingAutoSched(false);
    }
  };

  const handleSaveConfirmation = async () => {
    if (!draftConf) return;
    setSavingConf(true);
    try {
      await saveCrmCampaign(salonId, draftConf);
      toast.success('Configurações de confirmação salvas.');
    } catch {
      toast.error('Erro ao salvar confirmação.');
    } finally {
      setSavingConf(false);
    }
  };

  const handleGenerateConfirmationCopy = async () => {
    if (!draftConf) return;
    setGeneratingCopy(true);
    try {
      const res = await generateAiCampaignCopy({
        salonName,
        campaignType: 'confirmation',
        tone: settings.aiConfig.tone || 'sofisticado',
        customGoal: draftConf.config.allowReschedule
          ? 'Incluir convite cordial para confirmar ou avisar se precisar reagendar.'
          : undefined,
      });
      setDraftConf({ ...draftConf, messageTemplate: res.template });
      toast.success('Modelo atualizado pela Lumi IA.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao gerar texto.');
    } finally {
      setGeneratingCopy(false);
    }
  };

  const handleEvaluateConfirmations = async () => {
    if (!draftConf) return;
    setEvaluating(true);
    setWaLinks([]);
    try {
      const optOut =
        settings.aiConfig.includeOptOutFooter && settings.aiConfig.optOutPhrase?.trim()
          ? `\n\n${settings.aiConfig.optOutPhrase.trim()}`
          : '';
      const res = await evaluateCampaignAudienceApi({
        salonId,
        salonName,
        campaign: { ...draftConf, messageTemplate: `${draftConf.messageTemplate}${optOut}` },
        clients,
        appointments,
      });
      setEvaluation(res);
      toast.success(`${res.eligibleCount} agendamento(s) elegível(is) para confirmação.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao avaliar confirmações.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleDispatchConfirmations = async () => {
    if (!draftConf || !evaluation) return;
    const eligible = evaluation.candidates.filter((c) => c.eligible);
    if (eligible.length === 0) return;
    setDispatching(true);
    try {
      const res = await dispatchCampaignApi({
        salonId,
        campaign: draftConf,
        recipients: eligible,
      });
      setWaLinks(res.waLinks);
      toast.success(
        res.sentCloudCount > 0
          ? `${res.sentCloudCount} confirmação(ões) enviada(s) via WhatsApp Cloud!`
          : `${res.dispatchedCount} confirmação(ões) registrada(s) na fila.`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao disparar confirmações.');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#171717] tracking-tight">
          Agendamento &amp; Confirmação Inteligente
        </h2>
        <p className="text-xs text-[#6B6B6B] mt-0.5">
          Configure o atendimento autônomo pelo WhatsApp e reduza faltas com confirmações automáticas antes do serviço.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Auto Scheduling */}
        <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#B89B5E]/60 transition-colors">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#F5F1E9] border border-[#E5E2DC] flex items-center justify-center shrink-0">
              <Bot className="w-4.5 h-4.5 text-[#8A6D36]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#171717]">
                Agendamento Automático Lumi IA
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                Ative a qualificação e agendamento assistido pelo WhatsApp com o catálogo real de serviços e horários do seu estabelecimento.
              </p>
              <p className="text-[11px] text-[#6B6B6B] mt-2">
                Assistente: <strong className="text-[#171717]">{settings.aiConfig.agentName || 'Lumi'}</strong>{' '}
                · Tom: <strong className="text-[#171717]">{settings.aiConfig.tone}</strong>
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E2DC] flex items-center justify-between gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={autoSchedEnabled}
              disabled={savingAutoSched}
              onClick={() => void handleToggleAutoSchedule()}
              className="inline-flex items-center gap-2.5 text-xs font-medium text-[#171717] cursor-pointer min-h-[36px]"
            >
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  autoSchedEnabled ? 'bg-[#171717]' : 'bg-[#D6D3CC]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    autoSchedEnabled ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </span>
              <span>{autoSchedEnabled ? 'Ativo' : 'Inativo'}</span>
            </button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openAutoScheduleDrawer}
              className="h-9 px-3.5 text-xs border-[#E5E2DC] bg-[#FAF9F7] hover:bg-[#F5F1E9] text-[#171717] rounded-xl gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5 text-[#8A6D36]" />
              Personalizar
            </Button>
          </div>
        </div>

        {/* Card 2: Smart Confirmation */}
        {confirmationCampaign && (
          <div className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#B89B5E]/60 transition-colors">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#F5F1E9] border border-[#E5E2DC] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#171717]">
                  Confirmação de Horários
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                  {confirmationCampaign.description}
                </p>
                <p className="text-[11px] text-[#6B6B6B] mt-2 tabular-nums">
                  Disparos: <strong className="text-[#171717]">{confirmationCampaign.metrics.sentCount || 0}</strong>{' '}
                  · Antecedência: <strong className="text-[#171717]">{confirmationCampaign.config.daysBefore || 1} dia(s)</strong>
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E2DC] flex items-center justify-between gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={confirmationCampaign.enabled}
                disabled={savingConf}
                onClick={() => void handleToggleConfirmation()}
                className="inline-flex items-center gap-2.5 text-xs font-medium text-[#171717] cursor-pointer min-h-[36px]"
              >
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    confirmationCampaign.enabled ? 'bg-[#171717]' : 'bg-[#D6D3CC]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      confirmationCampaign.enabled ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </span>
                <span>{confirmationCampaign.enabled ? 'Ativo' : 'Pausado'}</span>
              </button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openConfirmationDrawer}
                className="h-9 px-3.5 text-xs border-[#E5E2DC] bg-[#FAF9F7] hover:bg-[#F5F1E9] text-[#171717] rounded-xl gap-1.5"
              >
                <CalendarCheck2 className="w-3.5 h-3.5 text-[#8A6D36]" />
                Personalizar &amp; Disparar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer for Auto Scheduling */}
      {drawerMode === 'auto_schedule' && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setDrawerMode(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-white h-full border-l border-[#E5E2DC] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-[#E5E2DC] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#171717]">
                  Agendamento Automático Lumi IA
                </h3>
                <p className="text-xs text-[#6B6B6B]">
                  Personalize o comportamento da assistente nas conversas de WhatsApp
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerMode(null)}
                className="p-2 rounded-xl hover:bg-[#FAF9F7] text-[#6B6B6B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome da Assistente</Label>
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
                  <Label className="text-xs">Tom de Voz</Label>
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
                    className="mt-1 w-full h-9 rounded-md border border-[#E5E2DC] bg-white px-2.5 text-xs"
                  >
                    <option value="sofisticado">Sofisticado (Quiet Luxury)</option>
                    <option value="acolhedor">Acolhedor &amp; Próximo</option>
                    <option value="objetivo">Direto &amp; Ágil</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Mensagem de Boas-vindas</Label>
                <Textarea
                  rows={3}
                  value={draftSettings.aiConfig.greetingMessage}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      aiConfig: { ...draftSettings.aiConfig, greetingMessage: e.target.value },
                    })
                  }
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Diretrizes de Qualificação &amp; Agenda</Label>
                <Textarea
                  rows={4}
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
                  className="mt-1 text-xs"
                />
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#E5E2DC]">
                <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer text-xs">
                  <span className="text-[#171717]">
                    Transferir para humano se cliente negociar preço ou pedir desconto
                  </span>
                  <input
                    type="checkbox"
                    checked={draftSettings.aiConfig.handoffOnPriceObjection}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        aiConfig: {
                          ...draftSettings.aiConfig,
                          handoffOnPriceObjection: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-[#171717]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer text-xs">
                  <span className="text-[#171717]">
                    Transferir imediatamente quando o cliente pedir atendente humano
                  </span>
                  <input
                    type="checkbox"
                    checked={draftSettings.aiConfig.handoffOnHumanRequest}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        aiConfig: {
                          ...draftSettings.aiConfig,
                          handoffOnHumanRequest: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-[#171717]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer text-xs">
                  <span className="text-[#171717]">
                    Responder somente fora do horário comercial (modo plantão)
                  </span>
                  <input
                    type="checkbox"
                    checked={draftSettings.aiConfig.workingHoursOnly}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        aiConfig: {
                          ...draftSettings.aiConfig,
                          workingHoursOnly: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-[#171717]"
                  />
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E5E2DC] bg-[#FAF9F7] flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDrawerMode(null)}
                className="h-10 px-4 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={savingAutoSched}
                onClick={handleSaveAutoSchedule}
                className="h-10 px-5 text-xs bg-[#171717] text-white"
              >
                {savingAutoSched ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer for Confirmation */}
      {drawerMode === 'confirmation' && draftConf && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setDrawerMode(null)}
          />
          <div className="relative z-10 w-full max-w-xl bg-white h-full border-l border-[#E5E2DC] flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-[#E5E2DC] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#171717]">
                  Confirmação Automática de Horários
                </h3>
                <p className="text-xs text-[#6B6B6B]">
                  Defina regras de envio, opções de resposta e dispare confirmações pendentes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerMode(null)}
                className="p-2 rounded-xl hover:bg-[#FAF9F7] text-[#6B6B6B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Antecedência</Label>
                  <select
                    value={draftConf.config.daysBefore || 1}
                    onChange={(e) =>
                      setDraftConf({
                        ...draftConf,
                        config: { ...draftConf.config, daysBefore: Number(e.target.value) || 1 },
                      })
                    }
                    className="mt-1 w-full h-9 rounded-md border border-[#E5E2DC] bg-white px-2.5 text-xs"
                  >
                    <option value={1}>1 dia antes (recomendado)</option>
                    <option value={2}>2 dias antes</option>
                    <option value={3}>3 dias antes</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Janela inicial</Label>
                  <Input
                    type="time"
                    value={draftConf.sendWindowStart}
                    onChange={(e) =>
                      setDraftConf({ ...draftConf, sendWindowStart: e.target.value })
                    }
                    className="mt-1 h-9 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs">Janela final</Label>
                  <Input
                    type="time"
                    value={draftConf.sendWindowEnd}
                    onChange={(e) =>
                      setDraftConf({ ...draftConf, sendWindowEnd: e.target.value })
                    }
                    className="mt-1 h-9 text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-2.5">
                <p className="text-xs font-semibold text-[#171717]">
                  Opções oferecidas ao cliente na confirmação
                </p>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span>Permitir solicitação de reagendamento</span>
                  <input
                    type="checkbox"
                    checked={draftConf.config.allowReschedule ?? true}
                    onChange={(e) =>
                      setDraftConf({
                        ...draftConf,
                        config: { ...draftConf.config, allowReschedule: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#171717]"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span>Permitir cancelamento via link / resposta</span>
                  <input
                    type="checkbox"
                    checked={draftConf.config.allowCancel ?? true}
                    onChange={(e) =>
                      setDraftConf({
                        ...draftConf,
                        config: { ...draftConf.config, allowCancel: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#171717]"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-semibold text-[#171717]">
                    Mensagem de Confirmação
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={generatingCopy}
                    onClick={handleGenerateConfirmationCopy}
                    className="h-8 px-3 text-xs border-[#D8C79F] bg-[#F5F1E9] text-[#8A6D36] gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generatingCopy ? 'Gerando...' : 'Gerar com Lumi IA'}
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  value={draftConf.messageTemplate}
                  onChange={(e) =>
                    setDraftConf({ ...draftConf, messageTemplate: e.target.value })
                  }
                  className="text-xs"
                />
              </div>

              <div className="pt-4 border-t border-[#E5E2DC] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-[#171717]">
                      Agendamentos de Hoje e Amanhã
                    </h4>
                    <p className="text-[11px] text-[#6B6B6B]">
                      Verifique quem ainda aguarda confirmação e envie agora.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={evaluating}
                      onClick={handleEvaluateConfirmations}
                      className="h-9 text-xs gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5 text-[#8A6D36]" />
                      {evaluating ? 'Verificando...' : 'Listar Pendentes'}
                    </Button>
                    {evaluation && evaluation.eligibleCount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={dispatching}
                        onClick={handleDispatchConfirmations}
                        className="h-9 text-xs bg-[#171717] text-white gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {dispatching ? 'Enviando...' : `Enviar (${evaluation.eligibleCount})`}
                      </Button>
                    )}
                  </div>
                </div>

                {evaluation && (
                  <div className="rounded-xl border border-[#E5E2DC] max-h-48 overflow-y-auto divide-y divide-[#E5E2DC]">
                    {evaluation.candidates.length === 0 ? (
                      <p className="p-4 text-center text-xs text-[#6B6B6B]">
                        Nenhum agendamento pendente de confirmação para hoje ou amanhã.
                      </p>
                    ) : (
                      evaluation.candidates.map((cand, idx) => (
                        <div
                          key={`${cand.clientId}_${idx}`}
                          className="px-3.5 py-2 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-medium text-[#171717]">{cand.clientName}</p>
                            <p className="text-[11px] text-[#6B6B6B]">
                              {cand.clientPhone || 'Sem telefone'} · {cand.reason}
                            </p>
                          </div>
                          <span
                            className={`text-[11px] font-medium ${
                              cand.eligible ? 'text-emerald-700' : 'text-[#6B6B6B]'
                            }`}
                          >
                            {cand.eligible ? 'Elegível' : cand.blockedReason}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {waLinks.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-2">
                    <p className="text-xs font-medium text-[#171717]">
                      Links diretos WhatsApp gerados:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {waLinks.map((w, i) => (
                        <a
                          key={i}
                          href={w.waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#E5E2DC] text-xs font-medium text-emerald-700"
                        >
                          {w.clientName} <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E5E2DC] bg-[#FAF9F7] flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDrawerMode(null)}
                className="h-10 px-4 text-xs"
              >
                Fechar
              </Button>
              <Button
                type="button"
                disabled={savingConf}
                onClick={handleSaveConfirmation}
                className="h-10 px-5 text-xs bg-[#171717] text-white"
              >
                {savingConf ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

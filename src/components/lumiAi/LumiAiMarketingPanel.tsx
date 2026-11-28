import React, { useMemo, useState } from 'react';
import {
  Cake,
  ExternalLink,
  Megaphone,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Star,
  Tag,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  Appointment,
  Client,
  CrmCampaign,
  CrmSettings,
  Service,
} from '@/types';
import {
  CampaignEvaluationResult,
  dispatchCampaignApi,
  evaluateCampaignAudienceApi,
  saveCrmCampaign,
} from '@/services/crmService';
import { generateAiCampaignCopy } from '@/services/lumiAiService';

interface LumiAiMarketingPanelProps {
  salonId: string;
  salonName: string;
  campaigns: CrmCampaign[];
  clients: Client[];
  appointments: Appointment[];
  services: Service[];
  settings: CrmSettings;
}

const TEMPLATE_TOKENS = ['{cliente}', '{salao}', '{servico}', '{data}', '{hora}'];

const CAMPAIGN_ICON_MAP = {
  service_return: RefreshCw,
  birthday: Cake,
  inactive_clients: UserMinus,
  post_service_csat: Star,
  promotion: Tag,
  confirmation: Megaphone,
} as const;

export function LumiAiMarketingPanel({
  salonId,
  salonName,
  campaigns,
  clients,
  appointments,
  services,
  settings,
}: LumiAiMarketingPanelProps) {
  const marketingCampaigns = useMemo(
    () => campaigns.filter((c) => c.type !== 'confirmation'),
    [campaigns]
  );

  const [drawerCampaign, setDrawerCampaign] = useState<CrmCampaign | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [evaluation, setEvaluation] = useState<CampaignEvaluationResult | null>(null);
  const [waLinks, setWaLinks] = useState<Array<{ clientName: string; waLink: string }>>([]);

  const handleToggleEnabled = async (camp: CrmCampaign) => {
    const updated: CrmCampaign = { ...camp, enabled: !camp.enabled };
    setSavingId(camp.id);
    try {
      await saveCrmCampaign(salonId, updated);
      if (drawerCampaign?.id === camp.id) {
        setDrawerCampaign(updated);
      }
      toast.success(updated.enabled ? `"${camp.title}" ativada.` : `"${camp.title}" pausada.`);
    } catch {
      toast.error('Não foi possível alterar o status da automação.');
    } finally {
      setSavingId(null);
    }
  };

  const openDrawer = (camp: CrmCampaign) => {
    setDrawerCampaign({
      ...camp,
      config: {
        ...camp.config,
        reminderDaysList: camp.config.reminderDaysList || [1],
        customTemplateEnabled: camp.config.customTemplateEnabled ?? true,
      },
    });
    setEvaluation(null);
    setWaLinks([]);
  };

  const handleSaveDrawer = async () => {
    if (!drawerCampaign) return;
    setSavingId(drawerCampaign.id);
    try {
      await saveCrmCampaign(salonId, drawerCampaign);
      toast.success(`Configurações de "${drawerCampaign.title}" salvas.`);
    } catch {
      toast.error('Erro ao salvar configurações da régua.');
    } finally {
      setSavingId(null);
    }
  };

  const handleGenerateAiCopy = async () => {
    if (!drawerCampaign) return;
    setGeneratingCopy(true);
    try {
      const res = await generateAiCampaignCopy({
        salonName,
        campaignType: drawerCampaign.type,
        tone: settings.aiConfig.tone || 'sofisticado',
        promoServiceName: drawerCampaign.config.promoServiceName,
        promoDiscountLabel: drawerCampaign.config.promoDiscountLabel,
      });
      setDrawerCampaign({
        ...drawerCampaign,
        messageTemplate: res.template,
        config: { ...drawerCampaign.config, customTemplateEnabled: true },
      });
      toast.success(
        res.isAiGenerated
          ? 'Texto criado pela Lumi IA (Gemini).'
          : 'Sugestão otimizada aplicada ao template.'
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar texto com a Lumi IA.');
    } finally {
      setGeneratingCopy(false);
    }
  };

  const buildRenderedCampaignForEvaluate = (camp: CrmCampaign): CrmCampaign => {
    const optOut =
      settings.aiConfig.includeOptOutFooter && settings.aiConfig.optOutPhrase?.trim()
        ? `\n\n${settings.aiConfig.optOutPhrase.trim()}`
        : '';
    return {
      ...camp,
      messageTemplate: `${camp.messageTemplate}${optOut}`,
    };
  };

  const handleEvaluateAudience = async () => {
    if (!drawerCampaign) return;
    setEvaluating(true);
    setWaLinks([]);
    try {
      const res = await evaluateCampaignAudienceApi({
        salonId,
        salonName,
        campaign: buildRenderedCampaignForEvaluate(drawerCampaign),
        clients,
        appointments,
      });
      setEvaluation(res);
      toast.success(`${res.eligibleCount} cliente(s) elegível(is) encontrado(s).`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao avaliar público.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleDispatchNow = async () => {
    if (!drawerCampaign || !evaluation) return;
    const eligible = evaluation.candidates.filter((c) => c.eligible);
    if (eligible.length === 0) {
      toast.error('Nenhum cliente elegível na fila.');
      return;
    }
    setDispatching(true);
    try {
      const res = await dispatchCampaignApi({
        salonId,
        campaign: drawerCampaign,
        recipients: eligible,
      });
      setWaLinks(res.waLinks);
      toast.success(
        res.sentCloudCount > 0
          ? `${res.sentCloudCount} mensagem(ns) enviada(s) via WhatsApp Cloud!`
          : `${res.dispatchedCount} disparo(s) registrado(s). Use os links diretos abaixo para enviar pelo WhatsApp Web.`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao disparar campanha.');
    } finally {
      setDispatching(false);
    }
  };

  const previewRenderedMessage = useMemo(() => {
    if (!drawerCampaign) return '';
    const sampleService =
      drawerCampaign.config.promoServiceName ||
      services.find((s) => s.isActive !== false)?.name ||
      'Coloração & Hidratação';
    const base = drawerCampaign.messageTemplate
      .replace(/\{cliente\}/g, 'Mariana')
      .replace(/\{cliente_completo\}/g, 'Mariana Oliveira')
      .replace(/\{salao\}/g, salonName || 'Nosso Salão')
      .replace(/\{servico\}/g, sampleService)
      .replace(/\{data\}/g, '26/11')
      .replace(/\{hora\}/g, '15:00');
    const optOut =
      settings.aiConfig.includeOptOutFooter && settings.aiConfig.optOutPhrase?.trim()
        ? `\n\n${settings.aiConfig.optOutPhrase.trim()}`
        : '';
    return `${base}${optOut}`;
  }, [drawerCampaign, salonName, services, settings.aiConfig]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#171717] tracking-tight">
          Marketing Inteligente &amp; Promoções
        </h2>
        <p className="text-xs text-[#6B6B6B] mt-0.5">
          Ative réguas automáticas ou crie campanhas promocionais com textos gerados pela Lumi IA e envio segmentado.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {marketingCampaigns.map((camp) => {
          const IconComp = CAMPAIGN_ICON_MAP[camp.type] || Megaphone;
          const isToggling = savingId === camp.id;

          return (
            <div
              key={camp.id}
              className="bg-white border border-[#E5E2DC] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#B89B5E]/60 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F5F1E9] border border-[#E5E2DC] flex items-center justify-center shrink-0">
                  <IconComp className="w-4.5 h-4.5 text-[#8A6D36]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#171717] truncate">
                      {camp.title}
                    </h3>
                    {camp.type === 'promotion' && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A6D36]">
                        Campanha Ativa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                    {camp.description}
                  </p>
                  <p className="text-[11px] text-[#6B6B6B] mt-2 tabular-nums">
                    Disparos: <strong className="text-[#171717]">{camp.metrics.sentCount || 0}</strong>{' '}
                    · Conversões: <strong className="text-[#171717]">{camp.metrics.convertedBookings || 0}</strong>
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E2DC] flex items-center justify-between gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={camp.enabled}
                  disabled={isToggling}
                  onClick={() => void handleToggleEnabled(camp)}
                  className="inline-flex items-center gap-2.5 text-xs font-medium text-[#171717] cursor-pointer min-h-[36px]"
                >
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      camp.enabled ? 'bg-[#171717]' : 'bg-[#D6D3CC]'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        camp.enabled ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                  <span>{camp.enabled ? 'Ativo' : 'Pausado'}</span>
                </button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openDrawer(camp)}
                  className="h-9 px-3.5 text-xs border-[#E5E2DC] bg-[#FAF9F7] hover:bg-[#F5F1E9] text-[#171717] rounded-xl gap-1.5"
                >
                  <Settings2 className="w-3.5 h-3.5 text-[#8A6D36]" />
                  Personalizar &amp; Disparar
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-over Configuration Drawer */}
      {drawerCampaign && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setDrawerCampaign(null)}
          />
          <div className="relative z-10 w-full max-w-xl bg-white h-full border-l border-[#E5E2DC] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-[#E5E2DC] flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-[#171717]">{drawerCampaign.title}</h3>
                <p className="text-xs text-[#6B6B6B]">{drawerCampaign.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerCampaign(null)}
                aria-label="Fechar painel"
                className="p-2 rounded-xl hover:bg-[#FAF9F7] text-[#6B6B6B] hover:text-[#171717] cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Specific rules per type */}
              {drawerCampaign.type === 'service_return' && (
                <div className="space-y-3 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
                  <p className="text-xs font-semibold text-[#171717]">Envio dos Lembretes</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[7, 3, 1].map((days) => {
                      const active = (drawerCampaign.config.reminderDaysList || [1]).includes(days);
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => {
                            const current = drawerCampaign.config.reminderDaysList || [1];
                            const next = active
                              ? current.filter((d) => d !== days)
                              : [...current, days];
                            setDrawerCampaign({
                              ...drawerCampaign,
                              config: {
                                ...drawerCampaign.config,
                                reminderDaysList: next.length > 0 ? next : [1],
                              },
                            });
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                            active
                              ? 'bg-[#171717] text-white border-[#171717]'
                              : 'bg-white text-[#171717] border-[#E5E2DC] hover:bg-[#F5F1E9]'
                          }`}
                        >
                          {days} {days === 1 ? 'dia antes' : 'dias antes'}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <Label className="text-xs text-[#6B6B6B]">Ciclo padrão de retorno (dias)</Label>
                    <Input
                      type="number"
                      min={7}
                      max={180}
                      value={drawerCampaign.config.defaultReturnDays || 45}
                      onChange={(e) =>
                        setDrawerCampaign({
                          ...drawerCampaign,
                          config: {
                            ...drawerCampaign.config,
                            defaultReturnDays: Math.max(7, Number(e.target.value) || 45),
                          },
                        })
                      }
                      className="mt-1 h-9 text-xs bg-white tabular-nums"
                    />
                  </div>
                </div>
              )}

              {drawerCampaign.type === 'birthday' && (
                <div className="space-y-3 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
                  <Label className="text-xs font-semibold text-[#171717]">Momento do Envio</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'on_day', label: 'No dia exato' },
                        { id: 'days_before', label: 'Dias antes' },
                        { id: 'month_start', label: 'Início do mês' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setDrawerCampaign({
                            ...drawerCampaign,
                            config: { ...drawerCampaign.config, birthdayTiming: opt.id },
                          })
                        }
                        className={`py-2 px-3 rounded-xl border text-xs font-medium cursor-pointer ${
                          (drawerCampaign.config.birthdayTiming || 'on_day') === opt.id
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-white text-[#171717] border-[#E5E2DC]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {drawerCampaign.type === 'inactive_clients' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
                  <div>
                    <Label className="text-xs">Meses sem visita</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={drawerCampaign.config.inactiveMonths || 3}
                      onChange={(e) =>
                        setDrawerCampaign({
                          ...drawerCampaign,
                          config: {
                            ...drawerCampaign.config,
                            inactiveMonths: Math.max(1, Number(e.target.value) || 3),
                          },
                        })
                      }
                      className="mt-1 h-9 text-xs bg-white tabular-nums"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ignorar com agenda nos próx. (dias)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={180}
                      value={drawerCampaign.config.blockBookedNextDays ?? 90}
                      onChange={(e) =>
                        setDrawerCampaign({
                          ...drawerCampaign,
                          config: {
                            ...drawerCampaign.config,
                            blockBookedNextDays: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                      className="mt-1 h-9 text-xs bg-white tabular-nums"
                    />
                  </div>
                </div>
              )}

              {drawerCampaign.type === 'promotion' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
                  <div>
                    <Label className="text-xs">Serviço em Destaque</Label>
                    <select
                      value={drawerCampaign.config.promoServiceName || ''}
                      onChange={(e) =>
                        setDrawerCampaign({
                          ...drawerCampaign,
                          config: {
                            ...drawerCampaign.config,
                            promoServiceName: e.target.value,
                          },
                        })
                      }
                      className="mt-1 w-full h-9 rounded-md border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717]"
                    >
                      <option value="">Usar último serviço de cada cliente</option>
                      {services
                        .filter((s) => s.isActive !== false)
                        .map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Condição / Benefício (opcional)</Label>
                    <Input
                      placeholder="Ex: 15% OFF de Terça a Quinta"
                      value={drawerCampaign.config.promoDiscountLabel || ''}
                      onChange={(e) =>
                        setDrawerCampaign({
                          ...drawerCampaign,
                          config: {
                            ...drawerCampaign.config,
                            promoDiscountLabel: e.target.value,
                          },
                        })
                      }
                      className="mt-1 h-9 text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Window & Daily Limit */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Início dos envios</Label>
                  <Input
                    type="time"
                    value={drawerCampaign.sendWindowStart}
                    onChange={(e) =>
                      setDrawerCampaign({ ...drawerCampaign, sendWindowStart: e.target.value })
                    }
                    className="mt-1 h-9 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fim dos envios</Label>
                  <Input
                    type="time"
                    value={drawerCampaign.sendWindowEnd}
                    onChange={(e) =>
                      setDrawerCampaign({ ...drawerCampaign, sendWindowEnd: e.target.value })
                    }
                    className="mt-1 h-9 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs">Limite/dia</Label>
                  <Input
                    type="number"
                    min={1}
                    max={250}
                    value={drawerCampaign.dailyLimit}
                    onChange={(e) =>
                      setDrawerCampaign({
                        ...drawerCampaign,
                        dailyLimit: Math.max(1, Number(e.target.value) || 50),
                      })
                    }
                    className="mt-1 h-9 text-xs tabular-nums"
                  />
                </div>
              </div>

              {/* Message template + Lumi Copy */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs font-semibold text-[#171717]">
                    Mensagem Personalizada
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={generatingCopy}
                    onClick={handleGenerateAiCopy}
                    className="h-8 px-3 text-xs border-[#D8C79F] bg-[#F5F1E9] hover:bg-[#EDE4D3] text-[#8A6D36] gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generatingCopy ? 'Gerando...' : 'Gerar com Lumi IA'}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_TOKENS.map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() =>
                        setDrawerCampaign({
                          ...drawerCampaign,
                          messageTemplate: `${drawerCampaign.messageTemplate} ${tok}`,
                        })
                      }
                      className="text-[11px] px-2 py-0.5 rounded-md border border-[#E5E2DC] bg-[#FAF9F7] hover:bg-[#F5F1E9] text-[#171717] font-mono cursor-pointer"
                    >
                      {tok}
                    </button>
                  ))}
                </div>

                <Textarea
                  rows={4}
                  value={drawerCampaign.messageTemplate}
                  onChange={(e) =>
                    setDrawerCampaign({ ...drawerCampaign, messageTemplate: e.target.value })
                  }
                  className="text-xs leading-relaxed"
                />

                <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6B6B] block">
                    Pré-visualização no WhatsApp
                  </span>
                  <p className="text-xs text-[#171717] whitespace-pre-wrap leading-relaxed">
                    {previewRenderedMessage}
                  </p>
                </div>
              </div>

              {/* Audience evaluation & dispatch */}
              <div className="pt-4 border-t border-[#E5E2DC] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-[#171717]">
                      Avaliação &amp; Disparo Real na Base
                    </h4>
                    <p className="text-[11px] text-[#6B6B6B]">
                      Audite exatamente quem receberá antes de iniciar os envios.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={evaluating}
                      onClick={handleEvaluateAudience}
                      className="h-9 text-xs gap-1.5 border-[#E5E2DC]"
                    >
                      <Users className="w-3.5 h-3.5 text-[#8A6D36]" />
                      {evaluating ? 'Avaliando...' : 'Calcular Público'}
                    </Button>
                    {evaluation && evaluation.eligibleCount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={dispatching}
                        onClick={handleDispatchNow}
                        className="h-9 text-xs bg-[#171717] text-white gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {dispatching
                          ? 'Enviando...'
                          : `Disparar (${Math.min(50, evaluation.eligibleCount)})`}
                      </Button>
                    )}
                  </div>
                </div>

                {evaluation && (
                  <div className="rounded-xl border border-[#E5E2DC] overflow-hidden">
                    <div className="px-3.5 py-2 bg-[#FAF9F7] border-b border-[#E5E2DC] flex justify-between text-xs tabular-nums">
                      <span>
                        Avaliados: <strong>{evaluation.totalEvaluated}</strong> · Elegíveis:{' '}
                        <strong className="text-emerald-700">{evaluation.eligibleCount}</strong>
                      </span>
                      <span className="text-[#6B6B6B]">
                        Fila: {evaluation.estimatedDaysToClear} dia(s)
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#E5E2DC]">
                      {evaluation.candidates.length === 0 ? (
                        <p className="p-4 text-center text-xs text-[#6B6B6B]">
                          Nenhum cliente atendeu aos critérios neste momento.
                        </p>
                      ) : (
                        evaluation.candidates.map((cand, i) => (
                          <div
                            key={`${cand.clientId}_${i}`}
                            className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-[#171717] truncate">
                                {cand.clientName}
                              </p>
                              <p className="text-[11px] text-[#6B6B6B] truncate">
                                {cand.clientPhone || 'Sem telefone'} · {cand.reason}
                              </p>
                            </div>
                            <span
                              className={`text-[11px] font-medium shrink-0 ${
                                cand.eligible ? 'text-emerald-700' : 'text-[#6B6B6B]'
                              }`}
                            >
                              {cand.eligible ? 'Elegível' : cand.blockedReason || 'Ignorado'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {waLinks.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-2">
                    <p className="text-xs font-medium text-[#171717]">
                      Links diretos gerados para envio rápido pelo WhatsApp:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {waLinks.map((w, idx) => (
                        <a
                          key={idx}
                          href={w.waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E2DC] text-xs font-medium text-emerald-700 hover:border-emerald-400"
                        >
                          {w.clientName} <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E5E2DC] bg-[#FAF9F7] flex items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDrawerCampaign(null)}
                className="h-10 px-4 text-xs"
              >
                Fechar
              </Button>
              <Button
                type="button"
                disabled={savingId === drawerCampaign.id}
                onClick={handleSaveDrawer}
                className="h-10 px-5 text-xs bg-[#171717] hover:bg-[#2A2A2A] text-white"
              >
                {savingId === drawerCampaign.id ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

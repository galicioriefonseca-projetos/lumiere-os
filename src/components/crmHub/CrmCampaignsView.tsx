import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Send,
  Star,
  Users,
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
  CrmCampaignDispatch,
} from '@/types';
import {
  CampaignCandidate,
  CampaignEvaluationResult,
  dispatchCampaignApi,
  evaluateCampaignAudienceApi,
  saveCrmCampaign,
} from '@/services/crmService';

interface CrmCampaignsViewProps {
  salonId: string;
  salonName: string;
  campaigns: CrmCampaign[];
  dispatches: CrmCampaignDispatch[];
  clients: Client[];
  appointments: Appointment[];
}

type CampaignSubTab = 'configure' | 'queue' | 'results';

const TEMPLATE_VARS = [
  { token: '{cliente}', label: 'Primeiro nome' },
  { token: '{salao}', label: 'Nome do salão' },
  { token: '{servico}', label: 'Serviço' },
  { token: '{data}', label: 'Data' },
  { token: '{hora}', label: 'Hora' },
];

export function CrmCampaignsView({
  salonId,
  salonName,
  campaigns,
  dispatches,
  clients,
  appointments,
}: CrmCampaignsViewProps) {
  const [subTab, setSubTab] = useState<CampaignSubTab>('configure');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    campaigns[0]?.id || 'confirmation'
  );
  const [draftCampaign, setDraftCampaign] = useState<CrmCampaign | null>(null);
  const [saving, setSaving] = useState(false);

  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<CampaignEvaluationResult | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [lastWaLinks, setLastWaLinks] = useState<Array<{ clientName: string; waLink: string }>>([]);

  const activeCampaign = useMemo(() => {
    if (draftCampaign && draftCampaign.id === selectedCampaignId) return draftCampaign;
    return campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0];
  }, [campaigns, draftCampaign, selectedCampaignId]);

  const selectCampaign = (camp: CrmCampaign) => {
    setSelectedCampaignId(camp.id);
    setDraftCampaign(camp);
    setEvaluation(null);
    setLastWaLinks([]);
  };

  const updateDraft = (patch: Partial<CrmCampaign>) => {
    if (!activeCampaign) return;
    setDraftCampaign({ ...activeCampaign, ...patch });
  };

  const handleSave = async () => {
    if (!activeCampaign) return;
    setSaving(true);
    try {
      await saveCrmCampaign(salonId, activeCampaign);
      toast.success(`Campanha "${activeCampaign.title}" salva!`);
    } catch {
      toast.error('Erro ao salvar campanha.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (camp: CrmCampaign) => {
    const updated: CrmCampaign = { ...camp, enabled: !camp.enabled };
    try {
      await saveCrmCampaign(salonId, updated);
      if (selectedCampaignId === camp.id) setDraftCampaign(updated);
      toast.success(updated.enabled ? 'Campanha ativada!' : 'Campanha pausada.');
    } catch {
      toast.error('Erro ao alterar status da campanha.');
    }
  };

  const handleEvaluate = async () => {
    if (!activeCampaign) return;
    setEvaluating(true);
    setLastWaLinks([]);
    try {
      const res = await evaluateCampaignAudienceApi({
        salonId,
        salonName,
        campaign: activeCampaign,
        clients,
        appointments,
      });
      setEvaluation(res);
      toast.success(`${res.eligibleCount} clientes elegíveis identificados na base.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular público.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleDispatch = async () => {
    if (!activeCampaign || !evaluation) return;
    const eligible = evaluation.candidates.filter((c) => c.eligible);
    if (eligible.length === 0) {
      toast.error('Nenhum destinatário elegível para disparar agora.');
      return;
    }
    setDispatching(true);
    try {
      const res = await dispatchCampaignApi({
        salonId,
        campaign: activeCampaign,
        recipients: eligible,
      });
      setLastWaLinks(res.waLinks);
      toast.success(
        res.sentCloudCount > 0
          ? `${res.sentCloudCount} mensagens enviadas via WhatsApp Cloud!`
          : `${res.dispatchedCount} envios registrados. Use os links diretos abaixo se não houver Cloud API.`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao disparar campanha.');
    } finally {
      setDispatching(false);
    }
  };

  const previewText = useMemo(() => {
    if (!activeCampaign) return '';
    return activeCampaign.messageTemplate
      .replace(/\{cliente\}/g, 'Camila')
      .replace(/\{cliente_completo\}/g, 'Camila Ferreira')
      .replace(/\{salao\}/g, salonName || 'Lumière Atelier')
      .replace(/\{servico\}/g, 'Mechas & Tratamento')
      .replace(/\{data\}/g, '24/11')
      .replace(/\{hora\}/g, '14:30');
  }, [activeCampaign, salonName]);

  const totalSent = campaigns.reduce((acc, c) => acc + (c.metrics.sentCount || 0), 0);
  const totalConverted = campaigns.reduce((acc, c) => acc + (c.metrics.convertedBookings || 0), 0);
  const totalRecovered = campaigns.reduce((acc, c) => acc + (c.metrics.recoveredRevenue || 0), 0);
  const totalCsatCount = campaigns.reduce((acc, c) => acc + (c.metrics.csatCount || 0), 0);
  const totalCsatSum = campaigns.reduce((acc, c) => acc + (c.metrics.csatSum || 0), 0);

  return (
    <div className="space-y-4">
      {/* Sub-navegação */}
      <div className="bg-card border border-border rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg border border-border">
          {(
            [
              { id: 'configure', label: 'Configurar & Disparar', icon: Megaphone },
              { id: 'queue', label: `Agenda & Fila de Envios (${dispatches.length})`, icon: CalendarClock },
              { id: 'results', label: 'Resultados das Campanhas', icon: BarChart3 },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                subTab === t.id
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5 text-[#9F844A]" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'configure' && activeCampaign && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Seletor das 5 campanhas */}
          <div className="lg:col-span-4 space-y-2">
            {campaigns.map((camp) => {
              const isSelected = camp.id === activeCampaign.id;
              return (
                <div
                  key={camp.id}
                  onClick={() => selectCampaign(camp)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-card border-[#B89B5E] shadow-xs'
                      : 'bg-card border-border hover:bg-secondary/50'
                  }`}
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-foreground">{camp.title}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {camp.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                      Limite: {camp.dailyLimit}/dia · Enviadas: {camp.metrics.sentCount || 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleActive(camp);
                    }}
                    className={`text-[11px] font-medium px-2 py-1 rounded-md border shrink-0 flex items-center gap-1 cursor-pointer ${
                      camp.enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-secondary text-muted-foreground border-border'
                    }`}
                  >
                    {camp.enabled ? (
                      <>
                        <PlayCircle className="w-3 h-3" /> Ativa
                      </>
                    ) : (
                      <>
                        <PauseCircle className="w-3 h-3" /> Pausada
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Editor da campanha selecionada */}
          <div className="lg:col-span-8 bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-foreground">{activeCampaign.title}</h3>
                <p className="text-xs text-muted-foreground">{activeCampaign.description}</p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={handleSave}
                className="h-8 px-4 bg-[#171717] text-white text-xs"
              >
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </div>

            {/* Regras e limites */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Janela inicial</Label>
                <Input
                  type="time"
                  value={activeCampaign.sendWindowStart}
                  onChange={(e) => updateDraft({ sendWindowStart: e.target.value })}
                  className="mt-1 h-9 text-xs tabular-nums"
                />
              </div>
              <div>
                <Label className="text-xs">Janela final</Label>
                <Input
                  type="time"
                  value={activeCampaign.sendWindowEnd}
                  onChange={(e) => updateDraft({ sendWindowEnd: e.target.value })}
                  className="mt-1 h-9 text-xs tabular-nums"
                />
              </div>
              <div>
                <Label className="text-xs">Limite diário (anti-bloqueio)</Label>
                <Input
                  type="number"
                  min={1}
                  max={250}
                  value={activeCampaign.dailyLimit}
                  onChange={(e) =>
                    updateDraft({ dailyLimit: Math.max(1, Number(e.target.value) || 50) })
                  }
                  className="mt-1 h-9 text-xs tabular-nums"
                />
              </div>
            </div>

            {activeCampaign.type === 'inactive_clients' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Meses sem visita</Label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={activeCampaign.config.inactiveMonths || 3}
                    onChange={(e) =>
                      updateDraft({
                        config: {
                          ...activeCampaign.config,
                          inactiveMonths: Math.max(1, Number(e.target.value) || 3),
                        },
                      })
                    }
                    className="mt-1 h-9 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bloquear quem já tem horário nos próximos (dias)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={180}
                    value={activeCampaign.config.blockBookedNextDays ?? 90}
                    onChange={(e) =>
                      updateDraft({
                        config: {
                          ...activeCampaign.config,
                          blockBookedNextDays: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="mt-1 h-9 text-xs tabular-nums"
                  />
                </div>
              </div>
            )}

            {activeCampaign.type === 'service_return' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Prazo padrão de retorno (dias)</Label>
                  <Input
                    type="number"
                    min={7}
                    max={180}
                    value={activeCampaign.config.defaultReturnDays || 45}
                    onChange={(e) =>
                      updateDraft({
                        config: {
                          ...activeCampaign.config,
                          defaultReturnDays: Math.max(7, Number(e.target.value) || 45),
                        },
                      })
                    }
                    className="mt-1 h-9 text-xs tabular-nums"
                  />
                </div>
              </div>
            )}

            {/* Template */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">Mensagem modelo</Label>
                <div className="flex flex-wrap items-center gap-1">
                  {TEMPLATE_VARS.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() =>
                        updateDraft({
                          messageTemplate: `${activeCampaign.messageTemplate} ${v.token}`,
                        })
                      }
                      className="text-[11px] px-2 py-0.5 rounded border border-border bg-secondary hover:bg-accent text-foreground cursor-pointer font-mono"
                      title={v.label}
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                value={activeCampaign.messageTemplate}
                onChange={(e) => updateDraft({ messageTemplate: e.target.value })}
                rows={3}
                className="text-xs"
              />
              <div className="p-3 rounded-lg bg-secondary/60 border border-border text-xs">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
                  Pré-visualização realista
                </span>
                <p className="text-foreground whitespace-pre-wrap">{previewText}</p>
              </div>
            </div>

            {/* Avaliação de Público & Disparo */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Simulador &amp; Disparo Real na Base
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Avalia automaticamente seus clientes e agendamentos ativos para montar a fila segura.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={evaluating}
                    onClick={handleEvaluate}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-[#9F844A]" />
                    {evaluating ? 'Calculando...' : 'Calcular público elegível'}
                  </Button>
                  {evaluation && evaluation.eligibleCount > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={dispatching}
                      onClick={handleDispatch}
                      className="h-8 text-xs bg-[#171717] text-white gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {dispatching
                        ? 'Disparando...'
                        : `Disparar (${Math.min(50, evaluation.eligibleCount)})`}
                    </Button>
                  )}
                </div>
              </div>

              {evaluation && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-secondary/60 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                    <span>
                      Avaliados: <strong>{evaluation.totalEvaluated}</strong> · Elegíveis:{' '}
                      <strong className="text-emerald-700">{evaluation.eligibleCount}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Previsão da fila: {evaluation.estimatedDaysToClear} dia(s)
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-border">
                    {evaluation.candidates.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Nenhum contato atendeu aos critérios da campanha neste momento.
                      </div>
                    ) : (
                      evaluation.candidates.map((cand: CampaignCandidate, idx) => (
                        <div
                          key={`${cand.clientId}_${idx}`}
                          className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{cand.clientName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {cand.clientPhone || 'Sem telefone'} · {cand.reason}
                            </p>
                          </div>
                          {cand.eligible ? (
                            <span className="text-[11px] font-medium text-emerald-700 shrink-0">
                              Elegível
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {cand.blockedReason || 'Ignorado'}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {lastWaLinks.length > 0 && (
                <div className="p-3 rounded-xl bg-secondary/70 border border-border space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Links diretos para envio rápido via WhatsApp Web:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lastWaLinks.map((item, i) => (
                      <a
                        key={i}
                        href={item.waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-medium text-emerald-700 hover:border-emerald-400"
                      >
                        {item.clientName} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'queue' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h4 className="text-sm font-semibold text-foreground">Histórico &amp; Fila de Envios</h4>
            <p className="text-xs text-muted-foreground">
              Registro auditável de todos os disparos executados, status e mensagens personalizadas.
            </p>
          </div>
          {dispatches.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              Nenhum disparo registrado ainda. Avalie e dispare uma campanha na aba &ldquo;Configurar &amp; Disparar&rdquo;.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Data</th>
                    <th className="py-2.5 px-4 font-medium">Cliente</th>
                    <th className="py-2.5 px-4 font-medium">Campanha</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dispatches.map((d) => (
                    <tr key={d.id} className="hover:bg-secondary/30">
                      <td className="py-2.5 px-4 tabular-nums text-muted-foreground">
                        {new Date(d.dispatchedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-foreground">
                        {d.clientName}{' '}
                        <span className="text-muted-foreground font-normal tabular-nums">
                          ({d.clientPhone})
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">{d.campaignType}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-medium ${
                            d.status === 'converted' || d.status === 'sent'
                              ? 'text-emerald-700'
                              : d.status === 'failed'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {d.status === 'sent'
                            ? 'Enviado'
                            : d.status === 'converted'
                              ? 'Agendou'
                              : d.status === 'replied'
                                ? 'Respondeu'
                                : d.status === 'postponed'
                                  ? 'Adiado'
                                  : 'Falhou'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {d.statusReason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'results' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground">Mensagens disparadas</span>
              <p className="text-lg font-semibold text-foreground tabular-nums">{totalSent}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground">Agendamentos convertidos</span>
              <p className="text-lg font-semibold text-foreground tabular-nums">{totalConverted}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground">Receita recuperada</span>
              <p className="text-lg font-semibold text-foreground tabular-nums">
                R$ {totalRecovered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 space-y-1">
              <span className="text-[11px] text-muted-foreground">Nota CSAT média</span>
              <p className="text-lg font-semibold text-foreground tabular-nums flex items-center gap-1">
                <Star className="w-4 h-4 text-[#9F844A]" />
                {totalCsatCount > 0 ? (totalCsatSum / totalCsatCount).toFixed(1) : '—'}
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Campanha</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium text-right">Enviadas</th>
                  <th className="py-2.5 px-4 font-medium text-right">Agendamentos</th>
                  <th className="py-2.5 px-4 font-medium text-right">Conversão</th>
                  <th className="py-2.5 px-4 font-medium text-right">Receita Recuperada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => {
                  const convRate =
                    c.metrics.sentCount > 0
                      ? Math.round((c.metrics.convertedBookings / c.metrics.sentCount) * 100)
                      : 0;
                  return (
                    <tr key={c.id} className="hover:bg-secondary/30">
                      <td className="py-3 px-4 font-medium text-foreground">{c.title}</td>
                      <td className="py-3 px-4">
                        <span className={c.enabled ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}>
                          {c.enabled ? 'Ativa' : 'Pausada'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{c.metrics.sentCount}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{c.metrics.convertedBookings}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{convRate}%</td>
                      <td className="py-3 px-4 text-right font-semibold text-foreground tabular-nums">
                        R${' '}
                        {Number(c.metrics.recoveredRevenue || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

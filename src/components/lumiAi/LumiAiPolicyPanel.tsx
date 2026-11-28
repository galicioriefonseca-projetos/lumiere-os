import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Info, MessageSquare, ShieldCheck, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CrmSettings } from '@/types';
import { saveCrmSettings } from '@/services/crmService';
import { getWhatsAppSettings, WhatsAppSettingsData } from '@/services/appointmentsService';

interface LumiAiPolicyPanelProps {
  salonId: string;
  settings: CrmSettings;
}

export function LumiAiPolicyPanel({ salonId, settings }: LumiAiPolicyPanelProps) {
  const [waStatus, setWaStatus] = useState<WhatsAppSettingsData | null>(null);
  const [loadingWa, setLoadingWa] = useState(true);
  const [draft, setDraft] = useState<CrmSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!salonId) return;
    let active = true;
    setLoadingWa(true);
    getWhatsAppSettings(salonId)
      .then((res) => {
        if (active) setWaStatus(res);
      })
      .catch(() => {
        if (active) setWaStatus(null);
      })
      .finally(() => {
        if (active) setLoadingWa(false);
      });
    return () => {
      active = false;
    };
  }, [salonId]);

  const includeOptOut = Boolean(draft.aiConfig.includeOptOutFooter ?? true);
  const isDirty =
    Boolean(draft.aiConfig.includeOptOutFooter ?? true) !==
      Boolean(settings.aiConfig.includeOptOutFooter ?? true) ||
    (draft.aiConfig.optOutPhrase || '') !== (settings.aiConfig.optOutPhrase || '') ||
    draft.funnelRules.awaitingReplyAlertHours !== settings.funnelRules.awaitingReplyAlertHours;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCrmSettings(salonId, draft);
      toast.success('Políticas de envio da Lumi IA atualizadas.');
    } catch {
      toast.error('Erro ao salvar políticas de envio.');
    } finally {
      setSaving(false);
    }
  };

  const cloudConnected = Boolean(waStatus?.enabled && waStatus?.phoneNumberId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#171717] tracking-tight">
          Conexão &amp; Política de Envios
        </h2>
        <p className="text-xs text-[#6B6B6B] mt-0.5">
          Verifique o status real da sua integração WhatsApp e configure boas práticas anti-bloqueio.
        </p>
      </div>

      {/* Real WhatsApp Integration Status */}
      <div
        className={`bg-white border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          cloudConnected ? 'border-emerald-300' : 'border-[#E5E2DC]'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              cloudConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-[#FAF9F7] border-[#E5E2DC] text-[#8A6D36]'
            }`}
          >
            {cloudConnected ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <WifiOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
              Canal WhatsApp Cloud API
            </span>
            {loadingWa ? (
              <p className="text-sm font-medium text-[#6B6B6B] mt-0.5">
                Verificando integração configurada...
              </p>
            ) : cloudConnected ? (
              <>
                <h3 className="text-base font-semibold text-[#171717] mt-0.5">
                  WhatsApp Cloud conectado e pronto para envios automáticos
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5 tabular-nums">
                  Phone Number ID: {waStatus?.phoneNumberId}
                  {waStatus?.lastWebhookEvent?.timestamp
                    ? ` · Último evento: ${new Date(waStatus.lastWebhookEvent.timestamp).toLocaleString('pt-BR')}`
                    : ''}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-[#171717] mt-0.5">
                  Modo Link Direto (WhatsApp Cloud API não configurado)
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Os disparos registram a fila no CRM e geram links 1-clique para WhatsApp Web. Para envios 100% em segundo plano, conecte a API Oficial Meta na Agenda.
                </p>
              </>
            )}
          </div>
        </div>

        <Link to="/dashboard/agendamentos" className="shrink-0">
          <Button
            type="button"
            variant="outline"
            className="h-10 px-4 text-xs border-[#E5E2DC] bg-[#FAF9F7] hover:bg-[#F5F1E9] text-[#171717] rounded-xl gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#8A6D36]" />
            Configurar WhatsApp
          </Button>
        </Link>
      </div>

      {/* Messaging Policy Card */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F5F1E9] border border-[#E5E2DC] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4.5 h-4.5 text-[#8A6D36]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">
              Política de Envio de Mensagens &amp; Opt-out (LGPD)
            </h3>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              Proteja a reputação do seu número oferecendo transparência ao cliente nas mensagens de marketing e confirmação.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={includeOptOut}
                onClick={() =>
                  setDraft({
                    ...draft,
                    aiConfig: {
                      ...draft.aiConfig,
                      includeOptOutFooter: !includeOptOut,
                    },
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer mt-0.5 ${
                  includeOptOut ? 'bg-[#171717]' : 'bg-[#D6D3CC]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    includeOptOut ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
              <div>
                <p className="text-xs font-semibold text-[#171717]">
                  Ativar instrução &ldquo;Parar de receber&rdquo; nas mensagens de marketing e confirmação (recomendado)
                </p>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                  Reduz denúncias de spam e melhora a entrega da conta WhatsApp Business.
                </p>
              </div>
            </div>
            <Info className="w-4 h-4 text-[#6B6B6B] shrink-0 hidden sm:block" />
          </div>

          {includeOptOut && (
            <div>
              <Label className="text-xs text-[#6B6B6B]">Texto padrão de descadastro no rodapé</Label>
              <Input
                value={draft.aiConfig.optOutPhrase || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    aiConfig: { ...draft.aiConfig, optOutPhrase: e.target.value },
                  })
                }
                placeholder='Caso prefira não receber avisos automáticos, responda "Parar de receber".'
                className="mt-1 h-9 text-xs bg-white"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <Label className="text-xs">Alerta de SLA no Funil (horas aguardando resposta)</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={draft.funnelRules.awaitingReplyAlertHours}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  funnelRules: {
                    ...draft.funnelRules,
                    awaitingReplyAlertHours: Math.max(1, Number(e.target.value) || 24),
                  },
                })
              }
              className="mt-1 h-9 text-xs tabular-nums"
            />
          </div>
          <div>
            <Label className="text-xs">Intervalo para retomar atendimento após handoff (min)</Label>
            <Input
              type="number"
              min={5}
              max={240}
              value={draft.funnelRules.aiHandoffTimeoutMinutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  funnelRules: {
                    ...draft.funnelRules,
                    aiHandoffTimeoutMinutes: Math.max(5, Number(e.target.value) || 15),
                  },
                })
              }
              className="mt-1 h-9 text-xs tabular-nums"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            disabled={saving || !isDirty}
            onClick={handleSave}
            className="h-10 px-5 text-xs bg-[#171717] hover:bg-[#2A2A2A] text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>
    </div>
  );
}

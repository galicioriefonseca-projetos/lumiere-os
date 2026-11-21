import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  Copy,
  Loader2,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { toast } from 'sonner';
import { Appointment } from '@/types';
import {
  getWhatsAppSettings,
  LastWebhookEvent,
  saveWhatsAppSettings,
  testWhatsAppWebhookApi,
} from '@/services/appointmentsService';

interface WhatsAppSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  appointments?: Appointment[];
}

export const WhatsAppSettingsDialog: React.FC<WhatsAppSettingsDialogProps> = ({
  open,
  onOpenChange,
  salonId,
  appointments = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [maskedWebhookSecret, setMaskedWebhookSecret] = useState('');
  const [lastWebhookEvent, setLastWebhookEvent] = useState<LastWebhookEvent | null>(null);
  const [selectedTestAppId, setSelectedTestAppId] = useState<string>('');
  const [defaultTemplate, setDefaultTemplate] = useState(
    'Olá {cliente}! ✨ Aqui é do *{salao}*. Confirmamos seu atendimento de *{servico}* com *{profissional}* no dia *{data}* às *{hora}*?\n\nToque no link seguro para confirmar ou avisar com 1 clique:\n{link}'
  );

  const pendingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => !a.isBlock && a.status === 'scheduled')
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)),
    [appointments]
  );

  useEffect(() => {
    if (!selectedTestAppId && pendingAppointments.length > 0) {
      setSelectedTestAppId(pendingAppointments[0].id);
    } else if (
      selectedTestAppId &&
      !pendingAppointments.some((a) => a.id === selectedTestAppId)
    ) {
      setSelectedTestAppId(pendingAppointments[0]?.id || '');
    }
  }, [pendingAppointments, selectedTestAppId]);

  const webhookSalonUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/appointments/whatsapp-webhook/${salonId}`
      : `/api/appointments/whatsapp-webhook/${salonId}`;

  const webhookGlobalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/appointments/whatsapp-webhook`
      : '/api/appointments/whatsapp-webhook';

  const loadSettings = async () => {
    if (!salonId) return;
    setLoading(true);
    try {
      const res = await getWhatsAppSettings(salonId);
      setEnabled(res.enabled);
      setPhoneNumberId(res.phoneNumberId);
      setWabaId(res.wabaId);
      setHasAccessToken(res.hasAccessToken);
      setMaskedToken(res.maskedAccessToken);
      setHasWebhookSecret(Boolean(res.hasWebhookSecret));
      setMaskedWebhookSecret(res.maskedWebhookSecret || '');
      setWebhookVerifyToken(res.webhookVerifyToken);
      setLastWebhookEvent(res.lastWebhookEvent || null);
      if (res.defaultMessageTemplate) {
        setDefaultTemplate(res.defaultMessageTemplate);
      }
      setAccessToken('');
      setWebhookSecret('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !salonId) return;
    void loadSettings();
  }, [open, salonId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await saveWhatsAppSettings({
        salonId,
        enabled,
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        accessToken: accessToken.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        defaultMessageTemplate: defaultTemplate.trim(),
        webhookVerifyToken: webhookVerifyToken.trim() || undefined,
      });
      setWebhookVerifyToken(res.webhookVerifyToken);
      if (accessToken.trim()) {
        setHasAccessToken(true);
      }
      if (webhookSecret.trim()) {
        setHasWebhookSecret(true);
      }
      setAccessToken('');
      setWebhookSecret('');
      toast.success('Configurações e Webhook de confirmação salvos!');
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateWebhook = async () => {
    if (!salonId) return;
    try {
      setTestingWebhook(true);
      const res = await testWhatsAppWebhookApi(
        salonId,
        selectedTestAppId || undefined,
        'confirm'
      );
      toast.success(
        `Webhook processado: "${res.clientName}" confirmado! O bloco já ficou verde na agenda.`
      );
      await loadSettings();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Não foi possível simular a confirmação via webhook.'
      );
    } finally {
      setTestingWebhook(false);
    }
  };

  const copyText = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copiado!`))
      .catch(() => toast.error('Não foi possível copiar.'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-[#E5E2DC] text-[#171717] max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg text-[#171717] flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            Webhook & Confirmação via WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B6B6B]">
            O webhook escuta automaticamente confirmações vindas da Meta Cloud API, Evolution API, Z-API, Twilio ou link seguro, mudando o status no Firestore para Confirmado (Verde) em tempo real.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#B89B5E]" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 pt-2 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Escuta em Tempo Real Ativa na Agenda</p>
                <p className="text-[11px] text-emerald-800">
                  Assim que o webhook recebe a resposta do cliente (&ldquo;SIM&rdquo;, &ldquo;CONFIRMO&rdquo; ou clique no botão/link), o Firestore atualiza automaticamente para <strong>Confirmado</strong> e o horário fica verde sem precisar recarregar a página.
                </p>
              </div>
            </div>

            {/* Bloco dedicado do Endpoint Webhook do Salão */}
            <div className="space-y-2.5 bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                  <Webhook className="w-4 h-4 text-[#8A6D36]" />
                  Endpoint Webhook do Estabelecimento
                </p>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                  Ativo (GET / POST)
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-[#6B6B6B]">
                  URL Direta (Meta, Evolution API, Z-API, Twilio ou n8n/Make)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhookSalonUrl}
                    className="bg-white border-[#E5E2DC] text-[11px] font-mono h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(webhookSalonUrl, 'URL do Webhook do Salão')}
                    className="h-8 px-2.5 border-[#E5E2DC]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-[#6B6B6B]">Verify Token (Meta Handshake)</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={webhookVerifyToken}
                      onChange={(e) => setWebhookVerifyToken(e.target.value)}
                      placeholder="Verify Token"
                      className="bg-white border-[#E5E2DC] text-[11px] font-mono h-8"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(webhookVerifyToken, 'Verify Token')}
                      className="h-8 px-2 border-[#E5E2DC]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-[#6B6B6B] flex items-center justify-between">
                    <span>Segredo (x-webhook-secret / App Secret)</span>
                    {hasWebhookSecret && (
                      <span className="text-[10px] text-emerald-700 font-medium">
                        {maskedWebhookSecret}
                      </span>
                    )}
                  </Label>
                  <Input
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder={
                      hasWebhookSecret ? 'Manter segredo atual' : 'Opcional (recomendado)'
                    }
                    className="bg-white border-[#E5E2DC] text-[11px] h-8"
                  />
                </div>
              </div>

              <div className="text-[10px] text-[#6B6B6B] pt-1">
                Endpoint global Meta: <span className="font-mono">{webhookGlobalUrl}</span>
              </div>

              {lastWebhookEvent && (
                <div className="bg-white border border-emerald-200 rounded-lg px-2.5 py-2 text-[11px] flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-emerald-800">
                      Último webhook: {lastWebhookEvent.clientName}
                    </span>{' '}
                    <span className="text-[#6B6B6B]">
                      ({lastWebhookEvent.decision === 'confirm' ? 'Confirmado' : 'Cancelado'} via{' '}
                      {lastWebhookEvent.provider})
                    </span>
                  </div>
                  <span className="text-[10px] text-[#6B6B6B] tabular-nums shrink-0">
                    {new Date(lastWebhookEvent.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}

              {/* Testar Webhook ao vivo */}
              <div className="pt-2 border-t border-[#E5E2DC] flex flex-col sm:flex-row sm:items-center gap-2">
                <select
                  value={selectedTestAppId}
                  onChange={(e) => setSelectedTestAppId(e.target.value)}
                  disabled={pendingAppointments.length === 0}
                  className="flex-1 bg-white border border-[#E5E2DC] rounded-lg h-8 px-2 text-[11px] text-[#171717]"
                >
                  {pendingAppointments.length === 0 ? (
                    <option value="">Nenhum horário com status Agendado disponível p/ teste</option>
                  ) : (
                    pendingAppointments.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.date} {app.time} — {app.clientName} ({app.serviceName})
                      </option>
                    ))
                  )}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingWebhook || pendingAppointments.length === 0}
                  onClick={handleSimulateWebhook}
                  className="h-8 px-3 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold gap-1.5 shrink-0"
                >
                  {testingWebhook ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="w-3.5 h-3.5" />
                  )}
                  Simular Confirmação
                </Button>
              </div>
            </div>

            {/* Meta Cloud API Toggle */}
            <div className="flex items-center justify-between bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3">
              <div>
                <p className="font-semibold text-[#171717]">Disparo Direto Meta WhatsApp Cloud API</p>
                <p className="text-[11px] text-[#6B6B6B]">
                  Opcional: envia botões interativos direto pelo servidor sem abrir o WhatsApp Web.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  enabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-[#E5E2DC] text-[#6B6B6B]'
                }`}
              >
                {enabled ? 'Ativada' : 'Inativa (Usar Link)'}
              </button>
            </div>

            {enabled && (
              <div className="space-y-3 bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#171717]">Phone Number ID (Meta)</Label>
                    <Input
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      placeholder="Ex: 109283746512345"
                      className="bg-white border-[#E5E2DC] text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#171717]">WhatsApp Business Account ID</Label>
                    <Input
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      placeholder="Opcional"
                      className="bg-white border-[#E5E2DC] text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-[#171717] flex items-center justify-between">
                    <span>Access Token Permanente (Meta)</span>
                    {hasAccessToken && (
                      <span className="text-[10px] text-emerald-700 font-medium inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Salvo ({maskedToken})
                      </span>
                    )}
                  </Label>
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder={
                      hasAccessToken
                        ? 'Deixe em branco para manter o token atual'
                        : 'Cole o Token da Meta Cloud API'
                    }
                    className="bg-white border-[#E5E2DC] text-xs h-9"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-[#171717]">Mensagem Padrão de Confirmação</Label>
              <Textarea
                rows={4}
                value={defaultTemplate}
                onChange={(e) => setDefaultTemplate(e.target.value)}
                className="bg-[#FAF9F7] border-[#E5E2DC] text-xs"
              />
              <p className="text-[11px] text-[#6B6B6B]">
                Variáveis: {'{cliente}'}, {'{salao}'}, {'{servico}'}, {'{profissional}'}, {'{data}'}, {'{hora}'}, {'{link}'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E2DC]">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-[#E5E2DC] text-xs h-9"
              >
                Fechar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs h-9 px-4 gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar Configurações
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

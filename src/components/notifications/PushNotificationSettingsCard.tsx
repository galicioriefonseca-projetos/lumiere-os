import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  registerPushNotificationsDetailed,
  sendTestPushApi,
  unregisterPushNotifications,
} from '@/lib/pushNotifications';
import { updatePushPreferencesInDb } from '@/services/notificationsService';
import { toast } from 'sonner';
import {
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  Send,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PushNotificationSettingsCardProps {
  salonId: string;
  userId: string;
  professionalDocId?: string;
  initialPushEnabled?: boolean;
  initialTokensCount?: number;
  initialPreferences?: {
    onConfirmed?: boolean;
    onCanceled?: boolean;
  };
}

interface PreferenceToggleProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  ariaLabel: string;
}

const PreferenceToggle: React.FC<PreferenceToggleProps> = ({
  checked,
  onCheckedChange,
  ariaLabel,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A6D36]/40',
      checked
        ? 'bg-[#171717] border-[#171717]'
        : 'bg-[#EAE7E1] border-[#D6D1C7]'
    )}
  >
    <span
      className={cn(
        'pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )}
    />
  </button>
);

export const PushNotificationSettingsCard: React.FC<PushNotificationSettingsCardProps> = ({
  salonId,
  userId,
  professionalDocId,
  initialPushEnabled,
  initialTokensCount = 0,
  initialPreferences,
}) => {
  const [permission, setPermission] = useState<'granted' | 'default' | 'denied' | 'unsupported'>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [vapidMissing, setVapidMissing] = useState(false);
  const [loadingActivate, setLoadingActivate] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const [loadingDisable, setLoadingDisable] = useState(false);
  const [onConfirmed, setOnConfirmed] = useState(initialPreferences?.onConfirmed ?? true);
  const [onCanceled, setOnCanceled] = useState(initialPreferences?.onCanceled ?? true);
  const [devicesCount, setDevicesCount] = useState(initialTokensCount);

  useEffect(() => {
    setDevicesCount(initialTokensCount);
  }, [initialTokensCount]);

  useEffect(() => {
    if (initialPreferences) {
      setOnConfirmed(initialPreferences.onConfirmed ?? true);
      setOnCanceled(initialPreferences.onCanceled ?? true);
    }
  }, [initialPreferences?.onConfirmed, initialPreferences?.onCanceled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const isFullyActive = permission === 'granted' && (Boolean(fcmToken) || devicesCount > 0 || Boolean(initialPushEnabled));

  const handleActivate = async () => {
    if (!salonId || !userId) {
      toast.error('Dados de sessão indisponíveis para ativar notificações.');
      return;
    }

    setLoadingActivate(true);
    try {
      const result = await registerPushNotificationsDetailed(salonId, userId, professionalDocId);
      setPermission(result.permission);
      if (result.success && result.token) {
        setFcmToken(result.token);
        setVapidMissing(false);
        setDevicesCount((prev) => Math.max(1, prev));
        toast.success('Notificações Push FCM ativadas neste dispositivo!');
      } else if (result.vapidMissing) {
        setVapidMissing(true);
        toast.warning(
          'Permissão do navegador concedida! Configure VITE_FIREBASE_VAPID_KEY para habilitar alertas em segundo plano.'
        );
      } else if (result.permission === 'denied') {
        toast.error(
          'Permissão bloqueada no navegador. Libere notificações nas configurações do site na barra de endereço.'
        );
      } else {
        toast.error(result.errorReason || 'Não foi possível ativar o envio push.');
      }
    } finally {
      setLoadingActivate(false);
    }
  };

  const handleDisable = async () => {
    setLoadingDisable(true);
    try {
      await unregisterPushNotifications({
        salonId,
        userId,
        professionalDocId,
        currentToken: fcmToken || undefined,
      });
      setFcmToken(null);
      setDevicesCount(0);
      toast.success('Alertas push desativados para este dispositivo.');
    } finally {
      setLoadingDisable(false);
    }
  };

  const handleSendTest = async () => {
    setLoadingTest(true);
    try {
      const res = await sendTestPushApi(salonId, professionalDocId || userId);
      if (res.adminUnavailable) {
        toast.success('Alerta interno registrado na central de notificações!');
      } else if (res.successCount > 0) {
        toast.success(`Notificação Push FCM enviada para ${res.successCount} dispositivo(s)!`);
      } else if (res.tokensCount === 0) {
        toast.info('Nenhum token FCM ativo encontrado. Clique primeiro em "Ativar Alertas Push".');
      } else {
        toast.warning('Não foi possível confirmar entrega para os dispositivos cadastrados.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar notificação de teste.';
      toast.error(msg);
    } finally {
      setLoadingTest(false);
    }
  };

  const handlePreferenceChange = async (field: 'onConfirmed' | 'onCanceled', value: boolean) => {
    const nextConfirmed = field === 'onConfirmed' ? value : onConfirmed;
    const nextCanceled = field === 'onCanceled' ? value : onCanceled;
    setOnConfirmed(nextConfirmed);
    setOnCanceled(nextCanceled);
    try {
      await updatePushPreferencesInDb({
        userId,
        salonId,
        professionalDocId,
        onConfirmed: nextConfirmed,
        onCanceled: nextCanceled,
      });
      toast.success('Preferências de alerta atualizadas.');
    } catch {
      toast.error('Erro ao salvar preferência de notificação.');
    }
  };

  return (
    <Card className="bg-white border border-[#E5E2DC] rounded-2xl shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-[#E5E2DC]/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-heading font-bold text-[#171717] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#8A6D36]" />
            Notificações Push em Tempo Real (FCM)
          </CardTitle>
          {isFullyActive ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3" /> Ativo
            </span>
          ) : permission === 'denied' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-md">
              <BellOff className="w-3 h-3" /> Bloqueado no Navegador
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#FAF9F7] text-[#6B6B6B] border border-[#E5E2DC] px-2.5 py-0.5 rounded-md">
              Aguardando Ativação
            </span>
          )}
        </div>
        <CardDescription className="text-xs text-[#6B6B6B]">
          Receba alertas instantâneos via Firebase Cloud Messaging quando um agendamento for confirmado ou cancelado.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-3.5 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E2DC] flex items-center justify-center text-[#8A6D36]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-[#171717]">Dispositivos registrados</p>
              <p className="text-[11px] text-[#6B6B6B]">
                {devicesCount > 0
                  ? `${devicesCount} dispositivo(s) sincronizado(s) para receber push`
                  : 'Nenhum navegador/celular inscrito ainda'}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-[#8A6D36] tabular-nums">
            {devicesCount} ativo{devicesCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* Granular preferences */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-[#E5E2DC] bg-white">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Novos agendamentos confirmados</p>
              <p className="text-[11px] text-[#6B6B6B]">
                Alerta imediato quando cliente ou recepção confirmar um horário na sua agenda.
              </p>
            </div>
            <PreferenceToggle
              checked={onConfirmed}
              ariaLabel="Alertar sobre novos agendamentos confirmados"
              onCheckedChange={(checked) => handlePreferenceChange('onConfirmed', checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-[#E5E2DC] bg-white">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Cancelamentos de horário</p>
              <p className="text-[11px] text-[#6B6B6B]">
                Aviso prioritário caso um atendimento seja cancelado pelo cliente ou equipe.
              </p>
            </div>
            <PreferenceToggle
              checked={onCanceled}
              ariaLabel="Alertar sobre cancelamentos de horário"
              onCheckedChange={(checked) => handlePreferenceChange('onCanceled', checked)}
            />
          </div>
        </div>

        {permission === 'denied' && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <p className="leading-relaxed">
              As notificações deste endereço estão bloqueadas no seu navegador. Clique no ícone de cadeado ao lado da URL, mude <strong>Notificações</strong> para <strong>Permitir</strong> e tente ativar novamente.
            </p>
          </div>
        )}

        {vapidMissing && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <p className="leading-relaxed">
              Permissão do navegador concedida! Os alertas em tempo real dentro do painel já estão ativos. Para entregar push com o app fechado, configure a chave Web Push (<code className="font-mono text-[10px]">VITE_FIREBASE_VAPID_KEY</code>) gerada no Firebase Console.
            </p>
          </div>
        )}

        {permission === 'unsupported' && (
          <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] text-xs text-[#6B6B6B]">
            Este navegador não suporta Web Push nativo. No iPhone/iPad, adicione o LumièreOS à Tela de Início (PWA) para ativar notificações push.
          </div>
        )}

        {permission !== 'unsupported' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              onClick={handleActivate}
              disabled={loadingActivate}
              className={cn(
                'h-9 px-4 rounded-xl text-xs font-semibold gap-1.5',
                isFullyActive
                  ? 'bg-[#FAF9F7] hover:bg-[#F0EFEC] text-[#171717] border border-[#E5E2DC]'
                  : 'bg-[#171717] hover:bg-[#2c2c2c] text-white'
              )}
            >
              {loadingActivate ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bell className="w-3.5 h-3.5 text-[#D4AF37]" />
              )}
              {isFullyActive ? 'Sincronizar Este Dispositivo' : 'Ativar Alertas Push (FCM)'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSendTest}
              disabled={loadingTest}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold border-[#E5E2DC] text-[#171717] hover:bg-[#FAF9F7] gap-1.5"
            >
              {loadingTest ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-[#8A6D36]" />
              )}
              Enviar Teste
            </Button>

            {devicesCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDisable}
                disabled={loadingDisable}
                className="h-9 px-3 rounded-xl text-xs text-[#6B6B6B] hover:text-rose-700 hover:bg-rose-50"
              >
                {loadingDisable ? 'Desativando...' : 'Desativar'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

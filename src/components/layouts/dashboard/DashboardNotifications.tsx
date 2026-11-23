import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarCheck,
  CalendarPlus,
  CalendarX2,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SalonNotification } from '@/types';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeSalonNotifications,
} from '@/services/notificationsService';
import { registerPushNotificationsDetailed } from '@/lib/pushNotifications';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatRelativeTime(ts: number): string {
  if (!ts) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Agora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d`;
}

export function DashboardNotifications() {
  const { salonData, userData } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SalonNotification[]>([]);
  const [pushPerm, setPushPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPerm(Notification.permission);
    } else {
      setPushPerm('unsupported');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!salonData?.id) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeSalonNotifications(salonData.id, (items) => {
      setNotifications(items);
    });
    return () => unsub();
  }, [salonData?.id]);

  const visibleNotifications = useMemo(() => {
    if (userData?.role !== 'professional') return notifications;
    const myIds = new Set(
      [userData.id, (userData as { professionalId?: string }).professionalId].filter(Boolean)
    );
    return notifications.filter(
      (n) => !n.professionalId || myIds.has(n.professionalId)
    );
  }, [notifications, userData]);

  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !n.read).length,
    [visibleNotifications]
  );

  const handleMarkAllRead = async () => {
    if (!salonData?.id) return;
    await markAllNotificationsAsRead(salonData.id, visibleNotifications).catch(() => undefined);
  };

  const handleClickNotification = async (notif: SalonNotification) => {
    if (salonData?.id && !notif.read) {
      markNotificationAsRead(salonData.id, notif.id).catch(() => undefined);
    }
    setIsOpen(false);
    const defaultAgendaRoute =
      userData?.role === 'professional'
        ? '/dashboard/meu-painel?tab=agenda'
        : '/dashboard/agendamentos';
    navigate(
      userData?.role === 'professional'
        ? defaultAgendaRoute
        : notif.actionUrl || defaultAgendaRoute
    );
  };

  const handleQuickEnablePush = async () => {
    if (!salonData?.id || !userData?.id) return;
    const res = await registerPushNotificationsDetailed(salonData.id, userData.id);
    setPushPerm(res.permission);
    if (res.success) {
      toast.success('Alertas Push FCM ativados neste dispositivo!');
    } else if (res.vapidMissing) {
      toast.info('Alertas em primeiro plano ativados!');
    } else if (res.permission === 'denied') {
      toast.error('Permissão de notificações bloqueada no navegador.');
    }
  };

  const getVisualMeta = (type: string) => {
    switch (type) {
      case 'appointment_confirmed':
        return {
          icon: CalendarCheck,
          iconColor: 'text-emerald-700',
          bgColor: 'bg-emerald-50 border-emerald-200',
        };
      case 'appointment_canceled':
        return {
          icon: CalendarX2,
          iconColor: 'text-rose-700',
          bgColor: 'bg-rose-50 border-rose-200',
        };
      case 'appointment_created':
        return {
          icon: CalendarPlus,
          iconColor: 'text-[#8A6D36]',
          bgColor: 'bg-[#F5F1E9] border-[#E5E2DC]',
        };
      default:
        return {
          icon: Sparkles,
          iconColor: 'text-[#8A6D36]',
          bgColor: 'bg-[#FAF9F7] border-[#E5E2DC]',
        };
    }
  };

  return (
    <div className="relative" id="lumiere-notifications">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir central de notificações"
        className="relative p-1.5 h-8.5 w-8.5 flex items-center justify-center rounded-xl border border-[#E5E2DC] bg-white hover:bg-[#FAF9F7] transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4 text-[#171717]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#8A6D36] text-white text-[10px] font-bold flex items-center justify-center tabular-nums shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20 sm:bg-transparent" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-x-3 top-[68px] w-auto sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-96 rounded-2xl bg-white border border-[#E5E2DC] shadow-xl p-3.5 z-40 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E5E2DC]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#171717]">
                  Alertas da Agenda
                </span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F5F1E9] text-[#8A6D36] tabular-nums">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8A6D36] hover:text-[#171717] transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Ler todas
                </button>
              )}
            </div>

            {pushPerm === 'default' && (
              <div className="mb-2.5 p-2.5 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#6B6B6B] leading-tight">
                  Ative alertas push para receber confirmações em tempo real.
                </span>
                <button
                  type="button"
                  onClick={handleQuickEnablePush}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-[#171717] text-white text-[11px] font-semibold hover:bg-[#2c2c2c] cursor-pointer"
                >
                  Ativar
                </button>
              </div>
            )}

            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
              {visibleNotifications.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <Bell className="w-6 h-6 text-[#D4AF37] mx-auto opacity-60" />
                  <p className="text-xs font-medium text-[#171717]">Tudo em dia</p>
                  <p className="text-[11px] text-[#6B6B6B]">
                    Novas confirmações e cancelamentos aparecerão aqui em tempo real.
                  </p>
                </div>
              ) : (
                visibleNotifications.map((notif) => {
                  const meta = getVisualMeta(notif.type);
                  const Icon = meta.icon;
                  return (
                    <button
                      type="button"
                      key={notif.id}
                      onClick={() => handleClickNotification(notif)}
                      className={cn(
                        'w-full text-left p-2.5 rounded-xl border transition-colors flex gap-2.5 cursor-pointer',
                        !notif.read
                          ? 'bg-[#FAF9F7] border-[#D8C79F]/70 hover:bg-[#F5F1E9]'
                          : 'bg-white border-transparent hover:bg-[#FAF9F7]'
                      )}
                    >
                      <div className={cn('p-1.5 h-max rounded-lg border shrink-0', meta.bgColor)}>
                        <Icon className={cn('w-3.5 h-3.5', meta.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4
                            className={cn(
                              'text-xs truncate',
                              !notif.read ? 'font-bold text-[#171717]' : 'font-medium text-[#6B6B6B]'
                            )}
                          >
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-[#6B6B6B] tabular-nums shrink-0">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B6B6B] leading-snug line-clamp-2">
                          {notif.message}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Alert } from '../../lumi/types';
import { cn } from '@/lib/utils';

interface LumiAlertsListProps {
  alerts: Alert[];
}

function resolveDashboardPath(url: string): string {
  if (url.startsWith('/dashboard')) return url;
  if (url.startsWith('/')) return `/dashboard${url === '/' ? '' : url}`;
  return `/dashboard/${url}`;
}

function getSeverityInfo(type: Alert['type']) {
  switch (type) {
    case 'error':
      return {
        label: 'Criticidade alta',
        tone: 'text-red-700',
        cardBorder: 'border-red-200 bg-red-50/40',
        icon: <AlertOctagon className="w-4 h-4 text-red-700 shrink-0" />,
      };
    case 'warning':
      return {
        label: 'Atenção operacional',
        tone: 'text-amber-700',
        cardBorder: 'border-amber-200 bg-amber-50/40',
        icon: <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />,
      };
    case 'success':
      return {
        label: 'Positivo',
        tone: 'text-emerald-700',
        cardBorder: 'border-emerald-200 bg-emerald-50/40',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />,
      };
    case 'info':
    default:
      return {
        label: 'Informativo',
        tone: 'text-[#8A6D36]',
        cardBorder: 'border-[#E5E2DC] bg-[#FAF9F7]',
        icon: <Info className="w-4 h-4 text-[#8A6D36] shrink-0" />,
      };
  }
}

function formatAlertDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Agora';
  }
}

export function LumiAlertsList({ alerts }: LumiAlertsListProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E2DC] pb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#8A6D36]" />
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">Alertas Operacionais</h3>
            <p className="text-xs text-[#6B6B6B]">
              Monitoramento de estoque, cancelamentos, metas e ocupação
            </p>
          </div>
        </div>
        {alerts.length > 0 && (
          <span className="text-xs font-medium text-[#6B6B6B] tabular-nums">
            {alerts.length} alerta(s)
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="py-8 text-center space-y-1 text-xs text-[#6B6B6B]">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 mx-auto" />
          <p className="font-semibold text-[#171717]">Operação estável</p>
          <p>Nenhum alerta crítico detectado neste momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert, idx) => {
            const sev = getSeverityInfo(alert.type);

            return (
              <div
                key={alert.id || idx}
                className={cn(
                  'rounded-lg border p-4 flex flex-col justify-between gap-3 transition-colors',
                  sev.cardBorder
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-[11px] font-semibold', sev.tone)}>
                      {sev.label}
                    </span>
                    <span className="text-[11px] text-[#6B6B6B] tabular-nums">
                      {formatAlertDate(alert.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">{sev.icon}</div>
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs font-semibold text-[#171717] leading-snug">
                        {alert.title}
                      </h4>
                      <p className="text-[11px] text-[#4A4A4A] leading-relaxed">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                </div>

                {alert.actionUrl && (
                  <div className="pt-2.5 border-t border-[#E5E2DC] flex items-center justify-between gap-2">
                    {alert.valueText ? (
                      <span className="text-[11px] text-[#4A4A4A] font-medium tabular-nums truncate">
                        {alert.valueText}
                      </span>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      onClick={() => navigate(resolveDashboardPath(alert.actionUrl!))}
                      className={cn(
                        'text-[11px] font-semibold inline-flex items-center gap-1 hover:underline shrink-0',
                        sev.tone
                      )}
                    >
                      {alert.actionText || 'Verificar'}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

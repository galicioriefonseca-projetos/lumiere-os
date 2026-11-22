import React from 'react';
import { AlertOctagon, AlertTriangle, Bell, Info } from 'lucide-react';
import type { Client, ClientNotice } from '@/types';
import { filterActiveNoticesForClient } from '@/services/clientsService';
import { cn } from '@/lib/utils';

interface ClientActiveNoticesBannerProps {
  notices: ClientNotice[];
  client: Client | null | undefined;
  trigger: 'onSchedule' | 'onComanda' | 'all';
  theme?: 'dark' | 'light';
  className?: string;
}

export const ClientActiveNoticesBanner: React.FC<ClientActiveNoticesBannerProps> = ({
  notices,
  client,
  trigger,
  theme = 'light',
  className,
}) => {
  const matched = filterActiveNoticesForClient(notices, client, trigger);
  if (matched.length === 0) return null;

  const isLight = theme === 'light';

  return (
    <div className={cn('space-y-2', className)}>
      {matched.map((notice) => {
        const isCritical = notice.severity === 'critical';
        const isInfo = notice.severity === 'info';

        const containerCls = isCritical
          ? isLight
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          : isInfo
            ? isLight
              ? 'bg-amber-50/70 border-[#D4AF37]/40 text-[#171717]'
              : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-amber-100'
            : isLight
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200';

        const Icon = isCritical ? AlertOctagon : isInfo ? Info : AlertTriangle;
        const iconCls = isCritical
          ? 'text-rose-500'
          : isInfo
            ? 'text-[#B89B5E]'
            : 'text-amber-500';

        return (
          <div
            key={notice.id}
            className={cn(
              'rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 text-xs',
              containerCls
            )}
          >
            <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', iconCls)} />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <Bell className="w-3 h-3 opacity-70 shrink-0" />
                <span className="font-semibold tracking-tight">{notice.title}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90 whitespace-pre-wrap">
                {notice.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

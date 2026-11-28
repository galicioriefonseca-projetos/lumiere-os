import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Target,
  Zap,
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  type: 'welcome' | 'event' | 'alert' | 'achievement' | 'goal' | 'insight' | 'appointment' | 'checklist';
  title: string;
  description: string;
  time: string;
  href?: string;
}

interface LumiTimelineProps {
  events: TimelineEvent[];
}

function getEventIcon(type: TimelineEvent['type']) {
  switch (type) {
    case 'alert':
      return <AlertTriangle className="w-4 h-4 text-red-700" />;
    case 'appointment':
      return <Calendar className="w-4 h-4 text-[#8A6D36]" />;
    case 'checklist':
      return <CheckCircle2 className="w-4 h-4 text-emerald-700" />;
    case 'goal':
      return <Target className="w-4 h-4 text-emerald-700" />;
    case 'insight':
      return <Zap className="w-4 h-4 text-[#8A6D36]" />;
    case 'welcome':
      return <MessageSquare className="w-4 h-4 text-[#4A4A4A]" />;
    default:
      return <Clock className="w-4 h-4 text-[#6B6B6B]" />;
  }
}

export function LumiTimeline({ events }: LumiTimelineProps) {
  return (
    <div className="rounded-xl border border-[#E5E2DC] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E2DC] pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#8A6D36]" />
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">Atividade Recente</h3>
            <p className="text-xs text-[#6B6B6B]">
              Registros cronológicos de agenda, checklists e alertas
            </p>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#6B6B6B] space-y-1">
          <p className="font-medium text-[#171717]">Sem eventos registrados ainda.</p>
          <p>Os próximos atendimentos, checklists e alertas aparecerão aqui.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E5E2DC]">
          {events.map((event) => {
            const content = (
              <div className="py-3 flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{getEventIcon(event.type)}</div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#171717] truncate">{event.title}</p>
                    <time className="text-[11px] font-medium text-[#6B6B6B] tabular-nums shrink-0">
                      {event.time}
                    </time>
                  </div>
                  <p className="text-[11px] text-[#4A4A4A] leading-snug">{event.description}</p>
                </div>
              </div>
            );

            return event.href ? (
              <Link
                key={event.id}
                to={event.href}
                className="block hover:bg-[#FAF9F7] rounded-lg px-2 -mx-2 transition-colors"
              >
                {content}
              </Link>
            ) : (
              <div key={event.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

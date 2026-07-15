import { useState } from 'react';
import { Bell, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DashboardNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Boas-vindas ao LumièreOS',
      description: 'Seu ecossistema premium de gestão de salão de beleza está online.',
      time: 'Agora mesmo',
      icon: Sparkles,
      iconColor: 'text-[#D4AF37]',
      bgColor: 'bg-[#D4AF37]/5',
      unread: true,
    },
    {
      id: 2,
      title: 'Garantia de 7 dias pela Cakto',
      description: 'Sua assinatura conta com proteção de reembolso total de 7 dias pela Cakto.',
      time: '2 horas atrás',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/5',
      unread: false,
    },
    {
      id: 3,
      title: 'Lumi Intelligence Ativa',
      description: 'O mecanismo de inteligência de negócios concluiu a varredura e gerou insights.',
      time: '1 dia atrás',
      icon: AlertCircle,
      iconColor: 'text-[#D4AF37]',
      bgColor: 'bg-[#D4AF37]/5',
      unread: false,
    },
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="relative" id="lumiere-notifications">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 h-8.5 w-8.5 flex items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer"
      >
        <Bell className="w-4 h-4 text-zinc-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#09090b] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] p-3 z-40 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] font-sans">Notificações</span>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {notifications.map(notif => {
                const Icon = notif.icon;
                return (
                  <div 
                    key={notif.id}
                    className={cn(
                      "p-2.5 rounded-xl border transition-all duration-200 flex gap-2.5",
                      notif.unread 
                        ? "bg-white/[0.02] border-white/10" 
                        : "bg-transparent border-transparent hover:bg-white/[0.01]"
                    )}
                  >
                    <div className={cn("p-1.5 h-max rounded-lg shrink-0", notif.bgColor)}>
                      <Icon className={cn("w-3.5 h-3.5", notif.iconColor)} />
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={cn("text-xs truncate font-medium", notif.unread ? "text-white" : "text-zinc-300")}>
                          {notif.title}
                        </h4>
                        <span className="text-[8px] text-zinc-500 font-mono shrink-0">{notif.time}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                        {notif.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

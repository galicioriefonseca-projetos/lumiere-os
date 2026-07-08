import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '../../lumi/types';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  Bell,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface LumiAlertsListProps {
  alerts: Alert[];
}

export function LumiAlertsList({ alerts }: LumiAlertsListProps) {
  const navigate = useNavigate();

  const getSeverityInfo = (type: 'success' | 'info' | 'warning' | 'error') => {
    switch (type) {
      case 'error':
        return {
          label: 'Alta Criticidade',
          bg: 'bg-rose-500/10 hover:bg-rose-500/15',
          border: 'border-rose-500/20',
          text: 'text-rose-400',
          badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          icon: <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
        };
      case 'warning':
        return {
          label: 'Média Criticidade',
          bg: 'bg-amber-500/10 hover:bg-amber-500/15',
          border: 'border-amber-500/20',
          text: 'text-amber-400',
          badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        };
      case 'success':
        return {
          label: 'Informativo',
          bg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
          border: 'border-emerald-500/20',
          text: 'text-emerald-400',
          badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
          icon: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        };
      case 'info':
      default:
        return {
          label: 'Informativo',
          bg: 'bg-blue-500/10 hover:bg-blue-500/15',
          border: 'border-blue-500/20',
          text: 'text-blue-400',
          badge: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
          icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />
        };
    }
  };

  const formatAlertDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Agora';
    }
  };

  return (
    <Card className="border-white/5 bg-[#0c0c0f]/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
      <CardHeader className="border-b border-white/5 p-5 pb-4 bg-white/[0.01]">
        <div className="flex items-center gap-2.5">
          <Bell className="w-4 h-4 text-rose-500" />
          <div>
            <CardTitle className="text-sm font-semibold text-white font-heading">
              Alertas Operacionais Inteligentes
            </CardTitle>
            <p className="text-[10px] text-zinc-500 font-light mt-0.5">
              Anomalias e riscos monitorados pelo motor Lumi em tempo real
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-mono">
            Operação estável. Nenhum alerta crítico ativo na presente sessão. 🛡️
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.map((alert, idx) => {
              const sev = getSeverityInfo(alert.type);

              return (
                <motion.div
                  key={alert.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "p-4 rounded-2xl border flex flex-col justify-between space-y-3.5 transition-all duration-300 relative overflow-hidden shadow-md",
                    sev.bg,
                    sev.border
                  )}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border font-mono uppercase tracking-wider", sev.badge)}>
                        {sev.label}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatAlertDate(alert.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-start gap-3">
                      {sev.icon}
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-white leading-tight">
                          {alert.title}
                        </h4>
                        <p className="text-[11px] text-zinc-300 leading-relaxed font-light">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {alert.actionUrl && (
                    <div className="pt-2 border-t border-white/[0.03] flex items-center justify-between">
                      {alert.valueText ? (
                        <span className="text-[10px] text-zinc-400 font-mono font-medium">
                          Status: {alert.valueText}
                        </span>
                      ) : (
                        <span />
                      )}
                      
                      <Button
                        variant="ghost"
                        onClick={() => navigate(`/dashboard${alert.actionUrl}`)}
                        className={cn("h-7 px-2.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 hover:bg-white/5", sev.text)}
                      >
                        {alert.actionText || 'Verificar'}
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

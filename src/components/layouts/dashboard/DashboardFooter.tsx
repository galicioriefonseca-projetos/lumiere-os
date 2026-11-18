import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { APP_INFO } from '../../../config/appInfo';
import { checkAppVersionAndRefresh } from '../../../lib/cacheControl';
import { cn } from '@/lib/utils';

export function DashboardFooter() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncUpdate = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    toast.info('Sincronizando atualização do PWA...', {
      description: 'Buscando a versão mais recente e limpando o cache local.',
    });
    try {
      await checkAppVersionAndRefresh({ force: true });
    } catch (error) {
      console.error('[DashboardFooter] Falha ao sincronizar atualização:', error);
      toast.error('Não foi possível sincronizar agora. Tente novamente.');
      setIsSyncing(false);
    }
  };

  return (
    <footer className="max-w-7xl mx-auto mt-10 pt-5 pb-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/70 border border-border">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-[11px] font-medium text-muted-foreground">
            Versão do Sistema:
          </span>
          <span className="text-[11px] font-bold font-mono text-primary">
            v{APP_INFO.version}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/75 hidden md:inline">
          LumièreOS • © Galiciori e Fonseca
        </span>
      </div>

      <button
        type="button"
        onClick={handleSyncUpdate}
        disabled={isSyncing}
        className={cn(
          'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer select-none',
          'bg-card hover:bg-accent text-foreground border-border hover:border-primary/40 shadow-xs',
          isSyncing && 'opacity-70 cursor-wait'
        )}
      >
        <RefreshCw className={cn('w-3.5 h-3.5 text-primary', isSyncing && 'animate-spin')} />
        <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Atualização'}</span>
      </button>
    </footer>
  );
}

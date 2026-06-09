import React, { useState, useEffect } from 'react';
import { WifiOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      setDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-2 sm:p-4 pointer-events-none"
      >
        <div className="bg-zinc-900 border border-amber-500/30 shadow-2xl shadow-amber-500/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-lg w-full pointer-events-auto relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-50"></div>
          
          <div className="relative z-10 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <WifiOff className="w-5 h-5 text-amber-500" />
          </div>
          
          <div className="relative z-10 flex-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Modo Offline Ativado
              <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                Workbox
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Você está sem conexão. Os dados da equipe e serviços foram salvos em cache e estão disponíveis para visualização.
            </p>
          </div>
          
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 sm:relative sm:top-auto sm:right-auto z-10 p-1.5 rounded-full hover:bg-white/5 transition-colors text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

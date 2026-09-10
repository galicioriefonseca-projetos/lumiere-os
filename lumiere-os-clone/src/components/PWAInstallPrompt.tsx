import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Crown, Sparkles, Share2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as any).standalone === true;
    
    setIsInstalled(isStandalone);

    if (isStandalone) {
      return;
    }

    // Detect if iOS
    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 2. Check localStorage if dismissed
    const isDismissed = localStorage.getItem('lumiere_pwa_prompt_dismissed') === 'true';
    
    // 3. Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isDismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. As a backup on mobile, if they haven't dismissed and they are not standalone, Show prompt after 5 seconds
    const timer = setTimeout(() => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      if (isMobile && !isDismissed && !isStandalone) {
        setShowPrompt(true);
      }
    }, 5000);

    // Listen for install success
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } else {
      // Open the elegant instructional modal
      setShowManualGuide(true);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('lumiere_pwa_prompt_dismissed', 'true');
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <>
      <div 
        id="pwa-install-floating-prompt"
        className="fixed bottom-6 right-6 left-6 md:left-auto md:max-w-md bg-[#09090b] border border-[#D4AF37]/35 p-5 rounded-2xl shadow-[0_10px_45px_rgba(0,0,0,0.85)] z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden"
      >
        {/* Subtle royal background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 blur-2xl rounded-full -mr-12 -mt-12 pointer-events-none"></div>

        <div className="flex items-start gap-4 relative">
          <div className="p-2.5 bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/30 rounded-xl text-[#D4AF37] shrink-0">
            <Crown className="w-5 h-5 filter drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]" />
          </div>
          
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-white tracking-tight flex items-center gap-1.5">
                Instale o LumiereOS no celular
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
              </h4>
              <button 
                onClick={handleDismiss}
                className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
                aria-label="Dispensar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-[95%]">
              Acesse agenda, clientes e checklists com um toque no seu smartphone.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 relative">
          <Button
            onClick={handleDismiss}
            variant="ghost"
            className="flex-1 text-xs text-muted-foreground hover:text-white rounded-xl h-9 hover:bg-white/5 active:bg-white/10"
          >
            Mais tarde
          </Button>
          <Button
            onClick={handleInstall}
            className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-semibold text-xs rounded-xl h-9 shadow-[0_0_15px_rgba(212,175,55,0.25)] flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-black" />
            <span>Instalar App</span>
          </Button>
        </div>
      </div>

      {/* Manual Guided Instructions Dialog */}
      <Dialog open={showManualGuide} onOpenChange={setShowManualGuide}>
        <DialogContent className="bg-[#09090b] border border-[#D4AF37]/30 text-white max-w-sm rounded-2xl shadow-[0_0_50px_rgba(212,175,55,0.15)] overflow-hidden">
          <DialogHeader className="flex flex-row items-center gap-3.5 mb-4 border-b border-white/5 pb-4">
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[#D4AF37]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-white">Instalação Manual</DialogTitle>
              <p className="text-[11px] text-neutral-400">Como salvar o LumiereOS</p>
            </div>
          </DialogHeader>

          <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
            {isIOS ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-white">No Safari do seu iPhone ou iPad:</p>
                <ol className="list-decimal pl-4.5 space-y-2.5">
                  <li>
                    Toque no botão de <strong>Compartilhar</strong> (ícone <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-sky-400" /> na barra inferior do navegador).
                  </li>
                  <li>
                    Role as opções e selecione <strong className="text-[#D4AF37]">Adicionar à Tela de Início</strong> (ícone <Plus className="w-3.5 h-3.5 inline mx-0.5" />).
                  </li>
                  <li>
                    Aperte <strong className="text-[#D4AF37]">Adicionar</strong> no canto superior direito para confirmar.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-white">No Chrome ou navegador do seu Android:</p>
                <ol className="list-decimal pl-4.5 space-y-2.5">
                  <li>
                    Toque no menu de <strong>três pontos</strong> <span className="font-bold text-white">⋮</span> no canto superior direito.
                  </li>
                  <li>
                    Escolha a opção <strong className="text-[#D4AF37]">Instalar aplicativo</strong> ou <strong className="text-[#D4AF37]">Adicionar à tela inicial</strong>.
                  </li>
                  <li>
                    Confirme o diálogo de instalação para concluir e adicionar à sua grade de aplicativos.
                  </li>
                </ol>
              </div>
            )}
          </div>

          <Button 
            onClick={() => setShowManualGuide(false)} 
            className="w-full mt-6 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-xl py-2.5 transition-all text-xs"
          >
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

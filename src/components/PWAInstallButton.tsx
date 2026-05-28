import React, { useState, useEffect } from 'react';
import { Download, Share, Plus, HelpCircle, Check, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallButton({ variant = 'banner' }: { variant?: 'banner' | 'button' | 'compact' }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('lumiere_pwa_collapsed') === 'true');

  useEffect(() => {
    // Detect if already installed / standalone
    const checkStandalone = () => {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkStandalone();

    // Detect OS
    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroidDevice = /Android/i.test(ua);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsReadyToInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsReadyToInstall(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsReadyToInstall(false);
        setDeferredPrompt(null);
      }
    } else {
      // Toggle detailed installation instructions for browsers that don't emit the prompt
      setShowInstructions(prev => !prev);
    }
  };

  // If already installed, hide everything
  if (isInstalled) {
    return null;
  }

  // If variant is a simple compact menu button
  if (variant === 'compact') {
    return (
      <Button
        id="pwa-install-compact"
        onClick={handleInstallClick}
        variant="ghost"
        className="w-full justify-start text-[#D4AF37] hover:bg-white/5 gap-2 px-3 py-2 text-xs font-medium rounded-xl"
      >
        <Download className="w-4 h-4 text-[#D4AF37]" />
        <span>Instalar Aplicativo</span>
      </Button>
    );
  }

  // If variant is a clean stand-alone action button
  if (variant === 'button') {
    if (isCollapsed) {
      return (
        <div className="inline-block animate-fadeIn" id="pwa-install-button-wrapper">
          <Button
            id="pwa-install-button-expand"
            onClick={() => {
              setIsCollapsed(false);
              localStorage.setItem('lumiere_pwa_collapsed', 'false');
            }}
            variant="outline"
            className="border-[#D4AF37]/30 hover:border-[#D4AF37] text-[#D4AF37] bg-zinc-950/40 hover:bg-[#D4AF37]/10 rounded-xl px-4 py-2 flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all duration-300 shadow-[0_0_10px_rgba(212,175,55,0.05)] text-center"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar PWA (Expandir)</span>
          </Button>
        </div>
      );
    }

    return (
      <div className="inline-block relative animate-fadeIn" id="pwa-install-button-wrapper">
        <div className="flex items-center gap-1.5">
          <Button
            id="pwa-install-button"
            onClick={handleInstallClick}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-semibold shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all duration-300 rounded-xl px-5 py-2.5 flex items-center gap-2 text-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-black" />
            <span>Instalar LumiereOS</span>
          </Button>

          <Button
            type="button"
            onClick={() => {
              setIsCollapsed(true);
              localStorage.setItem('lumiere_pwa_collapsed', 'true');
            }}
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl border border-white/5 cursor-pointer shrink-0"
            title="Ocultar instalador"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {showInstructions && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-950 border border-amber-500/30 p-6 rounded-2xl max-w-sm w-full shadow-[0_0_50px_rgba(212,175,55,0.15)] relative animate-fadeIn">
              <button 
                onClick={() => setShowInstructions(false)} 
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Smartphone className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Instalação Manual</h3>
                  <p className="text-xs text-muted-foreground">LumiereOS no seu smartphone</p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-neutral-300">
                {isIOS ? (
                  <div className="space-y-3">
                    <p>No seu iPhone/iPad com Safari:</p>
                    <ol className="list-decimal list-inside space-y-2 text-xs pl-1">
                      <li>Toque no botão de <strong className="text-foreground">Compartilhar</strong> (ícone <Share className="w-3.5 h-3.5 inline mx-0.5 mb-1 text-sky-400" /> na barra do navegador).</li>
                      <li>Role a lista e escolha <strong className="text-[#D4AF37]">Adicionar à Tela de Início</strong> (ícone <Plus className="w-3.5 h-3.5 inline mx-0.5 mb-1" />).</li>
                      <li>Toque em <strong className="text-[#D4AF37]">Adicionar</strong> no canto superior direito para confirmar.</li>
                    </ol>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p>No seu Android com Chrome ou Samsung Internet:</p>
                    <ol className="list-decimal list-inside space-y-2 text-xs pl-1">
                      <li>Toque no menu de três pontos do navegador no canto superior direito.</li>
                      <li>Selecione <strong className="text-[#D4AF37]">Instalar aplicativo</strong> ou <strong className="text-[#D4AF37]">Adicionar à tela inicial</strong>.</li>
                      <li>Confirme a instalação para ter o LumiereOS disponível na lista de aplicativos do seu celular.</li>
                    </ol>
                  </div>
                )}
              </div>

              <Button 
                onClick={() => setShowInstructions(false)} 
                className="w-full mt-6 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 rounded-xl"
              >
                Entendi
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default Banner Variant (A premium box showing install option and instruction hints)
  if (isCollapsed) {
    return (
      <div 
        id="pwa-install-banner-collapsed"
        onClick={() => {
          setIsCollapsed(false);
          localStorage.setItem('lumiere_pwa_collapsed', 'false');
        }}
        className="bg-zinc-950/40 hover:bg-zinc-950/60 border border-[#D4AF37]/10 hover:border-[#D4AF37]/30 p-3.5 rounded-xl shadow-md flex items-center justify-between gap-3 cursor-pointer transition-all duration-300 w-full group animate-fadeIn"
      >
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform duration-300" />
          <span className="text-xs text-zinc-300 font-medium font-sans">Instalar LumiereOS</span>
        </div>
        <span className="text-[10px] text-[#D4AF37] font-semibold tracking-wider font-mono uppercase bg-[#D4AF37]/5 px-2.5 py-0.5 rounded-md group-hover:bg-[#D4AF37]/10 transition-colors">
          Expandir
        </span>
      </div>
    );
  }

  return (
    <div id="pwa-install-banner" className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-amber-500/20 p-5 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] max-w-md w-full relative overflow-hidden group animate-fadeIn">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-2xl rounded-full -mr-10 -mt-10 group-hover:bg-amber-500/10 transition-colors duration-500"></div>
      
      {/* Collapse Button for Banner */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsCollapsed(true);
          localStorage.setItem('lumiere_pwa_collapsed', 'true');
        }}
        className="absolute top-3.5 right-3.5 text-zinc-500 hover:text-white transition-all cursor-pointer p-1.5 rounded-md hover:bg-white/5 z-10"
        title="Ocultar instalador"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4 rel transition-all">
        <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <Smartphone className="w-5 h-5 text-[#D4AF37]" />
        </div>
        
        <div className="space-y-1.5 flex-1 min-w-0 pr-6">
          <h4 className="font-semibold text-sm text-foreground tracking-tight flex items-center gap-1.5">
            LumiereOS no Smartphone
            <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-1.5 py-0.5 rounded-full font-semibold">Premium App</span>
          </h4>
          <p className="text-xs text-neutral-400 font-light leading-relaxed">
            Instale o aplicativo corporativo e tenha acesso instantâneo às agendas e checklists com notificações rápidas.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <Button
          onClick={handleInstallClick}
          className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-semibold shadow-[0_0_15px_rgba(212,175,55,0.15)] rounded-xl py-2 flex items-center justify-center gap-1.5 text-xs transition-all duration-300 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-black" />
          <span>{isReadyToInstall ? 'Instalar LumiereOS' : 'Como Instalar no Celular'}</span>
        </Button>

        {showInstructions && (
          <div className="mt-3.5 pt-3.5 border-t border-white/5 text-xs text-neutral-300 space-y-3 animate-fadeIn">
            {isIOS ? (
              <div className="space-y-2">
                <p className="font-medium text-[#D4AF37] flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> Instruções para iOS (Safari):
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-neutral-400 pl-0.5 leading-relaxed">
                  <li>Toque no botão <strong className="text-foreground">Compartilhar</strong> <Share className="w-3 h-3 text-sky-400 inline mx-0.5 mb-0.5" /> (na barra inferior do Safari).</li>
                  <li>Role para baixo e selecione <strong className="text-foreground">Adicionar à Tela de Início</strong> <Plus className="w-3 h-3 inline mx-0.5 mb-0.5" />.</li>
                  <li>Toque em <strong className="text-[#D4AF37]">Adicionar</strong> no canto superior direito.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-medium text-[#D4AF37] flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> Instruções para Android (Chrome):
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-neutral-400 pl-0.5 leading-relaxed">
                  <li>Toque no botão de menu (três pontos) no topo direito do navegador.</li>
                  <li>Selecione <strong className="text-foreground">Instalar aplicativo</strong> ou <strong className="text-foreground">Adicionar à tela inicial</strong>.</li>
                  <li>Confirme para adicionar o LumiereOS no menu de apps nativos do celular.</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
       alert("No iPhone/iPad, abra no Safari, toque no ícone de compartilhar e escolha 'Adicionar à Tela de Início'.");
    } else {
       alert("No Android, abra no Chrome, toque nos três pontos e escolha 'Adicionar à tela inicial'.");
    }
  };

  if (!isInstallable && !isIOS) return null;

  return (
    <Button 
      variant="outline" 
      className="w-full justify-start text-primary border-primary/20 hover:bg-primary/10 mt-4" 
      onClick={handleInstallClick}
    >
      <Download className="w-4 h-4 mr-2" />
      Instalar App
    </Button>
  );
}

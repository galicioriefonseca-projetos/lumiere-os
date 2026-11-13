import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Upload, RefreshCw, CheckCircle2, ShieldCheck, Sparkles, HelpCircle, Palette, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { auth } from '@/lib/firebase';

export default function PwaIconSettingsCard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string>('#050505');
  const [padding, setPadding] = useState<number>(14);
  const [cacheBuster, setCacheBuster] = useState<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/pwa/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.warn('Erro ao carregar status do PWA:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP ou SVG).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      toast.success('Logo carregada no preview! Escolha a cor de fundo e clique em Salvar Ícone.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomLogo = async () => {
    if (!selectedImage) {
      toast.error('Selecione uma imagem de logo primeiro.');
      return;
    }

    setLoading(true);
    try {
      let token = '';
      if (auth?.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      const res = await fetch('/api/pwa/update-icons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageBase64: selectedImage,
          backgroundColor: bgColor,
          paddingPercent: padding,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao atualizar ícones');
      }

      toast.success('Ícones do PWA gerados e atualizados com sucesso!');
      setSelectedImage(null);
      setCacheBuster(Date.now());
      fetchStatus();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar ícones.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Deseja restaurar o ícone oficial dourado do LumièreOS?')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/pwa/reset-default-icons', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      toast.success('Ícone oficial restaurado com sucesso!');
      setSelectedImage(null);
      setCacheBuster(Date.now());
      fetchStatus();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao restaurar ícones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-950 border-zinc-900 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-6 opacity-5 select-none pointer-events-none">
        <Smartphone className="w-32 h-32 text-white" />
      </div>

      <CardHeader className="border-b border-zinc-900/50 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#D4AF37]" />
              Ícone & Identidade do Aplicativo PWA (Mobile & Desktop)
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-1">
              Configure o logotipo que aparece na tela inicial dos celulares dos clientes e profissionais ao instalar o aplicativo.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" /> PWA Ativo
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Visual Previews in Simulated Devices */}
        <div>
          <span className="text-[11px] uppercase tracking-wider font-mono font-bold text-zinc-400 block mb-3">
            Simulação de Visualização na Tela do Celular
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* iOS Safari Squircle Preview */}
            <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 flex flex-col items-center text-center">
              <span className="text-[10px] text-zinc-400 font-mono uppercase mb-3 flex items-center gap-1">
                iPhone / iPad (iOS)
              </span>
              <div 
                className="w-16 h-16 rounded-[22%] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.5)] border border-white/10 flex items-center justify-center p-2 transition-transform hover:scale-105"
                style={{ backgroundColor: selectedImage ? bgColor : '#050505' }}
              >
                {selectedImage ? (
                  <img src={selectedImage} alt="Preview Logo" className="w-full h-full object-contain" />
                ) : (
                  <img src={`/apple-touch-icon.png?v=${cacheBuster}`} alt="PWA Icon" className="w-full h-full object-cover" />
                )}
              </div>
              <span className="text-xs font-semibold text-white mt-2.5">LumièreOS</span>
              <span className="text-[10px] text-zinc-500">Apple Touch (180x180)</span>
            </div>

            {/* Android Adaptive Circle Preview */}
            <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 flex flex-col items-center text-center">
              <span className="text-[10px] text-zinc-400 font-mono uppercase mb-3 flex items-center gap-1">
                Android (Círculo / Maskable)
              </span>
              <div 
                className="w-16 h-16 rounded-full overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.5)] border border-white/10 flex items-center justify-center p-3 transition-transform hover:scale-105"
                style={{ backgroundColor: selectedImage ? bgColor : '#050505' }}
              >
                {selectedImage ? (
                  <img src={selectedImage} alt="Preview Logo" className="w-full h-full object-contain" />
                ) : (
                  <img src={`/maskable-icon-512x512.png?v=${cacheBuster}`} alt="PWA Maskable Icon" className="w-full h-full object-cover" />
                )}
              </div>
              <span className="text-xs font-semibold text-white mt-2.5">LumièreOS</span>
              <span className="text-[10px] text-zinc-500">Android Safe Zone (512x512)</span>
            </div>

            {/* Standard Square Preview */}
            <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 flex flex-col items-center text-center">
              <span className="text-[10px] text-zinc-400 font-mono uppercase mb-3 flex items-center gap-1">
                Desktop / Launcher (Quadrado)
              </span>
              <div 
                className="w-16 h-16 rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.5)] border border-white/10 flex items-center justify-center p-2.5 transition-transform hover:scale-105"
                style={{ backgroundColor: selectedImage ? bgColor : '#050505' }}
              >
                {selectedImage ? (
                  <img src={selectedImage} alt="Preview Logo" className="w-full h-full object-contain" />
                ) : (
                  <img src={`/pwa-192x192.png?v=${cacheBuster}`} alt="PWA Standard Icon" className="w-full h-full object-cover" />
                )}
              </div>
              <span className="text-xs font-semibold text-white mt-2.5">LumièreOS</span>
              <span className="text-[10px] text-zinc-500">Standard PWA (192x192)</span>
            </div>
          </div>
        </div>

        {/* Custom Logo Upload Action Box */}
        <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                Personalizar com a Logo da Sua Empresa
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Envie o arquivo da sua logo (PNG transparente recomendado). O sistema ajusta automaticamente para todas as especificações do Google Play, Android e iOS Safari.
              </p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/png,image/jpeg,image/webp,image/svg+xml" 
              className="hidden" 
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-semibold text-xs h-9 gap-1.5 shrink-0 shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              Selecionar Arquivo da Logo
            </Button>
          </div>

          {selectedImage && (
            <div className="pt-4 border-t border-zinc-800/80 space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Background Color Picker */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold flex items-center gap-1">
                    <Palette className="w-3 h-3 text-[#D4AF37]" /> Cor de Fundo do Ícone
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={bgColor} 
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <div className="flex gap-2">
                      {['#050505', '#0A1813', '#0F172A', '#FFFFFF'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setBgColor(color)}
                          className={`w-7 h-7 rounded-md border text-[9px] flex items-center justify-center font-bold ${bgColor === color ? 'border-[#D4AF37] scale-110 shadow-sm' : 'border-zinc-700'}`}
                          style={{ backgroundColor: color, color: color === '#FFFFFF' ? '#000' : '#fff' }}
                        >
                          {bgColor === color ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Padding slider */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold">
                    Margem da Logo ({padding}%)
                  </label>
                  <input 
                    type="range" 
                    min="5" 
                    max="25" 
                    value={padding} 
                    onChange={(e) => setPadding(Number(e.target.value))}
                    className="w-full accent-[#D4AF37] cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 block">
                    Garante que a logo não seja cortada pelo formato circular do Android.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedImage(null)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={handleSaveCustomLogo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-1.5"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {loading ? 'Processando e Gerando Ícones...' : 'Salvar e Aplicar Ícone PWA'}
                </Button>
              </div>
            </div>
          )}

          {!selectedImage && (
            <div className="pt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Ícone atual: <strong>Oficial LumièreOS (Dourado & Esmeralda)</strong></span>
              <button
                type="button"
                disabled={loading}
                onClick={handleResetDefaults}
                className="text-[11px] text-zinc-400 hover:text-[#D4AF37] transition-colors underline cursor-pointer"
              >
                Restaurar padrão
              </button>
            </div>
          )}
        </div>

        {/* Technical How-To Reference Guide */}
        <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-900 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <HelpCircle className="w-4 h-4 text-[#D4AF37]" />
            Como funciona a estrutura de ícones do PWA no LumièreOS?
          </div>
          
          <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
            <p>
              Quando um cliente ou você abre o site no celular e clica em <strong>"Instalar Aplicativo"</strong> ou <strong>"Adicionar à Tela de Início"</strong>, o navegador (Chrome, Safari, Edge) consulta o manifesto PWA (<code className="text-[#D4AF37] bg-black/40 px-1 py-0.5 rounded">public/manifest.webmanifest</code>) e busca as imagens na pasta <code className="text-[#D4AF37] bg-black/40 px-1 py-0.5 rounded">public/</code>:
            </p>

            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li>
                <strong>/public/pwa-192x192.png:</strong> Resolução 192x192 px para telas móveis padrão e grade de apps.
              </li>
              <li>
                <strong>/public/pwa-512x512.png:</strong> Alta resolução 512x512 px para tela de carregamento (splash screen).
              </li>
              <li>
                <strong>/public/maskable-icon-512x512.png:</strong> Formato adaptável com 15% de margem de respiro para o Android recortar em círculo ou squircle sem cortar seu logo.
              </li>
              <li>
                <strong>/public/apple-touch-icon.png:</strong> Resolução 180x180 px usada exclusivamente pelo Safari no iPhone/iPad.
              </li>
            </ul>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-[11px] text-amber-200/90 mt-2">
              💡 <strong>Dica de Cache:</strong> Celulares salvam o ícone no cache do sistema operacional. Se você já tinha o app instalado na tela inicial do celular, remova o atalho e adicione novamente para ver a nova logo refletida.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

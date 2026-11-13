import React, { useRef, useState } from 'react';
import { Camera, Trash2, Upload, Loader2, Link as LinkIcon, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { compressImageToDataUrl } from '@/lib/imageUtils';

export interface AvatarUploadProps {
  value?: string | null;
  onChange: (value: string) => void;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function AvatarUpload({
  value,
  onChange,
  name = '',
  size = 'lg',
  label = 'Foto de Perfil',
  description = 'PNG, JPG ou WEBP de até 10MB.',
  disabled = false
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  const sizeClasses = {
    sm: 'w-12 h-12 text-xs',
    md: 'w-16 h-16 text-sm',
    lg: 'w-24 h-24 text-xl',
    xl: 'w-32 h-32 text-2xl'
  }[size];

  const getInitials = (n: string) => {
    if (!n) return 'U';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const dataUrl = await compressImageToDataUrl(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85
      });
      onChange(dataUrl);
      toast.success('Foto carregada e otimizada com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Falha ao processar foto.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    toast.info('Foto removida.');
  };

  const handleApplyUrl = () => {
    if (!customUrl.trim()) return;
    onChange(customUrl.trim());
    setShowUrlInput(false);
    setCustomUrl('');
    toast.success('Link da foto aplicado!');
  };

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 block">{label}</label>
          {value && !disabled && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              Remover Foto
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Avatar Preview com Trigger de Upload */}
        <div 
          onClick={() => !disabled && !isCompressing && fileInputRef.current?.click()}
          className={`relative ${sizeClasses} rounded-full overflow-hidden border-2 ${
            value ? 'border-[#D4AF37]' : 'border-dashed border-zinc-700 hover:border-[#D4AF37]'
          } bg-zinc-900 flex items-center justify-center cursor-pointer group shadow-lg transition-all shrink-0 select-none`}
        >
          {isCompressing ? (
            <div className="flex flex-col items-center justify-center text-zinc-400 gap-1">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
            </div>
          ) : value ? (
            <>
              <img 
                src={value} 
                alt={name || 'Avatar'} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
              {!disabled && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-1">
                  <Camera className="w-4 h-4 text-[#D4AF37]" />
                  <span>Trocar</span>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex flex-col items-center justify-center text-[#D4AF37] font-bold">
              {name ? (
                getInitials(name)
              ) : (
                <User className="w-1/2 h-1/2 text-zinc-600" />
              )}
              {!disabled && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-medium gap-1">
                  <Upload className="w-4 h-4 text-[#D4AF37]" />
                  <span>Inserir</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controles e Descrição */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled || isCompressing}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || isCompressing}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 text-xs bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white hover:border-[#D4AF37] hover:bg-zinc-800 gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
              {value ? 'Alterar Foto' : 'Carregar Imagem'}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || isCompressing}
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="h-8 px-2.5 text-xs text-zinc-400 hover:text-zinc-200 gap-1"
            >
              <LinkIcon className="w-3 h-3" />
              Colar Link
            </Button>
          </div>

          {description && (
            <p className="text-[11px] text-zinc-500 leading-tight">
              {description}
            </p>
          )}

          {showUrlInput && (
            <div className="flex items-center gap-2 pt-1 animate-fadeIn">
              <input
                type="url"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://exemplo.com/minha-foto.jpg"
                className="flex-1 h-8 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 text-xs text-white outline-none focus:border-[#D4AF37]"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleApplyUrl}
                className="h-8 px-2.5 text-xs bg-[#D4AF37] text-black font-semibold hover:bg-[#c49f2c]"
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

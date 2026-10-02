import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface LumiMascotAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  mood?: 'happy' | 'strategic' | 'alert' | 'celebrating';
  animated?: boolean;
  className?: string;
  showOrbitalRings?: boolean;
}

export function LumiMascotAvatar({
  size = 'md',
  mood = 'strategic',
  animated = true,
  className = '',
  showOrbitalRings = true,
}: LumiMascotAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-9 h-9',
    md: 'w-13 h-13',
    lg: 'w-18 h-18',
    xl: 'w-24 h-24',
    '2xl': 'w-36 h-36',
  };

  const ringGlowMap = {
    happy: 'from-amber-400/40 via-[#D4AF37]/30 to-amber-600/40 shadow-[0_0_20px_rgba(212,175,55,0.4)]',
    strategic: 'from-[#D4AF37]/50 via-amber-200/40 to-yellow-600/40 shadow-[0_0_25px_rgba(212,175,55,0.45)]',
    alert: 'from-rose-400/50 via-amber-400/40 to-rose-600/40 shadow-[0_0_25px_rgba(244,63,94,0.45)]',
    celebrating: 'from-emerald-400/50 via-[#D4AF37]/40 to-emerald-600/40 shadow-[0_0_30px_rgba(16,185,129,0.5)]',
  };

  return (
    <div className={`relative flex items-center justify-center shrink-0 select-none group ${className}`}>
      {/* Halo de luz dinâmico Atelier Quiet Luxury */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${ringGlowMap[mood]} ${
          animated ? 'animate-pulse' : ''
        } blur-md opacity-75`}
      />

      {/* Anéis orbitais finos animados para tamanhos médios e grandes */}
      {showOrbitalRings && (size === 'lg' || size === 'xl' || size === '2xl') && (
        <div
          className={`absolute -inset-2 rounded-full border border-[#D4AF37]/40 border-dashed ${
            animated ? 'animate-spin' : ''
          } pointer-events-none opacity-60`}
          style={{ animationDuration: '24s' }}
        />
      )}

      {/* Corpo / Avatar 3D da Mascote Lumi */}
      <div
        className={`relative ${sizeMap[size]} rounded-full bg-gradient-to-b from-[#1c1811] via-[#0e0c08] to-[#050403] border-2 border-[#D4AF37]/80 p-0.5 flex items-center justify-center shadow-2xl overflow-hidden`}
      >
        {!imageError ? (
          <img
            src="/images/lumi-mascot.jpg"
            alt="Mascote Lumi - LumièreOS"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center rounded-full scale-105 group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          /* Fallback SVG refinado */
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="50" cy="50" r="46" fill="#14120D" />
            <circle cx="50" cy="50" r="42" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="4 6" />
            <path d="M36 28 L42 36 L50 24 L58 36 L64 28 L62 40 L38 40 Z" fill="#D4AF37" stroke="#FFF2B2" strokeWidth="1" />
            <polygon points="50,22 53,26 50,30 47,26" fill="#FFFFFF" />
            <ellipse cx="50" cy="56" rx="28" ry="24" fill="#2A2417" />
            <ellipse cx="41" cy="53" rx="5" ry="7" fill="#FFE885" />
            <circle cx="42" cy="52" r="2.8" fill="#1C180E" />
            <ellipse cx="59" cy="53" rx="5" ry="7" fill="#FFE885" />
            <circle cx="58" cy="52" r="2.8" fill="#1C180E" />
            <path d="M45 64 Q50 69 55 64" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}

        {/* Reflexo de vidro acetinado */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/15 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Mini-estrela de status no canto superior */}
      {size !== 'xs' && size !== 'sm' && (
        <div className="absolute -top-1 -right-1 p-1 rounded-full bg-gradient-to-r from-[#D4AF37] to-amber-300 text-black shadow-lg border border-white/20">
          <Sparkles className="w-2.5 h-2.5" />
        </div>
      )}
    </div>
  );
}

export default LumiMascotAvatar;

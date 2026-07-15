import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import PWAInstallButton from '../PWAInstallButton';

interface AuthLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
  backTo?: string;
  backText?: string;
  onBackClick?: () => void;
}

export default function AuthLayout({
  children,
  showBackButton = false,
  backTo = '/',
  backText = 'Voltar para a página inicial',
  onBackClick
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans select-none">
      
      {/* Premium Cinematic Ambient Lights */}
      <div className="absolute top-[-10%] left-[-20%] w-[60vw] h-[60vw] bg-[radial-gradient(circle,_rgba(212,175,55,0.08)_0%,_transparent_70%)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60vw] h-[60vw] bg-[radial-gradient(circle,_rgba(180,140,40,0.06)_0%,_transparent_70%)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute top-[30%] right-[10%] w-[35vw] h-[35vw] bg-[radial-gradient(circle,_rgba(255,255,255,0.02)_0%,_transparent_70%)] rounded-full blur-[80px] pointer-events-none -z-10" />

      {/* Subtle Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none -z-10" />

      {/* Top Header - Logo and Navigation */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="absolute inset-[-4px] bg-primary/20 rounded-full blur-sm group-hover:bg-primary/30 transition-all duration-300" />
            <Sparkles className="w-8 h-8 text-primary relative transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
          </div>
          <span className="text-2xl font-heading font-medium tracking-wider bg-gradient-to-r from-neutral-50 via-neutral-100 to-amber-200/90 bg-clip-text text-transparent">
            Lumière
          </span>
        </Link>

        {showBackButton && (
          onBackClick ? (
            <button 
              type="button"
              onClick={onBackClick} 
              className="flex items-center gap-2 text-xs font-mono tracking-wider text-neutral-400 hover:text-primary transition-colors py-2 px-4 rounded-full bg-neutral-900/40 border border-neutral-800/60 backdrop-blur-sm hover:border-primary/20 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backText.toUpperCase()}</span>
            </button>
          ) : (
            <Link 
              to={backTo} 
              className="flex items-center gap-2 text-xs font-mono tracking-wider text-neutral-400 hover:text-primary transition-colors py-2 px-4 rounded-full bg-neutral-900/40 border border-neutral-800/60 backdrop-blur-sm hover:border-primary/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backText.toUpperCase()}</span>
            </Link>
          )
        )}
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-md mx-auto my-auto flex flex-col justify-center relative">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          {children}
        </motion.div>
      </main>

      {/* Elegant Footer / PWA Actions */}
      <footer className="w-full max-w-md mx-auto flex flex-col items-center gap-5 mt-10">
        <div className="flex justify-center w-full">
          <PWAInstallButton variant="banner" />
        </div>
        
        <p className="text-[10px] text-neutral-500 font-mono tracking-widest text-center uppercase">
          LumièreOS © {new Date().getFullYear()} • Enterprise Grade Security
        </p>
      </footer>

    </div>
  );
}

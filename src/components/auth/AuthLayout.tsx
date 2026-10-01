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
    <div className="min-h-screen bg-[#F6F5F2] text-[#171717] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans select-none">
      
      {/* Premium Cinematic Ambient Lights - Paleta Landing Page */}
      <div className="absolute top-[-10%] left-[-20%] w-[60vw] h-[60vw] bg-[radial-gradient(circle,_rgba(216,199,159,0.25)_0%,_transparent_70%)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[60vw] h-[60vw] bg-[radial-gradient(circle,_rgba(232,226,213,0.7)_0%,_transparent_70%)] rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute top-[30%] right-[10%] w-[35vw] h-[35vw] bg-[radial-gradient(circle,_rgba(184,155,94,0.12)_0%,_transparent_70%)] rounded-full blur-[90px] pointer-events-none -z-10" />

      {/* Subtle Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000004_1px,transparent_1px),linear-gradient(to_bottom,#00000004_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none -z-10" />

      {/* Top Header - Logo and Navigation */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171717] shadow-sm">
            <Sparkles className="h-4 w-4 text-[#D8C79F]" />
          </span>
          <span className="text-xl font-semibold tracking-tight text-[#171717]">
            Lumière<span className="text-[#B89B5E]">OS</span>
          </span>
        </Link>

        {showBackButton && (
          onBackClick ? (
            <button 
              type="button"
              onClick={onBackClick} 
              className="flex items-center gap-2 text-xs font-mono tracking-wider text-[#6B6B6B] hover:text-[#171717] transition-colors py-2 px-4 rounded-full bg-white border border-[#E5E2DC] shadow-sm hover:border-[#B89B5E]/40 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#B89B5E]" />
              <span>{backText.toUpperCase()}</span>
            </button>
          ) : (
            <Link 
              to={backTo} 
              className="flex items-center gap-2 text-xs font-mono tracking-wider text-[#6B6B6B] hover:text-[#171717] transition-colors py-2 px-4 rounded-full bg-white border border-[#E5E2DC] shadow-sm hover:border-[#B89B5E]/40"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#B89B5E]" />
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

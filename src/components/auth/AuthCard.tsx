import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import LoadingExperience from './LoadingExperience';

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  loading?: boolean;
  statusText?: string; // Optional message during async operation (e.g. 'Validando...', 'Entrando...')
  error?: string | null;
  onDismissError?: () => void;
}

export default function AuthCard({
  children,
  title,
  subtitle,
  loading = false,
  statusText = 'Carregando...',
  error = null,
  onDismissError
}: AuthCardProps) {
  return (
    <div className="relative w-full">
      
      {/* Decorative Outer Aura */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent rounded-2xl blur-xl pointer-events-none -z-10" />

      {/* Main Container Card - Landing Page Style */}
      <div className="w-full bg-white/95 border border-[#E5E2DC] backdrop-blur-md rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(23,23,23,0.06)] relative transition-all duration-300">
        
        {/* Top Accent Line - Dourado Nobre */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#B89B5E] to-transparent" />

        <div className="p-6 sm:p-8">
          
          {/* Card Header */}
          <div className="mb-6 text-center">
            <h1 className="text-xl sm:text-2xl font-heading font-medium tracking-tight text-[#171717]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 text-xs sm:text-sm text-[#6B6B6B] font-sans tracking-wide">
                {subtitle}
              </p>
            )}
          </div>

          {/* Premium Red Error Block */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="mb-5 p-4 rounded-xl bg-[#FAF0EE] border border-[#E8C4BF] flex items-start gap-3 relative overflow-hidden group shadow-xs"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#B97870]" />
                <AlertCircle className="w-5 h-5 text-[#B97870] shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-[#8A453D] font-sans leading-relaxed font-medium">
                  {error}
                </div>
                {onDismissError && (
                  <button 
                    onClick={onDismissError}
                    className="text-xs text-[#B97870] hover:text-[#8A453D] transition-colors uppercase font-mono tracking-widest pl-2 cursor-pointer font-bold"
                  >
                    OK
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Content / Children */}
          <div className={loading ? "pointer-events-none opacity-40 blur-[1px] transition-all duration-300" : "transition-all duration-300"}>
            {children}
          </div>

          {/* Elegant Micro-animated Glassmorphic Status Overlay */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-[#F6F5F2]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-40 text-[#171717]"
              >
                <LoadingExperience 
                  message={statusText} 
                  subtitle="Acesso executivo seguro e criptografado LumièreOS" 
                  size="md" 
                />
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}

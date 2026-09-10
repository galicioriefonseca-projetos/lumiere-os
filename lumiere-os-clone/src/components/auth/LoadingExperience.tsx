import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface LoadingExperienceProps {
  message?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingExperience({ 
  message = 'Sincronizando com servidores Lumière...', 
  subtitle = 'Por favor, aguarde enquanto validamos as credenciais de segurança.',
  size = 'md'
}: LoadingExperienceProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28'
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-6 font-sans">
      <div className="relative mb-6">
        {/* Glow effect */}
        <div className="absolute -inset-4 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
        
        {/* Concentric rotating luxury rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
          className={`${sizeClasses[size]} rounded-full border border-neutral-800 border-t-primary`}
        />
        
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className={`absolute inset-1.5 rounded-full border border-neutral-900 border-b-amber-500/60`}
        />

        <motion.div
          animate={{ scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center text-primary"
        >
          <Sparkles className="w-5 h-5" />
        </motion.div>
      </div>

      <motion.h3 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-semibold text-neutral-100 tracking-wide"
      >
        {message}
      </motion.h3>
      
      {subtitle && (
        <motion.p 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xs text-neutral-500 mt-1.5 max-w-xs leading-relaxed"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Shield, Cpu, Database, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';

interface LogStep {
  text: string;
  duration: number;
  icon: React.ReactNode;
}

const PREPARATION_STEPS: LogStep[] = [
  { text: 'Iniciando túnel seguro SSL LumièreOS...', duration: 900, icon: <Shield className="w-4 h-4 text-[#B89B5E]" /> },
  { text: 'Conectando ao banco de dados corporativo...', duration: 1100, icon: <Database className="w-4 h-4 text-[#B89B5E]" /> },
  { text: 'Sincronizando parâmetros de empresas e pessoas...', duration: 800, icon: <Cpu className="w-4 h-4 text-amber-500" /> },
  { text: 'Otimizando cache operacional local...', duration: 1000, icon: <Database className="w-4 h-4 text-emerald-500" /> },
  { text: 'Carregando módulos de inteligência Lumi IA...', duration: 1200, icon: <Sparkles className="w-4 h-4 text-[#B89B5E]" /> },
];

export default function PreparingEnvironmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const redirectTo = searchParams.get('to') || '/dashboard';

  useEffect(() => {
    const runSteps = async () => {
      for (let i = 0; i < PREPARATION_STEPS.length; i++) {
        const step = PREPARATION_STEPS[i];
        setCurrentStepIndex(i);
        setLogs(prev => [...prev, step.text]);
        await new Promise(resolve => setTimeout(resolve, step.duration));
        setProgress(Math.floor(((i + 1) / PREPARATION_STEPS.length) * 100));
      }

      setIsFinished(true);
      setLogs(prev => [...prev, 'Configuração concluída com sucesso! Bem-vindo ao LumièreOS.']);
      setProgress(100);

      setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 1500);
    };

    runSteps();
  }, [navigate, redirectTo]);

  const remainingTime = Math.max(0, Math.ceil(((PREPARATION_STEPS.length - currentStepIndex - 1) * 1.0)));

  return (
    <AuthLayout>
      <AuthCard 
        title="Preparando Ambiente" 
        subtitle="Configurando a gestão da sua empresa e equipe no LumièreOS..."
      >
        <div className="flex flex-col items-center py-4 font-sans text-center">
          
          {/* Circular Loader with Progress */}
          <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="48"
                className="stroke-[#E5E2DC]"
                strokeWidth="4"
                fill="transparent"
              />
              <motion.circle
                cx="56"
                cy="56"
                r="48"
                className="stroke-[#171717]"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 48}
                animate={{ strokeDashoffset: (2 * Math.PI * 48) * (1 - progress / 100) }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span 
                key={progress}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-2xl font-bold font-mono text-[#171717]"
              >
                {progress}%
              </motion.span>
              <span className="text-[10px] text-[#77746D] font-mono uppercase tracking-widest mt-0.5">
                Progresso
              </span>
            </div>

            <div className="absolute inset-0 rounded-full border border-[#B89B5E]/30 animate-ping opacity-30" />
          </div>

          {/* Title & Time */}
          <div className="mb-6 space-y-1">
            <h3 className="text-base font-semibold text-[#171717] tracking-wide">
              {isFinished ? 'Tudo Pronto para Lançamento' : 'Sincronizando Infraestrutura'}
            </h3>
            <p className="text-xs text-[#6B6B6B]">
              {isFinished ? 'Ambiente executivo consolidado.' : `Aproximadamente ${remainingTime}s restantes`}
            </p>
          </div>

          {/* Logs Terminal */}
          <div className="w-full bg-[#171717] border border-[#2B2B2B] rounded-2xl p-4 text-left font-mono text-[11px] h-[140px] overflow-y-auto space-y-2 custom-scrollbar shadow-inner">
            <AnimatePresence>
              {logs.map((log, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2 text-zinc-400 leading-relaxed"
                >
                  <span className="text-[#D8C79F] mt-0.5 select-none">&gt;</span>
                  <span className={idx === logs.length - 1 ? 'text-white font-medium' : ''}>
                    {log}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Security seal */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[#77746D] font-mono uppercase tracking-widest">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sessão corporativa criptografada</span>
          </div>

        </div>
      </AuthCard>
    </AuthLayout>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crown, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Sparkles, 
  HelpCircle,
  Play
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface TourStep {
  target: string | null;
  title: string;
  description: string;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  path?: string; // Optional: navigate to path to show target
}

export function InteractiveTour() {
  const { salonData, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const steps: TourStep[] = [
    {
      target: null,
      title: "Boas-vindas ao LumièreOS! 👑",
      description: "O LumièreOS é o seu centro de controle operacional e consultoria de alta performance, projetado sob medida para o mercado de beleza de luxo. Vamos fazer uma rápida visita guiada pelas principais funcionalidades para você dominar sua nova gestão!",
      position: 'center',
    },
    {
      target: "lumiere-desktop-sidebar",
      title: "Navegação por Módulos 🗂️",
      description: "Use a barra lateral esquerda para transitar instantaneamente entre nossa Agenda cirúrgica de atendimentos, painel de Clientes, serviços, cadastro de profissionais, metas, comissões de equipe e relatórios completos.",
      position: 'right',
      path: '/dashboard'
    },
    {
      target: "dashboard-stats-grid",
      title: "Métricas de Alto Impacto 📊",
      description: "Aqui no topo você tem uma leitura instantânea da saúde operacional: agendamentos marcados hoje, total de clientes ativos, aderência das rotinas de abertura/fechamento e porcentagem geral de alcance das metas.",
      position: 'bottom',
      path: '/dashboard'
    },
    {
      target: "gemini-insight-card",
      title: "Lumière AI Insights 🧠",
      description: "Este é o núcleo analítico inteligente do LumièreOS. Nossa inteligência artificial analisa em tempo real seus faturamentos, agendamentos e feedbacks de rotina para sugerir ações cirúrgicas e aumentar o seu lucro.",
      position: 'top',
      path: '/dashboard'
    },
    {
      target: "lumiere-ai-chat-trigger",
      title: "Mentor de Negócios 24/7 💬",
      description: "Sempre que precisar de um conselho criativo, ideias de campanhas de marketing, estratégias de reajuste de comissão ou com dúvidas no checklist, basta clicar no balão flutuante dourado do cérebro artificial!",
      position: 'left',
      path: '/dashboard'
    },
    {
      target: "lumiere-guide-trigger",
      title: "Central de Suporte Operacional 💡",
      description: "Se tiver dúvidas sobre o que cada módulo faz ou como operar os relatórios em PDF, clique no Guia do Sistema a qualquer momento para abrir o manual interativo de bordo de forma simples e rápida.",
      position: 'bottom',
      path: '/dashboard'
    },
    {
      target: null,
      title: "Tudo Pronto Para Brilhar! ✨",
      description: "Nossa visita terminou! Agora você tem o arsenal completo de inteligência e processos para elevar o seu negócio à excelência operacional. Precisa reiniciar o tour? A opção estará sempre à sua disposição no seu menu de perfil.",
      position: 'center'
    }
  ];

  // Control auto-starting the tour for fresh salon accounts
  useEffect(() => {
    if (!salonData?.id) return;
    
    const tourStatus = localStorage.getItem(`lumiere_tour_completed_${salonData.id}`);
    // Trigger if onboarding was completed AND they haven't run the guided tour yet
    if (salonData.onboardingCompleted && !tourStatus) {
      setTimeout(() => {
        setIsRunning(true);
        setCurrentStepIndex(0);
      }, 1600);
    }
  }, [salonData]);

  // Listener to track click dispatchers from DashboardLayout restart-tour trigger
  useEffect(() => {
    const handleStartTourExternal = (() => {
      setIsRunning(true);
      setCurrentStepIndex(0);
    }) as EventListener;

    window.addEventListener('lumiere-start-interactive-tour', handleStartTourExternal);
    return () => {
      window.removeEventListener('lumiere-start-interactive-tour', handleStartTourExternal);
    };
  }, []);

  const currentStep = steps[currentStepIndex];

  // Monitor DOM bounds of the targeted element
  useEffect(() => {
    if (!isRunning || !currentStep) {
      setTargetRect(null);
      return;
    }

    // Handles path redirection if step wants to live in another page/tab
    if (currentStep.path && location.pathname !== currentStep.path) {
      navigate(currentStep.path);
      // Wait for navigation and page mount
      setTimeout(updateBounds, 300);
      return;
    }

    updateBounds();

    // Listen to resize and scroll
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds);
    const observer = new MutationObserver(updateBounds);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds);
      observer.disconnect();
    };

    function updateBounds() {
      if (!currentStep.target) {
        setTargetRect(null);
        return;
      }
      const element = document.getElementById(currentStep.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        // If element width or height is 0 (hidden), ignore
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          // Scroll target slightly into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    }
  }, [isRunning, currentStepIndex, currentStep, location.pathname]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleClose = () => {
    if (window.confirm("Deseja encerrar o tour interativo? Você poderá reiniciá-lo a qualquer momento.")) {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsRunning(false);
    if (salonData?.id) {
      localStorage.setItem(`lumiere_tour_completed_${salonData.id}`, 'true');
    }
  };

  if (!isRunning || !currentStep) return null;

  // Render popup position values
  const getPopupStyles = () => {
    if (!targetRect) {
      // Centered overlay modal
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const,
        zIndex: 100,
      };
    }

    const margin = 16;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    const popupWidth = 340;
    const popupHeight = 240;

    let top = targetRect.bottom + scrollY + margin;
    let left = targetRect.left + scrollX + (targetRect.width / 2) - (popupWidth / 2);

    if (currentStep.position === 'top') {
      top = targetRect.top + scrollY - popupHeight - margin;
    } else if (currentStep.position === 'left') {
      top = targetRect.top + scrollY + (targetRect.height / 2) - (popupHeight / 2);
      left = targetRect.left + scrollX - popupWidth - margin;
    } else if (currentStep.position === 'right') {
      top = targetRect.top + scrollY + (targetRect.height / 2) - (popupHeight / 2);
      left = targetRect.right + scrollX + margin;
    }

    // Keep within safe window bounds
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    if (left < 10) left = 10;
    if (left + popupWidth > screenWidth - 10) {
      left = screenWidth - popupWidth - 10;
    }
    if (top < 10) top = 10;

    return {
      top: `${top}px`,
      left: `${left}px`,
      position: 'absolute' as const,
      width: `${popupWidth}px`,
      zIndex: 100,
    };
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {/* Dynamic clip-path SVG target spotlight mask context overlay */}
      <div 
        className="fixed inset-0 bg-black/80 pointer-events-auto transition-all duration-300 z-40 ease-out backdrop-blur-[1.5px]"
        style={{
          clipPath: targetRect 
            ? `polygon(
                0% 0%, 
                0% 100%, 
                ${targetRect.left}px 100%, 
                ${targetRect.left}px ${targetRect.top}px, 
                ${targetRect.right}px ${targetRect.top}px, 
                ${targetRect.right}px ${targetRect.bottom}px, 
                ${targetRect.left}px ${targetRect.bottom}px, 
                ${targetRect.left}px 100%, 
                100% 100%, 
                100% 0%
              )`
            : 'none'
        }}
        onClick={handleClose}
      />

      {/* Target spotlight border highlight path */}
      {targetRect && (
        <div 
          className="absolute border-2 border-[#D4AF37] rounded-2.5xl pointer-events-none z-45 animate-pulse shadow-[0_0_25px_rgba(212,175,55,0.4)]"
          style={{
            top: `${targetRect.top + window.scrollY}px`,
            left: `${targetRect.left + window.scrollX}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
        />
      )}

      {/* Tour card details container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -10 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pointer-events-auto flex flex-col p-6 rounded-3xl bg-[#09090b] border border-[#D4AF37]/35 shadow-[0_20px_50px_rgba(0,0,0,0.9)] max-w-sm"
          style={getPopupStyles()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/30 text-[#D4AF37] flex items-center justify-center">
                <Crown className="w-3.5 h-3.5" />
              </span>
              <span className="text-[10px] font-bold text-zinc-400 font-mono tracking-widest uppercase">
                Passo {currentStepIndex + 1} de {steps.length}
              </span>
            </div>

            <button 
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-2 mb-5">
            <h4 className="font-heading font-medium text-sm text-white tracking-wide">
              {currentStep.title}
            </h4>
            <p className="text-[11.5px] text-zinc-300 leading-relaxed font-light">
              {currentStep.description}
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <button
              onClick={handleComplete}
              className="text-[10.5px] text-zinc-500 hover:text-zinc-300 transition-colors font-medium cursor-pointer"
            >
              Pular tudo
            </button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] h-8 px-3 rounded-xl transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 text-[11px] font-bold text-black bg-[#D4AF37] hover:bg-amber-500 shadow-[0_2px_8px_rgba(212,175,55,0.2)] h-8 px-4 rounded-xl transition-all cursor-pointer animate-pulse-slow"
              >
                <span>{currentStepIndex === steps.length - 1 ? "Começar!" : "Avançar"}</span>
                {currentStepIndex !== steps.length - 1 && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  MessageSquare, 
  Send, 
  X, 
  RefreshCw, 
  Bot, 
  Slash,
  ChevronDown,
  Trash2,
  Lock,
  ArrowRight
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function LumiereChatbot() {
  const { userData, salonData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested prompts
  const suggestions = [
    { label: "📊 Vendas & Faturamento", prompt: "Como posso aumentar as vendas e o faturamento do salão este mês usando estratégias de revenda e cross-selling?" },
    { label: "👥 Liderança de Equipe", prompt: "Como motivar os profissionais parceiros e alinhar o desempenho de comissões sem causar atrito?" },
    { label: "📋 Checklist Essenza", prompt: "Como usar melhor a Avaliação Diária Essenza para manter o padrão de excelência de abertura e fechamento?" },
    { label: "💎 Atendimento Superior", prompt: "Quais práticas de recepção e recepção de luxo posso adotar para criar uma experiência de marca verdadeiramente memorável?" },
  ];

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, loading]);

  // Load welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const saved = localStorage.getItem(`lumiere_chat_history_${salonData?.id || 'default'}`);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
          return;
        } catch (e) {
          console.error("Erro ao carregar histórico local:", e);
        }
      }

      // Default welcome
      const welcomeName = userData?.fullName?.split(' ')[0] || 'Gestor';
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Olá, **${welcomeName}**! Seja muito bem-vindo ao suporte de consultoria do **Lumière AI**.\n\nSou seu mentor particular de negócios e liderança para o **${salonData?.name || 'seu salão'}**. Estou pronto para te ajudar a otimizar processos operacionais, aumentar as taxas de retenção de clientes, calibrar o controle de metas e aprimorar a comissão dos seus colaboradores.\n\nEscolha um dos tópicos rápidos abaixo ou digite sua dúvida comercial! Como posso impulsionar seu salão de beleza premium hoje?`,
          timestamp: Date.now()
        }
      ]);
    }
  }, [isOpen]);

  // Save history
  const saveChatHistory = (history: ChatMessage[]) => {
    localStorage.setItem(`lumiere_chat_history_${salonData?.id || 'default'}`, JSON.stringify(history));
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    saveChatHistory(updatedMessages);
    setMessageInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/gemini-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          salonName: salonData?.name,
          businessType: salonData?.businessType,
          salonPlan: salonData?.plan,
          userName: userData?.fullName,
          userRole: userData?.role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro de comunicação ao processar chat.');
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: data.text || 'Desculpe, Lumière AI não gerou retorno no momento.',
        timestamp: Date.now()
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } catch (err: any) {
      console.error('Lumiere Chat error:', err);
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: `⚠️ **Erro de Conexão:** Não consegui me conectar com a central cognitiva do Lumière. Por favor, verifique se seu servidor possui a chave \`GEMINI_API_KEY\` configurada ou tente reenviar em instantes.`,
        timestamp: Date.now()
      };
      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Deseja apagar o histórico de conversas com o assistente Lumière AI?")) {
      setMessages([]);
      localStorage.removeItem(`lumiere_chat_history_${salonData?.id || 'default'}`);
      setIsOpen(false);
    }
  };

  // Safe elegant lightweight markdown format parser
  const formatMessageContent = (text: string) => {
    if (!text) return null;
    
    return text.split('\n').map((line, idx) => {
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }

      // Bold pattern: **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-semibold text-white">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      const content = parts.length > 0 ? parts : line;

      // Unordered lists: line starts with - or *
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const rawText = line.replace(/^[\s-*]+/, '');
        
        // Render nesting inside lists too
        const boldParts = [];
        let boldLast = 0;
        let boldMatch;
        while ((boldMatch = boldRegex.exec(rawText)) !== null) {
          if (boldMatch.index > boldLast) {
            boldParts.push(rawText.substring(boldLast, boldMatch.index));
          }
          boldParts.push(<strong key={boldMatch.index} className="font-semibold text-[#D4AF37]">{boldMatch[1]}</strong>);
          boldLast = boldRegex.lastIndex;
        }
        if (boldLast < rawText.length) {
          boldParts.push(rawText.substring(boldLast));
        }

        return (
          <li key={idx} className="ml-4 list-disc text-zinc-300 leading-relaxed text-xs my-0.5 font-sans">
            {boldParts.length > 0 ? boldParts : rawText}
          </li>
        );
      }

      return (
        <p key={idx} className="text-zinc-300 leading-relaxed text-xs mb-1 font-sans font-light">
          {content}
        </p>
      );
    });
  };

  return (
    <>
      {/* Absolute floating floating button button */}
      <div className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8">
        <button
          id="lumiere-ai-chat-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className={`group flex items-center justify-center p-3.5 rounded-full select-none shadow-[0_8px_32px_rgba(212,175,55,0.2)] bg-gradient-to-r from-zinc-950 via-zinc-900 to-black hover:from-amber-500 hover:to-amber-600 border border-[#D4AF37]/30 hover:border-amber-400 text-[#D4AF37] hover:text-black transition-all duration-300 transform scale-100 hover:scale-110 active:scale-95 focus:outline-none`}
          aria-label="Falar com Lumiere AI"
        >
          <div className="relative">
            {isOpen ? (
              <X className="w-6 h-6 transition-transform duration-300 rotate-90" />
            ) : (
              <div className="flex items-center gap-1">
                <Sparkles className="w-5 h-5 text-[#D4AF37] group-hover:text-black hover:animate-spin transition-colors" />
                <span className="max-w-0 overflow-hidden font-heading text-xs font-semibold tracking-wider uppercase transition-all duration-500 group-hover:max-w-28 group-hover:ml-1.5 whitespace-nowrap text-white group-hover:text-black">
                  Lumière AI
                </span>
              </div>
            )}
            
            {/* Ambient gold notification halo dot */}
            {!isOpen && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            )}
          </div>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="lumiere-ai-chatbot-dialog"
            initial={{ opacity: 0, y: 35, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-22 right-4 md:right-8 z-50 w-[calc(100vw-32px)] sm:w-96 h-[560px] max-h-[82vh] rounded-3xl overflow-hidden bg-zinc-950 border border-[#D4AF37]/25 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col font-sans"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black border-b border-[#D4AF37]/15 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#D4AF37] animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-semibold text-white tracking-wide uppercase flex items-center gap-1">
                    Lumière AI
                    <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-[#D4AF37] px-1.5 py-0.2 rounded font-sans uppercase font-bold tracking-widest scale-90">
                      Mentor
                    </span>
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] text-zinc-400 font-light">Online • Inteligente</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 1 && (
                  <button
                    onClick={handleClearHistory}
                    title="Apagar Histórico"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-500 hover:bg-white/5 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2.5 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-[#D4AF37]/25 flex items-center justify-center shrink-0 self-start text-[#D4AF37]">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-zinc-800 text-white rounded-tr-none shadow-md font-light'
                          : 'bg-zinc-900/60 border border-white/5 text-zinc-200 rounded-tl-none shadow-inner'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="space-y-1">{formatMessageContent(msg.content)}</div>
                      ) : (
                        <p className="whitespace-pre-line break-words font-sans">{msg.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-2.5 max-w-[85%]">
                    <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-[#D4AF37]/25 flex items-center justify-center shrink-0 text-[#D4AF37]">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="p-3 bg-zinc-900/60 border border-white/5 rounded-2xl rounded-tl-none flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts footer when messages is minimal */}
            {messages.length <= 1 && (
              <div className="px-4 py-2 bg-zinc-950 border-t border-white/5 space-y-1.5">
                <p className="text-[10px] text-zinc-400 font-semibold tracking-wider font-mono uppercase opacity-75">Gostaria de saber:</p>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                  {suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(sug.prompt)}
                      className="text-left w-full p-2 rounded-xl text-[11px] text-zinc-300 font-light hover:text-white bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/20 hover:bg-[#D4AF37]/5 transition-all text-ellipsis overflow-hidden flex items-center justify-between"
                    >
                      <span>{sug.label}</span>
                      <ArrowRight className="w-3 h-3 text-[#D4AF37] opacity-60 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(messageInput);
              }}
              className="p-3 bg-zinc-950 border-t border-white/5 flex gap-2 items-center"
            >
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Questione metas, checklists, marketing..."
                disabled={loading}
                className="flex-1 h-10 px-3 rounded-xl bg-zinc-900 border border-white/5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]/35 transition-all"
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || loading}
                className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 text-black disabled:text-zinc-500 flex items-center justify-center transition-all focus:outline-none shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

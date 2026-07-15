import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Scissors, 
  CalendarCheck2, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCcw, 
  FileText, 
  TrendingUp, 
  CalendarDays, 
  Inbox, 
  Zap, 
  Lock, 
  Check, 
  X,
  Users,
  LineChart,
  DollarSign,
  Briefcase,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PWAInstallButton from '../components/PWAInstallButton';
import { APP_INFO } from '@/config/appInfo';

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'financeiro' | 'equipe' | 'indicadores'>('dashboard');
  const termsUrl = import.meta.env.VITE_TERMS_URL || `mailto:${APP_INFO.supportEmail}?subject=Solicitação%20dos%20Termos%20de%20Uso`;
  const privacyUrl = import.meta.env.VITE_PRIVACY_URL || `mailto:${APP_INFO.supportEmail}?subject=Solicitação%20da%20Política%20de%20Privacidade`;
  const licenseUrl = import.meta.env.VITE_LICENSE_URL || termsUrl;
  const caktoPolicyUrl = import.meta.env.VITE_CAKTO_POLICY_URL || privacyUrl;
  const supportWhatsapp = String(import.meta.env.VITE_SUPPORT_WHATSAPP || '').replace(/\D/g, '');
  const supportWhatsappUrl = supportWhatsapp ? `https://wa.me/${supportWhatsapp}` : `mailto:${APP_INFO.supportEmail}`;
  const instagramUrl = import.meta.env.VITE_INSTAGRAM_URL || '';
  const linkedinUrl = import.meta.env.VITE_LINKEDIN_URL || '';
  const publicLinkClass = 'hover:text-primary transition-colors';

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      navigate('/login?source=pwa', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col font-sans selection:bg-primary/30 selection:text-primary">
      {/* Glow ambient background effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[1200px] right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-[800px] left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header Premium */}
      <header className="border-b border-white/5 backdrop-blur-md sticky top-0 z-50 bg-black/60">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
              <Sparkles className="w-8 h-8 text-primary relative z-10 animate-pulse" />
            </div>
            <span className="text-2xl font-heading font-medium tracking-wide bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">Lumière</span>
            <span className="text-[10px] uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono">OS</span>
          </div>
          
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/login")} 
              className="rounded-full text-zinc-400 hover:text-white transition-colors text-sm hover:bg-white/5 px-5"
            >
              Acessar Sistema
            </Button>
            <Button 
              onClick={() => navigate("/cadastro")} 
              className="rounded-full bg-primary hover:bg-gold-400 text-black font-semibold shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all px-6 py-2.5 text-xs uppercase tracking-wider"
            >
              Diagnóstico Estratégico
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section - Posicionamento Premium */}
        <section className="relative pt-32 pb-24 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="px-4 py-2 rounded-full border border-primary/25 bg-primary/5 text-primary text-xs font-semibold tracking-widest uppercase mb-4 inline-flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                O Padrão Ouro em Gestão de Beleza
              </span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-5xl md:text-8xl font-light tracking-tight leading-[1.05] font-sans"
            >
              O sistema operacional <br/>
              para <span className="italic font-medium text-transparent bg-clip-text bg-gradient-to-r from-primary via-gold-400 to-white">empresas da beleza.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg md:text-xl text-zinc-400 font-light max-w-3xl mx-auto leading-relaxed"
            >
              Substitua dezenas de ferramentas genéricas por um único ecossistema integrado de alta performance. Desenvolvido exclusivamente para salões de beleza, clínicas e barbearias de alto padrão que buscam operação impecável e inteligência comercial.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row justify-center gap-5 pt-6"
            >
              <Button 
                size="lg" 
                onClick={() => navigate("/cadastro")} 
                className="rounded-full h-14 px-10 text-xs uppercase tracking-wider bg-primary hover:bg-gold-400 text-black font-bold shadow-[0_0_35px_rgba(212,175,55,0.25)] hover:shadow-[0_0_55px_rgba(212,175,55,0.45)] transition-all duration-300"
              >
                Iniciar Diagnóstico Estratégico
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => {
                  const el = document.getElementById('tour');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }} 
                className="rounded-full h-14 px-10 text-xs uppercase tracking-wider border-zinc-800 hover:border-primary/50 text-zinc-300 hover:text-white transition-all duration-300 bg-zinc-950/40"
              >
                Ver o Sistema por Dentro
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="flex justify-center items-center gap-2 pt-4 text-xs text-zinc-500 font-light"
            >
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Garantia de 7 dias com intermediação segura pela Cakto</span>
            </motion.div>
          </div>
        </section>

        {/* PWA App Install Banner */}
        <section className="py-10 px-6">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-zinc-900/80 to-black border border-white/5 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Sparkles className="w-64 h-64 text-primary" />
            </div>
            <div className="relative z-10 flex-1 space-y-2">
              <span className="text-[10px] uppercase tracking-widest font-mono text-primary font-bold">Tecnologia PWA</span>
              <h3 className="text-2xl font-heading text-white">Sempre com você, no celular ou tablet</h3>
              <p className="text-zinc-400 font-light text-sm max-w-xl">
                O Lumière foi projetado para funcionar perfeitamente em dispositivos móveis. Instale nosso aplicativo diretamente do navegador e controle sua operação com um toque.
              </p>
            </div>
            <div className="relative z-10 shrink-0">
              <PWAInstallButton variant="button" />
            </div>
          </div>
        </section>

        {/* TOUR SYSTEM SECTION - IMAGENS DO SISTEMA COM INTERATIVIDADE LUXUOSA EM CSS */}
        <section id="tour" className="py-24 px-6 border-y border-white/5 bg-zinc-950/40 relative">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="text-xs uppercase font-bold text-primary tracking-widest bg-primary/10 px-4 py-1.5 rounded-full">O Ecossistema LumièreOS</span>
              <h2 className="text-4xl md:text-5xl font-heading font-light tracking-tight text-white font-sans">Sua empresa de beleza em alta definição</h2>
              <p className="text-zinc-400 font-light leading-relaxed text-base">
                Explore a refinada interface do LumièreOS. Projetado com estética premium de alto contraste, tipografia perfeita e carregamento instantâneo.
              </p>
            </div>

            {/* Tabs Controller */}
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto" id="system-tour-tabs">
              {[
                { id: 'dashboard', label: 'Painel Geral (Dashboard)', icon: LineChart },
                { id: 'agenda', label: 'Agenda Inteligente', icon: CalendarCheck2 },
                { id: 'financeiro', label: 'Faturamento & Comissões', icon: DollarSign },
                { id: 'equipe', label: 'Checklist Lumière', icon: Scissors },
                { id: 'indicadores', label: 'IA Lumière Analytics', icon: TrendingUp },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`tab-btn-${tab.id}`}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer border ${
                      activeTab === tab.id
                        ? 'bg-primary text-black border-primary shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                        : 'bg-zinc-900/60 text-zinc-400 border-white/5 hover:bg-zinc-900 hover:border-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Visualizer Frame */}
            <div className="bg-zinc-900/40 rounded-3xl border border-white/10 p-4 md:p-6 shadow-3xl max-w-5xl mx-auto relative overflow-hidden" id="system-tour-frame">
              {/* Browser bar layout */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 block" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80 block" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80 block" />
                  <span className="text-zinc-500 text-xs font-mono ml-4 font-light bg-black/40 px-4 py-1 rounded-full border border-white/5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse block" />
                    lumiereos.com/dashboard/app
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-bold bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-3 py-1 rounded-full">
                  LUMIÈRE OS v1.4
                </span>
              </div>

              {/* Dynamic Frame Content Container */}
              <div className="min-h-[420px] bg-black/60 rounded-2xl p-6 relative flex flex-col justify-between overflow-hidden">
                <AnimatePresence mode="wait">
                  {activeTab === 'dashboard' && (
                    <motion.div 
                      key="dashboard"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6 w-full"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Indicadores Gerais</span>
                          <h4 className="text-xl font-heading text-white font-medium">Balanço de Performance Corporativa</h4>
                        </div>
                        <span className="text-xs text-zinc-400 font-light bg-zinc-900 border border-white/5 px-3 py-1 rounded">Hoje, {new Date().toLocaleDateString('pt-BR')}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-zinc-950/90 border border-white/5 rounded-2xl p-4 space-y-1">
                          <span className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold block">Faturamento Diário</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">R$ 14.850,00</span>
                            <span className="text-xs font-semibold text-emerald-400 font-mono">+18%</span>
                          </div>
                          <span className="text-[9px] text-zinc-400 font-light block">Meta diária: R$ 12.000,00 (Atingida)</span>
                        </div>
                        <div className="bg-zinc-950/90 border border-white/5 rounded-2xl p-4 space-y-1">
                          <span className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold block">Taxa de Ocupação</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">87.4%</span>
                            <span className="text-xs font-semibold text-emerald-400 font-mono">+4.2%</span>
                          </div>
                          <span className="text-[9px] text-zinc-400 font-light block">82 slots agendados de 94 disponíveis</span>
                        </div>
                        <div className="bg-zinc-950/90 border border-white/5 rounded-2xl p-4 space-y-1">
                          <span className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold block">Comissão Distribuída</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-[#D4AF37]">R$ 5.940,00</span>
                            <span className="text-xs font-semibold text-zinc-400 font-mono">Méd. 40%</span>
                          </div>
                          <span className="text-[9px] text-zinc-400 font-light block">Processada e rateada de forma instantânea</span>
                        </div>
                      </div>

                      {/* Simulated Chart preview */}
                      <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-4 h-48 flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-white">Curva de Faturamento Semanal</span>
                          <span className="text-[10px] text-zinc-400">Total acumulado: R$ 89.240,00</span>
                        </div>
                        <div className="flex-1 flex items-end gap-3 px-2">
                          {[35, 45, 28, 62, 80, 75, 95].map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                              <div className="w-full bg-gradient-to-t from-primary/20 to-primary rounded-t" style={{ height: `${val * 1.1}px` }} />
                              <span className="text-[9px] text-zinc-500 font-mono">{['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'][i]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'agenda' && (
                    <motion.div 
                      key="agenda"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6 w-full"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Agenda Corporativa</span>
                          <h4 className="text-xl font-heading text-white font-medium">Controle de Fluxo Operacional</h4>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">8 Atendimentos Ativos</span>
                          <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">Sala de Espera: 2</span>
                        </div>
                      </div>

                      {/* Agenda Schedule Grid Simulation */}
                      <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-4 overflow-hidden space-y-3">
                        {[
                          { time: '14:00', client: 'Heloísa Cavalcanti', service: 'Mechas + Reconstrução', professional: 'Matheus Costa (Stylist)', status: 'Ativo', statusColor: 'bg-emerald-500 text-emerald-950' },
                          { time: '14:30', client: 'Giselle Fontoura', service: 'Design de Sobrancelha', professional: 'Luana Santos (Estética)', status: 'Espera', statusColor: 'bg-amber-400 text-black' },
                          { time: '15:00', client: 'Adriana Montenegro', service: 'Manicure Premium (Gel)', professional: 'Mariana Silva (Nails)', status: 'Confirmado', statusColor: 'bg-primary text-black' },
                          { time: '16:00', client: 'Alessandra Albuquerque', service: 'Corte Conceito Lumière', professional: 'Matheus Costa (Stylist)', status: 'Confirmado', statusColor: 'bg-primary text-black' }
                        ].map((row, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all gap-2">
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-mono font-bold text-[#D4AF37] bg-[#D4AF37]/5 border border-[#D4AF37]/15 px-2.5 py-1 rounded">{row.time}</span>
                              <div>
                                <span className="text-xs font-semibold text-white block">{row.client}</span>
                                <span className="text-[10px] text-zinc-400 font-light">{row.service}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4">
                              <span className="text-[10px] text-zinc-400 font-mono">{row.professional}</span>
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded font-sans ${row.statusColor}`}>{row.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'financeiro' && (
                    <motion.div 
                      key="financeiro"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6 w-full"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Controle Contábil</span>
                          <h4 className="text-xl font-heading text-white font-medium">Conciliação Automática de Comissões</h4>
                        </div>
                        <span className="text-xs text-primary font-mono font-medium">Bandeira: Cakto Gateway</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-4 space-y-4">
                          <span className="text-xs font-bold text-white block">Distribuição de Lucros (Matriz de Comissão)</span>
                          <div className="space-y-2">
                            {[
                              { name: 'Matheus Costa', role: 'Hair Stylist', revenue: 'R$ 8.400,00', share: '40%', comm: 'R$ 3.360,00' },
                              { name: 'Mariana Silva', role: 'Nail Designer', revenue: 'R$ 3.900,00', share: '45%', comm: 'R$ 1.755,00' },
                              { name: 'Luana Santos', role: 'Esteticista', revenue: 'R$ 2.550,00', share: '50%', comm: 'R$ 1.275,00' }
                            ].map((row, i) => (
                              <div key={i} className="flex justify-between items-center text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                <div>
                                  <span className="text-white font-medium block">{row.name}</span>
                                  <span className="text-[10px] text-zinc-500 font-light">{row.role} • {row.share} taxa</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[#D4AF37] font-semibold block">{row.comm}</span>
                                  <span className="text-[9px] text-zinc-500 font-mono">Ref. {row.revenue}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                          <span className="text-xs font-bold text-white block">Processador Integrado de Cobrança</span>
                          <div className="p-3 bg-zinc-900/80 border border-white/5 rounded-xl text-[11px] space-y-2">
                            <div className="flex justify-between">
                              <span className="text-zinc-400 font-light">Status do Link Comercial:</span>
                              <span className="text-emerald-400 font-semibold font-mono">Ativo e Conectado</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-400 font-light">Plano Operacional:</span>
                              <span className="text-white font-semibold">Lumière Founder</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-400 font-light">Intermediador:</span>
                              <span className="text-white font-light">Cakto Tecnologia S.A.</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-light leading-relaxed border-t border-white/5 pt-2">
                            Garantia de segurança de transações e regras comerciais protegidas por criptografia ponta a ponta.
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'equipe' && (
                    <motion.div 
                      key="equipe"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6 w-full"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Cultura de Excelência</span>
                          <h4 className="text-xl font-heading text-white font-medium">Checklist Operacional Lumière</h4>
                        </div>
                        <span className="text-xs text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-white/5">Meta Diária: 100% Conformidade</span>
                      </div>

                      {/* Live Checklist Preview */}
                      <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">Tarefas Operacionais de Abertura & Recebimento</span>
                          <span className="text-xs font-bold text-emerald-400">92% Concluído</span>
                        </div>
                        <div className="space-y-2">
                          {[
                            { task: 'Climatização e som ambiente calibrados (padrão Lumière)', checked: true, author: 'Recepcionista (13:10)' },
                            { task: 'Verificação e abastecimento do frigobar com águas e cafés premium', checked: true, author: 'Apoio (13:15)' },
                            { task: 'Esterilização dos kits de atendimento e inspeção visual das bancadas', checked: true, author: 'Stylist (13:20)' },
                            { task: 'Checklist de recepção: Relatório de clientes vip do dia impresso', checked: false, author: 'Recepcionista (Pendente)' }
                          ].map((row, i) => (
                            <div key={i} className="flex items-start justify-between p-2.5 rounded-lg bg-white/[0.01] border border-white/5">
                              <div className="flex items-start gap-2.5">
                                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-all ${
                                  row.checked ? 'bg-primary border-primary text-black' : 'border-zinc-700 bg-transparent'
                                }`}>
                                  {row.checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <span className={`text-xs ${row.checked ? 'text-zinc-400 line-through font-light' : 'text-zinc-200'}`}>{row.task}</span>
                              </div>
                              <span className="text-[9px] text-zinc-500 font-mono shrink-0 ml-4">{row.author}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'indicadores' && (
                    <motion.div 
                      key="indicadores"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6 w-full"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Cognição Estratégica</span>
                          <h4 className="text-xl font-heading text-white font-medium">Lumière AI Intelligence Analyst</h4>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-mono bg-primary/20 text-primary px-3 py-1 rounded-full animate-pulse border border-primary/20">Processador Ativo</span>
                      </div>

                      <div className="p-5 rounded-2xl bg-zinc-950/90 border border-primary/20 space-y-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-primary" />
                          <span className="text-xs font-semibold text-white">Relatório Gerencial de Tendências de Alta</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed font-light">
                          "Olá, Roberto. Identificamos que o serviço <strong className="text-primary font-semibold">Mechas + Reconstrução</strong> registrou uma alta de demanda de 32% nesta última quinzena. O ticket médio por cliente subiu para R$ 420,00. Sugerimos acionar uma campanha direcionada para a lista de clientes VIP que não retornam há mais de 45 dias para consolidar este faturamento."
                        </p>
                        
                        <div className="pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                          <div className="space-y-1">
                            <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider block">Retenção de Clientes</span>
                            <span className="text-base font-bold text-white font-mono">78.2%</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider block">Ticket Médio</span>
                            <span className="text-base font-bold text-white font-mono">R$ 284,00</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider block">Eficiência de Equipe</span>
                            <span className="text-base font-bold text-white font-mono">94.1%</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider block">Margem de Lucro</span>
                            <span className="text-base font-bold text-white font-mono">31.5%</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* BENEFÍCIOS REAIS SECTION */}
        <section className="py-24 px-6 max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="text-xs uppercase font-bold text-primary tracking-widest bg-primary/10 px-4 py-1.5 rounded-full">Retorno Sobre Investimento</span>
            <h2 className="text-4xl md:text-5xl font-heading font-light tracking-tight text-white font-sans">Transformação real, sem lero-lero</h2>
            <p className="text-zinc-400 font-light leading-relaxed text-base">
              Ao escolher o LumièreOS, você não adquire apenas mais um software. Você redefine a cultura operacional e potencializa a lucratividade da sua empresa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 hover:border-primary/20 hover:bg-zinc-900 transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-heading text-white">Faturamento Elevado</h3>
              <p className="text-sm text-zinc-400 leading-relaxed font-light">
                Mapeamento analítico de metas por colaborador, inteligência de upsell e redução instantânea de cancelamentos com alertas inteligentes de re-agendamento.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 hover:border-primary/20 hover:bg-zinc-900 transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-heading text-white">Equipe de Alto Padrão</h3>
              <p className="text-sm text-zinc-400 leading-relaxed font-light">
                Com o Checklist Lumière e o controle de comissões, seus profissionais sentem transparência total e seguem processos rígidos de excelência.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 hover:border-primary/20 hover:bg-zinc-900 transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-heading text-white">Otimização de Tempo</h3>
              <p className="text-sm text-zinc-400 leading-relaxed font-light">
                Elimine até 20 horas semanais de planilhas e digitação manual de relatórios. O ecossistema consolida faturamento e comissões automaticamente.
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 hover:border-primary/20 hover:bg-zinc-900 transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-heading text-white">Privacidade Absoluta</h3>
              <p className="text-sm text-zinc-400 leading-relaxed font-light">
                Dados blindados sobre clientes, fornecedores e faturamento estratégico. Nenhuma informação é compartilhada com terceiros ou anunciantes.
              </p>
            </div>
          </div>
        </section>

        {/* COMPARATIVO ELEGANTE: TRADICIONAIS VS LUMIÈRE OS */}
        <section className="py-24 px-6 bg-gradient-to-b from-transparent via-zinc-950/60 to-transparent border-t border-white/5">
          <div className="max-w-5xl mx-auto space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs uppercase font-bold text-primary tracking-widest bg-primary/10 px-4 py-1.5 rounded-full">Análise Comparativa</span>
              <h2 className="text-4xl font-heading font-light tracking-tight text-white">O fim da desorganização amadora</h2>
              <p className="text-zinc-400 font-light leading-relaxed">
                Por que o LumièreOS é considerado o sistema definitivo para as principais marcas de prestígio no mercado nacional?
              </p>
            </div>

            {/* Comparativo de Layout Clássico */}
            <div className="grid md:grid-cols-2 gap-8" id="comparison-grid">
              {/* Sistemas tradicionais */}
              <div className="p-8 rounded-3xl bg-zinc-900/20 border border-white/5 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-heading font-medium text-zinc-300">Sistemas Tradicionais</h3>
                </div>
                
                <ul className="space-y-4">
                  {[
                    'Interfaces saturadas, lentas e poluídas com propagandas intrusivas.',
                    'Falta de recursos específicos para a realidade da equipe (comissões complexas na ponta do lápis).',
                    'Suporte técnico terceirizado com atendimento demorado e ineficaz.',
                    'Ausência de mecanismos estruturados de cultura interna e excelência diária.',
                    'Silos de dados desconectados gerando furos na contabilidade e na agenda.'
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs text-zinc-500 font-light">
                      <X className="w-4 h-4 text-red-500/60 shrink-0 mt-0.5" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Lumière OS */}
              <div className="p-8 rounded-3xl bg-zinc-900/60 border border-primary/20 space-y-6 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <h3 className="text-lg font-heading font-medium text-white">LumièreOS Ecossistema</h3>
                </div>
                
                <ul className="space-y-4">
                  {[
                    'Experiência imersiva premium: design impecável focado inteiramente na sua operação.',
                    'Automação real de rateio de comissões e acompanhamento de metas financeiras diárias.',
                    'Atendimento VIP de alta prioridade com consultores dedicados no WhatsApp.',
                    'Módulo exclusivo Lumière: checklists de abertura/fechamento e conformidade de equipe.',
                    'Inteligência centralizada que cruza dados de agenda, faturamento e insumos em tempo real.'
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs text-zinc-200 font-light">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CONSULTATIVE DIAGNOSTIC EXPLANATION (O ANTIGO TRIAL) */}
        <section className="py-24 px-6 relative border-t border-white/5 bg-zinc-950/20">
          <div className="max-w-5xl mx-auto space-y-16">
            <div className="text-center space-y-4">
              <span className="text-xs uppercase font-bold text-primary tracking-widest bg-primary/10 px-4 py-1.5 rounded-full">Método de Consultoria</span>
              <h2 className="text-4xl md:text-5xl font-heading font-light tracking-tight text-white font-sans">Diagnóstico Estratégico LumièreOS</h2>
              <p className="text-zinc-400 max-w-2xl mx-auto font-light leading-relaxed">
                Nossa tecnologia de onboarding funciona como uma consultoria estratégica virtual. Analisamos seu modelo para propor as configurações ideais sem fricção comercial.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-3xl bg-zinc-900/40 border border-white/5 space-y-4 hover:border-primary/20 transition-all duration-300">
                <div className="text-3xl font-heading text-primary font-light">01</div>
                <h3 className="text-lg font-heading text-white">Raio-X de Negócio</h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Informe as dimensões de sua operação, as metas de equipe e o segmento de atuação com absoluta privacidade de dados.
                </p>
              </div>
              <div className="p-8 rounded-3xl bg-zinc-900/40 border border-white/5 space-y-4 hover:border-primary/20 transition-all duration-300">
                <div className="text-3xl font-heading text-primary font-light">02</div>
                <h3 className="text-lg font-heading text-white">Relatório Corporativo</h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Nossa inteligência emite uma recomendação estruturada do plano perfeito calibrado exatamente para o seu porte comercial.
                </p>
              </div>
              <div className="p-8 rounded-3xl bg-zinc-900/40 border border-white/5 space-y-4 hover:border-primary/20 transition-all duration-300">
                <div className="text-3xl font-heading text-primary font-light">03</div>
                <h3 className="text-lg font-heading text-white">Garantia Cakto</h3>
                <p className="text-xs text-zinc-400 font-light leading-relaxed">
                  Inicie com garantia incondicional de faturamento de 7 dias operada pela Cakto: satisfação garantida ou devolução total.
                </p>
              </div>
            </div>

            <div className="text-center">
              <Button 
                onClick={() => navigate("/cadastro")} 
                className="rounded-full h-14 px-10 text-xs uppercase tracking-wider bg-primary hover:bg-gold-400 text-black font-bold shadow-[0_0_35px_rgba(212,175,55,0.25)] hover:shadow-[0_0_55px_rgba(212,175,55,0.45)] transition-all cursor-pointer"
              >
                Fazer meu Diagnóstico Estratégico
              </Button>
            </div>
          </div>
        </section>

        {/* Upcoming Updates (ROADMAP DA VISÃO) */}
        <section className="py-24 px-6 border-t border-white/5 bg-gradient-to-b from-black/0 to-zinc-950/60">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <span className="text-xs uppercase font-bold text-primary tracking-widest bg-primary/10 px-3 py-1.5 rounded-full">Roadmap da Visão</span>
              <h2 className="text-4xl font-heading font-light tracking-tight text-white">Próximas Atualizações</h2>
              <p className="text-zinc-400 max-w-2xl mx-auto font-light">Tecnologia, inovação contínua e exclusividade a caminho. Mantemos nosso ecossistema em constante evolução.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-zinc-900/40 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <CalendarDays className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Google Agenda Connect</h3>
                  <p className="text-zinc-500 text-[11px] font-light leading-relaxed">
                    Sincronização imediata bidirecional. Permita que profissionais acessem os horários direto nos calendários móveis nativos.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-primary font-bold">Agenda Connect</span>
                  <span className="text-[8px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 uppercase">Em Breve</span>
                </div>
              </div>

              <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-zinc-900/40 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Relatórios Customizados</h3>
                  <p className="text-zinc-500 text-[11px] font-light leading-relaxed">
                    Exportação integral para planilhas e PDFs com customização de logomarca, ideal para reuniões e auditorias financeiras.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-primary font-bold">Data Export</span>
                  <span className="text-[8px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 uppercase">Planejado</span>
                </div>
              </div>

              <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-zinc-900/40 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <Sparkles className="w-5 h-5 text-primary font-bold" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Lumière Assist VIP</h3>
                  <p className="text-zinc-500 text-[11px] font-light leading-relaxed">
                    Copiloto operacional que detecta falhas na conformidade de checklists Lumière e sugere readequações com agilidade.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-primary font-bold">Lumière Assist</span>
                  <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 uppercase">Nova Era</span>
                </div>
              </div>

              <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-zinc-900/40 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Insights Avançados</h3>
                  <p className="text-zinc-500 text-[11px] font-light leading-relaxed">
                    Análise refinada de equipes, taxas de retenção por profissional e mapas de saturação de serviços diários.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-primary font-bold">Analytics L'Or</span>
                  <span className="text-[8px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 uppercase">Planejado</span>
                </div>
              </div>

              <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-zinc-900/40 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <Inbox className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Auto-Relatório Semanal</h3>
                  <p className="text-zinc-500 text-[11px] font-light leading-relaxed">
                    Envio automático consolidado com gráficos de performance diretamente no e-mail cadastrado dos proprietários.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-primary font-bold">Auto Report</span>
                  <span className="text-[8px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 uppercase">Em Roadmap</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer Melhorado e Responsivo */}
      <footer className="border-t border-white/5 bg-zinc-950/80 pt-16 pb-10 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-6 h-6 text-primary" />
                <span className="text-xl font-heading tracking-wide text-white">Lumière</span>
              </div>
              <p className="text-zinc-400 font-light text-xs leading-relaxed max-w-sm">
                O ecossistema operacional de alta sofisticação para marcas líderes e estabelecimentos de prestígio no mercado de beleza nacional.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest font-bold text-white font-sans">Empresa</h4>
              <ul className="space-y-2 text-xs font-light text-zinc-400">
                <li><span className="hover:text-primary transition-colors cursor-pointer">Manifesto de Excelência</span></li>
                <li><span className="hover:text-primary transition-colors cursor-pointer">Módulo Lumière</span></li>
                <li><span className="hover:text-primary transition-colors cursor-pointer">Segurança de Dados</span></li>
                <li><span className="hover:text-primary transition-colors cursor-pointer">Contato Comercial</span></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest font-bold text-white font-sans">Termos & Privacidade</h4>
              <ul className="space-y-2 text-xs font-light text-zinc-400">
                <li><a className={publicLinkClass} href={termsUrl} target="_blank" rel="noreferrer">Termos de Uso</a></li>
                <li><a className={publicLinkClass} href={privacyUrl} target="_blank" rel="noreferrer">Política de Privacidade</a></li>
                <li><a className={publicLinkClass} href={licenseUrl} target="_blank" rel="noreferrer">Acordo de Licenciamento</a></li>
                <li><a className={publicLinkClass} href={caktoPolicyUrl} target="_blank" rel="noreferrer">Políticas do meio de pagamento</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest font-bold text-white font-sans">Contato & Suporte</h4>
              <ul className="space-y-2 text-xs font-light text-zinc-400">
                <li><a className={publicLinkClass} href={supportWhatsappUrl} target="_blank" rel="noreferrer">Atendimento comercial</a></li>
                <li><a className={publicLinkClass} href={`mailto:${APP_INFO.supportEmail}`}>Suporte técnico</a></li>
                {instagramUrl && <li><a className={publicLinkClass} href={instagramUrl} target="_blank" rel="noreferrer">Instagram</a></li>}
                {linkedinUrl && <li><a className={publicLinkClass} href={linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a></li>}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-xs text-zinc-500 font-light text-center md:text-left">
              © {new Date().getFullYear()} {APP_INFO.company}. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-xs text-zinc-500 font-light">
              <span className="hover:text-primary transition-colors cursor-pointer">Instagram</span>
              <span className="hover:text-primary transition-colors cursor-pointer">LinkedIn</span>
              <span className="hover:text-primary transition-colors cursor-pointer">Contato</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

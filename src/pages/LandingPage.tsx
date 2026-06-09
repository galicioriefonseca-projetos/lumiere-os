import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Scissors, CalendarCheck2, ArrowRight, ShieldCheck, CheckCircle2, RefreshCcw, FileText, TrendingUp, CalendarDays, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import PWAInstallButton from '../components/PWAInstallButton';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      navigate('/login?source=pwa', { replace: true });
    }
  }, [navigate]);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-white/5 backdrop-blur-md sticky top-0 md:relative z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <span className="text-2xl font-heading font-medium tracking-wide">Lumière</span>
          </div>
          <div className="flex space-x-4 items-center">
            <Button onClick={() => navigate("/login")} className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]">
              Entrar
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
          <div className="max-w-5xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
               <span className="px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium tracking-wide uppercase mb-6 inline-block">O Padrão Ouro em Gestão</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-5xl md:text-7xl font-light tracking-tight leading-[1.1] font-heading"
            >
              Exclusividade e precisão <br/>
              para <span className="italic text-primary font-medium">salões de elite.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed"
            >
              Lumière é o ecossistema definitivo para donos de salões, clínicas e barbearias que exigem controle absoluto, design impecável e experiência premium.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row justify-center gap-4 pt-4"
            >
              <Button size="lg" onClick={() => navigate("/cadastro")} className="rounded-full h-14 px-8 text-base bg-primary hover:bg-gold-400 text-black shadow-[0_0_40px_rgba(212,175,55,0.3)] hover:shadow-[0_0_60px_rgba(212,175,55,0.5)] transition-all">
                Solicitar Licença Experimental (7 dias)
              </Button>
              <Button size="lg" variant="outline" onClick={() => {
                const el = document.getElementById('modulos');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }} className="rounded-full h-14 px-8 text-base border-primary/20 hover:bg-primary/10 text-primary transition-all">
                Conheça os Módulos
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Instalar App Banner (PWA) on Landing */}
        <section className="py-12 px-6">
           <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-card to-card/50 border border-primary/20 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left relative overflow-hidden">
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                 <Sparkles className="w-64 h-64 text-primary" />
             </div>
             <div className="relative z-10 flex-1 space-y-4">
                 <h3 className="text-3xl font-heading text-foreground">Sempre com você</h3>
                 <p className="text-muted-foreground font-light text-lg">
                   O Lumière foi projetado para funcionar perfeitamente no seu celular. Instale nosso aplicativo diretamente do navegador (PWA) e acesse seu sistema com um toque, sem ocupar espaço no seu aparelho.
                 </p>
             </div>
             <div className="relative z-10 shrink-0">
                 <PWAInstallButton variant="button" />
             </div>
           </div>
        </section>

        {/* Modules */}
        <section id="modulos" className="py-24 px-6 bg-card/30 border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12">
               <div className="space-y-4">
                 <div className="w-12 h-12 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
                   <CalendarCheck2 className="w-6 h-6 text-primary" />
                 </div>
                 <h3 className="text-xl font-heading">Controle Absoluto</h3>
                 <p className="text-muted-foreground font-light leading-relaxed">Agendamentos inteligentes que otimizam o tempo da sua equipe e garantem a melhor experiência ao seu cliente.</p>
               </div>
               <div className="space-y-4">
                 <div className="w-12 h-12 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
                   <Scissors className="w-6 h-6 text-primary" />
                 </div>
                 <h3 className="text-xl font-heading">Gestão de Equipe</h3>
                 <p className="text-muted-foreground font-light leading-relaxed">Metas, checklists diários e profissionais alinhados ao padrão de qualidade da sua marca.</p>
               </div>
               <div className="space-y-4">
                 <div className="w-12 h-12 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
                   <ShieldCheck className="w-6 h-6 text-primary" />
                 </div>
                 <h3 className="text-xl font-heading">Dados Protegidos</h3>
                 <p className="text-muted-foreground font-light leading-relaxed">Arquitetura de dados isolada, garantindo total privacidade e segurança para o seu negócio.</p>
               </div>
            </div>
          </div>
        </section>

         {/* Consultative Trial Explanation */}
         <section className="py-24 px-6 relative bg-gradient-to-b from-transparent via-primary/[0.01] to-transparent border-t border-white/5">
           <div className="max-w-5xl mx-auto space-y-16">
             <div className="text-center space-y-4">
               <span className="text-xs uppercase font-semibold text-primary tracking-widest bg-primary/10 px-4 py-1.5 rounded-full">Licenciamento Inteligente</span>
               <h2 className="text-4xl md:text-5xl font-heading font-light tracking-tight text-white font-sans">Como obter seu teste de 7 dias?</h2>
               <p className="text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                 Nossa tecnologia analisa o tamanho e as ambições do seu estabelecimento para liberar os recursos ideais de forma personalizada, sem fricção ou burocracia.
               </p>
             </div>

             <div className="grid md:grid-cols-3 gap-8">
               <div className="p-8 rounded-3xl bg-card/25 border border-white/5 space-y-4 hover:border-primary/20 transition-all duration-300">
                 <div className="text-3xl font-heading text-primary font-light">01</div>
                 <h3 className="text-lg font-heading text-white">Diagnóstico Rápido</h3>
                 <p className="text-sm text-muted-foreground font-light leading-relaxed">
                   Informe o tamanho da sua equipe e os objetivos de excelência que seu salão de beleza ou clínica deseja alcançar.
                 </p>
               </div>
               <div className="p-8 rounded-3xl bg-card/25 border border-white/5 space-y-4 hover:border-primary/20 transition-all duration-300">
                 <div className="text-3xl font-heading text-primary font-light">02</div>
                 <h3 className="text-lg font-heading text-white">Liberação Customizada</h3>
                 <p className="text-sm text-muted-foreground font-light leading-relaxed">
                   Nossa inteligência calcula e pré-configura a plataforma sob medida para o perfil e as operações do seu negócio.
                 </p>
               </div>
               <div className="p-8 rounded-3xl bg-card/25 border border-white/5 space-y-4 hover:border-primary/20 transition-all duration-300">
                 <div className="text-3xl font-heading text-primary font-light">03</div>
                 <h3 className="text-lg font-heading text-white">Acesso Pleno</h3>
                 <p className="text-sm text-muted-foreground font-light leading-relaxed">
                   Utilize todas as ferramentas premium, assistente Lumière AI, comissões e checklists com suporte dedicado de boas-vindas.
                 </p>
               </div>
             </div>

             <div className="text-center">
               <button onClick={() => navigate("/cadastro")} className="rounded-full h-14 px-10 text-base bg-primary hover:bg-gold-400 text-black font-semibold shadow-[0_0_40px_rgba(212,175,55,0.3)] hover:shadow-[0_0_60px_rgba(212,175,55,0.5)] transition-all cursor-pointer">
                 Iniciar meu Diagnóstico de 7 Dias
               </button>
             </div>
           </div>
         </section>

        {/* Upcoming Updates */}
        <section className="py-24 px-6 border-t border-white/5 bg-gradient-to-b from-black/0 to-primary/[0.02]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <span className="text-xs uppercase font-semibold text-primary tracking-widest bg-primary/10 px-3 py-1 rounded-full">Roadmap da Visão</span>
              <h2 className="text-4xl font-heading font-light tracking-tight text-white">Próximas Atualizações</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto font-light">Mais prestígio e tecnologia premium a caminho. Nossa equipe trabalha continuamente para trazer o estado da arte na gestão do seu ecossistema comercial.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-card/30 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <CalendarDays className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Integração com Google Agenda</h3>
                  <p className="text-muted-foreground text-xs font-light leading-relaxed">
                    Sincronização futura dos agendamentos do salão. Conecte de forma transparente a agenda dos profissionais com os calendários móveis para um controle unificado, veloz e sem conflito de horários.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold">Agenda Connect</span>
                  <span className="text-[9px] font-mono bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/20 uppercase">Em Breve</span>
                </div>
              </div>

              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-card/30 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Relatórios Exportáveis</h3>
                  <p className="text-muted-foreground text-xs font-light leading-relaxed">
                    Exportação futura para planilhas e relatórios gerenciais. Obtenha arquivos prontos e consolidados sobre faturamento, taxas e checklists, otimizando auditorias e integrações contábeis.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold">Data Export</span>
                  <span className="text-[9px] font-mono bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/20 uppercase">Planejado</span>
                </div>
              </div>

              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-card/30 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <Sparkles className="w-5 h-5 text-primary font-bold" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Assistente Inteligente</h3>
                  <p className="text-muted-foreground text-xs font-light leading-relaxed">
                    Futuro assistente virtual LumiereOS. Uma tecnologia exclusiva de orientação sob medida dentro do sistema para auxiliar sua equipe no uso das ferramentas e solucionar fluxos do dia a dia.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold">Lumière Assist</span>
                  <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 uppercase">Nova Era</span>
                </div>
              </div>

              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-card/30 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Insights de Desempenho</h3>
                  <p className="text-muted-foreground text-xs font-light leading-relaxed">
                    Análise futura refinada de equipe, metas, checklist e produtividade de cada profissional, consolidando indicadores de desempenho para embasar suas decisões estratégicas.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold">Analitycs L'Or</span>
                  <span className="text-[9px] font-mono bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/20 uppercase">Planejado</span>
                </div>
              </div>

              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-[#D4AF37]/30 hover:bg-card/30 transition-all duration-300 flex flex-col justify-between h-full">
                <div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                    <Inbox className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-white text-base mb-2">Relatórios Automáticos</h3>
                  <p className="text-muted-foreground text-xs font-light leading-relaxed">
                    Envio futuro de resumos semanais/mensais diretamente nos canais de comunicação corporativa do salão. Acompanhe taxas de retenção e faturamento sem precisar minerar relatórios.
                  </p>
                </div>
                <div className="mt-5 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#D4AF37] font-semibold">Auto Report</span>
                  <span className="text-[9px] font-mono bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/20 uppercase">Em Roadmap</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-heading tracking-wide">Lumière</span>
          </div>
          <p className="text-sm text-muted-foreground font-light">
            © {new Date().getFullYear()} Lumière. O Padrão Ouro em Gestão.
          </p>
        </div>
      </footer>
    </div>
  );
}

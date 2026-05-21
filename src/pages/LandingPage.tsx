import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Scissors, CalendarCheck2, ArrowRight, ShieldCheck, CheckCircle2, RefreshCcw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const navigate = useNavigate();
  const plans = [
    {
      name: "Start",
      price: "197",
      description: "Para profissionais independentes e pequenos espaços.",
      features: ["Até 3 profissionais", "Gestão de clientes e serviços", "Agendamentos básicos", "Checklist diário", "Metas mensais", "App Instalável (PWA)"],
      planValue: "start"
    },
    {
      name: "Studio",
      price: "397",
      description: "O padrão ouro para salões e clínicas em crescimento.",
      features: ["Até 10 profissionais", "Tudo do plano Start", "Gestão de Categorias", "Histórico de checklists", "Metas por equipe", "Agendamentos completos"],
      planValue: "studio",
      popular: true
    },
    {
      name: "Performance",
      price: "697",
      description: "Operações robustas com foco em comissionamento e dados.",
      features: ["Até 20 profissionais", "Tudo do plano Studio", "Gestão de Comissões", "Avaliações", "Gamificação", "Insights IA e Relatórios avançados"],
      planValue: "performance"
    },
    {
      name: "Network",
      price: "1497",
      description: "Redes, franquias e multiunidades.",
      features: ["Profissionais Ilimitados", "Tudo do plano Performance", "Gestão Multiunidade", "Painel Master de Rede", "Relatórios Executivos", "Suporte prioritário"],
      planValue: "network"
    }
  ];

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
              <Button size="lg" onClick={() => {
                const el = document.getElementById('planos');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }} className="rounded-full h-14 px-8 text-base bg-primary hover:bg-gold-400 text-black shadow-[0_0_40px_rgba(212,175,55,0.3)] hover:shadow-[0_0_60px_rgba(212,175,55,0.5)] transition-all">
                Ver Planos Disponíveis
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
             <div className="relative z-10">
                 <div className="inline-flex items-center justify-center p-1 rounded-full bg-primary/10 border border-primary/30">
                    <span className="px-6 py-3 text-primary font-medium">Disponível via Navegador</span>
                 </div>
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

        {/* Pricing */}
        <section id="planos" className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20 space-y-4">
              <h2 className="text-4xl md:text-5xl font-heading font-light tracking-tight">O Plano Ideal</h2>
              <p className="text-muted-foreground">Projetado para crescer junto com o seu prestígio.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {plans.map((plan) => (
                <div 
                  key={plan.name} 
                  className={`relative rounded-2xl p-8 border hover:bg-card/40 transition-colors backdrop-blur-sm flex flex-col ${plan.popular ? 'bg-card/50 border-primary shadow-[0_0_30px_rgba(212,175,55,0.15)] scale-105 z-10' : 'bg-card/20 border-white/10'}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 inset-x-0 flex justify-center">
                      <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Mais Escolhido</span>
                    </div>
                  )}
                  <div className="mb-8">
                    <h3 className="text-xl font-heading mb-2">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground h-10">{plan.description}</p>
                  </div>
                  <div className="mb-8">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-light font-heading tracking-tight">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-start text-sm font-light">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mr-3 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button onClick={() => navigate(`/cadastro?plan=${plan.planValue}`)} className={`w-full rounded-full h-12 ${plan.popular ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
                    Assinar {plan.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Upcoming Updates */}
        <section className="py-24 px-6 border-t border-white/5 bg-gradient-to-b from-black/0 to-primary/[0.02]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <span className="text-xs uppercase font-semibold text-primary tracking-widest bg-primary/10 px-3 py-1 rounded-full">Roadmap da Visão</span>
              <h2 className="text-4xl font-heading font-light tracking-tight text-white">Próximas Atualizações</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto font-light">Mais prestígio e tecnologia premium a caminho. Nossa equipe trabalha continuamente para trazer o estado da arte em gestão.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all duration-300">
                <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-white text-lg mb-2">IA L'Or Predict</h3>
                <p className="text-muted-foreground text-sm font-light leading-relaxed">Algoritmo inteligente de previsão de tendências de ocupação, metas automáticas de barbearias e otimização inteligente de comissões.</p>
                <div className="absolute right-4 bottom-4 text-[10px] uppercase font-mono tracking-widest text-primary/60 font-semibold bg-primary/5 px-2 py-0.5 rounded border border-primary/10">Jul 2026</div>
              </div>

              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all duration-300">
                <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                  <RefreshCcw className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-white text-lg mb-2">Checkout & Split</h3>
                <p className="text-muted-foreground text-sm font-light leading-relaxed">Gateway de pagamento com split automático direto para a conta dos profissionais envolvidos, links de pagamento e adiantamento.</p>
                <div className="absolute right-4 bottom-4 text-[10px] uppercase font-mono tracking-widest text-primary/60 font-semibold bg-primary/5 px-2 py-0.5 rounded border border-primary/10">Set 2026</div>
              </div>

              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all duration-300">
                <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-white text-lg mb-2">Aplicativos Nativos</h3>
                <p className="text-muted-foreground text-sm font-light leading-relaxed">Publicação direta de aplicativos exclusivos customizados para Android e iOS para que os clientes agendem com máxima conveniência.</p>
                <div className="absolute right-4 bottom-4 text-[10px] uppercase font-mono tracking-widest text-primary/60 font-semibold bg-primary/5 px-2 py-0.5 rounded border border-primary/10">Out 2026</div>
              </div>

              <div className="bg-card/20 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all duration-300">
                <div className="bg-primary/5 border border-primary/20 rounded-xl w-10 h-10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-white text-lg mb-2">Fidelidade Ouro</h3>
                <p className="text-muted-foreground text-sm font-light leading-relaxed">Sistema completo de recorrência de clientes com ofertas direcionadas via WhatsApp, campanhas inteligentes de indicação e mimos VIP.</p>
                <div className="absolute right-4 bottom-4 text-[10px] uppercase font-mono tracking-widest text-primary/60 font-semibold bg-primary/5 px-2 py-0.5 rounded border border-primary/10">Dez 2026</div>
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

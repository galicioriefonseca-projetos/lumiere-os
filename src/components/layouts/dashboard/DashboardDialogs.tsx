import { 
  Crown, 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Scissors, 
  CheckSquare, 
  Target, 
  FileText, 
  Settings, 
  Sparkles, 
  TrendingUp, 
  Inbox, 
  AlertTriangle, 
  Loader2 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SystemUpdatesDialog from '../../SystemUpdatesDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface DashboardDialogsProps {
  isGuideOpen: boolean;
  setIsGuideOpen: (open: boolean) => void;
  isFounderDetailOpen: boolean;
  setIsFounderDetailOpen: (open: boolean) => void;
  isRoadmapOpen: boolean;
  setIsRoadmapOpen: (open: boolean) => void;
  isUpdatesDialogOpen: boolean;
  setIsUpdatesDialogOpen: (open: boolean) => void;
  setHasNewVersionNotice: (notice: boolean) => void;
  isDeletionRequestedOpen: boolean;
  setIsDeletionRequestedOpen: (open: boolean) => void;
  isDeletingAccount: boolean;
  setIsDeletingAccount: (loading: boolean) => void;
  isPlatformAdmin: boolean;
  salonData: any;
  userData: any;
}

export function DashboardDialogs({
  isGuideOpen,
  setIsGuideOpen,
  isFounderDetailOpen,
  setIsFounderDetailOpen,
  isRoadmapOpen,
  setIsRoadmapOpen,
  isUpdatesDialogOpen,
  setIsUpdatesDialogOpen,
  setHasNewVersionNotice,
  isDeletionRequestedOpen,
  setIsDeletionRequestedOpen,
  isDeletingAccount,
  setIsDeletingAccount,
  isPlatformAdmin,
  salonData,
  userData
}: DashboardDialogsProps) {
  const { currentUser } = useAuth();

  const handleRequestDeletion = async () => {
    if (!currentUser) {
      toast.error("Você precisa estar autenticado.");
      return;
    }
    setIsDeletingAccount(true);
    try {
      const now = Date.now();
      const uid = currentUser.uid;

      // Update Root `/users/{uid}`
      await updateDoc(doc(db, 'users', uid), {
        accountDeletionRequested: true,
        accountDeletionRequestedAt: now,
        status: 'deletion_requested'
      });

      // Update Subcollection `salons/{salonId}/professionals/{uid}` (if salonId exists)
      if (userData?.salonId) {
        try {
          await updateDoc(doc(db, `salons/${userData.salonId}/professionals`, uid), {
            accountDeletionRequested: true,
            status: 'deletion_requested',
            updatedAt: now
          });
        } catch (subErr) {
          console.log("Professional subcollection update omitted (could be non-professional owner).", subErr);
        }
      }

      toast.success("Solicitação de exclusão enviada com sucesso! Um administrador revisará o pedido.");
      setIsDeletionRequestedOpen(false);
    } catch (err: any) {
      console.error("Erro ao solicitar exclusão:", err);
      toast.error("Erro ao registrar solicitação: " + (err.message || ''));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      {/* Guia do Sistema Modal */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-4xl bg-[#09090b]/98 border border-white/10 text-white rounded-3xl shadow-2xl backdrop-blur-xl max-h-[85vh] overflow-y-auto w-[94vw] sm:w-[90vw]">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="text-xl md:text-2xl font-heading font-light tracking-tight text-white flex items-center gap-2">
              <Crown className="w-5 md:w-6 h-5 md:h-6 text-[#D4AF37] animate-pulse" /> Guia do Sistema LumiereOS
            </DialogTitle>
            <p className="text-[#a1a1aa] text-xs font-light mt-1">
              Descubra como aproveitar ao máximo cada módulo do seu sistema operacional de salão de beleza premium.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 font-sans max-h-[50vh] overflow-y-auto pr-2">
            {/* Dashboard */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <LayoutDashboard className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Dashboard</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Visão geral do salão, metas, agenda, checklist do dia e indicadores principais. Monitore as métricas vitais da sua operação em tempo real.
                </p>
              </div>
            </div>

            {/* Agenda */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <CalendarDays className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Agenda</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Controle dos atendimentos, horários, clientes, serviços e profissionais. Permite agendar rapidamente e visualizar os compromissos diários ou semanais.
                </p>
              </div>
            </div>

            {/* Clientes */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <Users className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Clientes</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro e histórico básico dos clientes. Acompanhe quem são seus clientes mais fiéis, suas preferências e histórico completo de visitas.
                </p>
              </div>
            </div>

            {/* Profissionais */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <Users className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Profissionais</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro da equipe, funções, status e informações operacionais. Gerencie o time e acompanhe a disponibilidade de cada parceiro do salão.
                </p>
              </div>
            </div>

            {/* Serviços */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <Scissors className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Serviços e Categorias</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Cadastro dos serviços, preços, duração e categorias. Organize seu catálogo de atendimentos com precisão para facilitar os agendamentos.
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <CheckSquare className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Checklist</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Rotinas operacionais e Avaliação Diária da Equipe (Módulo Lumière). Garanta a conformidade da abertura/fechamento e avalie diariamente sua equipe.
                </p>
              </div>
            </div>

            {/* Metas */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <Target className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Metas</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Acompanhamento da meta mensal e progresso financeiro. Defina objetivos claros de faturamento e veja o progresso de vendas do estabelecimento.
                </p>
              </div>
            </div>

            {/* Relatórios */}
            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/20 transition-all duration-200">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
                <FileText className="w-4.5 h-4.5 text-[#D4AF37]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Relatórios</h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Consulta de histórico de avaliações, notas consolidadas da equipe e exportação de rotinas diárias e avaliações Lumière em formato PDF de alta qualidade.
                </p>
              </div>
            </div>

            {/* Painel Master */}
            {isPlatformAdmin && (
              <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 p-4 rounded-2xl flex gap-3 hover:border-[#D4AF37]/35 transition-all md:col-span-2">
                <div className="p-2 h-max rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/30 shrink-0">
                  <Settings className="w-4.5 h-4.5 text-[#D4AF37]" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Painel Master</h4>
                    <span className="text-[8px] bg-[#D4AF37] text-black font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-widest">Apenas Admin</span>
                  </div>
                  <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                    Área administrativa exclusiva de nível de plataforma. Permite gerenciar salões afiliados, planos, visualizações financeiras e o suporte geral do ecossistema LumiereOS.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
            <Button onClick={() => setIsGuideOpen(false)} className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold rounded-xl text-xs px-5 h-9">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detalhes do Plano Founder Dialog */}
      <Dialog open={isFounderDetailOpen} onOpenChange={setIsFounderDetailOpen}>
        <DialogContent className="max-w-md bg-[#09090b]/98 border border-amber-500/30 text-white rounded-3xl shadow-2xl backdrop-blur-xl w-[94vw] sm:w-full">
          <DialogHeader className="border-b border-white/5 pb-4 text-left">
            <DialogTitle className="text-lg md:text-xl font-heading font-medium text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#D4AF37] filter drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]" /> Plano Founder • Detalhes
            </DialogTitle>
            <p className="text-[#a1a1aa] text-xs font-light mt-1">
              Informações contratuais e níveis de privilégio da sua conta de co-criador piloto.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-4 font-sans text-left">
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Membro Founder Piloto
                </span>
                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono tracking-wider border",
                  salonData?.subscriptionStatus === 'active' 
                    ? "bg-green-500/25 border-green-500/45 text-green-400" 
                    : (salonData?.subscriptionStatus === 'preview' ? "bg-amber-500/25 border-amber-500/45 text-amber-400" : "bg-red-500/25 border-red-500/45 text-red-400")
                )}>
                  CONTRATO: {salonData?.subscriptionStatus === 'preview' ? 'Garantia de 7 dias pela Cakto' : (salonData?.subscriptionStatus === 'active' ? 'ativo' : 'pendente')}
                </span>
              </div>
              <h4 className="font-semibold text-white text-sm leading-snug">
                Plano Founder Ativo ({salonData?.name || 'Seu Salão'})
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                Como contratante do plano Founder piloto, seu estabelecimento possui acesso completo, ilimitado e prioritário a todas as funcionalidades presentes e futuras do LumiereOS.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2.5">
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Plano Especial:</span>
                <strong className="text-white">Piloto (Co-criador)</strong>
              </div>
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Atualizações do Sistema:</span>
                <strong className="text-[#D4AF37]">Inclusas / Vitalícias</strong>
              </div>
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Acesso a relatórios:</span>
                <strong className="text-green-400">Liberado</strong>
              </div>
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Checklist Lumière:</span>
                <strong className="text-[#D4AF37]">Ilimitado</strong>
              </div>
              <div className="text-xs text-zinc-400 flex justify-between gap-10 font-sans">
                <span>Metas & Equipes:</span>
                <strong className="text-white">Liberadas</strong>
              </div>
            </div>

            <div className="text-[11px] text-amber-400 font-mono flex items-center justify-center gap-1.5 leading-none bg-amber-500/5 py-2.5 rounded-xl border border-amber-500/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Atualizações futuras totalmente inclusas
            </div>
          </div>

          <div className="flex justify-end pt-2 mt-2">
            <Button onClick={() => setIsFounderDetailOpen(false)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-xs px-5 h-9">
              Fechar Detalhes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Próximas Atualizações / Roadmap Dialog */}
      <Dialog open={isRoadmapOpen} onOpenChange={setIsRoadmapOpen}>
        <DialogContent className="max-w-xl bg-[#09090b]/98 border border-white/10 text-white rounded-3xl shadow-2xl backdrop-blur-xl w-[94vw] sm:w-full overflow-hidden max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-white/5 pb-4 text-left">
            <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-widest bg-[#D4AF37]/10 px-2.5 py-1 rounded-full w-max flex items-center gap-1.5 font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Evolução & Visão Futura
            </span>
            <DialogTitle className="text-lg md:text-xl font-heading font-medium text-white flex items-center gap-2">
              LumièreOS • Próximas Atualizações
            </DialogTitle>
            <p className="text-[#a1a1aa] text-xs font-light mt-1">
              Descubra os novos módulos e recursos comerciais planejados para elevar o prestígio e eficiência do seu salão de beleza premium.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-4 font-sans text-left">
            {/* Item 1 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0 text-[#D4AF37]">
                <CalendarDays className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">1. Integração com Google Agenda</h4>
                  <span className="text-[9px] bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[#D4AF37] px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">Fase 1</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Sincronização futura dos agendamentos do salão. Conecte de forma transparente as agendas dos seus profissionais com os calendários móveis pessoais, eliminando conflitos de horários de forma totalmente automática.
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0 text-[#D4AF37]">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">2. Relatórios Exportáveis</h4>
                  <span className="text-[9px] bg-zinc-500/15 border border-zinc-500/25 text-zinc-400 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">Fase 2</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Exportação futura para planilhas e relatórios gerenciais estruturados. Tenha em mãos dados estruturados para otimizar auditorias contábeis, cálculo de comissões e consolidação financeira do salão em instantes.
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0 text-[#D4AF37]">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">3. Assistente Inteligente LumiereOS</h4>
                  <span className="text-[9px] bg-amber-500/15 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">Fase Assessor</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Futuro assistente nativo para orientar o uso do sistema e gerar insights valiosos do negócio. Otimize o treinamento de novos funcionários e domine todo o potencial do ecossistema LumiereOS sem fricção.
                </p>
              </div>
            </div>

            {/* Item 4 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0 text-[#D4AF37]">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">4. Insights de Desempenho</h4>
                  <span className="text-[9px] bg-zinc-500/15 border border-zinc-500/25 text-zinc-400 px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold">Planejado</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Análise futura profunda de equipe, metas, checklists de qualidade e produtividade integrada. Monitore taxas de ociosidade e desempenho técnico de forma de inteligência, gerando planos de ação certeiros.
                </p>
              </div>
            </div>

            {/* Item 5 */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-3.5 hover:border-[#D4AF37]/20 transition-all">
              <div className="p-2 h-max rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0 text-[#D4AF37]">
                <Inbox className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white">5. Relatórios Automáticos</h4>
                  <span className="text-[9px] bg-[#D4AF37]/15 border border-[#D4AF37]/25 text-[#D4AF37] px-2 py-0.5 rounded-full uppercase font-mono tracking-wider font-semibold font-sans">Em Roadmap</span>
                </div>
                <p className="text-xs text-zinc-300 font-light leading-relaxed font-sans">
                  Envio futuro de resumos semanais/mensais de métricas de faturamento e taxas de retenção. Mantenha os sócios ou gestores integrados ao progresso do negócio diretamente por canais de comunicação corporativa.
                </p>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 font-light text-center leading-relaxed font-sans pt-1">
              * Nota: Os recursos listados acima representam a nossa visão de evolução contínua da experiência LumiereOS e serão disponibilizados em atualizações futuras sem alteração na mensalidade dos membros pioneiros.
            </p>
          </div>

          <div className="flex justify-end pt-2 mt-4 border-t border-white/5">
            <Button onClick={() => setIsRoadmapOpen(false)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl text-xs px-5 h-9">
              Excelente, Entendido!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SystemUpdatesDialog 
        isOpen={isUpdatesDialogOpen} 
        onClose={() => setIsUpdatesDialogOpen(false)}
        onMarkAsSeen={() => setHasNewVersionNotice(false)}
      />

      {/* Account Deletion Request Dialog */}
      <Dialog open={isDeletionRequestedOpen} onOpenChange={setIsDeletionRequestedOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border text-foreground rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="font-heading font-normal flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Solicitar Exclusão de Conta
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Entenda como funciona o desligamento e a retenção histórica no LumiereOS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-3 text-xs leading-relaxed text-zinc-300">
            <p className="font-light">
              Ao confirmar, sua solicitação de exclusão de conta será encaminhada para análise e revisão dos proprietários do salão ou administradores da plataforma.
            </p>
            <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl text-red-200 text-[11px] font-medium leading-relaxed">
              <strong>Importante:</strong> Seus dados operacionais (como histórico de agendamentos realizados, comissões faturadas, respostas a checklists de qualidade Lumière e feedback dos clientes) <strong>não serão excluídos de forma definitiva automaticamente</strong> para manter a consistência contábil, integridade operacional e relatórios gerenciais do salão.
            </div>
            <p className="text-[11px] text-zinc-400 font-light">
              Sua conta receberá o status <strong>"Exclusão Solicitada"</strong> e seu login poderá ser bloqueado ou suspenso durante a análise. Deseja prosseguir?
            </p>
          </div>

          <DialogFooter className="flex sm:flex-row justify-end gap-2 pt-4 border-t border-white/5 mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeletionRequestedOpen(false)}
              className="rounded-xl border-white/10 text-white hover:bg-white/5 h-10 px-4 text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isDeletingAccount}
              onClick={handleRequestDeletion}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl h-10 px-4 text-xs flex items-center justify-center gap-1.5"
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Solicitação'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

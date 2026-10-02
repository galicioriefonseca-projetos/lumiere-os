import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LumiMascotAvatar } from './LumiMascotAvatar';
import { 
  Sparkles, 
  Target, 
  TrendingUp, 
  Users, 
  CalendarCheck, 
  Scissors, 
  ArrowRight,
  Send,
  MessageSquare,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { formatBRL } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface LumiConsultingModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonName?: string;
  userName?: string;
  metrics?: {
    todayRevenue: number;
    monthRevenue: number;
    dailyGoal: number;
    monthlyGoal: number;
    scheduledCount: number;
    pendingCount: number;
    professionalsCount?: number;
  };
}

interface QuestionPreset {
  id: string;
  icon: any;
  label: string;
  category: string;
  generateAnswer: (metrics: any, salonName: string) => string;
  actionButton?: { label: string; url: string };
}

export function LumiConsultingModal({
  isOpen,
  onClose,
  salonName = 'Seu Estabelecimento',
  userName = 'Gestor',
  metrics = {
    todayRevenue: 0,
    monthRevenue: 0,
    dailyGoal: 1000,
    monthlyGoal: 25000,
    scheduledCount: 0,
    pendingCount: 0,
    professionalsCount: 3,
  },
}: LumiConsultingModalProps) {
  const navigate = useNavigate();

  const presets: QuestionPreset[] = [
    {
      id: 'hit_goal',
      icon: Target,
      label: 'Como bater a meta de faturamento hoje?',
      category: 'Metas & Vendas',
      generateAnswer: (m) => {
        const remaining = Math.max(0, m.dailyGoal - m.todayRevenue);
        const ticketMedio = 120;
        const neededClients = Math.ceil(remaining / ticketMedio);

        if (remaining === 0) {
          return `Parabéns, ${userName}! A sua meta diária de ${formatBRL(m.dailyGoal)} já foi batida com sucesso hoje (${formatBRL(m.todayRevenue)} faturados). O foco agora é buscar faturamento adicional com a venda de produtos de manutenção home care e combos express.`;
        }

        return `Para atingir a cota de hoje, ainda faltam **${formatBRL(remaining)}**. 
Aqui está a estratégia recomendada pela Lumi:
1. **Upsell nos Atendimentos do Dia:** Ofereça tratamentos rápidos (como nutrição express ou hidratação pós-química) para os ${m.scheduledCount || 'clientes'} agendados de hoje. Um acréscimo médio de R$ 40 por cliente cobre grande parte da meta.
2. **Reativação no CRM:** Envie uma mensagem rápida no WhatsApp para 5 clientes fiéis que não visitam o salão há mais de 30 dias com um convite exclusivo.
3. **Venda de Produtos Home Care:** Incentive os profissionais a indicarem o produto ideal para o cuidado em casa no momento do fechamento da comanda.`;
      },
      actionButton: { label: 'Ver Metas da Equipe', url: '/dashboard/metas' },
    },
    {
      id: 'reduce_noshow',
      icon: CalendarCheck,
      label: 'Como evitar faltas e clientes atrasados?',
      category: 'Agenda & Organização',
      generateAnswer: (m) => {
        return `Reduzir faltas (*no-show*) é essencial para a rentabilidade da bancada:
1. **Confirmação Ativa via WhatsApp:** Se você tem ${m.pendingCount || 0} agendamentos pendentes hoje, confirme a presença pelo menos 2 a 3 horas antes do horário.
2. **Alerta de Cortesia:** Avise com antecedência caso o cliente precise de orientações sobre estacionamento ou tempo de duração do procedimento.
3. **Lista de Espera Inteligente:** Mantenha contato com 2 a 3 clientes que queriam horário no dia para cobrir eventuais cancelamentos de última hora sem deixar o profissional ocioso.`;
      },
      actionButton: { label: 'Gerenciar Agenda', url: '/dashboard/agendamentos' },
    },
    {
      id: 'high_ticket_services',
      icon: Scissors,
      label: 'Quais serviços mais lucrativos devo impulsionar?',
      category: 'Precificação & Lucro',
      generateAnswer: () => {
        return `Os procedimentos com maior margem líquida e retenção para o ${salonName} são:
1. **Combos de Transformação + Tratamento:** Nunca venda mechas ou coloração isolada. Sempre agregue cronograma de reconstrução e corte bordado.
2. **Serviços de Assinatura / Pacotes:** Crie pacotes mensais de escova, manicure ou barba para garantir receita recorrente e fluxo semanal estável.
3. **Revenda de Cosméticos:** Produtos de acabamento (óleos, finalizadores, máscaras) têm margem de lucro de 40% a 60% e demandam zero tempo de cadeira dos seus profissionais.`;
      },
      actionButton: { label: 'Ajustar Preços e Serviços', url: '/dashboard/servicos' },
    },
    {
      id: 'team_motivation',
      icon: Users,
      label: 'Como engajar e motivar a equipe?',
      category: 'Liderança & Comissões',
      generateAnswer: () => {
        return `Para manter a equipe de especialistas motivada e alinhada aos objetivos do salão:
1. **Metas Claras e Visíveis:** Garanta que cada profissional saiba exatamente a sua meta individual do mês no painel de Metas do LumièreOS.
2. **Reconhecimento Diário:** Destaque quem atingiu o melhor ticket médio ou maior número de checklists concluídos na reunião matinal de 5 minutos.
3. **Comissões Transparentes:** Extratos de comissão claros e transparentes geram confiança total entre os profissionais e a gestão.`;
      },
      actionButton: { label: 'Acompanhar Equipe & Comissões', url: '/dashboard/comissoes' },
    },
  ];

  const [selectedPreset, setSelectedPreset] = useState<QuestionPreset>(presets[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [activeAnswer, setActiveAnswer] = useState<string>(presets[0].generateAnswer(metrics, salonName));
  const [currentActionButton, setCurrentActionButton] = useState(presets[0].actionButton);

  const handleSelectPreset = (preset: QuestionPreset) => {
    setSelectedPreset(preset);
    setActiveAnswer(preset.generateAnswer(metrics, salonName));
    setCurrentActionButton(preset.actionButton);
  };

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;

    const lower = customQuestion.toLowerCase();
    let answer = `Entendi a sua dúvida sobre "${customQuestion}". Como sua parceira Lumi, recomendo focar na organização das rotinas diárias e no acompanhamento minucioso dos agendamentos e ticket médio. O segredo para elevar o faturamento é aliar excelente experiência ao cliente com checklists impecáveis de atendimento.`;
    let btn = { label: 'Explorar Recursos do Dashboard', url: '/dashboard' };

    if (lower.includes('meta') || lower.includes('vender') || lower.includes('faturar')) {
      answer = presets[0].generateAnswer(metrics, salonName);
      btn = presets[0].actionButton!;
    } else if (lower.includes('falta') || lower.includes('agenda') || lower.includes('horario')) {
      answer = presets[1].generateAnswer(metrics, salonName);
      btn = presets[1].actionButton!;
    } else if (lower.includes('preco') || lower.includes('servico') || lower.includes('lucro')) {
      answer = presets[2].generateAnswer(metrics, salonName);
      btn = presets[2].actionButton!;
    } else if (lower.includes('comissao') || lower.includes('equipe') || lower.includes('profissional')) {
      answer = presets[3].generateAnswer(metrics, salonName);
      btn = presets[3].actionButton!;
    }

    setActiveAnswer(answer);
    setCurrentActionButton(btn);
    setCustomQuestion('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-[#121118] via-[#0b0a0e] to-[#060508] border border-[#D4AF37]/30 text-white rounded-3xl p-0 shadow-2xl overflow-hidden backdrop-blur-2xl">
        {/* Banner Visual 3D da Mascote Lumi no Atelier */}
        <div className="relative h-28 w-full overflow-hidden border-b border-[#D4AF37]/20">
          <img
            src="/images/lumi-showcase.jpg"
            alt="Lumi no Atelier"
            className="w-full h-full object-cover object-center opacity-40 blur-[1px] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121118] via-[#121118]/80 to-transparent" />
          
          <div className="absolute bottom-3 left-6 right-6 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <LumiMascotAvatar size="lg" mood="strategic" />
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-heading font-bold text-white tracking-tight flex items-center gap-1.5">
                    Consultoria com a Lumi
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  </DialogTitle>
                  <span className="text-[10px] bg-[#D4AF37]/20 border border-[#D4AF37]/35 text-[#D4AF37] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                    Gestora Virtual
                  </span>
                </div>
                <DialogDescription className="text-xs text-zinc-300 font-light">
                  Sua gestora de negócios virtual para organizar o salão, motivar a equipe e faturar mais.
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
              Tópicos de Orientação Rápida
            </span>
            <span className="text-[10px] text-[#D4AF37]">100% Autônomo & Instantâneo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map((preset) => {
              const Icon = preset.icon;
              const isSelected = selectedPreset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl text-left text-xs transition-all border ${
                    isSelected
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37]/60 text-white shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                      : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isSelected
                        ? 'bg-[#D4AF37] text-black shadow-md'
                        : 'bg-black/40 text-[#D4AF37] border border-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-[11px] leading-tight line-clamp-2">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Card de Resposta da Lumi */}
          <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-[#1c1924]/90 to-[#0e0c14]/90 border border-[#D4AF37]/25 space-y-3 relative overflow-hidden shadow-inner">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <LumiMascotAvatar size="sm" mood="happy" animated={false} />
                <span className="text-xs font-bold text-[#D4AF37] tracking-wide">
                  Orientação Estratégica da Lumi
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                {salonName}
              </span>
            </div>

            <div className="text-xs text-zinc-200 leading-relaxed font-light whitespace-pre-line space-y-2">
              {activeAnswer}
            </div>

            {currentActionButton && (
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => {
                    onClose();
                    navigate(currentActionButton.url);
                  }}
                  className="bg-[#D4AF37] hover:bg-amber-500 text-black font-semibold text-xs h-8 px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {currentActionButton.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Campo de Consulta Personalizada */}
          <form onSubmit={handleCustomQuestionSubmit} className="relative">
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="Faça uma pergunta sobre faturamento, clientes ou equipe para a Lumi..."
              className="w-full bg-white/5 border border-white/10 focus:border-[#D4AF37]/60 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50 transition-all pr-10"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl bg-[#D4AF37] hover:bg-amber-500 text-black transition-all shadow"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LumiConsultingModal;

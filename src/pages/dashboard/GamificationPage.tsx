import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Trophy, Star, Target, Flame, Award, ShieldAlert, Sparkles, Plus, Check,
  TrendingUp, Users, ShoppingBag, Zap, Crown, ArrowRight, CheckCircle2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBRL } from '@/lib/utils';

interface GamificationCampaign {
  id: string;
  title: string;
  description: string;
  xpValue: number;
  type: 'service_focus' | 'product_vendas' | 'faturamento_elite' | 'checklist_perito';
  targetValue: number;
  currentValue?: number;
  status: 'active' | 'completed' | 'expired';
  createdAt: number;
}

export default function GamificationPage() {
  const { salonData, userData } = useAuth();
  const userRole = userData?.role || 'professional';
  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager' || userRole === 'platform_admin';

  const [campaigns, setCampaigns] = useState<GamificationCampaign[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<any[]>([]);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'quests' | 'rewards'>('leaderboard');

  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    xpValue: '300',
    type: 'service_focus' as GamificationCampaign['type'],
    targetValue: '5'
  });

  // Carregar dados estruturados
  useEffect(() => {
    if (!salonData) return;

    const unsubs: (() => void)[] = [];

    // Campanhas de Gamificação
    const qCam = query(collection(db, `salons/${salonData.id}/gamification_campaigns`));
    unsubs.push(onSnapshot(qCam, (snapshot) => {
      const arr: GamificationCampaign[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() } as GamificationCampaign));
      setCampaigns(arr.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error("Erro ao carregar campanhas:", error);
    }));

    // Agendamentos/Lançamentos (Todos para calcular desempenho dinamicativo)
    const qAp = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(onSnapshot(qAp, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setAppointments(arr);
    }));

    // Colaboradores
    const qPro = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(onSnapshot(qPro, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.isActive !== false) {
          arr.push({ id: doc.id, ...data });
        }
      });
      setProfessionals(arr);
    }));

    // ChecklistRuns para computar notas altas
    const qCk = query(collection(db, `salons/${salonData.id}/checklistRuns`));
    unsubs.push(onSnapshot(qCk, (snapshot) => {
      const arr: any[] = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setChecklistRuns(arr);
    }));

    return () => unsubs.forEach(fn => fn());
  }, [salonData]);

  // Cálculos dinâmicos de XP, Nível, Faturamento e Badge para cada profissional
  const professionalsPerformance = useMemo(() => {
    return professionals.map(prof => {
      // Filtrar agendamentos concluídos deste profissional
      const completedSrvs = appointments.filter(ap => 
        ap.professionalId === prof.id && 
        ap.status === 'completed'
      );

      // Faturamento total
      const totalRevenue = completedSrvs.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

      // Quantidade de serviços e produtos vendidos
      const totalServices = completedSrvs.filter(ap => ap.type !== 'product').length;
      const totalProducts = completedSrvs.filter(ap => ap.type === 'product').length;

      // Nota média em checklists avaliados
      const runs = checklistRuns.filter(r => r.evaluatedProfessionalId === prof.id);
      const avgScore = runs.length > 0 
        ? runs.reduce((sum, r) => sum + (r.completionPercentage || 0), 0) / runs.length
        : 0;

      // Cálculo de XP Inteligente:
      // - 1 XP para cada R$ 1,00 de faturamento gerado
      // - 50 XP adicionais por serviço prestado
      // - 150 XP adicionais para cada produto vendido (incentiva vendas!)
      // - 200 XP por resposta ideal (100% de conformidade no checklist de qualidade)
      const baseXP = Math.floor(totalRevenue);
      const serviceBonus = totalServices * 50;
      const productBonus = totalProducts * 150;
      const perfBonus = runs.filter(r => r.completionPercentage === 100).length * 200;

      const totalXP = baseXP + serviceBonus + productBonus + perfBonus + (prof.extraXP || 0);

      // Sistema de Nível Simples e Linear:
      // Nível 1: 0 - 1000 XP
      // Nível 2: 1000 - 3000 XP
      // Nível 3: 3000 - 6000 XP
      // Nível 4: 6000 - 10000 XP
      // Nível 5+: 10000+ XP (a cada 5000 XP adicionais, ganha mais 1 nível)
      let level = 1;
      let nextLevelXP = 1000;
      let currentLevelXPStart = 0;

      if (totalXP >= 10000) {
        const extraXPs = totalXP - 10000;
        const extraLevels = Math.floor(extraXPs / 5000);
        level = 5 + extraLevels;
        currentLevelXPStart = 10000 + extraLevels * 5000;
        nextLevelXP = currentLevelXPStart + 5000;
      } else if (totalXP >= 6000) {
        level = 4;
        currentLevelXPStart = 6000;
        nextLevelXP = 10000;
      } else if (totalXP >= 3000) {
        level = 3;
        currentLevelXPStart = 3000;
        nextLevelXP = 6000;
      } else if (totalXP >= 1000) {
        level = 2;
        currentLevelXPStart = 1000;
        nextLevelXP = 3000;
      }

      const progressPercent = Math.min(
        100,
        Math.max(0, ((totalXP - currentLevelXPStart) / (nextLevelXP - currentLevelXPStart)) * 100)
      );

      // Conquistas / Badges Dinâmicas:
      const badges: Array<{ name: string; icon: string; description: string; color: string; unlocked: boolean }> = [
        {
          name: 'Mestre da Tesoura',
          icon: '✂️',
          description: 'Prestou mais de 10 serviços no salão.',
          color: 'from-amber-500 to-yellow-600',
          unlocked: totalServices >= 10
        },
        {
          name: 'Inabalável',
          icon: '⭐',
          description: 'Obteve 100% de conformidade em uma auditoria.',
          color: 'from-blue-500 to-indigo-600',
          unlocked: runs.some(r => r.completionPercentage === 100)
        },
        {
          name: 'Imperador de Vendas',
          icon: '🛍️',
          description: 'Vendeu mais de 3 produtos físicos para clientes.',
          color: 'from-emerald-500 to-teal-600',
          unlocked: totalProducts >= 3
        },
        {
          name: 'Luz de Lumière',
          icon: '👑',
          description: 'Faturou acima de R$ 2.000,00 no mês corrente.',
          color: 'from-purple-500 to-pink-600',
          unlocked: totalRevenue >= 2000
        },
        {
          name: 'Super Querido',
          icon: '🔥',
          description: 'Realizou mais de 20 atendimentos com elogio.',
          color: 'from-orange-500 to-red-600',
          unlocked: completedSrvs.length >= 20
        }
      ];

      return {
        ...prof,
        totalRevenue,
        totalServices,
        totalProducts,
        totalXP,
        level,
        nextLevelXP,
        currentLevelXPStart,
        progressPercent,
        badges,
        avgScore,
        unlockedBadgesCount: badges.filter(b => b.unlocked).length
      };
    }).sort((a, b) => b.totalXP - a.totalXP);
  }, [professionals, appointments, checklistRuns]);

  // Criar nova campanha
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    if (!newCampaign.title || !newCampaign.description) {
      toast.error('Preencha os campos obrigatórios!');
      return;
    }

    try {
      await addDoc(collection(db, `salons/${salonData.id}/gamification_campaigns`), {
        title: newCampaign.title,
        description: newCampaign.description,
        xpValue: parseInt(newCampaign.xpValue) || 100,
        type: newCampaign.type,
        targetValue: parseFloat(newCampaign.targetValue) || 1,
        status: 'active',
        createdAt: Date.now()
      });

      toast.success('Missão ativa lançada no salão para toda equipe!');
      setIsNewCampaignOpen(false);
      setNewCampaign({
        title: '',
        description: '',
        xpValue: '300',
        type: 'service_focus',
        targetValue: '5'
      });
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao criar a Missão.');
    }
  };

  // Obter o profissional de destaque
  const topProfessional = useMemo(() => {
    return professionalsPerformance[0] || null;
  }, [professionalsPerformance]);

  return (
    <div className="space-y-8 pb-10" id="gamification-page">
      {/* Header visual incrível */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-8 rounded-3xl border border-[#D4AF37]/15">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold font-sans uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5 animate-pulse" /> Arena de Performance & Competitividade
          </div>
          <h1 className="text-3xl font-bold tracking-tight font-heading text-white">
            Gamificação & <span className="text-[#D4AF37] filter drop-shadow-[0_0_8px_rgba(212,175,55,0.25)]">Engajamento de Equipe</span>
          </h1>
          <p className="text-zinc-400 text-sm max-w-xl">
            Incentive seu time, destrave metas, venda produtos parceiros e acompanhe o ranking de faturamento em tempo real para blindar a saúde financeira do seu negócio.
          </p>
        </div>

        {isOwnerOrManager && (
          <Dialog open={isNewCampaignOpen} onOpenChange={setIsNewCampaignOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 font-bold px-6 py-5 rounded-2xl flex items-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.15)] select-none">
                <Plus className="w-5 h-5 stroke-[2.5]" /> Criar Lançamento de Missão
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl text-[#D4AF37] flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#D4AF37]" /> Nova Missão para a Equipe
                </DialogTitle>
                <CardDescription className="text-zinc-400">
                  Defina um objetivo focado em gargalos de vendas para a equipe e recompense com XPs adicionais para turbinar o leaderboard.
                </CardDescription>
              </DialogHeader>

              <form onSubmit={handleCreateCampaign} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Título do Desafio</Label>
                  <Input 
                    required 
                    value={newCampaign.title} 
                    onChange={e => setNewCampaign(p => ({ ...p, title: e.target.value }))}
                    className="bg-zinc-900 border-zinc-800"
                    placeholder="Ex: Operação Hidratação Extra"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Explicação / Detalhes</Label>
                  <Input 
                    required 
                    value={newCampaign.description} 
                    onChange={e => setNewCampaign(p => ({ ...p, description: e.target.value }))}
                    className="bg-zinc-900 border-zinc-800"
                    placeholder="Ex: Realizar 5 hidratações de marcas importadas nesta semana"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Tipo de Alvo</Label>
                    <Select value={newCampaign.type} onValueChange={(v: any) => setNewCampaign(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectItem value="service_focus">Volume de Serviços</SelectItem>
                        <SelectItem value="product_vendas">Vendas de Produtos</SelectItem>
                        <SelectItem value="faturamento_elite">Alvo de Faturamento R$</SelectItem>
                        <SelectItem value="checklist_perito">Excelência em Checklist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-300">Meta Requerida</Label>
                    <Input 
                      required 
                      type="number"
                      value={newCampaign.targetValue} 
                      onChange={e => setNewCampaign(p => ({ ...p, targetValue: e.target.value }))}
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">XP de Recompensa</Label>
                  <Input 
                    required 
                    type="number"
                    value={newCampaign.xpValue} 
                    onChange={e => setNewCampaign(p => ({ ...p, xpValue: e.target.value }))}
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>

                <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-11 rounded-xl mt-2">
                  Destravar Desafio
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Destaque do Profissional do Mês / Campeão */}
      {topProfessional && (
        <div className="bg-[#0b0c10] border border-emerald-500/15 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="flex items-center gap-5 z-10 w-full md:w-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-yellow-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl">
              👑
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5" /> Profissional Líder de Performance
              </span>
              <h2 className="text-2xl font-bold font-sans text-white">{topProfessional.name}</h2>
              <p className="text-zinc-400 text-xs">
                Nível <span className="font-bold text-yellow-500 font-mono">{topProfessional.level}</span> • Total de <span className="text-white font-semibold font-mono">{topProfessional.totalXP.toLocaleString()} XP</span> acumulados neste ciclo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center w-full md:w-auto bg-zinc-950/40 p-4 rounded-2xl border border-zinc-900 z-10">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Faturamento</span>
              <span className="text-sm font-semibold text-white font-mono">{formatBRL(topProfessional.totalRevenue)}</span>
            </div>
            <div className="border-x border-zinc-900">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Produtos</span>
              <span className="text-sm font-semibold text-yellow-500 font-mono">{topProfessional.totalProducts} un</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-sans">Badges</span>
              <span className="text-sm font-semibold text-zinc-300 font-mono">{topProfessional.unlockedBadgesCount} / 5</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-900 pb-px flex items-center gap-6">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-4 text-sm font-bold tracking-wide relative transition-colors ${
            activeTab === 'leaderboard' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Trophy className="w-4 h-4" /> Quadro de Líderes (Equipe)
          </span>
          {activeTab === 'leaderboard' && (
            <motion.div layoutId="gamification-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('quests')}
          className={`pb-4 text-sm font-bold tracking-wide relative transition-colors ${
            activeTab === 'quests' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Target className="w-4 h-4" /> Missões Ativas ({campaigns.length})
          </span>
          {activeTab === 'quests' && (
            <motion.div layoutId="gamification-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('rewards')}
          className={`pb-4 text-sm font-bold tracking-wide relative transition-colors ${
            activeTab === 'rewards' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <Award className="w-4 h-4" /> Sistema de Badges & Conquistas
          </span>
          {activeTab === 'rewards' && (
            <motion.div layoutId="gamification-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]" />
          )}
        </button>
      </div>

      {/* Conteúdos das abas */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'leaderboard' && (
            <div className="space-y-5">
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold font-heading text-white">Prêmio Top Performance Lumière</h3>
                    <p className="text-xs text-zinc-500">Métricas acumuladas no mês. A atualização ocorre instantaneamente a cada checkout de comanda.</p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-900 px-3.5 py-1.5 rounded-full border border-zinc-800">
                    <Flame className="w-4 h-4 text-orange-500" /> XP atualiza em tempo real
                  </div>
                </div>

                <div className="divide-y divide-zinc-900 overflow-x-auto">
                  {professionalsPerformance.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-sm">
                      Nenhum colaborador registrado no salão para entrar na disputa.
                    </div>
                  ) : (
                    professionalsPerformance.map((prof, idx) => {
                      const isTop3 = idx < 3;
                      const medalColor = idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-zinc-400' : 'bg-orange-600';
                      
                      return (
                        <div key={prof.id} className="p-4 sm:p-6 flex items-center justify-between gap-4 hover:bg-zinc-900/10 transition-colors">
                          <div className="flex items-center gap-4 min-w-[200px]">
                            {/* Posição do ranking */}
                            <div className="w-8 flex justify-center">
                              {isTop3 ? (
                                <span className={`w-6 h-6 rounded-lg ${medalColor} text-black font-extrabold text-[11px] flex items-center justify-center shadow-lg font-sans`}>
                                  {idx + 1}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-600 font-bold font-mono">
                                  #{idx + 1}
                                </span>
                              )}
                            </div>

                            {/* Foto/Ícone */}
                            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shrink-0 font-sans">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'}
                            </div>

                            {/* Info */}
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                {prof.name || prof.fullName}
                                {idx === 0 && <span className="text-[10px] bg-yellow-500/15 border border-yellow-500/20 text-yellow-500 font-extrabold px-2 py-0.5 rounded-md tracking-wider uppercase font-sans">Líder</span>}
                              </h4>
                              <p className="text-zinc-500 text-[11px] flex items-center gap-1.5">
                                Nível <span className="text-white font-bold font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{prof.level}</span> • {prof.unlockedBadgesCount} Conquistas destravadas
                              </p>
                            </div>
                          </div>

                          {/* XP Progress Bar */}
                          <div className="hidden md:block flex-1 max-w-sm space-y-2">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-zinc-500 uppercase tracking-widest font-sans">Progresso de Nível</span>
                              <span className="text-zinc-400 font-semibold font-mono">{prof.totalXP} / {prof.nextLevelXP} XP</span>
                            </div>
                            <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                              <motion.div
                                className="h-full bg-gradient-to-r from-[#D4AF37] to-amber-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${prof.progressPercent}%` }}
                                transition={{ duration: 0.5, delay: idx * 0.05 }}
                              />
                            </div>
                          </div>

                          {/* Métricas e Total de XP */}
                          <div className="flex items-center gap-6 text-right shrink-0">
                            <div className="hidden sm:block">
                              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-sans">Produzido no Mês</span>
                              <span className="text-xs font-bold text-white font-mono">{formatBRL(prof.totalRevenue)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-sans">Score Total</span>
                              <span className="text-sm font-bold text-[#D4AF37] font-mono">{prof.totalXP.toLocaleString()} XP</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quests' && (
            <div className="space-y-6">
              {campaigns.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center mx-auto text-2xl">
                    🎯
                  </div>
                  <h3 className="text-lg font-bold text-white font-heading">Nenhuma Missão Ativa</h3>
                  <p className="text-xs text-zinc-500">
                    O salão não possui desafios temporários de venda ativos no momento. Proprietários ou gerentes podem criar missões no topo da tela para impulsionar serviços casados ou estoque parado!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {campaigns.map((quest) => {
                    const icon = quest.type === 'product_vendas' ? '🛍️' : quest.type === 'faturamento_elite' ? '💰' : quest.type === 'checklist_perito' ? '✅' : '⚡';
                    const label = quest.type === 'product_vendas' ? 'Venda de Produtos' : quest.type === 'faturamento_elite' ? 'Atingir Faturamento' : quest.type === 'checklist_perito' ? 'Auditorias Limpas' : 'Serviços em Destaque';
                    
                    return (
                      <Card key={quest.id} className="bg-zinc-950 border border-zinc-900 rounded-3xl hover:border-[#D4AF37]/20 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-2xl group-hover:bg-[#D4AF37]/10 transition-colors pointer-events-none" />
                        
                        <CardHeader className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-[#D4AF37] px-2.5 py-1 rounded-full uppercase tracking-widest font-sans">
                                {icon} {label}
                              </span>
                              <CardTitle className="text-lg font-bold text-white pt-2 leading-tight">
                                {quest.title}
                              </CardTitle>
                            </div>

                            <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] px-3 py-1.5 rounded-xl font-extrabold text-sm font-mono shrink-0">
                              +{quest.xpValue} XP
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-6 pt-0 space-y-4">
                          <p className="text-xs text-zinc-400">{quest.description}</p>
                          
                          <div className="border-t border-zinc-900/60 pt-4 flex items-center justify-between text-xs">
                            <span className="text-zinc-500 font-sans">Condição de Vitória</span>
                            <span className="text-white font-semibold font-mono">
                              {quest.type === 'faturamento_elite' ? formatBRL(quest.targetValue) : `${quest.targetValue} execuções`}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="text-3xl mb-4">🏆</div>
                  <h3 className="text-base font-bold text-white mb-2">Mede sua Performance</h3>
                  <p className="text-xs text-zinc-500">
                    O sistema computará cada ação no LumièreOS gerando comanda ou resolvendo checklist. Badges representam faturamento e dedicação.
                  </p>
                </Card>

                <Card className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="text-3xl mb-4">🎖️</div>
                  <h3 className="text-base font-bold text-white mb-2">Engaje sua Equipe</h3>
                  <p className="text-xs text-zinc-500">
                    Exponha os badges no painel dos profissionais para incentivar uma rivalidade saudável de metas batidas e satisfação ao cliente.
                  </p>
                </Card>

                <Card className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">
                  <div className="text-3xl mb-4">🎁</div>
                  <h3 className="text-base font-bold text-white mb-2">Premiações Reais</h3>
                  <p className="text-xs text-zinc-500">
                    Dono de salão: utilize os níveis de XP alcançados para presentear sua equipe com bonificações exclusivas ou folgas remuneradas.
                  </p>
                </Card>
              </div>

              {/* Lista Completa de Badges estruturadas */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Catálogo de Emblemas & Badges</h3>
                  <p className="text-xs text-zinc-500">Conquistas desbloqueadas dinamicamente com base nas métricas históricas de agendamento e checklist do profissional.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: 'Mestre da Tesoura', icon: '✂️', desc: 'Prestou mais de 10 serviços no salão.', req: '10 serviços' },
                    { name: 'Inabalável', icon: '⭐', desc: 'Obteve 100% de conformidade em checklist.', req: '1 checklist no topo' },
                    { name: 'Imperador de Vendas', icon: '🛍️', desc: 'Vendeu mais de 3 produtos físicos.', req: '3 produtos vendidos' },
                    { name: 'Luz de Lumière', icon: '👑', desc: 'Faturou acima de R$ 2.000,00 no mês.', req: 'R$ 2.000,00 faturados' },
                    { name: 'Super Querido', icon: '🔥', desc: 'Realizou mais de 20 atendimentos.', req: '20 atendimentos concluídos' },
                  ].map(b => (
                    <div key={b.name} className="p-4 bg-zinc-900/60 border border-zinc-900 rounded-2xl flex items-start gap-4">
                      <div className="w-12 h-12 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center text-2xl shrink-0 font-sans">
                        {b.icon}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">{b.name}</h4>
                        <p className="text-zinc-500 text-[11px] leading-relaxed">{b.desc}</p>
                        <span className="inline-block text-[10px] text-yellow-500/80 font-mono font-semibold pt-1">Requisito: {b.req}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

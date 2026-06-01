import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { Professional, Goal, ProfessionalGoal } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Loader2, 
  Target, 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  Users, 
  DollarSign, 
  ShieldAlert, 
  Split 
} from 'lucide-react';
import { formatBRL } from '@/lib/utils';

export default function OnboardingGoals() {
  const { salonData } = useAuth();
  const navigate = useNavigate();

  // Selected onboarding month (defaults to current month)
  const [selectedMonth] = useState(() => {
    return new Date().toISOString().substring(0, 7); // YYYY-MM
  });

  // State
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loadingProfs, setLoadingProfs] = useState(true);
  const [saving, setSaving] = useState(false);

  // General Goal Input
  const [salonTargetInput, setSalonTargetInput] = useState('10000');
  
  // Professional goals mapped state: { [profId]: targetAmountString }
  const [profTargets, setProfTargets] = useState<{ [profId: string]: string }>({});

  // Sync professionals
  useEffect(() => {
    if (!salonData?.id) return;

    const q = query(collection(db, `salons/${salonData.id}/professionals`));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Professional[];
        const activeProfs = list.filter(p => p.isActive);
        setProfessionals(activeProfs);
        
        // Initialize targets for each professional to '0' initially
        const targets: { [key: string]: string } = {};
        activeProfs.forEach(p => {
          targets[p.id] = '0';
        });
        setProfTargets(targets);
        setLoadingProfs(false);
      },
      (err) => {
        console.error('Erro ao sincronizar profissionais para metas:', err);
        setLoadingProfs(false);
      }
    );

    return () => unsub();
  }, [salonData?.id]);

  // Distribute general target evenly across all active team members
  const handleSplitEvenly = () => {
    const totalSalonTarget = parseFloat(salonTargetInput.replace(',', '.')) || 0;
    if (totalSalonTarget <= 0) {
      toast.error('Insira uma meta global maior que zero para dividir.');
      return;
    }
    if (professionals.length === 0) {
      toast.error('Adicione profissionais na etapa anterior para dividir as metas.');
      return;
    }

    const share = (totalSalonTarget / professionals.length).toFixed(2);
    const updated: { [profId: string]: string } = {};
    professionals.forEach((p) => {
      updated[p.id] = share.replace('.', ',');
    });
    setProfTargets(updated);
    toast.success('Meta global distribuída uniformemente entre seus profissionais!');
  };

  // Change a single professional's target in our local state
  const handleProfTargetChange = (profId: string, val: string) => {
    setProfTargets(prev => ({
      ...prev,
      [profId]: val
    }));
  };

  // Calculate sum of individual professional targets in state
  const sumOfProfTargets = professionals.reduce((acc, p) => {
    const val = profTargets[p.id] || '0';
    const num = parseFloat(val.replace(',', '.')) || 0;
    return acc + num;
  }, 0);

  // Submit Goals
  const handleSaveGoals = async () => {
    if (!salonData?.id) return;
    setSaving(true);

    try {
      const parsedSalonTarget = parseFloat(salonTargetInput.replace(',', '.')) || 0;

      // 1. Save general goal
      const goalId = selectedMonth; // use YYYY-MM as document ID
      const goalRef = doc(db, `salons/${salonData.id}/goals`, goalId);
      
      const goalPayload: Goal = {
        id: goalId,
        title: `Meta Mensal - ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`,
        month: selectedMonth,
        targetAmount: parsedSalonTarget,
        currentAmount: 0, // default to start
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(goalRef, goalPayload, { merge: true });

      // 2. Save individual professional goals
      for (const p of professionals) {
        const profTargetVal = parseFloat((profTargets[p.id] || '0').replace(',', '.')) || 0;
        const profGoalId = `${p.id}_${selectedMonth}`;
        const profGoalRef = doc(db, `salons/${salonData.id}/professionalGoals`, profGoalId);

        const profGoalPayload: ProfessionalGoal = {
          id: profGoalId,
          professionalId: p.id,
          professionalName: p.name,
          month: selectedMonth,
          targetAmount: profTargetVal,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await setDoc(profGoalRef, profGoalPayload, { merge: true });
      }

      toast.success('Metas de faturamento configuradas com sucesso!');
      navigate('/onboarding/checklist');
    } catch (err) {
      console.error('Erro ao salvar metas onboarding:', err);
      toast.error('Erro ao gravar metas financeiras. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const getMonthName = () => {
    const [_, mm] = selectedMonth.split('-');
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[parseInt(mm, 10) - 1] || 'Mês Atual';
  };

  const currentMonthName = getMonthName();

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 bg-[#D4AF37]/10 rounded-full border border-[#D4AF37]/20 flex items-center justify-center mb-1">
          <Target className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <h2 className="text-2xl font-heading text-white">Metas Estritas</h2>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Defina a meta financeira de faturamento do seu espaço para o mês de <span className="text-[#D4AF37] font-semibold">{currentMonthName}</span> e engaje sua equipe.
        </p>
      </div>

      {/* Main target metric card */}
      <Card className="bg-[#0b0b0d] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] bg-primary/10 border border-primary/25 text-primary font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                Planejamento de Luxo
              </span>
              <h3 className="text-base font-semibold text-white">Faturamento Alvo do Salão</h3>
              <p className="text-xs text-muted-foreground font-light max-w-md">
                Qual o volume financeiro ideal que você deseja atingir em {currentMonthName}? Este valor embasará os gráficos de crescimento.
              </p>
            </div>

            <div className="w-full md:w-52 space-y-1.5 shrink-0">
              <Label className="text-xs text-slate-400 font-mono" htmlFor="salon-target-input">Meta Total (R$)</Label>
              <div className="relative">
                <span className="text-xs text-muted-foreground absolute left-3 top-3 select-none">R$</span>
                <Input
                  id="salon-target-input"
                  type="text"
                  value={salonTargetInput}
                  onChange={(e) => setSalonTargetInput(e.target.value)}
                  placeholder="15.000"
                  className="bg-black/60 border-white/10 rounded-xl h-10 text-xs pl-8 focus:border-primary text-white font-mono font-medium"
                />
              </div>
            </div>
          </div>

          {professionals.length > 0 && (
            <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1.5">
                <p className="text-xs text-slate-350 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  Divisão de Faturamento por Profissional
                </p>
                <p className="text-[11px] text-muted-foreground font-light leading-relaxed">
                  Total distribuído na equipe: <strong className="text-primary font-mono">{formatBRL(sumOfProfTargets)}</strong> 
                  {sumOfProfTargets !== (parseFloat(salonTargetInput.replace(',', '.')) || 0) && (
                    <span className="text-amber-400 ml-1.5 inline-flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Difere da meta global ({formatBRL(parseFloat(salonTargetInput.replace(',', '.')) || 0)})
                    </span>
                  )}
                </p>
              </div>

              <Button
                id="split-evenly-btn"
                type="button"
                onClick={handleSplitEvenly}
                variant="outline"
                className="border-white/10 text-slate-350 hover:bg-white/[0.04] rounded-xl text-[11px] h-8 font-medium flex items-center gap-1.5 self-end md:self-auto shrink-0"
              >
                <Split className="w-3.5 h-3.5 text-[#D4AF37]" />
                Dividir por Igual entre {professionals.length}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Professional Goals Setup Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white tracking-wide">Metas Individuais da Equipe</h3>

        {loadingProfs ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 border border-white/5 bg-white/[0.005] rounded-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
            <p className="text-[10px] text-muted-foreground font-mono">Carregando equipe para metas...</p>
          </div>
        ) : professionals.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl bg-[#070709] space-y-4">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-300">Você não possui profissionais cadastrados</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Não se preocupe! Você pode focar apenas na meta global individual do salão por enquanto e continuar.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/onboarding/equipe')}
              className="border-white/10 hover:border-slate-800 text-slate-300 text-xs h-9 px-4 rounded-xl"
            >
              Voltar e Adicionar Membros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {professionals.map((p) => (
              <div 
                key={p.id}
                className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-white/10 transition duration-150"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {p.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate leading-none mb-1.5">{p.name}</h4>
                    <span className="text-[9px] text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                      {p.primaryFunction || p.role || 'Membro'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 w-28 shrink-0">
                  <Label className="text-[10px] text-muted-foreground font-mono" htmlFor={`target-prof-${p.id}`}>Meta (R$)</Label>
                  <div className="relative">
                    <span className="text-[10px] text-muted-foreground/60 absolute left-2 top-2 select-none">R$</span>
                    <Input
                      id={`target-prof-${p.id}`}
                      type="text"
                      className="bg-black/60 border-white/10 rounded-lg h-8 text-[11px] pl-6 focus:border-primary text-white font-mono"
                      value={profTargets[p.id] || ''}
                      onChange={(e) => handleProfTargetChange(p.id, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Navigation bar */}
      <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
        <Button
          id="onboarding-btn-back"
          onClick={() => navigate('/onboarding/servicos')}
          variant="ghost"
          className="hover:bg-white/[0.04] text-slate-300 text-xs h-10 px-5 rounded-xl"
        >
          Voltar para Serviços
        </Button>
        <p className="text-[11px] text-muted-foreground font-light hidden lg:flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary animate-pulse" /> Passo 3 de 4 • Próximo passo: Checklist Operacional
        </p>
        <Button
          id="onboarding-btn-continue"
          onClick={handleSaveGoals}
          disabled={saving}
          className="bg-primary hover:bg-gold-400 text-black font-semibold h-10 px-6 rounded-xl text-xs flex items-center gap-1.5"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Salvar Metas
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

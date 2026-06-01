import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { predefinedTemplates, PredefinedTemplate } from '../../data/checklistTemplates';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  Loader2, 
  Sparkles, 
  Check, 
  Users, 
  ArrowRight, 
  Activity, 
  ClipboardCheck,
  Award
} from 'lucide-react';

export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const { userData, salonData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);

  // Maintain local state of which templates the owner wants to activate.
  // By default, pre-select: Abertura, Fechamento, and Atendimento Premium
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    predefinedTemplates.forEach((t) => {
      if (
        t.title.includes('Abertura') || 
        t.title.includes('Fechamento') || 
        t.title.includes('Atendimento Premium')
      ) {
        defaults[t.title] = true;
      }
    });
    return defaults;
  });

  const toggleTemplateSelection = (title: string) => {
    setSelectedTemplates((prev) => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const handleFinishOnboarding = async () => {
    if (!salonData?.id) {
      toast.error('Erro de sincronização. Dados do salão não carregados.');
      return;
    }

    setLoading(true);
    let successfullyCreatedCount = 0;

    try {
      // 1. Create selected checklists in Firestore
      const activeTemplates = predefinedTemplates.filter(t => selectedTemplates[t.title]);

      for (const template of activeTemplates) {
        // Generate a valid custom or random ID
        const checklistId = 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const checklistRef = doc(db, `salons/${salonData.id}/checklists`, checklistId);

        // Convert the template item schema to standard database schemas with item.id included
        const itemsWithId = template.items.map((item, itemIdx) => ({
          id: `item_${Date.now()}_${itemIdx}_${Math.random().toString(36).substr(2, 4)}`,
          label: item.label,
          required: item.required ?? true,
          category: item.category ?? '',
          points: item.points ?? 5
        }));

        const checklistPayload = {
          id: checklistId,
          title: template.title,
          description: template.description || '',
          type: template.type || 'standard',
          checklistGroup: template.checklistGroup || 'operational',
          scoringMode: template.scoringMode || 'checkbox',
          scoreBy: template.scoreBy || 'item',
          maxScore: template.maxScore || itemsWithId.length * 5,
          categories: template.categories || [],
          items: itemsWithId,
          classificationRules: template.classificationRules || [],
          scale: template.scale || {},
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await setDoc(checklistRef, checklistPayload, { merge: true });
        successfullyCreatedCount++;
      }

      // 2. Mark onboardingCompleted in the salon document
      const salonRef = doc(db, 'salons', salonData.id);
      await setDoc(salonRef, { 
        onboardingCompleted: true,
        updatedAt: Date.now()
      }, { merge: true });

      // 3. Mark onboardingCompleted in the user document
      if (userData?.uid) {
        const userRef = doc(db, 'users', userData.uid);
        await setDoc(userRef, { 
          onboardingCompleted: true,
          updatedAt: Date.now()
        }, { merge: true });
      }

      await refreshUserData();
      
      if (successfullyCreatedCount > 0) {
        toast.success(`${successfullyCreatedCount} processos operacionais ativados com sucesso!`);
      }
      toast.success('Onboarding completo! Bem-vindo ao LumièreOS.');
      
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Erro ao finalizar o onboarding do Checklist:', err);
      toast.error('Erro ao salvar as configurações operacionais: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full border border-primary/20 flex items-center justify-center mb-1">
          <ClipboardCheck className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-2xl font-heading text-white">Padronização Operacional</h2>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Ative os processos e rotinas administrativas que farão o seu espaço funcionar em piloto automático com conformidade estrita.
        </p>
      </div>

      {/* Grid of checklists */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-mono font-medium">Modelos Disponíveis</span>
          <span className="text-[11px] text-[#D4AF37] font-semibold bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-full">
            Prontos para ativação
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {predefinedTemplates.map((t) => {
            const isSelected = !!selectedTemplates[t.title];
            const isEvaluation = t.type === 'professional_daily_evaluation';
            
            return (
              <Card 
                key={t.title}
                onClick={() => toggleTemplateSelection(t.title)}
                className={`cursor-pointer transition duration-200 select-none border rounded-2xl overflow-hidden relative ${
                  isSelected 
                    ? 'bg-primary/[0.03] border-primary/40 shadow-md shadow-primary/[0.01]' 
                    : 'bg-[#08080a] border-white/5 hover:border-white/10'
                }`}
              >
                <CardContent className="p-5 flex gap-4">
                  {/* Selector box */}
                  <div className="pt-0.5">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                      isSelected 
                        ? 'bg-primary border-primary text-black' 
                        : 'border-white/20 hover:border-white/40'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Template info */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-semibold text-white leading-tight">{t.title}</h4>
                      {isEvaluation ? (
                        <span className="text-[9px] bg-indigo-500/10 border border-indigo-505/25 text-indigo-400 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider">
                          Avaliação Diária
                        </span>
                      ) : (
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-505/25 text-emerald-400 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider">
                          Operacional
                        </span>
                      )}
                    </div>
                    
                    <p className="text-[11px] text-muted-foreground font-light leading-relaxed truncate-2-lines">
                      {t.description}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                      <span>{t.items.length} itens inclusos</span>
                      <span>•</span>
                      <span>Estilo: {t.scoringMode === 'rating_1_5' ? '1 a 5 Estrelas' : 'Caixa de Seleção'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Success/Ready Box */}
      <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 mt-6">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-550/20 flex items-center justify-center shrink-0">
          <Award className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="text-center sm:text-left">
          <h4 className="text-xs font-semibold text-white">Sua estrutura está pronta para rodar!</h4>
          <p className="text-[11px] text-muted-foreground font-light mt-0.5">
            Ao finalizar, as rotinas selecionadas serão criadas na base de dados para você e sua equipe iniciarem os lançamentos reativos.
          </p>
        </div>
      </div>

      {/* Navigation Footer bar */}
      <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
        <Button
          id="onboarding-checklist-back"
          onClick={() => navigate('/onboarding/metas')}
          variant="ghost"
          className="hover:bg-white/[0.04] text-slate-300 text-xs h-10 px-5 rounded-xl"
        >
          Voltar para Metas
        </Button>
        
        <p className="text-[11px] text-muted-foreground font-light hidden lg:flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary animate-pulse" /> Passo final completo • Pronto para o lançamento
        </p>
        
        <Button
          id="onboarding-checklist-finish"
          onClick={handleFinishOnboarding}
          disabled={loading}
          className="bg-primary hover:bg-gold-500 text-black font-semibold h-10 px-6 rounded-xl text-xs flex items-center gap-1.5"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />}
          {loading ? 'Inicializando Sistema...' : 'Concluir e Ir ao Painel'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

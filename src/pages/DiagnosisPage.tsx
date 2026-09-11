import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, HelpCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Need = 'operation' | 'team' | 'finance' | 'intelligence' | 'multiunit';

const options: { id: Need; label: string; description: string }[] = [
  { id: 'operation', label: 'Organizar a operação', description: 'Agenda, clientes, serviços, comandas e rotina.' },
  { id: 'team', label: 'Gerenciar pessoas e metas', description: 'Equipe, metas, comissões, checklists e desempenho.' },
  { id: 'finance', label: 'Controlar o financeiro', description: 'Caixa, contas, comissões e visão financeira.' },
  { id: 'intelligence', label: 'Analisar e melhorar resultados', description: 'IA, indicadores, insights e automações.' },
  { id: 'multiunit', label: 'Controlar várias unidades', description: 'Gestão centralizada e comparação entre unidades.' },
];

export default function DiagnosisPage() {
  const navigate = useNavigate();
  const [needs, setNeeds] = useState<Need[]>([]);

  const recommended = useMemo(() => {
    if (needs.includes('multiunit')) return { id: 'multiunit', name: 'Multiunidade', reason: 'A gestão de várias unidades exige uma visão centralizada.' };
    if (needs.includes('intelligence')) return { id: 'performance_plus', name: 'Performance', reason: 'É o plano que reúne inteligência, indicadores e automação.' };
    if (needs.includes('team') || needs.includes('finance')) return { id: 'professional', name: 'Gestão', reason: 'É o plano mais completo para equipe, metas e gestão financeira.' };
    return { id: 'essential', name: 'Essencial', reason: 'Reúne as ferramentas necessárias para organizar a operação.' };
  }, [needs]);

  const toggle = (id: Need) => setNeeds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  return (
    <div className="min-h-screen bg-black text-white px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary"><Sparkles className="w-4 h-4" /> Diagnóstico LumièreOS</div>
          <h1 className="mt-6 text-4xl md:text-5xl font-light">Qual parte da operação precisa de mais controle?</h1>
          <p className="mt-4 text-zinc-400">Selecione tudo o que faz sentido. Não pediremos nome, telefone ou outros dados nesta etapa.</p>
        </div>

        <div className="space-y-3">
          {options.map(option => {
            const selected = needs.includes(option.id);
            return <button key={option.id} onClick={() => toggle(option.id)} className={`w-full text-left rounded-2xl border p-5 transition ${selected ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-zinc-950 hover:border-white/20'}`}>
              <div className="flex gap-4 items-start">
                <div className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ${selected ? 'border-primary bg-primary text-black' : 'border-white/20'}`}>{selected && <Check className="w-3.5 h-3.5" />}</div>
                <div><div className="font-semibold">{option.label}</div><div className="text-sm text-zinc-400 mt-1">{option.description}</div></div>
              </div>
            </button>;
          })}
        </div>

        <div className="mt-8 rounded-3xl border border-primary/30 bg-primary/[0.06] p-6">
          <div className="text-xs uppercase tracking-widest text-primary font-bold">Recomendação</div>
          <div className="mt-2 text-2xl font-semibold">{recommended.name}</div>
          <p className="mt-2 text-zinc-300">{recommended.reason}</p>
          <Button onClick={() => navigate(`/cadastro?plan=${recommended.id}&cycle=MONTHLY`)} className="mt-5 rounded-full bg-primary text-black hover:bg-yellow-300">
            Escolher {recommended.name} <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        <div className="mt-8 text-center"><Button variant="ghost" onClick={() => navigate('/planos')} className="text-zinc-400"><HelpCircle className="mr-2 w-4 h-4" /> Voltar para os planos</Button></div>
      </div>
    </div>
  );
}

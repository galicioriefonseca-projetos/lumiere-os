import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, HelpCircle, Sparkles, Building2, Users, CircleDollarSign, Bot, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

type Need = 'operation' | 'team' | 'finance' | 'intelligence' | 'multiunit';

const options: { id: Need; label: string; description: string; icon: any }[] = [
  { id: 'operation', label: 'Organizar a operação e rotinas', description: 'Agenda centralizada, clientes, serviços, prazos e controle de entregas.', icon: Layers },
  { id: 'team', label: 'Gerenciar pessoas, metas e comissões', description: 'Equipe, metas individuais/coletivas, regras de comissão e ranking de produtividade.', icon: Users },
  { id: 'finance', label: 'Controlar finanças e fluxo de caixa', description: 'DRE gerencial, contas a pagar/receber, conciliação e margens de lucro.', icon: CircleDollarSign },
  { id: 'intelligence', label: 'IA executiva e diagnósticos estratégicos', description: 'Lumi IA, previsão de faturamento, retenção de clientes e automações.', icon: Bot },
  { id: 'multiunit', label: 'Controlar múltiplos polos ou unidades', description: 'Gestão consolidada de filiais, holding e comparação de resultados.', icon: Building2 },
];

export default function DiagnosisPage() {
  const navigate = useNavigate();
  const [needs, setNeeds] = useState<Need[]>(['operation']);

  const recommended = useMemo(() => {
    if (needs.includes('multiunit')) {
      return { 
        id: 'multiunit', 
        name: 'Multiunidade', 
        price: 897,
        reason: 'A gestão de várias unidades ou polos exige visão centralizada, controle de permissões e dashboards consolidados.' 
      };
    }
    if (needs.includes('intelligence')) {
      return { 
        id: 'performance_plus', 
        name: 'Performance com Lumi IA', 
        price: 597,
        reason: 'É o plano que reúne inteligência artificial, diagnósticos em tempo real, previsibilidade financeira e automação.' 
      };
    }
    if (needs.includes('team') || needs.includes('finance')) {
      return { 
        id: 'professional', 
        name: 'Gestão', 
        price: 397,
        reason: 'É o plano ideal para estruturar equipe, comissões automáticas, metas de produtividade e controle financeiro avançado.' 
      };
    }
    return { 
      id: 'essential', 
      name: 'Essencial', 
      price: 197,
      reason: 'Reúne todas as ferramentas essenciais para organizar sua operação diária, clientes e finanças básicas.' 
    };
  }, [needs]);

  const toggle = (id: Need) => {
    setNeeds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#171717] px-4 py-12 md:py-16 selection:bg-[#B89B5E]/20">
      <div className="max-w-3xl mx-auto">
        
        {/* Top bar back button */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/')} 
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#77746D] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para o início
          </button>
          
          <button 
            onClick={() => navigate('/planos')} 
            className="text-xs font-semibold text-[#8A6D36] hover:underline"
          >
            Ver todos os planos
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DCCFB3] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#8A6D36] shadow-sm">
            <Sparkles className="w-4 h-4 text-[#B89B5E]" /> Diagnóstico Estratégico LumièreOS
          </div>
          <h1 className="mt-6 text-3xl md:text-5xl font-light tracking-tight text-[#171717]">
            Qual área da sua empresa precisa de mais controle?
          </h1>
          <p className="mt-4 text-[#66645F] text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Selecione todos os desafios atuais. Não solicitamos dados de contato nesta etapa.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {options.map(option => {
            const selected = needs.includes(option.id);
            const Icon = option.icon;
            return (
              <button 
                key={option.id} 
                onClick={() => toggle(option.id)} 
                className={`w-full text-left rounded-2xl border p-5 transition-all shadow-sm ${
                  selected 
                    ? 'border-[#B89B5E] bg-white ring-1 ring-[#B89B5E]/30 shadow-md' 
                    : 'border-[#E5E2DC] bg-[#FAF9F7] hover:border-[#D8D4CC] hover:bg-white'
                }`}
              >
                <div className="flex gap-4 items-start">
                  <div className={`mt-0.5 h-6 w-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                    selected 
                      ? 'border-[#171717] bg-[#171717] text-[#D8C79F]' 
                      : 'border-[#D8D4CC] bg-white text-transparent'
                  }`}>
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${selected ? 'text-[#8A6D36]' : 'text-zinc-400'}`} />
                      <span className="font-semibold text-sm md:text-base text-[#171717]">{option.label}</span>
                    </div>
                    <div className="text-xs md:text-sm text-[#66645F] mt-1 leading-relaxed">{option.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Recommendation Box */}
        <motion.div 
          layout
          className="mt-8 rounded-3xl border border-[#DCCFB3] bg-white p-7 md:p-8 shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-[#8A6D36] font-bold">Plano Recomendado</span>
            <span className="text-xs font-mono font-bold text-[#171717]">R$ {recommended.price}/mês</span>
          </div>
          
          <div className="mt-2 text-2xl md:text-3xl font-medium text-[#171717]">{recommended.name}</div>
          <p className="mt-2 text-sm text-[#55534F] leading-relaxed">{recommended.reason}</p>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => navigate(`/cadastro?plan=${recommended.id}&planId=${recommended.id}&cycle=MONTHLY&billingCycle=MONTHLY`)} 
              className="h-12 rounded-xl bg-[#171717] text-white hover:bg-[#2B2B2B] text-xs font-bold px-6 shadow-sm"
            >
              Escolher {recommended.name} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/planos')} 
              className="h-12 rounded-xl border-[#D8D4CC] text-xs font-semibold text-[#444] hover:bg-zinc-50"
            >
              Comparar todos os planos
            </Button>
          </div>
        </motion.div>

        {/* Bottom Help & Home */}
        <div className="mt-10 text-center flex items-center justify-center gap-6 text-xs text-[#77746D]">
          <button onClick={() => navigate('/planos')} className="hover:text-[#171717] flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" /> Dúvidas sobre planos
          </button>
          <span>•</span>
          <button onClick={() => navigate('/')} className="hover:text-[#171717]">
            Página Inicial
          </button>
        </div>

      </div>
    </div>
  );
}

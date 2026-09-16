import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Users, Scissors, UserRound, Target, ClipboardCheck, ArrowRight, CheckCircle2, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const setupItems = [
  {
    title: 'Equipe',
    description: 'Cadastre profissionais ou use o link de convite para que cada membro faça o próprio cadastro.',
    path: '/dashboard/equipe?onboarding=1',
    icon: Users,
    required: false,
    action: 'Configurar equipe'
  },
  {
    title: 'Serviços',
    description: 'Cadastre manualmente ou aproveite as ferramentas do catálogo para importar arquivos PDF/CSV e organizar os serviços.',
    path: '/dashboard/servicos?onboarding=1',
    icon: Scissors,
    required: false,
    action: 'Configurar serviços'
  },
  {
    title: 'Clientes / CRM',
    description: 'Importe sua base existente por planilha ou comece uma nova carteira de clientes dentro do CRM.',
    path: '/dashboard/clientes?onboarding=1',
    icon: UserRound,
    required: false,
    action: 'Importar clientes'
  }
];

const optionalItems = [
  { title: 'Metas', description: 'Defina metas para acompanhar o desempenho da operação.', path: '/onboarding/metas', icon: Target },
  { title: 'Checklist', description: 'Configure rotinas e padrões de atendimento da equipe.', path: '/onboarding/checklist', icon: ClipboardCheck }
];

export default function OnboardingSetupHub() {
  const navigate = useNavigate();
  const { salonData } = useAuth();

  const openModule = (path: string) => {
    window.open(path, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white px-4 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-[#D4AF37]" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#D4AF37] font-semibold mb-2">Configuração inicial</p>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight">Vamos deixar seu LumiereOS pronto</h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto mt-3 leading-relaxed">
            O pagamento foi confirmado. Agora configure sua operação usando as ferramentas que o LumiereOS já possui. O que não fizer agora poderá ser concluído depois.
          </p>
        </div>

        <div className="bg-[#0d0d12] border border-emerald-500/20 rounded-2xl p-5 mb-6 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Empresa configurada</p>
            <p className="text-xs text-zinc-500 mt-1">{salonData?.name || 'Seu estabelecimento'} já está ativo no LumiereOS.</p>
          </div>
          <Building2 className="w-5 h-5 text-emerald-400 shrink-0" />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {setupItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-[#0d0d12] border border-white/10 rounded-2xl p-5 flex flex-col hover:border-[#D4AF37]/30 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/15 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <h2 className="text-base font-semibold">{item.title}</h2>
                <p className="text-xs text-zinc-400 leading-relaxed mt-2 flex-1">{item.description}</p>
                <Button onClick={() => openModule(item.path)} className="mt-5 w-full bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-semibold rounded-xl h-10 text-xs">
                  {item.action}
                  <ExternalLink className="w-3.5 h-3.5 ml-2" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Configurações opcionais</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {optionalItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.title} onClick={() => navigate(item.path)} className="text-left bg-[#0d0d12] border border-white/5 hover:border-[#D4AF37]/20 rounded-2xl p-4 flex items-center gap-4 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-zinc-300" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium">Já está tudo pronto?</p>
            <p className="text-xs text-zinc-500 mt-1">Entre no painel e comece a operar sua empresa.</p>
          </div>
          <Button onClick={() => navigate('/dashboard', { replace: true })} className="w-full sm:w-auto bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold rounded-xl h-11 px-7">
            Entrar no LumiereOS
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

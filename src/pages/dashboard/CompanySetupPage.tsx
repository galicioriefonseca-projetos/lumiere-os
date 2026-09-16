import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Building2, ArrowRight, Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

function mapBusinessType(segment: string): string {
  switch (segment) {
    case 'Barbearia': return 'barbershop';
    case 'Clínica de Estética': return 'clinic';
    case 'Estúdio': return 'studio';
    case 'Outro': return 'other';
    default: return 'salon';
  }
}

export default function CompanySetupPage() {
  const { currentUser, userData, salonData, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState<boolean>(Boolean(token));
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    salonName: salonData?.name || '',
    businessSegment: '',
    city: salonData?.city || '',
    state: salonData?.state || '',
    estimatedProfessionals: ''
  });

  useEffect(() => {
    if (salonData?.name && !formData.salonName) {
      setFormData(prev => ({
        ...prev,
        salonName: prev.salonName || salonData.name || '',
        city: prev.city || salonData.city || '',
        state: prev.state || salonData.state || ''
      }));
    }
  }, [salonData]);

  useEffect(() => {
    if (userData && userData.onboardingStatus === 'completed') {
      navigate('/dashboard', { replace: true });
    }
  }, [userData, navigate]);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const validateToken = async () => {
      try {
        const res = await fetch(`/api/billing/setup-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!isMounted) return;

        if (!res.ok || !data.valid) {
          setTokenError(data.error || 'Este link de configuração é inválido ou já foi utilizado.');
        } else if (data.salonName) {
          setFormData(prev => ({ ...prev, salonName: data.salonName }));
        }
      } catch {
        if (isMounted) setTokenError('Não foi possível verificar o link de configuração. Verifique sua conexão.');
      } finally {
        if (isMounted) setValidatingToken(false);
      }
    };

    validateToken();
    return () => { isMounted = false; };
  }, [token]);

  const update = (name: string, value: string) => setFormData(prev => ({ ...prev, [name]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let authHeader: Record<string, string> = {};
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        authHeader = { Authorization: `Bearer ${idToken}` };
      }

      const response = await fetch('/api/billing/complete-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          token: token || undefined,
          salonName: formData.salonName,
          businessSegment: formData.businessSegment,
          city: formData.city,
          state: formData.state,
          estimatedProfessionals: formData.estimatedProfessionals
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Erro ao finalizar a configuração da empresa.');

      toast.success('Empresa configurada com sucesso! Vamos preparar seu ambiente.');
      await refreshUserData().catch(() => {});
      window.location.href = '/onboarding/configuracao';
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar dados da empresa.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
          <p className="text-zinc-400 text-sm">Validando link de segurança exclusivo...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0d0d12]/90 border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-xl text-center">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-amber-400"><AlertCircle className="w-7 h-7" /></div>
          <h2 className="text-xl font-medium text-white mb-2">Link Expirado ou Já Utilizado</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">{tokenError}</p>
          <div className="flex flex-col gap-2.5">
            <button onClick={() => navigate('/dashboard')} className="w-full h-11 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-semibold text-sm transition">Acessar Painel</button>
            <button onClick={() => navigate('/login')} className="w-full h-11 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 text-sm transition">Fazer Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#0d0d12]/90 border border-white/10 p-6 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-5 mb-6 border-b border-white/5 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="w-4 h-4" /><span className="font-medium">1. Pagamento Confirmado</span></div>
          <div className="h-px w-6 sm:w-10 bg-white/10" />
          <div className="flex items-center gap-1.5 text-[#D4AF37]"><Building2 className="w-4 h-4" /><span className="font-semibold">2. Dados da Empresa</span></div>
          <div className="h-px w-6 sm:w-10 bg-white/10 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1.5 text-zinc-500"><span className="font-medium">3. Configuração Inicial</span></div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37]"><Building2 className="w-6 h-6" /></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-light text-white">Configurar Empresa</h1>
              {token ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded-full border border-[#D4AF37]/20"><ShieldCheck className="w-3 h-3" /> Token Ativo</span> : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"><ShieldCheck className="w-3 h-3" /> Acesso Liberado</span>}
            </div>
            <p className="text-zinc-400 mt-1 text-sm">Preencha os dados do seu estabelecimento para preparar seu ambiente.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5"><span className="text-xs text-zinc-400">Nome do estabelecimento</span><input required value={formData.salonName} onChange={e => update('salonName', e.target.value)} placeholder="Ex: Salão Elegance & Estética" className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#D4AF37]" /></label>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block space-y-1.5"><span className="text-xs text-zinc-400">Cidade</span><input required value={formData.city} onChange={e => update('city', e.target.value)} placeholder="Sua cidade" className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#D4AF37]" /></label>
            <label className="block space-y-1.5"><span className="text-xs text-zinc-400">Estado (UF)</span><input required value={formData.state} onChange={e => update('state', e.target.value)} placeholder="UF" maxLength={2} className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#D4AF37] uppercase" /></label>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block space-y-1.5"><span className="text-xs text-zinc-400">Segmento</span><select required value={formData.businessSegment} onChange={e => update('businessSegment', e.target.value)} className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm text-white outline-none focus:border-[#D4AF37]"><option value="">Selecione</option><option value="Salão de Beleza">Salão de Beleza</option><option value="Barbearia">Barbearia</option><option value="Clínica de Estética">Clínica de Estética</option><option value="Estúdio">Estúdio</option><option value="Outro">Outro</option></select></label>
            <label className="block space-y-1.5"><span className="text-xs text-zinc-400">Quantidade de profissionais</span><select required value={formData.estimatedProfessionals} onChange={e => update('estimatedProfessionals', e.target.value)} className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm text-white outline-none focus:border-[#D4AF37]"><option value="">Selecione</option><option value="Apenas eu">Apenas eu</option><option value="2 a 5">2 a 5</option><option value="6 a 15">6 a 15</option><option value="16 a 30">16 a 30</option><option value="31 a 60">31 a 60</option><option value="Mais de 60">Mais de 60</option></select></label>
          </div>
          <button disabled={loading} type="submit" className="w-full h-12 mt-4 rounded-xl bg-[#D4AF37] text-black font-bold disabled:opacity-40 hover:bg-[#c49f2c] transition flex items-center justify-center gap-2 cursor-pointer">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continuar configuração'}<ArrowRight className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
}

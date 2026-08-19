import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Building2, Users, Mail, Phone, MapPin, Lock, Sparkles, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const PUBLIC_PLANS = {
  essential: { name: 'Essencial', price: 197, limit: 5 },
  professional: { name: 'Profissional', price: 397, limit: 15 },
  performance_plus: { name: 'Performance', price: 597, limit: 30 },
  multiunit: { name: 'Multiunidade', price: 897, limit: 60 },
} as const;

type PlanId = keyof typeof PUBLIC_PLANS;
type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

const cycleLabel: Record<BillingCycle, string> = { MONTHLY: 'Mensal', SEMIANNUALLY: 'Semestral', YEARLY: 'Anual' };

function priceFor(plan: PlanId, cycle: BillingCycle) {
  const monthly = PUBLIC_PLANS[plan].price;
  if (cycle === 'MONTHLY') return monthly;
  return Math.round(monthly * (cycle === 'SEMIANNUALLY' ? 6 : 12) * (cycle === 'SEMIANNUALLY' ? 0.9 : 0.85));
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryPlan = params.get('plan') as PlanId | null;
  const queryCycle = params.get('cycle') as BillingCycle | null;
  const initialPlan = queryPlan && queryPlan in PUBLIC_PLANS ? queryPlan : null;
  const initialCycle = queryCycle && ['MONTHLY', 'SEMIANNUALLY', 'YEARLY'].includes(queryCycle) ? queryCycle : 'MONTHLY';

  const [step, setStep] = useState<1 | 2 | 3>(initialPlan ? 1 : 1);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(initialPlan);
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: '', salonName: '', phone: '', email: '', city: '', state: '',
    businessSegment: '', estimatedProfessionals: '', password: '', confirmPassword: '', acceptedTerms: false,
  });

  const recommendedPlan = useMemo<PlanId>(() => {
    const count = formData.estimatedProfessionals;
    if (count === 'Apenas eu' || count === '2 a 5') return 'essential';
    if (count === '6 a 15') return 'professional';
    if (count === '16 a 30') return 'performance_plus';
    return 'multiunit';
  }, [formData.estimatedProfessionals]);

  const update = (name: string, value: string | boolean) => setFormData(prev => ({ ...prev, [name]: value }));

  const selectDiagnosis = (value: string) => {
    update('estimatedProfessionals', value);
    setSelectedPlan(null);
    setStep(3);
  };

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!formData.acceptedTerms) return toast.error('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
    if (!formData.ownerName.trim() || !formData.salonName.trim() || !formData.email.trim() || !formData.phone.trim()) return toast.error('Preencha os dados obrigatórios.');
    if (formData.password.length < 8) return toast.error('A senha deve ter pelo menos 8 caracteres.');
    if (formData.password !== formData.confirmPassword) return toast.error('As senhas não coincidem.');

    const planId = selectedPlan || recommendedPlan;
    setLoading(true);
    try {
      const email = formData.email.trim().toLowerCase();
      let firebaseUser = auth.currentUser;
      if (!firebaseUser || firebaseUser.email?.toLowerCase() !== email) {
        try {
          firebaseUser = (await createUserWithEmailAndPassword(auth, email, formData.password)).user;
        } catch (authError: any) {
          if (authError?.code !== 'auth/email-already-in-use') throw authError;
          firebaseUser = (await signInWithEmailAndPassword(auth, email, formData.password)).user;
        }
      }
      await updateProfile(firebaseUser, { displayName: formData.ownerName.trim() });

      const now = Date.now();
      const userRef = doc(db, 'users', firebaseUser.uid);
      const existing = await getDoc(userRef);
      if (existing.exists()) {
        const current = existing.data();
        if (current?.salonId && current?.role !== 'pending') throw new Error('Esta conta já está vinculada a uma empresa. Acesse o sistema para gerenciar sua assinatura.');
      }
      await setDoc(userRef, {
        id: firebaseUser.uid,
        email,
        fullName: formData.ownerName.trim(),
        name: formData.ownerName.trim(),
        phone: formData.phone.trim(),
        role: 'pending',
        salonId: null,
        onboardingStatus: 'pending_payment',
        updatedAt: now,
        ...(existing.exists() ? {} : { createdAt: now })
      }, { merge: true });

      const token = await firebaseUser.getIdToken(true);
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          salonId: `salon_${firebaseUser.uid}`,
          planId,
          billingCycle: cycle,
          ownerName: formData.ownerName.trim(),
          salonName: formData.salonName.trim(),
          phone: formData.phone.trim(),
          email,
          city: formData.city.trim(),
          state: formData.state.trim().toUpperCase(),
          businessSegment: formData.businessSegment,
          estimatedProfessionals: formData.estimatedProfessionals,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível iniciar a contratação.');
      if (!result.checkoutUrl) throw new Error('O servidor não retornou uma etapa de pagamento válida.');
      toast.success(result.requiresBillingData ? 'Cadastro iniciado. Complete os dados de faturamento para continuar.' : 'Cadastro concluído. Abrindo checkout seguro...');
      navigate(result.checkoutUrl.startsWith('/dashboard/') ? result.checkoutUrl : result.checkoutUrl, { replace: true });
      if (!result.checkoutUrl.startsWith('/')) window.location.assign(result.checkoutUrl);
    } catch (error: any) {
      console.error('[RegisterPage] Falha no cadastro:', error);
      toast.error(error?.message || 'Não foi possível concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const plan = selectedPlan ? PUBLIC_PLANS[selectedPlan] : null;
  const diagnosisPlan = PUBLIC_PLANS[recommendedPlan];

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-black to-black" />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-semibold"><Sparkles className="w-7 h-7 text-primary" /> Lumière<span className="text-primary">OS</span></Link>
          <p className="mt-3 text-xs uppercase tracking-[0.25em] text-primary">Comece sua operação em poucos minutos</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl p-6 sm:p-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            {[1, 2, 3].map(n => <div key={n} className={`h-2 flex-1 max-w-24 rounded-full ${step >= n ? 'bg-primary' : 'bg-white/10'}`} />)}
          </div>

          {step === 1 && (
            <div className="space-y-7">
              <div><h1 className="text-3xl font-light">Dados do negócio</h1><p className="text-zinc-400 mt-2">Conte o básico sobre sua operação. O restante será configurado após a confirmação do pagamento.</p></div>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  ['ownerName', 'Seu nome completo', 'João da Silva', 'text'],
                  ['salonName', 'Nome do estabelecimento', 'Studio Lumière', 'text'],
                  ['email', 'E-mail', 'voce@empresa.com', 'email'],
                  ['phone', 'WhatsApp', '(00) 00000-0000', 'text'],
                  ['city', 'Cidade', 'Fernandópolis', 'text'],
                  ['state', 'Estado', 'SP', 'text'],
                ].map(([name, label, placeholder, type]) => <label key={name} className="space-y-2"><span className="text-sm text-zinc-300">{label}</span><div className="relative"><input type={type} value={(formData as any)[name]} onChange={e => update(name, e.target.value)} placeholder={placeholder} className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 text-white outline-none focus:border-primary" required />{name === 'ownerName' ? <Building2 className="absolute right-4 top-3.5 w-5 h-5 text-zinc-600" /> : null}</div></label>)}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="space-y-2"><span className="text-sm text-zinc-300">Segmento</span><select value={formData.businessSegment} onChange={e => update('businessSegment', e.target.value)} className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 outline-none focus:border-primary" required><option value="">Selecione</option><option>Salão de Beleza</option><option>Barbearia</option><option>Clínica de Estética</option><option>Estúdio</option><option>Outro</option></select></label>
                <label className="space-y-2"><span className="text-sm text-zinc-300">Quantidade de profissionais</span><select value={formData.estimatedProfessionals} onChange={e => update('estimatedProfessionals', e.target.value)} className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 outline-none focus:border-primary" required><option value="">Selecione</option><option>Apenas eu</option><option>2 a 5</option><option>6 a 15</option><option>16 a 30</option><option>31 a 60</option><option>Mais de 60</option></select></label>
              </div>
              <button type="button" onClick={() => setStep(2)} disabled={!formData.ownerName || !formData.salonName || !formData.email || !formData.phone || !formData.businessSegment || !formData.estimatedProfessionals} className="w-full h-12 rounded-full bg-primary text-black font-bold disabled:opacity-40">Continuar <ArrowRight className="inline w-4 h-4 ml-1" /></button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7">
              <div className="flex items-center gap-3"><button onClick={() => setStep(1)} className="p-2 rounded-full hover:bg-white/5"><ArrowLeft className="w-5 h-5" /></button><div><h1 className="text-3xl font-light">Escolha como começar</h1><p className="text-zinc-400 mt-1">Já sabe o que precisa? Escolha um plano. Ainda em dúvida? Use o diagnóstico.</p></div></div>
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(PUBLIC_PLANS).map(([id, item]) => <button key={id} type="button" onClick={() => { setSelectedPlan(id as PlanId); setStep(3); }} className={`text-left rounded-2xl border p-5 transition ${selectedPlan === id ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.02] hover:border-primary/40'}`}><div className="flex justify-between items-start"><div><h3 className="font-semibold text-lg">{item.name}</h3><p className="text-2xl font-bold mt-2">R$ {item.price}<span className="text-xs text-zinc-500 font-normal">/mês</span></p></div>{id === 'professional' && <span className="text-[10px] uppercase bg-primary text-black px-2 py-1 rounded-full font-bold">Mais escolhido</span>}</div><p className="text-sm text-zinc-400 mt-3">Até {item.limit} profissionais{ id === 'multiunit' ? ' por unidade' : ''}.</p></button>)}
              </div>
              <button type="button" onClick={() => setStep(3)} className="w-full h-12 rounded-full border border-primary/40 text-primary font-semibold">Não sei qual escolher — fazer diagnóstico</button>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={submit} className="space-y-7">
              <div className="flex items-center gap-3"><button type="button" onClick={() => setStep(2)} className="p-2 rounded-full hover:bg-white/5"><ArrowLeft className="w-5 h-5" /></button><div><h1 className="text-3xl font-light">Finalize sua contratação</h1><p className="text-zinc-400 mt-1">O pagamento será feito em ambiente seguro da Asaas.</p></div></div>
              {!selectedPlan && <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5"><div className="text-xs uppercase tracking-widest text-primary font-bold">Diagnóstico Lumière</div><div className="text-xl font-semibold mt-2">Recomendação: {diagnosisPlan.name}</div><p className="text-sm text-zinc-400 mt-1">Com base no porte informado, este plano atende até {diagnosisPlan.limit} profissionais.</p><button type="button" onClick={() => setSelectedPlan(recommendedPlan)} className="mt-4 text-sm font-semibold text-primary">Aceitar recomendação →</button></div>}
              {plan && <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><div className="text-xs uppercase tracking-widest text-primary font-bold">Plano selecionado</div><div className="text-xl font-semibold mt-1">{plan.name}</div></div><div className="text-right"><div className="text-2xl font-bold">R$ {priceFor(selectedPlan!, cycle).toLocaleString('pt-BR')}</div><div className="text-xs text-zinc-500">{cycleLabel[cycle]} {cycle !== 'MONTHLY' ? `• ${cycle === 'SEMIANNUALLY' ? '10%' : '15%'} OFF` : ''}</div></div></div>}
              <div className="grid grid-cols-3 gap-2 rounded-full border border-white/10 bg-black p-1">{(['MONTHLY','SEMIANNUALLY','YEARLY'] as BillingCycle[]).map(item => <button type="button" key={item} onClick={() => setCycle(item)} className={`rounded-full py-2 text-xs font-semibold ${cycle === item ? 'bg-primary text-black' : 'text-zinc-400'}`}>{cycleLabel[item]}</button>)}</div>
              <div className="grid md:grid-cols-2 gap-4"><label className="space-y-2"><span className="text-sm text-zinc-300">Senha</span><div className="relative"><input required minLength={8} type="password" value={formData.password} onChange={e => update('password', e.target.value)} className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 pr-10 outline-none focus:border-primary" /><Lock className="absolute right-4 top-3.5 w-5 h-5 text-zinc-600" /></div></label><label className="space-y-2"><span className="text-sm text-zinc-300">Confirme a senha</span><input required minLength={8} type="password" value={formData.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 outline-none focus:border-primary" /></label></div>
              <label className="flex gap-3 items-start text-xs text-zinc-400"><input type="checkbox" checked={formData.acceptedTerms} onChange={e => update('acceptedTerms', e.target.checked)} className="mt-0.5 accent-[#D4AF37]" required /><span>Li e aceito os Termos de Uso e a Política de Privacidade do LumièreOS.</span></label>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3"><ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /><p className="text-xs text-zinc-400 leading-relaxed">Os dados do cartão não são armazenados pelo LumièreOS. O pagamento acontece diretamente no ambiente seguro do Asaas.</p></div>
              <button disabled={loading || !selectedPlan} type="submit" className="w-full h-13 rounded-full bg-primary text-black font-bold disabled:opacity-40">{loading ? 'Preparando sua conta...' : 'Continuar para pagamento'} <ArrowRight className="inline w-4 h-4 ml-1" /></button>
              <p className="text-center text-xs text-zinc-500">Já possui conta? <Link to="/login" className="text-primary hover:underline">Acessar sistema</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

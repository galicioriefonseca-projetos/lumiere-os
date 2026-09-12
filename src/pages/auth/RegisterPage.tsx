import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Building2, Lock, Sparkles, ShieldCheck, AlertCircle, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { translateAuthError } from '@/lib/auth-helpers';

const PUBLIC_PLANS = {
  essential: { name: 'Essencial', price: 197, limit: 5 },
  professional: { name: 'Gestão', price: 397, limit: 15 },
  performance_plus: { name: 'Performance', price: 597, limit: 30 },
  multiunit: { name: 'Multiunidade', price: 897, limit: 60 },
} as const;

type PlanId = keyof typeof PUBLIC_PLANS;
type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

const CYCLES: BillingCycle[] = ['MONTHLY', 'SEMIANNUALLY', 'YEARLY'];
const cycleLabel: Record<BillingCycle, string> = { MONTHLY: 'Mensal', SEMIANNUALLY: 'Semestral', YEARLY: 'Anual' };

function priceFor(plan: PlanId, cycle: BillingCycle) {
  const monthly = PUBLIC_PLANS[plan].price;
  if (cycle === 'MONTHLY') return monthly;
  return Math.round(monthly * (cycle === 'SEMIANNUALLY' ? 6 : 12) * (cycle === 'SEMIANNUALLY' ? 0.9 : 0.85));
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const rawPlan = params.get('plan') || params.get('planId');
  const rawCycle = params.get('cycle') || params.get('billingCycle');
  const initialPlan = rawPlan && rawPlan in PUBLIC_PLANS ? rawPlan as PlanId : null;
  const initialCycle = rawCycle && CYCLES.includes(rawCycle.toUpperCase() as BillingCycle) ? rawCycle.toUpperCase() as BillingCycle : 'MONTHLY';
  const planWasChosenOnLanding = Boolean(initialPlan);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(initialPlan);
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [existingAccountPrompt, setExistingAccountPrompt] = useState(false);
  const [existingSalonInfo, setExistingSalonInfo] = useState<{ salonId: string; role?: string } | null>(null);

  const [formData, setFormData] = useState({
    ownerName: '', salonName: '', phone: '', email: '', city: '', state: '',
    businessSegment: '', estimatedProfessionals: '', password: '', confirmPassword: '', acceptedTerms: false,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user?.email) return;
      setFormData(prev => ({
        ...prev,
        email: prev.email || user.email || '',
        ownerName: prev.ownerName || user.displayName || '',
      }));
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data?.salonId && data?.role !== 'pending') setExistingSalonInfo({ salonId: data.salonId, role: data.role });
        }
      } catch (error) {
        console.warn('[RegisterPage] Não foi possível verificar salão do usuário:', error);
      }
    });
    return () => unsub();
  }, []);

  const recommendedPlan = useMemo<PlanId>(() => {
    switch (formData.estimatedProfessionals) {
      case 'Apenas eu':
      case '2 a 5': return 'essential';
      case '6 a 15': return 'professional';
      case '16 a 30': return 'performance_plus';
      default: return 'multiunit';
    }
  }, [formData.estimatedProfessionals]);

  const capacityWarning = useMemo(() => {
    if (!selectedPlan || !formData.estimatedProfessionals) return null;
    const exceeds = (
      selectedPlan === 'essential' && ['6 a 15', '16 a 30', '31 a 60', 'Mais de 60'].includes(formData.estimatedProfessionals)
    ) || (
      selectedPlan === 'professional' && ['16 a 30', '31 a 60', 'Mais de 60'].includes(formData.estimatedProfessionals)
    ) || (
      selectedPlan === 'performance_plus' && ['31 a 60', 'Mais de 60'].includes(formData.estimatedProfessionals)
    );
    return exceeds ? `O plano ${PUBLIC_PLANS[selectedPlan].name} atende até ${PUBLIC_PLANS[selectedPlan].limit} profissionais. A quantidade informada pode exigir um plano superior.` : null;
  }, [selectedPlan, formData.estimatedProfessionals]);

  const update = (name: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email') setExistingAccountPrompt(false);
  };

  const isAlreadyAuthWithSameEmail = Boolean(currentUser?.email && currentUser.email.toLowerCase() === formData.email.trim().toLowerCase());

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      setCurrentUser(result.user);
      setFormData(prev => ({ ...prev, email: result.user.email || prev.email, ownerName: prev.ownerName || result.user.displayName || '' }));
      const userSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data?.salonId && data?.role !== 'pending') {
          setExistingSalonInfo({ salonId: data.salonId, role: data.role });
          toast.info('Sua conta já possui uma empresa ativa no LumièreOS.');
          return;
        }
      }
      setExistingAccountPrompt(false);
      toast.success(`Autenticado com sucesso como ${result.user.email}`);
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') toast.error(translateAuthError(error?.code, error?.message));
    } finally {
      setLoading(false);
    }
  };

  const goForwardFromBusiness = () => {
    if (!formData.ownerName || !formData.salonName || !formData.email || !formData.phone || !formData.businessSegment || !formData.estimatedProfessionals) return;
    setStep(selectedPlan ? 3 : 2);
  };

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selectedPlan) return toast.error('Selecione um plano para continuar.');
    if (!formData.acceptedTerms) return toast.error('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
    if (!formData.ownerName.trim() || !formData.salonName.trim() || !formData.email.trim() || !formData.phone.trim()) return toast.error('Preencha os dados obrigatórios.');
    if (!isAlreadyAuthWithSameEmail) {
      if (formData.password.length < 8) return toast.error('A senha deve ter pelo menos 8 caracteres.');
      if (formData.password !== formData.confirmPassword) return toast.error('As senhas não coincidem.');
    }

    setLoading(true);
    try {
      const email = formData.email.trim().toLowerCase();
      let firebaseUser = auth.currentUser;

      if (!firebaseUser || firebaseUser.email?.toLowerCase() !== email) {
        try {
          firebaseUser = (await createUserWithEmailAndPassword(auth, email, formData.password)).user;
        } catch (authError: any) {
          if (authError?.code !== 'auth/email-already-in-use') throw authError;
          try {
            firebaseUser = (await signInWithEmailAndPassword(auth, email, formData.password)).user;
          } catch {
            setExistingAccountPrompt(true);
            const error = new Error('Este e-mail já possui cadastro no LumièreOS. Faça login com a senha atual ou utilize o Google para continuar.');
            (error as any).code = 'auth/email-already-in-use';
            throw error;
          }
        }
      }

      await updateProfile(firebaseUser, { displayName: formData.ownerName.trim() });
      const now = Date.now();
      const userRef = doc(db, 'users', firebaseUser.uid);
      const existing = await getDoc(userRef);
      if (existing.exists()) {
        const current = existing.data();
        if (current?.salonId && current?.role !== 'pending') {
          setExistingSalonInfo({ salonId: current.salonId, role: current.role });
          throw new Error('Esta conta já está vinculada a uma empresa no LumièreOS. Acesse o sistema para gerenciar sua assinatura.');
        }
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
          planId: selectedPlan,
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

      if (result.requiresBillingData) {
        toast.success('Cadastro iniciado. Agora vamos completar os dados de faturamento.');
      } else {
        toast.success('Cadastro concluído. Abrindo checkout seguro...');
      }

      if (result.checkoutUrl.startsWith('/')) navigate(result.checkoutUrl, { replace: true });
      else window.location.assign(result.checkoutUrl);
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use' || error?.message?.includes('já possui cadastro') || error?.message?.includes('já está vinculada')) {
        setExistingAccountPrompt(true);
      } else {
        console.error('[RegisterPage] Falha no cadastro:', error);
        toast.error(translateAuthError(error?.code, error?.message));
      }
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
          {existingSalonInfo && (
            <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div><div className="text-sm font-semibold text-white">Sua conta já possui uma empresa ativa no LumièreOS</div><p className="text-xs text-zinc-300 mt-1">Acesse sua assinatura para gerenciar o plano.</p></div>
              <div className="flex items-center gap-2"><Link to="/dashboard/assinatura" className="px-4 py-2 rounded-xl bg-primary text-black text-xs font-bold">Minha Assinatura</Link><Link to="/dashboard" className="px-3 py-2 rounded-xl border border-white/10 text-white text-xs">Ir para o Painel</Link></div>
            </div>
          )}

          {existingAccountPrompt && !existingSalonInfo && (
            <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <div className="flex items-start gap-3"><AlertCircle className="w-5 h-5 text-amber-400 shrink-0" /><div className="flex-1"><div className="text-sm font-semibold">Este e-mail já possui cadastro</div><p className="text-xs text-zinc-300 mt-1">Faça login com a senha atual ou utilize o Google para continuar.</p><div className="mt-3 flex gap-3"><button type="button" onClick={handleGoogleAuth} disabled={loading} className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold">Entrar com Google</button><Link to={`/login?email=${encodeURIComponent(formData.email)}`} className="px-4 py-2 rounded-xl bg-primary text-black text-xs font-bold"><LogIn className="inline w-3.5 h-3.5 mr-1" />Fazer Login</Link></div></div></div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mb-8">{[1,2,3].map(n => <div key={n} className={`h-2 flex-1 max-w-24 rounded-full ${step >= n ? 'bg-primary' : 'bg-white/10'}`} />)}</div>

          {step === 1 && (
            <div className="space-y-7">
              <div><h1 className="text-3xl font-light">Dados do negócio</h1><p className="text-zinc-400 mt-2">Informe os dados básicos do estabelecimento. O plano escolhido na página anterior será mantido.</p></div>
              {planWasChosenOnLanding && plan && <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between gap-4"><div><div className="text-[10px] uppercase tracking-widest text-primary font-bold">Plano escolhido</div><div className="text-xl font-semibold mt-1">{plan.name}</div></div><div className="text-right"><div className="text-xl font-bold">R$ {priceFor(selectedPlan!, cycle).toLocaleString('pt-BR')}</div><div className="text-xs text-zinc-500">{cycleLabel[cycle]}</div></div></div>}
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  ['ownerName','Seu nome completo','João da Silva','text'],['salonName','Nome do estabelecimento','Studio Lumière','text'],['email','E-mail','voce@empresa.com','email'],['phone','WhatsApp','(00) 00000-0000','text'],['city','Cidade','Fernandópolis','text'],['state','Estado','SP','text'],
                ].map(([name,label,placeholder,type]) => <label key={name} className="space-y-2"><span className="text-sm text-zinc-300">{label}</span><input type={type} value={(formData as any)[name]} onChange={e => update(name,e.target.value)} placeholder={placeholder} className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 text-white outline-none focus:border-primary" required /></label>)}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="space-y-2"><span className="text-sm text-zinc-300">Segmento</span><select value={formData.businessSegment} onChange={e => update('businessSegment',e.target.value)} className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 outline-none focus:border-primary" required><option value="">Selecione</option><option>Salão de Beleza</option><option>Barbearia</option><option>Clínica de Estética</option><option>Estúdio</option><option>Outro</option></select></label>
                <label className="space-y-2"><span className="text-sm text-zinc-300">Quantidade de profissionais</span><select value={formData.estimatedProfessionals} onChange={e => update('estimatedProfessionals',e.target.value)} className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 outline-none focus:border-primary" required><option value="">Selecione</option><option>Apenas eu</option><option>2 a 5</option><option>6 a 15</option><option>16 a 30</option><option>31 a 60</option><option>Mais de 60</option></select>{capacityWarning && <p className="text-xs text-amber-300 mt-2">{capacityWarning}</p>}</label>
              </div>
              <button type="button" onClick={goForwardFromBusiness} disabled={!formData.ownerName || !formData.salonName || !formData.email || !formData.phone || !formData.businessSegment || !formData.estimatedProfessionals} className="w-full h-12 rounded-full bg-primary text-black font-bold disabled:opacity-40">Continuar <ArrowRight className="inline w-4 h-4 ml-1" /></button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7">
              <div className="flex items-center gap-3"><button type="button" onClick={() => setStep(1)} className="p-2 rounded-full hover:bg-white/5"><ArrowLeft className="w-5 h-5" /></button><div><h1 className="text-3xl font-light">Escolha como começar</h1><p className="text-zinc-400 mt-1">Selecione o plano mais adequado para o porte informado.</p></div></div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="text-xs uppercase tracking-widest text-primary font-bold">Recomendação</div><div className="text-xl font-semibold mt-2">{diagnosisPlan.name}</div><p className="text-sm text-zinc-400 mt-1">Até {diagnosisPlan.limit} profissionais.</p></div>
              <div className="grid md:grid-cols-2 gap-4">{Object.entries(PUBLIC_PLANS).map(([id,item]) => <button key={id} type="button" onClick={() => { setSelectedPlan(id as PlanId); setStep(3); }} className={`text-left rounded-2xl border p-5 transition ${selectedPlan === id ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/[0.02] hover:border-primary/40'}`}><h3 className="font-semibold text-lg">{item.name}</h3><p className="text-2xl font-bold mt-2">R$ {item.price}<span className="text-xs text-zinc-500 font-normal">/mês</span></p><p className="text-sm text-zinc-400 mt-3">Até {item.limit} profissionais.</p></button>)}</div>
              <button type="button" onClick={() => { setSelectedPlan(recommendedPlan); setStep(3); }} className="w-full h-12 rounded-full border border-primary/40 text-primary font-semibold">Usar recomendação: {diagnosisPlan.name}</button>
            </div>
          )}

          {step === 3 && plan && (
            <form onSubmit={submit} className="space-y-7">
              <div className="flex items-center gap-3"><button type="button" onClick={() => setStep(planWasChosenOnLanding ? 1 : 2)} className="p-2 rounded-full hover:bg-white/5"><ArrowLeft className="w-5 h-5" /></button><div><h1 className="text-3xl font-light">Finalize sua contratação</h1><p className="text-zinc-400 mt-1">Plano {plan.name} • R$ {priceFor(selectedPlan!, cycle).toLocaleString('pt-BR')} • {cycleLabel[cycle]}</p></div></div>
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between"><div><div className="text-xs uppercase tracking-widest text-primary font-bold">Plano selecionado</div><div className="text-xl font-semibold mt-1">{plan.name}</div></div><div className="text-right"><div className="text-2xl font-bold">R$ {priceFor(selectedPlan!, cycle).toLocaleString('pt-BR')}</div><div className="text-xs text-zinc-500">{cycleLabel[cycle]}{cycle !== 'MONTHLY' ? ` • ${cycle === 'SEMIANNUALLY' ? '10%' : '15%'} OFF` : ''}</div></div></div>
              <div className="grid grid-cols-3 gap-2 rounded-full border border-white/10 bg-black p-1">{CYCLES.map(item => <button type="button" key={item} onClick={() => setCycle(item)} className={`rounded-full py-2 text-xs font-semibold ${cycle === item ? 'bg-primary text-black' : 'text-zinc-400'}`}>{cycleLabel[item]}</button>)}</div>
              {isAlreadyAuthWithSameEmail ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3"><Check className="w-5 h-5 text-emerald-400" /><div><div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Autenticado com sucesso</div><div className="text-sm text-white">{currentUser?.email}</div></div></div> : <div className="space-y-4"><div className="flex items-center justify-between"><span className="text-sm text-zinc-300 font-medium">Defina sua senha de acesso</span><button type="button" onClick={handleGoogleAuth} disabled={loading} className="text-xs text-primary hover:underline">Autenticar com Google</button></div><div className="grid md:grid-cols-2 gap-4"><label className="space-y-2"><span className="text-xs text-zinc-400">Senha</span><div className="relative"><input required minLength={8} type="password" value={formData.password} onChange={e => update('password',e.target.value)} placeholder="Mínimo 8 caracteres" className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 pr-10 outline-none focus:border-primary" /><Lock className="absolute right-4 top-3.5 w-5 h-5 text-zinc-600" /></div></label><label className="space-y-2"><span className="text-xs text-zinc-400">Confirme a senha</span><input required minLength={8} type="password" value={formData.confirmPassword} onChange={e => update('confirmPassword',e.target.value)} placeholder="Repita sua senha" className="w-full h-12 rounded-xl border border-white/10 bg-black px-4 outline-none focus:border-primary" /></label></div></div>}
              <label className="flex gap-3 items-start text-xs text-zinc-400"><input type="checkbox" checked={formData.acceptedTerms} onChange={e => update('acceptedTerms',e.target.checked)} className="mt-0.5 accent-[#D4AF37]" required /><span>Li e aceito os Termos de Uso e a Política de Privacidade do LumièreOS.</span></label>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3"><ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /><p className="text-xs text-zinc-400 leading-relaxed">Os dados do cartão não são armazenados pelo LumièreOS. O pagamento acontece diretamente no ambiente seguro do Asaas.</p></div>
              <button disabled={loading} type="submit" className="w-full h-13 rounded-full bg-primary text-black font-bold disabled:opacity-40 hover:bg-primary/90 transition flex items-center justify-center gap-2">{loading ? 'Preparando sua conta...' : 'Continuar para pagamento'} <ArrowRight className="inline w-4 h-4 ml-1" /></button>
              <p className="text-center text-xs text-zinc-500">Já possui conta? <Link to="/login" className="text-primary hover:underline">Acessar sistema</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

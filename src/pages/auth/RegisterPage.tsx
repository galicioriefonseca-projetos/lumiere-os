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

  // Compatibilidade com os dois formatos usados atualmente pela navegação pública:
  // /cadastro?plan=...&cycle=... e /cadastro?planId=...&billingCycle=...
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
      setFormData(prev => ({ ...prev, email: prev.email || user.email || '' }));
    });
    return unsub;
  }, []);

  const selectedPlanData = selectedPlan ? PUBLIC_PLANS[selectedPlan] : null;
  const currentPrice = selectedPlan ? priceFor(selectedPlan, cycle) : 0;

  const selectPlan = (plan: PlanId) => {
    setSelectedPlan(plan);
    setStep(2);
  };

  const goToCheckout = async () => {
    if (!selectedPlan) {
      toast.error('Escolha um plano para continuar.');
      setStep(1);
      return;
    }

    if (!formData.ownerName || !formData.salonName || !formData.phone || !formData.email || !formData.city || !formData.state) {
      toast.error('Preencha os dados obrigatórios para continuar.');
      return;
    }

    if (!formData.acceptedTerms) {
      toast.error('É necessário aceitar os termos para continuar.');
      return;
    }

    setLoading(true);
    try {
      let firebaseUser = currentUser;
      if (!firebaseUser) {
        if (!formData.password || formData.password.length < 6) {
          toast.error('A senha precisa ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          toast.error('As senhas não conferem.');
          setLoading(false);
          return;
        }
        const credential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        firebaseUser = credential.user;
        await updateProfile(firebaseUser, { displayName: formData.ownerName });
      }

      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          planId: selectedPlan,
          billingCycle: cycle,
          ownerName: formData.ownerName,
          salonName: formData.salonName,
          phone: formData.phone,
          email: formData.email,
          city: formData.city,
          state: formData.state,
          businessSegment: formData.businessSegment,
          estimatedProfessionals: formData.estimatedProfessionals,
          professionalLimit: selectedPlanData?.limit,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Não foi possível iniciar o checkout.');

      if (result.requiresBillingData) {
        navigate('/dashboard/dados-faturamento');
        return;
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      navigate('/aguardando-pagamento');
    } catch (error: any) {
      console.error('[Register] checkout error', error);
      toast.error(translateAuthError(error) || error.message || 'Não foi possível concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = planWasChosenOnLanding && selectedPlanData
    ? `Comece com o plano ${selectedPlanData.name}`
    : 'Escolha como deseja usar o LumiereOS';

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-wide">LumiereOS</Link>
          <Link to="/login" className="text-sm text-neutral-400 hover:text-white">Já tenho uma conta</Link>
        </div>

        <div className="mb-8 text-center">
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[#D4AF37]">Cadastro</p>
          <h1 className="text-3xl font-semibold">{pageTitle}</h1>
          <p className="mt-2 text-sm text-neutral-400">
            {planWasChosenOnLanding ? 'Agora vamos apenas cadastrar os dados necessários para liberar o checkout.' : 'Escolha um plano ou descubra qual combina melhor com a operação.'}
          </p>
        </div>

        {!planWasChosenOnLanding && step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(PUBLIC_PLANS).map(([id, plan]) => (
              <button key={id} onClick={() => selectPlan(id as PlanId)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition hover:border-[#D4AF37]/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  <span className="text-lg font-semibold text-[#D4AF37]">R$ {plan.price}/mês</span>
                </div>
                <p className="mt-3 text-sm text-neutral-400">Plano com ferramentas progressivamente mais completas para operação, gestão, inteligência e múltiplas unidades.</p>
                <span className="mt-5 inline-flex items-center text-sm text-[#D4AF37]">Continuar <ArrowRight className="ml-2 h-4 w-4" /></span>
              </button>
            ))}
          </div>
        )}

        {step >= 2 && selectedPlanData && (
          <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">Plano escolhido</p>
                <h2 className="mt-1 text-2xl font-semibold">{selectedPlanData.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-[#D4AF37]">R$ {currentPrice}</p>
                <p className="text-xs text-neutral-500">{cycleLabel[cycle]}</p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2">
              {CYCLES.map(c => (
                <button key={c} type="button" onClick={() => setCycle(c)} className={`rounded-xl border px-3 py-2 text-sm ${cycle === c ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-neutral-400'}`}>
                  {cycleLabel[c]}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['ownerName', 'Nome do responsável', 'text'],
                ['salonName', 'Nome do negócio', 'text'],
                ['phone', 'WhatsApp / telefone', 'tel'],
                ['email', 'E-mail', 'email'],
                ['city', 'Cidade', 'text'],
                ['state', 'Estado', 'text'],
                ['businessSegment', 'Segmento', 'text'],
                ['estimatedProfessionals', 'Tamanho aproximado da equipe', 'text'],
              ].map(([key, label, type]) => (
                <label key={key} className="block text-sm text-neutral-300">
                  {label}
                  <input type={type} value={(formData as any)[key]} onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-[#D4AF37]" />
                </label>
              ))}
            </div>

            {!currentUser && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-neutral-300">Senha<input type="password" value={formData.password} onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3" /></label>
                <label className="text-sm text-neutral-300">Confirmar senha<input type="password" value={formData.confirmPassword} onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3" /></label>
              </div>
            )}

            <label className="mt-5 flex items-start gap-3 text-sm text-neutral-400">
              <input type="checkbox" checked={formData.acceptedTerms} onChange={e => setFormData(prev => ({ ...prev, acceptedTerms: e.target.checked }))} className="mt-1" />
              <span>Concordo com os termos de uso e política de privacidade.</span>
            </label>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              {!planWasChosenOnLanding && <button type="button" onClick={() => setStep(1)} className="inline-flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-sm text-neutral-300"><ArrowLeft className="mr-2 h-4 w-4" /> Trocar plano</button>}
              <button type="button" disabled={loading} onClick={goToCheckout} className="inline-flex flex-1 items-center justify-center rounded-full bg-[#D4AF37] px-6 py-3 font-semibold text-black disabled:opacity-50">
                {loading ? 'Preparando checkout...' : <>Continuar para pagamento <ArrowRight className="ml-2 h-4 w-4" /></>}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500"><ShieldCheck className="h-4 w-4" /> Os dados de pagamento são tratados no checkout seguro.</div>
          </div>
        )}

        {step === 1 && !planWasChosenOnLanding && (
          <div className="mt-6 text-center">
            <button onClick={() => navigate('/diagnostico')} className="text-sm text-[#D4AF37] hover:underline">Não sabe qual plano escolher? Faça o diagnóstico gratuito.</button>
          </div>
        )}
      </div>
    </div>
  );
}

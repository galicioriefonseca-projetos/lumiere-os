const fs = require('fs');
fs.writeFileSync('src/pages/auth/RegisterPage.tsx', `
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { translateAuthError } from '@/lib/auth-helpers';
import { formatDocument, formatPhone } from '@/lib/formatters';

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
  
  const [step, setStep] = useState<1 | 2>(initialPlan ? 2 : 1);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(initialPlan);
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  
  const [formData, setFormData] = useState({
    ownerName: '', email: '', phone: '', document: '', password: '', confirmPassword: '', acceptedTerms: false, paymentMethod: 'CREDIT_CARD'
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
    });
    return () => unsub();
  }, []);

  const update = (name: string, value: string | boolean) => setFormData(prev => ({ ...prev, [name]: value }));

  const isAlreadyAuthWithSameEmail = Boolean(currentUser?.email && currentUser.email.toLowerCase() === formData.email.trim().toLowerCase());

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      setCurrentUser(result.user);
      setFormData(prev => ({ ...prev, email: result.user.email || prev.email, ownerName: prev.ownerName || result.user.displayName || '' }));
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') toast.error(translateAuthError(error.code));
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !formData.acceptedTerms) return;
    
    if (!isAlreadyAuthWithSameEmail) {
      if (formData.password !== formData.confirmPassword) {
        return toast.error('As senhas não coincidem.');
      }
      if (formData.password.length < 8) {
        return toast.error('A senha deve ter no mínimo 8 caracteres.');
      }
    }

    try {
      setLoading(true);
      let user = currentUser;

      if (!isAlreadyAuthWithSameEmail) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          user = cred.user;
          await updateProfile(user, { displayName: formData.ownerName });
        } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            try {
              const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
              user = cred.user;
            } catch {
              throw new Error('E-mail já está em uso e a senha informada não confere. Use "Esqueci minha senha" ou faça login com o Google.');
            }
          } else {
            throw error;
          }
        }
      }

      if (!user) throw new Error('Falha ao autenticar.');

      const token = await user.getIdToken();
      const salonId = \`salon_\${user.uid}\`;

      const checkoutResponse = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({
          salonId,
          planId: selectedPlan,
          billingCycle: cycle,
          ownerName: formData.ownerName,
          email: formData.email,
          phone: formData.phone,
          customerData: {
            document: formData.document,
            legalName: formData.ownerName,
            email: formData.email,
            mobilePhone: formData.phone,
          },
          paymentMethod: formData.paymentMethod
        })
      });

      const checkoutResult = await checkoutResponse.json().catch(() => ({}));
      if (!checkoutResponse.ok || !checkoutResult.success || !checkoutResult.checkoutUrl) {
        throw new Error(checkoutResult.error || 'Não foi possível gerar o pagamento. Tente novamente.');
      }

      toast.success('Pronto! Redirecionando para o ambiente seguro...');
      
      const targetUrl = checkoutResult.checkoutUrl;
      try {
        const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        if (!opened || opened.closed || typeof opened.closed === 'undefined') {
          window.location.assign(targetUrl);
        }
      } catch {
        window.location.assign(targetUrl);
      }

    } catch (error: any) {
      const msg = error.message || translateAuthError(error.code);
      toast.error(msg);
      if (error.code === 'auth/popup-closed-by-user') return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#0d0d12]/90 border border-white/10 p-6 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
        
        {step === 1 && (
          <div className="space-y-7">
            <div>
              <h1 className="text-3xl font-light">Escolha como começar</h1>
              <p className="text-zinc-400 mt-1">Selecione o plano mais adequado para o seu negócio.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(PUBLIC_PLANS).map(([id, item]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setSelectedPlan(id as PlanId); setStep(2); }}
                  className={\`text-left rounded-2xl border p-5 transition \${selectedPlan === id ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.02] hover:border-[#D4AF37]/40'}\`}
                >
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  <p className="text-2xl font-bold mt-2">R$ {item.price}<span className="text-xs text-zinc-500 font-normal">/mês</span></p>
                  <p className="text-sm text-zinc-400 mt-3">Até {item.limit} profissionais.</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedPlan && (
          <form onSubmit={submit} className="space-y-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep(1)} className="p-2 rounded-full hover:bg-white/5">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-light">Ative sua assinatura</h1>
                <p className="text-zinc-400 mt-1">Crie sua conta para começar.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-5">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[#D4AF37] font-bold">Plano escolhido</div>
                  <div className="text-xl font-semibold mt-1">{PUBLIC_PLANS[selectedPlan].name}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">R$ {priceFor(selectedPlan, cycle).toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-zinc-500">{cycleLabel[cycle]}{cycle !== 'MONTHLY' ? \` • \${cycle === 'SEMIANNUALLY' ? '10%' : '15%'} OFF\` : ''}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-full border border-white/10 bg-black p-1">
                {CYCLES.map(item => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setCycle(item)}
                    className={\`rounded-full py-1.5 text-xs font-semibold \${cycle === item ? 'bg-[#D4AF37] text-black' : 'text-zinc-400'}\`}
                  >
                    {cycleLabel[item]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs text-zinc-400">Nome completo</span>
                <input required value={formData.ownerName} onChange={e => update('ownerName', e.target.value)} placeholder="Seu nome" className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm outline-none focus:border-[#D4AF37]" />
              </label>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs text-zinc-400">E-mail</span>
                  <input required type="email" value={formData.email} onChange={e => update('email', e.target.value)} placeholder="voce@email.com" className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm outline-none focus:border-[#D4AF37]" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-zinc-400">WhatsApp</span>
                  <input required value={formData.phone} onChange={e => update('phone', formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm outline-none focus:border-[#D4AF37]" />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs text-zinc-400">CPF ou CNPJ</span>
                  <input required value={formData.document} onChange={e => update('document', formatDocument(e.target.value))} placeholder="000.000.000-00" className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm outline-none focus:border-[#D4AF37]" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-zinc-400">Forma de Pagamento</span>
                  <select required value={formData.paymentMethod} onChange={e => update('paymentMethod', e.target.value)} className="w-full h-11 rounded-xl bg-black border border-white/10 px-3 text-sm outline-none focus:border-[#D4AF37]">
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto</option>
                  </select>
                </label>
              </div>
            </div>

            {isAlreadyAuthWithSameEmail ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Autenticado com sucesso</div>
                  <div className="text-sm text-white">{currentUser?.email}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300 font-medium">Defina sua senha</span>
                  <button type="button" onClick={handleGoogleAuth} disabled={loading} className="text-xs text-[#D4AF37] hover:underline">Autenticar com Google</button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="space-y-1.5">
                    <div className="relative">
                      <input required minLength={8} type="password" value={formData.password} onChange={e => update('password', e.target.value)} placeholder="Mínimo 8 caracteres" className="w-full h-11 rounded-xl border border-white/10 bg-black px-3 pr-10 text-sm outline-none focus:border-[#D4AF37]" />
                      <Lock className="absolute right-3 top-3 w-4 h-4 text-zinc-600" />
                    </div>
                  </label>
                  <label className="space-y-1.5">
                    <input required minLength={8} type="password" value={formData.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="Repita sua senha" className="w-full h-11 rounded-xl border border-white/10 bg-black px-3 text-sm outline-none focus:border-[#D4AF37]" />
                  </label>
                </div>
              </div>
            )}

            <label className="flex gap-3 items-start text-xs text-zinc-400">
              <input type="checkbox" checked={formData.acceptedTerms} onChange={e => update('acceptedTerms', e.target.checked)} className="mt-0.5 accent-[#D4AF37]" required />
              <span>Li e aceito os Termos de Uso e a Política de Privacidade do LumièreOS.</span>
            </label>

            <button disabled={loading} type="submit" className="w-full h-12 rounded-xl bg-[#D4AF37] text-black font-bold disabled:opacity-40 hover:bg-[#c49f2c] transition flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ir para o Pagamento Seguro'}
            </button>
            <p className="text-center text-xs text-zinc-500">
              Já possui conta? <Link to="/login" className="text-[#D4AF37] hover:underline">Acessar sistema</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
`);

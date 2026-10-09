import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Lock, ShieldCheck, Loader2, Sparkles, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { translateAuthError } from '@/lib/auth-helpers';
import { formatDocument, formatPhone } from '@/lib/utils';

const PUBLIC_PLANS = {
  essential: { name: 'Essencial', price: 197, limit: 5, subtitle: 'Operação, clientes e caixa básico' },
  professional: { name: 'Gestão', price: 397, limit: 15, subtitle: 'Equipes, metas, comissões e DRE', badge: 'Mais escolhido' },
  performance: { name: 'Performance', price: 597, limit: 30, subtitle: 'Gestão completa + Lumi IA 24/7', badge: 'Com Lumi IA' },
  multiunit: { name: 'Multiunidade', price: 897, limit: 60, subtitle: 'Múltiplas empresas, polos e filiais' },
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

function monthlyEquivalent(plan: PlanId, cycle: BillingCycle) {
  const monthly = PUBLIC_PLANS[plan].price;
  if (cycle === 'MONTHLY') return monthly;
  return Math.round(monthly * (cycle === 'SEMIANNUALLY' ? 0.9 : 0.85));
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
    ownerName: '',
    email: '',
    phone: '',
    document: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
    paymentMethod: 'CREDIT_CARD',
    coupon: ''
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

  const isAlreadyAuthWithSameEmail = Boolean(
    currentUser?.email && currentUser.email.toLowerCase() === formData.email.trim().toLowerCase()
  );

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      setCurrentUser(result.user);
      setFormData(prev => ({
        ...prev,
        email: result.user.email || prev.email,
        ownerName: prev.ownerName || result.user.displayName || ''
      }));
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

    let paymentWindow: Window | null = null;
    const isEmbeddedPreview = window.self !== window.top;

    try {
      setLoading(true);

      if (isEmbeddedPreview) {
        paymentWindow = window.open('about:blank', '_blank');
      }

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
      const salonId = `salon_${user.uid}`;

      const checkoutResponse = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
          paymentMethod: formData.paymentMethod || 'CREDIT_CARD'
        })
      });

      const checkoutResult = await checkoutResponse.json().catch(() => ({}));
      if (!checkoutResponse.ok || !checkoutResult.success || !checkoutResult.checkoutUrl) {
        throw new Error(checkoutResult.error || 'Não foi possível gerar o pagamento. Tente novamente.');
      }

      toast.success('Pronto! Abrindo o ambiente seguro de pagamento Asaas...');
      const targetUrl = checkoutResult.checkoutUrl;

      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.location.href = targetUrl;
      } else if (isEmbeddedPreview) {
        throw new Error('O navegador bloqueou a abertura do pagamento. Abra o LumièreOS em uma nova aba e tente novamente.');
      } else {
        window.location.assign(targetUrl);
      }

    } catch (error: any) {
      if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
      const msg = error.message || translateAuthError(error.code);
      toast.error(msg);
      if (error.code === 'auth/popup-closed-by-user') return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#171717] flex flex-col items-center justify-center p-4 py-10 selection:bg-[#B89B5E]/20">
      
      {/* Top Bar Brand & Back Link */}
      <div className="w-full max-w-xl flex items-center justify-between mb-6 px-1">
        <button 
          type="button"
          onClick={() => navigate('/')} 
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#77746D] hover:text-[#171717] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o início
        </button>

        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#171717]">
            <Sparkles className="h-3.5 w-3.5 text-[#D8C79F]" />
          </span>
          <span className="font-semibold text-sm">Lumière<span className="text-[#B89B5E]">OS</span></span>
        </div>
      </div>

      <div className="w-full max-w-xl bg-white border border-[#E5E2DC] p-6 sm:p-8 rounded-3xl shadow-lg">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#9F844A]">Passo 1 de 2</span>
              <h1 className="text-2xl sm:text-3xl font-light text-[#171717] mt-1">Escolha seu plano de gestão</h1>
              <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
                Selecione a estrutura ideal para gerenciar sua empresa e suas pessoas.
              </p>
            </div>

            {/* Cycle selector inside Step 1 */}
            <div className="grid grid-cols-3 gap-1.5 rounded-full border border-[#DDD9D1] bg-[#F4F2EE] p-1">
              {CYCLES.map(item => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setCycle(item)}
                  className={`rounded-full py-2 text-xs font-semibold transition-all ${
                    cycle === item ? 'bg-[#171717] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#171717]'
                  }`}
                >
                  {cycleLabel[item]}
                  {item !== 'MONTHLY' && (
                    <span className="ml-1 text-[9px] font-bold text-[#D8C79F]">
                      -{item === 'SEMIANNUALLY' ? '10%' : '15%'}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {(Object.entries(PUBLIC_PLANS) as [PlanId, typeof PUBLIC_PLANS[PlanId]][]).map(([id, item]) => {
                const isSelected = selectedPlan === id;
                const monthlyEq = monthlyEquivalent(id, cycle);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setSelectedPlan(id); setStep(2); }}
                    className={`relative text-left rounded-2xl border p-5 transition-all ${
                      isSelected 
                        ? 'border-[#B89B5E] bg-[#FFFDF8] ring-1 ring-[#B89B5E]/30 shadow-md' 
                        : 'border-[#E5E2DC] bg-[#FAF9F7] hover:border-[#B89B5E] hover:bg-white'
                    }`}
                  >
                    {'badge' in item && item.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#171717] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#D8C79F] mb-2">
                        <Crown className="w-2.5 h-2.5" /> {item.badge}
                      </span>
                    )}
                    <h3 className="font-semibold text-lg text-[#171717]">{item.name}</h3>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">{item.subtitle}</p>
                    <p className="text-2xl font-bold text-[#171717] mt-3">
                      R$ {monthlyEq}<span className="text-xs text-[#77746D] font-normal">/mês</span>
                    </p>
                    <p className="text-[11px] text-[#8A6D36] font-medium mt-2">
                      Capacidade: até {item.limit} colaboradores
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 text-center border-t border-[#E5E2DC] flex items-center justify-between text-xs text-[#6B6B6B]">
              <span>Em dúvida sobre qual escolher?</span>
              <button type="button" onClick={() => navigate('/diagnostico')} className="font-semibold text-[#8A6D36] hover:underline">
                Fazer diagnóstico rápido →
              </button>
            </div>
          </div>
        )}

        {step === 2 && selectedPlan && (
          <form onSubmit={submit} className="space-y-6">
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="p-2 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] hover:bg-zinc-100 text-[#171717] transition-colors"
                title="Trocar plano"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#9F844A]">Passo 2 de 2</span>
                <h1 className="text-2xl font-light text-[#171717]">Ative sua assinatura</h1>
              </div>
            </div>

            {/* Selected Plan Summary Card */}
            <div className="rounded-2xl border border-[#DCCFB3] bg-[#FFFDF8] p-5">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#8A6D36] font-bold">Plano selecionado</div>
                  <div className="text-xl font-semibold text-[#171717] mt-0.5">{PUBLIC_PLANS[selectedPlan].name}</div>
                  <button type="button" onClick={() => setStep(1)} className="text-[11px] text-[#8A6D36] underline mt-0.5">
                    Alterar plano
                  </button>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#171717]">
                    R$ {priceFor(selectedPlan, cycle).toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs text-[#6B6B6B]">
                    {cycleLabel[cycle]}{cycle !== 'MONTHLY' ? ` • ${cycle === 'SEMIANNUALLY' ? '10%' : '15%'} OFF` : ''}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-full border border-[#DDD9D1] bg-[#F4F2EE] p-1">
                {CYCLES.map(item => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setCycle(item)}
                    className={`rounded-full py-1.5 text-xs font-semibold transition-all ${
                      cycle === item ? 'bg-[#171717] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#171717]'
                    }`}
                  >
                    {cycleLabel[item]}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#44423E]">Nome completo do responsável</span>
                <input 
                  required 
                  value={formData.ownerName} 
                  onChange={e => update('ownerName', e.target.value)} 
                  placeholder="Seu nome ou razão social" 
                  className="w-full h-11 rounded-xl bg-[#FAF9F7] border border-[#D8D4CC] px-3.5 text-sm text-[#171717] placeholder:text-zinc-400 outline-none focus:border-[#B89B5E] focus:bg-white transition-colors" 
                />
              </label>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#44423E]">E-mail corporativo</span>
                  <input 
                    required 
                    type="email" 
                    value={formData.email} 
                    onChange={e => update('email', e.target.value)} 
                    placeholder="voce@empresa.com" 
                    className="w-full h-11 rounded-xl bg-[#FAF9F7] border border-[#D8D4CC] px-3.5 text-sm text-[#171717] placeholder:text-zinc-400 outline-none focus:border-[#B89B5E] focus:bg-white transition-colors" 
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#44423E]">WhatsApp com DDD</span>
                  <input 
                    required 
                    value={formData.phone} 
                    onChange={e => update('phone', formatPhone(e.target.value))} 
                    placeholder="(00) 00000-0000" 
                    className="w-full h-11 rounded-xl bg-[#FAF9F7] border border-[#D8D4CC] px-3.5 text-sm text-[#171717] placeholder:text-zinc-400 outline-none focus:border-[#B89B5E] focus:bg-white transition-colors" 
                  />
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#44423E]">CPF ou CNPJ</span>
                  <input 
                    required 
                    value={formData.document} 
                    onChange={e => update('document', formatDocument(e.target.value))} 
                    placeholder="000.000.000-00" 
                    className="w-full h-11 rounded-xl bg-[#FAF9F7] border border-[#D8D4CC] px-3.5 text-sm text-[#171717] placeholder:text-zinc-400 outline-none focus:border-[#B89B5E] focus:bg-white transition-colors" 
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#44423E]">Cupom de desconto (Opcional)</span>
                  <input 
                    value={formData.coupon || ''} 
                    onChange={e => update('coupon', e.target.value)} 
                    placeholder="Código do cupom" 
                    className="w-full h-11 rounded-xl bg-[#FAF9F7] border border-[#D8D4CC] px-3.5 text-sm text-[#171717] placeholder:text-zinc-400 outline-none focus:border-[#B89B5E] focus:bg-white transition-colors" 
                  />
                </label>
              </div>
              <div className="grid md:grid-cols-1 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#44423E]">Ambiente de Pagamento</span>
                  <div className="w-full h-11 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC] px-3.5 text-xs font-medium flex items-center gap-2 text-[#55534F]">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    Checkout Seguro Asaas
                  </div>
                </label>
              </div>
            </div>

            {isAlreadyAuthWithSameEmail ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-3.5 flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Conta conectada</div>
                  <div className="text-sm font-medium text-[#171717]">{currentUser?.email}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-3 border-t border-[#E5E2DC]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#55534F]">Crie sua senha de acesso</span>
                  <button 
                    type="button" 
                    onClick={handleGoogleAuth} 
                    disabled={loading} 
                    className="text-xs font-semibold text-[#8A6D36] hover:underline"
                  >
                    Ou entrar com Google
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="space-y-1.5">
                    <div className="relative">
                      <input 
                        required 
                        minLength={8} 
                        type="password" 
                        value={formData.password} 
                        onChange={e => update('password', e.target.value)} 
                        placeholder="Mínimo 8 caracteres" 
                        className="w-full h-11 rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] px-3.5 pr-10 text-sm text-[#171717] placeholder:text-zinc-400 outline-none focus:border-[#B89B5E] focus:bg-white transition-colors" 
                      />
                      <Lock className="absolute right-3 top-3.5 w-4 h-4 text-zinc-400" />
                    </div>
                  </label>
                  <label className="space-y-1.5">
                    <input 
                      required 
                      minLength={8} 
                      type="password" 
                      value={formData.confirmPassword} 
                      onChange={e => update('confirmPassword', e.target.value)} 
                      placeholder="Confirme sua senha" 
                      className="w-full h-11 rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] px-3.5 text-sm text-[#171717] placeholder:text-zinc-400 outline-none focus:border-[#B89B5E] focus:bg-white transition-colors" 
                    />
                  </label>
                </div>
              </div>
            )}

            <label className="flex gap-3 items-start text-xs text-[#55534F] cursor-pointer">
              <input 
                type="checkbox" 
                checked={formData.acceptedTerms} 
                onChange={e => update('acceptedTerms', e.target.checked)} 
                className="mt-0.5 accent-[#171717] rounded" 
                required 
              />
              <span>Li e concordo com os Termos de Uso e a Política de Privacidade do LumièreOS.</span>
            </label>

            <button 
              disabled={loading} 
              type="submit" 
              className="w-full h-12 rounded-xl bg-[#171717] text-white font-semibold text-sm disabled:opacity-40 hover:bg-[#2B2B2B] transition flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Prosseguir para o Pagamento Seguro'}
            </button>

            <p className="text-center text-xs text-[#6B6B6B]">
              Já possui conta ativa? <Link to="/login" className="font-semibold text-[#8A6D36] hover:underline">Entrar no painel</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

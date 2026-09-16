import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { usePlans } from '../../hooks/usePlans';
import { planCatalog } from '../../config/planPricing';
import { isRealProviderSubscription } from '../../lib/billing';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, ChevronDown, CreditCard,
  ExternalLink, FileText, Loader2, Lock, ReceiptText, RefreshCw, ShieldCheck, Sparkles,
  WalletCards, X, XCircle, Zap
} from 'lucide-react';

function formatDocument(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';
type Tab = 'overview' | 'plan' | 'payment' | 'charges' | 'documents';

const CYCLE_META: Record<BillingCycle, { label: string; short: string; discount: number }> = {
  MONTHLY: { label: 'Mensal', short: 'por mês', discount: 0 },
  SEMIANNUALLY: { label: 'Semestral', short: 'por mês no semestral', discount: 10 },
  YEARLY: { label: 'Anual', short: 'por mês no anual', discount: 15 },
};

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function date(value?: string | number | null) {
  if (!value) return 'Não informado';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Não informado' : d.toLocaleDateString('pt-BR');
}

function cyclePrice(monthly: number, cycle: BillingCycle) {
  if (cycle === 'MONTHLY') return monthly;
  const months = cycle === 'SEMIANNUALLY' ? 6 : 12;
  const discount = cycle === 'SEMIANNUALLY' ? 0.10 : 0.15;
  return Math.round(monthly * months * (1 - discount));
}

function cycleMonthlyEquivalent(monthly: number, cycle: BillingCycle) {
  return cyclePrice(monthly, cycle) / (cycle === 'MONTHLY' ? 1 : cycle === 'SEMIANNUALLY' ? 6 : 12);
}

function formatBillingMethod(method?: string) {
  if (!method) return 'Ainda não configurada';
  const m = String(method).toUpperCase();
  if (m === 'CREDIT_CARD' || m === 'CARTAO' || m === 'CARTÃO') return 'Cartão de Crédito';
  if (m === 'PIX') return 'Pix';
  if (m === 'UNDEFINED') return 'Aguardando definição';
  return method;
}

export default function SubscriptionCenterPage() {
  const navigate = useNavigate();
  const { salonData, userData, refreshUserData, isPlatformAdmin } = useAuth();
  const { plans, loading: plansLoading } = usePlans();
  const [tab, setTab] = useState<Tab>('overview');
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [savingCycle, setSavingCycle] = useState(false);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<string | null>(null);
  const [realSub, setRealSub] = useState<any>(null);
  const [realSubLoading, setRealSubLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PIX'>('CREDIT_CARD');
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showCancelHint, setShowCancelHint] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingForm, setBillingForm] = useState({
    document: '',
    legalName: '',
    email: '',
    mobilePhone: ''
  });
  const [savingBillingForm, setSavingBillingForm] = useState(false);

  const currentPlanId = salonData?.billing?.planId || salonData?.plan || 'essential';
  const currentPlan = plans.find((p: any) => p.id === currentPlanId) || planCatalog.plans.find((p: any) => p.id === currentPlanId);
  const currentMonthly = Number((currentPlan as any)?.price ?? (currentPlan as any)?.monthlyPrice ?? 0);
  const currentCycle = ((salonData?.billing?.billingCycle || 'MONTHLY') as BillingCycle);
  const activeCycle = CYCLE_META[currentCycle] ? currentCycle : 'MONTHLY';
  const currentValue = Number(salonData?.billing?.value || currentMonthly || 0);
  const canManage = Boolean(isPlatformAdmin || ['owner', 'admin', 'manager'].includes(userData?.role || ''));
  const hasRealSubscription = isRealProviderSubscription(salonData);

  useEffect(() => {
    setCycle(activeCycle);
  }, [activeCycle]);

  useEffect(() => {
    if (!salonData?.id || !canManage) return;
    const unsub = onSnapshot(query(collection(db, `salons/${salonData.id}/payments`)), snap => {
      const rows: any[] = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      rows.sort((a, b) => Number(b.dueDate || b.createdAt || 0) - Number(a.dueDate || a.createdAt || 0));
      setPayments(rows);
    });
    return () => unsub();
  }, [salonData?.id, canManage]);

  useEffect(() => {
    if (!salonData?.id || !canManage) return;
    const unsub = onSnapshot(query(collection(db, `salons/${salonData.id}/billingHistory`)), snap => {
      const rows: any[] = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      rows.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      setHistory(rows);
    });
    return () => unsub();
  }, [salonData?.id, canManage]);

  useEffect(() => {
    if (!hasRealSubscription || !salonData?.id) {
      setRealSub(null);
      return;
    }
    const load = async () => {
      setRealSubLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken(true);
        const res = await fetch(`/api/billing/real-subscription?salonId=${encodeURIComponent(salonData.id)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setRealSub(data);
      } finally {
        setRealSubLoading(false);
      }
    };
    void load();
  }, [hasRealSubscription, salonData?.id, salonData?.billing?.subscriptionId]);

  const nextDueDate = realSub?.nextDueDate || salonData?.billing?.nextDueDate;
  const status = String(realSub?.status || salonData?.billing?.status || salonData?.subscriptionStatus || '').toUpperCase();
  const statusLabel = status === 'ACTIVE' ? 'Ativa' : status === 'OVERDUE' ? 'Em atraso' : status === 'PENDING_PAYMENT' || status === 'PENDING' ? 'Pagamento pendente' : status === 'CANCELLED' ? 'Cancelada' : 'Em configuração';
  const pendingPayment = payments.find(p => ['PENDING', 'OVERDUE'].includes(String(p.status || '').toUpperCase()));

  const availablePlans = useMemo(() => plans.filter((p: any) => p.active !== false && !p.legacy && !p.customPricing && Number(p.price || 0) > 0), [plans]);

  const chosenPlanId = selectedPlanForCheckout || currentPlanId;
  const chosenPlanObj = plans.find((p: any) => p.id === chosenPlanId) || currentPlan || planCatalog.plans.find((p: any) => p.id === chosenPlanId);
  const chosenPlanMonthlyBase = Number((chosenPlanObj as any)?.price ?? (chosenPlanObj as any)?.monthlyPrice ?? 0);
  const chosenPlanMonthlyEq = cycleMonthlyEquivalent(chosenPlanMonthlyBase, cycle);
  const chosenPlanCycleTotal = cyclePrice(chosenPlanMonthlyBase, cycle);

  async function token() {
    const user = auth.currentUser;
    if (!user) throw new Error('Sessão expirada. Entre novamente.');
    return user.getIdToken(true);
  }

  function redirectToCheckout(url: string) {
    if (url.startsWith('/')) {
      navigate(url);
      return;
    }
    setPendingCheckoutUrl(url);
    toast.success('Redirecionando para o ambiente seguro do Asaas...');
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.location.assign(url);
      }
    } catch {
      window.location.assign(url);
    }
  }

  async function goToCheckout(overridePaymentMethod?: 'CREDIT_CARD' | 'PIX', customCustomerData?: any) {
    if (!salonData?.id) return;
    setUpdatingPayment(true);
    const methodToUse = overridePaymentMethod || paymentMethod;
    const planToUse = selectedPlanForCheckout || currentPlanId;

    try {
      const t = await token();
      const payload: any = { 
         salonId: salonData.id, 
         planId: planToUse,
         billingCycle: cycle,
         paymentMethod: methodToUse,
         billingType: methodToUse 
      };
      if (customCustomerData) {
        payload.customerData = customCustomerData;
      }

      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível iniciar o pagamento.');

      if (data.requiresBillingData) {
        setBillingForm({
          document: salonData?.billing?.document || (salonData as any)?.document || (salonData as any)?.cnpj || '',
          legalName: salonData?.billing?.legalName || salonData?.name || (salonData as any)?.ownerName || '',
          email: salonData?.billing?.email || (salonData as any)?.billingEmail || (salonData as any)?.ownerEmail || auth.currentUser?.email || '',
          mobilePhone: salonData?.billing?.mobilePhone || (salonData as any)?.phone || ''
        });
        setShowBillingModal(true);
        toast.info('Complete os dados de faturamento para gerar sua fatura no Asaas.');
        return;
      }

      const targetUrl = data.checkoutUrl || data.paymentUrl || data.bankSlipUrl;
      if (targetUrl) {
        setShowBillingModal(false);
        redirectToCheckout(targetUrl);
      } else {
        toast.success('Assinatura e pagamento atualizados com sucesso.');
        await refreshUserData();
      }
    } catch (e: any) {
      toast.error(e.message || 'Falha ao ir para o pagamento.');
    } finally {
      setUpdatingPayment(false);
    }
  }

  async function handleSaveBillingAndCheckout(e: React.FormEvent) {
    e.preventDefault();
    setSavingBillingForm(true);
    try {
      await goToCheckout(paymentMethod, billingForm);
    } finally {
      setSavingBillingForm(false);
    }
  }

  async function changeCycle(next: BillingCycle) {
    if (!salonData?.id) return;
    setCycle(next);

    setSavingCycle(true);
    try {
      const t = await token();
      const res = await fetch('/api/billing/change-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ salonId: salonData.id, billingCycle: next })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || `Periodicidade alterada para ${CYCLE_META[next]?.label}.`);
        await refreshUserData();
      } else {
        console.warn('Aviso ao sincronizar ciclo:', data.error);
      }
    } catch (e: any) {
      console.warn('Falha na rota change-cycle:', e);
    } finally {
      setSavingCycle(false);
    }
  }

  function selectPlan(planId: string) {
    setSelectedPlanForCheckout(planId);
    toast.success('Plano selecionado! Escolha a forma de pagamento e clique em "Ir para pagamento".');
  }

  async function updatePayment() {
    if (!salonData?.id) return;
    setUpdatingPayment(true);
    try {
      const t = await token();
      const res = await fetch('/api/billing/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ salonId: salonData.id, paymentMethod })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível atualizar a forma de pagamento.');
      if (data.authorizationUrl || data.checkoutUrl) {
        window.location.assign(data.authorizationUrl || data.checkoutUrl);
      } else {
        toast.success(data.message || 'Forma de pagamento atualizada.');
        await refreshUserData();
      }
    } catch (e: any) {
      toast.error(e.message || 'Falha ao atualizar a forma de pagamento.');
    } finally {
      setUpdatingPayment(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Visão geral', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'plan', label: 'Plano e ciclo', icon: <RefreshCw className="h-4 w-4" /> },
    { id: 'payment', label: 'Pagamento', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'charges', label: 'Cobranças', icon: <WalletCards className="h-4 w-4" /> },
    { id: 'documents', label: 'Documentos', icon: <FileText className="h-4 w-4" /> },
  ];

  if (!salonData || plansLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" /></div>;

  return (
    <div className="min-h-screen bg-background text-white pb-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF37]">LumièreOS · Financeiro</p>
              <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">Minha assinatura</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">Controle plano, periodicidade, pagamentos e documentos em um só lugar.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              <Check className="h-4 w-4" /> {statusLabel}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><p className="text-xs text-zinc-500">Plano atual</p><p className="mt-1 text-lg font-semibold">{(currentPlan as any)?.name || currentPlanId}</p></div>
            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><p className="text-xs text-zinc-500">Valor atual</p><p className="mt-1 text-lg font-semibold">{money(currentValue)} <span className="text-xs font-normal text-zinc-500">/ ciclo</span></p></div>
            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><p className="text-xs text-zinc-500">Periodicidade</p><p className="mt-1 text-lg font-semibold">{CYCLE_META[activeCycle].label}</p></div>
            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><p className="text-xs text-zinc-500">Próxima cobrança</p><p className="mt-1 text-lg font-semibold">{date(nextDueDate)}</p></div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-2">
          {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${tab === t.id ? 'bg-[#D4AF37] text-black' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}>{t.icon}{t.label}</button>)}
        </nav>

        {tab === 'overview' && (
          <section className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-zinc-500">Assinatura ativa</p><h2 className="mt-1 text-2xl font-semibold">{(currentPlan as any)?.name || 'Plano atual'}</h2></div><ShieldCheck className="h-7 w-7 text-emerald-400" /></div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs text-zinc-500">Próxima cobrança</p><p className="mt-1 font-medium">{date(nextDueDate)}</p></div>
                <div><p className="text-xs text-zinc-500">Forma de pagamento</p><p className="mt-1 font-medium">{formatBillingMethod(realSub?.billingType || salonData.billing?.paymentMethod)}</p></div>
              </div>
              {pendingPayment && <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" /><div><p className="font-medium text-amber-200">Existe uma cobrança pendente</p><p className="mt-1 text-sm text-zinc-400">A cobrança já gerada mantém suas condições originais. Alterações de ciclo valem para cobranças futuras.</p></div></div></div>}
              <div className="mt-6 flex flex-wrap gap-3">
                {(!hasRealSubscription || status !== 'ACTIVE') && (
                  <button
                    disabled={updatingPayment}
                    onClick={() => {
                      setSelectedPlanForCheckout(currentPlanId);
                      void goToCheckout();
                    }}
                    className="flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#D4AF37]/20 hover:bg-[#c49f2c] transition active:scale-95 disabled:opacity-50"
                  >
                    {updatingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Conectando ao Asaas...
                      </>
                    ) : (
                      <>
                        Ir para pagamento <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
                <button onClick={() => setTab('plan')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${hasRealSubscription && status === 'ACTIVE' ? 'bg-[#D4AF37] text-black' : 'border border-zinc-700 text-white hover:bg-zinc-900'}`}>Gerenciar plano <ArrowRight className="ml-1 inline h-4 w-4" /></button>
                <button onClick={() => setTab('payment')} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-900">Forma de pagamento</button>
              </div>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><p className="text-sm font-medium">Segurança financeira</p><div className="mt-5 space-y-4 text-sm text-zinc-400"><div className="flex gap-3"><Lock className="h-5 w-5 text-[#D4AF37]" /><span>Os dados sensíveis de cartão são processados pelo Asaas.</span></div><div className="flex gap-3"><CalendarDays className="h-5 w-5 text-[#D4AF37]" /><span>O ciclo real é sincronizado com a assinatura do gateway.</span></div><div className="flex gap-3"><ReceiptText className="h-5 w-5 text-[#D4AF37]" /><span>Cobranças e documentos ficam organizados no histórico.</span></div></div></div>
          </section>
        )}

        {tab === 'plan' && (
          <section className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#D4AF37]">Periodicidade</p>
                <h2 className="mt-1 text-2xl font-semibold">Escolha como prefere contratar</h2>
                <p className="mt-2 text-sm text-zinc-400">O valor mostrado abaixo é o equivalente mensal do ciclo. Descontos exclusivos aplicados nos ciclos semestral e anual.</p>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {(Object.keys(CYCLE_META) as BillingCycle[]).map(c => {
                  const selected = cycle === c;
                  const monthlyEq = cycleMonthlyEquivalent(chosenPlanMonthlyBase, c);
                  return (
                    <button
                      disabled={savingCycle}
                      key={c}
                      onClick={() => void changeCycle(c)}
                      className={`relative rounded-2xl border p-5 text-left transition ${
                        selected ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-black/20 hover:border-zinc-600'
                      }`}
                    >
                      {CYCLE_META[c].discount > 0 && (
                        <span className="absolute right-4 top-4 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
                          -{CYCLE_META[c].discount}%
                        </span>
                      )}
                      <p className="text-sm text-zinc-400">{CYCLE_META[c].label}</p>
                      <p className="mt-2 text-2xl font-bold">
                        {money(monthlyEq)}
                        <span className="text-xs font-normal text-zinc-500"> / mês</span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{CYCLE_META[c].short}</p>
                      {selected && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-[#D4AF37]">
                          <Check className="h-4 w-4" /> Ciclo selecionado
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {savingCycle && (
                <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Atualizando assinatura…
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <p className="text-xs uppercase tracking-widest text-[#D4AF37]">Plano</p>
              <h2 className="mt-1 text-2xl font-semibold">Mude o nível da sua operação</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {availablePlans.map((p: any) => {
                  const isSelected = (selectedPlanForCheckout || currentPlanId) === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                        isSelected ? 'border-[#D4AF37] bg-[#D4AF37]/5 ring-1 ring-[#D4AF37]/40' : 'border-zinc-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{p.name}</h3>
                            <p className="mt-1 text-xs text-zinc-500">Até {p.maxProfessionals} profissionais</p>
                          </div>
                          {p.badge && <span className="rounded-full bg-[#D4AF37]/10 px-2 py-1 text-[10px] text-[#D4AF37]">{p.badge}</span>}
                        </div>
                        <p className="mt-5 text-2xl font-bold">
                          {money(cycleMonthlyEquivalent(Number(p.price || 0), cycle))}
                          <span className="text-xs font-normal text-zinc-500"> / mês no {CYCLE_META[cycle]?.label.toLowerCase()}</span>
                        </p>
                        <ul className="mt-4 space-y-2 text-xs text-zinc-400">
                          {(p.features || []).slice(0, 6).map((f: string) => (
                            <li key={f} className="flex gap-2">
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={() => selectPlan(p.id)}
                        className={`mt-6 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          isSelected
                            ? 'bg-[#D4AF37] text-black font-bold'
                            : 'bg-white text-black hover:bg-zinc-200'
                        }`}
                      >
                        {isSelected ? 'Plano Selecionado' : 'Escolher plano'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Box de Confirmação & Ir para Pagamento */}
            <div className="rounded-3xl border border-[#D4AF37]/40 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-6 shadow-2xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-semibold text-[#D4AF37]">
                      <Sparkles className="h-3.5 w-3.5" /> Confirmar e Contratar
                    </span>
                    <span className="text-xs text-zinc-400">Defina a forma de pagamento e avance para o checkout</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    {(chosenPlanObj as any)?.name || 'Plano Selecionado'} · {CYCLE_META[cycle]?.label}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Total deste ciclo: <strong className="text-white font-semibold">{money(chosenPlanCycleTotal)}</strong> ({money(chosenPlanMonthlyEq)} / mês). Pagamento seguro processado via Asaas.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black/60 p-1.5">
                    <button
                      onClick={() => setPaymentMethod('CREDIT_CARD')}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
                        paymentMethod === 'CREDIT_CARD' ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <CreditCard className="h-4 w-4" /> Cartão
                    </button>
                    <button
                      onClick={() => setPaymentMethod('PIX')}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
                        paymentMethod === 'PIX' ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Zap className="h-4 w-4" /> Pix
                    </button>
                  </div>

                  <button
                    disabled={updatingPayment}
                    onClick={() => void goToCheckout()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-3.5 text-sm font-bold text-black shadow-lg shadow-[#D4AF37]/25 hover:bg-[#c49f2c] transition active:scale-95 disabled:opacity-50"
                  >
                    {updatingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Conectando ao checkout...
                      </>
                    ) : (
                      <>
                        Ir para pagamento <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === 'payment' && (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#D4AF37]">Pagamento</p>
                  <h2 className="mt-1 text-2xl font-semibold">Forma de pagamento</h2>
                </div>
                <CreditCard className="h-7 w-7 text-zinc-500" />
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/20 p-5">
                <p className="text-xs text-zinc-500">Plano e periodicidade</p>
                <p className="mt-1 text-lg font-semibold">{(chosenPlanObj as any)?.name || 'Plano'} · {CYCLE_META[cycle]?.label}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Total do ciclo: <strong className="text-white">{money(chosenPlanCycleTotal)}</strong> ({money(chosenPlanMonthlyEq)} / mês)
                </p>
              </div>

              <div className="mt-6">
                <p className="text-xs text-zinc-400 mb-3">Escolha a forma de pagamento desejada:</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['CREDIT_CARD', 'PIX'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`rounded-xl border p-4 text-left transition ${
                        paymentMethod === m ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-black/20 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{m === 'CREDIT_CARD' ? 'Cartão de Crédito' : 'Pix'}</p>
                        {paymentMethod === m && <Check className="h-4 w-4 text-[#D4AF37]" />}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {m === 'CREDIT_CARD' ? 'Pagamento recorrente no cartão' : 'Pagar via Pix (QRCode e Copia e Cola)'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  disabled={updatingPayment}
                  onClick={() => void goToCheckout()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-3.5 text-sm font-bold text-black shadow-lg shadow-[#D4AF37]/20 hover:bg-[#c49f2c] transition active:scale-95 disabled:opacity-50"
                >
                  {updatingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Conectando ao checkout...
                    </>
                  ) : (
                    <>
                      Ir para pagamento <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
              <div className="flex gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="font-medium">Pagamento 100% seguro via Asaas</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    O LumièreOS não armazena dados de cartão de crédito. Ao clicar em &quot;Ir para pagamento&quot;, você é levado à página oficial de checkout do Asaas para autorizar com total segurança.
                  </p>
                </div>
              </div>
              {realSubLoading && (
                <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sincronizando assinatura…
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'charges' && (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-[#D4AF37]">Financeiro</p><h2 className="mt-1 text-2xl font-semibold">Cobranças</h2></div><WalletCards className="h-7 w-7 text-zinc-500" /></div><div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-800 text-xs text-zinc-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">Método</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{payments.length === 0 ? <tr><td colSpan={5} className="px-3 py-12 text-center text-zinc-500">Nenhuma cobrança registrada ainda.</td></tr> : payments.map(p => <tr key={p.id} className="border-b border-zinc-900"><td className="px-3 py-4">{date(p.dueDate || p.createdAt)}</td><td className="px-3 py-4">{p.description || 'Mensalidade LumièreOS'}</td><td className="px-3 py-4">{p.billingType || '—'}</td><td className="px-3 py-4 font-medium">{money(Number(p.value || 0))}</td><td className="px-3 py-4"><span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs">{p.status || '—'}</span></td></tr>)}</tbody></table></div></section>
        )}

        {tab === 'documents' && (
          <section className="space-y-6"><div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-[#D4AF37]" /><div><h2 className="text-2xl font-semibold">Notas e documentos</h2><p className="mt-1 text-sm text-zinc-500">Acesse documentos associados às cobranças já emitidas.</p></div></div><div className="mt-6 space-y-3">{payments.filter(p => p.invoiceUrl || p.nfseUrl || p.nfsUrl || p.invoicePdf).length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">Nenhuma nota fiscal ou documento disponível ainda.</div> : payments.filter(p => p.invoiceUrl || p.nfseUrl || p.nfsUrl || p.invoicePdf).map(p => <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{p.description || 'Documento fiscal'}</p><p className="text-xs text-zinc-500">{date(p.dueDate || p.createdAt)} · {money(Number(p.value || 0))}</p></div><a href={p.nfseUrl || p.nfsUrl || p.invoicePdf || p.invoiceUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Abrir documento</a></div>)}</div></div><div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><h3 className="font-semibold">Histórico de alterações</h3><div className="mt-4 space-y-3">{history.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma alteração registrada.</p> : history.slice(0, 10).map(h => <div key={h.id} className="flex items-start gap-3 border-b border-zinc-900 pb-3"><Check className="mt-0.5 h-4 w-4 text-emerald-400" /><div><p className="text-sm">{h.description || h.action || 'Alteração de assinatura'}</p><p className="text-xs text-zinc-600">{date(h.timestamp)}</p></div></div>)}</div></div></section>
        )}

        <footer className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between"><span>As alterações de assinatura são sincronizadas com o gateway antes de atualizar a conta.</span><button onClick={() => setShowCancelHint(v => !v)} className="text-zinc-400 hover:text-white">Precisa cancelar?</button></footer>
        {showCancelHint && <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-zinc-300"><div className="flex gap-3"><XCircle className="h-5 w-5 text-red-400" /><div><p className="font-medium text-white">Cancelamento</p><p className="mt-1 text-zinc-400">Para evitar cancelamentos acidentais, o cancelamento deve ser confirmado pelo responsável financeiro. A assinatura e as cobranças já geradas não são apagadas automaticamente.</p></div></div></div>}
      </div>

      {/* Modal de Dados de Faturamento / CPF / CNPJ */}
      {showBillingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37]">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Dados de faturamento</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Exigidos pelo Asaas para emissão da cobrança e nota fiscal.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBillingModal(false)}
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBillingAndCheckout} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">CPF ou CNPJ do Titular *</label>
                <input
                  required
                  value={formatDocument(billingForm.document)}
                  onChange={e => setBillingForm({ ...billingForm, document: e.target.value })}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome completo ou Razão Social *</label>
                <input
                  required
                  value={billingForm.legalName}
                  onChange={e => setBillingForm({ ...billingForm, legalName: e.target.value })}
                  placeholder="Nome do titular ou da empresa"
                  className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">E-mail para recebimento das faturas *</label>
                <input
                  required
                  type="email"
                  value={billingForm.email}
                  onChange={e => setBillingForm({ ...billingForm, email: e.target.value })}
                  placeholder="financeiro@empresa.com"
                  className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Celular / WhatsApp *</label>
                <input
                  required
                  value={formatPhone(billingForm.mobilePhone)}
                  onChange={e => setBillingForm({ ...billingForm, mobilePhone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-3.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3 text-xs text-zinc-400 leading-relaxed">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>O LumièreOS não armazena dados de cartão. O pagamento é realizado diretamente na página oficial e segura do Asaas.</span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBillingModal(false)}
                  className="flex-1 h-12 rounded-xl border border-zinc-800 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
                >
                  Cancelar
                </button>
                <button
                  disabled={savingBillingForm}
                  type="submit"
                  className="flex-[1.5] h-12 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 transition disabled:opacity-50"
                >
                  {savingBillingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {savingBillingForm ? 'Preparando Asaas...' : 'Confirmar e ir para o Asaas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Banner de Redirecionamento Asaas */}
      {pendingCheckoutUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#D4AF37]/40 bg-zinc-950 p-6 md:p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37]">
              <ExternalLink className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-white">Checkout Seguro Asaas Pronto</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Sua cobrança foi gerada no Asaas. Clique no botão abaixo para abrir a página de pagamento:
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href={pendingCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-bold text-black shadow-lg shadow-[#D4AF37]/25 hover:bg-[#c49f2c] transition"
              >
                Abrir Checkout no Asaas <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => setPendingCheckoutUrl(null)}
                className="rounded-xl border border-zinc-800 px-4 py-2.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
              >
                Fechar janela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

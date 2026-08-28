import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { usePlans } from '../../hooks/usePlans';
import { planCatalog } from '../../config/planPricing';
import { isRealProviderSubscription } from '../../lib/billing';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, CalendarDays, Check, CreditCard, FileText, Loader2, Lock, ReceiptText, RefreshCw, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';

type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';
type Tab = 'overview' | 'plan' | 'payment' | 'charges' | 'documents';

const CYCLE_META: Record<BillingCycle, { label: string; discount: number; months: number }> = {
  MONTHLY: { label: 'Mensal', discount: 0, months: 1 },
  SEMIANNUALLY: { label: 'Semestral', discount: 10, months: 6 },
  YEARLY: { label: 'Anual', discount: 15, months: 12 },
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const date = (value?: string | number | null) => { if (!value) return 'Não informado'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Não informado' : d.toLocaleDateString('pt-BR'); };
function cyclePrice(monthly: number, cycle: BillingCycle) { const meta = CYCLE_META[cycle]; return cycle === 'MONTHLY' ? monthly : Math.round(monthly * meta.months * (1 - meta.discount / 100)); }

export default function SubscriptionCenterPage() {
  const { salonData, userData, refreshUserData, isPlatformAdmin } = useAuth();
  const { plans, loading: plansLoading } = usePlans();
  const [tab, setTab] = useState<Tab>('overview');
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const canManage = Boolean(isPlatformAdmin || ['owner', 'admin', 'manager'].includes(userData?.role || ''));
  const currentPlanId = salonData?.billing?.planId || salonData?.plan || 'essential';
  const currentPlan = plans.find((p: any) => p.id === currentPlanId) || planCatalog.plans.find((p: any) => p.id === currentPlanId);
  const monthlyPrice = Number((currentPlan as any)?.price ?? (currentPlan as any)?.monthlyPrice ?? 0);
  const currentCycle = String(salonData?.billing?.billingCycle || 'MONTHLY').toUpperCase() as BillingCycle;
  const activeCycle = CYCLE_META[currentCycle] ? currentCycle : 'MONTHLY';
  const currentValue = Number(salonData?.billing?.value || (activeCycle === 'MONTHLY' ? monthlyPrice : cyclePrice(monthlyPrice, activeCycle)) || 0);
  const hasRealSubscription = isRealProviderSubscription(salonData);
  const status = String(salonData?.billing?.status || salonData?.subscriptionStatus || '').toUpperCase();
  const statusLabel = status === 'ACTIVE' ? 'Ativa' : status === 'OVERDUE' ? 'Em atraso' : status === 'PENDING_PAYMENT' || status === 'PENDING' ? 'Pagamento pendente' : status === 'CANCELLED' ? 'Cancelada' : 'Em configuração';
  const nextDueDate = salonData?.billing?.nextDueDate || salonData?.billing?.nextInstallmentDueDate;

  useEffect(() => setCycle(activeCycle), [activeCycle]);
  useEffect(() => {
    if (!salonData?.id || !canManage) return;
    const unsub = onSnapshot(query(collection(db, `salons/${salonData.id}/payments`)), snap => {
      const rows: any[] = []; snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      rows.sort((a, b) => Number(b.dueDate || b.createdAt || 0) - Number(a.dueDate || a.createdAt || 0)); setPayments(rows);
    });
    return () => unsub();
  }, [salonData?.id, canManage]);
  useEffect(() => {
    if (!salonData?.id || !canManage) return;
    const unsub = onSnapshot(query(collection(db, `salons/${salonData.id}/billingHistory`)), snap => {
      const rows: any[] = []; snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      rows.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)); setHistory(rows);
    });
    return () => unsub();
  }, [salonData?.id, canManage]);

  async function openPaymentCheckout(nextCycle = cycle) {
    if (!salonData?.id) return;
    setOpeningCheckout(true);
    try {
      const user = auth.currentUser; if (!user) throw new Error('Sessão expirada. Entre novamente.');
      const token = await user.getIdToken(true);
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ salonId: salonData.id, planId: currentPlanId, billingCycle: nextCycle })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível abrir o checkout.');
      if (data.requiresBillingData && data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      if (data.checkoutUrl || data.authorizationUrl) { window.location.href = data.checkoutUrl || data.authorizationUrl; return; }
      throw new Error('O Asaas não retornou o link do checkout.');
    } catch (e: any) { toast.error(e.message || 'Falha ao abrir o checkout.'); }
    finally { setOpeningCheckout(false); }
  }

  async function openPaymentMethodCheckout() {
    if (!salonData?.id) return;
    setOpeningCheckout(true);
    try {
      const user = auth.currentUser; if (!user) throw new Error('Sessão expirada. Entre novamente.');
      const token = await user.getIdToken(true);
      const res = await fetch('/api/billing/update-payment-method', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ salonId: salonData.id, planId: currentPlanId, billingCycle: activeCycle })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível abrir o checkout.');
      if (data.authorizationUrl || data.checkoutUrl) window.location.href = data.authorizationUrl || data.checkoutUrl;
      else if (data.setupUrl) window.location.href = data.setupUrl;
      else toast.success(data.message || 'A forma de pagamento será definida pelo Asaas.');
    } catch (e: any) { toast.error(e.message || 'Falha ao abrir o checkout.'); }
    finally { setOpeningCheckout(false); }
  }

  async function changePlan(planId: string) {
    if (!salonData?.id || planId === currentPlanId) return;
    setChangingPlan(planId);
    try {
      const user = auth.currentUser; if (!user) throw new Error('Sessão expirada.');
      const token = await user.getIdToken(true);
      const res = await fetch('/api/billing/change-plan', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ salonId: salonData.id, planId, action: 'change' }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível alterar o plano.');
      await refreshUserData(); toast.success('Plano atualizado. A periodicidade atual foi preservada.'); setTab('overview');
    } catch (e: any) { toast.error(e.message || 'Falha ao alterar o plano.'); }
    finally { setChangingPlan(null); }
  }

  const availablePlans = useMemo(() => plans.filter((p: any) => p.active !== false && !p.legacy && !p.customPricing && Number(p.price || 0) > 0), [plans]);
  const pendingPayment = payments.find(p => ['PENDING', 'OVERDUE'].includes(String(p.status || '').toUpperCase()));
  const tabs = [
    { id: 'overview' as Tab, label: 'Visão geral', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'plan' as Tab, label: 'Plano e ciclo', icon: <RefreshCw className="h-4 w-4" /> },
    { id: 'payment' as Tab, label: 'Pagamento', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'charges' as Tab, label: 'Cobranças', icon: <WalletCards className="h-4 w-4" /> },
    { id: 'documents' as Tab, label: 'Documentos', icon: <FileText className="h-4 w-4" /> },
  ];

  if (!salonData || plansLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" /></div>;
  return <div className="min-h-screen bg-background text-white pb-12"><div className="mx-auto max-w-6xl space-y-6">
    <header className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-6 md:p-8 shadow-2xl">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-[#D4AF37]">LumièreOS · Financeiro</p><h1 className="mt-2 text-3xl md:text-4xl font-semibold">Minha assinatura</h1><p className="mt-2 text-sm text-zinc-400">Plano, ciclo, pagamentos e documentos em um só lugar.</p></div><div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300"><Check className="h-4 w-4" />{statusLabel}</div></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><p className="text-xs text-zinc-500">Plano atual</p><p className="mt-1 text-lg font-semibold">{(currentPlan as any)?.name || currentPlanId}</p></div><div className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><p className="text-xs text-zinc-500">Valor</p><p className="mt-1 text-lg font-semibold">{money(currentValue)}</p></div><div className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><p className="text-xs text-zinc-500">Ciclo</p><p className="mt-1 text-lg font-semibold">{CYCLE_META[activeCycle].label}</p></div><div className="rounded-2xl border border-zinc-800 bg-black/30 p-4"><p className="text-xs text-zinc-500">Próxima cobrança</p><p className="mt-1 text-lg font-semibold">{date(nextDueDate)}</p></div></div>
    </header>
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-2">{tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${tab === t.id ? 'bg-[#D4AF37] text-black' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}>{t.icon}{t.label}</button>)}</nav>

    {tab === 'overview' && <section className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]"><div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><p className="text-sm text-zinc-500">Assinatura</p><h2 className="mt-1 text-2xl font-semibold">{(currentPlan as any)?.name || currentPlanId}</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-zinc-500">Próxima cobrança</p><p className="mt-1 font-medium">{date(nextDueDate)}</p></div><div><p className="text-xs text-zinc-500">Forma de pagamento</p><p className="mt-1 font-medium">{salonData.billing?.paymentMethod && salonData.billing.paymentMethod !== 'UNDEFINED' ? salonData.billing.paymentMethod : 'Escolhida no Asaas'}</p></div></div>{pendingPayment && <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200"><AlertTriangle className="mr-2 inline h-4 w-4" />Existe uma cobrança pendente. O pagamento é concluído no checkout seguro do Asaas.</div>}<div className="mt-6 flex flex-wrap gap-3"><button onClick={() => setTab('plan')} className="rounded-xl bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-black">Gerenciar plano <ArrowRight className="ml-1 inline h-4 w-4" /></button><button onClick={() => setTab('payment')} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm">Pagamento</button></div></div><div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><p className="font-medium">Pagamento seguro</p><div className="mt-5 space-y-4 text-sm text-zinc-400"><div className="flex gap-3"><Lock className="h-5 w-5 text-[#D4AF37]" />O cartão nunca precisa ser armazenado pelo LumièreOS.</div><div className="flex gap-3"><CreditCard className="h-5 w-5 text-[#D4AF37]" />A escolha entre Pix e cartão acontece no checkout do Asaas.</div><div className="flex gap-3"><ReceiptText className="h-5 w-5 text-[#D4AF37]" />O status financeiro é atualizado pelos Webhooks do Asaas.</div></div></div></section>}

    {tab === 'plan' && <section className="space-y-6"><div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><p className="text-xs uppercase tracking-widest text-[#D4AF37]">Periodicidade</p><h2 className="mt-1 text-2xl font-semibold">Escolha o ciclo da assinatura</h2><p className="mt-2 text-sm text-zinc-400">Aqui você escolhe apenas o ciclo. A forma de pagamento e o parcelamento são definidos depois, dentro do checkout seguro do Asaas.</p><div className="mt-6 grid gap-3 md:grid-cols-3">{(Object.keys(CYCLE_META) as BillingCycle[]).map(c => { const selected = cycle === c; const total = cyclePrice(monthlyPrice, c); const equivalent = total / CYCLE_META[c].months; return <button key={c} onClick={() => setCycle(c)} className={`relative rounded-2xl border p-5 text-left ${selected ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 bg-black/20 hover:border-zinc-600'}`}>{CYCLE_META[c].discount > 0 && <span className="absolute right-4 top-4 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">-{CYCLE_META[c].discount}%</span>}<p className="text-sm text-zinc-400">{CYCLE_META[c].label}</p><p className="mt-2 text-2xl font-bold">{money(equivalent)}<span className="text-xs font-normal text-zinc-500"> / mês equivalente</span></p><p className="mt-2 text-xs text-zinc-500">Total do ciclo: {money(total)}</p>{selected && <div className="mt-4 flex items-center gap-2 text-xs text-[#D4AF37]"><Check className="h-4 w-4" />Selecionado</div>}</button>})}</div><button disabled={openingCheckout} onClick={() => void openPaymentCheckout(cycle)} className="mt-6 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black">{openingCheckout ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <>Continuar para pagamento <ArrowRight className="ml-1 inline h-4 w-4" /></>}</button></div>
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><p className="text-xs uppercase tracking-widest text-[#D4AF37]">Plano</p><h2 className="mt-1 text-2xl font-semibold">Escolha o nível da sua operação</h2><div className="mt-5 grid gap-4 lg:grid-cols-3">{availablePlans.map((p: any) => { const selected = p.id === currentPlanId; return <div key={p.id} className={`rounded-2xl border p-5 ${selected ? 'border-[#D4AF37]/60 bg-[#D4AF37]/5' : 'border-zinc-800'}`}><h3 className="font-semibold">{p.name}</h3><p className="mt-1 text-xs text-zinc-500">Até {p.maxProfessionals} profissionais</p><p className="mt-5 text-2xl font-bold">{money(Number(p.price || 0))}<span className="text-xs font-normal text-zinc-500"> / mês</span></p><ul className="mt-4 space-y-2 text-xs text-zinc-400">{(p.features || []).slice(0, 6).map((f: string) => <li key={f} className="flex gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" />{f}</li>)}</ul><button disabled={selected || changingPlan !== null} onClick={() => void changePlan(p.id)} className="mt-5 w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black">{changingPlan === p.id ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : selected ? 'Plano atual' : 'Escolher plano'}</button></div>})}</div></div></section>}

    {tab === 'payment' && <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><p className="text-xs uppercase tracking-widest text-[#D4AF37]">Pagamento</p><h2 className="mt-1 text-2xl font-semibold">Configure pelo checkout</h2><p className="mt-3 text-sm leading-6 text-zinc-400">O LumièreOS não pede nem armazena os dados do cartão e não força uma forma de pagamento. Ao continuar, o Asaas apresenta as formas habilitadas para a contratação, como Pix e cartão de crédito.</p><div className="mt-6 rounded-2xl border border-zinc-800 bg-black/20 p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-400" /><div><p className="font-medium">Checkout Asaas</p><p className="text-sm text-zinc-500">Escolha a forma de pagamento e, quando aplicável, o número de parcelas diretamente no Asaas.</p></div></div></div><button disabled={openingCheckout} onClick={() => void openPaymentMethodCheckout()} className="mt-6 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black">{openingCheckout ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <>Atualizar forma de pagamento <ArrowRight className="ml-1 inline h-4 w-4" /></>}</button></div><div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><p className="font-medium">O que acontece no Asaas?</p><div className="mt-5 space-y-4 text-sm text-zinc-400"><p>1. O cliente é levado para a página segura do Asaas.</p><p>2. Escolhe Pix ou cartão, conforme as opções disponíveis.</p><p>3. Se o ciclo permitir parcelamento, o Asaas mostra as parcelas.</p><p>4. O LumièreOS só considera o pagamento confirmado após o Webhook do Asaas.</p></div></div></section>}

    {tab === 'charges' && <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-[#D4AF37]">Financeiro</p><h2 className="mt-1 text-2xl font-semibold">Cobranças</h2></div><WalletCards className="h-7 w-7 text-zinc-500" /></div><div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-800 text-xs text-zinc-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">Método</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{payments.length === 0 ? <tr><td colSpan={5} className="px-3 py-12 text-center text-zinc-500">Nenhuma cobrança registrada ainda.</td></tr> : payments.map(p => <tr key={p.id} className="border-b border-zinc-900"><td className="px-3 py-4">{date(p.dueDate || p.createdAt)}</td><td className="px-3 py-4">{p.description || 'Mensalidade LumièreOS'}</td><td className="px-3 py-4">{p.billingType || '—'}</td><td className="px-3 py-4 font-medium">{money(Number(p.value || 0))}</td><td className="px-3 py-4">{p.status || '—'}</td></tr>)}</tbody></table></div></section>}

    {tab === 'documents' && <section className="space-y-6"><div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-[#D4AF37]" /><div><h2 className="text-2xl font-semibold">Notas e documentos</h2><p className="mt-1 text-sm text-zinc-400">Os documentos fiscais e comprovantes disponíveis ficam vinculados ao histórico financeiro.</p></div></div><div className="mt-6 space-y-3">{history.length === 0 ? <p className="rounded-2xl border border-zinc-800 p-5 text-sm text-zinc-500">Nenhum documento registrado ainda.</p> : history.map(item => <div key={item.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 p-4"><div><p className="font-medium">{item.description || 'Documento financeiro'}</p><p className="text-xs text-zinc-500">{date(item.timestamp || item.createdAt)}</p></div>{item.invoiceUrl && <a href={item.invoiceUrl} target="_blank" rel="noreferrer" className="text-sm text-[#D4AF37]">Abrir</a>}</div>)}</div></div></section>}
  </div></div>;
}

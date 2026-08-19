import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';

function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão expirada. Entre novamente para continuar.');
  return user.getIdToken(true);
}

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

export default function BillingCustomerPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const salonId = params.get('salonId') || '';
  const planId = params.get('planId') || '';
  const billingCycle = (params.get('billingCycle') || 'MONTHLY').toUpperCase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({ document: '', legalName: '', email: '', mobilePhone: '' });

  useEffect(() => {
    if (!salonId || !planId || !['MONTHLY', 'SEMIANNUALLY', 'YEARLY'].includes(billingCycle)) {
      toast.error('Dados da contratação não encontrados.');
      navigate('/planos', { replace: true });
      return;
    }
    void (async () => {
      try {
        const token = await getIdToken();
        const response = await fetch(`/api/billing/customer-data?salonId=${encodeURIComponent(salonId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os dados de faturamento.');
        setData({ document: result.data?.document || '', legalName: result.data?.legalName || '', email: result.data?.email || '', mobilePhone: result.data?.mobilePhone || '' });
      } catch (error: any) {
        toast.error(error.message || 'Erro ao carregar os dados.');
      } finally {
        setLoading(false);
      }
    })();
  }, [salonId, planId, billingCycle, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const token = await getIdToken();
      const customerResponse = await fetch('/api/billing/customer-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ salonId, ...data })
      });
      const customerResult = await customerResponse.json().catch(() => ({}));
      if (!customerResponse.ok) throw new Error(customerResult.error || 'Não foi possível salvar os dados de faturamento.');

      const checkoutResponse = await fetch('/api/billing/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ salonId, planId, billingCycle, customerData: data })
      });
      const checkoutResult = await checkoutResponse.json().catch(() => ({}));
      if (!checkoutResponse.ok || !checkoutResult.success || !checkoutResult.checkoutUrl) throw new Error(checkoutResult.error || 'Não foi possível gerar o pagamento.');

      toast.success('Dados de faturamento salvos. Abrindo pagamento seguro...');
      window.location.assign(checkoutResult.checkoutUrl);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao continuar para o pagamento.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background text-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>;

  return (
    <div className="min-h-screen bg-background text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl">
        <button type="button" onClick={() => navigate('/planos')} className="text-xs text-zinc-500 hover:text-white flex items-center gap-2 mb-6"><ArrowLeft className="w-4 h-4" /> Voltar para planos</button>
        <div className="flex items-start gap-3 mb-6"><div className="p-3 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37]"><CreditCard className="w-6 h-6" /></div><div><h1 className="text-xl font-bold">Complete o cadastro de faturamento</h1><p className="text-sm text-zinc-400 mt-1">Esses dados identificam o responsável pela cobrança na Asaas. O cartão será informado no ambiente seguro da Asaas.</p></div></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-zinc-400 mb-1.5">CPF ou CNPJ *</label><input required value={formatDocument(data.document)} onChange={e => setData({ ...data, document: e.target.value })} placeholder="CPF ou CNPJ" className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-3 text-sm outline-none focus:border-[#D4AF37]" /></div>
          <div><label className="block text-xs font-medium text-zinc-400 mb-1.5">Nome completo ou razão social *</label><input required value={data.legalName} onChange={e => setData({ ...data, legalName: e.target.value })} placeholder="Nome / Razão social" className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-3 text-sm outline-none focus:border-[#D4AF37]" /></div>
          <div><label className="block text-xs font-medium text-zinc-400 mb-1.5">E-mail de cobrança *</label><input required type="email" value={data.email} onChange={e => setData({ ...data, email: e.target.value })} placeholder="financeiro@empresa.com" className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-3 text-sm outline-none focus:border-[#D4AF37]" /></div>
          <div><label className="block text-xs font-medium text-zinc-400 mb-1.5">Telefone / WhatsApp *</label><input required value={formatPhone(data.mobilePhone)} onChange={e => setData({ ...data, mobilePhone: e.target.value })} placeholder="(00) 00000-0000" className="w-full h-11 rounded-xl bg-black border border-zinc-800 px-3 text-sm outline-none focus:border-[#D4AF37]" /></div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3"><ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" /><p className="text-xs text-zinc-400 leading-relaxed">O LumièreOS não armazena dados do cartão. A escolha do meio de pagamento e a inserção dos dados de cartão acontecem diretamente no ambiente seguro da Asaas.</p></div>
          <button disabled={saving} type="submit" className="w-full h-12 rounded-xl bg-[#D4AF37] hover:bg-[#Bca032] disabled:opacity-50 text-black font-bold flex items-center justify-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}{saving ? 'Salvando e preparando pagamento...' : 'Salvar e ir para pagamento'}</button>
        </form>
      </div>
    </div>
  );
}

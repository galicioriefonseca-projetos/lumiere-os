import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Appointment,
  Client,
  ClientHistory,
  ComandaFlow,
  ComandaItem,
  ComandaPaymentSplit,
  Professional,
  Service,
  ServicePackage,
} from '@/types';
import { db } from '@/lib/firebase';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { finalizeComandaApi } from '@/services/operationsService';
import { cn, formatBRL } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  History,
  Info,
  Loader2,
  Plus,
  Printer,
  Receipt,
  Save,
  Scissors,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';

interface ComandaModal360Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  comanda: ComandaFlow | null;
  clients: Client[];
  professionals: Professional[];
  services: Service[];
  packages?: ServicePackage[];
  appointments: Appointment[];
  currentUserName: string;
  initialTab?: 'items' | 'payment' | 'prontuario' | 'info';
  onFinalized?: () => void;
}

const PAYMENT_METHODS: Array<{ value: ComandaPaymentSplit['method']; label: string }> = [
  { value: 'pix', label: 'Pix' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'client_credit', label: 'Usar Saldo do Cliente' },
];

export const ComandaModal360: React.FC<ComandaModal360Props> = ({
  open,
  onOpenChange,
  salonId,
  comanda,
  clients,
  professionals,
  services,
  packages = [],
  appointments,
  currentUserName,
  initialTab = 'items',
  onFinalized,
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'payment' | 'prontuario' | 'info'>(initialTab);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showImportAppts, setShowImportAppts] = useState(false);

  // Editable Comanda state
  const [clientId, setClientId] = useState('consumidor-final');
  const [date, setDate] = useState('');
  const [items, setItems] = useState<ComandaItem[]>([]);
  const [cashRegisterName, setCashRegisterName] = useState('Caixa Principal');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('0');
  const [chargesValue, setChargesValue] = useState('0');
  const [paymentSplits, setPaymentSplits] = useState<ComandaPaymentSplit[]>([]);
  const [saveDifferenceToClientBalance, setSaveDifferenceToClientBalance] = useState(false);
  const [prontuarioNotes, setProntuarioNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [clientHistory, setClientHistory] = useState<ClientHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quick Add Item draft
  const [newItemType, setNewItemType] = useState<'service' | 'product' | 'package'>('service');
  const [newItemCatalogId, setNewItemCatalogId] = useState('');
  const [newItemCustomName, setNewItemCustomName] = useState('');
  const [newItemProfId, setNewItemProfId] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemDiscountPct, setNewItemDiscountPct] = useState('0');

  useEffect(() => {
    if (!open || !comanda) return;
    setActiveTab(initialTab);
    setClientId(comanda.clientId || 'consumidor-final');
    setDate(comanda.date || new Date().toISOString().substring(0, 10));
    setItems(
      (comanda.items || []).map((itm) => ({
        ...itm,
        quantity: itm.quantity ?? 1,
        unitPrice: itm.unitPrice ?? itm.price,
        discountPercent: itm.discountPercent ?? 0,
      }))
    );
    setCashRegisterName(comanda.cashRegisterName || 'Caixa Principal');
    setDiscountType('fixed');
    setDiscountValue(String(comanda.discount || 0));
    setChargesValue(String(comanda.charges || 0));
    setProntuarioNotes(comanda.prontuarioNotes || '');
    setNotes(comanda.notes || '');
    setSaveDifferenceToClientBalance(false);
    setShowImportAppts(false);

    if (comanda.paymentSplits && comanda.paymentSplits.length > 0) {
      setPaymentSplits(comanda.paymentSplits);
    } else {
      setPaymentSplits([
        {
          id: `split-${Date.now()}`,
          method: (comanda.paymentMethod as ComandaPaymentSplit['method']) || 'pix',
          amount: 0,
          info: '',
        },
      ]);
    }

    if (professionals.length > 0 && !newItemProfId) {
      setNewItemProfId(professionals[0].id);
    }
  }, [open, comanda, initialTab, professionals]);

  // Fetch client's past Prontuário / history when on Prontuário tab
  useEffect(() => {
    if (!open || !salonId || !clientId || clientId === 'consumidor-final') {
      setClientHistory([]);
      return;
    }
    let mounted = true;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, `salons/${salonId}/clients/${clientId}/history`),
            orderBy('createdAt', 'desc')
          )
        );
        if (!mounted) return;
        const arr: ClientHistory[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as ClientHistory));
        setClientHistory(arr.filter((h) => h.type === 'note_added').slice(0, 15));
      } catch {
        // Silent if rules restrict or empty
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    };
    loadHistory();
    return () => {
      mounted = false;
    };
  }, [open, salonId, clientId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId]
  );

  const clientDisplayName =
    clientId === 'consumidor-final'
      ? 'Consumidor Final'
      : selectedClient?.name || comanda?.clientName || 'Cliente';

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.price || 0), 0);
    const servicesTotal = items
      .filter((i) => i.type === 'service' || i.type === 'package')
      .reduce((sum, i) => sum + Number(i.price || 0), 0);
    const productsTotal = items
      .filter((i) => i.type === 'product')
      .reduce((sum, i) => sum + Number(i.price || 0), 0);

    const rawDisc = parseFloat(discountValue.replace(',', '.')) || 0;
    const discountAmount =
      discountType === 'percentage' ? Math.max(0, subtotal * (rawDisc / 100)) : Math.max(0, rawDisc);
    const chargesAmount = Math.max(0, parseFloat(chargesValue.replace(',', '.')) || 0);
    const finalTotal = Math.max(0, Number((subtotal - discountAmount + chargesAmount).toFixed(2)));
    const paidAmount = Number(
      paymentSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0).toFixed(2)
    );
    const difference = Number((paidAmount - finalTotal).toFixed(2));

    return {
      subtotal,
      servicesTotal,
      productsTotal,
      discountAmount,
      chargesAmount,
      finalTotal,
      paidAmount,
      difference,
    };
  }, [items, discountType, discountValue, chargesValue, paymentSplits]);

  const commissionBreakdown = useMemo(() => {
    const map: Record<string, { name: string; base: number; rate: number; commission: number }> = {};
    items.forEach((itm) => {
      const prof = professionals.find((p) => p.id === itm.professionalId);
      const rate = prof?.commissionRate !== undefined ? prof.commissionRate : 50;
      const comm = Number((itm.price * (rate / 100)).toFixed(2));
      if (!map[itm.professionalId]) {
        map[itm.professionalId] = {
          name: itm.professionalName,
          base: 0,
          rate,
          commission: 0,
        };
      }
      map[itm.professionalId].base += itm.price;
      map[itm.professionalId].commission += comm;
    });
    return Object.entries(map).map(([id, val]) => ({ id, ...val }));
  }, [items, professionals]);

  // Importable open appointments for this client or today
  const importableAppointments = useMemo(() => {
    const alreadyLinkedIds = new Set(items.map((i) => i.appointmentId).filter(Boolean));
    return appointments.filter((app) => {
      if (app.isBlock || app.status === 'canceled' || app.status === 'completed') return false;
      if (alreadyLinkedIds.has(app.id)) return false;
      if (clientId && clientId !== 'consumidor-final') {
        return app.clientId === clientId;
      }
      return app.date === date;
    });
  }, [appointments, clientId, date, items]);

  const handleSelectCatalogItem = (catalogId: string) => {
    setNewItemCatalogId(catalogId);
    if (catalogId === 'custom') {
      setNewItemCustomName('');
      setNewItemPrice('');
      return;
    }
    if (newItemType === 'package') {
      const pkg = packages.find((p) => p.id === catalogId);
      if (pkg) {
        setNewItemCustomName(pkg.name);
        setNewItemPrice(String(pkg.price));
      }
      return;
    }
    const svc = services.find((s) => s.id === catalogId);
    if (svc) {
      setNewItemCustomName(svc.name);
      setNewItemPrice(String(svc.price));
    }
  };

  const handleAddItem = () => {
    const prof = professionals.find((p) => p.id === newItemProfId) || professionals[0];
    if (!prof) {
      toast.error('Selecione o profissional responsável pelo item.');
      return;
    }
    const name = newItemCustomName.trim();
    if (!name) {
      toast.error('Informe o nome do serviço, produto ou pacote.');
      return;
    }
    const unitPrice = parseFloat(newItemPrice.replace(',', '.')) || 0;
    const qty = Math.max(1, parseFloat(newItemQty.replace(',', '.')) || 1);
    const discPct = Math.min(100, Math.max(0, parseFloat(newItemDiscountPct.replace(',', '.')) || 0));
    const netPrice = Number((unitPrice * qty * (1 - discPct / 100)).toFixed(2));

    const item: ComandaItem = {
      type: newItemType,
      id: newItemCatalogId && newItemCatalogId !== 'custom' ? newItemCatalogId : `custom-${Date.now()}`,
      name,
      quantity: qty,
      unitPrice,
      discountPercent: discPct,
      price: netPrice,
      professionalId: prof.id,
      professionalName: prof.name,
      updatedByName: currentUserName,
      updatedAt: Date.now(),
    };

    setItems((prev) => [...prev, item]);
    setNewItemCatalogId('');
    setNewItemCustomName('');
    setNewItemPrice('');
    setNewItemQty('1');
    setNewItemDiscountPct('0');
    toast.success(`${name} adicionado à comanda.`);
  };

  const handleUpdateItemField = (
    idx: number,
    patch: Partial<{ quantity: number; unitPrice: number; discountPercent: number; professionalId: string }>
  ) => {
    setItems((prev) =>
      prev.map((itm, i) => {
        if (i !== idx) return itm;
        const qty = patch.quantity ?? itm.quantity ?? 1;
        const unit = patch.unitPrice ?? itm.unitPrice ?? itm.price;
        const disc = patch.discountPercent ?? itm.discountPercent ?? 0;
        const profId = patch.professionalId ?? itm.professionalId;
        const profName = professionals.find((p) => p.id === profId)?.name || itm.professionalName;
        const nextPrice = Number((unit * qty * (1 - disc / 100)).toFixed(2));
        return {
          ...itm,
          quantity: qty,
          unitPrice: unit,
          discountPercent: disc,
          professionalId: profId,
          professionalName: profName,
          price: Math.max(0, nextPrice),
          updatedByName: currentUserName,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) {
      toast.error('A comanda precisa conter pelo menos 1 item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleImportAppointment = (app: Appointment) => {
    const svcMatch = services.find((s) => s.id === app.serviceId);
    const price = app.price ?? svcMatch?.price ?? 0;
    setItems((prev) => [
      ...prev,
      {
        type: 'service',
        id: app.serviceId || app.id,
        name: app.serviceName,
        quantity: 1,
        unitPrice: price,
        discountPercent: 0,
        price,
        professionalId: app.professionalId,
        professionalName: app.professionalName,
        appointmentId: app.id,
        updatedByName: currentUserName,
        updatedAt: Date.now(),
      },
    ]);
    if (clientId === 'consumidor-final' && app.clientId && app.clientId !== 'consumidor-final') {
      setClientId(app.clientId);
    }
    toast.success(`Agendamento "${app.serviceName}" importado para a comanda.`);
  };

  const handleAddSplit = () => {
    setPaymentSplits((prev) => [
      ...prev,
      { id: `split-${Date.now()}-${prev.length}`, method: 'credit_card', amount: 0, info: '' },
    ]);
  };

  const handleFillDifference = (splitIdx: number) => {
    const othersSum = paymentSplits.reduce(
      (sum, s, idx) => (idx === splitIdx ? sum : sum + Number(s.amount || 0)),
      0
    );
    const needed = Math.max(0, Number((totals.finalTotal - othersSum).toFixed(2)));
    setPaymentSplits((prev) =>
      prev.map((s, idx) => (idx === splitIdx ? { ...s, amount: needed } : s))
    );
  };

  const handleSaveChanges = async () => {
    if (!comanda || !salonId) return;
    if (items.length === 0) {
      toast.error('Adicione pelo menos 1 item antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      await setDoc(
        doc(db, `salons/${salonId}/comandas`, comanda.id),
        {
          clientId,
          clientName: clientDisplayName,
          date,
          items,
          totalAmount: totals.subtotal,
          servicesTotal: totals.servicesTotal,
          productsTotal: totals.productsTotal,
          discount: totals.discountAmount,
          charges: totals.chargesAmount,
          cashRegisterName,
          paymentSplits,
          prontuarioNotes,
          notes,
          updatedByName: currentUserName,
          lastItemUpdatedByName: currentUserName,
          lastItemUpdatedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
      toast.success('Comanda atualizada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar comanda.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!comanda || !salonId) return;
    if (items.length === 0) {
      toast.error('Adicione pelo menos 1 item para finalizar.');
      return;
    }

    const activeSplits = paymentSplits.filter((s) => Number(s.amount || 0) > 0);
    if (activeSplits.length === 0 && totals.finalTotal > 0) {
      // Auto-fill primary payment method if user clicked Finalizar directly
      toast.info('Preenchendo pagamento integral no método selecionado...');
    }

    setFinalizing(true);
    try {
      const splitsToSend: ComandaPaymentSplit[] =
        activeSplits.length > 0
          ? activeSplits
          : totals.finalTotal > 0
            ? [{ id: 'split-auto', method: paymentSplits[0]?.method || 'pix', amount: totals.finalTotal, info: '' }]
            : [];

      const res = await finalizeComandaApi({
        salonId,
        comandaId: comanda.id,
        clientId,
        clientName: clientDisplayName,
        items,
        paymentSplits: splitsToSend,
        cashRegisterName,
        discountAmount: totals.discountAmount,
        chargesAmount: totals.chargesAmount,
        saveDifferenceToClientBalance,
        prontuarioNotes,
        notes,
        date,
      });

      toast.success(
        `Comanda #${res.comandaNumber || comanda.comandaNumber || '—'} finalizada! Faturamento (${formatBRL(
          res.finalTotal
        )}) lançado no Financeiro e Comissões.`
      );
      onOpenChange(false);
      onFinalized?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao finalizar comanda.';
      toast.error(msg);
    } finally {
      setFinalizing(false);
    }
  };

  const handleDelete = async () => {
    if (!comanda || !salonId) return;
    if (!window.confirm('Deseja cancelar e excluir esta comanda permanentemente?')) return;
    try {
      await deleteDoc(doc(db, `salons/${salonId}/comandas`, comanda.id));
      toast.success('Comanda excluída.');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao excluir comanda.');
    }
  };

  if (!comanda) return null;
  const comandaNumberDisplay =
    comanda.comandaNumber || comanda.id.substring(0, 5).toUpperCase();
  const isCompleted = comanda.status === 'completed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] sm:max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-2xl shadow-xl">
        {/* Top Modal Header + Tabs */}
        <DialogHeader className="px-6 pt-5 pb-0 border-b border-[#E5E2DC] bg-[#FAF9F7] shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
            <div>
              <DialogTitle className="font-heading text-base font-bold text-[#171717] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#8A6D36]" />
                Comanda #{comandaNumberDisplay} · {clientDisplayName}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B6B6B] mt-0.5">
                {date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : 'Hoje'} ·{' '}
                {items.length} {items.length === 1 ? 'item' : 'itens'} · Total:{' '}
                <strong className="text-[#171717] tabular-nums">{formatBRL(totals.finalTotal)}</strong>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-8 px-2.5 text-xs border-[#E5E2DC] bg-white text-[#171717] rounded-lg"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1 -mb-px overflow-x-auto">
            {(
              [
                { id: 'items', label: 'Itens', icon: Scissors },
                { id: 'payment', label: 'Pagamento', icon: CreditCard },
                { id: 'prontuario', label: 'Prontuário', icon: FileText },
                { id: 'info', label: 'Informações', icon: Info },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    active
                      ? 'border-[#B89B5E] text-[#171717] bg-white rounded-t-lg'
                      : 'border-transparent text-[#6B6B6B] hover:text-[#171717]'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* ================= TAB 1: ITENS ================= */}
          {activeTab === 'items' && (
            <div className="space-y-5">
              {/* Client & Date Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[#FAF9F7] p-3.5 rounded-xl border border-[#E5E2DC]">
                <div className="md:col-span-6 space-y-1">
                  <Label className="text-[11px] font-semibold text-[#6B6B6B]">Cliente</Label>
                  <div className="flex gap-2">
                    <Select value={clientId} onValueChange={setClientId} disabled={isCompleted}>
                      <SelectTrigger className="bg-white border-[#E5E2DC] h-9 text-xs text-[#171717]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                        <SelectItem value="consumidor-final">Consumidor Final (Avulso)</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.phone ? `· ${c.phone}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isCompleted && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowImportAppts((v) => !v)}
                        className="h-9 px-3 border-[#B89B5E] text-[#8A6D36] bg-white hover:bg-[#F5F1E9] text-xs font-semibold shrink-0 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Importar Agenda ({importableAppointments.length})
                      </Button>
                    )}
                  </div>
                </div>

                <div className="md:col-span-3 space-y-1">
                  <Label className="text-[11px] font-semibold text-[#6B6B6B]">Data da Comanda</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={isCompleted}
                    className="bg-white border-[#E5E2DC] h-9 text-xs text-[#171717]"
                  />
                </div>

                <div className="md:col-span-3 space-y-1">
                  <Label className="text-[11px] font-semibold text-[#6B6B6B]">Nº Comanda</Label>
                  <Input
                    readOnly
                    value={`#${comandaNumberDisplay}`}
                    className="bg-[#F0EFEC] border-[#E5E2DC] h-9 text-xs font-mono font-semibold text-[#171717]"
                  />
                </div>
              </div>

              {/* Import Appointments Drawer */}
              {showImportAppts && (
                <div className="p-3.5 rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#171717]">
                      Agendamentos disponíveis para importar
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowImportAppts(false)}
                      className="text-[11px] text-[#6B6B6B] hover:text-[#171717]"
                    >
                      Fechar
                    </button>
                  </div>
                  {importableAppointments.length === 0 ? (
                    <p className="text-[11px] text-[#6B6B6B]">
                      Nenhum agendamento pendente localizado para este cliente ou data.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {importableAppointments.map((app) => (
                        <div
                          key={app.id}
                          className="flex items-center justify-between gap-2 bg-white border border-[#E5E2DC] rounded-lg px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-[#171717] truncate">{app.serviceName}</p>
                            <p className="text-[11px] text-[#6B6B6B] truncate">
                              {app.date.split('-').reverse().join('/')} {app.time} · {app.professionalName}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleImportAppointment(app)}
                            className="h-7 px-2.5 bg-[#171717] text-white text-[11px] shrink-0"
                          >
                            + Incluir
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Items Table */}
              <div className="border border-[#E5E2DC] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[680px]">
                  <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC] text-[11px] font-semibold text-[#6B6B6B]">
                    <tr>
                      <th className="p-3">Item / Procedimento</th>
                      <th className="p-3 w-44">Profissional</th>
                      <th className="p-3 w-20 text-center">Qtd.</th>
                      <th className="p-3 w-28 text-right">Valor (R$)</th>
                      <th className="p-3 w-24 text-right">Desc. (%)</th>
                      <th className="p-3 w-28 text-right">Final (R$)</th>
                      {!isCompleted && <th className="p-3 w-12 text-center">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E2DC]">
                    {items.map((itm, idx) => (
                      <tr key={`${itm.id}-${idx}`} className="hover:bg-[#FAF9F7]/60">
                        <td className="p-3">
                          <div className="font-semibold text-[#171717]">{itm.name}</div>
                          <div className="text-[10px] text-[#6B6B6B] mt-0.5">
                            {itm.type === 'product'
                              ? 'Produto'
                              : itm.type === 'package'
                                ? 'Pacote'
                                : 'Serviço'}
                          </div>
                        </td>
                        <td className="p-3">
                          <Select
                            disabled={isCompleted}
                            value={itm.professionalId}
                            onValueChange={(v) => handleUpdateItemField(idx, { professionalId: v })}
                          >
                            <SelectTrigger className="h-8 bg-white border-[#E5E2DC] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                              {professionals.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            disabled={isCompleted}
                            type="number"
                            min={1}
                            value={itm.quantity ?? 1}
                            onChange={(e) =>
                              handleUpdateItemField(idx, {
                                quantity: Math.max(1, parseFloat(e.target.value) || 1),
                              })
                            }
                            className="h-8 text-center bg-white border-[#E5E2DC] tabular-nums"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            disabled={isCompleted}
                            type="number"
                            step="0.01"
                            min={0}
                            value={itm.unitPrice ?? itm.price}
                            onChange={(e) =>
                              handleUpdateItemField(idx, {
                                unitPrice: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="h-8 text-right bg-white border-[#E5E2DC] font-mono tabular-nums"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            disabled={isCompleted}
                            type="number"
                            min={0}
                            max={100}
                            value={itm.discountPercent ?? 0}
                            onChange={(e) =>
                              handleUpdateItemField(idx, {
                                discountPercent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                              })
                            }
                            className="h-8 text-right bg-white border-[#E5E2DC] font-mono tabular-nums"
                          />
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#171717] tabular-nums">
                          {formatBRL(itm.price)}
                        </td>
                        {!isCompleted && (
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-[#6B6B6B] hover:text-rose-600 rounded-lg transition-colors"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Item Row */}
              {!isCompleted && (
                <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#171717]">
                      Adicionar Item à Comanda
                    </span>
                    <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E2DC] rounded-lg">
                      {(
                        [
                          { key: 'service', label: 'Serviço', icon: Scissors },
                          { key: 'product', label: 'Produto', icon: ShoppingBag },
                          { key: 'package', label: 'Pacote', icon: Sparkles },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setNewItemType(opt.key);
                              setNewItemCatalogId('');
                              setNewItemCustomName('');
                              setNewItemPrice('');
                            }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer',
                              newItemType === opt.key
                                ? 'bg-[#171717] text-white'
                                : 'text-[#6B6B6B] hover:text-[#171717]'
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-4 space-y-1">
                      <Label className="text-[11px] text-[#6B6B6B]">Catálogo ou Avulso</Label>
                      <Select value={newItemCatalogId} onValueChange={handleSelectCatalogItem}>
                        <SelectTrigger className="bg-white border-[#E5E2DC] h-9 text-xs">
                          <SelectValue placeholder="Escolha do catálogo..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                          <SelectItem value="custom">-- Digitar Avulso --</SelectItem>
                          {newItemType === 'package'
                            ? packages.filter((p) => p.isActive).map((pkg) => (
                                <SelectItem key={pkg.id} value={pkg.id}>
                                  {pkg.name} ({formatBRL(pkg.price)})
                                </SelectItem>
                              ))
                            : services
                                .filter((s) =>
                                  newItemType === 'product'
                                    ? s.type === 'product'
                                    : !s.type || s.type === 'service'
                                )
                                .map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name} ({formatBRL(s.price)})
                                  </SelectItem>
                                ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <Label className="text-[11px] text-[#6B6B6B]">Nome</Label>
                      <Input
                        value={newItemCustomName}
                        onChange={(e) => setNewItemCustomName(e.target.value)}
                        placeholder="Nome do item"
                        className="bg-white border-[#E5E2DC] h-9 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[11px] text-[#6B6B6B]">Profissional</Label>
                      <Select value={newItemProfId} onValueChange={setNewItemProfId}>
                        <SelectTrigger className="bg-white border-[#E5E2DC] h-9 text-xs">
                          <SelectValue placeholder="Prof..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                          {professionals.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-1 space-y-1">
                      <Label className="text-[11px] text-[#6B6B6B]">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(e.target.value)}
                        className="bg-white border-[#E5E2DC] h-9 text-xs text-center tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[11px] text-[#6B6B6B]">Unit. (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        placeholder="0.00"
                        className="bg-white border-[#E5E2DC] h-9 text-xs text-right font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      className="h-8 px-4 bg-[#171717] hover:bg-[#2c2c2c] text-white text-xs font-semibold rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" />
                      Incluir Item
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: PAGAMENTO ================= */}
          {activeTab === 'payment' && (
            <div className="space-y-5">
              {/* Top Financial Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#FAF9F7] border border-[#E5E2DC] p-4 rounded-xl">
                <div>
                  <span className="text-[11px] text-[#6B6B6B] block">Total Serviços</span>
                  <span className="text-sm font-bold font-mono text-[#171717] tabular-nums">
                    {formatBRL(totals.servicesTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B6B6B] block">Total Produtos</span>
                  <span className="text-sm font-bold font-mono text-[#171717] tabular-nums">
                    {formatBRL(totals.productsTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B6B6B] block">Saldo do Cliente</span>
                  <span
                    className={cn(
                      'text-sm font-bold font-mono tabular-nums',
                      (selectedClient?.creditBalance || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    )}
                  >
                    {formatBRL(selectedClient?.creditBalance || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B6B6B] block">Total a Cobrar</span>
                  <span className="text-base font-extrabold font-mono text-[#171717] tabular-nums">
                    {formatBRL(totals.finalTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B6B6B] block">Diferença</span>
                  <span
                    className={cn(
                      'text-base font-extrabold font-mono tabular-nums',
                      Math.abs(totals.difference) < 0.01
                        ? 'text-emerald-700'
                        : totals.difference < 0
                          ? 'text-amber-700'
                          : 'text-sky-700'
                    )}
                  >
                    {formatBRL(totals.difference)}
                  </span>
                </div>
              </div>

              {/* Caixa + Discounts & Charges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-[#6B6B6B]">
                    Caixa Responsável
                  </Label>
                  <Select
                    disabled={isCompleted}
                    value={cashRegisterName}
                    onValueChange={setCashRegisterName}
                  >
                    <SelectTrigger className="bg-white border-[#E5E2DC] h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                      <SelectItem value="Caixa Principal">Caixa Principal</SelectItem>
                      <SelectItem value="Recepção 02">Recepção 02</SelectItem>
                      <SelectItem value="Não utiliza caixa">Não utiliza caixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-[#6B6B6B]">
                    Desconto Geral
                  </Label>
                  <div className="flex gap-1.5">
                    <Input
                      disabled={isCompleted}
                      type="number"
                      min={0}
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="bg-white border-[#E5E2DC] h-9 text-xs font-mono tabular-nums"
                    />
                    <Select
                      disabled={isCompleted}
                      value={discountType}
                      onValueChange={(v: 'fixed' | 'percentage') => setDiscountType(v)}
                    >
                      <SelectTrigger className="w-20 bg-white border-[#E5E2DC] h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E5E2DC]">
                        <SelectItem value="fixed">R$</SelectItem>
                        <SelectItem value="percentage">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-[#6B6B6B]">
                    Acréscimo / Taxa (R$)
                  </Label>
                  <Input
                    disabled={isCompleted}
                    type="number"
                    min={0}
                    step="0.01"
                    value={chargesValue}
                    onChange={(e) => setChargesValue(e.target.value)}
                    className="bg-white border-[#E5E2DC] h-9 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              {/* Payment Splits Table */}
              <div className="border border-[#E5E2DC] rounded-xl overflow-hidden">
                <div className="bg-[#FAF9F7] px-4 py-2.5 border-b border-[#E5E2DC] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-[#8A6D36]" />
                    Formas de Pagamento (Rateio Multi-Meios)
                  </span>
                  {!isCompleted && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddSplit}
                      className="h-7 px-2.5 text-[11px] border-[#E5E2DC] bg-white text-[#171717]"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Adicionar Forma
                    </Button>
                  )}
                </div>

                <div className="divide-y divide-[#E5E2DC]">
                  {paymentSplits.map((split, idx) => (
                    <div
                      key={split.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 items-center bg-white"
                    >
                      <div className="sm:col-span-4">
                        <Select
                          disabled={isCompleted}
                          value={split.method}
                          onValueChange={(v: ComandaPaymentSplit['method']) =>
                            setPaymentSplits((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, method: v } : p))
                            )
                          }
                        >
                          <SelectTrigger className="bg-white border-[#E5E2DC] h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-4">
                        <Input
                          disabled={isCompleted}
                          value={split.info || ''}
                          onChange={(e) =>
                            setPaymentSplits((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, info: e.target.value } : p))
                            )
                          }
                          placeholder="Parcelas, bandeira ou obs..."
                          className="bg-white border-[#E5E2DC] h-9 text-xs"
                        />
                      </div>

                      <div className="sm:col-span-3 flex items-center gap-1.5">
                        <Input
                          disabled={isCompleted}
                          type="number"
                          step="0.01"
                          min={0}
                          value={split.amount}
                          onChange={(e) =>
                            setPaymentSplits((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? { ...p, amount: Math.max(0, parseFloat(e.target.value) || 0) }
                                  : p
                              )
                            )
                          }
                          className="bg-white border-[#E5E2DC] h-9 text-xs text-right font-mono tabular-nums"
                        />
                        {!isCompleted && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFillDifference(idx)}
                            className="h-9 px-2.5 text-[11px] font-semibold border-[#B89B5E] text-[#8A6D36] bg-[#FAF9F7] hover:bg-[#F5F1E9] shrink-0"
                            title="Preencher com o saldo restante"
                          >
                            Dif
                          </Button>
                        )}
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        {!isCompleted && paymentSplits.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentSplits((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-[#6B6B6B] hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {clientId !== 'consumidor-final' && !isCompleted && (
                <label className="flex items-center gap-2 text-xs text-[#171717] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveDifferenceToClientBalance}
                    onChange={(e) => setSaveDifferenceToClientBalance(e.target.checked)}
                    className="rounded border-[#E5E2DC] text-[#B89B5E] w-4 h-4"
                  />
                  Salvar diferença/troco ({formatBRL(totals.difference)}) no saldo do cliente
                </label>
              )}

              {/* Monitor de Rateio / Comissões */}
              <div className="border border-[#E5E2DC] bg-[#FAF9F7] rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6D36] block">
                  Previsão de Repasse / Comissões desta Comanda
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {commissionBreakdown.map((cb) => (
                    <div
                      key={cb.id}
                      className="flex items-center justify-between bg-white border border-[#E5E2DC] px-3 py-2 rounded-lg"
                    >
                      <span className="font-medium text-[#171717]">
                        {cb.name} · <span className="text-[#6B6B6B]">{cb.rate}%</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-700 tabular-nums">
                        {formatBRL(cb.commission)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: PRONTUÁRIO ================= */}
          {activeTab === 'prontuario' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#171717]">
                  Prontuário Técnico / Fórmula desta Comanda
                </Label>
                <p className="text-[11px] text-[#6B6B6B]">
                  Registre fórmulas de coloração, gramaturas, protocolos estéticos, alergias ou observações do atendimento. Ao finalizar a comanda, este registro é arquivado no histórico do cliente.
                </p>
                <textarea
                  disabled={isCompleted}
                  rows={5}
                  value={prontuarioNotes}
                  onChange={(e) => setProntuarioNotes(e.target.value)}
                  placeholder="Ex: Raiz 7.1 + OX 20vol (30 min). Tonalização 8.21 + 9.0. Cliente preferiu temperatura morna..."
                  className="w-full rounded-xl border border-[#E5E2DC] bg-white p-3 text-xs text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#B89B5E]"
                />
              </div>

              <div className="border border-[#E5E2DC] rounded-xl p-4 bg-[#FAF9F7] space-y-3">
                <h4 className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#8A6D36]" />
                  Histórico de Prontuários Anteriores ({clientDisplayName})
                </h4>
                {clientId === 'consumidor-final' ? (
                  <p className="text-[11px] text-[#6B6B6B]">
                    Selecione um cliente cadastrado na aba Itens para visualizar prontuários anteriores.
                  </p>
                ) : loadingHistory ? (
                  <p className="text-[11px] text-[#6B6B6B]">Carregando histórico...</p>
                ) : clientHistory.length === 0 ? (
                  <p className="text-[11px] text-[#6B6B6B]">
                    Nenhuma anotação técnica anterior encontrada para este cliente.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {clientHistory.map((h) => (
                      <div
                        key={h.id}
                        className="bg-white border border-[#E5E2DC] rounded-lg p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#6B6B6B]">
                          <span className="font-semibold text-[#171717]">{h.title}</span>
                          <span className="tabular-nums">
                            {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-xs text-[#171717] whitespace-pre-wrap">{h.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: INFORMAÇÕES & AUDITORIA ================= */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-xl p-4 space-y-2 text-xs">
                <h4 className="font-semibold text-[#171717] mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#8A6D36]" /> Auditoria da Comanda
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#6B6B6B]">
                  <div>
                    <strong className="text-[#171717]">Abertura:</strong>{' '}
                    {new Date(comanda.createdAt).toLocaleString('pt-BR')} ·{' '}
                    {comanda.openedByName || currentUserName}
                  </div>
                  <div>
                    <strong className="text-[#171717]">Última atualização:</strong>{' '}
                    {new Date(comanda.updatedAt).toLocaleString('pt-BR')} ·{' '}
                    {comanda.updatedByName || currentUserName}
                  </div>
                  <div>
                    <strong className="text-[#171717]">Última edição de item:</strong>{' '}
                    {comanda.lastItemUpdatedAt
                      ? `${new Date(comanda.lastItemUpdatedAt).toLocaleString('pt-BR')} · ${
                          comanda.lastItemUpdatedByName || currentUserName
                        }`
                      : 'Mesmo da abertura'}
                  </div>
                  {comanda.closedAt && (
                    <div>
                      <strong className="text-[#171717]">Finalizada em:</strong>{' '}
                      {new Date(comanda.closedAt).toLocaleString('pt-BR')} ·{' '}
                      {comanda.closedByName || '—'}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-[#171717]">Observação Interna</Label>
                  <span className="text-[11px] text-[#6B6B6B] tabular-nums">
                    {notes.length}/500
                  </span>
                </div>
                <textarea
                  disabled={isCompleted}
                  maxLength={500}
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações da recepção, cortesia aplicada ou detalhes de pagamento..."
                  className="w-full rounded-xl border border-[#E5E2DC] bg-white p-3 text-xs text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#B89B5E]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-[#E5E2DC] bg-[#FAF9F7] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {!isCompleted && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveChanges}
                disabled={saving || finalizing}
                className="h-9 px-3.5 border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F0EFEC] text-xs font-semibold rounded-xl"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5 text-[#8A6D36]" />
                )}
                Atualizar Comanda
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCompleted && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={saving || finalizing}
                className="h-9 px-3 border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-3.5 border-[#E5E2DC] bg-white text-[#171717] text-xs font-semibold rounded-xl"
            >
              Fechar
            </Button>

            {!isCompleted && (
              <Button
                type="button"
                onClick={handleFinalize}
                disabled={finalizing || saving}
                className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
              >
                {finalizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Finalizar Comanda ({formatBRL(totals.finalTotal)})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

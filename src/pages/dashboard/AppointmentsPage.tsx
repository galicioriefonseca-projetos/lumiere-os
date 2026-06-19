import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Appointment, Client, Professional, Service } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Loader2, Plus, Calendar as CalendarIcon, Clock, Edit2, ShoppingBag, 
  Scissors, FileText, Check, Trash2, ArrowRight, DollarSign, Sparkles, 
  UserPlus, Percent, CreditCard, ChevronRight, CheckCircle2, AlertCircle, ShoppingCart
} from 'lucide-react';
import { formatBRL } from '@/lib/utils';
import { triggerAppointmentPushNotification } from '../../lib/pushNotifications';
import { motion, AnimatePresence } from 'motion/react';
import { getAvailableSlots } from '../../lib/availability';

interface ComandaItem {
  type: 'service' | 'product';
  id: string; // ID do serviço/produto cadastrado
  name: string;
  price: number;
  professionalId: string;
  professionalName: string;
}

interface ComandaFlow {
  id: string;
  clientId: string;
  clientName: string;
  status: 'checked_in' | 'in_service' | 'checkout_pending' | 'completed';
  items: ComandaItem[];
  date: string;
  time: string;
  notes?: string;
  paymentMethod?: string;
  totalAmount: number;
  discount?: number;
  charges?: number;
  createdAt: number;
  updatedAt: number;
}

export default function AppointmentsPage() {
  const { salonData, userData } = useAuth();
  const userRole = userData?.role || 'professional';

  const [activePageTab, setActivePageTab] = useState<'flow' | 'traditional'>('flow');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [comandas, setComandas] = useState<ComandaFlow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isNewComandaOpen, setIsNewComandaOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // States auxiliares de fluxo
  const [selectedComanda, setSelectedComanda] = useState<ComandaFlow | null>(null);
  const [editingItem, setEditingItem] = useState<Appointment | null>(null);

  // Formulário Agenda Tradicional
  const [formData, setFormData] = useState({
    clientId: '',
    professionalId: '',
    serviceId: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    notes: '',
    status: 'scheduled' as Appointment['status']
  });

  // Slots de disponibilidade para o profissional e data selecionados no form
  const availableSlotsList = useMemo(() => {
    if (!salonData || !salonData.workingHours || !formData.date || !formData.serviceId) {
      return [];
    }
    const service = services.find(s => s.id === formData.serviceId);
    if (!service) return [];

    const slots = getAvailableSlots(
      formData.date,
      formData.professionalId,
      service.durationMinutes,
      salonData.workingHours,
      appointments
    );

    if (editingItem && editingItem.date === formData.date && editingItem.time && !slots.includes(editingItem.time)) {
      slots.push(editingItem.time);
      slots.sort();
    }

    return slots;
  }, [salonData, formData.date, formData.serviceId, formData.professionalId, appointments, services, editingItem]);

  // Formulário Lançamento Direto (Original)
  const [manualFormData, setManualFormData] = useState({
    type: 'service' as 'service' | 'product',
    professionalId: '',
    serviceId: '',
    customName: '',
    price: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Formulário Nova Comanda
  const [comandaFormData, setComandaFormData] = useState({
    clientId: 'consumidor-final',
    clientName: 'Consumidor Final',
    professionalId: '',
    serviceId: '',
    notes: ''
  });

  // Formulário Adicionar Item na Comanda Ativa
  const [addItemFormData, setAddItemFormData] = useState({
    type: 'service' as 'service' | 'product',
    itemId: '',
    customName: '',
    price: '',
    professionalId: ''
  });

  // Formulário Checkout Final
  const [checkoutData, setCheckoutData] = useState({
    paymentMethod: 'pix',
    discountType: 'percentage' as 'fixed' | 'percentage',
    discountValue: '0',
    chargesValue: '0',
    notes: ''
  });

  // Carregar Dados do Salão
  useEffect(() => {
    if (!salonData) return;

    const unsubs: (() => void)[] = [];

    // Carregar Appointments
    const qa = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(onSnapshot(qa, (snapshot) => {
      const arr: Appointment[] = [];
      snapshot.forEach(d => arr.push({ id: d.id, ...d.data() } as Appointment));
      setAppointments(arr.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar agendamentos:", error);
      setLoading(false);
    }));

    // Carregar Comandas Ativas do Lumière Flow
    const qComandas = query(collection(db, `salons/${salonData.id}/comandas`));
    unsubs.push(onSnapshot(qComandas, (snapshot) => {
      const arr: ComandaFlow[] = [];
      snapshot.forEach(d => arr.push({ id: d.id, ...d.data() } as ComandaFlow));
      // Ordenar por data de criação (mais novos primeiro)
      setComandas(arr.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error("Erro ao carregar comandas:", error);
    }));

    // Carregar Clientes
    const qc = query(collection(db, `salons/${salonData.id}/clients`));
    unsubs.push(onSnapshot(qc, snap => {
      const arr: Client[] = [];
      snap.forEach(d => {
        const item = d.data();
        if (item.isActive !== false) {
          arr.push({ id: d.id, ...item } as Client);
        }
      });
      setClients(arr);
    }, (error) => {
      console.error("Erro ao carregar clientes:", error);
    }));

    // Carregar Profissionais
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(onSnapshot(qp, snap => {
      const arr: Professional[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Professional));
      setProfessionals(arr.filter(p => p.isActive));
    }, (error) => {
      console.error("Erro ao carregar profissionais:", error);
    }));

    // Carregar Serviços
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    unsubs.push(onSnapshot(qs, snap => {
      const arr: Service[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Service));
      setServices(arr.filter(s => s.isActive));
    }, (error) => {
      console.error("Erro ao carregar serviços:", error);
    }));

    return () => unsubs.forEach(u => u());
  }, [salonData]);

  // Handler para trocar status de agendamento tradicional
  const changeStatus = async (id: string, newStatus: Appointment['status']) => {
    if (!salonData) return;
    try {
      await updateDoc(doc(db, `salons/${salonData.id}/appointments`, id), {
        status: newStatus,
        updatedAt: Date.now()
      });
      toast.success('Status atualizado com sucesso!');

      const appointment = appointments.find(a => a.id === id);
      if (appointment) {
        triggerAppointmentPushNotification({
          salonId: salonData.id,
          appointmentId: id,
          professionalId: appointment.professionalId,
          clientName: appointment.clientName || 'Consumidor',
          serviceName: appointment.serviceName || 'Procedimento',
          date: appointment.date,
          time: appointment.time,
          action: newStatus === 'canceled' ? 'cancel' : 'confirm',
        }).catch(err => console.error('[Push notification error]', err));
      }
    } catch(e) {
      toast.error('Erro ao atualizar status.');
    }
  };

  // Handler para submeter agendamento tradicional (Editar / Criar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const clientName = clients.find(c => c.id === formData.clientId)?.name || 'Consumidor Final';
      const professional = professionals.find(p => p.id === formData.professionalId);
      const professionalName = professional ? professional.name : '';
      const service = services.find(s => s.id === formData.serviceId);
      const serviceName = service ? service.name : '';
      const price = service ? service.price : 0;

      const dataToSave = {
        ...formData,
        clientName,
        professionalName,
        serviceName,
        price,
        serviceDuration: service ? service.durationMinutes : 30,
        source: editingItem ? (editingItem.source || 'manual') : 'manual',
        updatedAt: Date.now()
      };

      if (editingItem) {
        const ref = doc(db, `salons/${salonData.id}/appointments`, editingItem.id);
        await updateDoc(ref, dataToSave);
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/appointments`));
        await setDoc(ref, {
          id: ref.id,
          ...dataToSave,
          createdAt: Date.now(),
        });
        toast.success('Agendamento registrado!');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar agendamento.');
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({ clientId: '', professionalId: '', serviceId: '', date: new Date().toISOString().split('T')[0], time: '', notes: '', status: 'scheduled' });
  };

  const openEdit = (app: Appointment) => {
    setEditingItem(app);
    setFormData({
      clientId: app.clientId,
      professionalId: app.professionalId,
      serviceId: app.serviceId,
      date: app.date,
      time: app.time,
      notes: app.notes || '',
      status: app.status
    });
    setIsDialogOpen(true);
  };

  // Handler de Lançamento Manual Direto (Original)
  const handleManualServiceChange = (serviceId: string) => {
    if (serviceId === 'custom') {
      setManualFormData(p => ({ ...p, serviceId, customName: '', price: '' }));
    } else {
      const srv = services.find(s => s.id === serviceId);
      setManualFormData(p => ({
        ...p,
        serviceId,
        customName: srv ? srv.name : '',
        price: srv ? String(srv.price) : ''
      }));
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;
    if (!manualFormData.professionalId) {
      toast.error('Por favor, selecione um profissional.');
      return;
    }

    try {
      const professional = professionals.find(p => p.id === manualFormData.professionalId);
      const professionalName = professional ? professional.name : '';

      let finalServiceName = '';
      let finalServiceId = '';
      let finalPrice = 0;

      if (manualFormData.serviceId === 'custom' || !manualFormData.serviceId) {
        if (!manualFormData.customName.trim()) {
          toast.error('Digite o nome do serviço ou produto.');
          return;
        }
        finalServiceName = manualFormData.customName.trim();
        finalServiceId = 'manual-item';
        finalPrice = parseFloat(manualFormData.price) || 0;
      } else {
        const matchingService = services.find(s => s.id === manualFormData.serviceId);
        finalServiceName = matchingService ? matchingService.name : 'Item avulso';
        finalServiceId = manualFormData.serviceId;
        finalPrice = manualFormData.price ? parseFloat(manualFormData.price) : (matchingService?.price || 0);
      }

      if (manualFormData.type === 'product' && !finalServiceName.toLowerCase().includes('produto')) {
        finalServiceName = `Produto: ${finalServiceName}`;
      }

      const ref = doc(collection(db, `salons/${salonData.id}/appointments`));
      await setDoc(ref, {
        id: ref.id,
        clientId: 'manual',
        clientName: 'Consumidor Final',
        professionalId: manualFormData.professionalId,
        professionalName,
        serviceId: finalServiceId,
        serviceName: finalServiceName,
        price: finalPrice,
        isManualLaunch: true,
        type: manualFormData.type,
        date: manualFormData.date,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'completed',
        notes: `Lançamento manual direto de ${manualFormData.type === 'service' ? 'serviço' : 'produto'}.`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      toast.success('Lançamento avulso registrado com sucesso!');
      setIsManualDialogOpen(false);
      setManualFormData({
        type: 'service',
        professionalId: '',
        serviceId: '',
        customName: '',
        price: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao realizar lançamento manual.');
    }
  };

  // ============================================
  // FLUXO DE COMANDAS INTELIGENTES (LUMIÈRE FLOW)
  // ============================================

  // Classificação das comandas ativas pelas colunas de fluxo
  const comandasByStatus = useMemo(() => {
    const active = comandas.filter(c => c.status !== 'completed');
    return {
      checked_in: active.filter(c => c.status === 'checked_in'),
      in_service: active.filter(c => c.status === 'in_service'),
      checkout_pending: active.filter(c => c.status === 'checkout_pending')
    };
  }, [comandas]);

  // Alterar estágio do fluxo da comanda
  const handleMoveComanda = async (comandaId: string, nextStatus: ComandaFlow['status']) => {
    if (!salonData) return;
    try {
      const ref = doc(db, `salons/${salonData.id}/comandas`, comandaId);
      await updateDoc(ref, {
        status: nextStatus,
        updatedAt: Date.now()
      });
      toast.success(`Estágio da comanda atualizado!`);
    } catch (err) {
      toast.error('Erro ao atualizar estágio do atendimento.');
    }
  };

  // Criar uma nova Comanda (Inicia o fluxo do cliente)
  const handleInitComanda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    if (!comandaFormData.professionalId || !comandaFormData.serviceId) {
      toast.error('Selecione o profissional e o serviço de entrada!');
      return;
    }

    try {
      const clientName = comandaFormData.clientId === 'consumidor-final' 
        ? 'Consumidor Final' 
        : (clients.find(c => c.id === comandaFormData.clientId)?.name || 'Cliente Sem Cadastro');

      const professional = professionals.find(p => p.id === comandaFormData.professionalId);
      const service = services.find(s => s.id === comandaFormData.serviceId);

      if (!professional || !service) return;

      const initialItem: ComandaItem = {
        type: 'service',
        id: service.id,
        name: service.name,
        price: service.price,
        professionalId: professional.id,
        professionalName: professional.name
      };

      const ref = doc(collection(db, `salons/${salonData.id}/comandas`));
      
      await setDoc(ref, {
        id: ref.id,
        clientId: comandaFormData.clientId,
        clientName,
        status: 'checked_in',
        items: [initialItem],
        totalAmount: service.price,
        date: new Date().toISOString().substring(0, 10),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        notes: comandaFormData.notes || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      toast.success('Comanda aberta com sucesso! O cliente está na fila de espera.');
      setIsNewComandaOpen(false);
      setComandaFormData({
        clientId: 'consumidor-final',
        clientName: 'Consumidor Final',
        professionalId: '',
        serviceId: '',
        notes: ''
      });
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao abrir a comanda.');
    }
  };

  // Adicionar item (produto ou serviço casado) à comanda em curso
  const handleAddComandaItemChange = (itemId: string) => {
    if (itemId === 'custom') {
      setAddItemFormData(p => ({ ...p, itemId, customName: '', price: '' }));
    } else {
      const isSrv = addItemFormData.type === 'service';
      if (isSrv) {
        const srv = services.find(s => s.id === itemId);
        setAddItemFormData(p => ({
          ...p,
          itemId,
          customName: srv ? srv.name : '',
          price: srv ? String(srv.price) : ''
        }));
      } else {
        // Obter preço base ou customizado
        setAddItemFormData(p => ({ ...p, itemId, customName: '', price: '' }));
      }
    }
  };

  const handleAddComandaItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData || !selectedComanda) return;

    if (!addItemFormData.professionalId) {
      toast.error('Escolha qual profissional executou ou realizou a venda.');
      return;
    }

    try {
      const professional = professionals.find(p => p.id === addItemFormData.professionalId);
      if (!professional) return;

      let finalName = addItemFormData.customName.trim();
      let finalPrice = parseFloat(addItemFormData.price) || 0;

      if (!finalName && addItemFormData.itemId !== 'custom') {
        const matchingSrv = services.find(s => s.id === addItemFormData.itemId);
        finalName = matchingSrv ? matchingSrv.name : 'Adicional';
        finalPrice = parseFloat(addItemFormData.price) || (matchingSrv ? matchingSrv.price : 0);
      }

      if (addItemFormData.type === 'product' && !finalName.toLowerCase().includes('produto')) {
        finalName = `Produto: ${finalName}`;
      }

      const newItem: ComandaItem = {
        type: addItemFormData.type,
        id: addItemFormData.itemId || 'custom-item',
        name: finalName,
        price: finalPrice,
        professionalId: professional.id,
        professionalName: professional.name
      };

      const updatedItems = [...selectedComanda.items, newItem];
      const newTotal = updatedItems.reduce((acc, item) => acc + item.price, 0);

      const ref = doc(db, `salons/${salonData.id}/comandas`, selectedComanda.id);
      await updateDoc(ref, {
        items: updatedItems,
        totalAmount: newTotal,
        updatedAt: Date.now()
      });

      toast.success(`${newItem.type === 'service' ? 'Serviço' : 'Produto'} adicionado à comanda!`);
      setIsAddItemOpen(false);
      setAddItemFormData({
        type: 'service',
        itemId: '',
        customName: '',
        price: '',
        professionalId: ''
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao adicionar item.');
    }
  };

  // Remover item de uma comanda em curso
  const handleRemoveComandaItem = async (comanda: ComandaFlow, itemIdx: number) => {
    if (!salonData) return;
    if (comanda.items.length <= 1) {
      toast.error('A comanda precisa conter pelo menos 1 serviço inicial!');
      return;
    }

    try {
      const updatedItems = comanda.items.filter((_, idx) => idx !== itemIdx);
      const newTotal = updatedItems.reduce((acc, item) => acc + item.price, 0);

      const ref = doc(db, `salons/${salonData.id}/comandas`, comanda.id);
      await updateDoc(ref, {
        items: updatedItems,
        totalAmount: newTotal,
        updatedAt: Date.now()
      });

      toast.success('Item removido com sucesso.');
    } catch (err) {
      toast.error('Erro ao descartar item da comanda.');
    }
  };

  // Calcular Comissões Detalhadas e Rateios na Comanda para Checkout em tempo real
  const comandaCalculatedRates = useMemo(() => {
    if (!selectedComanda) return [];
    
    // Agrupar items por profissional para rateio de cada um
    const map: Record<string, { name: string, itemsPrice: number, rateAmount: number }> = {};

    selectedComanda.items.forEach(itm => {
      const prof = professionals.find(p => p.id === itm.professionalId);
      // Taxa padrão de comissão (se não houver, assume 40% de fallback)
      const commissionRate = prof?.commissionRate !== undefined ? prof.commissionRate : 40;
      
      const rateAmount = itm.price * (commissionRate / 100);

      if (!map[itm.professionalId]) {
        map[itm.professionalId] = {
          name: itm.professionalName,
          itemsPrice: 0,
          rateAmount: 0
        };
      }

      map[itm.professionalId].itemsPrice += itm.price;
      map[itm.professionalId].rateAmount += rateAmount;
    });

    return Object.entries(map).map(([key, value]) => ({
      professionalId: key,
      ...value
    }));
  }, [selectedComanda, professionals]);

  // Totalizadores de Checkout com Desconto/Acréscimo
  const checkoutTotals = useMemo(() => {
    if (!selectedComanda) return { subtotal: 0, discount: 0, charges: 0, total: 0 };

    const subtotal = selectedComanda.totalAmount;
    const descVal = parseFloat(checkoutData.discountValue) || 0;
    const isPct = checkoutData.discountType === 'percentage';
    
    const discount = isPct ? (subtotal * (descVal / 100)) : descVal;
    const charges = parseFloat(checkoutData.chargesValue) || 0;
    
    const total = Math.max(0, subtotal - discount + charges);

    return {
      subtotal,
      discount,
      charges,
      total
    };
  }, [selectedComanda, checkoutData]);

  // Confirmar Checkout e Liquidar Comanda (Gera relatórios de faturamento e comissão instantâneo)
  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData || !selectedComanda) return;

    try {
      // 1. Gravar cada item individualizado como um "appointment completed" para manter consistência absoluta
      // de relatórios, gráficos financeiros, comissões retroativas do LumièreOS
      const dateStr = new Date().toISOString().substring(0, 10);
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      for (let i = 0; i < selectedComanda.items.length; i++) {
        const item = selectedComanda.items[i];
        const appRef = doc(collection(db, `salons/${salonData.id}/appointments`));
        
        // Ratear o desconto proporcional da comanda para que os relatórios sejam perfeitos
        const proportion = selectedComanda.totalAmount > 0 
          ? item.price / selectedComanda.totalAmount 
          : 0;
        
        const itemDiscount = checkoutTotals.discount * proportion;
        const itemPriceWithDiscount = Math.max(0, item.price - itemDiscount);

        await setDoc(appRef, {
          id: appRef.id,
          clientId: selectedComanda.clientId,
          clientName: selectedComanda.clientName,
          professionalId: item.professionalId,
          professionalName: item.professionalName,
          serviceId: item.id,
          serviceName: item.name,
          price: itemPriceWithDiscount, // Guarda o preço já líquido do rateio de desconto para relatórios e comissões limpas
          type: item.type,
          date: dateStr,
          time: timeStr,
          status: 'completed',
          paymentMethod: checkoutData.paymentMethod,
          isManualLaunch: false,
          notes: `Checkout Lumière Flow (Comanda #${selectedComanda.id.substring(0, 5).toUpperCase()}). ${checkoutData.notes || ''}`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      // 2. Marcar comanda de fluxo como resolvida (pode deletar do fluxo ativo ou marcar status como 'completed' para soft delete)
      const comandaRef = doc(db, `salons/${salonData.id}/comandas`, selectedComanda.id);
      await deleteDoc(comandaRef); // Limpa do tabuleiro operacional ativo de comandas

      toast.success('Comanda liquidada com muito sucesso! Repasses calculados e equipe pontuada.');
      setIsCheckoutOpen(false);
      setSelectedComanda(null);
      setCheckoutData({
        paymentMethod: 'pix',
        discountType: 'percentage',
        discountValue: '0',
        chargesValue: '0',
        notes: ''
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao consolidar checkout financeiro.');
    }
  };

  // Cancelar/Descartar Comanda por completo
  const handleDeleteComanda = async (comandaId: string) => {
    if (!salonData) return;
    if (!window.confirm("Deseja realmente cancelar e descartar esta comanda de fluxo de forma definitiva?")) return;

    try {
      await deleteDoc(doc(db, `salons/${salonData.id}/comandas`, comandaId));
      toast.success('Comanda cancelada!');
    } catch (err) {
      toast.error('Erro ao cancelar comanda.');
    }
  };

  const getFlowStatusLabel = (status: ComandaFlow['status']) => {
    switch (status) {
      case 'checked_in': return 'Aguardando';
      case 'in_service': return 'Em Serviço';
      case 'checkout_pending': return 'No Caixa';
      default: return 'Concluído';
    }
  };

  return (
    <div className="space-y-6 pb-12" id="appointments-page">
      
      {/* Header Central de Atendimentos */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-6 rounded-2xl border border-[#D4AF37]/10">
        <div>
          <h2 className="text-2xl font-bold font-heading text-white flex items-center gap-2">
            ⚡ Lumière <span className="text-[#D4AF37]">Flow & Agenda</span>
          </h2>
          <p className="text-[#a1a1aa] text-xs">
            Controle a recepção, adicione adicionais na comanda do cliente em curso, feche o caixa e pague comissões automáticas.
          </p>
        </div>

        {/* Escolha de Visualização */}
        <div className="flex items-center gap-2 bg-[#121214] p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActivePageTab('flow')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activePageTab === 'flow'
                ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            Fluxo de Comandas (Salão)
          </button>
          
          <button
            onClick={() => setActivePageTab('traditional')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activePageTab === 'traditional'
                ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            Agenda Tradicional
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          
          {/* TAB 1: FLUXO DE COMANDAS INTELIGENTES DO SALÃO */}
          {activePageTab === 'flow' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex justify-end gap-3">
                
                {/* Lançar Comanda */}
                <Dialog open={isNewComandaOpen} onOpenChange={setIsNewComandaOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2">
                      <UserPlus className="w-4 h-4" /> Registrar Entrada (Check-In cliente)
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-sm rounded-xl">
                    <DialogHeader>
                      <DialogTitle className="font-heading text-[#D4AF37] text-lg flex items-center gap-2">
                        🔑 Abrir Comanda Operacional
                      </DialogTitle>
                      <CardDescription className="text-zinc-400">
                        O cliente acabou de entrar no espaço. Defina quem irá realizar o primeiro procedimento.
                      </CardDescription>
                    </DialogHeader>

                    <form onSubmit={handleInitComanda} className="space-y-4 pt-3">
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Cliente</Label>
                        <Select value={comandaFormData.clientId} onValueChange={(v) => setComandaFormData(p => ({ ...p, clientId: v }))}>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800">
                            <SelectValue placeholder="Escolha um cliente cadastrado" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                            <SelectItem value="consumidor-final">-- Consumidor Final (Sem Cadastro) --</SelectItem>
                            {clients.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-300">Profissional Inicial</Label>
                        <Select required value={comandaFormData.professionalId} onValueChange={(v) => setComandaFormData(p => ({ ...p, professionalId: v }))}>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800">
                            <SelectValue placeholder="Selecione quem fará o primeiro atendimento" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                            {professionals.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-300">Serviço de Entrada</Label>
                        <Select required value={comandaFormData.serviceId} onValueChange={(v) => setComandaFormData(p => ({ ...p, serviceId: v }))}>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800">
                            <SelectValue placeholder="Qual o procedimento inicial?" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                            {services.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name} ({formatBRL(s.price)})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-300">Anotações Internas (Opcional)</Label>
                        <Input 
                          value={comandaFormData.notes} 
                          onChange={e => setComandaFormData(p => ({ ...p, notes: e.target.value }))}
                          className="bg-zinc-900 border-zinc-800 text-white"
                          placeholder="Recomendações técnicas..."
                        />
                      </div>

                      <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-11 rounded-xl">
                        Gerar Comanda de Fluxo
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Quadro Board de Fluxos do Salão */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUNA 1: ESPERA / CHECK-IN */}
                <div className="bg-[#09090b]/80 border border-zinc-900 rounded-2xl p-4 flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[#D4AF37] font-sans">
                      ⏳ Fila / Espera ({comandasByStatus.checked_in.length})
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                    {comandasByStatus.checked_in.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 py-6 text-center">Nenhum cliente aguardando na fila.</p>
                    ) : (
                      comandasByStatus.checked_in.map(c => (
                        <Card key={c.id} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-extrabold text-white">{c.clientName}</h4>
                              <p className="text-[10px] text-zinc-500">Chegada: {c.time}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteComanda(c.id)} className="h-6 w-6 text-zinc-600 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="space-y-1">
                            {c.items.map((itm, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] bg-zinc-900/60 px-2 py-1.5 rounded-md text-zinc-300">
                                <span className="font-sans truncate max-w-[120px]">{itm.name}</span>
                                <span className="text-zinc-500 font-mono">{formatBRL(itm.price)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleMoveComanda(c.id, 'in_service')} className="flex-1 bg-zinc-900 border border-zinc-800 text-white text-[10px] h-8 hover:bg-zinc-800 gap-1 rounded-lg">
                              Acolher <ArrowRight className="w-3 h-3 text-[#D4AF37]" />
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUNA 2: EM ATENDIMENTO */}
                <div className="bg-[#09090b]/80 border border-zinc-900 rounded-2xl p-4 flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[#D4AF37] font-sans">
                      💇 Atendimento Ativo ({comandasByStatus.in_service.length})
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>

                  <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px]">
                    {comandasByStatus.in_service.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 py-6 text-center">Nenhum cliente em atendimento agora.</p>
                    ) : (
                      comandasByStatus.in_service.map(c => (
                        <Card key={c.id} className="bg-[#0c0d11] border border-[#D4AF37]/10 p-4 rounded-xl space-y-3 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-2 h-full bg-[#D4AF37]/20" />
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-extrabold text-white">{c.clientName}</h4>
                              <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Iniciado às: {c.time}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-[#D4AF37] font-mono">{formatBRL(c.totalAmount)}</span>
                          </div>

                          {/* Itens Atuais e profissionais */}
                          <div className="space-y-1.5 pt-1">
                            {c.items.map((itm, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px] bg-zinc-950 px-2 py-1.5 rounded-md border border-zinc-900">
                                <div className="space-y-0.5">
                                  <span className="text-zinc-200 block font-semibold leading-none">{itm.name}</span>
                                  <span className="text-[9px] text-[#D4AF37]/80">{itm.professionalName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-zinc-400 font-bold">{formatBRL(itm.price)}</span>
                                  <button onClick={() => handleRemoveComandaItem(c, idx)} className="text-zinc-600 hover:text-red-500 p-0.5 transition-colors">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Botões operacionais */}
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedComanda(c);
                                setIsAddItemOpen(true);
                              }} 
                              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] h-8 hover:bg-zinc-850 hover:text-white rounded-lg flex items-center gap-1.5 font-bold"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#D4AF37]" /> Adicionar Venda
                            </Button>
                            
                            <Button 
                              size="sm" 
                              onClick={() => handleMoveComanda(c.id, 'checkout_pending')} 
                              className="bg-[#D4AF37] text-black text-[10px] h-8 hover:bg-[#D4AF37]/90 rounded-lg flex items-center gap-1 font-bold"
                            >
                              Finalizar <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUNA 3: NO CAIXA / AGUARDANDO CHECKOUT */}
                <div className="bg-[#09090b]/80 border border-zinc-900 rounded-2xl p-4 flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[#D4AF37] font-sans">
                      💰 Caixa / Fechamento ({comandasByStatus.checkout_pending.length})
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                    {comandasByStatus.checkout_pending.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 py-6 text-center">Nenhum cliente aguardando faturamento.</p>
                    ) : (
                      comandasByStatus.checkout_pending.map(c => (
                        <Card key={c.id} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-extrabold text-white">{c.clientName}</h4>
                              <p className="text-[10px] text-zinc-500">{c.items.length} itens a consolidar</p>
                            </div>
                            <span className="text-xs font-extrabold text-[#D4AF37] font-mono">{formatBRL(c.totalAmount)}</span>
                          </div>

                          <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                            {c.items.map((itm, idx) => (
                              <div key={idx} className="flex justify-between text-[10px] bg-zinc-900/40 p-2 rounded-md">
                                <span className="text-zinc-400 capitalize truncate max-w-[130px]">{itm.name}</span>
                                <span className="text-zinc-500 font-mono font-bold">{formatBRL(itm.price)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2 pt-1 border-t border-zinc-900/60">
                            <Button 
                              size="sm" 
                              onClick={() => handleMoveComanda(c.id, 'comanda_deslocar' as any).then(() => handleMoveComanda(c.id, 'in_service'))} 
                              className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] h-8 hover:bg-zinc-850 hover:text-white rounded-lg flex items-center justify-center"
                            >
                              Voltar
                            </Button>
                            
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedComanda(c);
                                setIsCheckoutOpen(true);
                              }} 
                              className="flex-1 bg-green-500 text-black text-[10px] h-8 hover:bg-green-400 font-extrabold gap-1 rounded-lg"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Receber Caixa
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* MODAL ADICIONAR ITEM NA COMANDA IN CURSU */}
              <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
                <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-sm rounded-xl">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-white text-lg flex items-center gap-2">
                      🛍️ Adicionar Serviço / Produto Casado
                    </DialogTitle>
                    <CardDescription className="text-zinc-400">
                      Ideal para lançar adicionais comprados pelo cliente durante o atendimento (ex: hidratação, shampoo, etc).
                    </CardDescription>
                  </DialogHeader>

                  <form onSubmit={handleAddComandaItemSubmit} className="space-y-4 pt-3 text-xs">
                    
                    {/* Filtro tipo */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Tipo do Item</Label>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setAddItemFormData(p => ({ ...p, type: 'service' }))}
                          className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                            addItemFormData.type === 'service'
                              ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25'
                              : 'text-zinc-400'
                          }`}
                        >
                          💇 Serviço
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setAddItemFormData(p => ({ ...p, type: 'product' }))}
                          className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                            addItemFormData.type === 'product'
                              ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25'
                              : 'text-zinc-400'
                          }`}
                        >
                          🛍️ Produto
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-300">Profissional Responsável</Label>
                      <Select required value={addItemFormData.professionalId} onValueChange={v => setAddItemFormData(p => ({ ...p, professionalId: v }))}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800">
                          <SelectValue placeholder="Escolha quem executou/vendeu" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                          {professionals.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-300">Item Cadastrado (Opcional)</Label>
                      {addItemFormData.type === 'service' ? (
                        <Select value={addItemFormData.itemId} onValueChange={handleAddComandaItemChange}>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800">
                            <SelectValue placeholder="Selecione na lista ou avulso" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                            <SelectItem value="custom">-- Digitar Item Avulso (Fora da Lista) --</SelectItem>
                            {services.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name} ({formatBRL(s.price)})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={addItemFormData.itemId} onValueChange={v => setAddItemFormData(p => ({ ...p, itemId: v, customName: v === 'custom' ? '' : v }))}>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800">
                            <SelectValue placeholder="Selecione um produto ou avulso" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                            <SelectItem value="custom">-- Digitar Produto Manual --</SelectItem>
                            <SelectItem value="Shampoo Hidratante Premium">Shampoo Importado (R$ 89,00)</SelectItem>
                            <SelectItem value="Pomada Efeito Matte 150g">Pomada Matte (R$ 45,00)</SelectItem>
                            <SelectItem value="Óleo de Barba Especial">Óleo de Barba Luxo (R$ 55,00)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {(addItemFormData.itemId === 'custom' || !addItemFormData.itemId) && (
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Nome do Item Avulso</Label>
                        <Input 
                          required 
                          value={addItemFormData.customName} 
                          onChange={e => setAddItemFormData(p => ({ ...p, customName: e.target.value }))}
                          className="bg-zinc-900 border-zinc-800 text-white"
                          placeholder="Ex: Barba Clássica Adicional"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-zinc-300">Preço R$</Label>
                      <Input 
                        required 
                        type="number"
                        step="0.01"
                        value={addItemFormData.price} 
                        onChange={e => setAddItemFormData(p => ({ ...p, price: e.target.value }))}
                        className="bg-zinc-900 border-zinc-800 text-white font-mono"
                        placeholder="Ex: 55.00"
                      />
                    </div>

                    <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-11 rounded-xl">
                      Inserir na Comanda
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* MODAL DE CHECKOUT FINAL DA COMANDA OPERACIONAL */}
              <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md rounded-2xl max-h-[92vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-[#D4AF37] text-lg flex items-center gap-2">
                      🧾 Fechamento & Checkout de Comanda
                    </DialogTitle>
                    <CardDescription className="text-zinc-400">
                      Consolide os repasses, registre o faturamento operacional e emita a comissão imediata do salão.
                    </CardDescription>
                  </DialogHeader>

                  {selectedComanda && (
                    <form onSubmit={handleConfirmCheckout} className="space-y-5 pt-3 text-xs">
                      
                      {/* Recibo detalhado */}
                      <div className="bg-zinc-900/60 border border-zinc-900 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between border-b border-zinc-800 pb-2 text-[10px] text-zinc-500 uppercase tracking-widest font-sans">
                          <span>Descrição do Item</span>
                          <span>Preço</span>
                        </div>
                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                          {selectedComanda.items.map((itm, i) => (
                            <div key={i} className="flex justify-between text-[11px]">
                              <div>
                                <span className="text-white block font-medium capitalize">{itm.name}</span>
                                <span className="text-[10px] text-zinc-500">Com profissional: {itm.professionalName}</span>
                              </div>
                              <span className="font-semibold text-zinc-300 font-mono">{formatBRL(itm.price)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-zinc-800 pt-2 flex justify-between font-bold text-xs">
                          <span className="text-zinc-400 font-sans">Subtotal dos Itens</span>
                          <span className="text-white font-mono">{formatBRL(selectedComanda.totalAmount)}</span>
                        </div>
                      </div>

                      {/* Repasses e comissões estimados em tempo real */}
                      <div className="bg-[#0c0d12] border border-[#D4AF37]/10 rounded-xl p-4 space-y-2">
                        <h4 className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] flex items-center gap-1 font-sans">
                          ⚡ Monitor de Comissão em Tempo Real
                        </h4>
                        <div className="space-y-1.5">
                          {comandaCalculatedRates.map((cRate) => (
                            <div key={cRate.professionalId} className="flex justify-between text-[11px]">
                              <span className="text-zinc-400">Repasse para {cRate.name}</span>
                              <span className="text-green-400 font-semibold font-mono">{formatBRL(cRate.rateAmount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Desconto, taxas e tipo de pagamento */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300">Forma de Recebimento</Label>
                          <Select value={checkoutData.paymentMethod} onValueChange={v => setCheckoutData(p => ({ ...p, paymentMethod: v }))}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                              <SelectItem value="pix">⚡ Pix Instantâneo</SelectItem>
                              <SelectItem value="credit_card">💳 Cartão de Crédito</SelectItem>
                              <SelectItem value="debit_card">💳 Cartão de Débito</SelectItem>
                              <SelectItem value="cash">💵 Dinheiro Vivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 font-sans">Desconto Operacional</Label>
                          <div className="flex gap-1.5">
                            <Input 
                              type="number"
                              value={checkoutData.discountValue}
                              onChange={e => setCheckoutData(p => ({ ...p, discountValue: e.target.value }))}
                              className="bg-zinc-900 border-zinc-800 text-white font-mono w-2/3"
                              placeholder="0"
                            />
                            <Select value={checkoutData.discountType} onValueChange={(v: any) => setCheckoutData(p => ({ ...p, discountType: v }))}>
                              <SelectTrigger className="bg-zinc-900 border-zinc-800 w-1/3">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                                <SelectItem value="percentage">%</SelectItem>
                                <SelectItem value="fixed">R$</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-zinc-300">Observações Operacionais</Label>
                        <Input 
                          value={checkoutData.notes} 
                          onChange={e => setCheckoutData(p => ({ ...p, notes: e.target.value }))}
                          className="bg-zinc-900 border-zinc-800"
                          placeholder="Recepção, cortesia, etc..."
                        />
                      </div>

                      {/* Resumo Consolidado Final */}
                      <div className="bg-zinc-950/60 p-4 border border-zinc-900 rounded-xl space-y-2">
                        {checkoutTotals.discount > 0 && (
                          <div className="flex justify-between text-[11px] text-zinc-400">
                            <span>Desconto Aplicado</span>
                            <span className="font-mono text-red-400">-{formatBRL(checkoutTotals.discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-extrabold text-white border-t border-zinc-900 pt-2 font-sans">
                          <span>Total a Pagar</span>
                          <span className="text-yellow-500 font-mono filter drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]">
                            {formatBRL(checkoutTotals.total)}
                          </span>
                        </div>
                      </div>

                      <Button type="submit" className="w-full bg-green-500 hover:bg-green-400 text-black font-extrabold h-11 rounded-xl text-xs uppercase tracking-wider gap-2">
                        <CheckCircle2 className="w-4 h-4 text-black" /> Liquidar Caixa & Repassar Comissões
                      </Button>
                    </form>
                  )}
                </DialogContent>
              </Dialog>

            </motion.div>
          )}

          {/* TAB 2: AGENDA TRADICIONAL & HISTÓRICO */}
          {activePageTab === 'traditional' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              
              <div className="flex justify-between items-center flex-wrap gap-4">
                <h3 className="text-lg font-bold font-heading text-white">Cronograma e Agendamentos Históricos</h3>
                
                <div className="flex items-center gap-3">
                  
                  {/* Novo Agendamento */}
                  <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button className="bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 font-bold px-4 py-2 rounded-xl flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Novo Agendamento Físico
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] bg-[#0c0d0f] border-zinc-850 text-white max-h-[90vh] overflow-y-auto w-full">
                      <DialogHeader>
                        <DialogTitle className="font-heading text-lg text-[#D4AF37]">{editingItem ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Cliente</Label>
                          <Select required value={formData.clientId} onValueChange={(v) => setFormData(p => ({...p, clientId: v}))}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-white">{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Serviço</Label>
                          <Select required value={formData.serviceId} onValueChange={(v) => setFormData(p => ({...p, serviceId: v}))}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-white">{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({formatBRL(s.price)})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Profissional</Label>
                          <Select required value={formData.professionalId} onValueChange={(v) => setFormData(p => ({...p, professionalId: v}))}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="Quem irá atender?" /></SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800 text-white">{professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <Label className="text-zinc-300">Data</Label>
                             <Input required type="date" value={formData.date} onChange={e => setFormData(p => ({...p, date: e.target.value}))} className="bg-zinc-900 border-zinc-800 text-white" />
                           </div>
                           <div className="space-y-2">
                             <Label className="text-zinc-300">Horário</Label>
                             {formData.serviceId && formData.professionalId && formData.date ? (
                               <Select required value={formData.time} onValueChange={(v) => setFormData(p => ({...p, time: v}))}>
                                 <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                                   <SelectValue placeholder={availableSlotsList.length > 0 ? "Escolha" : "Sem vagas"} />
                                 </SelectTrigger>
                                 <SelectContent className="bg-zinc-950 border-zinc-800 text-white max-h-60">
                                   {availableSlotsList.length === 0 ? (
                                     <SelectItem value={formData.time || "none"} disabled>Nenhum horário livre</SelectItem>
                                   ) : (
                                     availableSlotsList.map(t => (
                                       <SelectItem key={t} value={t}>{t}</SelectItem>
                                     ))
                                   )}
                                 </SelectContent>
                               </Select>
                             ) : (
                               <Input required type="time" value={formData.time} onChange={e => setFormData(p => ({...p, time: e.target.value}))} className="bg-zinc-900 border-zinc-800 text-white" />
                             )}
                           </div>
                        </div>
                        {editingItem && (
                           <div className="space-y-2">
                             <Label className="text-zinc-300">Status</Label>
                             <Select value={formData.status} onValueChange={(v: any) => setFormData(p => ({...p, status: v}))}>
                               <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                               <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                                  <SelectItem value="scheduled">Agendado</SelectItem>
                                  <SelectItem value="completed">Concluído</SelectItem>
                                  <SelectItem value="canceled">Cancelado</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                        )}
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Observações</Label>
                          <Input value={formData.notes} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} className="bg-zinc-900 border-zinc-800 text-white" placeholder="Opcional..." />
                        </div>
                        <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-11 rounded-xl">
                          {editingItem ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Lançamento manual avulso */}
                  {['owner', 'manager', 'receptionist', 'attendant'].includes(userRole) && (
                    <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:text-white hover:bg-white/[0.02] rounded-xl text-xs h-10 px-4">
                          <FileText className="w-4 h-4 mr-1.5 text-[#D4AF37]" /> Lançamento de Caixa
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px] bg-[#0c0d10] border-zinc-850 text-white max-h-[90vh] overflow-y-auto w-full">
                        <DialogHeader>
                          <DialogTitle className="font-heading text-white text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[#D4AF37]" /> Lançamento Manual Avulso
                          </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleManualSubmit} className="space-y-4 pt-4 text-xs">
                          <div className="space-y-2">
                            <Label className="text-zinc-400">Tipo de Lançamento</Label>
                            <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => setManualFormData(p => ({ ...p, type: 'service' }))}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                  manualFormData.type === 'service' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25' : 'text-zinc-400'
                                }`}
                              >
                                <Scissors className="w-3.5 h-3.5 mr-1 inline" /> Serviço
                              </button>
                              <button
                                type="button"
                                onClick={() => setManualFormData(p => ({ ...p, type: 'product' }))}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                                  manualFormData.type === 'product' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25' : 'text-zinc-400'
                                }`}
                              >
                                <ShoppingBag className="w-3.5 h-3.5 mr-1 inline" /> Produto
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-zinc-400">Profissional Relacionado</Label>
                            <Select required value={manualFormData.professionalId} onValueChange={(v) => setManualFormData(p => ({ ...p, professionalId: v }))}>
                              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white"><SelectValue placeholder="Escolha quem executou/vendeu" /></SelectTrigger>
                              <SelectContent className="bg-zinc-950 border-zinc-850 text-white">
                                {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-zinc-400">Base de Serviço (Opcional)</Label>
                            <Select value={manualFormData.serviceId} onValueChange={handleManualServiceChange}>
                              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white"><SelectValue placeholder="Deixe avulso ou selecione" /></SelectTrigger>
                              <SelectContent className="bg-zinc-950 border-zinc-850 text-white">
                                <SelectItem value="custom">-- Digitar Manual (Avulso) --</SelectItem>
                                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({formatBRL(s.price)})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          {(manualFormData.serviceId === 'custom' || !manualFormData.serviceId) && (
                            <div className="space-y-2">
                              <Label className="text-zinc-400">Nome do {manualFormData.type === 'service' ? 'Serviço' : 'Produto'}</Label>
                              <Input
                                required
                                value={manualFormData.customName}
                                onChange={e => setManualFormData(p => ({ ...p, customName: e.target.value }))}
                                className="bg-zinc-900 border-zinc-800 text-white"
                                placeholder={`Ex: ${manualFormData.type === 'service' ? 'Penteado Clássico' : 'Defrizante'}`}
                              />
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label className="text-zinc-400">Preço R$</Label>
                            <Input
                              required
                              type="number"
                              step="0.01"
                              value={manualFormData.price}
                              onChange={e => setManualFormData(p => ({ ...p, price: e.target.value }))}
                              className="bg-zinc-900 border-zinc-800 text-white"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-zinc-400">Data do Lançamento</Label>
                            <Input
                              required
                              type="date"
                              value={manualFormData.date}
                              onChange={e => setManualFormData(p => ({ ...p, date: e.target.value }))}
                              className="bg-zinc-900 border-zinc-800 text-white"
                            />
                          </div>

                          <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-11 rounded-xl">
                            Salvar Lançamento Direto
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {appointments.length === 0 ? (
                <Card className="border-zinc-900 bg-[#09090b]/80">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center text-zinc-500 text-xs">
                    <CalendarIcon className="w-8 h-8 text-[#D4AF37] mb-2" />
                    <p>Sem agendamentos clássicos cadastrados no momento.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {appointments.map((app) => (
                    <Card key={app.id} className="bg-zinc-950 border-zinc-900 hover:border-zinc-800 transition-all relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4AF37]" />
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                          
                          <div className="flex items-center gap-4 min-w-[200px]">
                            <div className="text-center shrink-0 w-16 bg-zinc-900/60 p-2 rounded-xl border border-zinc-900">
                              <p className="text-[10px] text-zinc-500 font-bold uppercase">{new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                              <p className="text-xl font-extrabold text-[#D4AF37] font-mono leading-none pt-0.5">{app.date.split('-')[2]}</p>
                              <p className="text-[9px] text-zinc-500 font-mono">{app.date.split('-')[1]}/{app.date.split('-')[0].substring(2)}</p>
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                                <span className="font-mono text-xs text-white font-bold">{app.time}</span>
                                {app.status === 'completed' ? (
                                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-md">Concluído</span>
                                ) : app.status === 'canceled' ? (
                                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md">Cancelado</span>
                                ) : app.status === 'confirmed' ? (
                                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md">Confirmado</span>
                                ) : (
                                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] rounded-md">Agendado</span>
                                )}
                                {app.source === 'client_booking' ? (
                                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md">Online</span>
                                ) : (
                                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-md">Manual</span>
                                )}
                              </div>
                              <h4 className="font-bold text-sm text-white">{app.clientName}</h4>
                              {app.clientPhone && (
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{app.clientPhone}</p>
                              )}
                              <p className="text-xs text-zinc-400 mt-0.5">{app.serviceName} com <span className="text-[#D4AF37]">{app.professionalName}</span></p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 bg-zinc-900/40 p-2 rounded-xl">
                            {(app.status === 'scheduled' || app.status === 'confirmed') && (
                              <>
                                {app.status === 'scheduled' && (
                                  <Button variant="outline" size="sm" onClick={() => changeStatus(app.id, 'confirmed')} className="w-full sm:w-auto h-8 text-blue-400 border-blue-500/10 hover:bg-blue-500/10 text-[10px] uppercase font-bold">
                                    Confirmar
                                  </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => changeStatus(app.id, 'completed')} className="w-full sm:w-auto h-8 text-green-400 border-green-500/10 hover:bg-green-500/10 text-[10px] uppercase font-bold">
                                  Concluir
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => changeStatus(app.id, 'canceled')} className="w-full sm:w-auto h-8 text-zinc-500 hover:text-red-400 text-[10px] uppercase font-bold">
                                  Cancelar
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openEdit(app)} className="h-8 w-8">
                              <Edit2 className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                            </Button>
                          </div>

                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      )}

    </div>
  );
}

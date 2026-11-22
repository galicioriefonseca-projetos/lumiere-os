import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  Appointment,
  AppointmentStatus,
  Client,
  ClientNotice,
  ComandaFlow,
  ComandaItem,
  Professional,
  ProfessionalGoal,
  SalonResource,
  Service,
  ServicePackage,
} from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Loader2, Plus, Calendar as CalendarIcon, CalendarPlus, Clock, Edit2, ShoppingBag, 
  Scissors, FileText, Check, Trash2, ArrowRight, DollarSign, Sparkles, 
  UserPlus, Percent, CreditCard, ChevronRight, CheckCircle2, AlertCircle, ShoppingCart,
  Receipt, DoorOpen
} from 'lucide-react';
import { formatBRL, cn } from '@/lib/utils';
import { triggerAppointmentPushNotification } from '../../lib/pushNotifications';
import { motion, AnimatePresence } from 'motion/react';
import { getAvailableSlots } from '../../lib/availability';
import { useLexicon } from '../../hooks/useLexicon';
import {
  CalendarPrefillEvent,
  GoogleCalendarDialog,
} from '@/components/workspace/GoogleCalendarDialog';
import { buildEventDescriptionFromAppointment } from '@/services/calendarService';
import { LumiereAgendaView } from '@/components/appointments/LumiereAgendaView';
import { WhatsAppSettingsDialog } from '@/components/appointments/WhatsAppSettingsDialog';
import { ComandaModal360 } from '@/components/comandas/ComandaModal360';
import { OpenComandasModal } from '@/components/comandas/OpenComandasModal';
import { updateAppointmentStatusApi } from '@/services/appointmentsService';
import { subscribeClientNotices } from '@/services/clientsService';
import { ClientActiveNoticesBanner } from '@/components/clients/ClientActiveNoticesBanner';

export default function AppointmentsPage() {
  const { salonData, userData } = useAuth();
  const { 
    segment, 
    lex, 
    isBeauty, 
    clientTerm, 
    clientTermPlural, 
    workstationTerm, 
    flowItemTerm, 
    flowItemTermPlural, 
    isClinic, 
    isStudio, 
    isFreelancer,
    uiPreferences
  } = useLexicon();
  const userRole = userData?.role || 'professional';

  const [activePageTab, setActivePageTab] = useState<'flow' | 'traditional'>(
    userRole === 'professional'
      ? 'traditional'
      : uiPreferences.enableComandasFlow
        ? 'flow'
        : 'traditional'
  );

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [comandas, setComandas] = useState<ComandaFlow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [resources, setResources] = useState<SalonResource[]>([]);
  const [professionalGoals, setProfessionalGoals] = useState<ProfessionalGoal[]>([]);
  const [clientNotices, setClientNotices] = useState<ClientNotice[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [isNewComandaOpen, setIsNewComandaOpen] = useState(false);
  const [isComanda360Open, setIsComanda360Open] = useState(false);
  const [comanda360InitialTab, setComanda360InitialTab] = useState<'items' | 'payment' | 'prontuario' | 'info'>('items');
  const [isOpenComandasModalOpen, setIsOpenComandasModalOpen] = useState(false);
  const [isGoogleCalendarOpen, setIsGoogleCalendarOpen] = useState(false);
  const [isWhatsAppSettingsOpen, setIsWhatsAppSettingsOpen] = useState(false);
  const [calendarDialogTab, setCalendarDialogTab] = useState<'events' | 'create' | 'sync'>('events');
  const [calendarPrefillEvent, setCalendarPrefillEvent] = useState<CalendarPrefillEvent | null>(null);

  // States auxiliares de fluxo
  const [selectedComanda, setSelectedComanda] = useState<ComandaFlow | null>(null);
  const [editingItem, setEditingItem] = useState<Appointment | null>(null);

  const openGoogleCalendarDialog = (tab: 'events' | 'create' | 'sync' = 'events') => {
    setCalendarPrefillEvent(null);
    setCalendarDialogTab(tab);
    setIsGoogleCalendarOpen(true);
  };

  const openGoogleCalendarForAppointment = (app: Appointment) => {
    const clientMatch = clients.find((c) => c.id === app.clientId);
    const serviceMatch = services.find((s) => s.id === app.serviceId);
    const duration = app.serviceDuration || serviceMatch?.durationMinutes || 60;
    const attendeeEmail = app.clientEmail || clientMatch?.email || '';

    setCalendarPrefillEvent({
      summary: `${app.serviceName} — ${app.clientName}`,
      date: app.date,
      startTime: app.time || '09:00',
      durationMinutes: duration >= 5 ? duration : 60,
      location: salonData?.name || '',
      description: buildEventDescriptionFromAppointment(
        app,
        clientMatch?.phone,
        clientMatch?.email
      ),
      attendeesEmails: attendeeEmail,
    });
    setCalendarDialogTab('create');
    setIsGoogleCalendarOpen(true);
  };

  // Formulário Agenda Tradicional & Bloqueio
  const [formData, setFormData] = useState({
    clientId: '',
    professionalId: '',
    serviceId: '',
    resourceId: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    notes: '',
    status: 'scheduled' as AppointmentStatus,
    isBlock: false,
    blockDuration: 60,
  });

  // Slots de disponibilidade para o profissional e data selecionados no form
  const availableSlotsList = useMemo(() => {
    if (formData.isBlock || !salonData || !salonData.workingHours || !formData.date || !formData.serviceId) {
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

    if (formData.time && !slots.includes(formData.time)) {
      slots.push(formData.time);
      slots.sort();
    }

    return slots;
  }, [salonData, formData.isBlock, formData.date, formData.serviceId, formData.professionalId, formData.time, appointments, services]);

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

  // Carregar Dados do Salão
  useEffect(() => {
    if (!salonData?.id) return;

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
        if (item.isActive !== false && !item.deletedAt) {
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

    // Carregar Pacotes
    const qPkg = query(collection(db, `salons/${salonData.id}/packages`));
    unsubs.push(onSnapshot(qPkg, snap => {
      const arr: ServicePackage[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as ServicePackage));
      setPackages(arr.filter(p => p.isActive));
    }, (error) => {
      console.error("Erro ao carregar pacotes:", error);
    }));

    // Carregar Salas e Equipamentos
    const qRes = query(collection(db, `salons/${salonData.id}/resources`));
    unsubs.push(onSnapshot(qRes, snap => {
      const arr: SalonResource[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as SalonResource));
      setResources(arr.filter(r => r.isActive));
    }, (error) => {
      console.error("Erro ao carregar recursos:", error);
    }));

    // Carregar Metas dos Profissionais para Previsibilidade na Agenda (respeitando firestore.rules)
    if (['owner', 'admin', 'manager', 'platform_admin'].includes(userRole)) {
      const qGoals = query(collection(db, `salons/${salonData.id}/professionalGoals`));
      unsubs.push(onSnapshot(qGoals, snap => {
        const arr: ProfessionalGoal[] = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() } as ProfessionalGoal));
        setProfessionalGoals(arr);
      }, (error) => {
        console.error("Erro ao carregar metas para previsibilidade:", error);
      }));
    } else if (userRole === 'professional' && userData?.id) {
      const qOwnGoals = query(
        collection(db, `salons/${salonData.id}/professionalGoals`),
        where('professionalId', '==', userData.id)
      );
      unsubs.push(onSnapshot(qOwnGoals, snap => {
        const arr: ProfessionalGoal[] = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() } as ProfessionalGoal));
        setProfessionalGoals(arr);
      }, (error) => {
        console.error("Erro ao carregar metas do profissional:", error);
      }));
    }

    // Carregar Avisos de Atendimento de Clientes
    unsubs.push(subscribeClientNotices(salonData.id, setClientNotices));

    return () => unsubs.forEach(u => u());
  }, [salonData, userRole, userData?.id]);

  // Handler para trocar status de agendamento tradicional
  const changeStatus = async (id: string, newStatus: AppointmentStatus) => {
    if (!salonData) return;
    try {
      const now = Date.now();
      const statusPatch: Record<string, unknown> = {
        status: newStatus,
        updatedAt: now,
      };
      if (newStatus === 'confirmed') {
        statusPatch.confirmationStatus = 'confirmed_by_client';
        statusPatch.confirmedAt = now;
      } else if (newStatus === 'canceled') {
        statusPatch.canceledAt = now;
      }

      if (userRole === 'professional') {
        await updateAppointmentStatusApi(salonData.id, id, newStatus);
      } else {
        await updateDoc(doc(db, `salons/${salonData.id}/appointments`, id), statusPatch);
      }
      toast.success('Status atualizado com sucesso!');

      const appointment = appointments.find(a => a.id === id);
      if (appointment && (newStatus === 'confirmed' || newStatus === 'canceled')) {
        triggerAppointmentPushNotification({
          salonId: salonData.id,
          appointmentId: id,
          professionalId: appointment.professionalId,
          professionalName: appointment.professionalName,
          clientName: appointment.clientName || 'Cliente',
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

  // Handler para submeter agendamento tradicional (Editar / Criar / Bloqueio)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const professional = professionals.find(p => p.id === formData.professionalId);
      const professionalName = professional ? professional.name : '';

      if (formData.isBlock) {
        if (!formData.professionalId || !formData.date || !formData.time) {
          toast.error('Informe profissional, data e horário para bloquear.');
          return;
        }
        const blockPayload = {
          clientId: 'bloqueio',
          clientName: 'Bloqueio de Horário',
          professionalId: formData.professionalId,
          professionalName,
          serviceId: 'bloqueio',
          serviceName: 'Bloqueio de Agenda',
          price: 0,
          serviceDuration: Number(formData.blockDuration) || 60,
          date: formData.date,
          time: formData.time,
          notes: formData.notes || 'Horário bloqueado pela equipe',
          status: 'blocked' as AppointmentStatus,
          isBlock: true,
          source: 'manual' as const,
          updatedAt: Date.now(),
        };

        if (editingItem) {
          const ref = doc(db, `salons/${salonData.id}/appointments`, editingItem.id);
          await updateDoc(ref, blockPayload);
          toast.success('Bloqueio atualizado!');
        } else {
          const ref = doc(collection(db, `salons/${salonData.id}/appointments`));
          await setDoc(ref, {
            id: ref.id,
            ...blockPayload,
            createdAt: Date.now(),
          });
          toast.success('Horário bloqueado na agenda!');
        }
        setIsDialogOpen(false);
        resetForm();
        return;
      }

      const clientMatch = clients.find(c => c.id === formData.clientId);
      const clientName = clientMatch?.name || 'Consumidor Final';
      const service = services.find(s => s.id === formData.serviceId);
      const serviceName = service ? service.name : '';
      const price = service ? service.price : 0;
      const resourceMatch = resources.find(r => r.id === formData.resourceId);

      const dataToSave = {
        clientId: formData.clientId,
        clientName,
        clientPhone: clientMatch?.phone || editingItem?.clientPhone || '',
        clientEmail: clientMatch?.email || editingItem?.clientEmail || '',
        professionalId: formData.professionalId,
        professionalName,
        serviceId: formData.serviceId,
        serviceName,
        resourceId: resourceMatch ? resourceMatch.id : '',
        resourceName: resourceMatch ? resourceMatch.name : '',
        price,
        serviceDuration: service ? service.durationMinutes : 30,
        date: formData.date,
        time: formData.time,
        notes: formData.notes,
        status: formData.status,
        isBlock: false,
        source: editingItem ? (editingItem.source || 'manual') : 'manual',
        updatedAt: Date.now()
      };

      let savedApptId = editingItem?.id || '';
      if (editingItem) {
        const ref = doc(db, `salons/${salonData.id}/appointments`, editingItem.id);
        await updateDoc(ref, dataToSave);
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/appointments`));
        savedApptId = ref.id;
        await setDoc(ref, {
          id: ref.id,
          ...dataToSave,
          createdAt: Date.now(),
        });
        toast.success('Agendamento registrado!');
      }

      const statusChanged = !editingItem || editingItem.status !== formData.status;
      if (
        savedApptId &&
        formData.professionalId &&
        statusChanged &&
        (formData.status === 'confirmed' || formData.status === 'canceled')
      ) {
        triggerAppointmentPushNotification({
          salonId: salonData.id,
          appointmentId: savedApptId,
          professionalId: formData.professionalId,
          professionalName,
          clientName,
          serviceName: serviceName || 'Procedimento',
          date: formData.date,
          time: formData.time,
          action: formData.status === 'canceled' ? 'cancel' : 'confirm',
        }).catch(err => console.error('[Push notification error]', err));
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar agendamento.');
    }
  };

  const handleDeleteAppointment = async (app: Appointment) => {
    if (!salonData) return;
    try {
      if (
        !app.isBlock &&
        app.professionalId &&
        app.status !== 'canceled' &&
        app.status !== 'completed'
      ) {
        await triggerAppointmentPushNotification({
          salonId: salonData.id,
          appointmentId: app.id,
          professionalId: app.professionalId,
          professionalName: app.professionalName,
          clientName: app.clientName || 'Cliente',
          serviceName: app.serviceName || 'Procedimento',
          date: app.date,
          time: app.time,
          action: 'cancel',
        }).catch(() => undefined);
      }
      await deleteDoc(doc(db, `salons/${salonData.id}/appointments`, app.id));
      toast.success(app.isBlock ? 'Bloqueio removido da agenda!' : 'Agendamento excluído!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir agendamento.');
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      clientId: '',
      professionalId: '',
      serviceId: '',
      resourceId: '',
      date: new Date().toISOString().split('T')[0],
      time: '',
      notes: '',
      status: 'scheduled',
      isBlock: false,
      blockDuration: 60,
    });
  };

  const openQuickCreate = (prefill: {
    date: string;
    time?: string;
    professionalId?: string;
    isBlock?: boolean;
  }) => {
    setEditingItem(null);
    setFormData({
      clientId: '',
      professionalId: prefill.professionalId || '',
      serviceId: '',
      resourceId: '',
      date: prefill.date || new Date().toISOString().split('T')[0],
      time: prefill.time || '',
      notes: '',
      status: prefill.isBlock ? 'blocked' : 'scheduled',
      isBlock: Boolean(prefill.isBlock),
      blockDuration: 60,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (app: Appointment) => {
    setEditingItem(app);
    setFormData({
      clientId: app.clientId,
      professionalId: app.professionalId,
      serviceId: app.serviceId,
      resourceId: app.resourceId || '',
      date: app.date,
      time: app.time,
      notes: app.notes || '',
      status: app.status,
      isBlock: Boolean(app.isBlock || app.status === 'blocked'),
      blockDuration: Number(app.serviceDuration) || 60,
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
  // FLUXO DE COMANDAS INTELIGENTES (COMANDA 360°)
  // ============================================

  const openComandasList = useMemo(
    () => comandas.filter((c) => c.status !== 'completed' && c.status !== 'canceled'),
    [comandas]
  );

  // Classificação das comandas ativas pelas colunas de fluxo
  const comandasByStatus = useMemo(() => {
    return {
      checked_in: openComandasList.filter(c => c.status === 'checked_in'),
      in_service: openComandasList.filter(c => c.status === 'in_service'),
      checkout_pending: openComandasList.filter(c => c.status === 'checkout_pending')
    };
  }, [openComandasList]);

  const openComandaModal = (
    comanda: ComandaFlow,
    tab: 'items' | 'payment' | 'prontuario' | 'info' = 'items'
  ) => {
    setSelectedComanda(comanda);
    setComanda360InitialTab(tab);
    setIsComanda360Open(true);
  };

  // Abrir ou criar comanda automaticamente a partir de um agendamento da Agenda
  const handleOpenComandaFromAppointment = async (app: Appointment) => {
    if (!salonData) return;

    const existing = openComandasList.find(
      (c) =>
        (app.comandaId && c.id === app.comandaId) ||
        (app.clientId &&
          app.clientId !== 'consumidor-final' &&
          c.clientId === app.clientId &&
          c.date === app.date)
    );

    if (existing) {
      openComandaModal(existing, 'items');
      return;
    }

    try {
      const svc = services.find((s) => s.id === app.serviceId);
      const itemPrice = app.price !== undefined ? app.price : (svc?.price || 0);
      const nextNum =
        comandas.reduce((max, c) => Math.max(max, Number(c.comandaNumber || 0)), 0) + 1;

      const initialItem: ComandaItem = {
        type: 'service',
        id: app.serviceId || 'custom-service',
        name: app.serviceName || 'Atendimento',
        price: itemPrice,
        quantity: 1,
        unitPrice: itemPrice,
        discountPercent: 0,
        professionalId: app.professionalId || '',
        professionalName: app.professionalName || 'Profissional',
        appointmentId: app.id,
      };

      const ref = doc(collection(db, `salons/${salonData.id}/comandas`));
      const newComanda: ComandaFlow = {
        id: ref.id,
        comandaNumber: nextNum,
        clientId: app.clientId || 'consumidor-final',
        clientName: app.clientName || 'Consumidor Final',
        status: 'in_service',
        items: [initialItem],
        totalAmount: itemPrice,
        date: app.date || new Date().toISOString().substring(0, 10),
        time: app.time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        notes: app.notes || '',
        openedByName: userData?.fullName || userData?.email || 'Recepção',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(ref, newComanda);
      if (app.id && userRole !== 'professional') {
        await updateDoc(doc(db, `salons/${salonData.id}/appointments`, app.id), {
          comandaId: ref.id,
          updatedAt: Date.now(),
        });
      }

      toast.success(`Comanda #${nextNum} aberta para ${newComanda.clientName}!`);
      openComandaModal(newComanda, 'items');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar comanda a partir do agendamento.');
    }
  };

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

      const nextNum =
        comandas.reduce((max, c) => Math.max(max, Number(c.comandaNumber || 0)), 0) + 1;

      const initialItem: ComandaItem = {
        type: 'service',
        id: service.id,
        name: service.name,
        price: service.price,
        quantity: 1,
        unitPrice: service.price,
        discountPercent: 0,
        professionalId: professional.id,
        professionalName: professional.name
      };

      const ref = doc(collection(db, `salons/${salonData.id}/comandas`));
      const createdComanda: ComandaFlow = {
        id: ref.id,
        comandaNumber: nextNum,
        clientId: comandaFormData.clientId,
        clientName,
        status: 'checked_in',
        items: [initialItem],
        totalAmount: service.price,
        date: new Date().toISOString().substring(0, 10),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        notes: comandaFormData.notes || '',
        openedByName: userData?.fullName || userData?.email || 'Recepção',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await setDoc(ref, createdComanda);

      toast.success(`Comanda #${nextNum} aberta! Abrindo painel 360°...`);
      setIsNewComandaOpen(false);
      setComandaFormData({
        clientId: 'consumidor-final',
        clientName: 'Consumidor Final',
        professionalId: '',
        serviceId: '',
        notes: ''
      });
      openComandaModal(createdComanda, 'items');
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao abrir a comanda.');
    }
  };

  // Cancelar/Descartar Comanda por completo
  const handleDeleteComanda = async (comandaId: string) => {
    if (!salonData) return;
    if (!window.confirm("Deseja realmente cancelar e descartar esta comanda?")) return;

    try {
      await deleteDoc(doc(db, `salons/${salonData.id}/comandas`, comandaId));
      toast.success('Comanda cancelada!');
    } catch (err) {
      toast.error('Erro ao cancelar comanda.');
    }
  };

  if (loading || !salonData?.id) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#8A6D36]" />
        <span className="text-xs text-[#6B6B6B] font-medium">Sincronizando Agenda LumièreOS...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" id="appointments-page">
      
      {/* Header Central de Atendimentos (Warm-Light Editorial) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E5E2DC] shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#171717] flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#8A6D36]" />
            {lex.appointments || 'Agenda & Comandas'}
          </h2>
          <p className="text-[#6B6B6B] text-xs mt-1">
            {isBeauty 
              ? 'Gerencie horários, confirmações via WhatsApp, previsibilidade de metas e comandas 360° em um só lugar.'
              : 'Gestão completa de horários, recursos, fechamento de comandas e fluxo de atendimentos.'}
          </p>
        </div>

        {/* Escolha de Visualização + Comandas Abertas + Google Agenda */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpenComandasModalOpen(true)}
            className="h-9 px-3 rounded-xl border-[#B89B5E]/50 bg-[#FAF9F7] text-[#171717] hover:bg-[#EFECE4] text-xs font-semibold gap-1.5 whitespace-nowrap shrink-0"
          >
            <Receipt className="w-3.5 h-3.5 text-[#8A6D36]" />
            <span>Comandas Abertas</span>
            <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-[#171717] text-white text-[10px] font-bold tabular-nums">
              {openComandasList.length}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => openGoogleCalendarDialog('events')}
            className="h-9 px-3.5 rounded-xl border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#FAF9F7] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#8A6D36]" />
            Google Agenda
          </Button>

          <div className="flex items-center gap-1 bg-[#FAF9F7] p-1 rounded-xl border border-[#E5E2DC]">
            <button
              type="button"
              onClick={() => setActivePageTab('traditional')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer',
                activePageTab === 'traditional'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#6B6B6B] hover:text-[#171717]'
              )}
            >
              {lex.appointments || 'Agenda & Calendário'}
            </button>

            <button
              type="button"
              onClick={() => setActivePageTab('flow')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer',
                activePageTab === 'flow'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#6B6B6B] hover:text-[#171717]'
              )}
            >
              {uiPreferences.enableComandasFlow ? 'Fluxo de Comandas' : `Fluxo de ${flowItemTermPlural || 'Atendimentos'}`}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#8A6D36]" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          
          {/* TAB 1: FLUXO DE COMANDAS / ATENDIMENTO */}
          {activePageTab === 'flow' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex justify-end gap-3">
                {/* Lançar Comanda / Fluxo */}
                <Dialog open={isNewComandaOpen} onOpenChange={setIsNewComandaOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#171717] text-white hover:bg-[#2c2c2c] font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs whitespace-nowrap">
                      <UserPlus className="w-4 h-4 text-[#D4AF37]" /> Abrir Nova Comanda (Check-In {clientTerm.toLowerCase()})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-[#E5E2DC] text-[#171717] max-w-sm rounded-2xl">
                    <DialogHeader>
                      <DialogTitle className="font-heading text-[#171717] text-lg flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-[#8A6D36]" /> Abrir {flowItemTerm}
                      </DialogTitle>
                      <CardDescription className="text-[#6B6B6B] text-xs">
                        O(A) {clientTerm.toLowerCase()} acabou de chegar. Defina quem irá realizar o primeiro atendimento no(a) {workstationTerm.toLowerCase()}.
                      </CardDescription>
                    </DialogHeader>

                    <form onSubmit={handleInitComanda} className="space-y-4 pt-2 text-xs">
                      <div className="space-y-1.5">
                        <Label className="text-[#171717]">{clientTerm}</Label>
                        <Select value={comandaFormData.clientId} onValueChange={(v) => setComandaFormData(p => ({ ...p, clientId: v }))}>
                          <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]">
                            <SelectValue placeholder={`Escolha um(a) ${clientTerm.toLowerCase()} cadastrado(a)`} />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                            <SelectItem value="consumidor-final">-- Consumidor Final (Sem Cadastro) --</SelectItem>
                            {clients.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <ClientActiveNoticesBanner
                        notices={clientNotices}
                        client={clients.find((c) => c.id === comandaFormData.clientId)}
                        trigger="onComanda"
                        theme="light"
                      />

                      <div className="space-y-1.5">
                        <Label className="text-[#171717]">Profissional Inicial</Label>
                        <Select required value={comandaFormData.professionalId} onValueChange={(v) => setComandaFormData(p => ({ ...p, professionalId: v }))}>
                          <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]">
                            <SelectValue placeholder="Selecione quem fará o primeiro atendimento" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                            {professionals.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[#171717]">Serviço de Entrada</Label>
                        <Select required value={comandaFormData.serviceId} onValueChange={(v) => setComandaFormData(p => ({ ...p, serviceId: v }))}>
                          <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]">
                            <SelectValue placeholder="Qual o procedimento inicial?" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                            {services.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name} ({formatBRL(s.price)})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[#171717]">Anotações Internas (Opcional)</Label>
                        <Input 
                          value={comandaFormData.notes} 
                          onChange={e => setComandaFormData(p => ({ ...p, notes: e.target.value }))}
                          className="bg-[#FAF9F7] border-[#E5E2DC] text-[#171717]"
                          placeholder="Recomendações técnicas..."
                        />
                      </div>

                      <Button type="submit" className="w-full bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold h-10 rounded-xl">
                        Abrir {flowItemTerm} 360°
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Quadro Board de Fluxos Operacionais (Warm-Light Architecture) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUNA 1: ESPERA / CHECK-IN */}
                <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 flex flex-col space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#171717]">
                      Fila / Recepção
                    </span>
                    <span className="text-xs font-bold text-[#8A6D36] tabular-nums">
                      {comandasByStatus.checked_in.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                    {comandasByStatus.checked_in.length === 0 ? (
                      <p className="text-xs text-[#6B6B6B] py-6 text-center">Nenhum(a) {clientTerm.toLowerCase()} aguardando na fila.</p>
                    ) : (
                      comandasByStatus.checked_in.map(c => (
                        <Card key={c.id} className="bg-[#FAF9F7] border border-[#E5E2DC] p-4 rounded-xl space-y-3 shadow-none">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-bold text-[#171717]">{c.clientName}</h4>
                              <p className="text-[11px] text-[#6B6B6B] tabular-nums">
                                Comanda #{c.comandaNumber || c.id.substring(0, 4)} · {c.time}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteComanda(c.id)} className="h-7 w-7 text-[#6B6B6B] hover:text-rose-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="space-y-1">
                            {c.items.map((itm, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E2DC]/70 text-[#171717]">
                                <span className="truncate max-w-[140px]">{itm.name}</span>
                                <span className="text-[#6B6B6B] font-semibold tabular-nums">{formatBRL(itm.price)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openComandaModal(c, 'items')} className="border-[#E5E2DC] bg-white text-[#171717] text-[11px] h-8 hover:bg-[#EFECE4] rounded-lg whitespace-nowrap">
                              Abrir 360°
                            </Button>
                            <Button size="sm" onClick={() => handleMoveComanda(c.id, 'in_service')} className="flex-1 bg-[#171717] text-white text-[11px] h-8 hover:bg-[#2c2c2c] gap-1 rounded-lg whitespace-nowrap">
                              Acolher <ArrowRight className="w-3 h-3 text-[#D4AF37]" />
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUNA 2: EM ATENDIMENTO */}
                <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 flex flex-col space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#171717]">
                      Em Atendimento ({workstationTerm})
                    </span>
                    <span className="text-xs font-bold text-emerald-700 tabular-nums">
                      {comandasByStatus.in_service.length}
                    </span>
                  </div>

                  <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px]">
                    {comandasByStatus.in_service.length === 0 ? (
                      <p className="text-xs text-[#6B6B6B] py-6 text-center">Nenhum(a) {clientTerm.toLowerCase()} em atendimento agora.</p>
                    ) : (
                      comandasByStatus.in_service.map(c => (
                        <Card key={c.id} className="bg-[#FAF9F7] border border-[#E5E2DC] p-4 rounded-xl space-y-3 shadow-none">
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold text-[#171717]">{c.clientName}</h4>
                              <p className="text-[11px] text-[#6B6B6B] flex items-center gap-1 tabular-nums">
                                <Clock className="w-3 h-3 text-[#8A6D36]" /> #{c.comandaNumber || c.id.substring(0, 4)} · {c.time}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-[#8A6D36] tabular-nums">{formatBRL(c.totalAmount)}</span>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            {c.items.map((itm, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E2DC]/70">
                                <div className="min-w-0 pr-2">
                                   <span className="text-[#171717] block font-medium truncate">{itm.name}</span>
                                   <span className="text-[10px] text-[#6B6B6B]">{itm.professionalName}</span>
                                </div>
                                <span className="font-semibold text-[#171717] tabular-nums shrink-0">{formatBRL(itm.price)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openComandaModal(c, 'items')} 
                              className="bg-white border-[#E5E2DC] text-[#171717] text-[11px] h-8 hover:bg-[#EFECE4] rounded-lg flex items-center gap-1 font-semibold whitespace-nowrap"
                            >
                              <Edit2 className="w-3 h-3 text-[#8A6D36]" /> Comanda 360°
                            </Button>
                            
                            <Button 
                              size="sm" 
                              onClick={() => handleMoveComanda(c.id, 'checkout_pending')} 
                              className="bg-[#171717] text-white text-[11px] h-8 hover:bg-[#2c2c2c] rounded-lg flex items-center gap-1 font-semibold whitespace-nowrap"
                            >
                              Enviar Caixa <ArrowRight className="w-3 h-3 text-[#D4AF37]" />
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* COLUNA 3: NO CAIXA / AGUARDANDO CHECKOUT */}
                <div className="bg-white border border-[#E5E2DC] rounded-2xl p-4 flex flex-col space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#171717]">
                      Caixa / Fechamento
                    </span>
                    <span className="text-xs font-bold text-[#8A6D36] tabular-nums">
                      {comandasByStatus.checkout_pending.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                    {comandasByStatus.checkout_pending.length === 0 ? (
                      <p className="text-xs text-[#6B6B6B] py-6 text-center">Nenhum(a) {clientTerm.toLowerCase()} aguardando fechamento.</p>
                    ) : (
                      comandasByStatus.checkout_pending.map(c => (
                        <Card key={c.id} className="bg-[#FAF9F7] border border-[#E5E2DC] p-4 rounded-xl space-y-3 shadow-none">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-bold text-[#171717]">{c.clientName}</h4>
                              <p className="text-[11px] text-[#6B6B6B] tabular-nums">{c.items.length} itens para recebimento</p>
                            </div>
                            <span className="text-xs font-bold text-[#8A6D36] tabular-nums">{formatBRL(c.totalAmount)}</span>
                          </div>

                          <div className="space-y-1 max-h-[120px] overflow-y-auto">
                            {c.items.map((itm, idx) => (
                              <div key={idx} className="flex justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E2DC]/70">
                                <span className="text-[#171717] truncate max-w-[140px]">{itm.name}</span>
                                <span className="text-[#6B6B6B] font-semibold tabular-nums">{formatBRL(itm.price)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2 pt-1 border-t border-[#E5E2DC]">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleMoveComanda(c.id, 'in_service')} 
                              className="bg-white border-[#E5E2DC] text-[#6B6B6B] text-[11px] h-8 hover:text-[#171717] rounded-lg whitespace-nowrap"
                            >
                              Voltar
                            </Button>
                            
                            <Button 
                              size="sm" 
                              onClick={() => openComandaModal(c, 'payment')} 
                              className="flex-1 bg-emerald-700 text-white text-[11px] h-8 hover:bg-emerald-800 font-semibold gap-1.5 rounded-lg whitespace-nowrap"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Receber Comanda 360°
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 2: AGENDA INTELIGENTE LUMIÈREOS (DIA / SEMANA / MÊS + WHATSAPP + PREVISIBILIDADE) */}
          {activePageTab === 'traditional' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Ação rápida de Lançamento Manual Avulso para Recepção/Gestão */}
              {['owner', 'manager', 'receptionist', 'attendant'].includes(userRole) && (
                <div className="flex justify-end">
                  <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#FAF9F7] rounded-xl text-xs h-9 px-3.5">
                        <FileText className="w-3.5 h-3.5 mr-1.5 text-[#8A6D36]" /> Lançamento Direto no Caixa
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
                </div>
              )}

              {/* Novo Agendamento / Bloqueio Dialog */}
              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}
              >
                <DialogContent className="sm:max-w-[440px] bg-white border-[#E5E2DC] text-[#171717] max-h-[90vh] overflow-y-auto w-full rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-lg text-[#171717]">
                      {editingItem
                        ? formData.isBlock
                          ? 'Editar Bloqueio de Horário'
                          : 'Editar Agendamento'
                        : formData.isBlock
                          ? 'Bloquear Horário na Agenda'
                          : 'Novo Agendamento'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
                    {!editingItem && (
                      <div className="grid grid-cols-2 gap-2 bg-[#FAF9F7] p-1 rounded-xl border border-[#E5E2DC]">
                        <button
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, isBlock: false, status: 'scheduled' }))}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            !formData.isBlock ? 'bg-[#171717] text-white' : 'text-[#6B6B6B]'
                          }`}
                        >
                          Agendamento
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, isBlock: true, status: 'blocked' }))}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            formData.isBlock ? 'bg-[#171717] text-white' : 'text-[#6B6B6B]'
                          }`}
                        >
                          Bloqueio de Horário
                        </button>
                      </div>
                    )}

                    {!formData.isBlock && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-[#171717]">Cliente</Label>
                          <Select required value={formData.clientId} onValueChange={(v) => setFormData(p => ({ ...p, clientId: v }))}>
                            <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                            <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <ClientActiveNoticesBanner
                          notices={clientNotices}
                          client={clients.find((c) => c.id === formData.clientId)}
                          trigger="onSchedule"
                          theme="light"
                        />
                        <div className="space-y-1.5">
                          <Label className="text-[#171717]">Serviço</Label>
                          <Select required value={formData.serviceId} onValueChange={(v) => setFormData(p => ({ ...p, serviceId: v }))}>
                            <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                            <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                              {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({formatBRL(s.price)})</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-[#171717]">Profissional</Label>
                      <Select required value={formData.professionalId} onValueChange={(v) => setFormData(p => ({ ...p, professionalId: v }))}>
                        <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]"><SelectValue placeholder="Escolha o profissional" /></SelectTrigger>
                        <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                          {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {!formData.isBlock && resources.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-[#171717] flex items-center gap-1.5">
                          <DoorOpen className="w-3.5 h-3.5 text-[#8A6D36]" /> Sala ou Equipamento (Opcional)
                        </Label>
                        <Select
                          value={formData.resourceId || 'none'}
                          onValueChange={(v) => setFormData(p => ({ ...p, resourceId: v === 'none' ? '' : v }))}
                        >
                          <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]">
                            <SelectValue placeholder="Nenhum recurso vinculado" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                            <SelectItem value="none">Nenhum (Atendimento padrão)</SelectItem>
                            {resources.map(r => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name} ({r.quantity} un.)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[#171717]">Data</Label>
                        <Input required type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} className="bg-[#FAF9F7] border-[#E5E2DC] text-[#171717]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[#171717]">Horário</Label>
                        {!formData.isBlock && formData.serviceId && formData.professionalId && formData.date && availableSlotsList.length > 0 ? (
                          <Select required value={formData.time} onValueChange={(v) => setFormData(p => ({ ...p, time: v }))}>
                            <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC] text-[#171717]">
                              <SelectValue placeholder="Escolha" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#E5E2DC] text-[#171717] max-h-60">
                              {availableSlotsList.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input required type="time" value={formData.time} onChange={e => setFormData(p => ({ ...p, time: e.target.value }))} className="bg-[#FAF9F7] border-[#E5E2DC] text-[#171717]" />
                        )}
                      </div>
                    </div>

                    {formData.isBlock && (
                      <div className="space-y-1.5">
                        <Label className="text-[#171717]">Duração do Bloqueio</Label>
                        <Select
                          value={String(formData.blockDuration)}
                          onValueChange={(v) => setFormData(p => ({ ...p, blockDuration: Number(v) }))}
                        >
                          <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                            <SelectItem value="30">30 minutos</SelectItem>
                            <SelectItem value="60">1 hora</SelectItem>
                            <SelectItem value="90">1h 30min</SelectItem>
                            <SelectItem value="120">2 horas</SelectItem>
                            <SelectItem value="240">4 horas (Meio período)</SelectItem>
                            <SelectItem value="480">8 horas (Dia inteiro)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {editingItem && !formData.isBlock && (
                      <div className="space-y-1.5">
                        <Label className="text-[#171717]">Status</Label>
                        <Select value={formData.status} onValueChange={(v: AppointmentStatus) => setFormData(p => ({ ...p, status: v }))}>
                          <SelectTrigger className="bg-[#FAF9F7] border-[#E5E2DC]"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white border-[#E5E2DC] text-[#171717]">
                            <SelectItem value="scheduled">Agendado</SelectItem>
                            <SelectItem value="confirmed">Confirmado</SelectItem>
                            <SelectItem value="waiting">Na Recepção</SelectItem>
                            <SelectItem value="in_service">Em Atendimento</SelectItem>
                            <SelectItem value="completed">Concluído</SelectItem>
                            <SelectItem value="canceled">Cancelado</SelectItem>
                            <SelectItem value="no_show">Não Compareceu</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-[#171717]">{formData.isBlock ? 'Motivo do Bloqueio' : 'Observações'}</Label>
                      <Input
                        value={formData.notes}
                        onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                        className="bg-[#FAF9F7] border-[#E5E2DC] text-[#171717]"
                        placeholder={formData.isBlock ? 'Ex: Almoço, compromisso externo...' : 'Opcional...'}
                      />
                    </div>

                    <Button type="submit" className="w-full bg-[#171717] hover:bg-[#2c2c2c] text-white font-semibold h-11 rounded-xl">
                      {editingItem
                        ? 'Salvar Alterações'
                        : formData.isBlock
                          ? 'Confirmar Bloqueio'
                          : 'Confirmar Agendamento'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <LumiereAgendaView
                salonData={salonData}
                appointments={appointments}
                clients={clients}
                professionals={professionals}
                services={services}
                goals={professionalGoals}
                notices={clientNotices}
                userRole={userRole}
                currentUserId={userData?.id}
                canManageGoals={['owner', 'admin', 'manager', 'platform_admin', 'professional'].includes(userRole)}
                canEditAppointments={['owner', 'admin', 'manager', 'receptionist', 'attendant', 'platform_admin'].includes(userRole)}
                onQuickCreate={openQuickCreate}
                onEditAppointment={openEdit}
                onChangeStatus={changeStatus}
                onDeleteAppointment={handleDeleteAppointment}
                onOpenGoogleCalendar={(mode, app) => {
                  if (mode === 'create' && app) {
                    openGoogleCalendarForAppointment(app);
                  } else {
                    openGoogleCalendarDialog(mode);
                  }
                }}
                onOpenWhatsAppSettings={
                  ['owner', 'admin', 'manager', 'platform_admin'].includes(userRole)
                    ? () => setIsWhatsAppSettingsOpen(true)
                    : undefined
                }
                openComandasCount={openComandasList.length}
                onOpenComandasList={() => setIsOpenComandasModalOpen(true)}
                onOpenComandaFromAppointment={handleOpenComandaFromAppointment}
              />
            </motion.div>
          )}

        </AnimatePresence>
      )}

      <OpenComandasModal
        open={isOpenComandasModalOpen}
        onOpenChange={setIsOpenComandasModalOpen}
        comandas={comandas}
        onSelectComanda={(c) => {
          setIsOpenComandasModalOpen(false);
          openComandaModal(c, 'items');
        }}
        onNewComanda={() => {
          setActivePageTab('flow');
          setIsNewComandaOpen(true);
        }}
      />

      <ComandaModal360
        open={isComanda360Open}
        onOpenChange={setIsComanda360Open}
        salonId={salonData.id}
        comanda={selectedComanda}
        clients={clients}
        professionals={professionals}
        services={services}
        packages={packages}
        appointments={appointments}
        currentUserName={userData?.fullName || userData?.email || 'Equipe'}
        initialTab={comanda360InitialTab}
        onFinalized={() => {
          setSelectedComanda(null);
        }}
      />

      <WhatsAppSettingsDialog
        open={isWhatsAppSettingsOpen}
        onOpenChange={setIsWhatsAppSettingsOpen}
        salonId={salonData.id}
        appointments={appointments}
      />

      <GoogleCalendarDialog
        open={isGoogleCalendarOpen}
        onOpenChange={(nextOpen) => {
          setIsGoogleCalendarOpen(nextOpen);
          if (!nextOpen) {
            setCalendarPrefillEvent(null);
          }
        }}
        initialTab={calendarDialogTab}
        prefillEvent={calendarPrefillEvent}
        appointments={appointments}
        clients={clients}
        salonName={salonData?.name}
      />

    </div>
  );
}

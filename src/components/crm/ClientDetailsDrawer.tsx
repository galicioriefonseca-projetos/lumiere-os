import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, setDoc, updateDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { Client, ClientHistory, Appointment } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  X, Calendar, Phone, Mail, Clock, MessageSquare, Tag, UserCheck, 
  Trash2, Archive, CheckSquare, Sparkles, Plus, Check, FileText, TrendingUp
} from 'lucide-react';

interface ClientDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  salonId: string;
  currentUser: any;
  userRole: string;
  professionals: any[];
  services: any[];
  onClientUpdated: () => void;
}

export default function ClientDetailsDrawer({
  isOpen,
  onClose,
  client,
  salonId,
  currentUser,
  userRole,
  professionals,
  services,
  onClientUpdated,
}: ClientDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'actions' | 'appointments' | 'history'>('info');
  const [histories, setHistories] = useState<ClientHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(false);

  // Edit fields state
  const [crmStage, setCrmStage] = useState<Client['crmStage']>('new');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<Client['source']>('whatsapp');
  const [sourceLabel, setSourceLabel] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Quick Action / Action Logging State
  const [contactType, setContactType] = useState<'phone' | 'whatsapp' | 'email' | 'meeting' | 'note'>('whatsapp');
  const [contactNotes, setContactNotes] = useState('');

  // Next action scheduling state
  const [nextActionType, setNextActionType] = useState<Client['nextActionType']>('whatsapp');
  const [nextActionDate, setNextActionDate] = useState('');

  // Quick Appointment form state
  const [apptProfId, setApptProfId] = useState('');
  const [apptServiceId, setApptServiceId] = useState('');
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState('');
  const [apptNotes, setApptNotes] = useState('');

  // Permissions Checks
  const isProfessionalRole = userRole === 'professional';
  const isReceptionistRole = userRole === 'receptionist' || userRole === 'attendant';
  const isManagerOrOwner = userRole === 'owner' || userRole === 'manager' || userRole === 'admin' || userRole === 'platform_admin';

  // Format WhatsApp Link
  const formatWhatsAppLink = (phoneNum: string) => {
    const clean = phoneNum.replace(/\D/g, '');
    if (!clean) return '';
    if (clean.startsWith('55') && clean.length >= 12) {
      return `https://wa.me/${clean}`;
    }
    if (clean.length === 10 || clean.length === 11) {
      return `https://wa.me/55${clean}`;
    }
    return `https://wa.me/${clean}`;
  };

  // Pre-populate states
  useEffect(() => {
    if (client) {
      setCrmStage(client.crmStage || 'new');
      setName(client.name || '');
      setPhone(client.phone || '');
      setEmail(client.email || '');
      setNotes(client.notes || '');
      setSource(client.source || 'whatsapp');
      setSourceLabel(client.sourceLabel || '');
      setResponsibleId(client.responsibleId || 'none');
      setTags(client.tags || []);
      setNextActionType(client.nextActionType || 'whatsapp');
      setNextActionDate(client.nextActionAt || '');
      
      // Load History and Appointments
      loadHistory();
      loadAppointments();
      setActiveTab('info');
    }
  }, [client]);

  const loadHistory = async () => {
    if (!client || !salonId) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, `salons/${salonId}/clients/${client.id}/history`),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: ClientHistory[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as ClientHistory);
      });
      setHistories(list);
    } catch (err) {
      console.error("Error loading client history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadAppointments = async () => {
    if (!client || !salonId) return;
    setLoadingAppts(true);
    try {
      const q = query(
        collection(db, `salons/${salonId}/appointments`),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: Appointment[] = [];
      snap.forEach(d => {
        const ad = d.data();
        if (ad.clientId === client.id) {
          list.push({ id: d.id, ...ad } as Appointment);
        }
      });
      setAppointments(list);
    } catch (err) {
      console.error("Error loading client appointments:", err);
    } finally {
      setLoadingAppts(false);
    }
  };

  const addHistoryRecord = async (
    type: ClientHistory['type'],
    title: string,
    description: string,
    prevVal?: string,
    newVal?: string
  ) => {
    if (!client || !salonId || !currentUser) return;
    try {
      const histId = doc(collection(db, `salons/${salonId}/clients/${client.id}/history`)).id;
      const userName = currentUser.displayName || currentUser.email || 'Recepção';
      const payload: ClientHistory = {
        id: histId,
        type,
        title,
        description,
        previousValue: prevVal || '',
        newValue: newVal || '',
        createdBy: currentUser.uid,
        createdByName: userName,
        createdAt: Date.now()
      };
      await setDoc(doc(db, `salons/${salonId}/clients/${client.id}/history`, histId), payload);
      setHistories(prev => [payload, ...prev]);
    } catch (err) {
      console.error("Error adding history:", err);
    }
  };

  // Save changes handler
  const handleSaveChanges = async () => {
    if (!client || !salonId) return;
    try {
      const selectedResponsibleObj = professionals.find(p => p.id === responsibleId);
      const responsibleName = selectedResponsibleObj ? selectedResponsibleObj.name : '';

      const updatedPayload: Partial<Client> = {
        name,
        phone,
        email,
        notes,
        crmStage,
        source,
        sourceLabel,
        responsibleId: responsibleId === 'none' ? '' : responsibleId,
        responsibleName: responsibleId === 'none' ? '' : responsibleName,
        tags,
        updatedAt: Date.now(),
        updatedBy: currentUser?.uid || '',
      };

      await updateDoc(doc(db, `salons/${salonId}/clients/${client.id}`), updatedPayload);

      // Determine changes to log History
      if (crmStage !== client.crmStage) {
        await addHistoryRecord(
          'stage_changed',
          'Etapa CRM Atualizada',
          `Etapa alterada de "${client.crmStage || 'Não definida'}" para "${crmStage}"`,
          client.crmStage || 'None',
          crmStage
        );
      } else {
        await addHistoryRecord(
          'data_updated',
          'Dados do Cliente Editados',
          'Informações básicas do perfil atualizadas.'
        );
      }

      toast.success('Perfil do cliente atualizado!');
      onClientUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar dados.');
    }
  };

  // Add tag
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter(item => item !== t));
  };

  // Log contact notes
  const handleLogContactNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !contactNotes.trim()) return;

    try {
      const typeLabels = {
        phone: 'Ligação realizada',
        whatsapp: 'Contato WhatsApp',
        email: 'E-mail enviado',
        meeting: 'Visita presencial',
        note: 'Observação Interna'
      };

      await addHistoryRecord(
        'contact_logged',
        typeLabels[contactType],
        contactNotes.trim()
      );

      // Update last active
      await updateDoc(doc(db, `salons/${salonId}/clients/${client.id}`), {
        lastContactAt: new Date().toISOString().split('T')[0],
        updatedAt: Date.now(),
      });

      toast.success('Ação de contato registrada!');
      setContactNotes('');
      onClientUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar.');
    }
  };

  // Manage Next action
  const handleSaveNextAction = async () => {
    if (!client) return;

    try {
      await updateDoc(doc(db, `salons/${salonId}/clients/${client.id}`), {
        nextActionAt: nextActionDate,
        nextActionType,
        updatedAt: Date.now(),
      });

      const types = {
        whatsapp: 'Mandar WhatsApp',
        call: 'Ligação de retorno',
        schedule: 'Agendamento sugerido',
        return: 'Alerta de retorno futuro',
        note: 'Verificar observação',
        other: 'Ação customizada'
      };

      await addHistoryRecord(
        'data_updated',
        'Próxima Ação Planejada',
        `Ação "${tags[nextActionType || 'whatsapp'] || types[nextActionType || 'whatsapp']}" agendada para ${nextActionDate || 'Próximo contato'}`
      );

      toast.success('Próxima ação salva!');
      onClientUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar próxima ação.');
    }
  };

  const handleClearNextAction = async () => {
    if (!client) return;
    try {
      await updateDoc(doc(db, `salons/${salonId}/clients/${client.id}`), {
        nextActionAt: '',
        nextActionType: 'whatsapp',
        updatedAt: Date.now()
      });
      await addHistoryRecord(
        'data_updated',
        'Próxima Ação Concluída',
        'Profissional ou recepção concluiu ou removeu plano de ação pendente.'
      );
      setNextActionDate('');
      toast.success('Ação pendente limpa / concluída!');
      onClientUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  // Schedule Quick Appointment
  const handleQuickApptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !apptProfId || !apptServiceId || !apptDate || !apptTime) {
      toast.error('Preencha os campos obrigatórios do agendamento.');
      return;
    }

    try {
      const selectedProfObj = professionals.find(p => p.id === apptProfId);
      const selectedSvcObj = services.find(s => s.id === apptServiceId);

      const ref = doc(collection(db, `salons/${salonId}/appointments`));
      const payload: Appointment = {
        id: ref.id,
        clientId: client.id,
        clientName: client.name,
        professionalId: apptProfId,
        professionalName: selectedProfObj?.name || 'Profissional',
        serviceId: apptServiceId,
        serviceName: selectedSvcObj?.name || 'Serviço',
        date: apptDate,
        time: apptTime,
        status: 'scheduled',
        notes: apptNotes,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(ref, payload);

      // Log to history
      await addHistoryRecord(
        'appointment_created',
        'Novo Agendamento Criado',
        `Agendado ${selectedSvcObj?.name} com ${selectedProfObj?.name} para o dia ${apptDate} às ${apptTime}.`
      );

      // Auto update crmStage to scheduled!
      if (crmStage !== 'scheduled') {
        setCrmStage('scheduled');
        await updateDoc(doc(db, `salons/${salonId}/clients/${client.id}`), {
          crmStage: 'scheduled',
          updatedAt: Date.now()
        });
        await addHistoryRecord(
          'stage_changed',
          'Etapa CRM Atualizada',
          'Movido automaticamente para "Agendado" devido a criação de agendamento.',
          crmStage,
          'scheduled'
        );
      }

      toast.success('Agendamento realizado com sucesso!');
      
      // Reset Appt Form
      setApptProfId('');
      setApptServiceId('');
      setApptDate('');
      setApptTime('');
      setApptNotes('');
      
      loadAppointments();
      onClientUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao agendar.');
    }
  };

  // Archive (Soft delete)
  const handleArchiveClient = async () => {
    if (!client || !salonId) return;
    if (!window.confirm(`Tem certeza de que deseja ARQUIVAR o cliente "${client.name}"?`)) return;

    try {
      await updateDoc(doc(db, `salons/${salonId}/clients/${client.id}`), {
        status: 'inactive',
        archived: true,
        updatedAt: Date.now(),
        updatedBy: currentUser?.uid || ''
      });

      await addHistoryRecord(
        'data_updated',
        'Cliente Arquivado',
        'O cliente foi movido para os arquivos inativos para manter integridade de históricos.'
      );

      toast.success('Cliente arquivado com sucesso!');
      onClose();
      onClientUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao arquivar cliente.');
    }
  };

  const getStageLabel = (stageId: string) => {
    const maps: Record<string, string> = {
      new: 'Novo contato',
      in_service: 'Em atendimento',
      scheduled: 'Agendado',
      follow_up: 'Em acompanhamento',
      future_return: 'Retorno futuro',
      active: 'Cliente ativo',
      inactive_lost: 'Inativo / Perdido'
    };
    return maps[stageId] || stageId;
  };

  return (
    <AnimatePresence>
      {isOpen && client && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50 cursor-pointer"
          />

          {/* Panel */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-[#0c0c0e] border-l border-zinc-800 shadow-2xl z-50 flex flex-col h-full text-zinc-100 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-[#121215]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#1b1b22] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-bold text-lg">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-heading font-medium tracking-tight flex items-center gap-2">
                    {client.name}
                    {client.archived && <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">Arquivado</span>}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-400">Origem: </span>
                    <span className="text-xs bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded capitalize">
                      {client.source === 'other' ? (client.sourceLabel || 'Outro') : (client.source || 'Não especificada')}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 h-9 w-9">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Quick action triggers */}
            <div className="px-6 py-3 border-b border-zinc-800 bg-[#121215]/50 flex gap-2 overflow-x-auto">
              {client.phone && (
                <a
                  href={formatWhatsAppLink(client.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-3 py-1.5 rounded-lg font-medium transition shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" /> Enviar WhatsApp
                </a>
              )}
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-2 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 px-3 py-1.5 rounded-lg font-medium transition shrink-0"
                >
                  <Mail className="w-3.5 h-3.5" /> Enviar E-mail
                </a>
              )}
              {isManagerOrOwner && (
                <Button
                  onClick={handleArchiveClient}
                  variant="ghost"
                  className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/10 px-3 py-1.5 rounded-lg font-medium shrink-0 ml-auto h-auto"
                >
                  <Archive className="w-3.5 h-3.5 mr-1" /> Arquivar
                </Button>
              )}
            </div>

            {/* Tab selection */}
            <div className="flex border-b border-zinc-800 bg-[#0e0e11] shrink-0">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'info' ? 'border-[#D4AF37] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Informações
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'actions' ? 'border-[#D4AF37] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Contatos & Próxima Ação
              </button>
              <button
                onClick={() => setActiveTab('appointments')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'appointments' ? 'border-[#D4AF37] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Agendamentos
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'history' ? 'border-[#D4AF37] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Histórico ({histories.length})
              </button>
            </div>

            {/* Scrollable contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Financial Statistics Card - Hidden for receptionists if restricted */}
                  {isManagerOrOwner && (
                    <div className="grid grid-cols-3 gap-4 bg-[#121215] border border-zinc-800 p-4 rounded-xl">
                      <div>
                        <div className="text-zinc-500 text-xs flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> LTV Bruto
                        </div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">
                          R$ {(client.lifetimeValue || client.totalSpent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Atendimentos
                        </div>
                        <div className="text-lg font-bold text-white mt-1">
                          {client.totalAppointments || appointments.filter(a => a.status === 'completed').length || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Ticket Médio
                        </div>
                        <div className="text-lg font-bold text-indigo-400 mt-1">
                          R$ {((client.lifetimeValue || 0) / (client.totalAppointments || 1)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Profile Edit Form */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold tracking-wider text-[#D4AF37] uppercase">Dados do Cliente</h4>

                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Nome Completo</Label>
                      <Input
                        id="edit-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-[#121215] border-zinc-800 rounded-lg text-white"
                        disabled={isProfessionalRole}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-phone">Celular / WhatsApp</Label>
                        <Input
                          id="edit-phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="bg-[#121215] border-zinc-800 rounded-lg text-white"
                          disabled={isProfessionalRole}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-email">E-mail (Opcional)</Label>
                        <Input
                          id="edit-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-[#121215] border-zinc-800 rounded-lg text-white"
                          disabled={isProfessionalRole}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Etapa do CRM</Label>
                        <Select
                          value={crmStage}
                          onValueChange={(val: any) => setCrmStage(val)}
                          disabled={isProfessionalRole}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 rounded-lg">
                            <SelectValue placeholder="Selecione a etapa" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                            <SelectItem value="new">Novo contato</SelectItem>
                            <SelectItem value="in_service">Em atendimento</SelectItem>
                            <SelectItem value="scheduled">Agendado</SelectItem>
                            <SelectItem value="follow_up">Em acompanhamento</SelectItem>
                            <SelectItem value="future_return">Retorno futuro</SelectItem>
                            <SelectItem value="active">Cliente ativo</SelectItem>
                            <SelectItem value="inactive_lost">Inativo / Perdido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Origem do Contato</Label>
                        <Select
                          value={source || 'whatsapp'}
                          onValueChange={(val: any) => setSource(val)}
                          disabled={isProfessionalRole}
                        >
                          <SelectTrigger className="bg-[#121215] border-zinc-800 rounded-lg">
                            <SelectValue placeholder="Selecione a origem" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="google">Google Maps/Busca</SelectItem>
                            <SelectItem value="indication">Indicação</SelectItem>
                            <SelectItem value="walk_in">Entrou no salão (Walk-in)</SelectItem>
                            <SelectItem value="other">Outro / Customizado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {source === 'other' && (
                      <div className="space-y-2">
                        <Label htmlFor="custom-source">Descreva a Origem</Label>
                        <Input
                          id="custom-source"
                          value={sourceLabel}
                          onChange={(e) => setSourceLabel(e.target.value)}
                          placeholder="Ex: Anúncio do Facebook, Revista, etc."
                          className="bg-[#121215] border-zinc-800 rounded-lg text-white"
                          disabled={isProfessionalRole}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Responsável (Acompanhamento)</Label>
                      <Select
                        value={responsibleId || 'none'}
                        onValueChange={(val) => setResponsibleId(val)}
                        disabled={isProfessionalRole}
                      >
                        <SelectTrigger className="bg-[#121215] border-zinc-800 rounded-lg">
                          <SelectValue placeholder="Selecione o profissional responsável" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                          <SelectItem value="none">Nenhum (Livre na Recepção)</SelectItem>
                          {professionals.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Marcadores / Tags</Label>
                      <div className="flex gap-2">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          placeholder="Ex: quimica, loira, noiva"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                          className="bg-[#121215] border-zinc-800 rounded-lg flex-1 text-white"
                          disabled={isProfessionalRole}
                        />
                        <Button type="button" onClick={handleAddTag} variant="outline" className="border-zinc-800 hover:bg-zinc-800" disabled={isProfessionalRole}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 bg-[#1a1a24] text-amber-400 border border-amber-400/20 px-2 py-1 rounded text-xs capitalize"
                          >
                            #{t}
                            {!isProfessionalRole && (
                              <button type="button" onClick={() => handleRemoveTag(t)} className="text-zinc-500 hover:text-white ml-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-notes">Observações e Alergias</Label>
                      <textarea
                        id="edit-notes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Insira detalhes como preferências, alergias de produtos químicos ou cronogramas de hidratação..."
                        className="w-full bg-[#121215] text-zinc-100 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-[#D4AF37]/50"
                      />
                    </div>

                    {!isProfessionalRole && (
                      <Button onClick={handleSaveChanges} className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold rounded-lg mt-2">
                        Salvar Alterações do Cliente
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'actions' && (
                <div className="space-y-6">
                  {/* Próxima Ação Planejada */}
                  <div className="bg-[#121215] border border-zinc-800 p-5 rounded-xl space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold text-[#D4AF37] flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-[#D4AF37]" /> Próxima Ação Relacionada
                      </h4>
                      {client.nextActionAt && (
                        <Button onClick={handleClearNextAction} size="sm" variant="ghost" className="text-xs text-zinc-400 hover:text-emerald-400">
                          <Check className="w-3.5 h-3.5 mr-1" /> Marcar como Concluída
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Ação</Label>
                        <Select
                          value={nextActionType || 'whatsapp'}
                          onValueChange={(val: any) => setNextActionType(val)}
                        >
                          <SelectTrigger className="bg-background border-zinc-800 rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                            <SelectItem value="whatsapp">WhatsApp (Retorno)</SelectItem>
                            <SelectItem value="call">Telefonar</SelectItem>
                            <SelectItem value="schedule">Sugerir Agendamento</SelectItem>
                            <SelectItem value="return">Notificação pós-visita</SelectItem>
                            <SelectItem value="note">Revisar Notas</SelectItem>
                            <SelectItem value="other">Outra Ação</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Data Limite</Label>
                        <Input
                          type="date"
                          value={nextActionDate}
                          onChange={(e) => setNextActionDate(e.target.value)}
                          className="bg-background border-zinc-800 text-white rounded-lg"
                        />
                      </div>
                    </div>

                    <Button onClick={handleSaveNextAction} className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-10 rounded-lg">
                      Agendar Próxima Ação
                    </Button>
                  </div>

                  {/* Registrar Contato Manual */}
                  <form onSubmit={handleLogContactNotes} className="bg-[#121215] border border-zinc-800 p-5 rounded-xl space-y-4">
                    <h4 className="text-sm font-semibold text-[#D4AF37] flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#D4AF37]" /> Registrar Atividade Realizada
                    </h4>

                    <div className="space-y-2">
                      <Label>Como foi feito?</Label>
                      <Select
                        value={contactType}
                        onValueChange={(val: any) => setContactType(val)}
                      >
                        <SelectTrigger className="bg-background border-zinc-800 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                          <SelectItem value="whatsapp">Mandei WhatsApp</SelectItem>
                          <SelectItem value="phone">Liguei para o cliente</SelectItem>
                          <SelectItem value="meeting">Atendi presencialmente</SelectItem>
                          <SelectItem value="email">Enviei E-mail</SelectItem>
                          <SelectItem value="note">Apenas observação interna</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-note">Resumo do Contato / Negociação</Label>
                      <textarea
                        id="contact-note"
                        rows={3}
                        required
                        value={contactNotes}
                        onChange={(e) => setContactNotes(e.target.value)}
                        placeholder="Digite o resumo do que foi conversado ou observado..."
                        className="w-full bg-[#0c0c0e] text-zinc-100 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-[#D4AF37]/50"
                      />
                    </div>

                    <Button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium h-10 rounded-lg">
                      Registrar no Histórico
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === 'appointments' && (
                <div className="space-y-6">
                  {/* Quick Appointment Form */}
                  <form onSubmit={handleQuickApptSubmit} className="bg-[#121215] border border-zinc-800 p-5 rounded-xl space-y-4">
                    <h4 className="text-sm font-semibold text-[#D4AF37] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#D4AF37]" /> Novo Agendamento Rápido
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Profissional</Label>
                        <Select required value={apptProfId} onValueChange={setApptProfId}>
                          <SelectTrigger className="bg-background border-zinc-800 rounded-lg">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                            {professionals.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Serviço</Label>
                        <Select required value={apptServiceId} onValueChange={setApptServiceId}>
                          <SelectTrigger className="bg-background border-zinc-800 rounded-lg">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#121215] border-zinc-800 text-white">
                            {services.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name} - R$ {s.price}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data</Label>
                        <Input
                          type="date"
                          required
                          value={apptDate}
                          onChange={(e) => setApptDate(e.target.value)}
                          className="bg-background border-zinc-800 text-white rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Horário</Label>
                        <Input
                          type="time"
                          required
                          value={apptTime}
                          onChange={(e) => setApptTime(e.target.value)}
                          className="bg-background border-zinc-800 text-white rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="appt-notes">Observação para o Servidor (Opcional)</Label>
                      <Input
                        id="appt-notes"
                        value={apptNotes}
                        onChange={(e) => setApptNotes(e.target.value)}
                        placeholder="Ex: Vai lavar o cabelo, etc."
                        className="bg-[#0c0c0e] border-zinc-800 rounded-lg text-white"
                      />
                    </div>

                    <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold h-10 rounded-lg">
                      Agendar Visita
                    </Button>
                  </form>

                  {/* Appointments History List */}
                  <div className="space-y-3">
                    <h4 className="text-zinc-400 font-medium text-xs tracking-wider uppercase">Histórico de Visitas ({appointments.length})</h4>
                    
                    {loadingAppts ? (
                      <div className="text-center py-4 text-xs text-zinc-500">Buscando agendamentos...</div>
                    ) : appointments.length === 0 ? (
                      <div className="text-center py-8 text-zinc-600 bg-[#121215]/30 border border-zinc-800/10 rounded-xl text-xs">
                        Nenhum agendamento encontrado para este cliente.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {appointments.map((appt) => (
                          <div key={appt.id} className="bg-[#121215] border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-white">{appt.serviceName}</div>
                              <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                <span>👤 {appt.professionalName}</span>
                                <span>•</span>
                                <span>📅 {appt.date.split('-').reverse().join('/')} às {appt.time}</span>
                              </div>
                              {appt.notes && <p className="text-xs text-zinc-400 mt-2 bg-black/20 p-2 rounded border border-white/5">{appt.notes}</p>}
                            </div>
                            <div>
                              <span className={`text-[10px] font-medium px-2 py-1 rounded-full uppercase border ${
                                appt.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                appt.status === 'no_show' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                appt.status === 'canceled' ? 'bg-zinc-800 border-zinc-700 text-zinc-400' :
                                'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                              }`}>
                                {appt.status === 'completed' ? 'concluído' :
                                 appt.status === 'no_show' ? 'falta' :
                                 appt.status === 'canceled' ? 'cancelado' :
                                 'agendado'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h4 className="text-zinc-400 font-medium text-xs tracking-wider uppercase">Linha do Tempo de Relações</h4>
                  
                  {loadingHistory ? (
                    <div className="text-center py-4 text-xs text-zinc-500">Buscando histórico...</div>
                  ) : histories.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600 bg-[#121215]/30 border border-zinc-800/10 rounded-xl text-xs">
                      Linha do tempo limpa. Todas as interações aparecerão aqui.
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-zinc-800 ml-3 pl-5 space-y-5 py-2">
                      {histories.map((hist) => {
                        const typesMap = {
                          created: '⚡',
                          stage_changed: '🔄',
                          note_added: '📝',
                          contact_logged: '📞',
                          appointment_created: '📅',
                          data_updated: '💾'
                        };
                        return (
                          <div key={hist.id} className="relative">
                            {/* Dot */}
                            <span className="absolute -left-[30px] top-0 w-5 h-5 rounded-full bg-[#1b1b22] border-2 border-zinc-800 flex items-center justify-center text-xs shadow">
                              {typesMap[hist.type] || '✨'}
                            </span>
                            <div>
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <h5 className="font-semibold text-sm text-zinc-200 leading-none">{hist.title}</h5>
                                <span className="text-[10px] text-zinc-500">
                                  {new Date(hist.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{hist.description}</p>
                              <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1 capitalize">
                                <span>Por {hist.createdByName || 'Sistema'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

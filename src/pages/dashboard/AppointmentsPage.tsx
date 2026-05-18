import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Appointment, Client, Professional, Service } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Calendar as CalendarIcon, Clock, Edit2 } from 'lucide-react';
import { formatBRL } from '@/lib/utils';

export default function AppointmentsPage() {
  const { salonData } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Appointment | null>(null);

  const [formData, setFormData] = useState({
    clientId: '',
    professionalId: '',
    serviceId: '',
    date: '',
    time: '',
    notes: '',
    status: 'scheduled' as Appointment['status']
  });

  useEffect(() => {
    if (!salonData) return;

    const unsubs: (() => void)[] = [];

    // Load Appointments
    const qa = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(onSnapshot(qa, (snapshot) => {
      const arr: Appointment[] = [];
      snapshot.forEach(d => arr.push({ id: d.id, ...d.data() } as Appointment));
      setAppointments(arr.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()));
      setLoading(false);
    }));

    // Load Clients
    const qc = query(collection(db, `salons/${salonData.id}/clients`));
    unsubs.push(onSnapshot(qc, snap => {
      const arr: Client[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Client));
      setClients(arr);
    }));

    // Load Professionals
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(onSnapshot(qp, snap => {
      const arr: Professional[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Professional));
      setProfessionals(arr.filter(p => p.isActive));
    }));

    // Load Services
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    unsubs.push(onSnapshot(qs, snap => {
      const arr: Service[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Service));
      setServices(arr.filter(s => s.isActive));
    }));

    return () => unsubs.forEach(u => u());
  }, [salonData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const clientName = clients.find(c => c.id === formData.clientId)?.name || '';
      const professionalName = professionals.find(p => p.id === formData.professionalId)?.name || '';
      const serviceName = services.find(s => s.id === formData.serviceId)?.name || '';

      const dataToSave = {
        ...formData,
        clientName,
        professionalName,
        serviceName,
        updatedAt: Date.now()
      };

      if (editingItem) {
        const ref = doc(db, `salons/${salonData.id}/appointments`, editingItem.id);
        await updateDoc(ref, dataToSave);
        toast.success('Agendamento atualizado!');
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/appointments`));
        await setDoc(ref, {
          id: ref.id,
          ...dataToSave,
          createdAt: Date.now(),
        });
        toast.success('Agendamento criado!');
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
    setFormData({ clientId: '', professionalId: '', serviceId: '', date: '', time: '', notes: '', status: 'scheduled' });
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

  const changeStatus = async (id: string, newStatus: Appointment['status']) => {
    if (!salonData) return;
    try {
      await updateDoc(doc(db, `salons/${salonData.id}/appointments`, id), {
        status: newStatus,
        updatedAt: Date.now()
      });
      toast.success('Status atualizado.');
    } catch(e) {
      toast.error('Erro ao atualizar status.');
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <span className="text-[10px] uppercase font-bold px-2 py-1 bg-green-500/20 text-green-400 rounded-full">Concluído</span>;
      case 'canceled': return <span className="text-[10px] uppercase font-bold px-2 py-1 bg-destructive/20 text-destructive rounded-full">Cancelado</span>;
      default: return <span className="text-[10px] uppercase font-bold px-2 py-1 bg-primary/20 text-primary rounded-full">Agendado</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light">Agendamentos</h2>
          <p className="text-muted-foreground text-sm">Gerencie a agenda do salão.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">{editingItem ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select required value={formData.clientId} onValueChange={(v) => setFormData(p => ({...p, clientId: v}))}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select required value={formData.serviceId} onValueChange={(v) => setFormData(p => ({...p, serviceId: v}))}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                  <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({formatBRL(s.price)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select required value={formData.professionalId} onValueChange={(v) => setFormData(p => ({...p, professionalId: v}))}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Quem irá atender?" /></SelectTrigger>
                  <SelectContent>{professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Data</Label>
                   <Input required type="date" value={formData.date} onChange={e => setFormData(p => ({...p, date: e.target.value}))} className="bg-background" />
                 </div>
                 <div className="space-y-2">
                   <Label>Horário</Label>
                   <Input required type="time" value={formData.time} onChange={e => setFormData(p => ({...p, time: e.target.value}))} className="bg-background" />
                 </div>
              </div>
              {editingItem && (
                 <div className="space-y-2">
                   <Label>Status</Label>
                   <Select value={formData.status} onValueChange={(v: any) => setFormData(p => ({...p, status: v}))}>
                     <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="canceled">Cancelado</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
              )}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input value={formData.notes} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} className="bg-background" placeholder="Opcional..." />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-black">
                {editingItem ? 'Salvar Alterações' : 'Confirmar Agendamento'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {appointments.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CalendarIcon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Agenda livre</h3>
            <p className="text-muted-foreground text-sm">Nenhum agendamento encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {appointments.map((app) => (
            <Card key={app.id} className="border-border hover:bg-white/[0.02] transition-colors relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50" />
              <CardContent className="p-4 sm:p-6">
                 <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div className="text-center shrink-0 w-16">
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                        <p className="text-2xl font-light text-primary">{app.date.split('-')[2]}</p>
                        <p className="text-xs text-muted-foreground">{app.date.split('-')[1]}/{app.date.split('-')[0]}</p>
                      </div>
                      
                      <div className="h-10 w-px bg-border hidden sm:block" />
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <Clock className="w-4 h-4 text-primary" />
                           <span className="font-mono font-medium">{app.time}</span>
                           {getStatusBadge(app.status)}
                        </div>
                        <h4 className="font-medium text-base">{app.clientName}</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{app.serviceName} com <span className="text-foreground">{app.professionalName}</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                       {app.status === 'scheduled' && (
                         <>
                           <Button variant="outline" size="sm" onClick={() => changeStatus(app.id, 'completed')} className="w-full sm:w-auto text-green-400 border-green-500/20 hover:bg-green-500/10">
                             Concluir
                           </Button>
                           <Button variant="ghost" size="sm" onClick={() => changeStatus(app.id, 'canceled')} className="w-full sm:w-auto text-muted-foreground hover:text-destructive">
                             Cancelar
                           </Button>
                         </>
                       )}
                       <Button variant="ghost" size="icon" onClick={() => openEdit(app)}>
                         <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                       </Button>
                    </div>

                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

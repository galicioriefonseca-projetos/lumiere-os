import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Professional } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Power, PowerOff, UserMinus } from 'lucide-react';

export default function ProfessionalsPage() {
  const { salonData } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (!salonData) return;

    const q = query(collection(db, `salons/${salonData.id}/professionals`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profs: Professional[] = [];
      snapshot.forEach((doc) => {
        profs.push({ id: doc.id, ...doc.data() } as Professional);
      });
      setProfessionals(profs.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar equipe.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [salonData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    if (!editingProf && professionals.length >= salonData.professionalsLimit) {
      toast.error(`Você atingiu o limite de ${salonData.professionalsLimit} profissionais do seu plano.`);
      return;
    }

    try {
      if (editingProf) {
        const profRef = doc(db, `salons/${salonData.id}/professionals`, editingProf.id);
        await updateDoc(profRef, {
          ...formData,
          updatedAt: Date.now(),
        });
        toast.success('Profissional atualizado!');
      } else {
        const profRef = doc(collection(db, `salons/${salonData.id}/professionals`));
        await setDoc(profRef, {
          id: profRef.id,
          ...formData,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success('Profissional adicionado!');
      }
      setIsDialogOpen(false);
      setFormData({ name: '', role: '', phone: '', email: '' });
      setEditingProf(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar profissional.');
    }
  };

  const toggleStatus = async (prof: Professional) => {
    if (!salonData) return;
    try {
      const profRef = doc(db, `salons/${salonData.id}/professionals`, prof.id);
      await updateDoc(profRef, {
        isActive: !prof.isActive,
        updatedAt: Date.now(),
      });
      toast.success(`Profissional ${!prof.isActive ? 'ativado' : 'inativado'}.`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status.');
    }
  };

  const openEdit = (prof: Professional) => {
    setEditingProf(prof);
    setFormData({ name: prof.name, role: prof.role, phone: prof.phone, email: prof.email || '' });
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const activeCount = professionals.filter(p => p.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-heading font-light">Equipe</h2>
          <p className="text-muted-foreground text-sm">
            {professionals.length} de {salonData?.professionalsLimit} profissionais cadastrados ({activeCount} ativos).
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingProf(null); setFormData({ name: '', role: '', phone: '', email: '' }); }
        }}>
          <DialogTrigger asChild>
            <Button 
               className="bg-primary hover:bg-primary/90 text-primary-foreground"
               disabled={!salonData || professionals.length >= salonData.professionalsLimit}
               title={professionals.length >= (salonData?.professionalsLimit || 0) ? "Limite do plano atingido" : ""}
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Profissional
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading">{editingProf ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" required value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Função / Especialidade</Label>
                <Input id="role" required value={formData.role} onChange={(e) => setFormData(prev => ({...prev, role: e.target.value}))} className="bg-background" placeholder="Ex: Cabeleireiro Sênior" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input id="phone" required value={formData.phone} onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))} className="bg-background" />
              </div>
               <div className="space-y-2">
                <Label htmlFor="email">E-mail (Opcional)</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} className="bg-background" />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-black">
                {editingProf ? 'Salvar Alterações' : 'Cadastrar Profissional'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {professionals.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserMinus className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Nenhum profissional</h3>
            <p className="text-muted-foreground text-sm">Cadastre sua equipe para iniciar os agendamentos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {professionals.map((prof) => (
            <Card key={prof.id} className={`border-border transition-colors ${!prof.isActive && 'opacity-60 grayscale'}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold shrink-0">
                      {prof.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                      <CardTitle className="text-base font-medium leading-tight">
                        {prof.name}
                      </CardTitle>
                      <p className="text-xs text-primary mt-0.5">{prof.role}</p>
                   </div>
                </div>
                
                <div className="flex gap-1 -mr-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(prof)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(prof)} className={`h-8 w-8 ${prof.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'}`}>
                    {prof.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm mt-2 text-muted-foreground space-y-1">
                   <p>{prof.phone}</p>
                   {prof.email && <p>{prof.email}</p>}
                </div>
                <div className="mt-4">
                   <span className={`text-xs px-2 py-1 rounded-full ${prof.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                     {prof.isActive ? 'Ativo' : 'Inativo'}
                   </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

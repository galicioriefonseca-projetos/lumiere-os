import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Client } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchBar } from '@/components/ui/search-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Users, Search } from 'lucide-react';

export default function ClientsPage() {
  const { salonData } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });

  useEffect(() => {
    if (!salonData) return;

    const q = query(collection(db, `salons/${salonData.id}/clients`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cls: Client[] = [];
      snapshot.forEach((doc) => {
        cls.push({ id: doc.id, ...doc.data() } as Client);
      });
      const sorted = cls.sort((a, b) => b.createdAt - a.createdAt);
      setClients(sorted);
      setFilteredClients(sorted);
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar clientes.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [salonData]);

  useEffect(() => {
    const s = search.toLowerCase();
    if (s) {
       setFilteredClients(clients.filter(c => 
         c.name.toLowerCase().includes(s) || 
         c.phone.includes(s) || 
         (c.email && c.email.toLowerCase().includes(s))
       ));
    } else {
       setFilteredClients(clients);
    }
  }, [search, clients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      if (editingClient) {
        const ref = doc(db, `salons/${salonData.id}/clients`, editingClient.id);
        await updateDoc(ref, {
          ...formData,
          updatedAt: Date.now(),
        });
        toast.success('Cliente atualizado!');
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/clients`));
        await setDoc(ref, {
          id: ref.id,
          ...formData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success('Cliente cadastrado!');
      }
      setIsDialogOpen(false);
      setFormData({ name: '', phone: '', email: '', notes: '' });
      setEditingClient(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar cliente.');
    }
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setFormData({ name: c.name, phone: c.phone, email: c.email || '', notes: c.notes || '' });
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light">Clientes</h2>
          <p className="text-muted-foreground text-sm">{clients.length} clientes na sua base.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingClient(null); setFormData({ name: '', phone: '', email: '', notes: '' }); }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" required value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Seu WhatsApp</Label>
                <Input id="phone" required value={formData.phone} onChange={(e) => setFormData(p => ({...p, phone: e.target.value}))} className="bg-background" placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail (Opcional)</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(p => ({...p, email: e.target.value}))} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input id="notes" value={formData.notes} onChange={(e) => setFormData(p => ({...p, notes: e.target.value}))} className="bg-background" placeholder="Alergias, preferências..." />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-black">
                {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <SearchBar 
        value={search}
        onChange={setSearch}
        placeholder="Buscar por nome ou telefone..." 
        containerClassName="max-w-sm"
        className="bg-card border-border"
      />

      {filteredClients.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Nenhum cliente encontrado</h3>
            <p className="text-muted-foreground text-sm">Use o botão acima para adicionar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="border-border">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-primary font-bold shrink-0">
                      {client.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                      <CardTitle className="text-base font-medium leading-tight">
                        {client.name}
                      </CardTitle>
                   </div>
                </div>
                
                <Button variant="ghost" size="icon" onClick={() => openEdit(client)} className="-mr-2 h-8 w-8 text-muted-foreground hover:text-primary">
                  <Edit2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-sm mt-2 text-muted-foreground space-y-1">
                   {client.phone && <p className="flex items-center gap-2">📱 {client.phone}</p>}
                   {client.email && <p className="flex items-center gap-2">✉️ {client.email}</p>}
                   {client.notes && <p className="mt-2 text-xs opacity-70 p-2 bg-black/20 rounded border border-white/5 line-clamp-3">{client.notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

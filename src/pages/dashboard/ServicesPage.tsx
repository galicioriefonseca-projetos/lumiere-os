import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Service, Category } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Power, PowerOff, Scissors, Trash2 } from 'lucide-react';
import { formatBRL } from '@/lib/utils';

export default function ServicesPage() {
  const { salonData } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    durationMinutes: '60',
  });

  useEffect(() => {
    if (!salonData) return;

    // Load Services
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    const unsubS = onSnapshot(qs, (snapshot) => {
      const svcs: Service[] = [];
      snapshot.forEach((doc) => svcs.push({ id: doc.id, ...doc.data() } as Service));
      setServices(svcs.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });

    // Load Categories
    const qc = query(collection(db, `salons/${salonData.id}/categories`));
    const unsubC = onSnapshot(qc, (snapshot) => {
      const cats: Category[] = [];
      snapshot.forEach((doc) => cats.push({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
    });

    return () => { unsubS(); unsubC(); };
  }, [salonData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const priceVal = parseFloat(formData.price.replace(',', '.'));
      const durationVal = parseInt(formData.durationMinutes, 10);
      
      if (editingService) {
        const ref = doc(db, `salons/${salonData.id}/services`, editingService.id);
        await updateDoc(ref, {
          name: formData.name,
          category: formData.category,
          price: priceVal,
          durationMinutes: durationVal,
          updatedAt: Date.now(),
        });
        toast.success('Serviço atualizado!');
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/services`));
        await setDoc(ref, {
          id: ref.id,
          name: formData.name,
          category: formData.category,
          price: priceVal,
          durationMinutes: durationVal,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success('Serviço cadastrado!');
      }
      setIsDialogOpen(false);
      setFormData({ name: '', category: '', price: '', durationMinutes: '60' });
      setEditingService(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar serviço.');
    }
  };

  const toggleStatus = async (item: Service) => {
    if (!salonData) return;
    try {
      const ref = doc(db, `salons/${salonData.id}/services`, item.id);
      await updateDoc(ref, {
        isActive: !item.isActive,
        updatedAt: Date.now(),
      });
      toast.success(`Serviço ${!item.isActive ? 'ativado' : 'inativado'}.`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!salonData) return;
    try {
      const ref = doc(db, `salons/${salonData.id}/services`, id);
      await deleteDoc(ref);
      toast.success('Serviço excluído com sucesso.');
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir serviço.');
    }
  };

  const openEdit = (item: Service) => {
    setEditingService(item);
    setFormData({ 
       name: item.name, 
       category: item.category, 
       price: item.price.toString(), 
       durationMinutes: item.durationMinutes.toString() 
    });
    setIsDialogOpen(true);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light">Serviços</h2>
          <p className="text-muted-foreground text-sm">Organize seu catálogo de serviços e preços.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingService(null); setFormData({ name: '', category: '', price: '', durationMinutes: '60' }); }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading">{editingService ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Serviço</Label>
                <Input id="name" required value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select required value={formData.category} onValueChange={(v) => setFormData(p => ({...p, category: v}))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione ou deixe em branco" />
                  </SelectTrigger>
                  <SelectContent>
                     {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                     ))}
                  </SelectContent>
                </Select>
                {categories.length === 0 && <p className="text-xs text-muted-foreground mt-1">Nenhuma categoria cadastrada. Crie em "Categorias".</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="price">Preço (R$)</Label>
                   <Input id="price" required type="number" step="0.01" value={formData.price} onChange={(e) => setFormData(p => ({...p, price: e.target.value}))} className="bg-background" />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="duration">Duração (minutos)</Label>
                   <Input id="duration" required type="number" value={formData.durationMinutes} onChange={(e) => setFormData(p => ({...p, durationMinutes: e.target.value}))} className="bg-background" />
                 </div>
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-black">
                {editingService ? 'Salvar Alterações' : 'Cadastrar Serviço'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
          <DialogContent className="sm:max-w-[400px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg text-red-500">Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita e removerá o serviço permanentemente.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
                Excluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {services.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Scissors className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Nenhum serviço</h3>
            <p className="text-muted-foreground text-sm">Adicione os serviços que seu negócio oferece.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((item) => {
            const catName = categories.find(c => c.id === item.category)?.name || 'Sem Categoria';
            return (
               <Card key={item.id} className={`border-border transition-colors ${!item.isActive && 'opacity-60 grayscale'}`}>
                 <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                   <div>
                     <CardTitle className="text-base font-medium">{item.name}</CardTitle>
                     <p className="text-xs text-primary mt-1">{catName}</p>
                   </div>
                   <div className="flex gap-1 -mr-2">
                     <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                       <Edit2 className="w-4 h-4" />
                     </Button>
                     <Button variant="ghost" size="icon" onClick={() => toggleStatus(item)} className={`h-8 w-8 ${item.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'}`}>
                       {item.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                     </Button>
                   </div>
                 </CardHeader>
                 <CardContent>
                    <div className="flex justify-between items-center mt-2">
                       <span className="text-xl font-bold">{formatBRL(item.price)}</span>
                       <span className="text-sm text-muted-foreground">{item.durationMinutes} min</span>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(item.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                 </CardContent>
               </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

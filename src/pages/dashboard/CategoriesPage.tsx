import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Category } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Power, PowerOff } from 'lucide-react';

export default function CategoriesPage() {
  const { salonData } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (!salonData) return;

    const q = query(collection(db, `salons/${salonData.id}/categories`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats: Category[] = [];
      snapshot.forEach((doc) => {
        cats.push({ id: doc.id, ...doc.data() } as Category);
      });
      setCategories(cats.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar categorias.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [salonData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      if (editingCategory) {
        const catRef = doc(db, `salons/${salonData.id}/categories`, editingCategory.id);
        await updateDoc(catRef, {
          name: formData.name,
          description: formData.description,
          updatedAt: Date.now(),
        });
        toast.success('Categoria atualizada!');
      } else {
        const catRef = doc(collection(db, `salons/${salonData.id}/categories`));
        await setDoc(catRef, {
          id: catRef.id,
          name: formData.name,
          description: formData.description,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success('Categoria criada!');
      }
      setIsDialogOpen(false);
      setFormData({ name: '', description: '' });
      setEditingCategory(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar categoria.');
    }
  };

  const toggleStatus = async (category: Category) => {
    if (!salonData) return;
    try {
      const catRef = doc(db, `salons/${salonData.id}/categories`, category.id);
      await updateDoc(catRef, {
        isActive: !category.isActive,
        updatedAt: Date.now(),
      });
      toast.success(`Categoria ${!category.isActive ? 'ativada' : 'inativada'}.`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status.');
    }
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-heading font-light">Categorias</h2>
          <p className="text-muted-foreground text-sm">Gerencie as categorias de serviços do seu salão.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setEditingCategory(null); setFormData({ name: '', description: '' }); }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Categoria</Label>
                <Input id="name" required value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" value={formData.description} onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))} className="bg-background" />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-black">
                {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Nenhuma categoria</h3>
            <p className="text-muted-foreground text-sm">Adicione categorias para organizar seus serviços.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className={`border-border transition-colors ${!category.isActive && 'opacity-60 grayscale'}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {category.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(category)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(category)} className={`h-8 w-8 ${category.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'}`}>
                    {category.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {category.description || 'Sem descrição.'}
                </p>
                <div className="mt-4">
                   <span className={`text-xs px-2 py-1 rounded-full ${category.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                     {category.isActive ? 'Ativa' : 'Inativa'}
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

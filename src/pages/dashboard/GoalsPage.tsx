import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Goal } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Target, TrendingUp, Edit2 } from 'lucide-react';
import { formatBRL } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export default function GoalsPage() {
  const { salonData } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    month: new Date().toISOString().substring(0, 7), // YYYY-MM
    targetAmount: '',
    currentAmount: '0',
  });

  useEffect(() => {
    if (!salonData) return;

    const q = query(collection(db, `salons/${salonData.id}/goals`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const arr: Goal[] = [];
      snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Goal));
      setGoals(arr.sort((a, b) => b.month.localeCompare(a.month))); // Sort descending by month
      setLoading(false);
    });

    return () => unsubscribe();
  }, [salonData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const target = parseFloat(formData.targetAmount.replace(',', '.'));
      const current = parseFloat(formData.currentAmount.replace(',', '.'));
      
      const payload = {
        title: formData.title,
        month: formData.month,
        targetAmount: target,
        currentAmount: current,
        updatedAt: Date.now(),
      };

      if (editingGoal) {
        const ref = doc(db, `salons/${salonData.id}/goals`, editingGoal.id);
        await updateDoc(ref, payload);
        toast.success('Meta atualizada!');
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/goals`));
        await setDoc(ref, {
          id: ref.id,
          ...payload,
          createdAt: Date.now(),
        });
        toast.success('Meta criada!');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar meta.');
    }
  };

  const resetForm = () => {
    setEditingGoal(null);
    setFormData({ title: '', month: new Date().toISOString().substring(0, 7), targetAmount: '', currentAmount: '0' });
  };

  const openEdit = (g: Goal) => {
    setEditingGoal(g);
    setFormData({
      title: g.title || '',
      month: g.month,
      targetAmount: g.targetAmount.toString(),
      currentAmount: g.currentAmount.toString()
    });
    setIsDialogOpen(true);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light">Metas</h2>
          <p className="text-muted-foreground text-sm">Acompanhe seus objetivos e faturamento.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading">{editingGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Título (Opcional)</Label>
                <Input value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))} className="bg-background" placeholder="Ex: Faturamento Janeiro" />
              </div>
              <div className="space-y-2">
                <Label>Mês Referência</Label>
                <Input required type="month" value={formData.month} onChange={e => setFormData(p => ({...p, month: e.target.value}))} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Valor da Meta (R$)</Label>
                <Input required type="number" step="0.01" value={formData.targetAmount} onChange={e => setFormData(p => ({...p, targetAmount: e.target.value}))} className="bg-background" />
              </div>
              {editingGoal && (
                <div className="space-y-2">
                  <Label>Valor Realizado Até Agora (R$)</Label>
                  <Input required type="number" step="0.01" value={formData.currentAmount} onChange={e => setFormData(p => ({...p, currentAmount: e.target.value}))} className="bg-background" />
                </div>
              )}
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-black">
                {editingGoal ? 'Salvar Alterações' : 'Criar Meta'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Sem metas definidas</h3>
            <p className="text-muted-foreground text-sm">Comece a acompanhar seu progresso de faturamento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100);
            const remaining = Math.max(g.targetAmount - g.currentAmount, 0);
            
            return (
              <Card key={g.id} className="border-border relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-primary uppercase tracking-wider">{g.month}</p>
                      <CardTitle className="text-lg mt-1">{g.title || 'Faturamento Mensal'}</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(g)} className="-mt-2 -mr-2 h-8 w-8 text-muted-foreground hover:text-primary">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Realizado</p>
                      <p className="text-2xl font-light">{formatBRL(g.currentAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-1">Meta</p>
                      <p className="text-lg text-muted-foreground line-through decoration-white/20">{formatBRL(g.targetAmount)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-primary">{pct}%</span>
                      {remaining > 0 ? (
                        <span className="text-muted-foreground text-xs">Falta {formatBRL(remaining)}</span>
                      ) : (
                        <span className="text-green-400 text-xs font-medium! flex items-center"><TrendingUp className="w-3 h-3 mr-1" /> Meta Batida!</span>
                      )}
                    </div>
                    <Progress value={pct} className="h-2 bg-white/5" />
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

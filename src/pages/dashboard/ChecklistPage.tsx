import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, getDocs, where } from 'firebase/firestore';
import { Checklist, ChecklistRun, ChecklistItemTemplate } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, CheckCircle2, Circle, ListTodo, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function ChecklistPage() {
  const { salonData } = useAuth();
  const [template, setTemplate] = useState<Checklist | null>(null);
  const [todayRun, setTodayRun] = useState<ChecklistRun | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Template Creation State
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Checklist Diário');
  const [newItems, setNewItems] = useState<{label: string}[]>([{ label: 'Limpeza do salão' }]);

  const todayStr = new Date().toISOString().substring(0, 10);

  useEffect(() => {
    if (!salonData) return;

    const unsubs: (() => void)[] = [];

    // 1. Fetch active template
    const qt = query(collection(db, `salons/${salonData.id}/checklists`), where('isActive', '==', true));
    unsubs.push(onSnapshot(qt, (snapshot) => {
      let t: Checklist | null = null;
      snapshot.forEach(doc => { t = { id: doc.id, ...doc.data() } as Checklist; });
      setTemplate(t);

      // 2. If we have a template, fetch today's run
      if (t) {
        const qr = query(collection(db, `salons/${salonData.id}/checklistRuns`), where('date', '==', todayStr));
        unsubs.push(onSnapshot(qr, (snap) => {
           let r: ChecklistRun | null = null;
           snap.forEach(doc => { r = { id: doc.id, ...doc.data() } as ChecklistRun; });
           setTodayRun(r);
           setLoading(false);
        }));
      } else {
        setLoading(false);
      }
    }));

    return () => unsubs.forEach(u => u());
  }, [salonData]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    try {
      const itemsFormatted: ChecklistItemTemplate[] = newItems.filter(i => i.label.trim() !== '').map(i => ({
        id: crypto.randomUUID(),
        label: i.label,
        required: true
      }));

      const ref = doc(collection(db, `salons/${salonData.id}/checklists`));
      await setDoc(ref, {
        id: ref.id,
        title: newTitle,
        items: itemsFormatted,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      toast.success('Checklist configurado!');
      setIsTemplateDialogOpen(false);
    } catch(err) {
      toast.error('Erro ao configurar checklist.');
    }
  };

  const toggleItem = async (itemId: string) => {
    if (!salonData || !template) return;

    let currentItems = todayRun?.completedItems || [];
    if (currentItems.includes(itemId)) {
      currentItems = currentItems.filter(id => id !== itemId);
    } else {
      currentItems = [...currentItems, itemId];
    }

    const pct = Math.round((currentItems.length / template.items.length) * 100);

    try {
      if (todayRun) {
        await updateDoc(doc(db, `salons/${salonData.id}/checklistRuns`, todayRun.id), {
          completedItems: currentItems,
          completionPercentage: pct,
          updatedAt: Date.now()
        });
      } else {
        const ref = doc(collection(db, `salons/${salonData.id}/checklistRuns`));
        await setDoc(ref, {
          id: ref.id,
          checklistId: template.id,
          date: todayStr,
          completedItems: currentItems,
          completionPercentage: pct,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    } catch(e) {
      toast.error('Erro ao atualizar item.');
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const pct = todayRun ? todayRun.completionPercentage : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light">Checklist</h2>
          <p className="text-muted-foreground text-sm">Organize as tarefas diárias do seu salão.</p>
        </div>
        
        {!template && (
          <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Configurar Checklist
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">Criar Template</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTemplate} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input required value={newTitle} onChange={e => setNewTitle(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Itens Diários</Label>
                  {newItems.map((item, idx) => (
                     <div key={idx} className="flex gap-2">
                       <Input 
                         required 
                         value={item.label} 
                         onChange={e => {
                           const arr = [...newItems];
                           arr[idx].label = e.target.value;
                           setNewItems(arr);
                         }} 
                         className="bg-background" 
                       />
                       {newItems.length > 1 && (
                         <Button type="button" variant="ghost" size="icon" onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))} className="text-destructive">
                           <Trash2 className="w-4 h-4" />
                         </Button>
                       )}
                     </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewItems([...newItems, {label: ''}])} className="mt-2 text-primary border-primary/20 hover:bg-primary/10">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Item
                  </Button>
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-black">
                  Salvar Checklist
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!template ? (
        <Card className="border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
             <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
               <ListTodo className="w-6 h-6 text-primary" />
             </div>
             <h3 className="text-lg font-medium mb-1">Checklist pendente</h3>
             <p className="text-muted-foreground text-sm">Nenhum template ativo foi encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-2xl mx-auto">
          <Card className="border-border shadow-lg">
            <CardHeader className="border-b border-border bg-black/20">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-xl font-heading">{template.title}</CardTitle>
                <div className="text-sm font-medium bg-black/40 px-3 py-1 rounded-full text-muted-foreground">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </div>
              </div>
              <div className="space-y-1.5">
                 <div className="flex justify-between text-sm">
                   <span className="text-muted-foreground">Progresso de Hoje</span>
                   <span className="font-bold text-primary">{pct}%</span>
                 </div>
                 <Progress value={pct} className="h-2 bg-white/5" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-border">
                  {template.items.map((item) => {
                     const isDone = todayRun?.completedItems?.includes(item.id);
                     return (
                       <button
                         key={item.id}
                         onClick={() => toggleItem(item.id)}
                         className={`w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-white/[0.02] ${isDone ? 'opacity-50' : ''}`}
                       >
                         {isDone ? (
                           <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                         ) : (
                           <Circle className="w-6 h-6 text-muted-foreground shrink-0" />
                         )}
                         <span className={`text-base ${isDone ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                            {item.label}
                         </span>
                       </button>
                     );
                  })}
               </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

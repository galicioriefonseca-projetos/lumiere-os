import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

export function BugReportDialog() {
  const { user, salonData } = useAuth();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ type: 'bug', priority: 'medium', title: '', description: '' });

  const handleSubmit = async () => {
    if (!user || !salonData) return;
    try {
        const bugRef = doc(collection(db, 'bugReports'));
        await setDoc(bugRef, {
            ...formData,
            id: bugRef.id,
            pagePath: window.location.pathname,
            salonId: salonData.id,
            salonName: salonData.name,
            userId: user.id,
            userEmail: user.email,
            userName: user.fullName,
            status: 'open',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        toast.success("Problema reportado com sucesso!");
        setOpen(false);
        setFormData({ type: 'bug', priority: 'medium', title: '', description: '' });
    } catch (e) {
        toast.error("Erro ao reportar");
        console.error(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground"><AlertCircle className="w-4 h-4"/> Reportar problema</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reportar problema</DialogTitle></DialogHeader>
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="bug">Bug</SelectItem>
                        <SelectItem value="feature">Melhoria</SelectItem>
                        <SelectItem value="question">Dúvida</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Título</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="space-y-2">
                <Label>Descrição</Label>
                <textarea 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
            </div>
            <Button onClick={handleSubmit} className="w-full">Enviar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

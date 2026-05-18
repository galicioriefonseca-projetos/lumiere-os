import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Salon, PlanType, ActivationStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Search, ShieldAlert, CheckCircle, Ban, RefreshCcw, LogOut, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

export default function MasterPanel() {
  const { logout } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [filteredSalons, setFilteredSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'' | 'approve' | 'block' | 'cancel' | 'reactivate' | 'founder' | 'change_plan'>('');
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('start');

  useEffect(() => {
    const q = query(collection(db, 'salons'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const arr: Salon[] = [];
      snapshot.docs.forEach(doc => {
        arr.push({ id: doc.id, ...doc.data() } as Salon);
      });
      const sorted = arr.sort((a, b) => b.createdAt - a.createdAt);
      setSalons(sorted);
      setFilteredSalons(sorted);
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar salões.');
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const s = search.toLowerCase();
    if (s) {
      setFilteredSalons(salons.filter(salon => 
        salon.name.toLowerCase().includes(s) || 
        salon.ownerName.toLowerCase().includes(s) || 
        salon.ownerEmail.toLowerCase().includes(s) ||
        salon.phone.includes(s)
      ));
    } else {
      setFilteredSalons(salons);
    }
  }, [search, salons]);

  const confirmAction = async () => {
    if (!selectedSalon) return;
    
    try {
      const ref = doc(db, 'salons', selectedSalon.id);
      let updates: Partial<Salon> = { updatedAt: Date.now() };

      switch (dialogAction) {
        case 'approve':
          updates.activationStatus = 'active';
          updates.isActive = true;
          break;
        case 'block':
          updates.activationStatus = 'blocked';
          updates.isActive = false;
          break;
        case 'cancel':
          updates.activationStatus = 'canceled';
          updates.isActive = false;
          updates.deletedAt = Date.now();
          break;
        case 'reactivate':
          updates.activationStatus = 'active';
          updates.isActive = true;
          updates.deletedAt = 0; // null is harder with typescript if optional, using 0 or deleteField() isn't strictly necessary, setting 0 means it's back
          break;
        case 'founder':
          updates.plan = 'founder';
          break;
        case 'change_plan':
          updates.plan = selectedPlan;
          break;
        default:
          return;
      }

      await updateDoc(ref, updates as any);
      toast.success('Ação realizada com sucesso!');
      setIsDialogOpen(false);
      setSelectedSalon(null);
    } catch (error: any) {
      console.error("Firestore Update Error:", error);
      toast.error(`Erro: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const getStatusColor = (status: ActivationStatus) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'pending': return 'text-yellow-400 bg-yellow-500/20';
      case 'blocked': return 'text-orange-400 bg-orange-500/20';
      case 'canceled': return 'text-destructive bg-destructive/20';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusLabel = (status: ActivationStatus) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'pending': return 'Pendente';
      case 'blocked': return 'Bloqueado';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
         <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-card p-6 rounded-2xl border border-border">
          <div>
            <h1 className="text-3xl font-heading flex items-center gap-3 text-destructive">
               <ShieldAlert className="w-8 h-8" />
               Painel Master
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Controle absoluto de todas as instâncias da plataforma.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border hover:bg-white/5" asChild>
              <Link to="/dashboard">
                <Home className="w-4 h-4 mr-2" /> Dashboard
              </Link>
            </Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-white" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </div>

        <Card className="border-border bg-black/40">
           <CardHeader>
             <CardTitle className="text-xl">Empresas Cadastradas ({salons.length})</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por salão, dono, email ou telefone..." 
                  className="pl-9 bg-card border-border"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-black/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Salão</th>
                      <th className="px-4 py-3 font-medium">Responsável</th>
                      <th className="px-4 py-3 font-medium">Contato</th>
                      <th className="px-4 py-3 font-medium">Local</th>
                      <th className="px-4 py-3 font-medium">Plano / Status</th>
                      <th className="px-4 py-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalons.map((salon) => (
                      <tr key={salon.id} className="border-b border-border hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium">
                          {salon.name}
                          {salon.deletedAt && salon.deletedAt > 0 && <span className="ml-2 text-[10px] text-destructive uppercase">Deletado</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{salon.ownerName}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex flex-col">
                             <span>{salon.phone}</span>
                             <span className="text-xs opacity-60">{salon.ownerEmail}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{salon.city} - {salon.state}</td>
                        <td className="px-4 py-3">
                           <div className="flex flex-col gap-1 items-start">
                              <span className="text-xs uppercase tracking-wider text-primary font-bold">{salon.plan}</span>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getStatusColor(salon.activationStatus)}`}>
                                 {getStatusLabel(salon.activationStatus)}
                              </span>
                           </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                           <div className="flex justify-end gap-2">
                              {salon.activationStatus !== 'active' && (
                                <Button size="sm" variant="outline" className="h-8 border-green-500/20 text-green-400 hover:bg-green-500/10" onClick={() => { setSelectedSalon(salon); setDialogAction(salon.activationStatus === 'canceled' ? 'reactivate' : 'approve'); setIsDialogOpen(true); }}>
                                  <CheckCircle className="w-3 h-3 mr-1" /> {salon.activationStatus === 'canceled' ? 'Reativar' : 'Aprovar'}
                                </Button>
                              )}
                              {salon.activationStatus === 'active' && (
                                <Button size="sm" variant="outline" className="h-8 border-orange-500/20 text-orange-400 hover:bg-orange-500/10" onClick={() => { setSelectedSalon(salon); setDialogAction('block'); setIsDialogOpen(true); }}>
                                  <Ban className="w-3 h-3 mr-1" /> Bloquear
                                </Button>
                              )}
                              {salon.activationStatus !== 'canceled' && (
                                <Button size="sm" variant="outline" className="h-8 border-destructive/20 text-destructive hover:bg-destructive/10" onClick={() => { setSelectedSalon(salon); setDialogAction('cancel'); setIsDialogOpen(true); }}>
                                  Cancelar
                                </Button>
                              )}
                              <Button size="sm" className="h-8 bg-black/40 hover:bg-black/60 border border-border" onClick={() => { setSelectedPlan(salon.plan); setSelectedSalon(salon); setDialogAction('change_plan'); setIsDialogOpen(true); }}>
                                <RefreshCcw className="w-3 h-3 mr-1" /> Plano
                              </Button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </CardContent>
        </Card>

        {/* Info dialog instructions */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-primary">
          <p className="font-bold flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4"/> Instruções de Administração Manual</p>
          <p>Para conceder direitos de Master a outro usuário, vá no Console do Firestore:</p>
          <ol className="list-decimal ml-5 mt-1 space-y-1 opacity-90 text-xs text-muted-foreground">
            <li>Encontre o UID do usuário na aba <b>Authentication</b>.</li>
            <li>No <b>Firestore</b>, vá na coleção <code className="text-primary">users</code> e edite o documento com o UID do usuário.</li>
            <li>Altere o campo <code className="text-primary">role</code> para <code className="text-primary">"platform_admin"</code>.</li>
            <li>Crie um documento na coleção <code className="text-primary">platformAdmins</code> com o ID igual ao UID do usuário (não precisa ter campos internos, o documento apenas precisa existir).</li>
          </ol>
        </div>

      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading">Confirmar Ação</DialogTitle>
          </DialogHeader>
          <div className="py-4">
             {dialogAction === 'approve' && <p>Tem certeza que deseja <b>Aprovar/Ativar</b> a conta do salão {selectedSalon?.name}?</p>}
             {dialogAction === 'block' && <p>Tem certeza que deseja <b>Bloquear</b> a conta do salão {selectedSalon?.name}?</p>}
             {dialogAction === 'cancel' && <p className="text-destructive font-medium">Tem certeza que deseja <b>Cancelar (Soft Delete)</b> a conta do salão {selectedSalon?.name}? Isso inativará a conta completamente.</p>}
             {dialogAction === 'reactivate' && <p>Tem certeza que deseja <b>Reativar</b> a conta do salão {selectedSalon?.name}?</p>}
             {dialogAction === 'change_plan' && (
                <div className="space-y-4">
                   <p>Alterar plano para o salão <b>{selectedSalon?.name}</b>:</p>
                   <Select value={selectedPlan} onValueChange={(v: any) => setSelectedPlan(v)}>
                     <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Selecione o plano" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="start">Start</SelectItem>
                       <SelectItem value="studio">Studio</SelectItem>
                       <SelectItem value="performance">Performance</SelectItem>
                       <SelectItem value="network">Network</SelectItem>
                       <SelectItem value="founder">Founder</SelectItem>
                     </SelectContent>
                   </Select>
                </div>
             )}
          </div>
          <div className="flex justify-end gap-2">
             <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Voltar</Button>
             <Button 
               className={dialogAction === 'cancel' || dialogAction === 'block' ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-black hover:bg-primary/90"} 
               onClick={confirmAction}
             >
               Confirmar
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot, where } from 'firebase/firestore';
import { Salon, PlanType, ActivationStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Search, ShieldAlert, CheckCircle, Ban, RefreshCcw, LogOut, Home, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { createDemoSalon, deleteDemoSalon } from '@/lib/seedDemoSalon';
import { APP_INFO } from '../config/appInfo';

export default function MasterPanel() {
  const { logout, isPlatformAdmin, userData, diagnostics } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filteredSalons, setFilteredSalons] = useState<Salon[]>([]);
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [dialogAction, setDialogAction] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<any>('start');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!isPlatformAdmin) {
       setLoading(false);
       return;
    }
    
    const q = query(collection(db, 'salons'));
    const unsubSalons = onSnapshot(q, (snapshot) => {
      const arr: Salon[] = [];
      snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() } as Salon));
      setSalons(arr.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (err) => {
      console.error("Salons load error:", err);
      setLoading(false);
    });

    const qB = query(collection(db, 'bugReports'));
    const unsubBugs = onSnapshot(qB, (snap) => {
        const arr: any[] = [];
        snap.forEach(d => arr.push({id: d.id, ...d.data()}));
        setBugReports(arr.sort((a,b) => b.createdAt - a.createdAt));
    }, (err) => {
        console.error("Error reading bug reports:", err);
    });
    
    return () => { unsubSalons(); unsubBugs(); };
  }, [isPlatformAdmin]);

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
        case 'payment_paid':
          updates.subscriptionStatus = 'active';
          updates.paymentStatus = 'paid';
          updates.isActive = true;
          updates.activationStatus = 'active';
          updates.lastPaymentAt = Date.now();
          updates.lastPaymentAmount = selectedSalon.plan === 'founder' ? 297 : 0; // Or better dynamic mapping
          updates.lastPaymentMethod = 'pix';
          updates.currentPeriodStart = Date.now();
          updates.currentPeriodEnd = Date.now() + (30 * 24 * 60 * 60 * 1000);
          updates.nextBillingDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
          break;
        case 'payment_overdue':
          updates.subscriptionStatus = 'overdue';
          updates.paymentStatus = 'overdue';
          break;
        case 'payment_cancel':
          updates.subscriptionStatus = 'canceled';
          updates.paymentStatus = 'canceled';
          updates.isActive = false;
          updates.activationStatus = 'canceled';
          break;
        case 'payment_reactivate':
          updates.subscriptionStatus = 'active';
          updates.paymentStatus = 'paid';
          updates.isActive = true;
          updates.activationStatus = 'active';
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

  const handleUpdateBugStatus = async (bugId: string, newStatus: string) => {
    try {
      const ref = doc(db, 'bugReports', bugId);
      await updateDoc(ref, {
        status: newStatus,
        updatedAt: Date.now()
      });
      toast.success('Status do problema atualizado com sucesso!');
    } catch (error: any) {
      console.error("Bug update status error:", error);
      toast.error('Erro ao atualizar status do problema.');
    }
  };

  const getBugTypeLabel = (type: string) => {
    switch (type) {
      case 'bug': return 'Bug';
      case 'feature': return 'Melhoria';
      case 'question': return 'Dúvida';
      default: return type;
    }
  };

  const getBugPriorityClass = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    }
  };

  const getBugPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Crítico';
      case 'high': return 'Alto';
      case 'medium': return 'Médio';
      default: return 'Baixo';
    }
  };

  const formatBugDate = (ts: any) => {
    if (!ts) return '-';
    if (ts.toDate) return ts.toDate().toLocaleString('pt-BR');
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString('pt-BR');
    return new Date(ts).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
         <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-background/95 flex flex-col items-center justify-center p-4">
         <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
         <h1 className="text-2xl font-bold mb-2 text-foreground">Acesso Negado</h1>
         <p className="text-muted-foreground mb-6">Você não tem permissão de Platform Admin.</p>
         <Button variant="outline" render={<Link to="/dashboard" />} nativeButton={false}>
            <Home className="w-4 h-4 mr-2" />Voltar ao Dashboard
         </Button>
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
            <p className="text-xs text-[#D4AF37] mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono select-none">
              <span>LumiereOS v{APP_INFO.version}</span>
              <span className="opacity-30">|</span>
              <span>Desenvolvedor: {APP_INFO.company}</span>
            </p>
          </div>
          <div className="flex gap-2">
            {userData?.salonId && (
              <Button variant="outline" className="border-border hover:bg-white/5" render={<Link to="/dashboard" />} nativeButton={false}>
                  <Home className="w-4 h-4 mr-2" /> Dashboard
              </Button>
            )}
            <Button variant="ghost" className="text-muted-foreground hover:text-white" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </div>

        {diagnostics && (
          <Card className="border-border bg-black/40">
             <CardHeader>
               <CardTitle className="text-lg flex items-center gap-2 text-[#D4AF37]">
                 <RefreshCcw className="w-5 h-5 text-[#D4AF37] animate-pulse" />
                 Diagnóstico Avançado do Firebase & Firestore (Apenas Platform Admin)
               </CardTitle>
             </CardHeader>
             <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                   <div className="space-y-2">
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                         <span className="text-muted-foreground">VITE_FIREBASE_PROJECT_ID:</span>
                         <span className="text-white text-right select-all font-medium">{diagnostics.firebaseProjectId}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                         <span className="text-muted-foreground">VITE_FIREBASE_AUTH_DOMAIN:</span>
                         <span className="text-white text-right select-all font-medium">{diagnostics.firebaseAuthDomain}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                         <span className="text-muted-foreground">UID Autenticado:</span>
                         <span className="text-white text-right select-all font-medium">{diagnostics.authUid || 'Nenhum'}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                         <span className="text-muted-foreground">E-mail Autenticado:</span>
                         <span className="text-white text-right select-all font-medium">{diagnostics.authEmail || 'Nenhum'}</span>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                         <span className="text-muted-foreground">users/&#123;uid&#125; encontrado:</span>
                         <span className={diagnostics.userDocExists === 'sim' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                            {diagnostics.userDocExists}
                         </span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                         <span className="text-muted-foreground">salonId encontrado:</span>
                         <span className="text-white text-right select-all font-medium">{diagnostics.salonIdFound}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                         <span className="text-muted-foreground">Documentos em salons:</span>
                         <span className="text-white text-right font-medium">{diagnostics.salonsCount}</span>
                      </div>
                      <div className="flex flex-col border-b border-border/40 pb-1.5">
                         <span className="text-muted-foreground mb-1">Erro Firestore detectado:</span>
                         <span className={diagnostics.firestoreError === 'Sem erro' ? 'text-green-400 font-medium' : 'text-red-400 font-bold break-all'}>
                            {diagnostics.firestoreError}
                         </span>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

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
                              <span className="text-xs uppercase tracking-wider text-[#D4AF37] font-bold">{salon.plan}</span>
                              <div className="text-[10px] text-zinc-500 mt-1 font-mono text-left">
                                💸 PIX Manual / Off-line
                              </div>
                              <div className="flex gap-1">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getStatusColor(salon.activationStatus)}`}>
                                   {getStatusLabel(salon.activationStatus)}
                                </span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${salon.paymentStatus === 'reported' ? 'bg-blue-500/20 text-blue-400' : salon.paymentStatus === 'overdue' ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                   Pgto: {salon.paymentStatus || 'none'}
                                </span>
                              </div>
                           </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                           <div className="flex justify-end gap-2 flex-wrap max-w-[280px]">
                              {salon.activationStatus !== 'active' && (
                                <Button size="sm" variant="outline" className="h-8 border-green-500/20 text-green-400 hover:bg-green-500/10 mb-1" onClick={() => { setSelectedSalon(salon); setDialogAction(salon.activationStatus === 'canceled' ? 'reactivate' : 'approve'); setIsDialogOpen(true); }}>
                                  <CheckCircle className="w-3 h-3 mr-1" /> {salon.activationStatus === 'canceled' ? 'Reativar' : 'Aprovar'}
                                </Button>
                              )}
                              {salon.activationStatus === 'active' && (
                                <Button size="sm" variant="outline" className="h-8 border-orange-500/20 text-orange-400 hover:bg-orange-500/10 mb-1" onClick={() => { setSelectedSalon(salon); setDialogAction('block'); setIsDialogOpen(true); }}>
                                  <Ban className="w-3 h-3 mr-1" /> Bloquear
                                </Button>
                              )}
                              {salon.activationStatus !== 'canceled' && (
                                <Button size="sm" variant="outline" className="h-8 border-destructive/20 text-destructive hover:bg-destructive/10 mb-1" onClick={() => { setSelectedSalon(salon); setDialogAction('cancel'); setIsDialogOpen(true); }}>
                                  Cancelar
                                </Button>
                              )}
                              <Button size="sm" className="h-8 bg-black/40 hover:bg-black/60 border border-border mb-1" onClick={() => { setSelectedPlan(salon.plan); setSelectedSalon(salon); setDialogAction('change_plan'); setIsDialogOpen(true); }}>
                                <RefreshCcw className="w-3 h-3 mr-1" /> Plano
                              </Button>

                              <Select onValueChange={(val) => { setSelectedSalon(salon); setDialogAction(val); setIsDialogOpen(true); }}>
                                <SelectTrigger className="h-8 w-28 bg-black/20 border-border text-[10px] uppercase text-white">
                                  <SelectValue placeholder="Pagto" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                  <SelectItem value="payment_paid">Marcar como Pago</SelectItem>
                                  <SelectItem value="payment_overdue">Marcar Vencido</SelectItem>
                                  <SelectItem value="payment_cancel">Cancelar Assinatura</SelectItem>
                                  <SelectItem value="payment_reactivate">Reativar Assinatura</SelectItem>
                                </SelectContent>
                              </Select>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </CardContent>
        </Card>

        <Card className="border-border bg-black/40">
           <CardHeader>
             <CardTitle className="text-xl">Relatórios de Problemas e Feedback ({bugReports.length})</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
              {bugReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground font-light text-sm">
                   Nenhum problema reportado até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-black/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Data / Página</th>
                        <th className="px-4 py-3 font-medium">Título & Descrição</th>
                        <th className="px-4 py-3 font-medium">Empresa / Usuário</th>
                        <th className="px-4 py-3 font-medium">Prioridade / Tipo</th>
                        <th className="px-4 py-3 font-medium text-right">Status / Atualizar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bugReports.map((bug) => (
                        <tr key={bug.id} className="border-b border-border hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-xs text-muted-foreground text-left">
                            <div className="flex flex-col gap-1">
                               <span className="font-medium text-foreground">{formatBugDate(bug.createdAt)}</span>
                               <span className="opacity-80 font-mono text-[10px] truncate max-w-[140px]" title={bug.pagePath}>{bug.pagePath}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-sm text-left">
                            <div className="flex flex-col gap-1">
                               <span className="font-semibold text-foreground text-sm">{bug.title}</span>
                               <span className="text-xs text-muted-foreground opacity-90 line-clamp-2" title={bug.description}>{bug.description}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground text-left">
                            <div className="flex flex-col gap-1">
                               <span className="font-semibold text-foreground">{bug.salonName}</span>
                               <span>{bug.userName} ({bug.userEmail})</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-left">
                             <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getBugPriorityClass(bug.priority)}`}>
                                   {getBugPriorityLabel(bug.priority)}
                                </span>
                                <span className="bg-white/5 border border-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                   {getBugTypeLabel(bug.type)}
                                </span>
                             </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                             <div className="flex justify-end items-center gap-2">
                                <Select 
                                  value={bug.status || 'open'} 
                                  onValueChange={(val) => handleUpdateBugStatus(bug.id, val)}
                                >
                                  <SelectTrigger className="h-8 w-32 bg-black/20 border-border text-xs focus:ring-1 focus:ring-primary text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border">
                                    <SelectItem value="open">Aberto</SelectItem>
                                    <SelectItem value="reviewing">Em Análise</SelectItem>
                                    <SelectItem value="resolved">Resolvido</SelectItem>
                                    <SelectItem value="dismissed">Desconsiderado</SelectItem>
                                  </SelectContent>
                                </Select>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
           </CardContent>
        </Card>

        {/* Info dialog instructions */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-primary">
          <p className="font-bold flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4"/> Instruções de Administração Manual</p>
          <p>Para conceder direitos de Master a outro usuário, vá no Console do Firestore:</p>
          <ol className="list-decimal ml-5 mt-1 space-y-1 opacity-90 text-xs text-muted-foreground">
            <li>Encontre o UID do usuário na aba <b>Authentication</b>.</li>
            <li>No <b>Firestore</b>, crie um documento na coleção <code className="text-primary">platformAdmins</code> com o ID igual ao UID do usuário (não precisa ter campos internos).</li>
            <li>Opicionalmente, você pode alterar o campo <code className="text-primary">role</code> do documento do usuário em <code className="text-primary">users</code> para <code className="text-primary">"platform_admin"</code>, mas a coleção do passo anterior agora garante prioridade nas regras.</li>
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
             {dialogAction === 'payment_paid' && <p>Marcar o último pagamento do salão <b>{selectedSalon?.name}</b> como <b>PAGO</b>? Isso renovará o acesso por +30 dias.</p>}
             {dialogAction === 'payment_overdue' && <p>Marcar o pagamento do salão <b>{selectedSalon?.name}</b> como <b>VENCIDO</b>?</p>}
             {dialogAction === 'payment_cancel' && <p className="text-destructive font-medium">Cancelar completamente a assinatura do salão <b>{selectedSalon?.name}</b>? O acesso será bloqueado.</p>}
             {dialogAction === 'payment_reactivate' && <p>Reativar a assinatura do salão <b>{selectedSalon?.name}</b> marcando como pago?</p>}
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

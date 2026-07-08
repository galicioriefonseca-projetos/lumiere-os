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
  const { logout, isPlatformAdmin, userData, diagnostics, currentUser } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filteredSalons, setFilteredSalons] = useState<Salon[]>([]);
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [dialogAction, setDialogAction] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<any>('start');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'salons' | 'bugs' | 'cakto'>('salons');
  const [caktoSettings, setCaktoSettings] = useState({
    productId: '',
    startOfferId: '',
    founderOfferId: '',
    performanceOfferId: '',
    networkOfferId: '',
    enterpriseOfferId: ''
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);

  // States para homologação da Cakto
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testEvent, setTestEvent] = useState('purchase_approved');
  const [testPlan, setTestPlan] = useState('start');
  const [testSalonId, setTestSalonId] = useState('');

  const executeWebhookTest = async () => {
    if (!currentUser) return;
    if (!testSalonId) {
      toast.error("Por favor, selecione ou informe o ID do salão para o teste.");
      return;
    }

    setTestingWebhook(true);
    setTestResult(null);

    let offerId = '';
    if (testPlan === 'start') offerId = caktoSettings.startOfferId || 'off_simulated_start';
    else if (testPlan === 'founder') offerId = caktoSettings.founderOfferId || 'off_simulated_founder';
    else if (testPlan === 'performance') offerId = caktoSettings.performanceOfferId || 'off_simulated_performance';
    else if (testPlan === 'network') offerId = caktoSettings.networkOfferId || 'off_simulated_network';
    else if (testPlan === 'enterprise') offerId = caktoSettings.enterpriseOfferId || 'off_simulated_enterprise';

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/cakto/webhook-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          salonId: testSalonId,
          offerId,
          subscriptionId: `sub_homolog_${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
          orderId: `ord_homolog_${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
          event: testEvent
        })
      });

      if (!res.ok) {
        throw new Error(await res.text() || 'Falha ao executar teste do webhook');
      }

      const data = await res.json();
      setTestResult(data);
      toast.success('Simulação de webhook executada com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao executar teste do webhook: ${err.message}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  const fetchCaktoSettings = async () => {
    if (!currentUser) return;
    setLoadingSettings(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/cakto/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(await res.text() || 'Falha ao buscar configurações');
      }
      const data = await res.json();
      setCaktoSettings({
        productId: data.productId || '',
        startOfferId: data.startOfferId || '',
        founderOfferId: data.founderOfferId || '',
        performanceOfferId: data.performanceOfferId || '',
        networkOfferId: data.networkOfferId || '',
        enterpriseOfferId: data.enterpriseOfferId || ''
      });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao carregar configurações Cakto: ${err.message}`);
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveCaktoSettings = async () => {
    if (!currentUser) return;
    setSavingSettings(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/cakto/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(caktoSettings)
      });
      if (!res.ok) {
        throw new Error(await res.text() || 'Falha ao salvar configurações');
      }
      toast.success('Configurações do Cakto salvas com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar configurações Cakto: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const syncCaktoProducts = async () => {
    if (!currentUser) return;
    setSyncingProducts(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/cakto/sync-products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(await res.text() || 'Falha ao sincronizar ofertas');
      }
      const data = await res.json();
      toast.success(data.message || 'Sincronização realizada com sucesso!');
      await fetchCaktoSettings();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao sincronizar ofertas Cakto: ${err.message}`);
    } finally {
      setSyncingProducts(false);
    }
  };

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

  useEffect(() => {
    if (userData?.salonId) {
      setTestSalonId(userData.salonId);
    } else if (salons.length > 0 && !testSalonId) {
      setTestSalonId(salons[0].id);
    }
  }, [userData, salons]);

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
          updates.deletedAt = 0;
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
          updates.lastPaymentAmount = selectedSalon.plan === 'founder' ? 297 : 0;
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
        case 'cakto_activate':
          updates.billingProvider = 'cakto';
          updates.subscriptionStatus = 'active';
          updates.paymentStatus = 'paid';
          updates.isActive = true;
          updates.activationStatus = 'active';
          updates.caktoCustomerId = 'cus_ck_' + Math.random().toString(36).substring(2, 11).toUpperCase();
          updates.caktoSubscriptionId = 'sub_ck_' + Math.random().toString(36).substring(2, 11).toUpperCase();
          updates.caktoCheckoutUrl = 'https://cakto.com.br/checkout/simulated';
          updates.nextBillingDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
          break;
        case 'cakto_simulate_overdue':
          updates.billingProvider = 'cakto';
          updates.subscriptionStatus = 'overdue';
          updates.paymentStatus = 'overdue';
          updates.nextBillingDate = Date.now() - (5 * 24 * 60 * 60 * 1000);
          break;
        case 'cakto_clear':
          updates.billingProvider = 'manual_pix';
          updates.caktoCustomerId = '';
          updates.caktoSubscriptionId = '';
          updates.caktoCheckoutUrl = '';
          updates.subscriptionStatus = 'preview';
          updates.paymentStatus = 'none';
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

        {/* Navegação por Abas */}
        <div className="flex border-b border-border gap-2 pb-px mb-2 text-left">
          <button
            onClick={() => setActiveTab('salons')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all relative ${
              activeTab === 'salons'
                ? 'border-destructive text-destructive font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Empresas ({salons.length})
          </button>
          <button
            onClick={() => setActiveTab('bugs')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all relative ${
              activeTab === 'bugs'
                ? 'border-destructive text-destructive font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Problemas & Feedbacks ({bugReports.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('cakto');
              fetchCaktoSettings();
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all relative ${
              activeTab === 'cakto'
                ? 'border-destructive text-destructive font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Integração Cakto
          </button>
        </div>

        {activeTab === 'salons' && (
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
                      <th className="px-4 py-3">Salão / Dono</th>
                      <th className="px-4 py-3">Contato</th>
                      <th className="px-4 py-3">Plano</th>
                      <th className="px-4 py-3">Faturamento / Provedor</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSalons.map((salon) => (
                      <tr key={salon.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                           <div className="flex flex-col">
                             <span className="font-semibold text-white flex items-center gap-1.5">
                               {salon.name}
                               {salon.isTutorial && (
                                 <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1 rounded">Seeded Tutorial</span>
                               )}
                             </span>
                             <span className="text-xs text-muted-foreground">{salon.ownerName || '-'}</span>
                           </div>
                        </td>
                        <td className="px-4 py-3">
                           <div className="flex flex-col text-xs font-mono">
                             <span className="text-white">{salon.ownerEmail}</span>
                             <span className="text-muted-foreground">{salon.phone}</span>
                           </div>
                        </td>
                        <td className="px-4 py-3">
                           <div className="flex flex-col gap-1">
                             <span className="uppercase text-xs font-bold text-white tracking-wide">{salon.plan || 'start'}</span>
                             <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium w-fit ${getStatusColor(salon.activationStatus)}`}>
                               {getStatusLabel(salon.activationStatus)}
                             </span>
                           </div>
                        </td>
                        <td className="px-4 py-3">
                           <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                              <span className="font-semibold text-white uppercase">Provedor: {salon.billingProvider || 'Nenhum'}</span>
                              {salon.caktoCustomerId && (
                                <div className="text-[9px] text-zinc-500 font-mono mt-0.5 flex flex-col gap-0.5" title={salon.caktoCustomerId}>
                                   <span className="truncate max-w-[120px]">Cakto Cus: {salon.caktoCustomerId}</span>
                                   <span className="uppercase text-emerald-400">Status: {salon.subscriptionStatus}</span>
                                   {salon.caktoCheckoutUrl ? (
                                     <div className="flex gap-1.5 items-center mt-1">
                                       <a href={salon.caktoCheckoutUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline hover:text-indigo-300">
                                         Abrir Link
                                       </a>
                                     </div>
                                   ) : (
                                     <span className="text-yellow-500 text-[8px] uppercase font-bold mt-0.5">Sem link de checkout</span>
                                   )}
                                </div>
                              )}
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
                                  <Trash2 className="w-3 h-3 mr-1" /> Cancelar
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 border-border hover:bg-white/5 mb-1 text-xs" onClick={() => { setSelectedSalon(salon); setDialogAction('change_plan'); setSelectedPlan(salon.plan || 'start'); setIsDialogOpen(true); }}>
                                Mudar Plano
                              </Button>

                              <Select onValueChange={(val: string) => { setSelectedSalon(salon); setDialogAction(val); setIsDialogOpen(true); }}>
                                <SelectTrigger className="w-24 h-8 text-xs bg-black/30 border-border">
                                  <SelectValue placeholder="Faturamento" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-white">
                                  <SelectItem value="payment_paid">Marcar como Pago</SelectItem>
                                  <SelectItem value="payment_overdue">Marcar Vencido</SelectItem>
                                  <SelectItem value="payment_cancel">Cancelar Assinatura</SelectItem>
                                  <SelectItem value="payment_reactivate">Reativar Assinatura</SelectItem>
                                  {import.meta.env.DEV && (
                                    <>
                                      <SelectItem value="cakto_activate">Ativar Cakto (Simular Link)</SelectItem>
                                      <SelectItem value="cakto_simulate_overdue">Simular 5 dias de atraso (Cakto)</SelectItem>
                                      <SelectItem value="cakto_clear">Limpar Dados Cakto</SelectItem>
                                    </>
                                  )}
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
        )}

        {activeTab === 'bugs' && (
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
                         <th className="px-4 py-3">Tipo / Prioridade</th>
                         <th className="px-4 py-3">Assunto / Descrição</th>
                         <th className="px-4 py-3">Enviado por</th>
                         <th className="px-4 py-3">Data</th>
                         <th className="px-4 py-3">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-border">
                       {bugReports.map((bug) => (
                         <tr key={bug.id} className="hover:bg-white/5 transition-colors">
                           <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-white uppercase text-xs">{getBugTypeLabel(bug.type)}</span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border w-fit font-bold uppercase ${getBugPriorityClass(bug.priority)}`}>
                                   {getBugPriorityLabel(bug.priority)}
                                </span>
                              </div>
                           </td>
                           <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5 max-w-sm md:max-w-md">
                                 <span className="font-semibold text-white truncate">{bug.title}</span>
                                 <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">{bug.description}</p>
                                 {bug.userAgent && <span className="text-[9px] text-zinc-500 font-mono mt-1 truncate block">{bug.userAgent}</span>}
                              </div>
                           </td>
                           <td className="px-4 py-3">
                              <div className="flex flex-col text-xs">
                                 <span className="text-white">{bug.userName || 'Anônimo'}</span>
                                 <span className="text-muted-foreground font-mono">{bug.userEmail || '-'}</span>
                                 {bug.salonName && <span className="text-[10px] text-[#D4AF37] font-semibold mt-0.5">Salão: {bug.salonName}</span>}
                              </div>
                           </td>
                           <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                              {formatBugDate(bug.createdAt)}
                           </td>
                           <td className="px-4 py-3 text-right">
                              <div className="flex justify-end items-center gap-2">
                                 <Select value={bug.status || 'open'} onValueChange={(val) => handleUpdateBugStatus(bug.id, val)}>
                                   <SelectTrigger className="w-28 h-8 text-xs bg-black/30 border-border text-white">
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
        )}

        {activeTab === 'cakto' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border bg-black/40">
               <CardHeader>
                 <CardTitle className="text-xl flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-destructive" />
                   Integração Cakto
                 </CardTitle>
                 <p className="text-sm text-muted-foreground text-left">Cadastre e edite dinamicamente os IDs do produto e das ofertas da Cakto para faturamento dinâmico.</p>
               </CardHeader>
               <CardContent className="space-y-4">
                 {loadingSettings ? (
                   <div className="flex justify-center p-8">
                     <Loader2 className="w-6 h-6 animate-spin text-primary" />
                   </div>
                 ) : (
                   <div className="space-y-4 text-left">
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cakto Product ID</label>
                       <Input
                         placeholder="Ex: prod_..."
                         className="bg-card border-border text-white"
                         value={caktoSettings.productId}
                         onChange={(e) => setCaktoSettings({ ...caktoSettings, productId: e.target.value })}
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">ID Oferta - Start</label>
                       <Input
                         placeholder="Ex: off_..."
                         className="bg-card border-border text-white"
                         value={caktoSettings.startOfferId}
                         onChange={(e) => setCaktoSettings({ ...caktoSettings, startOfferId: e.target.value })}
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">ID Oferta - Founder</label>
                       <Input
                         placeholder="Ex: off_..."
                         className="bg-card border-border text-white"
                         value={caktoSettings.founderOfferId}
                         onChange={(e) => setCaktoSettings({ ...caktoSettings, founderOfferId: e.target.value })}
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">ID Oferta - Performance</label>
                       <Input
                         placeholder="Ex: off_..."
                         className="bg-card border-border text-white"
                         value={caktoSettings.performanceOfferId}
                         onChange={(e) => setCaktoSettings({ ...caktoSettings, performanceOfferId: e.target.value })}
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">ID Oferta - Network</label>
                       <Input
                         placeholder="Ex: off_..."
                         className="bg-card border-border text-white"
                         value={caktoSettings.networkOfferId}
                         onChange={(e) => setCaktoSettings({ ...caktoSettings, networkOfferId: e.target.value })}
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">ID Oferta - Enterprise</label>
                       <Input
                         placeholder="Ex: off_..."
                         className="bg-card border-border text-white"
                         value={caktoSettings.enterpriseOfferId}
                         onChange={(e) => setCaktoSettings({ ...caktoSettings, enterpriseOfferId: e.target.value })}
                       />
                     </div>
                     <div className="pt-2 flex flex-wrap gap-3">
                       <Button
                         onClick={saveCaktoSettings}
                         disabled={savingSettings || syncingProducts}
                         className="bg-destructive hover:bg-destructive/80 text-white font-medium"
                       >
                         {savingSettings ? (
                           <>
                             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                             Salvando...
                           </>
                         ) : (
                           'Salvar Configurações'
                         )}
                       </Button>

                       <Button
                         onClick={syncCaktoProducts}
                         disabled={savingSettings || syncingProducts}
                         variant="outline"
                         className="border-destructive/30 hover:bg-destructive/10 text-white font-medium"
                       >
                         {syncingProducts ? (
                           <>
                             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                             Sincronizando...
                           </>
                         ) : (
                           'Sincronizar Ofertas'
                         )}
                       </Button>
                     </div>
                   </div>
                 )}
               </CardContent>
            </Card>

            <Card className="border-border bg-black/40">
               <CardHeader>
                 <CardTitle className="text-xl flex items-center gap-2">
                   <RefreshCcw className="w-5 h-5 text-destructive" />
                   Homologação Cakto
                 </CardTitle>
                 <p className="text-sm text-muted-foreground text-left">Permite simular o envio de eventos de webhook para testar a ativação, reativação, cancelamento ou recusado de planos.</p>
               </CardHeader>
               <CardContent className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Empresa/Salão para Teste</label>
                    <Select value={testSalonId} onValueChange={setTestSalonId}>
                      <SelectTrigger className="bg-card border-border text-white">
                        <SelectValue placeholder="Selecione o salão para testar" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-white">
                        {salons.map((salon) => (
                          <SelectItem key={salon.id} value={salon.id}>
                            {salon.name} ({salon.ownerEmail})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Evento do Webhook</label>
                    <Select value={testEvent} onValueChange={setTestEvent}>
                      <SelectTrigger className="bg-card border-border text-white">
                        <SelectValue placeholder="Selecione o evento" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-white">
                        <SelectItem value="purchase_approved">Aprovação de Compra (purchase_approved)</SelectItem>
                        <SelectItem value="subscription_created">Assinatura Criada (subscription_created)</SelectItem>
                        <SelectItem value="subscription_renewed">Assinatura Renovada (subscription_renewed)</SelectItem>
                        <SelectItem value="subscription_canceled">Assinatura Cancelada (subscription_canceled)</SelectItem>
                        <SelectItem value="purchase_refused">Pagamento Recusado (purchase_refused)</SelectItem>
                        <SelectItem value="subscription_renewal_refused">Renovação Recusada (subscription_renewal_refused)</SelectItem>
                        <SelectItem value="refund">Reembolso (refund)</SelectItem>
                        <SelectItem value="chargeback">Disputa/Estorno (chargeback)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Plano Correspondente</label>
                    <Select value={testPlan} onValueChange={setTestPlan}>
                      <SelectTrigger className="bg-card border-border text-white">
                        <SelectValue placeholder="Selecione o plano" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-white">
                        <SelectItem value="start">Start</SelectItem>
                        <SelectItem value="founder">Founder (Pioneiro)</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="network">Network</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={executeWebhookTest}
                      disabled={testingWebhook}
                      className="bg-destructive hover:bg-destructive/80 text-white font-medium w-full animate-none"
                    >
                      {testingWebhook ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Simulando Webhook...
                        </>
                      ) : (
                        'Executar Teste'
                      )}
                    </Button>
                  </div>

                  {testResult && (
                    <div className="mt-4 p-4 rounded-xl border border-border bg-black/60 space-y-3 text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-green-400 font-bold text-sm">
                        <CheckCircle className="w-4 h-4" />
                        <span>✅ Sucesso</span>
                      </div>
                      <div className="space-y-1 text-muted-foreground">
                        <div>
                          <span className="text-white">Plano Atualizado:</span> <span className="text-[#D4AF37] uppercase font-bold">{testResult.plan}</span>
                        </div>
                        <div>
                          <span className="text-white">Status da Assinatura:</span> <span className="text-indigo-400 uppercase font-bold">{testResult.status}</span>
                        </div>
                        <div>
                          <span className="text-white">Documento Alterado:</span> <span className="text-zinc-300 break-all">{testResult.firestorePath}</span>
                        </div>
                      </div>
                    </div>
                  )}
               </CardContent>
            </Card>
          </div>
        )}

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
                         <SelectItem value="founder">Founder (Pioneiro)</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="network">Network</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
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

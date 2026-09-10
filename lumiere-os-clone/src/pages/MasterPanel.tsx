import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot, where, deleteField } from 'firebase/firestore';
import { Salon, PlanType, ActivationStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Search, ShieldAlert, CheckCircle, Ban, RefreshCcw, LogOut, Home, Sparkles, Trash2, Zap, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
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
  const [founderMigrationOption, setFounderMigrationOption] = useState<'A' | 'B'>('A');

  const [activeTab, setActiveTab] = useState<'salons' | 'bugs' | 'asaas'>('salons');
  const [billingSettings, setAsaasSettings] = useState<any>({
    mode: 'sandbox' as 'sandbox' | 'production',
    apiKey: '',
    webhookToken: ''
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);

  // States para homologação da Asaas
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
    if (testPlan === 'start') offerId = billingSettings.startOfferId || 'off_simulated_start';
    else if (testPlan === 'founder') offerId = billingSettings.founderOfferId || 'off_simulated_founder';
    else if (testPlan === 'performance') offerId = billingSettings.performanceOfferId || 'off_simulated_performance';
    else if (testPlan === 'network') offerId = billingSettings.networkOfferId || 'off_simulated_network';
    else if (testPlan === 'enterprise') offerId = billingSettings.enterpriseOfferId || 'off_simulated_enterprise';

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/billing/webhook-test', {
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

  const fetchAsaasSettings = async () => {
    if (!currentUser) return;
    setLoadingSettings(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/billing/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(await res.text() || 'Falha ao buscar configurações');
      }
      const data = await res.json();
      setAsaasSettings({
        productId: data.productId || '',
        startOfferId: data.startOfferId || '',
        founderOfferId: data.founderOfferId || '',
        performanceOfferId: data.performanceOfferId || '',
        networkOfferId: data.networkOfferId || '',
        enterpriseOfferId: data.enterpriseOfferId || ''
      });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao carregar configurações Asaas: ${err.message}`);
    } finally {
      setLoadingSettings(false);
    }
  };

  const saveAsaasSettings = async () => {
    if (!currentUser) return;
    setSavingSettings(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/billing/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(billingSettings)
      });
      if (!res.ok) {
        throw new Error(await res.text() || 'Falha ao salvar configurações');
      }
      toast.success('Configurações do Asaas salvas com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar configurações Asaas: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const testAsaasConnection = async () => {
    if (!currentUser) return;
    setSyncingProducts(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/billing/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(billingSettings)
      });
      if (!res.ok) {
        throw new Error(await res.text() || 'Falha na conexão com a Asaas');
      }
      toast.success('Conexão com a Asaas bem-sucedida!');
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao testar conexão Asaas: ${err.message}`);
    } finally {
      setSyncingProducts(false);
    }
  };

  const [runningMigrationScan, setRunningMigrationScan] = useState(false);

  const salonsWithHomologationIds = salons.filter(salon => {
    const sub = salon.providerSubscriptionId || "";
    const ord = salon.homologationOrderId || "";
    const off = salon.homologationOfferId || "";
    const lowerSub = sub.toLowerCase();
    const lowerOrd = ord.toLowerCase();
    const lowerOff = off.toLowerCase();
    return (
      lowerSub.includes("homolog") || lowerSub.includes("simulated") ||
      lowerOrd.includes("homolog") || lowerOrd.includes("simulated") ||
      lowerOff.includes("homolog") || lowerOff.includes("simulated")
    );
  });

  const runMigrationScan = async () => {
    setRunningMigrationScan(true);
    let count = 0;
    try {
      for (const salon of salonsWithHomologationIds) {
        if (!salon.billingRequiresMigration) {
          const salonRef = doc(db, 'salons', salon.id);
          await updateDoc(salonRef, {
            billingRequiresMigration: true,
            updatedAt: Date.now()
          });
          count++;
        }
      }
      if (count > 0) {
        toast.success(`${count} empresas identificadas com IDs simulados e marcadas para migração!`);
      } else {
        toast.info("Todas as empresas com IDs simulados já foram marcadas para migração.");
      }
    } catch (err: any) {
      console.error("Migration Scan Error:", err);
      toast.error(`Erro na varredura: ${err.message}`);
    } finally {
      setRunningMigrationScan(false);
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

  const isSimulatedFounder = (salon: Salon) => {
    return salon.plan === 'founder' && (
      !salon.providerSubscriptionId ||
      salon.providerSubscriptionId.includes('simulated') ||
      salon.providerSubscriptionId.includes('homolog') ||
      salon.providerSubscriptionId === 'sub_simulated_dev'
    );
  };

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
        case 'migrate_founder':
          if (founderMigrationOption === 'A') {
            if (!currentUser) {
              toast.error("Usuário não autenticado.");
              return;
            }
            const checkoutWindow = window.open('about:blank', '_blank');
            if (checkoutWindow) checkoutWindow.opener = null;
            try {
              const token = await currentUser.getIdToken(true);
              const response = await fetch('/api/billing/create-checkout', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  salonId: selectedSalon.id,
                  planId: 'founder',
                  checkoutPurpose: 'activate_recurring',
                  email: selectedSalon.billingEmail || selectedSalon.ownerEmail || currentUser.email || ''
                })
              });
              if (!response.ok) {
                const text = await response.text();
                let errJson;
                try { errJson = JSON.parse(text); } catch (e) {}
                const errorMsg = errJson?.error || text || "Falha ao gerar o checkout de migração.";
                throw new Error(errorMsg);
              }
              const data = await response.json();
              if (data.checkoutUrl) {
                if (checkoutWindow) checkoutWindow.location.href = data.checkoutUrl;
                else window.location.assign(data.checkoutUrl);
                toast.success("Checkout gerado. O acesso atual permanecerá ativo até a confirmação do pagamento.");
                setIsDialogOpen(false);
                setSelectedSalon(null);
                return;
              } else {
                throw new Error("checkoutUrl não retornada pelo servidor.");
              }
            } catch (err: any) {
              checkoutWindow?.close();
              console.error("Option A migration error:", err);
              toast.error(`Erro: ${err.message || "Falha ao gerar faturamento Asaas."}`);
              return;
            }
          } else {
            // Opção B: manter a licença já paga em faturamento manual.
            // Não inventar vencimento, pagamento ou período; esses dados são preservados.
            updates.billingProvider = 'manual';
            updates.billingMode = 'manual_pix';
            updates.subscriptionStatus = 'active';
            updates.paymentStatus = 'paid';
            updates.isActive = true;
            updates.activationStatus = 'active';
            updates.billingRequiresMigration = false;

            const fieldsToDelete = [
              'pendingPlan',
              'pendingOfferId',
              'pendingCheckoutUrl',
              'pendingCheckoutEmail',
              'pendingRequestedAt',
              'pendingCheckoutPurpose',
              'pendingBillingActivation',
              'homologationCustomerId',
              'homologationOrderId',
              'homologationSubscriptionId',
              'homologationCheckoutUrl',
              'homologationOfferId',
              'homologationLastEventId',
              'homologationLastEvent',
              'homologationSubscriptionStatus',
              'homologationActivationStatus',
              'homologationPaymentStatus',
              'homologationNextBillingDate',
              'homologationLastPaymentAt',
              'homologationLastPaymentAmount',
              'homologationUpdatedAt'
            ];

            fieldsToDelete.forEach((field) => {
              (updates as any)[field] = deleteField();
            });

            const isNonProductionId = (value?: string | null) =>
              typeof value === 'string' && /(simulated|homolog|test)/i.test(value);

            if (isNonProductionId(selectedSalon.providerSubscriptionId)) (updates as any).providerSubscriptionId = deleteField();
            if (isNonProductionId(selectedSalon.homologationOrderId)) (updates as any).homologationOrderId = deleteField();
            if (isNonProductionId(selectedSalon.providerCustomerId)) (updates as any).providerCustomerId = deleteField();
            if (isNonProductionId(selectedSalon.homologationOfferId)) (updates as any).homologationOfferId = deleteField();
            if (selectedSalon.providerCheckoutUrl?.includes('simulated_checkout')) (updates as any).providerCheckoutUrl = deleteField();
          }
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
              setActiveTab('asaas');
              fetchAsaasSettings();
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all relative ${
              activeTab === 'asaas'
                ? 'border-destructive text-destructive font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Integração Asaas
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
                               {salon.billingRequiresMigration && (
                                 <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5" title="Requer Migração de Faturamento">
                                   <ShieldAlert className="w-2.5 h-2.5" /> Requer Migração
                                 </span>
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
                              {salon.providerCustomerId && (
                                <div className="text-[9px] text-zinc-500 font-mono mt-0.5 flex flex-col gap-0.5" title={salon.providerCustomerId}>
                                   <span className="truncate max-w-[120px]">Asaas Cus: {salon.providerCustomerId}</span>
                                   <span className="uppercase text-emerald-400">Status: {salon.subscriptionStatus}</span>
                                   {salon.providerCheckoutUrl ? (
                                     <div className="flex gap-1.5 items-center mt-1">
                                       <a href={salon.providerCheckoutUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline hover:text-indigo-300">
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
                                  {isSimulatedFounder(salon) && (
                                    <SelectItem value="migrate_founder">Converter Founder (Produção)</SelectItem>
                                  )}
                                  <SelectItem value="payment_paid">Marcar como Pago</SelectItem>
                                  <SelectItem value="payment_overdue">Marcar Vencido</SelectItem>
                                  <SelectItem value="payment_cancel">Cancelar Assinatura</SelectItem>
                                  <SelectItem value="payment_reactivate">Reativar Assinatura</SelectItem>
                                  {import.meta.env.DEV && (
                                    <>
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

        {activeTab === 'asaas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border bg-black/40">
               <CardHeader>
                 <CardTitle className="text-xl flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-destructive" />
                   Integração Asaas
                 </CardTitle>
                 <p className="text-sm text-muted-foreground text-left">Cadastre e edite dinamicamente os IDs do produto e das ofertas da Asaas para faturamento dinâmico.</p>
               </CardHeader>
               <CardContent className="space-y-4">
                 {loadingSettings ? (
                   <div className="flex justify-center p-8">
                     <Loader2 className="w-6 h-6 animate-spin text-primary" />
                   </div>
                 ) : (
                   <div className="space-y-4 text-left">
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Ambiente (Modo)</label>
                       <select
                         className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-white"
                         value={(billingSettings as any).mode || 'sandbox'}
                         onChange={(e) => setAsaasSettings({ ...billingSettings, mode: e.target.value as 'sandbox' | 'production' } as any)}
                       >
                         <option value="sandbox">Sandbox (Testes)</option>
                         <option value="production">Produção</option>
                       </select>
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Asaas API Key</label>
                       <Input
                         type="password"
                         placeholder="Ex: $aact_..."
                         className="bg-card border-border text-white"
                         value={(billingSettings as any).apiKey || ''}
                         onChange={(e) => setAsaasSettings({ ...billingSettings, apiKey: e.target.value } as any)}
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Webhook Token</label>
                       <Input
                         placeholder="Token para validar os webhooks"
                         className="bg-card border-border text-white"
                         value={(billingSettings as any).webhookToken || ''}
                         onChange={(e) => setAsaasSettings({ ...billingSettings, webhookToken: e.target.value } as any)}
                       />
                     </div>
                     <div className="pt-2 flex flex-wrap gap-3">
                       <Button
                         onClick={saveAsaasSettings}
                         disabled={savingSettings || syncingProducts}
                         className="bg-destructive hover:bg-destructive/80 text-white font-medium"
                       >
                         
                        <Button
                          onClick={async () => {
                             try {
                               await fetch('/api/billing/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seed' }) });
                               toast.success('Planos sincronizados com sucesso.');
                             } catch(err) {
                               toast.error('Erro ao sincronizar planos.');
                             }
                          }}
                          variant="outline"
                          className="border-blue-500/30 hover:bg-blue-500/10 text-white font-medium"
                        >
                          Sincronizar Planos (Seed)
                        </Button>

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
                         onClick={testAsaasConnection}
                         disabled={savingSettings || syncingProducts}
                         variant="outline"
                         className="border-destructive/30 hover:bg-destructive/10 text-white font-medium"
                       >
                         {syncingProducts ? (
                           <>
                             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                             Testando...
                           </>
                         ) : (
                           'Testar Conexão'
                         )}
                       </Button>
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
             {dialogAction === 'migrate_founder' && (
                <div className="space-y-4 text-left">
                  <p className="font-semibold text-white">Converter faturamento do Founder <b>{selectedSalon?.name}</b> para Produção:</p>
                  <p className="text-xs text-muted-foreground">Esta conta de pioneiro (Founder) possui IDs de homologação. Escolha como deseja migrá-la:</p>
                  
                  <div className="space-y-3 pt-2 text-left">
                    <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                      <input 
                        type="radio" 
                        name="founder_option" 
                        className="mt-1"
                        checked={founderMigrationOption === 'A'} 
                        onChange={() => setFounderMigrationOption('A')} 
                      />
                      <div>
                        <span className="font-semibold text-white block">Opção A: Gerar checkout real Founder</span>
                        <span className="text-xs text-muted-foreground block mt-0.5">Gera o checkout de produção da Asaas sem alterar o acesso atual. A conta permanece ativa e manual até a confirmação do webhook real.</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                      <input 
                        type="radio" 
                        name="founder_option" 
                        className="mt-1"
                        checked={founderMigrationOption === 'B'} 
                        onChange={() => setFounderMigrationOption('B')} 
                      />
                      <div>
                        <span className="font-semibold text-white block">Opção B: Manter faturamento manual</span>
                        <span className="text-xs text-muted-foreground block mt-0.5">Define o faturamento como manual, sem cobrança recorrente via gateway e sem IDs fictícios de homologação.</span>
                      </div>
                    </label>
                  </div>
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

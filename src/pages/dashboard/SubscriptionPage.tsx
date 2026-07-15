import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '@/lib/firebase';
import { 
  Check, 
  CreditCard, 
  AlertTriangle, 
  ShieldCheck, 
  ExternalLink, 
  Loader2, 
  Users, 
  Calendar, 
  Coins, 
  Lock, 
  Zap, 
  Info,
  Clock,
  Copy,
  ChevronRight,
  TrendingUp,
  ArrowDown,
  Sparkles,
  HelpCircle,
  FileText,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { PLANS_CONFIG } from '../../config/plans';
import { BILLING_CONFIG } from '../../config/billing';
import { toast } from 'sonner';
import { billingService } from '../../services/billing/BillingService';
import { collection, query, onSnapshot, where, doc } from 'firebase/firestore';
import { schedulePlanChange, cancelPlanChange, isRealCaktoSubscription, isManualActiveSubscription } from '../../lib/cakto';

const PLANS_PRICES: Record<string, number> = {
  start: 197,
  founder: 297,
  performance: 397,
  network: 797,
  enterprise: 1997
};

const PLANS_MAX_PROFESSIONALS: Record<string, number> = {
  start: 5,
  founder: 22,
  performance: 20,
  network: 999,
  enterprise: 9999
};

const PLAN_NAMES: Record<string, string> = {
  start: "Start",
  founder: "Founder (Pioneiro)",
  performance: "Performance",
  network: "Network",
  enterprise: "Enterprise"
};

const PLAN_RESOURCES: Record<string, Record<string, boolean>> = {
  start: {
    agenda: true,
    clientes: true,
    financeiro: true,
    estoque: false,
    checklistBasico: true,
    checklistAvancado: false,
    metas: false,
    gamificacao: false,
    relatoriosBasicos: true,
    relatoriosAvancados: false,
    lumiInsights: false,
    lumiAdvisor: false,
    multiUnidade: false,
    suportePrioritario: false
  },
  founder: {
    agenda: true,
    clientes: true,
    financeiro: true,
    estoque: true,
    checklistBasico: true,
    checklistAvancado: true,
    metas: true,
    gamificacao: true,
    relatoriosBasicos: true,
    relatoriosAvancados: true,
    lumiInsights: true,
    lumiAdvisor: true,
    multiUnidade: false,
    suportePrioritario: true
  },
  performance: {
    agenda: true,
    clientes: true,
    financeiro: true,
    estoque: true,
    checklistBasico: true,
    checklistAvancado: true,
    metas: true,
    gamificacao: true,
    relatoriosBasicos: true,
    relatoriosAvancados: true,
    lumiInsights: true,
    lumiAdvisor: false,
    multiUnidade: false,
    suportePrioritario: false
  },
  network: {
    agenda: true,
    clientes: true,
    financeiro: true,
    estoque: true,
    checklistBasico: true,
    checklistAvancado: true,
    metas: true,
    gamificacao: true,
    relatoriosBasicos: true,
    relatoriosAvancados: true,
    lumiInsights: true,
    lumiAdvisor: true,
    multiUnidade: true,
    suportePrioritario: true
  },
  enterprise: {
    agenda: true,
    clientes: true,
    financeiro: true,
    estoque: true,
    checklistBasico: true,
    checklistAvancado: true,
    metas: true,
    gamificacao: true,
    relatoriosBasicos: true,
    relatoriosAvancados: true,
    lumiInsights: true,
    lumiAdvisor: true,
    multiUnidade: true,
    suportePrioritario: true
  }
};

const FEATURE_LABELS: Record<string, string> = {
  agenda: "Agenda Digital de Horários",
  clientes: "Gestão Avançada de Clientes (CRM)",
  financeiro: "Fluxo de Caixa e Controle de Comissões",
  estoque: "Controle de Estoque Inteligente",
  checklistBasico: "Checklists Operacionais Básicos",
  checklistAvancado: "Checklists Operacionais Avançados",
  metas: "Gestão de Metas por Equipe",
  gamificacao: "Motor de Gamificação e Desafios",
  relatoriosBasicos: "Relatórios de Performance Básicos",
  relatoriosAvancados: "Dashboard de Relatórios Avançados",
  lumiInsights: "Lumi Intelligence Engine (Insights de IA)",
  lumiAdvisor: "Lumi Executive Advisor (Relatórios Estratégicos)",
  multiUnidade: "Gestão Multiunidade e Franquias",
  suportePrioritario: "Suporte VIP e Implantação Assistida"
};

const PLAN_RANK: Record<string, number> = {
  start: 0,
  founder: 1,
  performance: 2,
  network: 3,
  enterprise: 4
};

// Required Business Helper Functions
export function getPlanGains(currentPlan: string, targetPlan: string): string[] {
  const currentFeatures = PLAN_RESOURCES[currentPlan] || PLAN_RESOURCES.start;
  const targetFeatures = PLAN_RESOURCES[targetPlan] || PLAN_RESOURCES.start;
  const gains: string[] = [];
  for (const feature in targetFeatures) {
    if (targetFeatures[feature] && !currentFeatures[feature]) {
      gains.push(FEATURE_LABELS[feature] || feature);
    }
  }
  return gains;
}

export function getPlanLosses(currentPlan: string, targetPlan: string): string[] {
  const currentFeatures = PLAN_RESOURCES[currentPlan] || PLAN_RESOURCES.start;
  const targetFeatures = PLAN_RESOURCES[targetPlan] || PLAN_RESOURCES.start;
  const losses: string[] = [];
  for (const feature in currentFeatures) {
    if (currentFeatures[feature] && !targetFeatures[feature]) {
      losses.push(FEATURE_LABELS[feature] || feature);
    }
  }
  return losses;
}

export function getMaintainedFeatures(currentPlan: string, targetPlan: string): string[] {
  const currentFeatures = PLAN_RESOURCES[currentPlan] || PLAN_RESOURCES.start;
  const targetFeatures = PLAN_RESOURCES[targetPlan] || PLAN_RESOURCES.start;
  const maintained: string[] = [];
  for (const feature in currentFeatures) {
    if (currentFeatures[feature] && targetFeatures[feature]) {
      maintained.push(FEATURE_LABELS[feature] || feature);
    }
  }
  return maintained;
}

export function getPriceDifference(currentPlan: string, targetPlan: string): number {
  const currentAmount = PLANS_PRICES[currentPlan] || 197;
  const targetAmount = PLANS_PRICES[targetPlan] || 197;
  return targetAmount - currentAmount;
}

export function isUpgrade(currentPlan: string, targetPlan: string): boolean {
  return (PLAN_RANK[targetPlan] || 0) > (PLAN_RANK[currentPlan] || 0);
}

export function isDowngrade(currentPlan: string, targetPlan: string): boolean {
  return (PLAN_RANK[targetPlan] || 0) < (PLAN_RANK[currentPlan] || 0);
}

export function validatePlanCompatibility(salon: any, targetPlan: string, professionalsCount: number): { compatible: boolean; reason?: string } {
  const maxProfessionals = PLANS_MAX_PROFESSIONALS[targetPlan] || 0;
  if (professionalsCount > maxProfessionals) {
    return {
      compatible: false,
      reason: `Você possui ${professionalsCount} profissionais cadastrados, mas o plano ${PLAN_NAMES[targetPlan]} suporta no máximo ${maxProfessionals} profissionais. Remova os profissionais excedentes para poder realizar o downgrade.`
    };
  }

  const unitsCount = salon.unitsCount || (salon.units ? (Array.isArray(salon.units) ? salon.units.length : 1) : 1);
  const isMultiUnitPlan = targetPlan === "network" || targetPlan === "enterprise";
  if (unitsCount > 1 && !isMultiUnitPlan) {
    return {
      compatible: false,
      reason: `Você possui ${unitsCount} unidades configuradas. O plano ${PLAN_NAMES[targetPlan]} não oferece suporte para Gestão Multiunidade. Exclua as unidades adicionais para prosseguir.`
    };
  }

  return { compatible: true };
}

export default function SubscriptionPage() {
  const { salonData, refreshUserData, isPlatformAdmin } = useAuth();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get('order_id');
  // Tabs navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'change_plan' | 'billing' | 'payment' | 'history'>('overview');

  // Real-time list states
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoadingAction, setIsLoadingAction] = useState(false);

  // Upgrade/Downgrade interactive states
  const [confirmTargetPlan, setConfirmTargetPlan] = useState<string | null>(null);
  const [awareOfDowngradeLimits, setAwareOfDowngradeLimits] = useState(false);

  // States for next billing payment method authorization
  const [selectedNextMethod, setSelectedNextMethod] = useState<'credit_card' | 'pix_automatic' | 'pix' | 'boleto'>('credit_card');
  const [realSub, setRealSub] = useState<any | null>(null);
  const [isLoadingRealSub, setIsLoadingRealSub] = useState(false);
  const [realSubError, setRealSubError] = useState<string | null>(null);
  const [isUpdatingMethod, setIsUpdatingMethod] = useState(false);

  const fetchRealSub = async () => {
    if (!salonData?.id) return;
    setIsLoadingRealSub(true);
    setRealSubError(null);
    try {
      const token = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/cakto/real-subscription?salonId=${salonData.id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao obter detalhes reais da assinatura.");
      }
      const data = await res.json();
      setRealSub(data);
    } catch (err: any) {
      console.error("[fetchRealSub] Erro:", err);
      setRealSubError(err.message || "Erro desconhecido ao consultar assinatura.");
    } finally {
      setIsLoadingRealSub(false);
    }
  };

  useEffect(() => {
    const hasRealCakto = isRealCaktoSubscription(salonData);
    if (activeTab === 'payment' && hasRealCakto) {
      fetchRealSub();
    }
  }, [activeTab, salonData?.id]);

  const handleUpdatePaymentMethod = async () => {
    if (!salonData?.id) return;
    setIsUpdatingMethod(true);
    try {
      const token = await auth.currentUser?.getIdToken(true);
      const res = await fetch('/api/cakto/update-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          salonId: salonData.id,
          paymentMethod: selectedNextMethod
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar forma de pagamento.");
      }

      if (data.requiresSupport) {
        toast.info(data.message, { duration: 10000 });
      } else {
        toast.success(data.message || "Forma de pagamento futura autorizada com sucesso!");
        if (data.authorizationUrl) {
          window.open(data.authorizationUrl, '_blank');
        }
      }

      await refreshUserData();
      await fetchRealSub();
    } catch (err: any) {
      console.error("[handleUpdatePaymentMethod] Erro:", err);
      toast.error(err.message || "Falha ao atualizar forma de pagamento.");
    } finally {
      setIsUpdatingMethod(false);
    }
  };

  // Listen to professionals
  useEffect(() => {
    if (!salonData?.id) return;
    const q = query(collection(db, `salons/${salonData.id}/professionals`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setProfessionals(list);
    }, (err) => {
      console.error("[Billing Page] Erro profissionais:", err);
    });
    return () => unsubscribe();
  }, [salonData?.id]);

  // Listen to billing history subcollection
  useEffect(() => {
    if (!salonData?.id) return;
    const q = query(collection(db, `salons/${salonData.id}/billingHistory`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setHistory(list.sort((a, b) => b.timestamp - a.timestamp));
    }, (err) => {
      console.error("[Billing Page] Erro histórico:", err);
    });
    return () => unsubscribe();
  }, [salonData?.id]);

  // Listen to payments subcollection
  useEffect(() => {
    if (!salonData?.id) return;
    const q = query(collection(db, `salons/${salonData.id}/payments`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setPayments(list.sort((a, b) => b.createdAt - a.createdAt));
    }, (err) => {
      console.error("[Billing Page] Erro pagamentos:", err);
    });
    return () => unsubscribe();
  }, [salonData?.id]);

  // States for activation flow
  const [isActivating, setIsActivating] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix' | 'boleto'>('credit_card');
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  useEffect(() => {
    if (salonData?.plan) {
      setSelectedPlan(salonData.plan);
    }
  }, [salonData]);

  if (!salonData) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = salonData.plan || 'start';
  const planInfo = PLANS_CONFIG[currentPlan as keyof typeof PLANS_CONFIG] || PLANS_CONFIG.start;

  // Compute actual overdue days
  let daysOverdue = 0;
  const isOverdueState = salonData.subscriptionStatus === 'overdue' || salonData.paymentStatus === 'overdue';

  if (isOverdueState) {
    if (salonData.nextBillingDate && salonData.nextBillingDate < Date.now()) {
      daysOverdue = Math.floor((Date.now() - salonData.nextBillingDate) / (24 * 60 * 60 * 1000));
    } else {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      const tenthOfThisMonth = new Date(currentYear, currentMonth, 10).getTime();
      
      if (Date.now() > tenthOfThisMonth) {
        daysOverdue = Math.floor((Date.now() - tenthOfThisMonth) / (24 * 60 * 60 * 1000));
      } else {
        const tenthOfPrevMonth = new Date(currentYear, currentMonth - 1, 10).getTime();
        daysOverdue = Math.floor((Date.now() - tenthOfPrevMonth) / (24 * 60 * 60 * 1000));
      }
    }
    if (daysOverdue <= 0) daysOverdue = 1;
  }

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (ts: number | undefined) => {
    if (!ts) return 'Não configurado';
    return new Date(ts).toLocaleDateString('pt-BR');
  };

  const handleActivate = async () => {
    if (!salonData.id) return;

    setIsActivating(true);
    try {
      toast.info('Sincronizando com o gateway Cakto...');
      
      const purpose = isManualActiveSubscription(salonData) ? 'activate_recurring' : 'new_subscription';

      const subResult = await billingService.createSubscription(salonData.id, salonData.ownerEmail || '', {
        planId: selectedPlan,
        paymentMethod: paymentMethod,
        checkoutPurpose: purpose
      } as any) as any;

      await refreshUserData();
      
      toast.success('Assinatura iniciada com sucesso! Redirecionando...');
      setShowActivationModal(false);

      const url = subResult.checkoutUrl;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.warning('O gateway não retornou a URL de checkout.');
      }
    } catch (err: any) {
      console.error("[Billing Page] Erro na ativação:", err);
      toast.error(err.message || 'Falha ao processar assinatura via Cakto.');
    } finally {
      setIsActivating(false);
    }
  };

  // Handle plan change action
  const handleSchedulePlanChange = async (targetPlanId: string) => {
    if (!salonData?.id) return;
    setIsLoadingAction(true);
    try {
      toast.info('Programando alteração de plano...');
      await schedulePlanChange(salonData.id, targetPlanId);

      toast.success('Solicitação registrada. A mudança será confirmada após processamento do gateway.');
      setConfirmTargetPlan(null);
      setAwareOfDowngradeLimits(false);
      setActiveTab('overview');
      await refreshUserData();
    } catch (err: any) {
      console.error("[Billing Page] Erro mudar plano:", err);
      toast.error(err.message || 'Falha ao solicitar alteração de plano.');
    } finally {
      setIsLoadingAction(false);
    }
  };

  // Cancel scheduled change
  const handleCancelPlanChange = async () => {
    if (!salonData?.id) return;
    setIsLoadingAction(true);
    try {
      toast.info('Cancelando alteração programada...');
      await cancelPlanChange(salonData.id);

      toast.success('Mudança programada cancelada com sucesso!');
      await refreshUserData();
    } catch (err: any) {
      console.error("[Billing Page] Erro cancelar:", err);
      toast.error(err.message || 'Falha ao cancelar alteração de plano.');
    } finally {
      setIsLoadingAction(false);
    }
  };

  // Simulate immediate confirmation (for testing/homologation)
  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'preview':
        return 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20';
      case 'pending_payment':
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'overdue':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'canceled':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'preview': return 'Avaliação Preview';
      case 'pending_payment':
      case 'pending': return 'Pagamento Pendente';
      case 'overdue': return 'Pagamento em atraso';
      case 'canceled': return 'Cancelada';
      default: return status || 'Pendente';
    }
  };

  // Overdue status styling
  const isSuspended = daysOverdue > 15;
  const isPremiumBlocked = daysOverdue > 7;
  const isStrongWarning = daysOverdue >= 4 && daysOverdue <= 7;
  const isSoftWarning = daysOverdue > 0 && daysOverdue <= 3;

  // Tab button styling helper
  const tabButtonClass = (tabId: typeof activeTab) => {
    const isActive = activeTab === tabId;
    return `px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 border uppercase ${
      isActive 
        ? 'bg-[#D4AF37] text-black border-[#D4AF37]' 
        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-900'
    }`;
  };

  // Founder eligibility criteria
  const isFounderEligible = salonData?.founderAuthorized === true || 
                            salonData?.isFounderAuthorized === true || 
                            currentPlan === 'founder' ||
                            isPlatformAdmin;

  return (
    <div className="relative min-h-screen bg-background space-y-6 pb-12 select-none text-white">
      
      {/* FULL-SCREEN SUSPENSION OVERLAY (Acima de 15 dias) */}
      {isSuspended && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="max-w-md w-full bg-zinc-950 border border-red-500/20 p-8 rounded-2xl shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Acesso Suspenso</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Sua assinatura do LumièreOS está atrasada há <span className="text-red-400 font-bold">{daysOverdue} dias</span>. O acesso ao sistema foi suspenso temporariamente.
              </p>
            </div>
            
            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-left space-y-2 text-xs text-zinc-400">
              <p className="flex items-center gap-2 text-white font-medium">
                <Info className="w-3.5 h-3.5 text-red-400" /> Como regularizar:
              </p>
              <p>1. Clique em "Regularizar Agora" abaixo.</p>
              <p>2. Complete o faturamento do plano via checkout seguro da Cakto.</p>
              <p>3. Seu acesso será reestabelecido automaticamente após a compensação.</p>
            </div>

            <button 
              type="button"
              onClick={() => {
                setSelectedPlan(currentPlan);
                setShowActivationModal(true);
              }}
              className="w-full bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold h-11 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Zap className="w-4 h-4 fill-black" /> Regularizar Agora
            </button>
          </div>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-heading text-white font-semibold">Central de Assinatura</h1>
          <p className="text-sm text-zinc-400 mt-1">Gerenciamento completo do plano LumièreOS, limites de equipe e faturamento.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Status atual:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getBadgeClass(salonData.subscriptionStatus)}`}>
            {getStatusText(salonData.subscriptionStatus)}
          </span>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto border-b border-zinc-900">
        <button type="button" onClick={() => { setActiveTab('overview'); setConfirmTargetPlan(null); }} className={tabButtonClass('overview')}>Visão Geral</button>
        <button type="button" onClick={() => { setActiveTab('change_plan'); setConfirmTargetPlan(null); }} className={tabButtonClass('change_plan')}>Planos</button>
        <button type="button" onClick={() => { setActiveTab('payment'); setConfirmTargetPlan(null); }} className={tabButtonClass('payment')}>Pagamento</button>
        <button type="button" onClick={() => { setActiveTab('billing'); setConfirmTargetPlan(null); }} className={tabButtonClass('billing')}>Cobranças</button>
        <button type="button" onClick={() => { setActiveTab('history'); setConfirmTargetPlan(null); }} className={tabButtonClass('history')}>Histórico</button>
      </div>


      {/* WARNING BANNERS BASED ON OVERDUE DAYS */}
      {isPremiumBlocked && !isSuspended && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-400 shrink-0">
              <Lock className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Recursos Premium Bloqueados!</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Pagamento em atraso há <span className="text-red-400 font-bold">{daysOverdue} dias</span> (carência de 7 dias esgotada).
                Insights estratégicos de IA, relatórios de rede e recursos extras estão suspensos até a regularização.
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="bg-red-500 hover:bg-red-600 text-white shrink-0 font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
            onClick={() => {
              setSelectedPlan(currentPlan);
              setShowActivationModal(true);
            }}
          >
            Regularizar Agora
          </button>
        </div>
      )}

      {isStrongWarning && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Alerta de Pagamento Pendente</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Assinatura em atraso há <span className="text-orange-400 font-bold">{daysOverdue} dias</span>. 
                Regularize o pagamento nas próximas 48h para evitar o bloqueio automático dos recursos avançados.
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="bg-orange-500 hover:bg-orange-600 text-white shrink-0 font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
            onClick={() => {
              setSelectedPlan(currentPlan);
              setShowActivationModal(true);
            }}
          >
            Pagar Pendência
          </button>
        </div>
      )}

      {isSoftWarning && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Faturamento Pendente</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Seu faturamento mensal está pendente há <span className="text-yellow-400 font-bold">{daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}</span>.
                Seu acesso continua ativo em período de tolerância. Regularize o quanto antes para evitar interrupções.
              </p>
            </div>
          </div>
          <button 
            type="button"
            className="bg-[#D4AF37] hover:bg-[#Bca032] text-black shrink-0 font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
            onClick={() => {
              setSelectedPlan(currentPlan);
              setShowActivationModal(true);
            }}
          >
            Pagar Mensalidade
          </button>
        </div>
      )}

      {/* TAB CONTENT: 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* MUDANÇA PROGRAMADA BANNER */}
          {salonData.pendingPlanChange && salonData.pendingPlanChange.status === 'awaiting_gateway' && (
            <div className="bg-blue-950/40 border border-blue-500/20 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <Calendar className="w-4 h-4" /> Mudança de Plano Programada
                </div>
                <h4 className="text-sm font-semibold text-white mt-1">
                  Transição de <span className="text-zinc-300">{PLAN_NAMES[salonData.pendingPlanChange.fromPlan]}</span> para <span className="text-blue-400 font-semibold">{PLAN_NAMES[salonData.pendingPlanChange.toPlan]}</span>
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                  A alteração entrará em vigor na próxima data de vencimento da fatura ({formatDate(salonData.pendingPlanChange.effectiveAt)}).
                  A diferença de valor estimada é de <span className="text-blue-400 font-bold">{salonData.pendingPlanChange.priceDifference >= 0 ? `+ ${formatMoney(salonData.pendingPlanChange.priceDifference)}` : `- ${formatMoney(Math.abs(salonData.pendingPlanChange.priceDifference))}`} / mês</span>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelPlanChange}
                  disabled={isLoadingAction}
                  className="bg-zinc-900 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 font-semibold text-xs px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isLoadingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Cancelar Mudança Programada
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CURRENT PLAN MAIN CARD */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-zinc-800 bg-black/40 text-white p-6 space-y-6">
                <div className="flex justify-between items-start border-b border-zinc-900 pb-5">
                  <div className="space-y-1">
                    <h3 className="font-semibold tracking-tight text-xl text-zinc-300">Resumo da Assinatura</h3>
                    <p className="text-xs text-zinc-500">Detalhes operacionais e nível de acesso atual.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#D4AF37] font-bold text-lg block">{planInfo.name}</span>
                    <span className="text-zinc-500 text-xs">{formatMoney(planInfo.monthlyAmount)} / mês</span>
                  </div>
                </div>

                {/* Progress metrics and limits */}
                <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl space-y-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#D4AF37]" /> Profissionais Cadastrados
                    </span>
                    <span className="text-white font-semibold font-mono">
                      {professionals.length} / {planInfo.maxProfessionals === 999 ? 'Ilimitado' : `${planInfo.maxProfessionals} colaboradores`}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#D4AF37] h-full transition-all duration-300" 
                      style={{ 
                        width: planInfo.maxProfessionals === 999 
                          ? '100%' 
                          : `${Math.min((professionals.length / planInfo.maxProfessionals) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    Seu plano atual suporta até {planInfo.maxProfessionals === 999 ? 'infinitos' : planInfo.maxProfessionals} profissionais ativos. Você está utilizando {(professionals.length)} posições de equipe.
                  </p>
                </div>

                {/* Metadata parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" /> Próximo Vencimento
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {salonData.nextBillingDate ? formatDate(salonData.nextBillingDate) : 'Todo dia 10'}
                    </p>
                  </div>

                  <div className="p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-[#D4AF37]" /> Forma de Faturamento
                    </span>
                    <p className="text-sm font-semibold text-white uppercase flex items-center gap-1 text-xs">
                      {salonData.billingProvider === 'cakto' ? '💳 Recorrente Cakto' : '💸 PIX / Transferência'}
                    </p>
                  </div>
                </div>

                {/* Features checklist */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Recursos ativos no seu plano:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(PLAN_RESOURCES[currentPlan] || PLAN_RESOURCES.start).map(([key, val]) => (
                      <div key={key} className={`flex items-center gap-2 text-xs ${val ? 'text-zinc-300' : 'text-zinc-600 line-through'}`}>
                        <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border shrink-0 ${
                          val 
                            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-700'
                        }`}>
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="truncate">{FEATURE_LABELS[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* QUICK ACTIONS PANEL */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-800 bg-black/40 text-white p-6 space-y-5">
                <div className="space-y-1">
                  <h3 className="font-semibold tracking-tight text-lg text-zinc-300">Ações de Cobrança</h3>
                  <p className="text-xs text-zinc-500">Autonomia total para o gerenciamento de faturamento.</p>
                </div>

                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-900 space-y-3">
                  {isManualActiveSubscription(salonData) ? (
                    <>
                      <div className="flex items-center gap-2 text-zinc-300 font-semibold text-xs uppercase tracking-wider">
                        <Coins className="w-4 h-4 text-zinc-400" /> Faturamento Manual
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Sua licença foi ativada manualmente. Para automatizar o pagamento da sua próxima mensalidade, você pode configurar uma assinatura na Cakto.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-[#D4AF37] font-semibold text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-[#D4AF37]" /> Conexão Cakto Ativa
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Sua assinatura está protegida e integrada à Cakto. Não coletamos nem armazenamos os seus dados de cartão de crédito.
                      </p>
                    </>
                  )}
                </div>

                <div className="space-y-2.5 pt-2">
                  {isManualActiveSubscription(salonData) ? (
                    <>
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedPlan(currentPlan);
                          setShowActivationModal(true);
                        }}
                        className="w-full bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold h-11 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                      >
                        <Zap className="w-4 h-4 fill-black" /> Configurar pagamento das próximas mensalidades
                      </button>

                      <a 
                        href={`https://wa.me/${BILLING_CONFIG.supportWhatsApp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 font-semibold h-11 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                      >
                        <HelpCircle className="w-4 h-4 text-zinc-400" /> Falar com Suporte Oficial
                      </a>
                    </>
                  ) : (
                    <>
                      <button 
                        type="button"
                        onClick={() => setActiveTab('change_plan')}
                        className="w-full bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold h-11 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                      >
                        <Zap className="w-4 h-4 fill-black" /> Gerenciar meu plano
                      </button>

                      {isOverdueState && (
                        <button 
                          type="button"
                          onClick={() => {
                            setSelectedPlan(currentPlan);
                            setShowActivationModal(true);
                          }}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-11 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                        >
                          <AlertTriangle className="w-4 h-4 text-white" /> Regularizar pagamento
                        </button>
                      )}

                      <button 
                        type="button"
                        onClick={() => setActiveTab('payment')}
                        className="w-full bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 font-semibold h-11 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                      >
                        <CreditCard className="w-4 h-4 text-zinc-400" /> Atualizar forma de pagamento
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB CONTENT: 2. CHANGE PLAN */}
      {activeTab === 'change_plan' && (
        <div className="space-y-6">
          
          {!confirmTargetPlan ? (
            <div className="space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-1.5 pb-4">
                <h3 className="text-xl font-bold text-white">Compare e Escolha o Plano Perfeito</h3>
                <p className="text-xs text-zinc-400">
                  Upgrade imediato sem taxas de adesão. Downgrades agendados com segurança de dados, respeitando os seus limites cadastrados.
                </p>
              </div>

              {/* pricing grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(PLANS_CONFIG)
                  .filter(([key]) => key !== 'founder' || isFounderEligible)
                  .map(([key, plan]) => {
                    const isCurrent = key === currentPlan;
                    const isUp = PLAN_RANK[key] > PLAN_RANK[currentPlan];
                    const diff = getPriceDifference(currentPlan, key);
                    const isRec = key === 'performance';

                    return (
                      <div 
                        key={key} 
                        className={`relative rounded-2xl border flex flex-col justify-between p-6 transition-all duration-200 bg-black/40 ${
                          isCurrent 
                            ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/20 bg-zinc-950/20' 
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {isRec && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D4AF37] text-black text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            Recomendado
                          </span>
                        )}

                        <div className="space-y-5">
                          <div className="space-y-1">
                            <h4 className="text-lg font-bold text-zinc-200">{plan.name}</h4>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-2xl font-bold font-mono text-white">{formatMoney(plan.monthlyAmount)}</span>
                              <span className="text-zinc-500 text-xs">/mês</span>
                            </div>
                            
                            {/* Monthly Difference tag */}
                            {!isCurrent && (
                              <span className={`inline-block text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded ${
                                isUp ? 'bg-indigo-500/10 text-indigo-400' : 'bg-green-500/10 text-green-400'
                              }`}>
                                {isUp ? `+ ${formatMoney(diff)}/mês` : `${formatMoney(diff)}/mês`}
                              </span>
                            )}
                          </div>

                          <div className="border-t border-zinc-900 pt-4 space-y-1 text-xs text-zinc-400">
                            <p className="font-semibold text-zinc-300">Profissionais:</p>
                            <p className="font-mono text-white text-[11px]">
                              {plan.maxProfessionals === 999 
                                ? 'Ilimitados colaboradores' 
                                : `Até ${plan.maxProfessionals} colaboradores`}
                            </p>
                          </div>

                          <div className="space-y-2 border-t border-zinc-900 pt-4">
                            <p className="text-xs font-semibold text-zinc-300">Recursos incluídos:</p>
                            <ul className="space-y-1.5 text-xs text-zinc-400">
                              {plan.features.slice(0, 4).map((f, i) => (
                                <li key={i} className="flex items-center gap-1.5 truncate">
                                  <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  <span className="truncate">{f}</span>
                                </li>
                              ))}
                              {plan.features.length > 4 && (
                                <li className="text-[10px] text-zinc-500 italic">E mais {plan.features.length - 4} recursos...</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        <div className="pt-6">
                          {isCurrent ? (
                            <button 
                              type="button" 
                              disabled 
                              className="w-full bg-zinc-900 text-zinc-500 text-xs font-semibold h-10 rounded-xl cursor-not-allowed border border-zinc-800"
                            >
                              Plano Atual
                            </button>
                          ) : (
                            <button 
                              type="button" 
                              onClick={() => setConfirmTargetPlan(key)}
                              className={`w-full text-xs font-semibold h-10 rounded-xl transition-all ${
                                isUp 
                                  ? 'bg-[#D4AF37] text-black hover:bg-[#Bca032]' 
                                  : 'bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                              }`}
                            >
                              {isUp ? 'Upgrade' : 'Downgrade'}
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            
            /* INTERACTIVE CONFIRMATION SECTION */
            <div className="max-w-2xl mx-auto rounded-2xl border border-zinc-800 bg-black/40 p-6 space-y-6 animate-fade-in">
              
              <div className="flex justify-between items-start border-b border-zinc-900 pb-5">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Confirmação de Alteração de Plano</h3>
                  <p className="text-xs text-zinc-500">Revise os impactos operacionais e financeiros da transição.</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setConfirmTargetPlan(null); setAwareOfDowngradeLimits(false); }}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  Voltar para Planos
                </button>
              </div>

              {/* VALIDATION BLOCK FOR INCOMPATIBILITIES */}
              {(() => {
                const compat = validatePlanCompatibility(salonData, confirmTargetPlan, professionals.length);
                if (!compat.compatible) {
                  return (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2.5 animate-in shake duration-150">
                      <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                        <XCircle className="w-4 h-4 text-red-400" /> Transição Bloqueada por Incompatibilidade
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {compat.reason}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        O downgrade de plano requer a redução manual das suas configurações de sistema e da equipe para se adequar ao limite do plano desejado antes que a transição de faturamento seja programada.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Valor Mensal Atual</span>
                  <p className="text-sm font-bold text-white">{formatMoney(PLANS_PRICES[currentPlan] || 0)} <span className="text-xs text-zinc-500 font-normal">({PLAN_NAMES[currentPlan]})</span></p>
                </div>

                <div className="p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Novo Valor Mensal</span>
                  <p className="text-sm font-bold text-[#D4AF37]">{formatMoney(PLANS_PRICES[confirmTargetPlan] || 0)} <span className="text-xs text-zinc-500 font-normal">({PLAN_NAMES[confirmTargetPlan]})</span></p>
                </div>
              </div>

              {/* UPGRADE SUMMARY */}
              {isUpgrade(currentPlan, confirmTargetPlan) && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> ✨ Você ganhará:
                    </h4>
                    <ul className="space-y-1">
                      {getPlanGains(currentPlan, confirmTargetPlan).map((feat, idx) => (
                        <li key={idx} className="text-xs text-zinc-300 flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-green-400 shrink-0" /> {feat}
                        </li>
                      ))}
                      <li className="text-xs text-zinc-300 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-green-400 shrink-0" /> Novo limite de equipe expandido para <span className="text-indigo-400 font-semibold">{PLANS_MAX_PROFESSIONALS[confirmTargetPlan]} profissionais</span>.
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2 text-xs text-zinc-400 leading-normal">
                    <p className="font-semibold text-white">Vigência e Faturamento:</p>
                    <p>O upgrade será programado em sua conta da Cakto. A diferença de valor mensal calculada será de <strong>+ {formatMoney(getPriceDifference(currentPlan, confirmTargetPlan))} / mês</strong>, adicionada ao seu próximo ciclo recorrente{salonData.nextBillingDate ? ` (${formatDate(salonData.nextBillingDate)})` : ''}.</p>
                  </div>
                </div>
              )}

              {/* DOWNGRADE SUMMARY */}
              {isDowngrade(currentPlan, confirmTargetPlan) && (
                <div className="space-y-4">
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowDown className="w-3.5 h-3.5" /> Você continuará com:
                    </h4>
                    <ul className="space-y-1">
                      {getMaintainedFeatures(currentPlan, confirmTargetPlan).map((feat, idx) => (
                        <li key={idx} className="text-xs text-zinc-300 flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-green-400 shrink-0" /> {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Você perderá:
                    </h4>
                    <ul className="space-y-1">
                      {getPlanLosses(currentPlan, confirmTargetPlan).map((feat, idx) => (
                        <li key={idx} className="text-xs text-zinc-300 flex items-center gap-2">
                          <span className="text-red-400 font-bold shrink-0">✕</span> {feat}
                        </li>
                      ))}
                      <li className="text-xs text-zinc-300 flex items-center gap-2">
                        <span className="text-red-400 font-bold shrink-0">✕</span> Redução do limite de equipe de {PLANS_MAX_PROFESSIONALS[currentPlan]} para <span className="text-red-400 font-bold">{PLANS_MAX_PROFESSIONALS[confirmTargetPlan]} profissionais</span>.
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-3">
                    <p className="text-xs text-zinc-400 font-semibold text-white leading-normal">
                      🛡️ Segurança e Preservação de Dados LumièreOS:
                    </p>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Seus dados operacionais e históricos de profissionais e unidades nunca serão apagados ou alterados de forma automática no downgrade. O limite operacional de colaboradores passará a ser validado apenas na data de início do novo ciclo de faturamento.
                    </p>

                    <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={awareOfDowngradeLimits}
                        onChange={(e) => setAwareOfDowngradeLimits(e.target.checked)}
                        className="mt-0.5 rounded border-zinc-800 bg-zinc-950 text-[#D4AF37] focus:ring-[#D4AF37]"
                      />
                      <span className="text-xs text-zinc-300 font-medium">
                        Estou ciente dos recursos e limites que serão removidos na data de vigência do novo plano{salonData.nextBillingDate ? ` no próximo ciclo (${formatDate(salonData.nextBillingDate)})` : ' no próximo ciclo'}.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setConfirmTargetPlan(null); setAwareOfDowngradeLimits(false); }}
                  className="bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all"
                >
                  Voltar
                </button>

                <button 
                  type="button" 
                  disabled={
                    isLoadingAction || 
                    !validatePlanCompatibility(salonData, confirmTargetPlan, professionals.length).compatible ||
                    (isDowngrade(currentPlan, confirmTargetPlan) && !awareOfDowngradeLimits)
                  }
                  onClick={() => handleSchedulePlanChange(confirmTargetPlan)}
                  className="bg-[#D4AF37] hover:bg-[#Bca032] text-black font-bold text-xs px-5 py-2 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isLoadingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Alteração
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB CONTENT: 3. BILLING / INVOICES */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* NEXT INVOICE CARD */}
            <div className="md:col-span-1">
              <div className="rounded-2xl border border-zinc-800 bg-black/40 text-white p-6 space-y-4">
                <h3 className="font-semibold text-sm text-zinc-400 uppercase tracking-wider">Próxima Cobrança</h3>
                <div className="space-y-1">
                  <span className="text-2xl font-bold font-mono block text-white">
                    {formatMoney(planInfo.monthlyAmount)}
                  </span>
                  <span className="text-zinc-500 text-xs">Faturamento recorrente</span>
                </div>

                <div className="border-t border-zinc-900 pt-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Status:</span>
                    <span className="text-yellow-400 font-semibold uppercase">Aguardando</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Vencimento:</span>
                    <span className="text-white font-semibold">
                      {salonData.nextBillingDate ? formatDate(salonData.nextBillingDate) : 'Todo dia 10'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Forma:</span>
                    <span className="text-white font-semibold uppercase">
                      {salonData.billingProvider === 'cakto' ? 'Cartão de Crédito' : 'PIX'}
                    </span>
                  </div>
                </div>

                {isOverdueState && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlan(currentPlan);
                      setShowActivationModal(true);
                    }}
                    className="w-full bg-[#D4AF37] hover:bg-[#Bca032] text-black text-xs font-semibold h-10 rounded-xl transition-all"
                  >
                    Regularizar Agora
                  </button>
                )}
              </div>
            </div>

            {/* BILLING LIST (payments collection) */}
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-zinc-800 bg-black/40 text-white p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-zinc-200">Histórico de Cobranças</h3>
                  <span className="text-[10px] text-zinc-500 uppercase">Valores integrados via Cakto</span>
                </div>

                {payments.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl space-y-2">
                    <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-xs">Nenhuma fatura ou transação registrada anteriormente.</p>
                    <p className="text-[10px] text-zinc-600">Sua assinatura atual pode estar utilizando o período de avaliação gratuita.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-zinc-900 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 uppercase font-semibold text-[10px] tracking-wider">
                          <th className="p-3">Data</th>
                          <th className="p-3">ID Pedido / Transação</th>
                          <th className="p-3">Método</th>
                          <th className="p-3">Valor</th>
                          <th className="p-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {payments.map((p) => (
                          <tr key={p.id} className="hover:bg-zinc-900/40">
                            <td className="p-3 text-zinc-400">{formatDate(p.createdAt)}</td>
                            <td className="p-3 font-mono font-bold text-zinc-300 text-[11px] select-all">{p.id}</td>
                            <td className="p-3 text-zinc-400 uppercase">{p.method === 'pix' ? '💸 Pix' : '💳 Cartão'}</td>
                            <td className="p-3 text-white font-bold">{formatMoney(p.amount)}</td>
                            <td className="p-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                p.status === 'paid' 
                                  ? 'bg-green-500/10 text-green-400' 
                                  : p.status === 'rejected' 
                                    ? 'bg-red-500/10 text-red-400' 
                                    : 'bg-yellow-500/10 text-yellow-400'
                              }`}>
                                {p.status === 'paid' ? 'Pago' : p.status === 'rejected' ? 'Recusado' : p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB CONTENT: 4. PAYMENT */}
      {activeTab === 'payment' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {!isRealCaktoSubscription(salonData) ? (
            <div className="space-y-6">
              {/* Cobertura Atual Block */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Mensalidade atual paga</h3>
                    <p className="text-xs text-emerald-500/90 font-medium">Acesso coberto de forma integral</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Plano</span>
                    <span className="text-xs font-bold text-white block pt-1">
                      Plano Founder (Pioneiro)
                    </span>
                  </div>
                  <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Faturamento</span>
                    <span className="text-xs font-bold text-white block pt-1">
                      Faturamento manual
                    </span>
                  </div>
                  <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Garantia de Acesso</span>
                    <span className="text-xs font-bold text-white block pt-1">
                      Seu acesso está garantido até: {salonData.nextBillingDate ? formatDate(salonData.nextBillingDate) : "Vigência ativa"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#D4AF37]/5 border border-[#D4AF37]/10 p-3 rounded-lg text-xs text-zinc-400">
                  <Info className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Sua licença foi ativada manualmente. Para automatizar o pagamento da sua próxima mensalidade, você pode configurar uma assinatura na Cakto.
                  </p>
                </div>

                {/* Botão de Ação */}
                <div className="pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setSelectedPlan(currentPlan);
                      setShowActivationModal(true);
                    }}
                    className="w-full bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold text-xs py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-black" />
                    Configurar pagamento das próximas mensalidades
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {isLoadingRealSub ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/40 text-white p-12 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
                  <p className="text-xs text-zinc-400">Consultando status real da assinatura na API Cakto...</p>
                </div>
              ) : realSubError ? (
                <div className="rounded-2xl border border-red-900/40 bg-red-950/10 text-white p-6 space-y-4">
                  <div className="flex gap-3 items-start">
                    <div className="p-2 bg-red-950/30 rounded-lg text-red-500 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Falha ao consultar assinatura</h4>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        Não foi possível consultar os detalhes de faturamento junto à Cakto:
                      </p>
                      <p className="text-xs text-red-400 font-mono mt-2 bg-red-950/20 p-3 rounded-lg border border-red-950/40">
                        {realSubError}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-zinc-900 pt-3">
                    Para a sua segurança, o gerenciamento de pagamento está temporariamente indisponível. Por favor, entre em contato com nosso suporte financeiro.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Cobertura Atual Block */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Mensalidade Atual Garantida</h3>
                        <p className="text-xs text-emerald-500/90 font-medium">Acesso coberto de forma integral</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Garantia de Acesso</span>
                        <span className="text-xs font-semibold text-zinc-300">Seu acesso está garantido até:</span>
                        <span className="text-sm font-bold text-white block pt-1">
                          {realSub?.next_payment_date ? new Date(realSub.next_payment_date).toLocaleDateString("pt-BR") : "Vigência ativa"}
                        </span>
                      </div>
                      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Próximo Faturamento</span>
                        <span className="text-xs font-semibold text-zinc-300">Próxima cobrança programada:</span>
                        <span className="text-sm font-bold text-[#D4AF37] block pt-1">
                          {realSub?.next_payment_date ? new Date(realSub.next_payment_date).toLocaleDateString("pt-BR") : "Vigência ativa"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-[#D4AF37]/5 border border-[#D4AF37]/10 p-3 rounded-lg text-xs text-zinc-400">
                      <Info className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Como a sua mensalidade atual está paga, a escolha de um novo método <strong>não gera cobrança imediata</strong>. Nenhuma nova assinatura ou pedido de compra será gerado. Apenas a sua preferência para as próximas cobranças será programada na Cakto.
                      </p>
                    </div>
                  </div>

                  {/* Forma de Pagamento das Próximas Cobranças */}
                  <div className="rounded-2xl border border-zinc-800 bg-black/40 text-white p-6 space-y-6">
                    <div className="space-y-1 border-b border-zinc-900 pb-4">
                      <h3 className="text-lg font-semibold text-white">Forma de pagamento das próximas cobranças</h3>
                      <p className="text-xs text-zinc-500">Selecione o método preferido para os próximos vencimentos de {formatMoney(planInfo.monthlyAmount)}/mês.</p>
                    </div>

                    {/* Métodos de Pagamento */}
                    <div className="grid grid-cols-1 gap-3">
                      
                      {/* Cartão de Crédito */}
                      <label 
                        onClick={() => setSelectedNextMethod('credit_card')}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                          selectedNextMethod === 'credit_card' 
                            ? 'bg-[#D4AF37]/5 border-[#D4AF37] text-white' 
                            : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="next_payment_method" 
                          checked={selectedNextMethod === 'credit_card'}
                          onChange={() => {}} 
                          className="sr-only" 
                        />
                        <div className={`p-2 rounded-lg shrink-0 ${selectedNextMethod === 'credit_card' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-zinc-900 text-zinc-400'}`}>
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            Cartão de Crédito Recorrente
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-normal uppercase tracking-wide">Automático</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Cobrança recorrente no dia do vencimento. Não consome o limite total do cartão, apenas a mensalidade individual de R$ 297.
                          </p>
                        </div>
                      </label>

                      {/* Pix Automático */}
                      <label 
                        onClick={() => setSelectedNextMethod('pix_automatic')}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                          selectedNextMethod === 'pix_automatic' 
                            ? 'bg-[#D4AF37]/5 border-[#D4AF37] text-white' 
                            : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="next_payment_method" 
                          checked={selectedNextMethod === 'pix_automatic'}
                          onChange={() => {}} 
                          className="sr-only" 
                        />
                        <div className={`p-2 rounded-lg shrink-0 ${selectedNextMethod === 'pix_automatic' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-zinc-900 text-zinc-400'}`}>
                          <Zap className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            Pix Automático (Débito)
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-normal uppercase tracking-wide">Automático</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Débito em conta de forma programada pelo seu banco parceiro. Sem esquecimento e sem taxas extras.
                          </p>
                        </div>
                      </label>

                      {/* Pix Manual */}
                      <label 
                        onClick={() => setSelectedNextMethod('pix')}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                          selectedNextMethod === 'pix' 
                            ? 'bg-[#D4AF37]/5 border-[#D4AF37] text-white' 
                            : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="next_payment_method" 
                          checked={selectedNextMethod === 'pix'}
                          onChange={() => {}} 
                          className="sr-only" 
                        />
                        <div className={`p-2 rounded-lg shrink-0 ${selectedNextMethod === 'pix' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-zinc-900 text-zinc-400'}`}>
                          <Coins className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            Pix Avulso (Manual)
                            <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-normal uppercase tracking-wide">Manual</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Você receberá um lembrete com a chave copia-e-cola via WhatsApp e e-mail no dia do vencimento para efetuar o pagamento manualmente.
                          </p>
                        </div>
                      </label>

                      {/* Boleto Manual */}
                      <label 
                        onClick={() => setSelectedNextMethod('boleto')}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                          selectedNextMethod === 'boleto' 
                            ? 'bg-[#D4AF37]/5 border-[#D4AF37] text-white' 
                            : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="next_payment_method" 
                          checked={selectedNextMethod === 'boleto'}
                          onChange={() => {}} 
                          className="sr-only" 
                        />
                        <div className={`p-2 rounded-lg shrink-0 ${selectedNextMethod === 'boleto' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-zinc-900 text-zinc-400'}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            Boleto Bancário (Manual)
                            <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-normal uppercase tracking-wide">Manual</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Emissão de boleto enviada para o seu e-mail cadastrado 5 dias antes de vencer.
                          </p>
                        </div>
                      </label>

                    </div>

                    {/* Painel de Confirmação Dinâmico */}
                    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950 space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Valor Recorrente:</span>
                        <span className="font-semibold text-white">R$ 297,00 / mês</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-zinc-900 pt-3">
                        <span className="text-zinc-500">Próxima data de cobrança:</span>
                        <span className="font-semibold text-[#D4AF37]">
                          {realSub?.next_payment_date ? new Date(realSub.next_payment_date).toLocaleDateString("pt-BR") : "Vigência ativa"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-zinc-900 pt-3">
                        <span className="text-zinc-500">Cobrança Imediata:</span>
                        <span className="font-semibold text-emerald-500 uppercase tracking-wide flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> R$ 0,00 (Nenhuma)
                        </span>
                      </div>

                      <p className="text-[10px] text-zinc-500 text-center italic pt-1 leading-relaxed">
                        Nenhum valor será cobrado hoje do seu limite ou saldo. O faturamento ocorrerá estritamente na data de vencimento confirmada.
                      </p>
                    </div>

                    {/* Botão de Ação */}
                    <div className="pt-2">
                      <button 
                        type="button"
                        onClick={handleUpdatePaymentMethod}
                        disabled={isUpdatingMethod}
                        className="w-full bg-[#D4AF37] hover:bg-[#Bca032] disabled:opacity-50 text-black font-semibold text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        {isUpdatingMethod ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-black" />
                            Processando Autorização...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-black font-bold" />
                            Autorizar para próximas cobranças
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT: 5. HISTORY */}
      {activeTab === 'history' && (
        <div className="max-w-2xl mx-auto space-y-6">
          
          <div className="rounded-2xl border border-zinc-800 bg-black/40 text-white p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white">Histórico e Auditoria de Cobrança</h3>
                <p className="text-xs text-zinc-500">Transparência total nos eventos da sua conta.</p>
              </div>
              <button 
                type="button" 
                onClick={async () => {
                  toast.info('Atualizando histórico...');
                  await refreshUserData();
                }} 
                className="p-1 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-all"
                title="Sincronizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {history.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl space-y-2">
                <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs">Nenhum evento registrado no histórico.</p>
                <p className="text-[10px] text-zinc-600">Eventos de ativação, mudanças ou pagamentos serão listados de forma cronológica.</p>
              </div>
            ) : (
              <div className="relative border-l border-zinc-800 pl-6 ml-3.5 space-y-6 py-2">
                {history.map((item) => {
                  let icon = <Clock className="w-4 h-4 text-zinc-400" />;
                  let bgClass = 'bg-zinc-900 text-zinc-400 border-zinc-800';

                  if (item.eventType === 'activation' || item.eventType === 'regularization') {
                    icon = <Check className="w-4 h-4 text-green-400" />;
                    bgClass = 'bg-green-500/10 text-green-400 border-green-500/20';
                  } else if (item.eventType === 'upgrade_applied') {
                    icon = <Sparkles className="w-4 h-4 text-indigo-400" />;
                    bgClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                  } else if (item.eventType === 'downgrade_applied') {
                    icon = <ArrowDown className="w-4 h-4 text-orange-400" />;
                    bgClass = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                  } else if (item.eventType === 'change_requested') {
                    icon = <Calendar className="w-4 h-4 text-blue-400" />;
                    bgClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                  } else if (item.eventType === 'change_canceled') {
                    icon = <XCircle className="w-4 h-4 text-zinc-400" />;
                    bgClass = 'bg-zinc-900 text-zinc-400 border-zinc-800';
                  } else if (item.eventType === 'charge_approved') {
                    icon = <CreditCard className="w-4 h-4 text-green-400" />;
                    bgClass = 'bg-green-500/10 text-green-400 border-green-500/20';
                  } else if (item.eventType === 'charge_refused') {
                    icon = <AlertTriangle className="w-4 h-4 text-red-400" />;
                    bgClass = 'bg-red-500/10 text-red-400 border-red-500/20';
                  } else if (item.eventType === 'canceled') {
                    icon = <Lock className="w-4 h-4 text-zinc-500" />;
                    bgClass = 'bg-zinc-800 text-zinc-400 border-zinc-700';
                  }

                  return (
                    <div key={item.id} className="relative group animate-fade-in">
                      {/* Timeline Dot Indicator */}
                      <span className={`absolute -left-10 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs ${bgClass}`}>
                        {icon}
                      </span>

                      <div className="space-y-1">
                        <div className="flex flex-wrap justify-between items-baseline gap-2">
                          <h4 className="text-xs font-bold text-zinc-200">{item.title}</h4>
                          <span className="text-[10px] text-zinc-500 font-mono font-medium">{formatDate(item.timestamp)} {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-normal">{item.description}</p>
                        <div className="flex gap-2 items-center text-[9px] text-zinc-500 pt-1 uppercase tracking-wider font-bold">
                          <span>Por: {item.recordedBy || 'Sistema'}</span>
                          {item.amount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-zinc-300">Valor: {formatMoney(item.amount)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>
      )}

      {/* ACTIVATION MODAL */}
      {showActivationModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl space-y-5 text-left">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#D4AF37]" /> Ativar Faturamento LumièreOS
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Inicie sua assinatura recorrente segura via Cakto.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowActivationModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs font-medium text-zinc-400">Plano Selecionado</label>
                <select 
                  value={selectedPlan} 
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-white text-xs h-10 rounded-xl px-3 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="start">Start (R$ 197/mês)</option>
                  {isFounderEligible && <option value="founder">Founder (Pioneiro) (R$ 297/mês)</option>}
                  <option value="performance">Performance (R$ 397/mês)</option>
                  <option value="network">Network (R$ 797/mês)</option>
                  <option value="enterprise">Enterprise (R$ 1997/mês)</option>
                </select>
              </div>

              <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80 space-y-1 text-[11px] text-zinc-400 leading-normal">
                <p className="font-semibold text-white flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Segurança de Pagamento</p>
                <p>Nenhum dado financeiro ou de cartão é armazenado em nosso servidor. O processamento é realizado criptografado diretamente pela Cakto.</p>
              </div>

              {salonData.caktoSubscriptionId && salonData.subscriptionStatus === 'active' && (
                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 space-y-1.5 text-[11px] text-red-400 leading-normal">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 font-bold" /> Alteração de Cartão / Plano
                  </p>
                  <p>
                    Seu salão possui uma assinatura ativa. Para realizar atualizações manuais seguras sem risco de duplicidade de cobranças, entre em contato diretamente com o nosso suporte oficial.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => setShowActivationModal(false)}
                className="text-zinc-400 hover:text-white text-xs px-4 py-2 transition-colors"
                disabled={isActivating}
              >
                Voltar
              </button>
              <button 
                type="button" 
                onClick={handleActivate}
                disabled={isActivating || (!!salonData.caktoSubscriptionId && salonData.subscriptionStatus === 'active')}
                className="bg-[#D4AF37] hover:bg-[#Bca032] text-black font-semibold rounded-xl flex items-center justify-center gap-2 px-5 h-10 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ir para Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  DollarSign, 
  TrendingUp, 
  Percent, 
  Users, 
  Calendar, 
  FileText, 
  ChevronRight, 
  Clock, 
  Edit3,
  CheckCircle,
  HelpCircle,
  PiggyBank,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatBRL } from '@/lib/utils';
import { canEditCommissionRules } from '../../lib/permissions';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { calculateCommission } from '../../lib/commissions';
import { applyXPGain } from '../../lib/gamification';

interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  status: 'scheduled' | 'completed' | 'canceled' | 'no_show';
  notes?: string;
  price?: number;
  isManualLaunch?: boolean;
}

interface Professional {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  commissionRate?: number; // Configurable per-user, defaults to 50
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface ProfessionalGoal {
  id: string; // professionalId_month
  professionalId: string;
  professionalName: string;
  month: string; // YYYY-MM
  targetAmount: number;
  currentValue?: number;
  createdAt: number;
  updatedAt: number;
  goalXPAwardedAt?: number;
}

export default function CommissionsPage() {
  const { salonData, userData } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionalGoals, setProfessionalGoals] = useState<ProfessionalGoal[]>([]);
  const [loading, setLoading] = useState(true);

  // States for selectors
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const [selectedProfId, setSelectedProfId] = useState<string>('all');
  const [adjustingProf, setAdjustingProf] = useState<Professional | null>(null);
  const [newCommissionRate, setNewCommissionRate] = useState<number>(50);
  const [selectedExtratoProf, setSelectedExtratoProf] = useState<Professional | null>(null);

  // States for Quick Production Launch Modal
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [launchProfessional, setLaunchProfessional] = useState<Professional | null>(null);
  const [launchValue, setLaunchValue] = useState("");
  const [launchMode, setLaunchMode] = useState<"set" | "add">("set");
  const [launchMonth, setLaunchMonth] = useState(selectedMonth);

  const handleConfirmLaunchProduction = async () => {
    if (!salonData || !launchProfessional) return;

    const value = parseFloat(launchValue.replace(",", "."));
    if (isNaN(value) || value < 0) {
      toast.error("Por favor, insira um valor numérico válido.");
      return;
    }

    try {
      const docId = `${launchProfessional.id}_${launchMonth}`;
      const existingGoal = professionalGoals.find(
        g => g.professionalId === launchProfessional.id && g.month === launchMonth
      );
      const currentManualVal = existingGoal?.currentValue ?? 0;

      let newValue = value;
      if (launchMode === "add") {
        newValue = currentManualVal + value;
      }

      const payload: any = {
        id: docId,
        professionalId: launchProfessional.id,
        professionalName: launchProfessional.name,
        month: launchMonth,
        currentValue: newValue,
        lastProgressUpdateAt: Date.now(),
        lastProgressUpdatedBy: userData?.fullName || userData?.email || "Manager",
        updatedAt: Date.now(),
      };

      const targetAmount = existingGoal?.targetAmount ?? 0;
      const alreadyAwarded = !!existingGoal?.goalXPAwardedAt;

      if (targetAmount > 0 && newValue >= targetAmount && !alreadyAwarded) {
        payload.goalXPAwardedAt = Date.now();
        try {
          await applyXPGain(salonData.id, launchProfessional.id, 'MONTHLY_GOAL_HIT', undefined, {
            fullName: launchProfessional.name || 'Colaborador',
            role: launchProfessional.role || 'professional',
            reason: 'Meta faturamento mensal batida'
          });
          toast.success(`🎯 ${launchProfessional.name} bateu a meta! +500 XP`);
        } catch (xpErr) {
          console.error("Erro ao aplicar XP ao bater meta:", xpErr);
        }
      }

      const ref = doc(db, `salons/${salonData.id}/professionalGoals`, docId);
      await setDoc(ref, payload, { merge: true });

      toast.success(`Produção de ${launchProfessional.name} atualizada para ${formatBRL(newValue)}!`);
      setIsLaunchModalOpen(false);
      setLaunchValue("");
      setLaunchProfessional(null);
    } catch (err) {
      console.error("Error saving manual production from Commissions:", err);
      toast.error("Erro ao salvar faturamento manual.");
    }
  };

  const openLaunchModal = (prof: Professional) => {
    setLaunchProfessional(prof);
    setLaunchMonth(selectedMonth);
    setLaunchValue("");
    setLaunchMode("set");
    setIsLaunchModalOpen(true);
  };

  useEffect(() => {
    if (!salonData) return;

    setLoading(true);
    const unsubs: (() => void)[] = [];

    // Load completed and scheduled appointments for commissions
    const qa = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(onSnapshot(qa, (snap) => {
      const arr: Appointment[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Appointment));
      // Only keep completed items
      setAppointments(arr.filter(a => a.status === 'completed'));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar lançamentos para comissões:", error);
      setLoading(false);
    }));

    // Load Professionals
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(onSnapshot(qp, (snap) => {
      const arr: Professional[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Professional));
      setProfessionals(arr);
    }));

    // Load Services for pricing fallbacks
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    unsubs.push(onSnapshot(qs, (snap) => {
      const arr: Service[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Service));
      setServices(arr);
    }));

    // Load Professional Goals
    const qg = query(collection(db, `salons/${salonData.id}/professionalGoals`));
    unsubs.push(onSnapshot(qg, (snap) => {
      const arr: ProfessionalGoal[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as ProfessionalGoal));
      setProfessionalGoals(arr);
    }, (error) => {
      console.error("Erro ao carregar metas dos profissionais:", error);
    }));

    return () => unsubs.forEach(u => u());
  }, [salonData]);

  // Months lists
  const availableMonths = React.useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = -5; i <= 1; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      months.push({ value: `${y}-${m}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return months;
  }, []);

  // Helpers to fetch prices & compute rates
  const getApptPrice = (app: Appointment) => {
    if (app.price !== undefined) return app.price;
    const match = services.find(s => s.id === app.serviceId);
    return match ? match.price : 0;
  };

  const getPropCommissionRate = (prof: Professional) => {
    return prof.commissionRate !== undefined ? prof.commissionRate : 50;
  };

  // Filtered appointments by selected month and profile
  const filteredAppointments = React.useMemo(() => {
    return appointments.filter(app => {
      const matchesMonth = app.date.startsWith(selectedMonth);
      const matchesProf = selectedProfId === 'all' || app.professionalId === selectedProfId;
      return matchesMonth && matchesProf;
    });
  }, [appointments, selectedMonth, selectedProfId]);

  // Set of all professionals referenced in appointments (to handle fallback/inactive/missing)
  const appointmentsProfessionals = React.useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach(app => {
      if (app.professionalId && app.professionalName) {
        map.set(app.professionalId, app.professionalName);
      }
    });
    return map;
  }, [appointments]);

  // Breakdown by individual professional for current month
  const professionalsReport = React.useMemo(() => {
    // Determine the list of professionals to evaluate:
    // 1. Any professional that is actively registered in professionals collection (isActive !== false)
    // 2. Any deactivated or other professional from professionals collection if they have sales in selectedMonth
    // 3. Any professional found in appointments of the selectedMonth who is missing from professionals collection
    // 4. Any professional with a goal set for the selectedMonth
    const list: (Professional & { 
      salesCount?: number; 
      totalRevenue?: number; 
      totalCommission?: number; 
      netEstablishment?: number;
      componentSummary?: any;
    })[] = [];

    // Add people from database first
    professionals.forEach(p => {
      const isActive = p.isActive !== false;
      const hasSalesInMonth = appointments.some(app => app.professionalId === p.id && app.date.startsWith(selectedMonth));
      const hasGoalInMonth = professionalGoals.some(g => g.professionalId === p.id && g.month === selectedMonth);
      
      if (isActive || hasSalesInMonth || hasGoalInMonth) {
        list.push({ ...p });
      }
    });

    // Add any missing professionals who have appointments in this month
    appointments.forEach(app => {
      if (app.professionalId && app.date.startsWith(selectedMonth)) {
        if (!list.some(p => p.id === app.professionalId)) {
          list.push({
            id: app.professionalId,
            name: app.professionalName || 'Profissional Outro',
            role: 'Especialista',
            isActive: false,
            commissionRate: 50 // default fallback
          });
        }
      }
    });

    // Add any missing professionals who have goals in this month
    professionalGoals.forEach(g => {
      if (g.professionalId && g.month === selectedMonth) {
        if (!list.some(p => p.id === g.professionalId)) {
          list.push({
            id: g.professionalId,
            name: g.professionalName || 'Profissional Outro_G',
            role: 'Especialista',
            isActive: false,
            commissionRate: 50
          });
        }
      }
    });

    // Filter list based on role-based permissions:
    // platform_admin, owner and manager can see everyone
    // receptionist, attendant and professional can only see themselves
    const isOwnerOrManager = userData?.role === 'owner' || userData?.role === 'manager' || userData?.role === 'platform_admin';
    let filteredList = isOwnerOrManager 
      ? list 
      : list.filter(p => userData?.professionalId && p.id === userData.professionalId);

    // Filter by selectedProfId dropdown
    if (selectedProfId !== 'all') {
      filteredList = filteredList.filter(p => p.id === selectedProfId);
    }

    return filteredList.map(prof => {
      const profAppts = appointments.filter(app => 
        app.professionalId === prof.id && 
        app.date.startsWith(selectedMonth)
      );

      const profGoal = professionalGoals.find(g => 
        g.professionalId === prof.id && 
        g.month === selectedMonth
      ) || null;

      const summary = calculateCommission(
        {
          id: prof.id,
          name: prof.name,
          role: prof.role,
          isActive: prof.isActive,
          commissionRate: prof.commissionRate
        } as any,
        profAppts as any,
        profGoal as any,
        services as any
      );

      return {
        ...prof,
        totalRevenue: summary.totalProduction,
        totalCommission: summary.commissionValue,
        netEstablishment: summary.totalProduction - summary.commissionValue,
        salesCount: profAppts.length,
        componentSummary: summary
      };
    }).sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
  }, [professionals, appointments, professionalGoals, selectedMonth, services, userData, selectedProfId]);

  // Calculated Stats
  const stats = React.useMemo(() => {
    let totalRevenue = 0;
    let totalCommissionToPay = 0;

    professionalsReport.forEach(p => {
      totalRevenue += p.totalRevenue || 0;
      totalCommissionToPay += p.totalCommission || 0;
    });

    const totalNetEstablishment = totalRevenue - totalCommissionToPay;
    const ticketsCount = filteredAppointments.length;
    const avgTicket = ticketsCount > 0 ? totalRevenue / ticketsCount : 0;

    return {
      totalRevenue,
      totalCommissionToPay,
      totalNetEstablishment,
      ticketsCount,
      avgTicket
    };
  }, [professionalsReport, filteredAppointments]);

  // Chart data for Recharts
  const chartData = React.useMemo(() => {
    return professionalsReport
      .filter(p => p.totalRevenue > 0)
      .map(p => ({
        name: p.name.split(' ')[0], // Display short name
        'Produção Bruta (R$)': p.totalRevenue,
        'Comissão Parceiro (R$)': p.totalCommission,
        'Líquido Salão (R$)': p.netEstablishment
      }));
  }, [professionalsReport]);

  const handleSaveCommissionRate = async () => {
    if (!salonData || !adjustingProf) return;

    if (!canEditCommissionRules(userData?.role)) {
      toast.error('Você não tem permissão para alterar a taxa de comissão.');
      return;
    }

    try {
      const ref = doc(db, `salons/${salonData.id}/professionals`, adjustingProf.id);
      await setDoc(ref, {
        commissionRate: newCommissionRate,
        updatedAt: Date.now()
      }, { merge: true });
      toast.success(`Taxa de comissão de ${adjustingProf.name} atualizada para ${newCommissionRate}%!`);
      setAdjustingProf(null);
    } catch (e) {
      console.error(e);
      toast.error('Ocorreu um erro ao atualizar taxa de comissão.');
    }
  };

  const openAdjustModal = (prof: Professional) => {
    setAdjustingProf(prof);
    setNewCommissionRate(getPropCommissionRate(prof));
  };

  // Detailed view of services for selected professional
  const extratoItems = React.useMemo(() => {
    if (!selectedExtratoProf) return [];
    return appointments.filter(app => 
      app.professionalId === selectedExtratoProf.id &&
      app.date.startsWith(selectedMonth)
    ).sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
  }, [selectedExtratoProf, appointments, selectedMonth]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
        <Clock className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm">Carregando relatório de comissões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light tracking-tight text-white flex items-center gap-2">
            <Percent className="w-6 h-6 text-[#D4AF37]" />
            Relatório de Comissões & Repasses
          </h2>
          <p className="text-zinc-500 text-xs">
            Cálculo instantâneo de faturamento líquido, repasses da equipe e lucratividade do salão.
          </p>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <div className="flex flex-1 sm:flex-initial items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 min-w-[130px]">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-xs text-zinc-400 whitespace-nowrap">Período:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="bg-transparent border-0 h-auto p-0 focus:ring-0 text-white font-medium text-xs w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 sm:flex-initial items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 min-w-[150px]">
            <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-xs text-zinc-400 whitespace-nowrap">Profissional:</span>
            <Select value={selectedProfId} onValueChange={setSelectedProfId}>
              <SelectTrigger className="bg-transparent border-0 h-auto p-0 focus:ring-0 text-white font-medium text-xs w-full sm:w-40 font-sans text-left">
                <SelectValue placeholder="Selecione...">
                  {selectedProfId === 'all' 
                    ? 'Todos os Colaboradores' 
                    : (professionals.find(p => p.id === selectedProfId)?.name || appointmentsProfessionals.get(selectedProfId) || selectedProfId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Colaboradores</SelectItem>
                {/* Active professionals */}
                {professionals.filter(p => p.isActive !== false).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
                {/* Inactive professionals in database */}
                {professionals.filter(p => p.isActive === false).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} (Inativo)</SelectItem>
                ))}
                {/* Missing / historical professionals from appointments */}
                {Array.from(appointmentsProfessionals.entries())
                  .filter(([id]) => !professionals.some(p => p.id === id))
                  .map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name} (Histórico)</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border shadow-xs rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-16 h-16 text-primary" />
          </div>
          <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Produção Bruta</span>
          <h3 className="text-2xl font-light text-foreground mt-1.5 font-mono">{formatBRL(stats.totalRevenue)}</h3>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-600" /> {stats.ticketsCount} itens concluídos no mês
          </p>
        </div>

        <div className="bg-card border border-border shadow-xs rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Percent className="w-16 h-16 text-rose-500" />
          </div>
          <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Comissão Total Parceiros</span>
          <h3 className="text-2xl font-light text-rose-600 mt-1.5 font-mono">{formatBRL(stats.totalCommissionToPay)}</h3>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="w-3 h-3 text-rose-600" /> Repasse consolidado para profissionais
          </p>
        </div>

        <div className="bg-card border border-border shadow-xs rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <PiggyBank className="w-16 h-16 text-[#B89B5E]" />
          </div>
          <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Saldo Líquido Estabelecimento</span>
          <h3 className="text-2xl font-light text-[#B89B5E] mt-1.5 font-mono">{formatBRL(stats.totalNetEstablishment)}</h3>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-[#B89B5E]" /> Parcela retida no caixa do salão
          </p>
        </div>

        <div className="bg-card border border-border shadow-xs rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-16 h-16 text-indigo-500" />
          </div>
          <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Ticket Médio</span>
          <h3 className="text-2xl font-light text-foreground mt-1.5 font-mono">{formatBRL(stats.avgTicket)}</h3>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            Faturamento médio por lançamento
          </p>
        </div>
      </div>

      {chartsAndList()}

      {/* Quick Production Launch Modal */}
      <Dialog open={isLaunchModalOpen} onOpenChange={(open) => !open && setIsLaunchModalOpen(false)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading font-light text-foreground text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Lançar Produção Manual
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Registre faturamento ou produção manual diretamente para a meta faturamento de {launchProfessional?.name}.
            </DialogDescription>
          </DialogHeader>

          {launchProfessional && (
            <div className="py-4 space-y-4 font-sans">
              <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-xl border border-border">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">{launchProfessional.name}</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{launchProfessional.role || 'Profissional'}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-medium text-muted-foreground">Referência:</span>
                  <p className="text-[10px] font-bold text-primary">{availableMonths.find(m => m.value === launchMonth)?.label || launchMonth}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="launch_val" className="text-xs text-muted-foreground font-medium">Valor de Produção (R$)</Label>
                  <Input 
                    id="launch_val"
                    placeholder="0,00"
                    value={launchValue}
                    onChange={(e) => setLaunchValue(e.target.value)}
                    className="bg-card border-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium block">Tipo de Registro</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLaunchMode("set")}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex flex-col items-center justify-center gap-1 ${
                        launchMode === "set"
                          ? "bg-primary/10 border-primary text-foreground font-bold"
                          : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="font-bold">Substituir total</span>
                      <span className="text-[9px] text-muted-foreground font-normal">Define como o valor total</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaunchMode("add")}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex flex-col items-center justify-center gap-1 ${
                        launchMode === "add"
                          ? "bg-primary/10 border-primary text-foreground font-bold"
                          : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="font-bold">Somar ao atual</span>
                      <span className="text-[9px] text-muted-foreground font-normal">Acrescenta ao valor existente</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="launch_month" className="text-xs text-muted-foreground font-medium">Mês de Referência</Label>
                  <Select value={launchMonth} onValueChange={setLaunchMonth}>
                    <SelectTrigger className="bg-card border-border h-10 text-foreground text-xs rounded-xl focus:ring-0 focus:border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs">
                      {availableMonths.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsLaunchModalOpen(false)} 
                  className="w-full text-muted-foreground hover:text-foreground border border-border hover:bg-secondary rounded-xl text-xs h-10"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmLaunchProduction} 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs h-10"
                >
                  Confirmar Registro
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Commission Modal */}
      <Dialog open={!!adjustingProf} onOpenChange={(open) => !open && setAdjustingProf(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading font-light text-foreground text-lg flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              Configurar Comissão de Parceiro
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Altere a porcentagem fixa faturada por {adjustingProf?.name} em todos os seus serviços ou produtos.
            </DialogDescription>
          </DialogHeader>

          {adjustingProf && (
            <div className="py-6 space-y-6">
              <div className="flex justify-between items-center bg-secondary/50 p-4 rounded-xl border border-border">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{adjustingProf.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{adjustingProf.role || 'Profissional'}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-medium text-primary">{newCommissionRate}%</span>
                  <p className="text-[10px] text-muted-foreground">taxa ativa</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Margem Profissional</span>
                  <span>Margem Casa (Salão)</span>
                </div>
                <input 
                  type="range"
                  value={newCommissionRate} 
                  min={0} 
                  max={100} 
                  step={5} 
                  onChange={(e) => setNewCommissionRate(Number(e.target.value))} 
                  className="w-full bg-secondary accent-[#B89B5E] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>{newCommissionRate}% repasse</span>
                  <span>{100 - newCommissionRate}% retido</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setAdjustingProf(null)} className="w-full text-muted-foreground hover:text-foreground border border-border hover:bg-secondary rounded-xl">
                  Cancelar
                </Button>
                <Button onClick={handleSaveCommissionRate} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold">
                  Salvar Porcentagem
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extrato Detail Modal */}
      <Dialog open={!!selectedExtratoProf} onOpenChange={(open) => !open && setSelectedExtratoProf(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-light text-foreground text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Extrato Detalhado de Vendas
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Histórico detalhado de produções concluídas por {selectedExtratoProf?.name} em {availableMonths.find(m => m.value === selectedMonth)?.label}.
            </DialogDescription>
          </DialogHeader>

          {selectedExtratoProf && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/40 p-3 rounded-xl border border-border">
                  <span className="text-[10px] text-muted-foreground block uppercase font-bold">Produção Bruta</span>
                  <span className="text-base font-mono font-medium text-foreground block mt-0.5">
                    {formatBRL(professionalsReport.find(p => p.id === selectedExtratoProf.id)?.totalRevenue || 0)}
                  </span>
                </div>
                <div className="bg-secondary/40 p-3 rounded-xl border border-border">
                  <span className="text-[10px] text-muted-foreground block uppercase font-bold">Percentual Taxa</span>
                  <span className="text-base font-mono font-medium text-primary block mt-0.5">
                    {getPropCommissionRate(selectedExtratoProf)}%
                  </span>
                </div>
                <div className="bg-secondary/40 p-3 rounded-xl border border-border">
                  <span className="text-[10px] text-muted-foreground block uppercase font-bold">Repasse Líquido</span>
                  <span className="text-base font-mono font-medium text-rose-600 block mt-0.5">
                    {formatBRL(professionalsReport.find(p => p.id === selectedExtratoProf.id)?.totalCommission || 0)}
                  </span>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-secondary/60 text-muted-foreground border-b border-border font-bold">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Serviço/Produto</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-right">Sua Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {extratoItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs">
                          Nenhuma venda concluída para esse colaborador no período.
                        </td>
                      </tr>
                    ) : (
                      extratoItems.map(item => {
                        const price = getApptPrice(item);
                        const rate = getPropCommissionRate(selectedExtratoProf);
                        const itemComm = price * (rate / 100);

                        return (
                          <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="p-3 whitespace-nowrap text-muted-foreground font-mono">
                              {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-3 font-semibold text-foreground">
                              {item.clientId === 'manual' ? (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full font-sans font-medium uppercase">Manual Avulso</span>
                              ) : (
                                item.clientName
                              )}
                            </td>
                            <td className="p-3">
                              <span className="block font-medium text-foreground">{item.serviceName}</span>
                              {item.isManualLaunch && <span className="text-[9px] uppercase font-bold text-muted-foreground">Lançamento direto</span>}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-foreground">
                              {formatBRL(price)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-primary">
                              {formatBRL(itemComm)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  function chartsAndList() {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Side: Professionals Table List */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-card border border-border shadow-xs rounded-2xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-2 font-heading">Repartição de Faturamento por Profissional</h3>
            <p className="text-xs text-muted-foreground mb-4">Gerencie as comissões e configure as participações percentuais individualmente.</p>

            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-secondary/60 text-muted-foreground border-b border-border font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Colaborador</th>
                    <th className="p-3.5 text-center">Contratos</th>
                    <th className="p-3.5 text-center">Taxa (%)</th>
                    <th className="p-3.5 text-right">Faturamento Bruto</th>
                    <th className="p-3.5 text-right">Repasse Parceiro</th>
                    <th className="p-3.5 text-right">Lucro Salão</th>
                    <th className="p-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {professionalsReport.map((p) => {
                    const rate = getPropCommissionRate(p);
                    return (
                      <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground text-xs">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-mono">{p.role || 'Especialista'}</div>
                          {p.componentSummary && p.componentSummary.targetAmount > 0 && (
                            <div className="mt-2 space-y-1 max-w-[200px]">
                              <div className="text-[9px] text-muted-foreground">
                                Produção: <span className="font-mono text-foreground font-medium">{formatBRL(p.totalRevenue || 0)}</span> / Meta: <span className="font-mono text-muted-foreground">{formatBRL(p.componentSummary.targetAmount)}</span> ({Math.round(p.componentSummary.goalProgress)}%)
                              </div>
                              <div className="w-full bg-secondary border border-border rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-primary h-full rounded-full" 
                                  style={{ width: `${Math.min(p.componentSummary.goalProgress, 100)}%` }} 
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-mono font-medium text-muted-foreground">
                          {p.salesCount}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-bold text-primary text-xs bg-primary/10 px-2 py-0.5 rounded border border-primary/20 inline-block">
                            {rate}%
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-medium text-foreground">
                          <div>{formatBRL(p.totalRevenue)}</div>
                          {p.componentSummary && (
                            <div className="text-[9px] mt-1 inline-block">
                              {p.componentSummary.productionFromAppointments > 0 && p.componentSummary.productionManual > 0 ? (
                                <span className="text-purple-600 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-sans font-medium whitespace-nowrap">🔀 Combinado</span>
                              ) : p.componentSummary.productionManual > 0 ? (
                                <span className="text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-sans font-medium whitespace-nowrap">📋 Manual</span>
                              ) : p.componentSummary.productionFromAppointments > 0 ? (
                                <span className="text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 font-sans font-medium whitespace-nowrap">📅 Agenda</span>
                              ) : (
                                <span className="text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border font-sans font-medium whitespace-nowrap">Sem produção</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-rose-600">
                          {formatBRL(p.totalCommission)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-medium text-emerald-600">
                          {formatBRL(p.netEstablishment)}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {(userData?.role === 'owner' || userData?.role === 'manager' || userData?.role === 'platform_admin') && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openLaunchModal(p)}
                                className="text-muted-foreground hover:text-primary px-2 py-1 h-auto text-[10px] border border-border hover:bg-secondary"
                                title="Lançar faturamento direto à meta"
                              >
                                Lançar
                              </Button>
                            )}
                            {canEditCommissionRules(userData?.role) && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openAdjustModal(p)}
                                className="text-muted-foreground hover:text-primary px-2 py-1 h-auto text-[10px]"
                                title="Configurar margem"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedExtratoProf(p)}
                              className="text-muted-foreground hover:text-foreground px-2 py-1 h-auto text-[10px] border border-border hover:bg-secondary"
                            >
                              Extrato
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Analytical Charts of Margins */}
        <div className="space-y-4">
          <div className="bg-card border border-border shadow-xs rounded-2xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-1 font-heading">Gráfico de Repasse</h3>
            <p className="text-[10px] text-muted-foreground mb-6">Comparação gráfica de produção bruta vs saldo retido para o salão.</p>

            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 border border-border rounded-xl bg-secondary/30 text-muted-foreground text-xs">
                Nenhum dado financeiro para o mês selecionado.
              </div>
            ) : (
              <div className="h-64 select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid stroke="#e5e2dc" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#78716c" fontSize={10} />
                    <YAxis stroke="#78716c" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e2dc', borderRadius: '12px', fontSize: '11px', color: '#171717', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Bar dataKey="Produção Bruta (R$)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Comissão Parceiro (R$)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Líquido Salão (R$)" fill="#B89B5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-card border border-border shadow-xs rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase text-primary tracking-wider">Metodologia Lumière</h4>
            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                As taxas de comissão são <b>soberanas</b> aos lançamentos. Atualizar a taxa de comissão de um profissional irá atualizar instantaneamente todo o extrato deste mês e meses anteriores para refletir os novos repasses acordados.
              </p>
              <p>
                Lançamentos cadastrados via <b>Lançamento Direto (Avulso)</b> são computados imediatamente como concluídos para fins de produtividade e faturamento sem depender de confirmação manual em agenda.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

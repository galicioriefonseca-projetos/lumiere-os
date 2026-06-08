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

export default function CommissionsPage() {
  const { salonData, userData } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
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

  // Calculated Stats
  const stats = React.useMemo(() => {
    let totalRevenue = 0;
    let totalCommissionToPay = 0;

    filteredAppointments.forEach(app => {
      const price = getApptPrice(app);
      const prof = professionals.find(p => p.id === app.professionalId);
      const rate = prof ? getPropCommissionRate(prof) : 50;

      totalRevenue += price;
      totalCommissionToPay += price * (rate / 100);
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
  }, [filteredAppointments, professionals, services]);

  // Breakdown by individual professional for current month
  const professionalsReport = React.useMemo(() => {
    // Determine the list of professionals to evaluate:
    // 1. Any professional that is actively registered in professionals collection (isActive !== false)
    // 2. Any deactivated or other professional from professionals collection if they have sales in selectedMonth
    // 3. Any professional found in appointments of the selectedMonth who is missing from professionals collection
    const list: (Professional & { salesCount?: number; totalRevenue?: number; totalCommission?: number; netEstablishment?: number })[] = [];

    // Add people from database first
    professionals.forEach(p => {
      const isActive = p.isActive !== false;
      const hasSalesInMonth = appointments.some(app => app.professionalId === p.id && app.date.startsWith(selectedMonth));
      
      if (isActive || hasSalesInMonth) {
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

    return list.map(prof => {
      const profAppts = appointments.filter(app => 
        app.professionalId === prof.id && 
        app.date.startsWith(selectedMonth)
      );

      let totalRevenue = 0;
      let totalCommission = 0;

      profAppts.forEach(app => {
        const price = getApptPrice(app);
        const rate = getPropCommissionRate(prof);
        totalRevenue += price;
        totalCommission += price * (rate / 100);
      });

      return {
        ...prof,
        totalRevenue,
        totalCommission,
        netEstablishment: totalRevenue - totalCommission,
        salesCount: profAppts.length
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [professionals, appointments, selectedMonth, services]);

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
        <div className="bg-[#0cf]/5 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-16 h-16 text-cyan-400" />
          </div>
          <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Produção Bruta</span>
          <h3 className="text-2xl font-light text-white mt-1.5 font-mono">{formatBRL(stats.totalRevenue)}</h3>
          <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-cyan-400" /> {stats.ticketsCount} itens concluídos no mês
          </p>
        </div>

        <div className="bg-[#e24]/5 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Percent className="w-16 h-16 text-rose-500" />
          </div>
          <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Comissão Total Parceiros</span>
          <h3 className="text-2xl font-light text-rose-400 mt-1.5 font-mono">{formatBRL(stats.totalCommissionToPay)}</h3>
          <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3 text-rose-400" /> Repasse consolidado para profissionais
          </p>
        </div>

        <div className="bg-[#d4af37]/5 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <PiggyBank className="w-16 h-16 text-[#D4AF37]" />
          </div>
          <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Saldo Líquido Estabelecimento</span>
          <h3 className="text-2xl font-light text-[#D4AF37] mt-1.5 font-mono">{formatBRL(stats.totalNetEstablishment)}</h3>
          <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-[#D4AF37]" /> Parcela retida no caixa do salão
          </p>
        </div>

        <div className="bg-[#b5f]/5 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-16 h-16 text-purple-400" />
          </div>
          <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Ticket Médio</span>
          <h3 className="text-2xl font-light text-purple-400 mt-1.5 font-mono">{formatBRL(stats.avgTicket)}</h3>
          <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
            Faturamento médio por lançamento
          </p>
        </div>
      </div>

      {chartsAndList()}

      {/* Adjust Commission Modal */}
      <Dialog open={!!adjustingProf} onOpenChange={(open) => !open && setAdjustingProf(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading font-light text-white text-lg flex items-center gap-2">
              <Percent className="w-5 h-5 text-[#D4AF37]" />
              Configurar Comissão de Parceiro
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Altere a porcentagem fixa faturada por {adjustingProf?.name} em todos os seus serviços ou produtos.
            </DialogDescription>
          </DialogHeader>

          {adjustingProf && (
            <div className="py-6 space-y-6">
              <div className="flex justify-between items-center bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
                <div>
                  <h4 className="text-sm font-semibold">{adjustingProf.name}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">{adjustingProf.role || 'Profissional'}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-medium text-[#D4AF37]">{newCommissionRate}%</span>
                  <p className="text-[10px] text-zinc-500">taxa ativa</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs text-zinc-400">
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
                  className="w-full bg-zinc-800 accent-[#D4AF37] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs font-mono text-zinc-500">
                  <span>{newCommissionRate}% repasse</span>
                  <span>{100 - newCommissionRate}% retido</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setAdjustingProf(null)} className="w-full text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-900 rounded-xl">
                  Cancelar
                </Button>
                <Button onClick={handleSaveCommissionRate} className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black rounded-xl font-bold">
                  Salvar Porcentagem
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extrato Detail Modal */}
      <Dialog open={!!selectedExtratoProf} onOpenChange={(open) => !open && setSelectedExtratoProf(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-light text-white text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Extrato Detalhado de Vendas
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Histórico detalhado de produções concluídas por {selectedExtratoProf?.name} em {availableMonths.find(m => m.value === selectedMonth)?.label}.
            </DialogDescription>
          </DialogHeader>

          {selectedExtratoProf && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">Produção Bruta</span>
                  <span className="text-base font-mono font-medium text-white block mt-0.5">
                    {formatBRL(professionalsReport.find(p => p.id === selectedExtratoProf.id)?.totalRevenue || 0)}
                  </span>
                </div>
                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">Percentual Taxa</span>
                  <span className="text-base font-mono font-medium text-[#D4AF37] block mt-0.5">
                    {getPropCommissionRate(selectedExtratoProf)}%
                  </span>
                </div>
                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">Repasse Líquido</span>
                  <span className="text-base font-mono font-medium text-rose-400 block mt-0.5">
                    {formatBRL(professionalsReport.find(p => p.id === selectedExtratoProf.id)?.totalCommission || 0)}
                  </span>
                </div>
              </div>

              <div className="border border-zinc-900 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 font-bold">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Serviço/Produto</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-right">Sua Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-zinc-300">
                    {extratoItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500 text-xs">
                          Nenhuma venda concluída para esse colaborador no período.
                        </td>
                      </tr>
                    ) : (
                      extratoItems.map(item => {
                        const price = getApptPrice(item);
                        const rate = getPropCommissionRate(selectedExtratoProf);
                        const itemComm = price * (rate / 100);

                        return (
                          <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="p-3 whitespace-nowrap text-zinc-500 font-mono">
                              {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-3 font-semibold text-white">
                              {item.clientId === 'manual' ? (
                                <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/10 px-2 py-0.5 rounded-full font-sans font-medium uppercase">Manual Avulso</span>
                              ) : (
                                item.clientName
                              )}
                            </td>
                            <td className="p-3">
                              <span className="block font-medium text-zinc-200">{item.serviceName}</span>
                              {item.isManualLaunch && <span className="text-[9px] uppercase font-bold text-zinc-500">Lançamento direto</span>}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-white">
                              {formatBRL(price)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-[#D4AF37]">
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
          <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5">
            <h3 className="text-base font-semibold text-white mb-2 font-heading">Repartição de Faturamento por Profissional</h3>
            <p className="text-xs text-zinc-500 mb-4">Gerencie as comissões e configure as participações percentuais individualmente.</p>

            <div className="border border-zinc-900 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-zinc-900 text-zinc-500 border-b border-zinc-800 font-bold uppercase tracking-wider text-[10px]">
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
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {professionalsReport.map((p) => {
                    const rate = getPropCommissionRate(p);
                    return (
                      <tr key={p.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-semibold text-white text-xs">{p.name}</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider font-mono">{p.role || 'Especialista'}</div>
                        </td>
                        <td className="p-3.5 text-center font-mono font-medium text-zinc-400">
                          {p.salesCount}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-bold text-[#D4AF37] text-xs bg-[#D4AF37]/5 px-2 py-0.5 rounded border border-[#D4AF37]/10 inline-block">
                            {rate}%
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-medium text-white">
                          {formatBRL(p.totalRevenue)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-rose-400">
                          {formatBRL(p.totalCommission)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-medium text-cyan-400">
                          {formatBRL(p.netEstablishment)}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {canEditCommissionRules(userData?.role) && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openAdjustModal(p)}
                                className="text-zinc-400 hover:text-[#D4AF37] px-2 py-1 h-auto text-[10px]"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedExtratoProf(p)}
                              className="text-zinc-400 hover:text-white px-2 py-1 h-auto text-[10px] border border-zinc-900 hover:border-zinc-800"
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
          <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5">
            <h3 className="text-base font-semibold text-white mb-1 font-heading">Gráfico de Repasse</h3>
            <p className="text-[10px] text-zinc-500 mb-6">Comparação gráfica de produção bruta vs saldo retido para o salão.</p>

            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 border border-zinc-900 rounded-xl bg-zinc-900/20 text-zinc-500 text-xs">
                Nenhum dado financeiro para o mês selecionado.
              </div>
            ) : (
              <div className="h-64 select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid stroke="#111" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#555" fontSize={10} />
                    <YAxis stroke="#555" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                    <Bar dataKey="Produção Bruta (R$)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Comissão Parceiro (R$)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Líquido Salão (R$)" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase text-[#D4AF37] tracking-wider">Metodologia Essenza</h4>
            <div className="space-y-3 text-xs leading-relaxed text-zinc-400">
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

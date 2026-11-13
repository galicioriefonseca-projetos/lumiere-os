import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  Users, 
  Calendar, 
  BarChart, 
  ChevronRight,
  TrendingDown,
  Award,
  Sparkles,
  PieChart as PieChartIcon,
  Activity,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import MonthRangePicker, { MonthRange, formatMonthYearLabel, formatMonthFullLabel } from '@/components/ui/MonthRangePicker';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface Appointment {
  id: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  status: 'scheduled' | 'completed' | 'canceled' | 'no_show';
  price?: number;
}

interface Professional {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

const GOLD_PALETTE = ['#D4AF37', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

export default function ReportsPage() {
  const { salonData, userData } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Intervalo de Meses Selecionado
  const [monthRange, setMonthRange] = useState<MonthRange>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const curr = `${y}-${m}`;
    return {
      startMonth: curr,
      endMonth: curr,
      preset: 'current'
    };
  });

  useEffect(() => {
    if (!salonData) return;

    setLoading(true);
    const unsubs: (() => void)[] = [];

    // Load Appointments
    const qa = query(collection(db, `salons/${salonData.id}/appointments`));
    unsubs.push(onSnapshot(qa, (snap) => {
      const arr: Appointment[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Appointment));
      setAppointments(arr);
    }));

    // Load Professionals
    const qp = query(collection(db, `salons/${salonData.id}/professionals`));
    unsubs.push(onSnapshot(qp, (snap) => {
      const arr: Professional[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Professional));
      
      const filteredPros = arr.filter(p => p.isActive !== false && (p.role === 'professional' || p.role === 'manager'));
      setProfessionals(filteredPros);
    }));

    // Load Services
    const qs = query(collection(db, `salons/${salonData.id}/services`));
    unsubs.push(onSnapshot(qs, (snap) => {
      const arr: Service[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() } as Service));
      setServices(arr);
    }));

    setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => unsubs.forEach(u => u());
  }, [salonData]);

  // Lista de meses que possuem agendamentos registrados
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach(app => {
      if (app.date) {
        set.add(app.date.slice(0, 7));
      }
    });
    return Array.from(set).sort();
  }, [appointments]);

  // Filtragem precisa com base no MonthRange
  const filteredAppointments = useMemo(() => {
    const { startMonth, endMonth } = monthRange;
    return appointments.filter(app => {
      if (app.status !== 'completed') return false;
      if (!app.date) return false;
      const appMonth = app.date.slice(0, 7);

      if (startMonth && appMonth < startMonth) return false;
      if (endMonth && appMonth > endMonth) return false;
      return true;
    });
  }, [appointments, monthRange]);

  // Cálculo de KPIs
  const totalRevenue = useMemo(() => {
    return filteredAppointments.reduce((acc, app) => {
      if (app.price) return acc + app.price;
      const service = services.find(s => s.id === app.serviceId);
      return acc + (service ? service.price : 0);
    }, 0);
  }, [filteredAppointments, services]);

  const totalAppointments = filteredAppointments.length;
  const averageTicket = totalAppointments > 0 ? totalRevenue / totalAppointments : 0;

  const getProfessionalStats = (profId: string) => {
    const profAppts = filteredAppointments.filter(app => app.professionalId === profId);
    const profRev = profAppts.reduce((acc, app) => {
      if (app.price) return acc + app.price;
      const service = services.find(s => s.id === app.serviceId);
      return acc + (service ? service.price : 0);
    }, 0);
    const profCount = profAppts.length;
    return {
      revenue: profRev,
      count: profCount,
      avgTicket: profCount > 0 ? profRev / profCount : 0
    };
  };

  // Find top performer
  const topProf = useMemo(() => {
    let best = null;
    let topRev = -1;
    professionals.forEach(p => {
      const s = getProfessionalStats(p.id);
      if (s.revenue > topRev) {
        topRev = s.revenue;
        best = { ...p, revenue: s.revenue, count: s.count };
      }
    });
    return best;
  }, [professionals, filteredAppointments]);

  // Dados para Gráfico de Evolução (Agrupado por mês ou dia dependendo do range)
  const evolutionChartData = useMemo(() => {
    const isSingleMonth = monthRange.startMonth === monthRange.endMonth;

    if (isSingleMonth && monthRange.startMonth) {
      // Agrupar por dia do mês
      const daysMap: Record<string, { faturamento: number; atendimentos: number }> = {};
      filteredAppointments.forEach(app => {
        const day = app.date.slice(8, 10); // "01", "15"
        const price = app.price || services.find(s => s.id === app.serviceId)?.price || 0;
        if (!daysMap[day]) daysMap[day] = { faturamento: 0, atendimentos: 0 };
        daysMap[day].faturamento += price;
        daysMap[day].atendimentos += 1;
      });

      return Object.keys(daysMap).sort().map(day => ({
        label: `Dia ${day}`,
        faturamento: Math.round(daysMap[day].faturamento),
        atendimentos: daysMap[day].atendimentos
      }));
    }

    // Múltiplos meses: Agrupar por Mês
    const monthsMap: Record<string, { faturamento: number; atendimentos: number }> = {};
    filteredAppointments.forEach(app => {
      const ym = app.date.slice(0, 7);
      const price = app.price || services.find(s => s.id === app.serviceId)?.price || 0;
      if (!monthsMap[ym]) monthsMap[ym] = { faturamento: 0, atendimentos: 0 };
      monthsMap[ym].faturamento += price;
      monthsMap[ym].atendimentos += 1;
    });

    return Object.keys(monthsMap).sort().map(ym => ({
      label: formatMonthYearLabel(ym),
      faturamento: Math.round(monthsMap[ym].faturamento),
      atendimentos: monthsMap[ym].atendimentos
    }));
  }, [filteredAppointments, monthRange, services]);

  // Dados para Gráfico de Colaboradores
  const professionalChartData = useMemo(() => {
    return professionals
      .map(p => {
        const stats = getProfessionalStats(p.id);
        return {
          name: p.name.split(' ')[0] || p.name,
          fullName: p.name,
          faturamento: stats.revenue,
          atendimentos: stats.count
        };
      })
      .filter(item => item.faturamento > 0 || item.atendimentos > 0)
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 6);
  }, [professionals, filteredAppointments]);

  // Exportar PDF Consolidado
  const handleExportPDF = () => {
    const docPdf = new jsPDF();
    const periodLabel = monthRange.startMonth === monthRange.endMonth
      ? formatMonthFullLabel(monthRange.startMonth || '')
      : `${formatMonthYearLabel(monthRange.startMonth || '')} a ${formatMonthYearLabel(monthRange.endMonth || '')}`;

    const title = `Relatório Consolidado Lumière — ${periodLabel}`;
    
    docPdf.setFontSize(16);
    docPdf.text(title, 14, 15);
    
    docPdf.setFontSize(10);
    docPdf.text(`Faturamento Total: ${formatBRL(totalRevenue)}`, 14, 25);
    docPdf.text(`Ticket Médio: ${formatBRL(averageTicket)}`, 14, 30);
    docPdf.text(`Total de Atendimentos: ${totalAppointments}`, 14, 35);
    
    const tableData = professionals.map(p => {
      const stats = getProfessionalStats(p.id);
      return [
        p.name,
        stats.count.toString(),
        formatBRL(stats.revenue),
        formatBRL(stats.avgTicket)
      ];
    });

    autoTable(docPdf, {
      startY: 45,
      head: [['Profissional', 'Atendimentos', 'Faturamento', 'Ticket Médio']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
      styles: { fontSize: 9 }
    });

    docPdf.save(`relatorio_lumiere_${monthRange.startMonth || 'geral'}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  const periodDisplay = monthRange.startMonth === monthRange.endMonth
    ? formatMonthFullLabel(monthRange.startMonth || '')
    : `${formatMonthYearLabel(monthRange.startMonth || '')} a ${formatMonthYearLabel(monthRange.endMonth || '')}`;

  return (
    <div className="space-y-6">
      {/* Header with Title and Date Range Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-white">Relatórios & Métricas Executivas</h2>
          <p className="text-sm font-light text-muted-foreground mt-1">
            Visualização consolidada de desempenho financeiro, atendimentos e colaboradores.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          {/* SELETOR DE INTERVALO DE DATAS (DATERANGEPICKER COM CALENDÁRIO) */}
          <MonthRangePicker
            value={monthRange}
            onChange={setMonthRange}
            availableMonths={availableMonths}
            theme="gold"
          />
          
          <Button 
            onClick={handleExportPDF}
            className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold rounded-xl whitespace-nowrap h-9 gap-1.5"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#121217] border-white/5 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Faturamento Efetivo</p>
                <h3 className="text-2xl font-bold text-white font-mono">{formatBRL(totalRevenue)}</h3>
                <span className="text-[10px] text-zinc-500 block truncate">{periodDisplay}</span>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#121217] border-white/5 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Ticket Médio</p>
                <h3 className="text-2xl font-bold text-white font-mono">{formatBRL(averageTicket)}</h3>
                <span className="text-[10px] text-zinc-500 block">Por atendimento concluído</span>
              </div>
              <div className="p-2.5 bg-[#D4AF37]/10 rounded-xl">
                <BarChart className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#121217] border-white/5 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Atendimentos</p>
                <h3 className="text-2xl font-bold text-white font-mono">{totalAppointments}</h3>
                <span className="text-[10px] text-zinc-500 block">Produções concluídas</span>
              </div>
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#121217] border-white/5 rounded-2xl border-l-[3px] border-l-[#D4AF37]">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Destaque do Período</p>
                <h3 className="text-sm font-bold text-[#D4AF37] leading-tight mt-1">{topProf ? topProf.name : 'N/A'}</h3>
                {topProf && (
                  <p className="text-xs text-zinc-500 font-mono">
                    {formatBRL(topProf.revenue)} • {topProf.count} atendimentos
                  </p>
                )}
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-xl shrink-0">
                <Award className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Interativo de Evolução Sincronizado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Principal de Evolução */}
        <Card className="lg:col-span-2 bg-[#121217] border-white/5 rounded-2xl">
          <CardHeader className="pb-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#D4AF37]" />
                  Evolução de Faturamento no Período Selecionado
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Sincronizado em tempo real com o seletor de calendário ({periodDisplay})
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {evolutionChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs">
                <Calendar className="w-8 h-8 text-zinc-600 mb-2" />
                Nenhum faturamento registrado no período selecionado.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorFat" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke="#71717a" 
                      fontSize={11} 
                      tickLine={false}
                      tickFormatter={(val) => `R$${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#3f3f46',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#fff'
                      }}
                      formatter={(value: any, name: any) => [
                        name === 'faturamento' ? formatBRL(Number(value)) : `${value} atendimentos`,
                        name === 'faturamento' ? 'Faturamento' : 'Atendimentos'
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="faturamento" 
                      stroke="#D4AF37" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#colorFat)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Colaboradores */}
        <Card className="bg-[#121217] border-white/5 rounded-2xl">
          <CardHeader className="pb-3 border-b border-white/5">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart className="w-4 h-4 text-[#D4AF37]" />
              Faturamento por Colaborador
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Top participantes no período
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {professionalChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs">
                Nenhum dado de colaboradores no período.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={professionalChartData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                    <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={11} width={65} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#3f3f46',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}
                      formatter={(val: any) => [formatBRL(Number(val)), 'Faturamento']}
                    />
                    <Bar dataKey="faturamento" fill="#D4AF37" radius={[0, 6, 6, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pro Details List */}
      <div>
        <h3 className="text-sm font-semibold tracking-wider uppercase text-white mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#D4AF37]" /> Detalhamento por Profissional ({periodDisplay})
        </h3>
        
        <div className="grid gap-3">
          {professionals.length === 0 ? (
            <div className="text-center py-10 bg-[#121217] rounded-2xl border border-white/5">
              <p className="text-sm text-zinc-400">Nenhum profissional computado neste período.</p>
            </div>
          ) : (
            professionals.map(p => {
              const stats = getProfessionalStats(p.id);
              return (
                <div key={p.id} className="bg-[#15151b] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-[#1a1a24] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase shrink-0 text-sm">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{p.name}</h4>
                      <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{stats.count} atendimentos concluídos</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-6 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-initial">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Ticket Médio</p>
                      <p className="font-mono text-sm font-medium text-zinc-300">{formatBRL(stats.avgTicket)}</p>
                    </div>
                    <div className="flex-1 sm:flex-initial">
                      <p className="text-[10px] text-[#D4AF37] uppercase tracking-widest mb-1">Faturamento Geral</p>
                      <p className="font-mono text-sm font-bold text-white">{formatBRL(stats.revenue)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

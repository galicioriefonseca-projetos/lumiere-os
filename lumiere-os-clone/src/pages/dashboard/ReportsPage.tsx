import React, { useState, useEffect } from 'react';
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
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

export default function ReportsPage() {
  const { salonData, userData } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
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

    // Delay loading state out a bit giving connections time
    setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => unsubs.forEach(u => u());
  }, [salonData]);

  const filteredAppointments = appointments.filter(app => 
    app.date.startsWith(selectedMonth) && app.status === 'completed'
  );

  const totalRevenue = filteredAppointments.reduce((acc, app) => {
    if (app.price) return acc + app.price;
    const service = services.find(s => s.id === app.serviceId);
    return acc + (service ? service.price : 0);
  }, 0);

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

  const handleExportPDF = () => {
    const docPdf = new jsPDF();
    const title = `Relatório Consolidado Lumière - ${selectedMonth}`;
    
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

    docPdf.save(`relatorio_${selectedMonth}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  // Find top performer
  let topProf = null;
  let topRev = -1;
  professionals.forEach(p => {
    const s = getProfessionalStats(p.id);
    if (s.revenue > topRev) {
      topRev = s.revenue;
      topProf = p;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-white">Relatórios Avançados</h2>
          <p className="text-sm font-light text-muted-foreground mt-1">
            Módulo <span className="text-[10px] bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] px-1.5 py-0.5 rounded ml-1 font-mono uppercase font-bold tracking-wider">FOUNDER</span> Consolidado Mensal
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[180px] bg-[#121217] border-white/5 text-white">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...Array(12)].map((_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const val = `${y}-${m}`;
                const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return (
                  <SelectItem key={val} value={val} className="capitalize">
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleExportPDF}
            className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold rounded-xl whitespace-nowrap"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF
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
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Destaque do Mês</p>
                <h3 className="text-sm font-bold text-[#D4AF37] leading-tight mt-1">{topProf ? topProf.name : 'N/A'}</h3>
                {topProf && <p className="text-xs text-zinc-500">{formatBRL(topRev)}</p>}
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-xl shrink-0">
                <Award className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pro Details List */}
      <div>
        <h3 className="text-sm font-semibold tracking-wider uppercase text-white mb-4 flex items-center gap-2">
          <BarChart className="w-4 h-4 text-[#D4AF37]" /> Faturamento Acumulado por Colaborador
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

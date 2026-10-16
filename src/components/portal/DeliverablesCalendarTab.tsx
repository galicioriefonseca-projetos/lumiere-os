import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Filter, 
  Instagram, 
  MapPin, 
  Globe, 
  Briefcase,
  AlertCircle,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { ClientDeliverable } from '@/types';

interface DeliverablesCalendarTabProps {
  deliverables: ClientDeliverable[];
  agencyName: string;
}

export default function DeliverablesCalendarTab({
  deliverables = [],
  agencyName
}: DeliverablesCalendarTabProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'instagram':
        return (
          <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 gap-1 text-[11px]">
            <Instagram className="w-3 h-3" /> Instagram
          </Badge>
        );
      case 'google_meu_negocio':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 gap-1 text-[11px]">
            <MapPin className="w-3 h-3" /> Google Meu Negócio
          </Badge>
        );
      case 'site_landing_page':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 text-[11px]">
            <Globe className="w-3 h-3" /> Site & Landing Page
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/30 gap-1 text-[11px]">
            <Briefcase className="w-3 h-3" /> Operacional
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Entregue / Concluído
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 gap-1 text-[11px]">
            <Clock className="w-3 h-3" /> Em Produção
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/30 gap-1 text-[11px]">
            <CalendarIcon className="w-3 h-3" /> Programado
          </Badge>
        );
    }
  };

  const filteredDeliverables = deliverables.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  const completedCount = deliverables.filter(d => d.status === 'completed').length;
  const inProgressCount = deliverables.filter(d => d.status === 'in_progress').length;
  const pendingCount = deliverables.filter(d => d.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0A261E] border border-[#17473A] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Cronograma Operacional & Entregas
          </div>
          <h3 className="text-xl font-bold text-white">Próximas Entregas da Agência</h3>
          <p className="text-xs text-[#8FAEA2] max-w-xl leading-relaxed">
            Acompanhe as datas previstas para publicações de Instagram, ações no Google Meu Negócio e otimizações de Landing Page executadas pela equipe da <strong className="text-white">{agencyName}</strong>.
          </p>
        </div>

        {/* Quick Counters */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
            <span className="text-[10px] text-[#8FAEA2] block">Entregues</span>
            <span className="text-base font-bold text-emerald-400">{completedCount}</span>
          </div>
          <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
            <span className="text-[10px] text-[#8FAEA2] block">Em Produção</span>
            <span className="text-base font-bold text-blue-400">{inProgressCount}</span>
          </div>
          <div className="px-3 py-2 bg-zinc-500/10 border border-zinc-500/20 rounded-xl text-center">
            <span className="text-[10px] text-[#8FAEA2] block">Programados</span>
            <span className="text-base font-bold text-zinc-300">{pendingCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#082019] p-3 rounded-xl border border-white/5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#8FAEA2] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Canal:
          </span>
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterCategory === 'all' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Todos ({deliverables.length})
          </button>
          <button
            onClick={() => setFilterCategory('google_meu_negocio')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterCategory === 'google_meu_negocio' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Google Meu Negócio
          </button>
          <button
            onClick={() => setFilterCategory('site_landing_page')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterCategory === 'site_landing_page' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Site & Landing Page
          </button>
          <button
            onClick={() => setFilterCategory('instagram')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterCategory === 'instagram' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Instagram
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8FAEA2]">Status:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg text-white px-2.5 py-1 text-xs"
          >
            <option value="all">Todos</option>
            <option value="pending">Programado</option>
            <option value="in_progress">Em Produção</option>
            <option value="completed">Concluído</option>
          </select>
        </div>
      </div>

      {/* Deliverables Timeline List */}
      {filteredDeliverables.length === 0 ? (
        <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Nenhum entregável encontrado</h4>
            <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
              Os próximos marcos operacionais e entregas planejadas pela agência serão exibidos neste calendário.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDeliverables.map(deliv => (
            <div
              key={deliv.id}
              className="bg-[#0A261E] border border-[#17473A] hover:border-[#DFC498]/40 p-4 rounded-2xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-3 rounded-xl shrink-0 ${
                  deliv.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : deliv.status === 'in_progress'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-white/5 text-[#8FAEA2] border border-white/10'
                }`}>
                  <CalendarIcon className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {getCategoryBadge(deliv.category)}
                    {getStatusBadge(deliv.status)}
                    <span className="text-[11px] font-mono text-[#DFC498] flex items-center gap-1 ml-1">
                      <Clock className="w-3 h-3" /> Previsão: {new Date(deliv.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white">
                    {deliv.title}
                  </h4>

                  {deliv.notes && (
                    <p className="text-xs text-[#8FAEA2] leading-relaxed max-w-2xl">
                      {deliv.notes}
                    </p>
                  )}
                </div>
              </div>

              {deliv.deliverableUrl && (
                <div className="shrink-0 pt-2 md:pt-0">
                  <Button
                    onClick={() => window.open(deliv.deliverableUrl, '_blank')}
                    size="sm"
                    className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs h-9 rounded-xl gap-1.5 shadow"
                  >
                    Acessar Entrega <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

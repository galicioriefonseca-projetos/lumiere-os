import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  CheckCircle2, 
  FileText, 
  Briefcase, 
  MessageSquare, 
  Calendar, 
  Sparkles, 
  Clock, 
  ThumbsUp, 
  ShieldCheck,
  Zap
} from 'lucide-react';
import { ClientReport, ClientContract, ClientApproval, ClientTicket, ClientDeliverable } from '@/types';

interface AccountTimelineTabProps {
  reports: ClientReport[];
  contracts: ClientContract[];
  approvals: ClientApproval[];
  tickets: ClientTicket[];
  deliverables: ClientDeliverable[];
  agencyName: string;
}

interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'contract' | 'report' | 'approval' | 'ticket' | 'deliverable';
  title: string;
  description: string;
  statusBadge?: string;
  icon: any;
}

export default function AccountTimelineTab({
  reports = [],
  contracts = [],
  approvals = [],
  tickets = [],
  deliverables = [],
  agencyName
}: AccountTimelineTabProps) {
  const events: TimelineEvent[] = [];

  // Contracts
  contracts.forEach(c => {
    events.push({
      id: `c_${c.id}`,
      timestamp: c.createdAt || Date.now(),
      type: 'contract',
      title: `Contrato Homologado: ${c.title}`,
      description: `Vigência iniciada em ${c.startDate}. Valor acordado: R$ ${c.monthlyValue.toLocaleString('pt-BR')}/mês.`,
      statusBadge: 'Contrato Ativo',
      icon: Briefcase
    });
  });

  // Reports
  reports.forEach(r => {
    events.push({
      id: `r_${r.id}`,
      timestamp: r.publishedAt || r.createdAt || Date.now(),
      type: 'report',
      title: `Relatório Publicado: ${r.title}`,
      description: `Período ${r.period}. Métricas consolidadas: ${r.metrics?.leads || 0} leads gerados, ${r.metrics?.conversions || 0} conversões e ROAS de ${r.metrics?.roas || 0}x.`,
      statusBadge: 'Performance',
      icon: FileText
    });
  });

  // Approvals
  approvals.forEach(a => {
    if (a.status === 'approved') {
      events.push({
        id: `a_appr_${a.id}`,
        timestamp: a.approvedAt || a.updatedAt || a.createdAt || Date.now(),
        type: 'approval',
        title: `Conteúdo Aprovado: ${a.title}`,
        description: a.clientFeedback ? `Aprovado pelo cliente com a nota: "${a.clientFeedback}"` : `Conteúdo aprovado para veiculação no canal oficial.`,
        statusBadge: 'Aprovado',
        icon: ThumbsUp
      });
    } else if (a.status === 'revisions_requested') {
      events.push({
        id: `a_rev_${a.id}`,
        timestamp: a.feedbackAt || a.updatedAt || a.createdAt || Date.now(),
        type: 'approval',
        title: `Ajuste Solicitado: ${a.title}`,
        description: `Observação do cliente: "${a.clientFeedback || 'Ajustes solicitados.'}"`,
        statusBadge: 'Em Revisão',
        icon: Clock
      });
    } else {
      events.push({
        id: `a_new_${a.id}`,
        timestamp: a.createdAt || Date.now(),
        type: 'approval',
        title: `Nova Peça para Aprovação: ${a.title}`,
        description: `Enviada pela equipe da agência para validação do cliente.`,
        statusBadge: 'Aguardando',
        icon: Clock
      });
    }
  });

  // Deliverables
  deliverables.forEach(d => {
    if (d.status === 'completed') {
      events.push({
        id: `d_comp_${d.id}`,
        timestamp: d.completedAt || d.createdAt || Date.now(),
        type: 'deliverable',
        title: `Entrega Concluída: ${d.title}`,
        description: d.notes ? `Observações da entrega: ${d.notes}` : `Entrega operacional concluída e validada.`,
        statusBadge: 'Concluído',
        icon: CheckCircle2
      });
    }
  });

  // Tickets
  tickets.forEach(t => {
    events.push({
      id: `t_${t.id}`,
      timestamp: t.createdAt || Date.now(),
      type: 'ticket',
      title: `Solicitação Registrada: ${t.subject}`,
      description: `Chamado aberto no canal de ${t.category}. Status atual: ${t.status === 'resolved' ? 'Resolvido' : t.status === 'in_progress' ? 'Em atendimento' : 'Aberto'}.`,
      statusBadge: t.status === 'resolved' ? 'Solucionado' : 'Chamado',
      icon: MessageSquare
    });
  });

  // Sort descending by timestamp
  events.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0A261E] border border-[#17473A] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Transparência & Rastreabilidade de Operação
          </div>
          <h3 className="text-xl font-bold text-white">Linha do Tempo da Conta (Timeline)</h3>
          <p className="text-xs text-[#8FAEA2] max-w-xl leading-relaxed">
            Consulte o histórico auditável de tudo o que foi realizado na sua conta com a agência <strong className="text-white">{agencyName}</strong>: relatórios publicados, aprovações, entregas e chamados.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-xs text-[#8FAEA2] shrink-0 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Histórico Criptografado
        </div>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
              <History className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Nenhum evento registrado ainda</h4>
            <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
              Assim que relatórios, aprovações e entregas forem realizados, a linha do tempo será preenchida automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative border-l border-[#17473A]/80 ml-4 md:ml-6 pl-6 space-y-6">
          {events.map((evt) => {
            const Icon = evt.icon;
            return (
              <div key={evt.id} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-[35px] top-1.5 w-6 h-6 rounded-full bg-[#0A261E] border-2 border-[#DFC498] flex items-center justify-center text-[#DFC498] shadow-md">
                  <Icon className="w-3 h-3" />
                </div>

                <div className="bg-[#0A261E] border border-[#17473A] hover:border-[#DFC498]/40 p-4 rounded-2xl transition-all shadow-sm space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-[#8FAEA2] font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(evt.timestamp).toLocaleDateString('pt-BR')} às {new Date(evt.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {evt.statusBadge && (
                      <Badge className="bg-white/5 text-[#DFC498] border-white/10 text-[10px]">
                        {evt.statusBadge}
                      </Badge>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-white">
                    {evt.title}
                  </h4>

                  <p className="text-xs text-[#8FAEA2] leading-relaxed">
                    {evt.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

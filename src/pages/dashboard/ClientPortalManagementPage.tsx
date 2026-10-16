import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Building2, 
  FileText, 
  Briefcase, 
  Link2, 
  Copy, 
  Check, 
  Phone, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Sparkles, 
  Eye, 
  Loader2, 
  Send, 
  Share2,
  CheckCircle2,
  Clock,
  HelpCircle,
  FileSpreadsheet,
  RotateCcw,
  MapPin,
  Globe,
  Instagram,
  Zap,
  MessageCircle,
  MessageSquare
} from 'lucide-react';
import { ClientReport, ClientContract, ClientPortalInvite, ClientApproval, ClientTicket, ClientDeliverable, ClientServiceRequest } from '../../types';

export default function ClientPortalManagementPage() {
  const { currentUser, salonData } = useAuth();
  const [activeTab, setActiveTab] = useState<'invites' | 'reports' | 'contracts' | 'approvals' | 'deliverables' | 'tickets' | 'serviceRequests'>('invites');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Data states
  const [invites, setInvites] = useState<ClientPortalInvite[]>([]);
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [approvals, setApprovals] = useState<ClientApproval[]>([]);
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>([]);
  const [tickets, setTickets] = useState<ClientTicket[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ClientServiceRequest[]>([]);

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDeliverableModalOpen, setIsDeliverableModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<ClientTicket | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [sendingTicketReply, setSendingTicketReply] = useState(false);
  const [editingReport, setEditingReport] = useState<ClientReport | null>(null);
  const [editingContract, setEditingContract] = useState<ClientContract | null>(null);

  // Invite Form State
  const [inviteForm, setInviteForm] = useState({
    clientName: '',
    companyName: '',
    clientEmail: '',
    clientPhone: '',
    notes: ''
  });

  // Report Form State
  const [reportForm, setReportForm] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    period: 'Outubro / 2026',
    summary: '',
    leads: 0,
    reach: 0,
    conversions: 0,
    investment: 0,
    revenue: 0,
    roas: 0,
    externalUrl: '',
    status: 'published'
  });

  // Contract Form State
  const [contractForm, setContractForm] = useState({
    title: '',
    clientName: '',
    clientEmail: '',
    contractType: 'retainer_monthly',
    monthlyValue: 2500,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: 'Indeterminado (Recorrente)',
    status: 'active',
    scope: '',
    signedDocumentUrl: '',
    paymentTerms: 'Vencimento dia 10 via Pix'
  });

  // Approval Form State
  const [approvalForm, setApprovalForm] = useState({
    title: '',
    clientName: '',
    type: 'instagram_post',
    copyText: '',
    mediaUrl: '',
    previewUrl: ''
  });

  // Deliverable Form State
  const [deliverableForm, setDeliverableForm] = useState({
    title: '',
    clientName: '',
    category: 'google_meu_negocio',
    dueDate: new Date().toISOString().slice(0, 10),
    notes: '',
    deliverableUrl: ''
  });

  // Fetch all agency portal data
  const fetchData = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const idToken = await currentUser.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      const [invitesRes, reportsRes, contractsRes, approvalsRes, deliverablesRes, ticketsRes, serviceRequestsRes] = await Promise.all([
        fetch('/api/client-portal/invites', { headers }),
        fetch('/api/client-portal/reports', { headers }),
        fetch('/api/client-portal/contracts', { headers }),
        fetch('/api/client-portal/approvals', { headers }),
        fetch('/api/client-portal/deliverables', { headers }),
        fetch('/api/client-portal/tickets', { headers }),
        fetch('/api/client-portal/service-requests', { headers })
      ]);

      const [invitesData, reportsData, contractsData, approvalsData, deliverablesData, ticketsData, serviceRequestsData] = await Promise.all([
        invitesRes.json(),
        reportsRes.json(),
        contractsRes.json(),
        approvalsRes.json(),
        deliverablesRes.json(),
        ticketsRes.json(),
        serviceRequestsRes.json()
      ]);

      setInvites(invitesData.invites || []);
      setReports(reportsData.reports || []);
      setContracts(contractsData.contracts || []);
      setApprovals(approvalsData.data || []);
      setDeliverables(deliverablesData.data || []);
      setTickets(ticketsData.data || []);
      setServiceRequests(serviceRequestsData.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar dados do portal:', err);
      toast.error('Erro ao sincronizar informações do portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  // Seed demo agency data
  const handleSeedAgencyDemo = async () => {
    if (!currentUser) return;
    try {
      setSeeding(true);
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/client-portal/seed-agency-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar demonstração.');

      toast.success('Demonstração da Agência carregada com sucesso com clientes, relatórios e contratos!');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao inicializar demonstração.');
    } finally {
      setSeeding(false);
    }
  };

  // Create Invite Link
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setActionLoading(true);
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/client-portal/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(inviteForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar link de convite.');

      toast.success('Link de convite exclusivo gerado com sucesso!');
      setIsInviteModalOpen(false);
      setInviteForm({
        clientName: '',
        companyName: '',
        clientEmail: '',
        clientPhone: '',
        notes: ''
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar convite.');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy Link to Clipboard
  const handleCopyInviteLink = (token: string) => {
    const fullLink = `${window.location.origin}/portal/convite?token=${token}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedToken(token);
    toast.success('Link copiado para a área de transferência!');
    setTimeout(() => setCopiedToken(null), 3000);
  };

  // Send via WhatsApp
  const handleSendWhatsApp = (invite: ClientPortalInvite) => {
    const fullLink = `${window.location.origin}/portal/convite?token=${invite.token}`;
    const agencyName = salonData?.name || 'nossa agência';
    const message = encodeURIComponent(
      `Olá ${invite.clientName || 'Cliente'}! Segue o link de acesso exclusivo à sua Área do Cliente da ${agencyName}:\n\n${fullLink}\n\nAli você encontrará seus relatórios de desempenho, métricas de campanhas e contratos de serviços.`
    );
    const cleanPhone = (invite.clientPhone || '').replace(/\D/g, '');
    const url = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  // Delete / Cancel Invite
  const handleCancelInvite = async (token: string) => {
    if (!currentUser) return;
    if (!confirm('Deseja realmente cancelar este convite de cliente?')) return;

    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`/api/client-portal/invites/${token}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      toast.success('Convite cancelado.');
      setInvites(prev => prev.filter(i => i.token !== token));
    } catch (err) {
      toast.error('Erro ao cancelar convite.');
    }
  };

  // Save Report (Create or Update)
  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setActionLoading(true);
      const idToken = await currentUser.getIdToken();

      const payload = {
        title: reportForm.title,
        clientName: reportForm.clientName || 'Geral',
        clientEmail: reportForm.clientEmail,
        period: reportForm.period,
        summary: reportForm.summary,
        metrics: {
          leads: Number(reportForm.leads || 0),
          reach: Number(reportForm.reach || 0),
          conversions: Number(reportForm.conversions || 0),
          investment: Number(reportForm.investment || 0),
          revenue: Number(reportForm.revenue || 0),
          roas: Number(reportForm.roas || 0)
        },
        externalUrl: reportForm.externalUrl,
        status: reportForm.status
      };

      const url = editingReport 
        ? `/api/client-portal/reports/${editingReport.id}` 
        : '/api/client-portal/reports';
      const method = editingReport ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar relatório.');

      toast.success(editingReport ? 'Relatório atualizado!' : 'Relatório publicado com sucesso!');
      setIsReportModalOpen(false);
      setEditingReport(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar relatório.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Report
  const handleDeleteReport = async (id: string) => {
    if (!currentUser) return;
    if (!confirm('Excluir este relatório permanentemente?')) return;

    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`/api/client-portal/reports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      toast.success('Relatório excluído.');
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      toast.error('Erro ao excluir relatório.');
    }
  };

  // Save Contract (Create or Update)
  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setActionLoading(true);
      const idToken = await currentUser.getIdToken();

      const payload = {
        title: contractForm.title,
        clientName: contractForm.clientName || 'Geral',
        clientEmail: contractForm.clientEmail,
        contractType: contractForm.contractType,
        monthlyValue: Number(contractForm.monthlyValue || 0),
        startDate: contractForm.startDate,
        endDate: contractForm.endDate,
        status: contractForm.status,
        scope: contractForm.scope,
        signedDocumentUrl: contractForm.signedDocumentUrl,
        paymentTerms: contractForm.paymentTerms
      };

      const url = editingContract 
        ? `/api/client-portal/contracts/${editingContract.id}` 
        : '/api/client-portal/contracts';
      const method = editingContract ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar contrato.');

      toast.success(editingContract ? 'Contrato atualizado!' : 'Contrato registrado com sucesso!');
      setIsContractModalOpen(false);
      setEditingContract(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar contrato.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Contract
  const handleDeleteContract = async (id: string) => {
    if (!currentUser) return;
    if (!confirm('Excluir este contrato permanentemente?')) return;

    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`/api/client-portal/contracts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      toast.success('Contrato excluído.');
      setContracts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      toast.error('Erro ao excluir contrato.');
    }
  };

  // Save Approval
  const handleSaveApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      setActionLoading(true);
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/client-portal/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(approvalForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar item de aprovação.');
      toast.success('Peça de aprovação cadastrada com sucesso!');
      setIsApprovalModalOpen(false);
      setApprovalForm({
        title: '',
        clientName: '',
        type: 'instagram_post',
        copyText: '',
        mediaUrl: '',
        previewUrl: ''
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar aprovação.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteApproval = async (id: string) => {
    if (!currentUser || !confirm('Excluir este item de aprovação?')) return;
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`/api/client-portal/approvals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      toast.success('Aprovação excluída.');
      setApprovals(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      toast.error('Erro ao excluir aprovação.');
    }
  };

  // Save Deliverable
  const handleSaveDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      setActionLoading(true);
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/client-portal/deliverables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(deliverableForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar entregável.');
      toast.success('Entregável agendado com sucesso!');
      setIsDeliverableModalOpen(false);
      setDeliverableForm({
        title: '',
        clientName: '',
        category: 'google_meu_negocio',
        dueDate: new Date().toISOString().slice(0, 10),
        notes: '',
        deliverableUrl: ''
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar entregável.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleDeliverableStatus = async (id: string, currentStatus: string) => {
    if (!currentUser) return;
    const nextStatus = currentStatus === 'completed' ? 'pending' : currentStatus === 'pending' ? 'in_progress' : 'completed';
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`/api/client-portal/deliverables/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      toast.success(`Status do entregável atualizado para ${nextStatus}!`);
      setDeliverables(prev => prev.map(d => d.id === id ? { ...d, status: nextStatus as any } : d));
    } catch (err) {
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleDeleteDeliverable = async (id: string) => {
    if (!currentUser || !confirm('Excluir este entregável?')) return;
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`/api/client-portal/deliverables/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` }
      });
      toast.success('Entregável excluído.');
      setDeliverables(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      toast.error('Erro ao excluir entregável.');
    }
  };

  // Reply to ticket
  const handleAgencyTicketReply = async () => {
    if (!activeTicket || !ticketReply.trim() || !currentUser) return;
    try {
      setSendingTicketReply(true);
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`/api/client-portal/tickets/${activeTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          text: ticketReply.trim(),
          senderName: salonData?.name || 'Equipe da Agência'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao responder chamado.');
      toast.success('Resposta enviada ao cliente!');
      setActiveTicket(prev => prev ? {
        ...prev,
        messages: [...(prev.messages || []), data.message]
      } : null);
      setTicketReply('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar resposta.');
    } finally {
      setSendingTicketReply(false);
    }
  };

  const handleUpdateTicketStatus = async (id: string, status: string) => {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`/api/client-portal/tickets/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ status })
      });
      toast.success(`Status do chamado atualizado para ${status}!`);
      if (activeTicket && activeTicket.id === id) {
        setActiveTicket(prev => prev ? { ...prev, status: status as any } : null);
      }
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: status as any } : t));
    } catch (err) {
      toast.error('Erro ao atualizar status do chamado.');
    }
  };

  const handleUpdateServiceRequestStatus = async (id: string, status: string) => {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`/api/client-portal/service-requests/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ status })
      });
      toast.success(`Pedido de serviço atualizado para ${status}!`);
      setServiceRequests(prev => prev.map(s => s.id === id ? { ...s, status: status as any } : s));
    } catch (err) {
      toast.error('Erro ao atualizar pedido de serviço.');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0A261E] border border-[#17473A] p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-bold uppercase tracking-wider bg-[#DFC498]/10 px-2.5 py-0.5 rounded-full border border-[#DFC498]/20">
            <Sparkles className="w-3.5 h-3.5" /> Módulo Agência de Marketing
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#DFC498]" />
            Área do Cliente (Portal de Relatórios & Contratos)
          </h1>
          <p className="text-xs text-[#8FAEA2] max-w-2xl leading-relaxed">
            Compartilhe um link exclusivo de convite para que seus clientes de marketing acessem relatórios de tráfego, métricas de crescimento e contratos vigentes com a sua marca.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => window.open('/portal', '_blank')}
            variant="outline"
            className="border-white/10 hover:bg-white/5 text-white text-xs h-10 rounded-xl gap-2 font-medium"
          >
            <Eye className="w-4 h-4 text-[#DFC498]" />
            Ver Portal como Cliente
          </Button>

          {invites.length === 0 && reports.length === 0 && (
            <Button
              onClick={handleSeedAgencyDemo}
              disabled={seeding}
              variant="outline"
              className="border-[#DFC498]/30 bg-[#DFC498]/10 hover:bg-[#DFC498]/20 text-[#DFC498] text-xs h-10 rounded-xl gap-2 font-semibold"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Carregar Dados Demo da Agência
            </Button>
          )}

          <Button
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-gradient-to-r from-[#DFC498] to-[#C5A880] hover:from-[#C5A880] hover:to-[#B0926A] text-[#04140F] font-bold text-xs h-10 rounded-xl shadow-lg gap-2"
          >
            <Plus className="w-4 h-4" />
            Gerar Link de Convite
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#17473A] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('invites')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'invites'
              ? 'border-[#DFC498] text-[#DFC498] bg-[#0A261E]'
              : 'border-transparent text-[#8FAEA2] hover:text-white'
          }`}
        >
          <Link2 className="w-4 h-4" />
          Convites ({invites.length})
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'reports'
              ? 'border-[#DFC498] text-[#DFC498] bg-[#0A261E]'
              : 'border-transparent text-[#8FAEA2] hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Relatórios ({reports.length})
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'contracts'
              ? 'border-[#DFC498] text-[#DFC498] bg-[#0A261E]'
              : 'border-transparent text-[#8FAEA2] hover:text-white'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Contratos ({contracts.length})
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'approvals'
              ? 'border-[#DFC498] text-[#DFC498] bg-[#0A261E]'
              : 'border-transparent text-[#8FAEA2] hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Aprovações ({approvals.length})
        </button>

        <button
          onClick={() => setActiveTab('deliverables')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'deliverables'
              ? 'border-[#DFC498] text-[#DFC498] bg-[#0A261E]'
              : 'border-transparent text-[#8FAEA2] hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Cronograma ({deliverables.length})
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'tickets'
              ? 'border-[#DFC498] text-[#DFC498] bg-[#0A261E]'
              : 'border-transparent text-[#8FAEA2] hover:text-white'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Chamados & Suporte ({tickets.length})
        </button>

        <button
          onClick={() => setActiveTab('serviceRequests')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 shrink-0 ${
            activeTab === 'serviceRequests'
              ? 'border-[#DFC498] text-[#DFC498] bg-[#0A261E]'
              : 'border-transparent text-[#8FAEA2] hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          Pedidos de Serviços ({serviceRequests.length})
        </button>
      </div>

      {/* TAB 1: INVITES */}
      {activeTab === 'invites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Convites para a Área do Cliente</h3>
              <p className="text-xs text-[#8FAEA2]">Envie o link para o cliente se cadastrar e ter acesso seguro ao portal.</p>
            </div>
            <Button
              onClick={() => setIsInviteModalOpen(true)}
              size="sm"
              className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs rounded-xl h-9 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Convite
            </Button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#8FAEA2]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#DFC498]" />
              Carregando convites...
            </div>
          ) : invites.length === 0 ? (
            <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                  <Link2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum convite gerado ainda</h4>
                <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
                  Clique no botão acima para criar o primeiro link de acesso para um de seus clientes.
                </p>
                <Button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="bg-[#DFC498] text-[#04140F] font-bold text-xs h-9 rounded-xl"
                >
                  Criar Primeiro Convite
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invites.map(inv => {
                const isAccepted = inv.status === 'accepted';
                const isCanceled = inv.status === 'canceled';
                const isExpired = inv.expiresAt && Date.now() > inv.expiresAt;

                return (
                  <Card key={inv.token} className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/30 transition-all">
                    <CardHeader className="pb-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge className={`text-[10px] font-mono ${
                          isAccepted 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : isCanceled 
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : isExpired
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {isAccepted ? 'Ativo no Portal' : isCanceled ? 'Cancelado' : isExpired ? 'Expirado' : 'Aguardando Cadastro'}
                        </Badge>
                        <span className="text-[10px] text-[#8FAEA2]">
                          Gerado em: {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <CardTitle className="text-sm font-bold text-white">
                        {inv.companyName || inv.clientName}
                      </CardTitle>
                      <CardDescription className="text-xs text-[#8FAEA2]">
                        Contato: {inv.clientName} {inv.clientEmail ? `• ${inv.clientEmail}` : ''}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-[#8FAEA2] truncate">
                          {window.location.origin}/portal/convite?token={inv.token}
                        </span>
                        <Button
                          onClick={() => handleCopyInviteLink(inv.token)}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[#DFC498] hover:bg-white/5 rounded-lg text-xs shrink-0"
                        >
                          {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          onClick={() => handleSendWhatsApp(inv)}
                          size="sm"
                          className="flex-1 bg-emerald-600/90 hover:bg-emerald-600 text-white font-medium rounded-xl text-xs h-8 gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" /> Enviar WhatsApp
                        </Button>

                        {!isAccepted && !isCanceled && (
                          <Button
                            onClick={() => handleCancelInvite(inv.token)}
                            variant="outline"
                            size="sm"
                            className="border-white/10 text-red-400 hover:bg-red-500/10 rounded-xl text-xs h-8"
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Relatórios de Marketing & Campanhas</h3>
              <p className="text-xs text-[#8FAEA2]">Publique números consolidados de campanhas, tráfego e relatórios Looker Studio.</p>
            </div>
            <Button
              onClick={() => {
                setEditingReport(null);
                setReportForm({
                  title: '',
                  clientName: '',
                  clientEmail: '',
                  period: 'Outubro / 2026',
                  summary: '',
                  leads: 0,
                  reach: 0,
                  conversions: 0,
                  investment: 0,
                  revenue: 0,
                  roas: 0,
                  externalUrl: '',
                  status: 'published'
                });
                setIsReportModalOpen(true);
              }}
              size="sm"
              className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs rounded-xl h-9 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Relatório
            </Button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#8FAEA2]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#DFC498]" />
              Carregando relatórios...
            </div>
          ) : reports.length === 0 ? (
            <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum relatório publicado</h4>
                <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
                  Crie relatórios com métricas de leads, alcance e links do Looker Studio para que seus clientes visualizem na Área do Cliente.
                </p>
                <Button
                  onClick={() => setIsReportModalOpen(true)}
                  className="bg-[#DFC498] text-[#04140F] font-bold text-xs h-9 rounded-xl"
                >
                  Criar Primeiro Relatório
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map(rep => (
                <Card key={rep.id} className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/30 transition-all">
                  <CardHeader className="pb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-[#DFC498]/10 text-[#DFC498] border-[#DFC498]/20 font-mono text-[10px]">
                        {rep.period}
                      </Badge>
                      <span className="text-[10px] text-[#8FAEA2]">
                        Cliente: <strong className="text-white">{rep.clientName || 'Geral'}</strong>
                      </span>
                    </div>
                    <CardTitle className="text-sm font-bold text-white">
                      {rep.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8FAEA2] line-clamp-2">
                      {rep.summary}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-3 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-[#8FAEA2] block">Leads</span>
                        <span className="font-bold text-white">{rep.metrics?.leads || 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8FAEA2] block">Investimento</span>
                        <span className="font-bold text-white">{formatCurrency(rep.metrics?.investment || 0)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8FAEA2] block">ROAS</span>
                        <span className="font-bold text-emerald-400">{rep.metrics?.roas || 0}x</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {rep.externalUrl ? (
                        <a
                          href={rep.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#DFC498] hover:underline flex items-center gap-1"
                        >
                          Dashboard Looker <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#8FAEA2]">Sem link externo</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <Button
                          onClick={() => {
                            setEditingReport(rep);
                            setReportForm({
                              title: rep.title,
                              clientName: rep.clientName,
                              clientEmail: rep.clientEmail || '',
                              period: rep.period,
                              summary: rep.summary,
                              leads: rep.metrics?.leads || 0,
                              reach: rep.metrics?.reach || 0,
                              conversions: rep.metrics?.conversions || 0,
                              investment: rep.metrics?.investment || 0,
                              revenue: rep.metrics?.revenue || 0,
                              roas: rep.metrics?.roas || 0,
                              externalUrl: rep.externalUrl || '',
                              status: rep.status
                            });
                            setIsReportModalOpen(true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-[#8FAEA2] hover:text-white rounded-lg text-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteReport(rep.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONTRACTS */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Contratos de Prestação de Serviços</h3>
              <p className="text-xs text-[#8FAEA2]">Mantenha os contratos vigentes e escopos acessíveis aos seus clientes.</p>
            </div>
            <Button
              onClick={() => {
                setEditingContract(null);
                setContractForm({
                  title: '',
                  clientName: '',
                  clientEmail: '',
                  contractType: 'retainer_monthly',
                  monthlyValue: 2500,
                  startDate: new Date().toISOString().slice(0, 10),
                  endDate: 'Indeterminado (Recorrente)',
                  status: 'active',
                  scope: '',
                  signedDocumentUrl: '',
                  paymentTerms: 'Vencimento dia 10 via Pix'
                });
                setIsContractModalOpen(true);
              }}
              size="sm"
              className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs rounded-xl h-9 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Contrato
            </Button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#8FAEA2]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#DFC498]" />
              Carregando contratos...
            </div>
          ) : contracts.length === 0 ? (
            <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum contrato cadastrado</h4>
                <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
                  Adicione contratos de retainer mensal ou projetos pontuais para consulta do cliente.
                </p>
                <Button
                  onClick={() => setIsContractModalOpen(true)}
                  className="bg-[#DFC498] text-[#04140F] font-bold text-xs h-9 rounded-xl"
                >
                  Registrar Primeiro Contrato
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contracts.map(cont => (
                <Card key={cont.id} className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/30 transition-all">
                  <CardHeader className="pb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                        {cont.status === 'active' ? 'Ativo' : cont.status}
                      </Badge>
                      <span className="text-[10px] text-[#8FAEA2]">
                        Cliente: <strong className="text-white">{cont.clientName}</strong>
                      </span>
                    </div>
                    <CardTitle className="text-sm font-bold text-white">
                      {cont.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8FAEA2] line-clamp-2">
                      {cont.scope}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="p-2.5 bg-black/30 rounded-xl border border-white/5 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#8FAEA2]">Honorário / Fee:</span>
                        <span className="font-bold text-white">{formatCurrency(cont.monthlyValue)}/mês</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8FAEA2]">Início:</span>
                        <span className="text-white">{cont.startDate}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {cont.signedDocumentUrl ? (
                        <a
                          href={cont.signedDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#DFC498] hover:underline flex items-center gap-1"
                        >
                          Documento Assinado <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#8FAEA2]">Sem anexo</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <Button
                          onClick={() => {
                            setEditingContract(cont);
                            setContractForm({
                              title: cont.title,
                              clientName: cont.clientName,
                              clientEmail: cont.clientEmail || '',
                              contractType: cont.contractType,
                              monthlyValue: cont.monthlyValue,
                              startDate: cont.startDate,
                              endDate: cont.endDate || 'Indeterminado',
                              status: cont.status,
                              scope: cont.scope,
                              signedDocumentUrl: cont.signedDocumentUrl || '',
                              paymentTerms: cont.paymentTerms || 'Mensal via Pix'
                            });
                            setIsContractModalOpen(true);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-[#8FAEA2] hover:text-white rounded-lg text-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteContract(cont.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: APROVAÇÕES (WORKFLOW) */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Central de Aprovações & Peças</h3>
              <p className="text-xs text-[#8FAEA2]">Envie peças de Instagram, Google Meu Negócio ou Landing Pages para o cliente aprovar.</p>
            </div>
            <Button
              onClick={() => setIsApprovalModalOpen(true)}
              size="sm"
              className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs rounded-xl h-9 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Peça para Aprovação
            </Button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#8FAEA2]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#DFC498]" />
              Carregando aprovações...
            </div>
          ) : approvals.length === 0 ? (
            <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhuma peça para aprovação cadastrada</h4>
                <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
                  Envie a primeira arte ou post para que o cliente revise e aprove no portal dele.
                </p>
                <Button
                  onClick={() => setIsApprovalModalOpen(true)}
                  className="bg-[#DFC498] text-[#04140F] font-bold text-xs h-9 rounded-xl"
                >
                  Cadastrar Primeira Peça
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvals.map(item => (
                <Card key={item.id} className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/30 transition-all">
                  <CardHeader className="pb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-white/5 text-[#DFC498] border-white/10 text-[10px]">
                        {item.type}
                      </Badge>
                      <Badge className={`text-[10px] ${
                        item.status === 'approved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : item.status === 'revisions_requested'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                      }`}>
                        {item.status === 'approved' ? 'Aprovado' : item.status === 'revisions_requested' ? 'Alteração Solicitada' : 'Pendente'}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-bold text-white">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8FAEA2]">
                      Cliente: <strong className="text-white">{item.clientName || 'Geral'}</strong>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    {item.copyText && (
                      <p className="text-xs text-[#8FAEA2] bg-black/20 p-2.5 rounded-xl border border-white/5 line-clamp-2">
                        {item.copyText}
                      </p>
                    )}

                    {item.clientFeedback && (
                      <div className="text-xs p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                        <strong className="block text-[10px] uppercase font-bold">Feedback do Cliente:</strong>
                        "{item.clientFeedback}"
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      {item.mediaUrl ? (
                        <a href={item.mediaUrl} target="_blank" rel="noreferrer" className="text-xs text-[#DFC498] hover:underline flex items-center gap-1">
                          Ver Imagem <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : <span />}

                      <Button
                        onClick={() => handleDeleteApproval(item.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CRONOGRAMA / ENTREGÁVEIS */}
      {activeTab === 'deliverables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Cronograma de Entregas</h3>
              <p className="text-xs text-[#8FAEA2]">Defina os prazos e entregáveis que seus clientes acompanham no calendário.</p>
            </div>
            <Button
              onClick={() => setIsDeliverableModalOpen(true)}
              size="sm"
              className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs rounded-xl h-9 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Entregável
            </Button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#8FAEA2]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#DFC498]" />
              Carregando cronograma...
            </div>
          ) : deliverables.length === 0 ? (
            <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                  <Calendar className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum entregável agendado</h4>
                <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
                  Agende a próxima entrega de post, otimização de Google Meu Negócio ou Landing Page.
                </p>
                <Button
                  onClick={() => setIsDeliverableModalOpen(true)}
                  className="bg-[#DFC498] text-[#04140F] font-bold text-xs h-9 rounded-xl"
                >
                  Agendar Primeira Entrega
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {deliverables.map(deliv => (
                <div
                  key={deliv.id}
                  className="bg-[#0A261E] border border-[#17473A] p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#DFC498] bg-[#DFC498]/10 px-2 py-0.5 rounded-full border border-[#DFC498]/20">
                        {deliv.dueDate}
                      </span>
                      <span className="text-xs text-[#8FAEA2]">Cliente: <strong className="text-white">{deliv.clientName}</strong></span>
                      <Badge className="bg-white/5 text-[#8FAEA2] text-[10px]">
                        {deliv.category}
                      </Badge>
                    </div>
                    <h4 className="text-sm font-bold text-white">{deliv.title}</h4>
                    {deliv.notes && <p className="text-xs text-[#8FAEA2]">{deliv.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      onClick={() => handleToggleDeliverableStatus(deliv.id, deliv.status)}
                      variant="outline"
                      size="sm"
                      className={`text-xs h-8 rounded-xl ${
                        deliv.status === 'completed'
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-white/10 text-white hover:bg-white/5'
                      }`}
                    >
                      {deliv.status === 'completed' ? 'Concluído ✓' : 'Marcar Concluído'}
                    </Button>

                    <Button
                      onClick={() => handleDeleteDeliverable(deliv.id)}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: TICKETS DE SUPORTE */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Chamados & Suporte do Cliente</h3>
            <p className="text-xs text-[#8FAEA2]">Dúvidas e solicitações abertas diretamente pelos clientes no portal.</p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#8FAEA2]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#DFC498]" />
              Carregando chamados...
            </div>
          ) : tickets.length === 0 ? (
            <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum chamado aberto no momento</h4>
                <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
                  Quando seus clientes enviarem dúvidas ou solicitações pelo portal, elas aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.map(ticket => (
                <Card
                  key={ticket.id}
                  className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/30 transition-all flex flex-col justify-between"
                >
                  <CardHeader className="pb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-white/5 text-[#DFC498] text-[10px]">
                        {ticket.category}
                      </Badge>
                      <Badge className={`text-[10px] ${
                        ticket.status === 'resolved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : ticket.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                          : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                      }`}>
                        {ticket.status === 'resolved' ? 'Resolvido' : ticket.status === 'in_progress' ? 'Em Atendimento' : 'Aberto'}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-bold text-white">
                      {ticket.subject}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8FAEA2]">
                      Cliente: <strong className="text-white">{ticket.clientName}</strong> {ticket.clientEmail ? `• ${ticket.clientEmail}` : ''}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="text-xs text-[#8FAEA2] bg-black/20 p-2.5 rounded-xl border border-white/5">
                      {ticket.messages && ticket.messages.length > 0 ? (
                        <p className="line-clamp-2">
                          <strong>{ticket.messages[ticket.messages.length - 1].senderName}:</strong> "{ticket.messages[ticket.messages.length - 1].text}"
                        </p>
                      ) : (
                        <p>Nenhuma mensagem ainda.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#8FAEA2]">
                        {ticket.messages?.length || 0} mensagem(ns)
                      </span>

                      <Button
                        onClick={() => setActiveTicket(ticket)}
                        size="sm"
                        className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs h-8 rounded-xl gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Abrir Conversa & Responder
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: PEDIDOS DE SERVIÇOS EXTRAS (UP-SELL) */}
      {activeTab === 'serviceRequests' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Solicitações de Serviços Adicionais (Up-sell)</h3>
            <p className="text-xs text-[#8FAEA2]">Serviços extras de Google Meu Negócio, Landing Pages e Instagram solicitados pelos clientes no portal.</p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#8FAEA2]">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#DFC498]" />
              Carregando pedidos...
            </div>
          ) : serviceRequests.length === 0 ? (
            <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                  <Zap className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum pedido de serviço extra registrado</h4>
                <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
                  Quando um cliente solicitar um serviço adicional pelo portal, o pedido aparecerá aqui com todos os dados de contato.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {serviceRequests.map(req => (
                <div
                  key={req.id}
                  className="bg-[#0A261E] border border-[#17473A] p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#DFC498]/10 text-[#DFC498] border-[#DFC498]/20 text-[10px]">
                        {req.category}
                      </Badge>
                      <span className="text-xs text-[#8FAEA2]">Cliente: <strong className="text-white">{req.clientName}</strong></span>
                      <span className="text-[11px] text-[#8FAEA2]">• {new Date(req.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white">{req.serviceName}</h4>
                    {req.notes && (
                      <p className="text-xs text-[#8FAEA2] bg-black/20 p-2 rounded-lg border border-white/5 max-w-xl">
                        Nota: "{req.notes}"
                      </p>
                    )}
                    <div className="text-[11px] text-[#8FAEA2] flex items-center gap-3 pt-1">
                      {req.clientEmail && <span>E-mail: <strong className="text-white">{req.clientEmail}</strong></span>}
                      {req.clientPhone && <span>WhatsApp: <strong className="text-white">{req.clientPhone}</strong></span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={req.status}
                      onChange={e => handleUpdateServiceRequestStatus(req.id, e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl text-white px-3 h-8 text-xs font-medium"
                    >
                      <option value="requested">Solicitado</option>
                      <option value="in_review">Em Análise</option>
                      <option value="quoted">Orçamento Enviado</option>
                      <option value="accepted">Aceito / Contratado</option>
                      <option value="declined">Recusado</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: GERAR CONVITE */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#DFC498]" />
              Gerar Link de Convite para o Cliente
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Crie um link exclusivo para seu cliente cadastrar a senha e acessar o portal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInvite} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Nome da Empresa / Marca do Cliente *</Label>
              <Input
                required
                value={inviteForm.companyName}
                onChange={e => setInviteForm(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Ex: Acme Odontologia Integrada"
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Nome do Responsável / Contato</Label>
              <Input
                value={inviteForm.clientName}
                onChange={e => setInviteForm(prev => ({ ...prev, clientName: e.target.value }))}
                placeholder="Ex: Dra. Carolina Mendes"
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">E-mail do Cliente</Label>
                <Input
                  type="email"
                  value={inviteForm.clientEmail}
                  onChange={e => setInviteForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                  placeholder="cliente@empresa.com"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">WhatsApp do Cliente</Label>
                <Input
                  value={inviteForm.clientPhone}
                  onChange={e => setInviteForm(prev => ({ ...prev, clientPhone: e.target.value }))}
                  placeholder="(11) 98765-4321"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Observações / Notas Internas</Label>
              <Input
                value={inviteForm.notes}
                onChange={e => setInviteForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ex: Cliente de tráfego pago iniciado em Outubro"
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <Button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold h-10 rounded-xl mt-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gerar Link de Convite'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CRIAR / EDITAR RELATÓRIO */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#DFC498]" />
              {editingReport ? 'Editar Relatório de Marketing' : 'Publicar Novo Relatório de Marketing'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Insira as métricas do período para exibição na Área do Cliente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveReport} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Título do Relatório *</Label>
              <Input
                required
                value={reportForm.title}
                onChange={e => setReportForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Relatório de Performance Meta Ads & Google Ads"
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Nome do Cliente / Empresa *</Label>
                <Input
                  required
                  value={reportForm.clientName}
                  onChange={e => setReportForm(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Ex: Acme Odontologia"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Mês / Período *</Label>
                <Input
                  required
                  value={reportForm.period}
                  onChange={e => setReportForm(prev => ({ ...prev, period: e.target.value }))}
                  placeholder="Ex: Outubro / 2026"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Resumo Executivo / Destaques do Mês</Label>
              <textarea
                rows={3}
                value={reportForm.summary}
                onChange={e => setReportForm(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="Ex: Redução de 20% no custo por lead com alta no faturamento gerado por campanhas de Google Ads."
                className="w-full bg-black/30 border border-white/10 text-white rounded-xl p-3 text-xs focus:border-[#DFC498] resize-none"
              />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-[#8FAEA2]">Leads Gerados</Label>
                <Input
                  type="number"
                  value={reportForm.leads}
                  onChange={e => setReportForm(prev => ({ ...prev, leads: Number(e.target.value) }))}
                  className="bg-black/30 border-white/10 text-white rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-[#8FAEA2]">Alcance Total</Label>
                <Input
                  type="number"
                  value={reportForm.reach}
                  onChange={e => setReportForm(prev => ({ ...prev, reach: Number(e.target.value) }))}
                  className="bg-black/30 border-white/10 text-white rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-[#8FAEA2]">Conversões</Label>
                <Input
                  type="number"
                  value={reportForm.conversions}
                  onChange={e => setReportForm(prev => ({ ...prev, conversions: Number(e.target.value) }))}
                  className="bg-black/30 border-white/10 text-white rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-[#8FAEA2]">Investimento (R$)</Label>
                <Input
                  type="number"
                  value={reportForm.investment}
                  onChange={e => setReportForm(prev => ({ ...prev, investment: Number(e.target.value) }))}
                  className="bg-black/30 border-white/10 text-white rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-[#8FAEA2]">Faturamento (R$)</Label>
                <Input
                  type="number"
                  value={reportForm.revenue}
                  onChange={e => setReportForm(prev => ({ ...prev, revenue: Number(e.target.value) }))}
                  className="bg-black/30 border-white/10 text-white rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-[#8FAEA2]">ROAS (x)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={reportForm.roas}
                  onChange={e => setReportForm(prev => ({ ...prev, roas: Number(e.target.value) }))}
                  className="bg-black/30 border-white/10 text-white rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Link do Painel Looker Studio / Apresentação (Opcional)</Label>
              <Input
                value={reportForm.externalUrl}
                onChange={e => setReportForm(prev => ({ ...prev, externalUrl: e.target.value }))}
                placeholder="https://lookerstudio.google.com/reporting/..."
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <Button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold h-10 rounded-xl mt-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingReport ? 'Salvar Alterações' : 'Publicar Relatório'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CRIAR / EDITAR CONTRATO */}
      <Dialog open={isContractModalOpen} onOpenChange={setIsContractModalOpen}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#DFC498]" />
              {editingContract ? 'Editar Contrato' : 'Registrar Novo Contrato'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Cadastre o escopo, vigência e valores acordados com o cliente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveContract} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Título do Contrato *</Label>
              <Input
                required
                value={contractForm.title}
                onChange={e => setContractForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Contrato de Prestação de Serviços de Marketing & Tráfego"
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Nome do Cliente / Empresa *</Label>
                <Input
                  required
                  value={contractForm.clientName}
                  onChange={e => setContractForm(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Ex: Acme Odontologia"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Honorário Mensal / Fee (R$)</Label>
                <Input
                  type="number"
                  value={contractForm.monthlyValue}
                  onChange={e => setContractForm(prev => ({ ...prev, monthlyValue: Number(e.target.value) }))}
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Data de Início</Label>
                <Input
                  type="date"
                  value={contractForm.startDate}
                  onChange={e => setContractForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Vigência / Término</Label>
                <Input
                  value={contractForm.endDate}
                  onChange={e => setContractForm(prev => ({ ...prev, endDate: e.target.value }))}
                  placeholder="Ex: 12 meses (Renovável)"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Escopo dos Serviços / Entregáveis</Label>
              <textarea
                rows={3}
                value={contractForm.scope}
                onChange={e => setContractForm(prev => ({ ...prev, scope: e.target.value }))}
                placeholder="Ex: Gestão de campanhas Meta Ads e Google Ads, criação de 8 criativos mensais e reunião quinzenal de alinhamento."
                className="w-full bg-black/30 border border-white/10 text-white rounded-xl p-3 text-xs focus:border-[#DFC498] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Link do Documento Assinado (Clicksign/DocuSign/Drive/PDF)</Label>
              <Input
                value={contractForm.signedDocumentUrl}
                onChange={e => setContractForm(prev => ({ ...prev, signedDocumentUrl: e.target.value }))}
                placeholder="https://drive.google.com/file/..."
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <Button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold h-10 rounded-xl mt-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingContract ? 'Salvar Alterações' : 'Registrar Contrato'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CRIAR PEÇA PARA APROVAÇÃO */}
      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#DFC498]" />
              Cadastrar Peça para Aprovação do Cliente
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              O cliente receberá uma notificação na Área do Cliente para aprovar ou solicitar ajustes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveApproval} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Título da Peça / Post *</Label>
              <Input
                required
                value={approvalForm.title}
                onChange={e => setApprovalForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Carrossel Instagram: 5 Mitos sobre Clareamento"
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Nome do Cliente / Empresa</Label>
                <Input
                  value={approvalForm.clientName}
                  onChange={e => setApprovalForm(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Ex: Acme Odontologia"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Canal / Tipo de Conteúdo</Label>
                <select
                  value={approvalForm.type}
                  onChange={e => setApprovalForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl text-white px-3 h-10 text-xs"
                >
                  <option value="instagram_post">Instagram (Post / Reels / Carrossel)</option>
                  <option value="gmn_post">Google Meu Negócio (Novidade / Oferta)</option>
                  <option value="landing_page">Site & Landing Page</option>
                  <option value="other">Outro Conteúdo</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Texto / Legenda / Copy</Label>
              <textarea
                rows={4}
                value={approvalForm.copyText}
                onChange={e => setApprovalForm(prev => ({ ...prev, copyText: e.target.value }))}
                placeholder="Insira a legenda ou texto que acompanhará a publicação..."
                className="w-full bg-black/30 border border-white/10 text-white rounded-xl p-3 text-xs focus:border-[#DFC498] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">URL da Imagem / Vídeo</Label>
                <Input
                  value={approvalForm.mediaUrl}
                  onChange={e => setApprovalForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
                  placeholder="https://... (link da imagem/arte)"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">URL de Prévia Externa (Opcional)</Label>
                <Input
                  value={approvalForm.previewUrl}
                  onChange={e => setApprovalForm(prev => ({ ...prev, previewUrl: e.target.value }))}
                  placeholder="https://... (Figma, Canva ou link da página)"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold h-10 rounded-xl mt-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar para Aprovação'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVO ENTREGÁVEL */}
      <Dialog open={isDeliverableModalOpen} onOpenChange={setIsDeliverableModalOpen}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#DFC498]" />
              Agendar Novo Entregável
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Adicione marcos e tarefas para visualização do cliente no cronograma.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDeliverable} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Título do Entregável *</Label>
              <Input
                required
                value={deliverableForm.title}
                onChange={e => setDeliverableForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Otimização de fotos no Google Meu Negócio"
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Cliente / Empresa</Label>
                <Input
                  value={deliverableForm.clientName}
                  onChange={e => setDeliverableForm(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Ex: Acme Odontologia"
                  className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Canal / Especialidade</Label>
                <select
                  value={deliverableForm.category}
                  onChange={e => setDeliverableForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl text-white px-3 h-10 text-xs"
                >
                  <option value="google_meu_negocio">Google Meu Negócio</option>
                  <option value="site_landing_page">Site & Landing Page</option>
                  <option value="instagram">Instagram</option>
                  <option value="geral">Geral / Operacional</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Data Prevista de Entrega *</Label>
              <Input
                type="date"
                required
                value={deliverableForm.dueDate}
                onChange={e => setDeliverableForm(prev => ({ ...prev, dueDate: e.target.value }))}
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Observações / Detalhes</Label>
              <textarea
                rows={3}
                value={deliverableForm.notes}
                onChange={e => setDeliverableForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ex: Inclui upload de 15 fotos e postagem semanal de oferta."
                className="w-full bg-black/30 border border-white/10 text-white rounded-xl p-3 text-xs focus:border-[#DFC498] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Link de Acesso à Entrega (Opcional)</Label>
              <Input
                value={deliverableForm.deliverableUrl}
                onChange={e => setDeliverableForm(prev => ({ ...prev, deliverableUrl: e.target.value }))}
                placeholder="https://..."
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-sm focus:border-[#DFC498]"
              />
            </div>

            <Button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold h-10 rounded-xl mt-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar no Cronograma'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CONVERSA / RESPOSTA DE CHAMADO */}
      <Dialog open={!!activeTicket} onOpenChange={open => !open && setActiveTicket(null)}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <Badge className="bg-white/5 text-[#DFC498] text-[10px]">
                {activeTicket?.category}
              </Badge>
              {activeTicket && (
                <div className="flex items-center gap-2">
                  <select
                    value={activeTicket.status}
                    onChange={e => handleUpdateTicketStatus(activeTicket.id, e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-lg text-white px-2 py-0.5 text-xs"
                  >
                    <option value="open">Aberto</option>
                    <option value="in_progress">Em Atendimento</option>
                    <option value="resolved">Resolvido</option>
                    <option value="closed">Fechado</option>
                  </select>
                </div>
              )}
            </div>
            <DialogTitle className="text-base font-bold text-white pt-1">
              {activeTicket?.subject}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Cliente: {activeTicket?.clientName} ({activeTicket?.clientEmail || 'Sem e-mail'})
            </DialogDescription>
          </DialogHeader>

          {activeTicket && (
            <div className="space-y-4 pt-2">
              {/* Message List */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {(activeTicket.messages || []).map((msg, i) => {
                  const isAgency = msg.senderRole === 'agency';
                  return (
                    <div key={i} className={`flex flex-col ${isAgency ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-[#8FAEA2] mb-0.5 px-1">
                        {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                        isAgency 
                          ? 'bg-[#124234] text-white rounded-tr-none border border-emerald-500/20' 
                          : 'bg-black/40 text-[#E1EDE8] rounded-tl-none border border-white/10'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <div className="border-t border-[#17473A] pt-3 space-y-2">
                <textarea
                  rows={3}
                  value={ticketReply}
                  onChange={e => setTicketReply(e.target.value)}
                  placeholder="Digite sua resposta da agência para o cliente..."
                  className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-2.5 text-xs focus:border-[#DFC498] resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={handleAgencyTicketReply}
                    disabled={sendingTicketReply || !ticketReply.trim()}
                    className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs h-8 rounded-xl gap-1.5"
                  >
                    {sendingTicketReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Enviar Resposta
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

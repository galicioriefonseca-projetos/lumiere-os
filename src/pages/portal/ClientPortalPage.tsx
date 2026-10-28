import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Building2, 
  FileText, 
  TrendingUp, 
  Briefcase, 
  ShieldCheck, 
  ExternalLink, 
  Download, 
  Calendar, 
  DollarSign, 
  Users, 
  Target, 
  Phone, 
  Mail, 
  MessageSquare, 
  LogOut, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Eye,
  ArrowRight,
  Filter,
  MapPin,
  Navigation,
  Search,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { ClientReport, ClientContract, ClientApproval, ClientTicket, ClientDeliverable } from '../../types';
import ApprovalsWorkflowTab from '@/components/portal/ApprovalsWorkflowTab';
import DeliverablesCalendarTab from '@/components/portal/DeliverablesCalendarTab';
import SupportTicketsTab from '@/components/portal/SupportTicketsTab';
import CreativeLibraryTab from '@/components/portal/CreativeLibraryTab';
import MarketingGlossaryTab from '@/components/portal/MarketingGlossaryTab';
import AdditionalServicesTab from '@/components/portal/AdditionalServicesTab';
import AccountTimelineTab from '@/components/portal/AccountTimelineTab';
import ReportsAnalyticsTab from '@/components/portal/ReportsAnalyticsTab';

interface ClientPortalData {
  agency: {
    id: string;
    name: string;
    ownerName: string;
    phone: string;
    email: string;
    city: string;
    state: string;
  };
  client: {
    id: string;
    name: string;
    contactName: string;
    email: string;
    phone: string;
  };
  reports: ClientReport[];
  contracts: ClientContract[];
  approvals: any[];
  tickets: any[];
  deliverables: any[];
  isPreview: boolean;
}

export default function ClientPortalPage() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['reports', 'approvals', 'calendar', 'contracts', 'tickets', 'library', 'glossary', 'services', 'timeline'];
  const queryTab = searchParams.get('tab') || 'reports';
  const initialTab = validTabs.includes(queryTab) ? (queryTab as any) : 'reports';

  const [activeTab, setActiveTab] = useState<
    'reports' | 'approvals' | 'calendar' | 'contracts' | 'tickets' | 'library' | 'glossary' | 'services' | 'timeline'
  >(initialTab);
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<ClientPortalData | null>(null);
  const [selectedReport, setSelectedReport] = useState<ClientReport | null>(null);
  const [selectedContract, setSelectedContract] = useState<ClientContract | null>(null);

  const loadPortal = async () => {
    try {
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();

      const previewClientId = searchParams.get('previewClient') || '';
      const previewSalonId = searchParams.get('previewSalon') || '';
      const queryParams = new URLSearchParams();
      if (previewClientId) queryParams.set('clientId', previewClientId);
      if (previewSalonId) queryParams.set('salonId', previewSalonId);

      const res = await fetch(`/api/client-portal/client-view?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível carregar os dados do portal.');
      }

      setPortalData(data);
    } catch (err: any) {
      console.error('Erro ao carregar portal do cliente:', err);
      toast.error(err.message || 'Falha ao sincronizar área do cliente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
  }, [currentUser, searchParams]);

  // Aggregate metrics
  const totalLeads = portalData?.reports?.reduce((acc, r) => acc + (r.metrics?.leads || 0), 0) || 0;
  const totalReach = portalData?.reports?.reduce((acc, r) => acc + (r.metrics?.reach || 0), 0) || 0;
  const totalConversions = portalData?.reports?.reduce((acc, r) => acc + (r.metrics?.conversions || 0), 0) || 0;
  const avgRoas = portalData?.reports?.length 
    ? (portalData.reports.reduce((acc, r) => acc + (r.metrics?.roas || 0), 0) / portalData.reports.length).toFixed(1)
    : '0.0';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleWhatsAppSupport = () => {
    if (!portalData?.agency?.phone) {
      toast.info('Telefone da agência não cadastrado.');
      return;
    }
    const cleanPhone = portalData.agency.phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá! Sou ${portalData.client.name} e gostaria de falar sobre nossos relatórios e projetos de marketing.`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#061A14] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#DFC498] mb-3" />
        <p className="text-[#8FAEA2] text-sm">Carregando seu portal do cliente...</p>
      </div>
    );
  }

  if (!portalData) {
    return (
      <div className="min-h-screen bg-[#061A14] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0A261E] border border-white/10 p-8 rounded-2xl text-center">
          <AlertCircle className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Área do Cliente</h2>
          <p className="text-sm text-[#8FAEA2] mb-6">
            Não encontramos dados vinculados a este usuário. Se você é um cliente, solicite o link de convite à agência.
          </p>
          <Button onClick={() => navigate('/login')} className="bg-[#DFC498] text-[#04140F]">
            Voltar ao Login
          </Button>
        </div>
      </div>
    );
  }

  const { agency, client, reports, contracts, approvals = [], tickets = [], deliverables = [], isPreview } = portalData;

  const pendingApprovalsCount = approvals.filter((a: any) => a.status === 'pending').length;
  const openTicketsCount = tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div className="min-h-screen bg-[#061A14] text-[#F5F9F7] flex flex-col">
      {/* Top Banner if in Preview Mode */}
      {isPreview && (
        <div className="bg-[#DFC498] text-[#04140F] px-4 py-2 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span>Modo Visualização da Agência: Você está vendo a Área do Cliente como seus clientes veem.</span>
          </div>
          <Link
            to="/dashboard/area-do-cliente"
            className="underline hover:opacity-80 font-bold flex items-center gap-1"
          >
            Voltar para Gestão da Agência <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-[#17473A]/80 bg-[#061A14]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DFC498] to-[#997C4D] flex items-center justify-center text-[#04140F] font-bold shadow-lg">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#DFC498] bg-[#DFC498]/10 px-2 py-0.5 rounded-full border border-[#DFC498]/20">
                Portal do Cliente
              </span>
              <span className="text-xs text-[#8FAEA2]">• {agency.name}</span>
            </div>
            <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">{client.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleWhatsAppSupport}
            variant="outline"
            size="sm"
            className="hidden sm:flex border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-xl h-9 gap-2"
          >
            <Phone className="w-3.5 h-3.5" />
            Falar com a Agência
          </Button>

          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="border-white/10 hover:bg-white/5 text-[#8FAEA2] hover:text-white rounded-xl h-9 text-xs gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Hero Welcome Bar */}
      <div className="bg-gradient-to-b from-[#0A261E] to-[#061A14] border-b border-[#17473A]/40 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Espaço Exclusivo de Acompanhamento
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Bem-vindo(a), {client.contactName || client.name}
              </h2>
              <p className="text-sm text-[#8FAEA2]">
                Acompanhe em tempo real os relatórios de campanhas, métricas de crescimento e contratos vigentes com a <strong className="text-white">{agency.name}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-black/30 border border-white/5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#8FAEA2] block">Status da Conta</span>
                  <span className="text-xs font-bold text-emerald-400">Ativa & Em Operação</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2">
            <div className="bg-[#0A261E]/90 border border-[#17473A] p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-[#8FAEA2] mb-1.5">
                <span className="text-xs font-medium">Leads Gerados</span>
                <Users className="w-4 h-4 text-[#DFC498]" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {totalLeads.toLocaleString('pt-BR')}
              </p>
              <span className="text-[10px] text-[#8FAEA2]">Consolidado em relatórios</span>
            </div>

            <div className="bg-[#0A261E]/90 border border-[#17473A] p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-[#8FAEA2] mb-1.5">
                <span className="text-xs font-medium">Alcance Total</span>
                <TrendingUp className="w-4 h-4 text-[#DFC498]" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {totalReach > 1000 ? `${(totalReach / 1000).toFixed(1)}k` : totalReach}
              </p>
              <span className="text-[10px] text-[#8FAEA2]">Impressões e visualizações</span>
            </div>

            <div className="bg-[#0A261E]/90 border border-[#17473A] p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-[#8FAEA2] mb-1.5">
                <span className="text-xs font-medium">Conversões</span>
                <Target className="w-4 h-4 text-[#DFC498]" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {totalConversions.toLocaleString('pt-BR')}
              </p>
              <span className="text-[10px] text-[#8FAEA2]">Contatos diretos e vendas</span>
            </div>

            <div className="bg-[#0A261E]/90 border border-[#17473A] p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-[#8FAEA2] mb-1.5">
                <span className="text-xs font-medium">ROAS Médio</span>
                <DollarSign className="w-4 h-4 text-[#DFC498]" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {avgRoas}x
              </p>
              <span className="text-[10px] text-[#8FAEA2]">Retorno sobre investimento</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-[#17473A]/60 bg-[#061A14] px-4 sm:px-6 sticky top-[69px] z-30 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center justify-between min-w-max gap-4">
          <div className="flex items-center gap-2 sm:gap-6">
            <button
              onClick={() => {
                setActiveTab('reports');
                setSearchParams({ tab: 'reports' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'reports'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Relatórios ({reports.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('approvals');
                setSearchParams({ tab: 'approvals' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'approvals'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Aprovações
              {pendingApprovalsCount > 0 ? (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full border border-amber-500/30">
                  {pendingApprovalsCount} pendente(s)
                </span>
              ) : (
                <span className="text-[#8FAEA2] text-[11px]">({approvals.length})</span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('calendar');
                setSearchParams({ tab: 'calendar' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'calendar'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Cronograma ({deliverables.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('contracts');
                setSearchParams({ tab: 'contracts' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'contracts'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Contratos ({contracts.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('tickets');
                setSearchParams({ tab: 'tickets' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'tickets'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Suporte & Chat
              {openTicketsCount > 0 && (
                <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.2 rounded-full border border-blue-500/30">
                  {openTicketsCount} ativo(s)
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('library');
                setSearchParams({ tab: 'library' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'library'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Criativos
            </button>

            <button
              onClick={() => {
                setActiveTab('glossary');
                setSearchParams({ tab: 'glossary' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'glossary'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <Target className="w-4 h-4" />
              Glossário
            </button>

            <button
              onClick={() => {
                setActiveTab('services');
                setSearchParams({ tab: 'services' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'services'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Serviços Adicionais
            </button>

            <button
              onClick={() => {
                setActiveTab('timeline');
                setSearchParams({ tab: 'timeline' });
              }}
              className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
                activeTab === 'timeline'
                  ? 'border-[#DFC498] text-[#DFC498]'
                  : 'border-transparent text-[#8FAEA2] hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              Histórico & Linha do Tempo
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1 space-y-6">
        
        {/* TAB 1: RELATÓRIOS & ANÁLISE DO GOOGLE MEU NEGÓCIO */}
        {activeTab === 'reports' && (
          <ReportsAnalyticsTab
            reports={reports}
            agencyName={agency.name}
            clientName={client.name}
            onOpenReportDetails={(report) => setSelectedReport(report)}
          />
        )}

        {/* TAB 2: CENTRAL DE APROVAÇÕES */}
        {activeTab === 'approvals' && (
          <ApprovalsWorkflowTab
            approvals={approvals}
            onApprovalUpdated={loadPortal}
            currentUser={currentUser}
            agencyName={agency.name}
          />
        )}

        {/* TAB 3: CRONOGRAMA DE ENTREGAS */}
        {activeTab === 'calendar' && (
          <DeliverablesCalendarTab
            deliverables={deliverables}
            agencyName={agency.name}
          />
        )}

        {/* TAB 4: CONTRACTS */}
        {activeTab === 'contracts' && (
          <div className="space-y-6">
            {contracts.length === 0 ? (
              <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
                <CardContent className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Nenhum contrato arquivado no momento</h3>
                  <p className="text-xs text-[#8FAEA2] max-w-md mx-auto">
                    Os contratos de prestação de serviços firmados com a <strong className="text-white">{agency.name}</strong> serão listados nesta aba assim que homologados.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {contracts.map(contract => (
                  <Card 
                    key={contract.id}
                    className="bg-[#0A261E]/95 border-[#17473A] hover:border-[#DFC498]/40 transition-all shadow-lg flex flex-col justify-between"
                  >
                    <CardHeader className="space-y-2 pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {contract.status === 'active' ? 'Contrato em Vigor' : contract.status}
                        </Badge>
                        <span className="text-[11px] text-[#8FAEA2]">
                          Início: {contract.startDate}
                        </span>
                      </div>
                      <CardTitle className="text-base font-bold text-white leading-snug">
                        {contract.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-[#8FAEA2] line-clamp-3 leading-relaxed">
                        {contract.scope || 'Prestação continuada de serviços estratégicos de marketing digital.'}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-0">
                      <div className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#8FAEA2]">Valor Mensal:</span>
                          <span className="font-bold text-white">
                            {contract.monthlyValue ? formatCurrency(contract.monthlyValue) : 'A Combinar'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8FAEA2]">Condição de Pagamento:</span>
                          <span className="text-[#DFC498] font-medium">
                            {contract.paymentTerms || 'Mensal'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8FAEA2]">Vigência:</span>
                          <span className="text-white">{contract.endDate || 'Indeterminado'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          onClick={() => setSelectedContract(contract)}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-white/10 text-white hover:bg-white/5 rounded-xl text-xs h-9"
                        >
                          Ver Escopo Detalhado
                        </Button>

                        {contract.signedDocumentUrl && (
                          <Button
                            onClick={() => window.open(contract.signedDocumentUrl, '_blank')}
                            size="sm"
                            className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold rounded-xl text-xs h-9 gap-1.5 shadow"
                          >
                            <Download className="w-3.5 h-3.5" /> Baixar Contrato
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SUPORTE & CHAT */}
        {activeTab === 'tickets' && (
          <SupportTicketsTab
            tickets={tickets}
            onTicketUpdated={loadPortal}
            currentUser={currentUser}
            agencyName={agency.name}
            clientName={client.name}
          />
        )}

        {/* TAB 6: BIBLIOTECA DE CRIATIVOS */}
        {activeTab === 'library' && (
          <CreativeLibraryTab
            approvals={approvals}
            agencyName={agency.name}
          />
        )}

        {/* TAB 7: GLOSSÁRIO DE MARKETING */}
        {activeTab === 'glossary' && (
          <MarketingGlossaryTab />
        )}

        {/* TAB 8: SERVIÇOS ADICIONAIS (UP-SELL) */}
        {activeTab === 'services' && (
          <AdditionalServicesTab
            currentUser={currentUser}
            agencyName={agency.name}
            clientName={client.name}
            clientEmail={client.email}
            clientPhone={client.phone}
          />
        )}

        {/* TAB 9: LINHA DO TEMPO & AUDITORIA */}
        {activeTab === 'timeline' && (
          <AccountTimelineTab
            reports={reports}
            contracts={contracts}
            approvals={approvals}
            tickets={tickets}
            deliverables={deliverables}
            agencyName={agency.name}
          />
        )}

        {/* Agency Direct Contact Box */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0A261E] via-[#0D3026] to-[#0A261E] border border-[#17473A] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="text-sm font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <MessageSquare className="w-4 h-4 text-[#DFC498]" />
              Dúvidas sobre seus relatórios ou demandas de campanhas?
            </h4>
            <p className="text-xs text-[#8FAEA2]">
              Entre em contato direto com a equipe da <strong className="text-white">{agency.name}</strong> para alinhamentos estratégicos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleWhatsAppSupport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 rounded-xl gap-2 shadow-lg"
            >
              <Phone className="w-4 h-4" />
              WhatsApp da Agência
            </Button>
            {agency.email && (
              <a
                href={`mailto:${agency.email}?subject=Contato%20Portal%20do%20Cliente`}
                className="inline-flex items-center gap-2 border border-white/10 hover:bg-white/5 text-white px-4 h-10 rounded-xl text-xs font-medium transition-colors"
              >
                <Mail className="w-4 h-4 text-[#DFC498]" />
                {agency.email}
              </a>
            )}
          </div>
        </div>
      </main>

      {/* REPORT DETAILS MODAL */}
      <Dialog open={!!selectedReport} onOpenChange={open => !open && setSelectedReport(null)}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs text-[#DFC498] font-mono">
              <Calendar className="w-3.5 h-3.5" />
              {selectedReport?.period}
              {selectedReport?.gmbMetrics?.rankingPosition && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] ml-auto font-bold flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  Top #{selectedReport.gmbMetrics.rankingPosition} no Google Maps
                </Badge>
              )}
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              {selectedReport?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Publicado em {selectedReport?.publishedAt ? new Date(selectedReport.publishedAt).toLocaleDateString('pt-BR') : 'Data recente'}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <h5 className="text-xs font-semibold text-[#DFC498] uppercase tracking-wider">Resumo Executivo</h5>
                <p className="text-xs text-[#8FAEA2] leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                  {selectedReport.summary || 'Nenhum detalhe adicional informado.'}
                </p>
              </div>

              {/* DEDICATED GOOGLE MEU NEGÓCIO & LOCAL SEO SECTION */}
              {selectedReport.gmbMetrics && (
                <div className="space-y-3 bg-[#04140F]/90 p-3.5 rounded-xl border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white">Google Meu Negócio & Busca Local</h5>
                        <p className="text-[11px] text-[#8FAEA2]">Métricas auditadas de presença e atração no Google</p>
                      </div>
                    </div>
                    {selectedReport.gmbMetrics.rankingPosition && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-2.5 py-0.5 font-bold">
                        Rank #{selectedReport.gmbMetrics.rankingPosition}
                      </Badge>
                    )}
                  </div>

                  {selectedReport.gmbMetrics.targetKeyword && (
                    <div className="text-xs text-[#8FAEA2] bg-black/40 px-3 py-2 rounded-lg border border-white/5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-[#DFC498]" /> Palavra-chave Monitorada:
                      </span>
                      <strong className="text-white font-mono">{selectedReport.gmbMetrics.targetKeyword}</strong>
                    </div>
                  )}

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[10px] text-[#8FAEA2] block flex items-center justify-center gap-1">
                        <Navigation className="w-3 h-3 text-emerald-400" /> Rotas
                      </span>
                      <span className="text-base font-bold text-white">
                        {selectedReport.gmbMetrics.directionRequests?.toLocaleString('pt-BR') || 0}
                      </span>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[10px] text-[#8FAEA2] block flex items-center justify-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" /> Ligações
                      </span>
                      <span className="text-base font-bold text-white">
                        {selectedReport.gmbMetrics.calls?.toLocaleString('pt-BR') || 0}
                      </span>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[10px] text-[#8FAEA2] block flex items-center justify-center gap-1">
                        <ExternalLink className="w-3 h-3 text-emerald-400" /> Cliques Site/Wpp
                      </span>
                      <span className="text-base font-bold text-white">
                        {selectedReport.gmbMetrics.websiteClicks?.toLocaleString('pt-BR') || 0}
                      </span>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[10px] text-[#8FAEA2] block flex items-center justify-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" /> Avaliações
                      </span>
                      <span className="text-base font-bold text-amber-400">
                        {selectedReport.gmbMetrics.rating || 5.0} ★ <span className="text-[10px] text-[#8FAEA2] font-normal">({selectedReport.gmbMetrics.reviewsCount || 0})</span>
                      </span>
                    </div>
                  </div>

                  {/* Impressions Breakdown */}
                  {(selectedReport.gmbMetrics.mapsImpressions || selectedReport.gmbMetrics.searchImpressions) && (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[#8FAEA2]">Impressões no Maps:</span>
                        <span className="font-semibold text-white">{selectedReport.gmbMetrics.mapsImpressions?.toLocaleString('pt-BR') || 0}</span>
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[#8FAEA2]">Impressões na Busca:</span>
                        <span className="font-semibold text-white">{selectedReport.gmbMetrics.searchImpressions?.toLocaleString('pt-BR') || 0}</span>
                      </div>
                    </div>
                  )}

                  {/* Search Queries Pills */}
                  {selectedReport.gmbMetrics.topKeywords && selectedReport.gmbMetrics.topKeywords.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-[#8FAEA2] flex items-center gap-1">
                        <Search className="w-3 h-3 text-[#DFC498]" /> Termos Mais Pesquisados no Google:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedReport.gmbMetrics.topKeywords.map((item, i) => {
                          const query = typeof item === 'string' ? item : item.keyword;
                          const count = typeof item === 'object' ? item.count : undefined;
                          return (
                            <Badge key={i} className="bg-white/5 hover:bg-white/10 text-[#8FAEA2] text-[11px] font-normal border-white/10 flex items-center gap-1">
                              <span>{query}</span>
                              {count ? <span className="text-[10px] text-emerald-400 font-mono">({count}x)</span> : null}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* GENERAL / META ADS KPI GRID */}
              <div className="space-y-1.5">
                <h5 className="text-xs font-semibold text-[#DFC498] uppercase tracking-wider">Métricas Gerais & Financeiras</h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] text-[#8FAEA2] block">Leads</span>
                    <span className="text-sm font-bold text-white">{selectedReport.metrics?.leads || 0}</span>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] text-[#8FAEA2] block">Alcance</span>
                    <span className="text-sm font-bold text-white">{selectedReport.metrics?.reach?.toLocaleString('pt-BR') || 0}</span>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] text-[#8FAEA2] block">Conversões</span>
                    <span className="text-sm font-bold text-white">{selectedReport.metrics?.conversions || 0}</span>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] text-[#8FAEA2] block">Investimento</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(selectedReport.metrics?.investment || 0)}</span>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] text-[#8FAEA2] block">Faturamento</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(selectedReport.metrics?.revenue || 0)}</span>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] text-[#8FAEA2] block">ROAS</span>
                    <span className="text-sm font-bold text-emerald-400">{selectedReport.metrics?.roas || 0}x</span>
                  </div>
                </div>
              </div>

              {selectedReport.externalUrl && (
                <Button
                  onClick={() => window.open(selectedReport.externalUrl, '_blank')}
                  className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold rounded-xl h-10 gap-2 shadow"
                >
                  <ExternalLink className="w-4 h-4" /> Acessar Painel Looker Studio / Apresentação
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CONTRACT DETAILS MODAL */}
      <Dialog open={!!selectedContract} onOpenChange={open => !open && setSelectedContract(null)}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Status: {selectedContract?.status === 'active' ? 'Ativo & Homologado' : selectedContract?.status}
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              {selectedContract?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Vigência a partir de {selectedContract?.startDate}
            </DialogDescription>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <h5 className="text-xs font-semibold text-[#DFC498] uppercase tracking-wider">Escopo dos Serviços</h5>
                <p className="text-xs text-[#8FAEA2] leading-relaxed bg-black/20 p-3.5 rounded-xl border border-white/5 whitespace-pre-line">
                  {selectedContract.scope || 'Serviços continuados de gestão estratégica de marketing.'}
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8FAEA2]">Honorários / Fee Mensal:</span>
                  <span className="font-bold text-white">{formatCurrency(selectedContract.monthlyValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8FAEA2]">Forma de Cobrança:</span>
                  <span className="text-[#DFC498] font-medium">{selectedContract.paymentTerms || 'Mensal'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8FAEA2]">Término / Renovação:</span>
                  <span className="text-white">{selectedContract.endDate || 'Indeterminado'}</span>
                </div>
              </div>

              {selectedContract.signedDocumentUrl && (
                <Button
                  onClick={() => window.open(selectedContract.signedDocumentUrl, '_blank')}
                  className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold rounded-xl h-10 gap-2 shadow"
                >
                  <Download className="w-4 h-4" /> Baixar Cópia Oficial Assinada
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Kanban,
  Megaphone,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { OperationType, reportFirestoreListenerError } from '@/lib/firestoreError';
import type {
  Appointment,
  Client,
  CrmAttendant,
  CrmCampaign,
  CrmCampaignDispatch,
  CrmConversation,
  CrmOpportunity,
  CrmQuickReply,
  CrmSettings,
} from '@/types';
import {
  DEFAULT_CRM_CAMPAIGNS,
  DEFAULT_CRM_SETTINGS,
  subscribeCrmAttendants,
  subscribeCrmCampaignDispatches,
  subscribeCrmCampaigns,
  subscribeCrmConversations,
  subscribeCrmOpportunities,
  subscribeCrmQuickReplies,
  subscribeCrmSettings,
} from '@/services/crmService';
import { CrmInboxView } from '@/components/crmHub/CrmInboxView';
import { CrmFunnelBoard } from '@/components/crmHub/CrmFunnelBoard';
import { CrmCampaignsView } from '@/components/crmHub/CrmCampaignsView';
import { CrmAnalyticsDashboard } from '@/components/crmHub/CrmAnalyticsDashboard';
import { CrmTeamAndSettingsView } from '@/components/crmHub/CrmTeamAndSettingsView';
import ClientDetailsDrawer from '@/components/crm/ClientDetailsDrawer';

type CrmHubTab = 'inbox' | 'funnel' | 'campaigns' | 'analytics' | 'settings';

interface ProfDoc {
  id: string;
  name: string;
  email?: string;
  userId?: string;
}

export default function CrmHubPage() {
  const { salonData, currentUser, userData } = useAuth();
  const salonId = salonData?.id || '';
  const userRole = userData?.role || 'professional';
  const currentUserName =
    userData?.fullName || currentUser?.displayName || currentUser?.email || 'Equipe';

  const [activeTab, setActiveTab] = useState<CrmHubTab>('inbox');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<CrmConversation[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [campaigns, setCampaigns] = useState<CrmCampaign[]>(
    DEFAULT_CRM_CAMPAIGNS.map((c) => ({ ...c, createdAt: 0, updatedAt: 0 }))
  );
  const [dispatches, setDispatches] = useState<CrmCampaignDispatch[]>([]);
  const [quickReplies, setQuickReplies] = useState<CrmQuickReply[]>([]);
  const [attendants, setAttendants] = useState<CrmAttendant[]>([]);
  const [settings, setSettings] = useState<CrmSettings>(DEFAULT_CRM_SETTINGS);

  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<ProfDoc[]>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string; price: number }>>([]);

  // Embedded ClientDetailsDrawer for unified 360° flow (zero tab switching)
  const [drawerClient, setDrawerClient] = useState<Client | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!salonId) return;

    const unsubConvs = subscribeCrmConversations(salonId, setConversations);
    const unsubOpps = subscribeCrmOpportunities(salonId, setOpportunities);
    const unsubCamps = subscribeCrmCampaigns(salonId, setCampaigns);
    const unsubDisp = subscribeCrmCampaignDispatches(salonId, setDispatches);
    const unsubQr = subscribeCrmQuickReplies(salonId, setQuickReplies);
    const unsubAtts = subscribeCrmAttendants(salonId, setAttendants);
    const unsubSet = subscribeCrmSettings(salonId, setSettings);

    const unsubClients = onSnapshot(
      query(collection(db, `salons/${salonId}/clients`)),
      (snap) => {
        const list: Client[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Client));
        setClients(list);
      },
      (err) => reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/clients`)
    );

    const unsubAppts = onSnapshot(
      query(collection(db, `salons/${salonId}/appointments`)),
      (snap) => {
        const list: Appointment[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Appointment));
        setAppointments(list);
      },
      (err) =>
        reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/appointments`)
    );

    const unsubProfs = onSnapshot(
      query(collection(db, `salons/${salonId}/professionals`)),
      (snap) => {
        const list: ProfDoc[] = [];
        snap.forEach((d) => {
          const data = d.data() as { name?: string; email?: string; userId?: string };
          list.push({
            id: d.id,
            name: data.name || 'Profissional',
            email: data.email,
            userId: data.userId,
          });
        });
        setProfessionals(list);
      },
      (err) =>
        reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/professionals`)
    );

    const unsubServices = onSnapshot(
      query(collection(db, `salons/${salonId}/services`)),
      (snap) => {
        const list: Array<{ id: string; name: string; price: number }> = [];
        snap.forEach((d) => {
          const data = d.data() as { name?: string; price?: number };
          list.push({ id: d.id, name: data.name || 'Serviço', price: Number(data.price || 0) });
        });
        setServices(list);
      },
      (err) => reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/services`)
    );

    return () => {
      unsubConvs();
      unsubOpps();
      unsubCamps();
      unsubDisp();
      unsubQr();
      unsubAtts();
      unsubSet();
      unsubClients();
      unsubAppts();
      unsubProfs();
      unsubServices();
    };
  }, [salonId]);

  const unreadCount = useMemo(
    () => conversations.filter((c) => c.unreadCount > 0 || c.status === 'awaiting_reply').length,
    [conversations]
  );

  const canDeleteCards = useMemo(() => {
    if (['owner', 'admin', 'manager', 'platform_admin'].includes(userRole)) return true;
    const att = attendants.find((a) => a.userId === currentUser?.uid || a.id === currentUser?.uid);
    return Boolean(att?.canDeleteCards);
  }, [userRole, attendants, currentUser?.uid]);

  const handleJumpToConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setActiveTab('inbox');
  };

  const handleOpenOpportunityFromInbox = (opportunityId: string) => {
    setSelectedOpportunityId(opportunityId);
    setActiveTab('funnel');
  };

  if (!salonId) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Carregando ambiente do CRM 360°...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho Unificado Lumière CRM 360° */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-heading font-semibold text-foreground tracking-tight">
            Lumière CRM 360°
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Atendimento WhatsApp, funil de vendas, campanhas e inteligência comercial nativos no mesmo painel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Navigation */}
          <div className="flex flex-wrap items-center gap-1 bg-secondary p-1 rounded-xl border border-border">
            {(
              [
                {
                  id: 'inbox',
                  label: 'Inbox WhatsApp',
                  icon: MessageSquare,
                  badge: unreadCount > 0 ? unreadCount : null,
                },
                {
                  id: 'funnel',
                  label: 'Funil de Vendas',
                  icon: Kanban,
                  badge: null,
                },
                {
                  id: 'campaigns',
                  label: 'Campanhas',
                  icon: Megaphone,
                  badge: null,
                },
                {
                  id: 'analytics',
                  label: 'Painéis',
                  icon: BarChart3,
                  badge: null,
                },
                {
                  id: 'settings',
                  label: 'Equipe & IA',
                  icon: Settings,
                  badge: null,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === t.id
                    ? 'bg-card text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <t.icon className="w-3.5 h-3.5 text-[#9F844A]" />
                <span>{t.label}</span>
                {t.badge !== null && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded bg-[#171717] text-white text-[10px] font-semibold tabular-nums leading-none">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Link
            to="/dashboard/clientes"
            className="h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-[#9F844A]" />
            Base de Clientes &amp; Fichas
          </Link>
        </div>
      </div>

      {/* Conteúdo das abas */}
      {activeTab === 'inbox' && (
        <CrmInboxView
          salonId={salonId}
          salonName={salonData?.name || 'Lumière Atelier'}
          currentUserUid={currentUser?.uid || ''}
          currentUserName={currentUserName}
          conversations={conversations}
          opportunities={opportunities}
          clients={clients}
          appointments={appointments}
          quickReplies={quickReplies}
          attendants={attendants}
          settings={settings}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onOpenClientDrawer={(client) => {
            setDrawerClient(client);
            setIsDrawerOpen(true);
          }}
          onOpenOpportunityModal={handleOpenOpportunityFromInbox}
        />
      )}

      {activeTab === 'funnel' && (
        <CrmFunnelBoard
          salonId={salonId}
          currentUserUid={currentUser?.uid || ''}
          currentUserName={currentUserName}
          canDeleteCards={canDeleteCards}
          opportunities={opportunities}
          conversations={conversations}
          clients={clients}
          appointments={appointments}
          attendants={attendants}
          settings={settings}
          selectedOpportunityId={selectedOpportunityId}
          onSelectOpportunity={setSelectedOpportunityId}
          onJumpToConversation={handleJumpToConversation}
        />
      )}

      {activeTab === 'campaigns' && (
        <CrmCampaignsView
          salonId={salonId}
          salonName={salonData?.name || 'Lumière Atelier'}
          campaigns={campaigns}
          dispatches={dispatches}
          clients={clients}
          appointments={appointments}
        />
      )}

      {activeTab === 'analytics' && (
        <CrmAnalyticsDashboard
          opportunities={opportunities}
          conversations={conversations}
          attendants={attendants}
          onJumpToConversation={handleJumpToConversation}
        />
      )}

      {activeTab === 'settings' && (
        <CrmTeamAndSettingsView
          salonId={salonId}
          currentUserUid={currentUser?.uid || ''}
          currentUserName={currentUserName}
          attendants={attendants}
          quickReplies={quickReplies}
          settings={settings}
          professionals={professionals}
        />
      )}

      {/* Drawer integrado do cliente (Anamnese, Prontuário, Histórico e Agendamento Rápido) */}
      <ClientDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        client={drawerClient}
        salonId={salonId}
        currentUser={currentUser}
        userRole={userRole}
        professionals={professionals}
        services={services}
        onClientUpdated={() => {}}
      />
    </div>
  );
}

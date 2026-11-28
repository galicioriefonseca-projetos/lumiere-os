import React, { useEffect, useState } from 'react';
import { BarChart3, CalendarCheck2, Megaphone, Settings, Sparkles } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { OperationType, reportFirestoreListenerError } from '@/lib/firestoreError';
import { useLumi } from '@/lumi/hooks/useLumi';
import type {
  Appointment,
  Client,
  CrmCampaign,
  CrmCampaignDispatch,
  CrmConversation,
  CrmOpportunity,
  CrmSettings,
  Service,
} from '@/types';
import {
  DEFAULT_CRM_CAMPAIGNS,
  DEFAULT_CRM_SETTINGS,
  subscribeCrmCampaignDispatches,
  subscribeCrmCampaigns,
  subscribeCrmConversations,
  subscribeCrmOpportunities,
  subscribeCrmSettings,
} from '@/services/crmService';
import { LumiAiOverviewPanel } from '@/components/lumiAi/LumiAiOverviewPanel';
import { LumiAiMarketingPanel } from '@/components/lumiAi/LumiAiMarketingPanel';
import { LumiAiSchedulingPanel } from '@/components/lumiAi/LumiAiSchedulingPanel';
import { LumiAiPolicyPanel } from '@/components/lumiAi/LumiAiPolicyPanel';

type LumiSection = 'overview' | 'marketing' | 'scheduling' | 'policy';

const SECTIONS = [
  { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { id: 'marketing', label: 'Marketing & Promoções', icon: Megaphone },
  { id: 'scheduling', label: 'Agendamento', icon: CalendarCheck2 },
  { id: 'policy', label: 'Configurações', icon: Settings },
] as const;

export default function LumiAiPage() {
  const { salonData, userData } = useAuth();
  const salonId = salonData?.id || '';
  const salonName = salonData?.name || 'Nosso Salão';
  const userRole = userData?.role || '';
  const canOperate = ['owner', 'admin', 'manager', 'receptionist', 'attendant', 'platform_admin'].includes(
    userRole
  );

  const { healthScore } = useLumi(salonId || undefined);

  const [section, setSection] = useState<LumiSection>('overview');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [campaigns, setCampaigns] = useState<CrmCampaign[]>(
    DEFAULT_CRM_CAMPAIGNS.map((c) => ({ ...c, createdAt: 0, updatedAt: 0 }))
  );
  const [dispatches, setDispatches] = useState<CrmCampaignDispatch[]>([]);
  const [conversations, setConversations] = useState<CrmConversation[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [settings, setSettings] = useState<CrmSettings>(DEFAULT_CRM_SETTINGS);

  useEffect(() => {
    if (!salonId || !canOperate) return;

    const unsubs: Array<() => void> = [
      subscribeCrmCampaigns(salonId, setCampaigns),
      subscribeCrmCampaignDispatches(salonId, setDispatches),
      subscribeCrmConversations(salonId, setConversations),
      subscribeCrmOpportunities(salonId, setOpportunities),
      subscribeCrmSettings(salonId, setSettings),
      onSnapshot(
        query(collection(db, `salons/${salonId}/appointments`)),
        (snap) => {
          const list: Appointment[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Appointment));
          setAppointments(list);
        },
        (err) =>
          reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/appointments`)
      ),
      onSnapshot(
        query(collection(db, `salons/${salonId}/clients`)),
        (snap) => {
          const list: Client[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Client));
          setClients(list);
        },
        (err) => reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/clients`)
      ),
      onSnapshot(
        query(collection(db, `salons/${salonId}/services`)),
        (snap) => {
          const list: Service[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Service));
          setServices(list);
        },
        (err) => reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/services`)
      ),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [salonId, canOperate]);

  if (!canOperate) {
    return (
      <div className="bg-white border border-[#E5E2DC] rounded-2xl p-8 text-center">
        <p className="text-sm font-medium text-[#171717]">
          Acesso exclusivo para gestão, recepção e atendimento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E2DC] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F5F1E9] border border-[#D8C79F] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#8A6D36]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#171717] font-heading tracking-tight">
              Central Lumi IA
            </h1>
            <p className="text-xs text-[#6B6B6B]">
              Automações inteligentes, campanhas de marketing, confirmações e agenda autônoma no WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile horizontal sub-navigation */}
      <div className="lg:hidden bg-white border border-[#E5E2DC] rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {SECTIONS.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors min-h-[40px] ${
                active
                  ? 'bg-[#171717] text-white'
                  : 'text-[#6B6B6B] hover:text-[#171717] hover:bg-[#FAF9F7]'
              }`}
            >
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Desktop 2-column Atelier Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <nav className="hidden lg:flex lg:col-span-3 flex-col bg-white border border-[#E5E2DC] rounded-2xl p-2 space-y-1 sticky top-24">
          {SECTIONS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition-colors text-left min-h-[42px] ${
                  active
                    ? 'bg-[#171717] text-white'
                    : 'text-[#6B6B6B] hover:text-[#171717] hover:bg-[#FAF9F7]'
                }`}
              >
                <item.icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-[#D8C79F]' : 'text-[#8A6D36]'}`}
                />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="lg:col-span-9 min-w-0">
          {section === 'overview' && (
            <LumiAiOverviewPanel
              appointments={appointments}
              clients={clients}
              services={services}
              campaigns={campaigns}
              dispatches={dispatches}
              conversations={conversations}
              opportunities={opportunities}
              healthScoreValue={healthScore?.score ?? null}
              onJumpToSection={(target) => setSection(target)}
            />
          )}

          {section === 'marketing' && (
            <LumiAiMarketingPanel
              salonId={salonId}
              salonName={salonName}
              campaigns={campaigns}
              clients={clients}
              appointments={appointments}
              services={services}
              settings={settings}
            />
          )}

          {section === 'scheduling' && (
            <LumiAiSchedulingPanel
              salonId={salonId}
              salonName={salonName}
              campaigns={campaigns}
              settings={settings}
              clients={clients}
              appointments={appointments}
            />
          )}

          {section === 'policy' && (
            <LumiAiPolicyPanel salonId={salonId} settings={settings} />
          )}
        </div>
      </div>
    </div>
  );
}

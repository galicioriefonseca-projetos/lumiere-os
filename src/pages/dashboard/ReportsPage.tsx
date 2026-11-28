import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { BarChart3, Flame, LayoutDashboard, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { OperationType, reportFirestoreListenerError } from '@/lib/firestoreError';
import {
  REPORTS_CATALOG,
  resolveDateWindow,
  type DashboardDatasetInput,
  type ReportPeriodFilter,
} from '@/services/reportsEngine';
import { GoogleSheetsSyncDialog } from '@/components/workspace/GoogleSheetsSyncDialog';
import type { SheetCellValue } from '@/services/googleWorkspaceService';
import { ReportsDashboardTab } from '@/components/reports/ReportsDashboardTab';
import { ReportsCatalogTab } from '@/components/reports/ReportsCatalogTab';
import { ReportsHeatmapTab } from '@/components/reports/ReportsHeatmapTab';
import type {
  Appointment,
  ChecklistRun,
  Client,
  CrmCampaignDispatch,
  FinancialTransaction,
  Professional,
  Service,
} from '@/types';

type ReportsTab = 'dashboard' | 'favorites' | 'todos' | 'heatmap';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ReportsPage() {
  const { salonData, userData, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportsTab>('dashboard');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<ChecklistRun[]>([]);
  const [dispatches, setDispatches] = useState<CrmCampaignDispatch[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const currentMonth = toYmd(today).slice(0, 7);
  const firstOfMonth = `${currentMonth}-01`;
  const todayYmd = toYmd(today);

  const [periodFilter, setPeriodFilter] = useState<ReportPeriodFilter>({
    mode: 'period',
    startDate: firstOfMonth,
    endDate: todayYmd,
    month: currentMonth,
    day: todayYmd,
    comparePrevious: true,
  });

  const resolvedWindow = useMemo(() => resolveDateWindow(periodFilter), [periodFilter]);

  const storageKey = useMemo(() => {
    if (!salonData?.id || !currentUser?.uid) return null;
    return `lumiere_favorite_reports_${salonData.id}_${currentUser.uid}`;
  }, [salonData?.id, currentUser?.uid]);

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>(() =>
    REPORTS_CATALOG.filter((r) => r.defaultFavorite).map((r) => r.code)
  );

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavoriteCodes(parsed.filter((v): v is string => typeof v === 'string'));
          return;
        }
      }
      setFavoriteCodes(REPORTS_CATALOG.filter((r) => r.defaultFavorite).map((r) => r.code));
    } catch {
      // ignore localStorage read failure
    }
  }, [storageKey]);

  const handleToggleFavorite = (code: string) => {
    setFavoriteCodes((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
      }
      return next;
    });
  };

  const [sheetsPayload, setSheetsPayload] = useState<{
    open: boolean;
    title: string;
    tabTitle: string;
    datasetLabel: string;
    headers: string[];
    rows: SheetCellValue[][];
  }>({
    open: false,
    title: '',
    tabTitle: 'Relatório',
    datasetLabel: '',
    headers: [],
    rows: [],
  });

  const canManageSalon = useMemo(() => {
    const role = userData?.role;
    return role === 'owner' || role === 'manager' || role === 'platform_admin';
  }, [userData?.role]);

  useEffect(() => {
    if (!salonData?.id || !currentUser?.uid) {
      setAppointments([]);
      setClients([]);
      setProfessionals([]);
      setServices([]);
      setFinancialTransactions([]);
      setChecklistRuns([]);
      setDispatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const salonId = salonData.id;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, `salons/${salonId}/appointments`)),
        (snap) => {
          const items: Appointment[] = [];
          snap.forEach((d) => items.push({ id: d.id, ...d.data() } as Appointment));
          setAppointments(items);
        },
        (err) =>
          reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/appointments`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, `salons/${salonId}/clients`)),
        (snap) => {
          const items: Client[] = [];
          snap.forEach((d) => items.push({ id: d.id, ...d.data() } as Client));
          setClients(items);
        },
        (err) => reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/clients`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, `salons/${salonId}/professionals`)),
        (snap) => {
          const items: Professional[] = [];
          snap.forEach((d) => items.push({ id: d.id, ...d.data() } as Professional));
          setProfessionals(items.filter((p) => p.isActive !== false));
        },
        (err) =>
          reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/professionals`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, `salons/${salonId}/services`)),
        (snap) => {
          const items: Service[] = [];
          snap.forEach((d) => items.push({ id: d.id, ...d.data() } as Service));
          setServices(items);
        },
        (err) => reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/services`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, `salons/${salonId}/checklistRuns`)),
        (snap) => {
          const items: ChecklistRun[] = [];
          snap.forEach((d) => items.push({ id: d.id, ...d.data() } as ChecklistRun));
          setChecklistRuns(items);
        },
        (err) =>
          reportFirestoreListenerError(err, OperationType.LIST, `salons/${salonId}/checklistRuns`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, `salons/${salonId}/crmCampaignDispatches`)),
        (snap) => {
          const items: CrmCampaignDispatch[] = [];
          snap.forEach((d) => items.push({ id: d.id, ...d.data() } as CrmCampaignDispatch));
          setDispatches(items);
        },
        (err) =>
          reportFirestoreListenerError(
            err,
            OperationType.LIST,
            `salons/${salonId}/crmCampaignDispatches`
          )
      )
    );

    if (canManageSalon) {
      unsubs.push(
        onSnapshot(
          query(collection(db, `salons/${salonId}/financialTransactions`)),
          (snap) => {
            const items: FinancialTransaction[] = [];
            snap.forEach((d) => items.push({ id: d.id, ...d.data() } as FinancialTransaction));
            setFinancialTransactions(items);
          },
          (err) =>
            reportFirestoreListenerError(
              err,
              OperationType.LIST,
              `salons/${salonId}/financialTransactions`
            )
        )
      );
    }

    const timer = setTimeout(() => setLoading(false), 650);
    return () => {
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [salonData?.id, currentUser?.uid, canManageSalon]);

  const dataset: DashboardDatasetInput = useMemo(
    () => ({
      appointments,
      clients,
      professionals,
      services,
      financialTransactions,
      checklistRuns,
      dispatches,
    }),
    [
      appointments,
      clients,
      professionals,
      services,
      financialTransactions,
      checklistRuns,
      dispatches,
    ]
  );

  const openSheets = (payload: {
    title: string;
    tabTitle: string;
    datasetLabel: string;
    headers: string[];
    rows: SheetCellValue[][];
  }) => {
    setSheetsPayload({ ...payload, open: true });
  };

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center bg-[#F6F5F2]">
        <div className="h-8 w-8 rounded-full border-2 border-[#E5E2DC] border-t-[#8A6D36] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#171717] pb-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E2DC] pb-5">
          <div>
            <p className="text-xs font-medium text-[#8A6D36]">
              {salonData?.name || 'LumièreOS'} · Inteligência &amp; BI
            </p>
            <h1 className="text-2xl md:text-3xl font-bold font-heading text-[#171717] mt-1">
              Relatórios Executivos 360°
            </h1>
            <p className="text-sm text-[#4A4A4A] mt-1">
              Comparativo de períodos, catálogo operacional completo, mapa de calor de ocupação e exportação em um clique.
            </p>
          </div>
        </header>

        {/* Primary Tab Bar */}
        <nav
          aria-label="Navegação de relatórios"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E5E2DC]"
        >
          {(
            [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'favorites', label: `Favoritos (${favoriteCodes.length})`, icon: Star },
              { id: 'todos', label: `Todos (${REPORTS_CATALOG.length})`, icon: BarChart3 },
              { id: 'heatmap', label: 'Mapa de Calor', icon: Flame },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 h-10 px-4 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#8A6D36] bg-white text-[#171717]'
                    : 'border-transparent text-[#4A4A4A] hover:text-[#171717]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#8A6D36]' : 'text-[#6B6B6B]'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Active Tab Content */}
        {activeTab === 'dashboard' && (
          <ReportsDashboardTab
            salonName={salonData?.name || 'LumièreOS'}
            data={dataset}
            filter={periodFilter}
            onChangeFilter={setPeriodFilter}
            onOpenSheetsExport={openSheets}
          />
        )}

        {(activeTab === 'favorites' || activeTab === 'todos') && (
          <ReportsCatalogTab
            mode={activeTab === 'favorites' ? 'favorites' : 'todos'}
            favoriteCodes={favoriteCodes}
            onToggleFavorite={handleToggleFavorite}
            data={dataset}
            defaultStartDate={resolvedWindow.startYmd}
            defaultEndDate={resolvedWindow.endYmd}
            salonName={salonData?.name || 'LumièreOS'}
            onOpenSheetsExport={openSheets}
          />
        )}

        {activeTab === 'heatmap' && (
          <ReportsHeatmapTab
            appointments={appointments}
            professionals={professionals}
            services={services}
            defaultStartDate={resolvedWindow.startYmd}
            defaultEndDate={resolvedWindow.endYmd}
          />
        )}
      </div>

      <GoogleSheetsSyncDialog
        open={sheetsPayload.open}
        onOpenChange={(open) => setSheetsPayload((prev) => ({ ...prev, open }))}
        defaultSpreadsheetTitle={sheetsPayload.title || `Relatório ${salonData?.name || 'LumièreOS'}`}
        defaultSheetTabTitle={sheetsPayload.tabTitle}
        datasetLabel={sheetsPayload.datasetLabel || 'Relatório'}
        headers={sheetsPayload.headers}
        rows={sheetsPayload.rows}
      />
    </div>
  );
}

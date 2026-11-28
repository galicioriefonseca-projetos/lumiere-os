import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBRL } from '@/lib/utils';
import type {
  Appointment,
  ChecklistRun,
  Client,
  CrmCampaignDispatch,
  FinancialTransaction,
  Professional,
  Service,
} from '@/types';

export type PeriodFilterMode = 'period' | 'month' | 'day';

export interface ReportPeriodFilter {
  mode: PeriodFilterMode;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  month: string;     // YYYY-MM
  day: string;       // YYYY-MM-DD
  comparePrevious: boolean;
}

export interface ResolvedDateWindow {
  startYmd: string;
  endYmd: string;
  prevStartYmd: string;
  prevEndYmd: string;
  label: string;
  prevLabel: string;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateBr(ymd: string): string {
  if (!ymd || ymd.length < 10) return ymd || '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatMonthFullPt(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split('-');
  const names = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${names[Math.max(0, Number(m) - 1)] || m} de ${y}`;
}

export function resolveDateWindow(filter: ReportPeriodFilter): ResolvedDateWindow {
  const today = new Date();
  let startYmd = filter.startDate || toYmd(new Date(today.getFullYear(), today.getMonth(), 1));
  let endYmd = filter.endDate || toYmd(today);

  if (filter.mode === 'month') {
    const ym = filter.month || toYmd(today).slice(0, 7);
    const [yStr, mStr] = ym.split('-');
    const year = Number(yStr) || today.getFullYear();
    const monthIdx = Math.max(0, (Number(mStr) || 1) - 1);
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();
    startYmd = `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;
    endYmd = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else if (filter.mode === 'day') {
    const d = filter.day || toYmd(today);
    startYmd = d;
    endYmd = d;
  }

  if (startYmd > endYmd) {
    const tmp = startYmd;
    startYmd = endYmd;
    endYmd = tmp;
  }

  const startMs = new Date(`${startYmd}T12:00:00`).getTime();
  const endMs = new Date(`${endYmd}T12:00:00`).getTime();
  const spanDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

  const prevEndDate = new Date(startMs - 86400000);
  const prevStartDate = new Date(prevEndDate.getTime() - (spanDays - 1) * 86400000);
  const prevStartYmd = toYmd(prevStartDate);
  const prevEndYmd = toYmd(prevEndDate);

  const label =
    filter.mode === 'month'
      ? formatMonthFullPt(filter.month)
      : startYmd === endYmd
        ? formatDateBr(startYmd)
        : `${formatDateBr(startYmd)} a ${formatDateBr(endYmd)}`;

  const prevLabel =
    prevStartYmd === prevEndYmd
      ? formatDateBr(prevStartYmd)
      : `${formatDateBr(prevStartYmd)} a ${formatDateBr(prevEndYmd)}`;

  return { startYmd, endYmd, prevStartYmd, prevEndYmd, label, prevLabel };
}

function getApptPrice(appt: Appointment, servicesMap: Map<string, Service>): number {
  if (typeof appt.price === 'number' && !Number.isNaN(appt.price)) return appt.price;
  const svc = servicesMap.get(appt.serviceId);
  return svc ? Number(svc.price || 0) : 0;
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const ORIGIN_LABELS: Record<string, string> = {
  instagram: 'Instagram / Redes',
  google: 'Google / Maps',
  indication: 'Indicação',
  whatsapp: 'WhatsApp Direto',
  walk_in: 'Passagem / Vitrine',
  other: 'Outros',
};

export interface DashboardDatasetInput {
  appointments: Appointment[];
  clients: Client[];
  professionals: Professional[];
  services: Service[];
  financialTransactions: FinancialTransaction[];
  checklistRuns: ChecklistRun[];
  dispatches: CrmCampaignDispatch[];
}

export interface DashboardMetricsResult {
  window: ResolvedDateWindow;
  totalRevenue: number;
  completedCount: number;
  canceledCount: number;
  attendedClientsCount: number;
  averageTicket: number;
  prevTotalRevenue: number;
  prevCompletedCount: number;
  prevCanceledCount: number;
  prevAttendedClientsCount: number;
  prevAverageTicket: number;
  revenueDeltaPct: number | null;
  completedDeltaPct: number | null;
  canceledDeltaPct: number | null;
  clientsDeltaPct: number | null;
  ticketDeltaPct: number | null;
  evolutionSeries: Array<{
    label: string;
    faturamento: number;
    anterior: number;
    atendimentos: number;
  }>;
  originsBreakdown: Array<{ name: string; count: number; pct: number }>;
  ageBrackets: Array<{ name: string; count: number; pct: number }>;
  ageUnknownCount: number;
  bestClients: Array<{
    clientId: string;
    name: string;
    phone: string;
    visits: number;
    revenue: number;
    avgTicket: number;
  }>;
  professionalStats: Array<{
    id: string;
    name: string;
    role: string;
    count: number;
    canceledCount: number;
    revenue: number;
    avgTicket: number;
    sharePct: number;
  }>;
  topServices: Array<{
    id: string;
    name: string;
    category: string;
    count: number;
    revenue: number;
  }>;
  evaluationMetrics: {
    checklistCount: number;
    avgChecklistPct: number;
    csatCount: number;
    avgCsatRating: number;
  };
}

export function computeReportsDashboard(
  data: DashboardDatasetInput,
  filter: ReportPeriodFilter
): DashboardMetricsResult {
  const window = resolveDateWindow(filter);
  const servicesMap = new Map(data.services.map((s) => [s.id, s]));
  const clientsMap = new Map(data.clients.map((c) => [c.id, c]));

  const validAppts = data.appointments.filter((a) => !a.isBlock && Boolean(a.date));

  const currentAppts = validAppts.filter(
    (a) => a.date >= window.startYmd && a.date <= window.endYmd
  );
  const previousAppts = validAppts.filter(
    (a) => a.date >= window.prevStartYmd && a.date <= window.prevEndYmd
  );

  const currentCompleted = currentAppts.filter((a) => a.status === 'completed');
  const prevCompleted = previousAppts.filter((a) => a.status === 'completed');

  const currentCanceled = currentAppts.filter(
    (a) => a.status === 'canceled' || a.status === 'no_show'
  );
  const prevCanceled = previousAppts.filter(
    (a) => a.status === 'canceled' || a.status === 'no_show'
  );

  const totalRevenue = currentCompleted.reduce((acc, a) => acc + getApptPrice(a, servicesMap), 0);
  const prevTotalRevenue = prevCompleted.reduce((acc, a) => acc + getApptPrice(a, servicesMap), 0);

  const uniqueClientKeys = new Set(
    currentCompleted.map((a) => a.clientId || a.clientPhone || a.clientName).filter(Boolean)
  );
  const prevUniqueClientKeys = new Set(
    prevCompleted.map((a) => a.clientId || a.clientPhone || a.clientName).filter(Boolean)
  );

  const attendedClientsCount = uniqueClientKeys.size;
  const prevAttendedClientsCount = prevUniqueClientKeys.size;

  const completedCount = currentCompleted.length;
  const prevCompletedCount = prevCompleted.length;
  const canceledCount = currentCanceled.length;
  const prevCanceledCount = prevCanceled.length;

  const averageTicket = completedCount > 0 ? totalRevenue / completedCount : 0;
  const prevAverageTicket = prevCompletedCount > 0 ? prevTotalRevenue / prevCompletedCount : 0;

  // Evolution series (daily up to 45 days, monthly otherwise)
  const startMs = new Date(`${window.startYmd}T12:00:00`).getTime();
  const endMs = new Date(`${window.endYmd}T12:00:00`).getTime();
  const spanDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
  const groupByDay = spanDays <= 45;

  const evolutionSeries: DashboardMetricsResult['evolutionSeries'] = [];
  if (groupByDay) {
    const curByDate = new Map<string, { rev: number; cnt: number }>();
    currentCompleted.forEach((a) => {
      const slot = curByDate.get(a.date) || { rev: 0, cnt: 0 };
      slot.rev += getApptPrice(a, servicesMap);
      slot.cnt += 1;
      curByDate.set(a.date, slot);
    });
    const prevByOffset = new Map<number, number>();
    const prevStartMs = new Date(`${window.prevStartYmd}T12:00:00`).getTime();
    prevCompleted.forEach((a) => {
      const offset = Math.round(
        (new Date(`${a.date}T12:00:00`).getTime() - prevStartMs) / 86400000
      );
      prevByOffset.set(offset, (prevByOffset.get(offset) || 0) + getApptPrice(a, servicesMap));
    });

    for (let i = 0; i < spanDays; i++) {
      const ymd = toYmd(new Date(startMs + i * 86400000));
      const slot = curByDate.get(ymd) || { rev: 0, cnt: 0 };
      evolutionSeries.push({
        label: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`,
        faturamento: Math.round(slot.rev),
        anterior: Math.round(prevByOffset.get(i) || 0),
        atendimentos: slot.cnt,
      });
    }
  } else {
    const monthBuckets = new Map<string, { rev: number; cnt: number }>();
    currentCompleted.forEach((a) => {
      const ym = a.date.slice(0, 7);
      const slot = monthBuckets.get(ym) || { rev: 0, cnt: 0 };
      slot.rev += getApptPrice(a, servicesMap);
      slot.cnt += 1;
      monthBuckets.set(ym, slot);
    });
    const prevMonthVals = Array.from(
      prevCompleted.reduce((acc, a) => {
        const ym = a.date.slice(0, 7);
        acc.set(ym, (acc.get(ym) || 0) + getApptPrice(a, servicesMap));
        return acc;
      }, new Map<string, number>()).values()
    );

    Array.from(monthBuckets.keys())
      .sort()
      .forEach((ym, idx) => {
        const slot = monthBuckets.get(ym)!;
        evolutionSeries.push({
          label: `${ym.slice(5, 7)}/${ym.slice(0, 4)}`,
          faturamento: Math.round(slot.rev),
          anterior: Math.round(prevMonthVals[idx] || 0),
          atendimentos: slot.cnt,
        });
      });
  }

  // Origins (based on clients attended in period, or newly created in period if no visits)
  const relevantClients = data.clients.filter((c) => {
    if (c.deletedAt || c.archived) return false;
    if (uniqueClientKeys.has(c.id)) return true;
    if (c.createdAt) {
      const cYmd = toYmd(new Date(c.createdAt));
      return cYmd >= window.startYmd && cYmd <= window.endYmd;
    }
    return false;
  });

  const originCounts = new Map<string, number>();
  relevantClients.forEach((c) => {
    const label =
      c.sourceLabel?.trim() ||
      (c.source && ORIGIN_LABELS[c.source]) ||
      'Não informado';
    originCounts.set(label, (originCounts.get(label) || 0) + 1);
  });
  const originTotal = Array.from(originCounts.values()).reduce((a, b) => a + b, 0);
  const originsBreakdown = Array.from(originCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      pct: originTotal > 0 ? Math.round((count / originTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Age brackets from active clients base (or attended clients)
  const activeClients = data.clients.filter((c) => !c.deletedAt && !c.archived);
  const bracketDefs = [
    { name: 'Até 15 anos', min: 0, max: 15 },
    { name: '16 a 25 anos', min: 16, max: 25 },
    { name: '26 a 35 anos', min: 26, max: 35 },
    { name: '36 a 45 anos', min: 36, max: 45 },
    { name: '46 a 60 anos', min: 46, max: 60 },
    { name: 'Acima de 60 anos', min: 61, max: 130 },
  ];
  const bracketCounts = bracketDefs.map((b) => ({ name: b.name, count: 0 }));
  let ageUnknownCount = 0;
  const nowYear = new Date().getFullYear();

  activeClients.forEach((c) => {
    if (!c.birthDate || c.birthDate.length < 4) {
      ageUnknownCount += 1;
      return;
    }
    const birthYear = parseInt(c.birthDate.slice(0, 4), 10);
    if (Number.isNaN(birthYear) || birthYear < 1900 || birthYear > nowYear) {
      ageUnknownCount += 1;
      return;
    }
    const age = nowYear - birthYear;
    const idx = bracketDefs.findIndex((b) => age >= b.min && age <= b.max);
    if (idx >= 0) bracketCounts[idx].count += 1;
    else ageUnknownCount += 1;
  });
  const knownAgeTotal = bracketCounts.reduce((acc, b) => acc + b.count, 0);
  const ageBrackets = bracketCounts.map((b) => ({
    name: b.name,
    count: b.count,
    pct: knownAgeTotal > 0 ? Math.round((b.count / knownAgeTotal) * 1000) / 10 : 0,
  }));

  // Best clients ranking
  const clientAgg = new Map<
    string,
    { clientId: string; name: string; phone: string; visits: number; revenue: number }
  >();
  currentCompleted.forEach((a) => {
    const key = a.clientId || a.clientName;
    if (!key) return;
    const cObj = a.clientId ? clientsMap.get(a.clientId) : undefined;
    const curr = clientAgg.get(key) || {
      clientId: a.clientId || '',
      name: cObj?.name || a.clientName || 'Cliente',
      phone: cObj?.phone || a.clientPhone || '',
      visits: 0,
      revenue: 0,
    };
    curr.visits += 1;
    curr.revenue += getApptPrice(a, servicesMap);
    clientAgg.set(key, curr);
  });
  const bestClients = Array.from(clientAgg.values())
    .map((c) => ({
      ...c,
      avgTicket: c.visits > 0 ? c.revenue / c.visits : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 25);

  // Professional stats
  const professionalStats = data.professionals
    .map((p) => {
      const pCompleted = currentCompleted.filter((a) => a.professionalId === p.id);
      const pCanceled = currentCanceled.filter((a) => a.professionalId === p.id).length;
      const rev = pCompleted.reduce((acc, a) => acc + getApptPrice(a, servicesMap), 0);
      const cnt = pCompleted.length;
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        count: cnt,
        canceledCount: pCanceled,
        revenue: rev,
        avgTicket: cnt > 0 ? rev / cnt : 0,
        sharePct: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Top services
  const svcAgg = new Map<
    string,
    { id: string; name: string; category: string; count: number; revenue: number }
  >();
  currentCompleted.forEach((a) => {
    const svc = servicesMap.get(a.serviceId);
    const id = a.serviceId || a.serviceName;
    const curr = svcAgg.get(id) || {
      id,
      name: svc?.name || a.serviceName || 'Serviço',
      category: svc?.category || 'Geral',
      count: 0,
      revenue: 0,
    };
    curr.count += 1;
    curr.revenue += getApptPrice(a, servicesMap);
    svcAgg.set(id, curr);
  });
  const topServices = Array.from(svcAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  // Evaluation & CSAT metrics
  const periodRuns = data.checklistRuns.filter((r) => {
    const d = r.evaluationDate || r.date;
    return d && d >= window.startYmd && d <= window.endYmd;
  });
  const checklistPctValues = periodRuns
    .map((r) => Number(r.percentage ?? r.completionPercentage ?? 0))
    .filter((v) => !Number.isNaN(v));
  const avgChecklistPct =
    checklistPctValues.length > 0
      ? Math.round(checklistPctValues.reduce((a, b) => a + b, 0) / checklistPctValues.length)
      : 0;

  const periodCsats = data.dispatches.filter((d) => {
    if (typeof d.csatRating !== 'number' || d.csatRating <= 0) return false;
    const dispYmd = toYmd(new Date(d.dispatchedAt));
    return dispYmd >= window.startYmd && dispYmd <= window.endYmd;
  });
  const avgCsatRating =
    periodCsats.length > 0
      ? Math.round(
          (periodCsats.reduce((acc, d) => acc + Number(d.csatRating || 0), 0) /
            periodCsats.length) *
            10
        ) / 10
      : 0;

  return {
    window,
    totalRevenue,
    completedCount,
    canceledCount,
    attendedClientsCount,
    averageTicket,
    prevTotalRevenue,
    prevCompletedCount,
    prevCanceledCount,
    prevAttendedClientsCount,
    prevAverageTicket,
    revenueDeltaPct: calcDeltaPct(totalRevenue, prevTotalRevenue),
    completedDeltaPct: calcDeltaPct(completedCount, prevCompletedCount),
    canceledDeltaPct: calcDeltaPct(canceledCount, prevCanceledCount),
    clientsDeltaPct: calcDeltaPct(attendedClientsCount, prevAttendedClientsCount),
    ticketDeltaPct: calcDeltaPct(averageTicket, prevAverageTicket),
    evolutionSeries,
    originsBreakdown,
    ageBrackets,
    ageUnknownCount,
    bestClients,
    professionalStats,
    topServices,
    evaluationMetrics: {
      checklistCount: periodRuns.length,
      avgChecklistPct,
      csatCount: periodCsats.length,
      avgCsatRating,
    },
  };
}

// =====================================================
// REPORT CATALOG & ON-DEMAND BUILDER
// =====================================================

export type ReportCategory =
  | 'Clientes'
  | 'Profissionais'
  | 'Agenda'
  | 'Financeiro'
  | 'CRM & IA';

export interface CatalogReportDefinition {
  code: string;
  category: ReportCategory;
  title: string;
  description: string;
  hasChart?: boolean;
  supportsDualPeriod?: boolean;
  defaultFavorite?: boolean;
}

export const REPORTS_CATALOG: CatalogReportDefinition[] = [
  {
    code: '0001',
    category: 'Clientes',
    title: 'Aniversariantes do período',
    description:
      'Lista os clientes que fazem aniversário dentro do mês ou intervalo de datas selecionado, com WhatsApp para felicitações.',
    defaultFavorite: false,
  },
  {
    code: '0002',
    category: 'Clientes',
    title: 'Clientes atendidos e consumo',
    description:
      'Exibe todos os clientes atendidos no período, quantidade de visitas realizadas, serviços principais e valor total consumido.',
    defaultFavorite: true,
  },
  {
    code: '0003',
    category: 'Clientes',
    title: 'Como clientes nos conheceram',
    description:
      'Classifica a base pelo canal de origem informado no cadastro (Instagram, Google, Indicação, WhatsApp, Passagem).',
    hasChart: true,
    defaultFavorite: true,
  },
  {
    code: '0004',
    category: 'Clientes',
    title: 'Cadastro completo de clientes',
    description:
      'Exportação auditável da base ativa com nome, telefone, e-mail, aniversário, origem e saldo de visitas acumuladas.',
    defaultFavorite: false,
  },
  {
    code: '0006',
    category: 'Clientes',
    title: 'Clientes com crédito ou saldo em aberto',
    description:
      'Monitora clientes que possuem crédito pré-pago disponível ou saldo pendente (fiado) na ficha financeira.',
    defaultFavorite: false,
  },
  {
    code: '0007',
    category: 'Clientes',
    title: 'Taxa de retorno & retenção entre períodos',
    description:
      'Calcula qual % dos clientes atendidos no Período 1 retornaram no Período 2 e lista nominalmente quem ainda não voltou.',
    hasChart: true,
    supportsDualPeriod: true,
    defaultFavorite: true,
  },
  {
    code: '0009',
    category: 'Clientes',
    title: 'Clientes classificados por faixa etária',
    description:
      'Distribui os clientes em 6 faixas etárias (0–15, 16–25, 26–35, 36–45, 46–60 e 60+) para orientar campanhas e serviços.',
    hasChart: true,
    defaultFavorite: true,
  },
  {
    code: '0010',
    category: 'Clientes',
    title: 'Auditoria de celulares duplicados',
    description:
      'Identifica fichas com o mesmo número de WhatsApp para higienizar o cadastro e evitar disparos repetidos no CRM.',
    defaultFavorite: false,
  },
  {
    code: '0020',
    category: 'Clientes',
    title: 'Clientes com retorno vencido (Inativos)',
    description:
      'Aponta clientes sem visita recente e sem agendamento futuro marcado, ordenados pelo maior tempo de ausência.',
    defaultFavorite: true,
  },
  {
    code: '0021',
    category: 'Profissionais',
    title: 'Faturamento e ticket médio por profissional',
    description:
      'Consolida o faturamento gerado, número de atendimentos concluídos, cancelamentos e ticket médio por especialista.',
    hasChart: true,
    defaultFavorite: true,
  },
  {
    code: '0024',
    category: 'Profissionais',
    title: 'Serviços mais rentáveis por categoria',
    description:
      'Exibe os procedimentos executados no período, volume de realizações, faturamento acumulado e preço médio praticado.',
    hasChart: true,
    defaultFavorite: true,
  },
  {
    code: '0027',
    category: 'Profissionais',
    title: 'Carteira de clientes por profissional',
    description:
      'Relaciona cada profissional aos clientes que atendeu no período com contagem de visitas e total faturado.',
    defaultFavorite: true,
  },
  {
    code: '0052',
    category: 'Agenda',
    title: 'Agendamentos cancelados e faltas (No-Show)',
    description:
      'Lista todos os horários cancelados ou marcados como ausência no período, com valor potencial perdido e profissional.',
    defaultFavorite: true,
  },
  {
    code: '0060',
    category: 'Financeiro',
    title: 'Fluxo financeiro: entradas vs saídas',
    description:
      'Detalha receitas e despesas lançadas no financeiro dentro do período escolhido, com saldo líquido consolidado.',
    hasChart: true,
    defaultFavorite: false,
  },
  {
    code: '0070',
    category: 'CRM & IA',
    title: 'Desempenho de disparos & recuperação Lumi IA',
    description:
      'Audita campanhas disparadas, respostas obtidas, agendamentos convertidos e receita recuperada pelo CRM.',
    hasChart: true,
    defaultFavorite: false,
  },
];

export interface BuiltReportDataset {
  definition: CatalogReportDefinition;
  periodLabel: string;
  kpis: Array<{ label: string; value: string }>;
  headers: string[];
  rows: Array<Array<string | number>>;
  chartType?: 'bar' | 'pie';
  chartData?: Array<{ name: string; value: number }>;
  filenameSlug: string;
}

export function buildCatalogReportDataset(
  code: string,
  data: DashboardDatasetInput,
  params: {
    startDate: string;
    endDate: string;
    period2StartDate?: string;
    period2EndDate?: string;
  }
): BuiltReportDataset {
  const def = REPORTS_CATALOG.find((r) => r.code === code) || REPORTS_CATALOG[0];
  const startYmd = params.startDate <= params.endDate ? params.startDate : params.endDate;
  const endYmd = params.startDate <= params.endDate ? params.endDate : params.startDate;
  const periodLabel = `${formatDateBr(startYmd)} a ${formatDateBr(endYmd)}`;

  const servicesMap = new Map(data.services.map((s) => [s.id, s]));
  const clientsMap = new Map(data.clients.map((c) => [c.id, c]));
  const activeClients = data.clients.filter((c) => !c.deletedAt && !c.archived);

  const apptsInRange = data.appointments.filter(
    (a) => !a.isBlock && a.date >= startYmd && a.date <= endYmd
  );
  const completedInRange = apptsInRange.filter((a) => a.status === 'completed');

  switch (code) {
    case '0001': {
      // Birthdays within MM-DD range
      const startMmDd = startYmd.slice(5, 10);
      const endMmDd = endYmd.slice(5, 10);
      const matches = activeClients
        .filter((c) => {
          if (!c.birthDate || c.birthDate.length < 10) return false;
          const mmdd = c.birthDate.slice(5, 10);
          if (startMmDd <= endMmDd) return mmdd >= startMmDd && mmdd <= endMmDd;
          return mmdd >= startMmDd || mmdd <= endMmDd;
        })
        .sort((a, b) => (a.birthDate?.slice(5, 10) || '').localeCompare(b.birthDate?.slice(5, 10) || ''));

      return {
        definition: def,
        periodLabel,
        kpis: [
          { label: 'Aniversariantes no período', value: String(matches.length) },
          {
            label: 'Com WhatsApp cadastrado',
            value: String(matches.filter((m) => Boolean(m.phone)).length),
          },
        ],
        headers: ['Cliente', 'Data de Nascimento', 'WhatsApp', 'E-mail'],
        rows: matches.map((c) => [
          c.name,
          formatDateBr(c.birthDate || ''),
          c.phone || '—',
          c.email || '—',
        ]),
        filenameSlug: `aniversariantes_${startYmd}_${endYmd}`,
      };
    }

    case '0002': {
      const agg = new Map<
        string,
        { name: string; phone: string; visits: number; services: Set<string>; total: number }
      >();
      completedInRange.forEach((a) => {
        const key = a.clientId || a.clientName;
        const c = a.clientId ? clientsMap.get(a.clientId) : undefined;
        const curr = agg.get(key) || {
          name: c?.name || a.clientName,
          phone: c?.phone || a.clientPhone || '—',
          visits: 0,
          services: new Set<string>(),
          total: 0,
        };
        curr.visits += 1;
        if (a.serviceName) curr.services.add(a.serviceName);
        curr.total += getApptPrice(a, servicesMap);
        agg.set(key, curr);
      });
      const list = Array.from(agg.values()).sort((a, b) => b.total - a.total);
      const sumRev = list.reduce((acc, i) => acc + i.total, 0);

      return {
        definition: def,
        periodLabel,
        kpis: [
          { label: 'Clientes atendidos', value: String(list.length) },
          { label: 'Faturamento acumulado', value: formatBRL(sumRev) },
          {
            label: 'Ticket médio por cliente',
            value: formatBRL(list.length > 0 ? sumRev / list.length : 0),
          },
        ],
        headers: ['Cliente', 'WhatsApp', 'Visitas', 'Serviços Realizados', 'Total Consumido (R$)'],
        rows: list.map((i) => [
          i.name,
          i.phone,
          i.visits,
          Array.from(i.services).slice(0, 3).join(', ') || '—',
          Number(i.total.toFixed(2)),
        ]),
        filenameSlug: `clientes_atendidos_${startYmd}_${endYmd}`,
      };
    }

    case '0003': {
      const originMap = new Map<string, number>();
      activeClients.forEach((c) => {
        const label =
          c.sourceLabel?.trim() || (c.source && ORIGIN_LABELS[c.source]) || 'Não informado';
        originMap.set(label, (originMap.get(label) || 0) + 1);
      });
      const total = activeClients.length;
      const entries = Array.from(originMap.entries()).sort((a, b) => b[1] - a[1]);

      return {
        definition: def,
        periodLabel: `Base ativa (${total} clientes)`,
        kpis: [
          { label: 'Total de clientes na base', value: String(total) },
          { label: 'Principal canal', value: entries[0]?.[0] || '—' },
        ],
        headers: ['Canal de Origem', 'Quantidade de Clientes', 'Participação (%)'],
        rows: entries.map(([name, count]) => [
          name,
          count,
          total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%',
        ]),
        chartType: 'pie',
        chartData: entries.map(([name, value]) => ({ name, value })),
        filenameSlug: `origens_clientes_${startYmd}`,
      };
    }

    case '0004': {
      return {
        definition: def,
        periodLabel: `Base ativa (${activeClients.length} registros)`,
        kpis: [
          { label: 'Clientes ativos', value: String(activeClients.length) },
          {
            label: 'Com e-mail cadastrado',
            value: String(activeClients.filter((c) => Boolean(c.email)).length),
          },
        ],
        headers: ['Nome', 'WhatsApp', 'E-mail', 'Aniversário', 'Origem', 'Total Gasto (R$)'],
        rows: activeClients
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => [
            c.name,
            c.phone || '—',
            c.email || '—',
            c.birthDate ? formatDateBr(c.birthDate) : '—',
            c.sourceLabel || (c.source && ORIGIN_LABELS[c.source]) || '—',
            Number((c.totalSpent || 0).toFixed(2)),
          ]),
        filenameSlug: `cadastro_clientes_${startYmd}`,
      };
    }

    case '0006': {
      const withBalance = activeClients
        .filter((c) => Number(c.creditBalance || 0) !== 0)
        .sort((a, b) => (b.creditBalance || 0) - (a.creditBalance || 0));
      const totalCredits = withBalance
        .filter((c) => (c.creditBalance || 0) > 0)
        .reduce((acc, c) => acc + Number(c.creditBalance || 0), 0);
      const totalDebts = withBalance
        .filter((c) => (c.creditBalance || 0) < 0)
        .reduce((acc, c) => acc + Math.abs(Number(c.creditBalance || 0)), 0);

      return {
        definition: def,
        periodLabel: 'Posição atual da carteira',
        kpis: [
          { label: 'Clientes com saldo', value: String(withBalance.length) },
          { label: 'Créditos disponíveis', value: formatBRL(totalCredits) },
          { label: 'Valores em aberto', value: formatBRL(totalDebts) },
        ],
        headers: ['Cliente', 'WhatsApp', 'Situação', 'Saldo (R$)'],
        rows: withBalance.map((c) => [
          c.name,
          c.phone || '—',
          (c.creditBalance || 0) >= 0 ? 'Crédito disponível' : 'Saldo em aberto',
          Number((c.creditBalance || 0).toFixed(2)),
        ]),
        filenameSlug: `saldos_clientes_${startYmd}`,
      };
    }

    case '0007': {
      const p2Start = params.period2StartDate || startYmd;
      const p2End = params.period2EndDate || endYmd;
      const p1Completed = data.appointments.filter(
        (a) => !a.isBlock && a.status === 'completed' && a.date >= startYmd && a.date <= endYmd
      );
      const p2Completed = data.appointments.filter(
        (a) => !a.isBlock && a.status === 'completed' && a.date >= p2Start && a.date <= p2End
      );
      const p1Clients = new Map<string, { name: string; phone: string; lastDate: string }>();
      p1Completed.forEach((a) => {
        const key = a.clientId || a.clientName;
        if (!key) return;
        const c = a.clientId ? clientsMap.get(a.clientId) : undefined;
        p1Clients.set(key, {
          name: c?.name || a.clientName,
          phone: c?.phone || a.clientPhone || '—',
          lastDate: a.date,
        });
      });
      const p2Keys = new Set(
        p2Completed.map((a) => a.clientId || a.clientName).filter(Boolean)
      );
      const returned: Array<{ name: string; phone: string; lastDate: string }> = [];
      const notReturned: Array<{ name: string; phone: string; lastDate: string }> = [];
      p1Clients.forEach((val, key) => {
        if (p2Keys.has(key)) returned.push(val);
        else notReturned.push(val);
      });
      const rate =
        p1Clients.size > 0 ? Math.round((returned.length / p1Clients.size) * 1000) / 10 : 0;

      return {
        definition: def,
        periodLabel: `P1 (${formatDateBr(startYmd)} a ${formatDateBr(endYmd)}) → P2 (${formatDateBr(p2Start)} a ${formatDateBr(p2End)})`,
        kpis: [
          { label: 'Clientes no Período 1', value: String(p1Clients.size) },
          { label: 'Retornaram no Período 2', value: String(returned.length) },
          { label: 'Taxa de Retenção', value: `${rate}%` },
        ],
        headers: ['Cliente (Não retornou no P2)', 'WhatsApp', 'Última Visita no P1', 'Status'],
        rows: notReturned.map((i) => [
          i.name,
          i.phone,
          formatDateBr(i.lastDate),
          'Não retornou',
        ]),
        chartType: 'pie',
        chartData: [
          { name: 'Retornaram no Período 2', value: returned.length },
          { name: 'Não retornaram', value: notReturned.length },
        ],
        filenameSlug: `taxa_retorno_${startYmd}_${p2End}`,
      };
    }

    case '0009': {
      const nowYear = new Date().getFullYear();
      const brackets = [
        { name: '0–15 anos', min: 0, max: 15, count: 0 },
        { name: '16–25 anos', min: 16, max: 25, count: 0 },
        { name: '26–35 anos', min: 26, max: 35, count: 0 },
        { name: '36–45 anos', min: 36, max: 45, count: 0 },
        { name: '46–60 anos', min: 46, max: 60, count: 0 },
        { name: 'Acima de 60 anos', min: 61, max: 130, count: 0 },
      ];
      let unknown = 0;
      activeClients.forEach((c) => {
        const y = c.birthDate ? parseInt(c.birthDate.slice(0, 4), 10) : NaN;
        if (Number.isNaN(y) || y < 1900 || y > nowYear) {
          unknown += 1;
          return;
        }
        const age = nowYear - y;
        const b = brackets.find((item) => age >= item.min && age <= item.max);
        if (b) b.count += 1;
        else unknown += 1;
      });
      const known = brackets.reduce((acc, b) => acc + b.count, 0);

      return {
        definition: def,
        periodLabel: `Base ativa (${known} com idade informada)`,
        kpis: [
          { label: 'Com faixa definida', value: String(known) },
          { label: 'Sem data de nascimento', value: String(unknown) },
        ],
        headers: ['Faixa Etária', 'Clientes', 'Participação (%)'],
        rows: brackets.map((b) => [
          b.name,
          b.count,
          known > 0 ? `${((b.count / known) * 100).toFixed(1)}%` : '0%',
        ]),
        chartType: 'bar',
        chartData: brackets.map((b) => ({ name: b.name, value: b.count })),
        filenameSlug: `faixa_etaria_clientes_${startYmd}`,
      };
    }

    case '0010': {
      const byDigits = new Map<string, Client[]>();
      activeClients.forEach((c) => {
        const digits = String(c.phone || '').replace(/\D/g, '').slice(-9);
        if (digits.length < 8) return;
        const arr = byDigits.get(digits) || [];
        arr.push(c);
        byDigits.set(digits, arr);
      });
      const dupGroups = Array.from(byDigits.entries()).filter(([, list]) => list.length > 1);
      const rows: Array<Array<string | number>> = [];
      dupGroups.forEach(([, list]) => {
        list.forEach((c) => {
          rows.push([c.name, c.phone || '—', c.email || '—', list.length]);
        });
      });

      return {
        definition: def,
        periodLabel: 'Auditoria completa da base',
        kpis: [
          { label: 'Telefones em duplicidade', value: String(dupGroups.length) },
          { label: 'Fichas envolvidas', value: String(rows.length) },
        ],
        headers: ['Cliente', 'Telefone / WhatsApp', 'E-mail', 'Ocorrências'],
        rows,
        filenameSlug: `duplicidades_clientes_${startYmd}`,
      };
    }

    case '0020': {
      const todayMs = Date.now();
      const todayYmd = toYmd(new Date());
      const overdue: Array<{ name: string; phone: string; lastDate: string; daysAgo: number; lastService: string }> = [];

      activeClients.forEach((c) => {
        const hasFuture = data.appointments.some(
          (a) =>
            a.clientId === c.id &&
            a.date >= todayYmd &&
            a.status !== 'canceled' &&
            a.status !== 'no_show'
        );
        if (hasFuture) return;
        const completed = data.appointments
          .filter((a) => a.clientId === c.id && a.status === 'completed')
          .sort((a, b) => b.date.localeCompare(a.date));
        const refDate = completed[0]?.date;
        if (!refDate) return;
        const daysAgo = Math.round(
          (todayMs - new Date(`${refDate}T12:00:00`).getTime()) / 86400000
        );
        if (daysAgo >= 45) {
          overdue.push({
            name: c.name,
            phone: c.phone || '—',
            lastDate: refDate,
            daysAgo,
            lastService: completed[0]?.serviceName || '—',
          });
        }
      });
      overdue.sort((a, b) => b.daysAgo - a.daysAgo);

      return {
        definition: def,
        periodLabel: 'Clientes sem retorno há 45+ dias e sem agenda futura',
        kpis: [
          { label: 'Clientes para reativar', value: String(overdue.length) },
          {
            label: 'Com WhatsApp ativo',
            value: String(overdue.filter((o) => o.phone !== '—').length),
          },
        ],
        headers: ['Cliente', 'WhatsApp', 'Última Visita', 'Dias Sem Retorno', 'Último Serviço'],
        rows: overdue.map((o) => [
          o.name,
          o.phone,
          formatDateBr(o.lastDate),
          o.daysAgo,
          o.lastService,
        ]),
        filenameSlug: `clientes_retorno_vencido_${todayYmd}`,
      };
    }

    case '0021': {
      const profRows = data.professionals
        .map((p) => {
          const pAppts = completedInRange.filter((a) => a.professionalId === p.id);
          const rev = pAppts.reduce((acc, a) => acc + getApptPrice(a, servicesMap), 0);
          return {
            name: p.name,
            role: p.role,
            count: pAppts.length,
            rev,
            ticket: pAppts.length > 0 ? rev / pAppts.length : 0,
          };
        })
        .sort((a, b) => b.rev - a.rev);
      const total = profRows.reduce((acc, r) => acc + r.rev, 0);

      return {
        definition: def,
        periodLabel,
        kpis: [
          { label: 'Profissionais avaliados', value: String(profRows.length) },
          { label: 'Faturamento total', value: formatBRL(total) },
        ],
        headers: ['Profissional', 'Função', 'Atendimentos', 'Faturamento (R$)', 'Ticket Médio (R$)'],
        rows: profRows.map((r) => [
          r.name,
          r.role,
          r.count,
          Number(r.rev.toFixed(2)),
          Number(r.ticket.toFixed(2)),
        ]),
        chartType: 'bar',
        chartData: profRows
          .filter((r) => r.rev > 0)
          .slice(0, 8)
          .map((r) => ({ name: r.name.split(' ')[0], value: Math.round(r.rev) })),
        filenameSlug: `faturamento_profissionais_${startYmd}_${endYmd}`,
      };
    }

    case '0024': {
      const svcMap = new Map<string, { name: string; category: string; count: number; rev: number }>();
      completedInRange.forEach((a) => {
        const svc = servicesMap.get(a.serviceId);
        const key = a.serviceId || a.serviceName;
        const curr = svcMap.get(key) || {
          name: svc?.name || a.serviceName || 'Serviço',
          category: svc?.category || 'Geral',
          count: 0,
          rev: 0,
        };
        curr.count += 1;
        curr.rev += getApptPrice(a, servicesMap);
        svcMap.set(key, curr);
      });
      const list = Array.from(svcMap.values()).sort((a, b) => b.rev - a.rev);

      return {
        definition: def,
        periodLabel,
        kpis: [
          { label: 'Serviços distintos', value: String(list.length) },
          {
            label: 'Total de execuções',
            value: String(list.reduce((acc, s) => acc + s.count, 0)),
          },
        ],
        headers: ['Serviço', 'Categoria', 'Quantidade', 'Faturamento Total (R$)', 'Média (R$)'],
        rows: list.map((s) => [
          s.name,
          s.category,
          s.count,
          Number(s.rev.toFixed(2)),
          Number((s.count > 0 ? s.rev / s.count : 0).toFixed(2)),
        ]),
        chartType: 'bar',
        chartData: list.slice(0, 8).map((s) => ({ name: s.name.slice(0, 18), value: Math.round(s.rev) })),
        filenameSlug: `servicos_rentabilidade_${startYmd}_${endYmd}`,
      };
    }

    case '0027': {
      const pairs = new Map<
        string,
        { profName: string; clientName: string; phone: string; visits: number; rev: number }
      >();
      completedInRange.forEach((a) => {
        const key = `${a.professionalId}__${a.clientId || a.clientName}`;
        const c = a.clientId ? clientsMap.get(a.clientId) : undefined;
        const curr = pairs.get(key) || {
          profName: a.professionalName || 'Profissional',
          clientName: c?.name || a.clientName,
          phone: c?.phone || a.clientPhone || '—',
          visits: 0,
          rev: 0,
        };
        curr.visits += 1;
        curr.rev += getApptPrice(a, servicesMap);
        pairs.set(key, curr);
      });
      const list = Array.from(pairs.values()).sort((a, b) => b.rev - a.rev);

      return {
        definition: def,
        periodLabel,
        kpis: [
          { label: 'Vínculos registrados', value: String(list.length) },
        ],
        headers: ['Profissional', 'Cliente', 'WhatsApp', 'Visitas', 'Total (R$)'],
        rows: list.map((i) => [
          i.profName,
          i.clientName,
          i.phone,
          i.visits,
          Number(i.rev.toFixed(2)),
        ]),
        filenameSlug: `carteira_profissionais_${startYmd}_${endYmd}`,
      };
    }

    case '0052': {
      const canceled = apptsInRange
        .filter((a) => a.status === 'canceled' || a.status === 'no_show')
        .sort((a, b) => b.date.localeCompare(a.date));
      const lostVal = canceled.reduce((acc, a) => acc + getApptPrice(a, servicesMap), 0);

      return {
        definition: def,
        periodLabel,
        kpis: [
          { label: 'Cancelamentos / Faltas', value: String(canceled.length) },
          { label: 'Receita potencial perdida', value: formatBRL(lostVal) },
        ],
        headers: ['Data', 'Hora', 'Cliente', 'Serviço', 'Profissional', 'Motivo/Status', 'Valor (R$)'],
        rows: canceled.map((a) => [
          formatDateBr(a.date),
          a.time || '—',
          a.clientName,
          a.serviceName,
          a.professionalName,
          a.status === 'no_show' ? 'Falta (No-Show)' : 'Cancelado',
          Number(getApptPrice(a, servicesMap).toFixed(2)),
        ]),
        filenameSlug: `cancelamentos_faltas_${startYmd}_${endYmd}`,
      };
    }

    case '0060': {
      const txs = data.financialTransactions
        .filter((t) => t.date >= startYmd && t.date <= endYmd)
        .sort((a, b) => b.date.localeCompare(a.date));
      const rev = txs
        .filter((t) => t.type === 'revenue')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const exp = txs
        .filter((t) => t.type === 'expense')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      return {
        definition: def,
        periodLabel,
        kpis: [
          { label: 'Entradas', value: formatBRL(rev) },
          { label: 'Saídas', value: formatBRL(exp) },
          { label: 'Saldo líquido', value: formatBRL(rev - exp) },
        ],
        headers: ['Data', 'Descrição', 'Categoria', 'Tipo', 'Forma Pagto', 'Valor (R$)'],
        rows: txs.map((t) => [
          formatDateBr(t.date),
          t.description,
          t.category || 'Geral',
          t.type === 'revenue' ? 'Receita' : 'Despesa',
          t.paymentMethod || '—',
          Number(t.amount.toFixed(2)),
        ]),
        chartType: 'bar',
        chartData: [
          { name: 'Receitas', value: Math.round(rev) },
          { name: 'Despesas', value: Math.round(exp) },
          { name: 'Saldo Líquido', value: Math.round(rev - exp) },
        ],
        filenameSlug: `fluxo_financeiro_${startYmd}_${endYmd}`,
      };
    }

    case '0070':
    default: {
      const inPeriodDisps = data.dispatches.filter((d) => {
        const ymd = toYmd(new Date(d.dispatchedAt));
        return ymd >= startYmd && ymd <= endYmd;
      });
      const converted = inPeriodDisps.filter((d) => d.status === 'converted');
      const revRecovered = converted.reduce(
        (acc, d) => acc + Number(d.convertedRevenue || 0),
        0
      );
      const byType = new Map<string, number>();
      inPeriodDisps.forEach((d) => {
        byType.set(d.campaignType, (byType.get(d.campaignType) || 0) + 1);
      });

      return {
        definition: def,
        periodLabel,
        kpis: [
          { label: 'Mensagens disparadas', value: String(inPeriodDisps.length) },
          { label: 'Conversões em agenda', value: String(converted.length) },
          { label: 'Receita recuperada', value: formatBRL(revRecovered) },
        ],
        headers: ['Data do Disparo', 'Cliente', 'WhatsApp', 'Campanha', 'Status', 'Receita (R$)'],
        rows: inPeriodDisps.map((d) => [
          new Date(d.dispatchedAt).toLocaleString('pt-BR'),
          d.clientName,
          d.clientPhone,
          d.campaignType,
          d.status,
          Number((d.convertedRevenue || 0).toFixed(2)),
        ]),
        chartType: 'bar',
        chartData: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
        filenameSlug: `campanhas_lumi_ia_${startYmd}_${endYmd}`,
      };
    }
  }
}

// =====================================================
// AGENDA & REVENUE HEATMAP ENGINE
// =====================================================

export interface HeatmapFilters {
  startDate: string;
  endDate: string;
  professionalId: string;
  serviceId: string;
  metric: 'count' | 'revenue';
  intervalMinutes: 30 | 60;
}

export interface HeatmapCell {
  dayIndex: number; // 0 = SEG .. 6 = DOM
  slot: string;     // HH:mm
  count: number;
  revenue: number;
  value: number;
  intensity: number; // 0..1
}

export interface HeatmapResult {
  days: Array<{ index: number; shortLabel: string; fullLabel: string }>;
  slots: string[];
  cells: Record<string, HeatmapCell>; // key: `${dayIndex}_${slot}`
  maxValue: number;
  totalCount: number;
  totalRevenue: number;
  topPeakSlots: Array<{ label: string; count: number; revenue: number }>;
  idleWindows: Array<{ label: string; count: number }>;
}

const HEATMAP_DAYS = [
  { index: 0, shortLabel: 'SEG', fullLabel: 'Segunda-feira' },
  { index: 1, shortLabel: 'TER', fullLabel: 'Terça-feira' },
  { index: 2, shortLabel: 'QUA', fullLabel: 'Quarta-feira' },
  { index: 3, shortLabel: 'QUI', fullLabel: 'Quinta-feira' },
  { index: 4, shortLabel: 'SEX', fullLabel: 'Sexta-feira' },
  { index: 5, shortLabel: 'SAB', fullLabel: 'Sábado' },
  { index: 6, shortLabel: 'DOM', fullLabel: 'Domingo' },
];

export function computeAgendaHeatmap(
  appointments: Appointment[],
  services: Service[],
  filters: HeatmapFilters
): HeatmapResult {
  const servicesMap = new Map(services.map((s) => [s.id, s]));
  const slots: string[] = [];
  const step = filters.intervalMinutes === 30 ? 30 : 60;
  for (let mins = 6 * 60; mins <= 22 * 60; mins += step) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }

  const startYmd = filters.startDate <= filters.endDate ? filters.startDate : filters.endDate;
  const endYmd = filters.startDate <= filters.endDate ? filters.endDate : filters.startDate;

  const cells: Record<string, HeatmapCell> = {};
  HEATMAP_DAYS.forEach((day) => {
    slots.forEach((slot) => {
      cells[`${day.index}_${slot}`] = {
        dayIndex: day.index,
        slot,
        count: 0,
        revenue: 0,
        value: 0,
        intensity: 0,
      };
    });
  });

  let totalCount = 0;
  let totalRevenue = 0;

  appointments.forEach((a) => {
    if (a.isBlock) return;
    if (a.status === 'canceled' || a.status === 'no_show') return;
    if (!a.date || a.date < startYmd || a.date > endYmd) return;
    if (filters.professionalId && filters.professionalId !== 'all' && a.professionalId !== filters.professionalId) {
      return;
    }
    if (filters.serviceId && filters.serviceId !== 'all' && a.serviceId !== filters.serviceId) {
      return;
    }
    const jsDay = new Date(`${a.date}T12:00:00`).getDay(); // 0=Sun..6=Sat
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun

    const [hhRaw, mmRaw] = String(a.time || '09:00').split(':');
    const hh = Math.max(6, Math.min(22, Number(hhRaw) || 9));
    const mmNum = Number(mmRaw) || 0;
    const snappedMin = step === 30 ? (mmNum >= 30 ? 30 : 0) : 0;
    const slot = `${String(hh).padStart(2, '0')}:${String(snappedMin).padStart(2, '0')}`;
    const key = `${dayIndex}_${slot}`;
    const cell = cells[key];
    if (!cell) return;

    const price = getApptPrice(a, servicesMap);
    cell.count += 1;
    cell.revenue += price;
    totalCount += 1;
    totalRevenue += price;
  });

  let maxValue = 0;
  Object.values(cells).forEach((cell) => {
    cell.value = filters.metric === 'revenue' ? cell.revenue : cell.count;
    if (cell.value > maxValue) maxValue = cell.value;
  });

  Object.values(cells).forEach((cell) => {
    cell.intensity = maxValue > 0 ? cell.value / maxValue : 0;
  });

  const nonZeroCells = Object.values(cells)
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const topPeakSlots = nonZeroCells.slice(0, 3).map((c) => ({
    label: `${HEATMAP_DAYS[c.dayIndex].shortLabel} às ${c.slot}`,
    count: c.count,
    revenue: c.revenue,
  }));

  // Idle business-hour windows (Tue-Fri 09:00..18:00) for tactical campaigns
  const idleWindows = Object.values(cells)
    .filter((c) => {
      const hour = Number(c.slot.slice(0, 2));
      return c.dayIndex >= 1 && c.dayIndex <= 4 && hour >= 9 && hour <= 18;
    })
    .sort((a, b) => a.count - b.count)
    .slice(0, 3)
    .map((c) => ({
      label: `${HEATMAP_DAYS[c.dayIndex].shortLabel} às ${c.slot}`,
      count: c.count,
    }));

  return {
    days: HEATMAP_DAYS,
    slots,
    cells,
    maxValue,
    totalCount,
    totalRevenue,
    topPeakSlots,
    idleWindows,
  };
}

// =====================================================
// EXPORT HELPERS (CSV & PDF)
// =====================================================

export function exportRowsToCsv(
  filenameSlug: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    '\uFEFF' + headers.map(escape).join(';'),
    ...rows.map((r) => r.map(escape).join(';')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameSlug}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportToPdf(params: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  kpis?: Array<{ label: string; value: string }>;
  filenameSlug: string;
}): void {
  const docPdf = new jsPDF({ orientation: params.headers.length > 5 ? 'landscape' : 'portrait' });
  docPdf.setFontSize(15);
  docPdf.text(params.title, 14, 16);
  docPdf.setFontSize(9.5);
  docPdf.setTextColor(100, 100, 100);
  docPdf.text(params.subtitle, 14, 22);

  let startY = 28;
  if (params.kpis && params.kpis.length > 0) {
    docPdf.setTextColor(23, 23, 23);
    docPdf.setFontSize(9.5);
    const kpiLine = params.kpis.map((k) => `${k.label}: ${k.value}`).join('   |   ');
    docPdf.text(kpiLine, 14, 29);
    startY = 35;
  }

  autoTable(docPdf, {
    startY,
    head: [params.headers],
    body: params.rows.map((r) => r.map((cell) => String(cell ?? ''))),
    theme: 'grid',
    headStyles: { fillColor: [23, 23, 23], textColor: [255, 255, 255] },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
  });

  docPdf.save(`${params.filenameSlug}.pdf`);
}

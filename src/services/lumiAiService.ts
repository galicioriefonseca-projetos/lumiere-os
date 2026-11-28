import { auth } from '@/lib/firebase';
import type { CrmCampaignType } from '@/types';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function generateAiCampaignCopy(params: {
  salonName: string;
  campaignType: CrmCampaignType;
  tone?: 'acolhedor' | 'sofisticado' | 'objetivo';
  promoServiceName?: string;
  promoDiscountLabel?: string;
  customGoal?: string;
}): Promise<{ template: string; isAiGenerated: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/ai/campaign-copy', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    template?: string;
    isAiGenerated?: boolean;
    error?: string;
  };
  if (!res.ok || !data.template) {
    throw new Error(data.error || 'Não foi possível gerar a sugestão de mensagem.');
  }
  return {
    template: data.template,
    isAiGenerated: Boolean(data.isAiGenerated),
  };
}

export async function generateAiReportDiagnosis(params: {
  salonName: string;
  periodLabel: string;
  totalRevenue: number;
  completedCount: number;
  canceledOrNoShowCount: number;
  uniqueClientsCount: number;
  averageTicket: number;
  topProfessionalName?: string;
  topServiceName?: string;
  peakSlotLabel?: string;
  revenueDeltaPct?: number | null;
}): Promise<{ diagnosis: string; isAiGenerated: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/ai/report-diagnosis', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    diagnosis?: string;
    isAiGenerated?: boolean;
    error?: string;
  };
  if (!res.ok || !data.diagnosis) {
    throw new Error(data.error || 'Não foi possível gerar o diagnóstico estratégico.');
  }
  return {
    diagnosis: data.diagnosis,
    isAiGenerated: Boolean(data.isAiGenerated),
  };
}

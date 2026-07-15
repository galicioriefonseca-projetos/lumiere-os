import { BusinessContext } from '../types';

export interface BusinessMemory {
  topProfessionals: Array<{ professionalId: string; revenue: number; appointments: number }>;
  topServices: Array<{ serviceId: string; revenue: number; count: number }>;
  mostProfitableHours: Array<{ hour: string; revenue: number }>;
  idleHours: Array<{ hour: string; idleRate: number }>;
  averageTicket: number;
  seasonality: Record<string, number>;
  revenueEvolution: Array<{ period: string; revenue: number; growth: number }>;
  occupancyEvolution: Array<{ period: string; rate: number }>;
  growthRate: number;
  retentionRate: number;
}

export interface ExecutiveSummary {
  dailySummary: string;
  weeklySummary: string;
  monthlySummary: string;
  executiveSummary: string;
}

export interface DetectedOpportunity {
  type: 'inactive_clients' | 'idle_professionals' | 'empty_slots' | 'low_sales_services' | 'critical_stock' | 'close_goals' | 'upsell';
  description: string;
  impact: number;
  data?: any;
}

export interface DetectedRisk {
  type: 'revenue_drop' | 'occupancy_drop' | 'retention_drop' | 'cancellations' | 'low_productivity' | 'ticket_drop';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data?: any;
}

export interface PerformanceRankings {
  professionals: Array<{ id: string; name: string; score: number; rank: number }>;
  services: Array<{ id: string; name: string; score: number; rank: number }>;
  categories: Array<{ id: string; name: string; score: number; rank: number }>;
  revenue: Array<{ sourceId: string; amount: number; rank: number }>;
  retention: Array<{ id: string; rate: number; rank: number }>;
}


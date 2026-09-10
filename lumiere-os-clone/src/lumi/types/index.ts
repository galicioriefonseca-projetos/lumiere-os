import { Salon, Appointment, Client, Service, Professional, Goal, ProfessionalGoal, ChecklistRun } from '../../types';

export interface BusinessContext {
  salon: Salon | null;
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  professionals: Professional[];
  comandas: any[];
  goals: Goal[];
  professionalGoals: ProfessionalGoal[];
  checklistRuns: ChecklistRun[];
  gamification: any[];
  inventory: any[];
}

export interface BusinessMetric {
  totalRevenue: number;
  averageTicket: number;
  occupancyRate: number;
  clientRetentionRate: number;
  cancelledAppointmentsRate: number;
  completedAppointmentsCount: number;
  activeClientsCount: number;
  lowStockItemsCount: number;
  goalAchievementRate: number;
  revenueByProfessional: Record<string, number>;
  topServicesByCount: { serviceId: string; serviceName: string; count: number; revenue: number }[];
}

export interface HealthScore {
  score: number; // 0 to 100
  areas: {
    agenda: number;      // 0 to 100
    financeiro: number;  // 0 to 100
    equipe: number;      // 0 to 100
    clientes: number;    // 0 to 100
    operacao: number;    // 0 to 100
  };
  breakdown: {
    agenda: string;
    financeiro: string;
    equipe: string;
    clientes: string;
    operacao: string;
  };
}

export interface Alert {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  category: 'finance' | 'occupancy' | 'team' | 'clients' | 'inventory' | 'goals';
  title: string;
  description: string;
  valueText?: string;
  actionText?: string;
  actionUrl?: string;
  createdAt: number;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'marketing' | 'operations' | 'finance' | 'hr' | 'stock';
  actionText: string;
  actionUrl?: string;
  isApplied: boolean;
  createdAt: number;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  metricRef?: string;
  dataPoints?: any[];
  createdAt: number;
}

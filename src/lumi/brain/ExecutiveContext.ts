import { BusinessMemory, ExecutiveSummary, DetectedOpportunity, DetectedRisk, PerformanceRankings } from './types';
import { Insight, Alert } from '../types';

export interface ExecutiveContext {
  memory: BusinessMemory;
  summary: ExecutiveSummary;
  opportunities: DetectedOpportunity[];
  risks: DetectedRisk[];
  rankings: PerformanceRankings;
  healthScore: number;
  insights: Insight[];
  alerts: Alert[];
  timestamp: number;
  salonId: string;
}

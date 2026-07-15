import { BusinessContext } from '../types';
import { PerformanceRankings } from './types';

export class PerformanceRankingBuilder {
  static build(context: BusinessContext): PerformanceRankings {
    return {
      professionals: context.professionals.map((p, index) => ({ id: p.id, name: p.name, score: 100 - index, rank: index + 1 })),
      services: context.services.map((s, index) => ({ id: s.id, name: s.name, score: 100 - index, rank: index + 1 })),
      categories: [],
      revenue: [],
      retention: []
    };
  }
}

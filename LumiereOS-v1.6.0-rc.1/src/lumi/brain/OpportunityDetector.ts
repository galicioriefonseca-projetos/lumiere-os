import { BusinessContext } from '../types';
import { DetectedOpportunity } from './types';

export class OpportunityDetector {
  static detect(context: BusinessContext): DetectedOpportunity[] {
    const opportunities: DetectedOpportunity[] = [];
    
    // Example logic
    if (context.clients.length > 100) {
      opportunities.push({
        type: 'inactive_clients',
        description: 'Existem clientes inativos que podem ser recuperados.',
        impact: 8
      });
    }

    if (context.professionals.length > 0 && context.appointments.length === 0) {
      opportunities.push({
        type: 'idle_professionals',
        description: 'Muitos profissionais com horários vagos hoje.',
        impact: 9
      });
    }

    return opportunities;
  }
}

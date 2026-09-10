import { BusinessContext } from '../types';
import { DetectedRisk } from './types';

export class RiskDetector {
  static detect(context: BusinessContext): DetectedRisk[] {
    const risks: DetectedRisk[] = [];

    const cancelledAppointments = context.appointments.filter(app => app.status === 'canceled');
    if (cancelledAppointments.length > 5) {
      risks.push({
        type: 'cancellations',
        description: 'Alto volume de cancelamentos recentemente.',
        severity: 'high'
      });
    }

    return risks;
  }
}

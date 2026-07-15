import { BusinessContext } from '../types';
import { BusinessMemory } from './types';

export class BusinessMemoryBuilder {
  static build(context: BusinessContext): BusinessMemory {
    const { appointments, services, professionals } = context;
    
    // Simplistic aggregations for the business memory based on context data
    let totalRevenue = 0;
    let totalAppointments = appointments.length;

    const proStats: Record<string, { revenue: number; count: number }> = {};
    const serviceStats: Record<string, { revenue: number; count: number }> = {};

    appointments.forEach(app => {
      const price = app.price || 0;
      totalRevenue += price;

      if (app.professionalId) {
        if (!proStats[app.professionalId]) proStats[app.professionalId] = { revenue: 0, count: 0 };
        proStats[app.professionalId].revenue += price;
        proStats[app.professionalId].count += 1;
      }

      if (app.serviceId) {
        if (!serviceStats[app.serviceId]) serviceStats[app.serviceId] = { revenue: 0, count: 0 };
        serviceStats[app.serviceId].revenue += price;
        serviceStats[app.serviceId].count += 1;
      }
    });

    const averageTicket = totalAppointments > 0 ? totalRevenue / totalAppointments : 0;

    const topProfessionals = Object.keys(proStats)
      .map(id => ({ professionalId: id, revenue: proStats[id].revenue, appointments: proStats[id].count }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topServices = Object.keys(serviceStats)
      .map(id => ({ serviceId: id, revenue: serviceStats[id].revenue, count: serviceStats[id].count }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      topProfessionals,
      topServices,
      mostProfitableHours: [],
      idleHours: [],
      averageTicket,
      seasonality: {},
      revenueEvolution: [],
      occupancyEvolution: [],
      growthRate: 0,
      retentionRate: 0, // Placeholder
    };
  }
}

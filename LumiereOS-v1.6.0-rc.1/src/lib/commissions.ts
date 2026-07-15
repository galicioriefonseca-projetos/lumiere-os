import { Professional, Appointment, ProfessionalGoal, Service } from "../types";

export interface CommissionSummary {
  professionalId: string;
  professionalName: string;
  commissionRate: number;              // percentual (ex: 50)
  productionFromAppointments: number;  // soma de appointments completed no mês
  productionManual: number;            // currentValue de professionalGoals (se > appointments)
  totalProduction: number;             // max(appointments, manual)
  commissionValue: number;             // totalProduction * commissionRate / 100
  targetAmount: number;                // meta do mês
  goalProgress: number;                // totalProduction / targetAmount * 100
  month: string;                       // YYYY-MM
}

// Calcula comissão consolidando as fontes
// Se professionalGoals.currentValue > soma de appointments:
//   usa manual (o owner lançou mais do que appointments registram)
// Caso contrário: usa appointments
// Regra: nunca diminuir a produção — pegar o maior valor
export function calculateCommission(
  professional: Professional,
  appointmentsInMonth: Appointment[],
  goalInMonth: ProfessionalGoal | null,
  services: Service[]
): CommissionSummary {
  const productionFromAppointments = appointmentsInMonth.reduce((acc, app) => {
    const price = app.price !== undefined ? app.price : (services.find(s => s.id === app.serviceId)?.price || 0);
    return acc + price;
  }, 0);

  const productionManual = goalInMonth?.currentValue ?? 0;
  const totalProduction = Math.max(productionFromAppointments, productionManual);

  const commissionRate = professional.commissionRate !== undefined ? professional.commissionRate : 50;
  const commissionValue = (totalProduction * commissionRate) / 100;
  const targetAmount = goalInMonth?.targetAmount ?? 0;
  const goalProgress = targetAmount > 0 ? (totalProduction / targetAmount) * 100 : 0;
  const month = goalInMonth?.month || new Date().toISOString().substring(0, 7);

  return {
    professionalId: professional.id,
    professionalName: professional.name,
    commissionRate,
    productionFromAppointments,
    productionManual,
    totalProduction,
    commissionValue,
    targetAmount,
    goalProgress,
    month
  };
}

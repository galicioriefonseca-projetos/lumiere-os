import { WorkingHours, Appointment, WeekDay } from '../types';

export function getAvailableSlots(
  date: string,              // YYYY-MM-DD
  professionalId: string,
  durationMinutes: number,
  workingHours: WorkingHours,
  existingAppointments: Appointment[]  // todos os appointments do profissional
): string[] {
  if (!workingHours) return [];

  // Determine key for weekday
  const weekDayKeys: WeekDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const weekday = weekDayKeys[d.getDay()];

  const whDay = workingHours[weekday];
  if (!whDay || !whDay.open) {
    return [];
  }

  const startMin = timeToMinutes(whDay.start);
  const endMin = timeToMinutes(whDay.end);
  const breakStartMin = whDay.breakStart ? timeToMinutes(whDay.breakStart) : null;
  const breakEndMin = whDay.breakEnd ? timeToMinutes(whDay.breakEnd) : null;

  // Filter existing appointments
  const dayAppts = existingAppointments.filter(app => {
    // If professionalId is 'any', or is matched
    const isSameProf = professionalId === 'any' || !professionalId || app.professionalId === professionalId;
    const isSameDate = app.date === date;
    const isActive = app.status !== 'canceled' && app.status !== 'no_show';
    return isSameProf && isSameDate && isActive;
  });

  const slots: string[] = [];

  // Iterate in 30-minute steps
  for (let currentMin = startMin; currentMin + durationMinutes <= endMin; currentMin += 30) {
    const slotStart = currentMin;
    const slotEnd = currentMin + durationMinutes;

    // Check if overlaps with break
    if (breakStartMin !== null && breakEndMin !== null) {
      if (slotStart < breakEndMin && slotEnd > breakStartMin) {
        continue;
      }
    }

    // Check overlap with active appointments
    let overlaps = false;
    for (const app of dayAppts) {
      const apptStart = timeToMinutes(app.time);
      const apptDur = app.serviceDuration || 30;
      const apptEnd = apptStart + appptDurDiff(apptDur);

      if (slotStart < apptEnd && slotEnd > apptStart) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      slots.push(minutesToTime(currentMin));
    }
  }

  return slots;
}

// Private helper to prevent small zero duration overlaps
function appptDurDiff(dur: number): number {
  return dur > 0 ? dur : 30;
}

export function getAvailableDays(
  year: number,
  month: number,             // 1-12
  professionalId: string,
  durationMinutes: number,
  workingHours: WorkingHours,
  existingAppointments: Appointment[]
): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const availableDays: string[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const slots = getAvailableSlots(dateStr, professionalId, durationMinutes, workingHours, existingAppointments);
    if (slots.length > 0) {
      availableDays.push(dateStr);
    }
  }

  return availableDays;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

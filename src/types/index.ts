export type Role = 'owner' | 'admin' | 'manager' | 'professional' | 'platform_admin';
export type BusinessType = 'salon' | 'clinic' | 'barbershop' | 'studio' | 'other';
export type PlanType = 'start' | 'studio' | 'performance' | 'network' | 'founder';
export type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'canceled';
export type ActivationStatus = 'active' | 'pending' | 'blocked' | 'canceled';

export interface User {
  id: string; // from Firebase Auth uid
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  salonId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Salon {
  id: string;
  name: string;
  ownerName: string;
  ownerId: string;
  ownerEmail: string;
  phone: string;
  businessType: BusinessType;
  city: string;
  state: string;
  plan: PlanType;
  subscriptionStatus: SubscriptionStatus;
  activationStatus: ActivationStatus;
  trialEndsAt: number;
  isActive: boolean;
  professionalsLimit: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Professional {
  id: string;
  name: string;
  role: string; // Internal salon role/function (e.g. Hairdresser)
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMinutes: number; // in minutes
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'scheduled' | 'completed' | 'canceled' | 'no_show';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Goal {
  id: string;
  title?: string;
  month: string; // YYYY-MM
  targetAmount: number;
  currentAmount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  required: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItemTemplate[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistRun {
  id: string;
  checklistId: string;
  date: string; // YYYY-MM-DD
  completedItems: string[]; // array of item ids
  completionPercentage: number;
  createdAt: number;
  updatedAt: number;
}

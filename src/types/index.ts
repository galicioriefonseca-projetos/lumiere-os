export type Role = 'owner' | 'admin' | 'manager' | 'receptionist' | 'attendant' | 'professional' | 'platform_admin';
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
  professionalId?: string;
  specialty?: string;
  professionalFunction?: string;
  professionalCategory?: string;
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
  isDemo?: boolean;
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
  specialty?: string;
  professionalFunction?: string;
  category?: string;
  joinedByInvite?: boolean;
  inviteId?: string;
  createdAt: number;
  updatedAt: number;
  primaryFunction?: string;
  additionalFunctions?: string[];
  specialties?: string[];
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
  priceType?: 'fixed' | 'from' | 'variable';
  durationMinutes: number; // in minutes
  description?: string;
  isActive: boolean;
  source?: 'template' | 'custom' | string;
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

export interface ProfessionalGoal {
  id: string; // professionalId_month
  professionalId: string;
  professionalName: string;
  month: string; // YYYY-MM
  targetAmount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  required: boolean;
  category?: string;
  points?: number; // max points (e.g. 5)
}

export interface ClassificationRule {
  min: number;
  max: number;
  label: string;
}

export interface Checklist {
  id: string;
  title: string;
  description?: string;
  type?: 'standard' | 'professional_daily_evaluation';
  checklistGroup?: 'operational' | 'professional_evaluation';
  scoringMode?: 'checkbox' | 'rating_1_5';
  scoreBy?: 'item' | 'category';
  maxScore?: number;
  categories?: string[];
  items: ChecklistItemTemplate[];
  classificationRules?: ClassificationRule[];
  scale?: Record<number, string>;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface ChecklistRun {
  id: string;
  checklistId: string;
  checklistTitle?: string;
  checklistType?: string;
  scoringMode?: 'checkbox' | 'rating_1_5';
  date: string; // YYYY-MM-DD
  evaluationDate?: string; // YYYY-MM-DD
  completedItems: string[]; // array of item ids
  completionPercentage: number;
  
  // Professional Evaluation Specifics
  evaluatedProfessionalId?: string;
  evaluatedProfessionalName?: string;
  evaluatorName?: string;
  attendanceStatus?: 'present' | 'absent' | 'not_performed';
  categoryScores?: Record<string, number>; // Maps category name or item id to a score (1-5)
  totalScore?: number;
  maxScore?: number;
  percentage?: number;
  classification?: string;
  observations?: string;
  absenceReason?: string;
  status?: string;

  evaluationFunction?: string;
  evaluatedFunction?: string;
  evaluatedPrimaryFunction?: string;
  professionalFunction?: string;
  primaryFunction?: string;
  professionalFunctions?: string[];

  createdAt: any;
  updatedAt: any;
}

export interface BugReport {
  id: string;
  type: 'bug' | 'feature' | 'question';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  pagePath: string;
  salonId: string;
  salonName: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: any;
  updatedAt: any;
}

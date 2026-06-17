export type Role = 'owner' | 'admin' | 'manager' | 'receptionist' | 'attendant' | 'professional' | 'platform_admin';
export type BusinessType = 'salon' | 'clinic' | 'barbershop' | 'studio' | 'other';
export type PlanType = 'start' | 'studio' | 'performance' | 'network' | 'founder';
export type SubscriptionStatus = 'trial' | 'active' | 'pending_payment' | 'overdue' | 'canceled';
export type ActivationStatus = 'active' | 'pending' | 'blocked' | 'canceled';
export type PaymentStatus = 'none' | 'pending' | 'reported' | 'paid' | 'overdue' | 'rejected' | 'canceled';

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
  status?: string;
  isActive?: boolean;
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
  paymentStatus?: PaymentStatus;
  trialEndsAt: number;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  nextBillingDate?: number;
  lastPaymentAt?: number;
  lastPaymentAmount?: number;
  lastPaymentMethod?: string;
  billingNotes?: string;
  isActive: boolean;
  professionalsLimit: number;
  professionalLimit?: number;
  maxProfessionals?: number;
  isDemo?: boolean;
  isTutorial?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  // Stripe & Billing properties
  billingProvider?: 'manual_pix' | 'stripe' | 'asaas' | 'mercadopago';
  billingMode?: 'manual_pix' | 'recurring_card';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  stripePriceId?: string;
  mercadoPagoPreapprovalId?: string;
  onboardingCompleted?: boolean;
}

export interface Payment {
  id: string;
  salonId: string;
  plan: PlanType;
  amount: number;
  method: 'pix' | 'credit_card';
  status: 'reported' | 'paid' | 'rejected' | 'canceled';
  reportedByUserId: string;
  reportedByEmail: string;
  reportedAt: number;
  confirmedByUserId?: string;
  confirmedByEmail?: string;
  confirmedAt?: number;
  rejectedByUserId?: string;
  rejectedByEmail?: string;
  rejectedAt?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  // Stripe details
  provider?: 'manual_pix' | 'stripe' | 'asaas' | 'mercadopago';
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currency?: string;
}

export interface Professional {
  id: string;
  name: string;
  role: string; // Internal salon role/function (e.g. Hairdresser)
  phone: string;
  email?: string;
  isActive: boolean;
  active?: boolean;
  status?: string;
  deletedAt?: any;
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
  type?: 'service' | 'product';
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

  // CRM fields
  crmStage?: 'new' | 'in_service' | 'scheduled' | 'follow_up' | 'future_return' | 'active' | 'inactive_lost';
  source?: 'instagram' | 'google' | 'indication' | 'whatsapp' | 'walk_in' | 'other';
  sourceLabel?: string;
  responsibleId?: string;
  responsibleName?: string;
  lastContactAt?: string;
  nextActionAt?: string;
  nextActionType?: 'call' | 'whatsapp' | 'schedule' | 'return' | 'note' | 'other';
  tags?: string[];
  lifetimeValue?: number;
  totalAppointments?: number;
  totalSpent?: number;
  status?: 'active' | 'inactive';
  createdBy?: string;
  updatedBy?: string;
  archived?: boolean;
}

export interface ClientHistory {
  id: string;
  type: 'created' | 'stage_changed' | 'note_added' | 'contact_logged' | 'appointment_created' | 'data_updated';
  title: string;
  description: string;
  previousValue?: string;
  newValue?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
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
  currentValue?: number;
  lastProgressUpdateAt?: number;
  lastProgressUpdatedBy?: string;
  createdAt: number;
  updatedAt: number;
  [key: string]: any; // Allow indexing dynamically for fallbacks
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
  attendanceStatus?: 'present' | 'absent' | 'not_performed' | 'not_attended';
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

export interface AuditLog {
  id: string;
  salonId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'report' | 'auth';
  targetEntity: 'checklistRuns' | 'payments' | 'goals' | 'professionals' | 'services' | 'clients' | 'salon' | 'user' | 'financial' | 'inventory' | 'marketing' | 'subscription';
  targetId: string;
  description: string;
  details?: any;
  createdAt: any;
}


export type Role = 'owner' | 'manager' | 'receptionist' | 'attendant' | 'professional' | 'platform_admin';
export type BusinessType = 'salon' | 'clinic' | 'barbershop' | 'studio' | 'other';
export type PublicPlanType = 'essential' | 'professional' | 'performance_plus' | 'multiunit' | 'enterprise_custom';
export type LegacyPlanType = 'start' | 'founder' | 'performance' | 'network' | 'enterprise';
export type PlanType = PublicPlanType | LegacyPlanType;
export type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';
export type SubscriptionStatus = 'preview' | 'active' | 'pending_payment' | 'overdue' | 'canceled';
export type ActivationStatus = 'active' | 'pending' | 'blocked' | 'canceled';
export type PaymentStatus = 'none' | 'pending' | 'reported' | 'paid' | 'overdue' | 'rejected' | 'canceled';

export interface User {
  id: string;
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

export interface WorkingHoursDay { open: boolean; start: string; end: string; breakStart?: string; breakEnd?: string; }
export type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type WorkingHours = { [key in WeekDay]: WorkingHoursDay };

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
  previewEndsAt: number;
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
  billingEmail?: string;
  billingProvider?: 'manual' | 'manual_pix' | 'asaas';
  billingMode?: 'manual_pix' | 'recurring_card' | 'recurring_gateway' | 'one_time_gateway';
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerCheckoutUrl?: string;
  providerLastPaymentId?: string;
  asaasLastEvent?: string;
  billingRequiresMigration?: boolean;
  homologationOrderId?: string;
  homologationOfferId?: string;
  pendingPlan?: string;
  pendingPaymentStatus?: string;
  pendingSubscriptionStatus?: string;
  founderInitialPrice?: number;
  founderInitialPriceEndsAt?: number;
  founderFuturePrice?: number;
  onboardingCompleted?: boolean;
  slug?: string;
  bookingEnabled?: boolean;
  bookingMessage?: string;
  workingHours?: WorkingHours;
  founderAuthorized?: boolean;
  isFounderAuthorized?: boolean;
  pendingPlanChange?: {
    fromPlan: string; toPlan: string; currentAmount: number; targetAmount: number; priceDifference: number;
    targetOfferId: string; requestedAt: number; effectiveAt: number; status: string;
  } | null;
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
  provider?: 'manual_pix' | 'stripe' | 'asaas' | 'mercadopago';
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currency?: string;
}

export interface Professional { id: string; name: string; role: string; phone: string; email?: string; isActive: boolean; active?: boolean; status?: string; deletedAt?: any; specialty?: string; professionalFunction?: string; category?: string; joinedByInvite?: boolean; inviteId?: string; createdAt: number; updatedAt: number; primaryFunction?: string; additionalFunctions?: string[]; specialties?: string[]; commissionRate?: number; }
export interface Category { id: string; name: string; description?: string; isActive: boolean; createdAt: number; updatedAt: number; }
export interface Service { id: string; name: string; category: string; price: number; priceType?: 'fixed' | 'from' | 'variable'; durationMinutes: number; description?: string; isActive: boolean; source?: 'template' | 'custom' | string; type?: 'service' | 'product'; createdAt: number; updatedAt: number; }
export interface Client { id: string; name: string; phone: string; email?: string; notes?: string; createdAt: number; updatedAt: number; crmStage?: 'new' | 'in_service' | 'scheduled' | 'follow_up' | 'future_return' | 'active' | 'inactive_lost'; source?: 'instagram' | 'google' | 'indication' | 'whatsapp' | 'walk_in' | 'other'; sourceLabel?: string; responsibleId?: string; responsibleName?: string; lastContactAt?: string; nextActionAt?: string; nextActionType?: 'call' | 'whatsapp' | 'schedule' | 'return' | 'note' | 'other'; tags?: string[]; lifetimeValue?: number; totalAppointments?: number; totalSpent?: number; status?: 'active' | 'inactive'; createdBy?: string; updatedBy?: string; archived?: boolean; }
export interface ClientHistory { id: string; type: 'created' | 'stage_changed' | 'note_added' | 'contact_logged' | 'appointment_created' | 'data_updated'; title: string; description: string; previousValue?: string; }

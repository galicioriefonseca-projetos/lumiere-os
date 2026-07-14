export type Role = 'owner' | 'manager' | 'receptionist' | 'attendant' | 'professional' | 'platform_admin';
export type BusinessType = 'salon' | 'clinic' | 'barbershop' | 'studio' | 'other';
export type PlanType = 'start' | 'performance' | 'network' | 'founder' | 'enterprise';
export type SubscriptionStatus = 'preview' | 'active' | 'pending_payment' | 'overdue' | 'canceled';
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

export interface WorkingHoursDay {
  open: boolean;
  start: string; // "09:00"
  end: string;   // "18:00"
  breakStart?: string; // "12:00"
  breakEnd?: string;   // "13:00"
}

export type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type WorkingHours = {
  [key in WeekDay]: WorkingHoursDay;
};

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
  // Stripe & Billing properties (Active providers: manual_pix, cakto. Others are deprecated)
  billingProvider?: 'manual_pix' | 'cakto' | 'stripe' | 'asaas' | 'mercadopago';
  billingMode?: 'manual_pix' | 'recurring_card';
  /** @deprecated Use Cakto instead */
  stripeCustomerId?: string;
  /** @deprecated Use Cakto instead */
  stripeSubscriptionId?: string;
  /** @deprecated Use Cakto instead */
  stripeCheckoutSessionId?: string;
  /** @deprecated Use Cakto instead */
  stripePriceId?: string;
  /** @deprecated Use Cakto instead */
  mercadoPagoPreapprovalId?: string;
  /** @deprecated Use Cakto instead */
  asaasCustomerId?: string;
  /** @deprecated Use Cakto instead */
  asaasSubscriptionId?: string;
  /** @deprecated Use Cakto instead */
  asaasCheckoutUrl?: string;
  /** @deprecated Use Cakto instead */
  asaasLastPaymentId?: string;
  /** @deprecated Use Cakto instead */
  asaasLastEvent?: string;
  caktoCustomerId?: string;
  caktoSubscriptionId?: string;
  caktoOrderId?: string;
  caktoCheckoutUrl?: string;
  caktoOfferId?: string;
  billingRequiresMigration?: boolean;
  homologationSubscriptionId?: string;
  homologationOrderId?: string;
  homologationOfferId?: string;
  homologationLastEvent?: string;
  homologationUpdatedAt?: number;
  homologationCustomerId?: string;
  homologationCheckoutUrl?: string;
  pendingPlan?: string;
  pendingOfferId?: string;
  pendingCheckoutUrl?: string;
  pendingCheckoutEmail?: string;
  pendingPaymentStatus?: string;
  pendingSubscriptionStatus?: string;
  founderInitialPrice?: number;
  founderInitialPriceEndsAt?: number;
  founderFuturePrice?: number;
  onboardingCompleted?: boolean;
  slug?: string;               // ex: "studio-bella" — URL única do salão
  bookingEnabled?: boolean;    // habilitar/desabilitar agendamento online
  bookingMessage?: string;     // mensagem de boas-vindas na tela de agendamento
  workingHours?: WorkingHours; // horários de funcionamento
  founderAuthorized?: boolean;
  isFounderAuthorized?: boolean;
  pendingPlanChange?: {
    fromPlan: string;
    toPlan: string;
    currentAmount: number;
    targetAmount: number;
    priceDifference: number;
    targetOfferId: string;
    requestedAt: number;
    effectiveAt: number;
    status: string;
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
  // Stripe details (Legacy)
  provider?: 'manual_pix' | 'stripe' | 'asaas' | 'mercadopago';
  /** @deprecated */
  stripePaymentIntentId?: string;
  /** @deprecated */
  stripeInvoiceId?: string;
  /** @deprecated */
  stripeSubscriptionId?: string;
  /** @deprecated */
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
  commissionRate?: number;
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
  status: 'scheduled' | 'confirmed' | 'completed' | 'canceled' | 'no_show';
  notes?: string;
  source?: 'manual' | 'client_booking'; // origem do agendamento
  clientPhone?: string;                  // para agendamentos online (sem cadastro)
  clientEmail?: string;
  serviceDuration?: number;              // duração em minutos
  price?: number;                        // valor cobrado
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

export interface ProductionLog {
  id: string;
  salonId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  pagePath: string;
  userAgent: string;
  isActive: boolean;
  deletedAt?: number | null;
  createdAt: number | any;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;        // emoji
  description: string;
  earnedAt: number;
  category: 'production' | 'evaluation' | 'streak' | 'ranking' | 'special';
}

export interface GamificationProfile {
  id: string;             // professionalId
  fullName: string;
  role: string;
  avatarUrl?: string;
  
  // XP & Nível
  totalXP: number;
  monthlyXP: number;      // XP acumulado no mês corrente (reinicia dia 1)
  level: number;
  
  // Streak de excelência (scoreComposto >= 80%)
  currentStreakDays: number;
  maxStreakDays: number;
  lastActiveDate?: string; // YYYY-MM-DD para controle de quebra do streak
  
  // Histórico de Conquistas
  badges: Badge[];
  
  // Scores Recentes (para gráfico de linha)
  recentScores: {
    date: string;         // YYYY-MM-DD
    score: number;        // scoreComposto do dia (0 a 100)
    productionScore: number;
    evaluationScore: number;
  }[];
  
  updatedAt: number;
}

// XP thresholds for each level
export const XP_LEVELS: Record<number, number> = {
  1: 100,
  2: 250,
  3: 500,
  4: 1000,
  5: 2000,
  6: 4000,
  7: 8000,
  8: 15000,
  9: 30000,
  10: 50000
};

// XP awarded for each event
export const XP_EVENTS = {
  EVALUATION_COMPLETED: 50,  // Participar da avaliação diária (ser avaliado)
  EVAL_AVERAGE_EXCELLENCE: 100, // Tirar nota de excelência (totalScore >= 35)
  GOAL_PROG_25: 20,          // Bater 25% da meta mensal
  GOAL_PROG_50: 40,          // Bater 50% da meta mensal
  GOAL_PROG_75: 60,          // Bater 75% da meta mensal
  GOAL_COMPLETED: 150,       // Bater 100% da meta mensal
  STREAK_3_DAYS: 30,         // Manter 3 dias de streak
  STREAK_7_DAYS: 70,         // Manter 7 dias de streak
  STREAK_15_DAYS: 150,        // Manter 15 dias de streak
  MONTHLY_GOAL_HIT: 500      // Bater a meta do mês
};

// Available badges
export const AVAILABLE_BADGES = [
  { id: 'prod_bronze', name: 'Produtor Bronze', icon: '🥉', description: 'Bateu 100% da primeira meta mensal', category: 'production' },
  { id: 'prod_silver', name: 'Produtor Prata', icon: '🥈', description: 'Duas metas consecutivas batidas no ano', category: 'production' },
  { id: 'prod_gold', name: 'Produtor Gold', icon: '🥇', description: 'Três metas consecutivas batidas no ano', category: 'production' },
  { id: 'prod_star', name: 'Estrela de Produção', icon: '⭐', description: 'Bateu 150% ou mais da meta mensal', category: 'production' },
  { id: 'eval_excl', name: 'Profissional de Excelência', icon: '💎', description: 'Tirou nota máxima no checklist diário', category: 'evaluation' },
  { id: 'eval_perfect_week', name: 'Semana Perfeita', icon: '🦄', description: 'Média de avaliações >= 4.8 na semana', category: 'evaluation' },
  { id: 'streak_fire', name: 'No Fogo do Hábito', icon: '🔥', description: 'Alcançou 7 dias seguidos de streak', category: 'streak' },
  { id: 'streak_master', name: 'Inabalável', icon: '🧬', description: 'Alcançou 15 dias seguidos de streak', category: 'streak' },
  { id: 'rank_first', name: 'Campeão Mensal', icon: '🏆', description: 'Terminou o Ranking em 1º lugar no mês', category: 'ranking' }
] as const;



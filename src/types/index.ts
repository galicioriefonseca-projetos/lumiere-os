export type Role = 'owner' | 'manager' | 'receptionist' | 'attendant' | 'professional' | 'platform_admin' | 'client';
export type BusinessType = 'salon' | 'clinic' | 'barbershop' | 'studio' | 'agency' | 'other';
export type PlanType = 'start' | 'performance' | 'network' | 'founder' | 'enterprise';
export type SubscriptionStatus = 'preview' | 'active' | 'pending_payment' | 'overdue' | 'canceled';
export type ActivationStatus = 'active' | 'pending' | 'blocked' | 'canceled';
export type PaymentStatus = 'none' | 'pending' | 'reported' | 'paid' | 'overdue' | 'rejected' | 'canceled';

export type NicheType = 'salon' | 'clinic' | 'studio' | 'freelancer' | 'agency' | 'consulting';

export interface VocabularyConfig {
  clientTerm: string;
  clientTermPlural: string;
  workstationTerm: string;
  workstationTermPlural: string;
  professionalTerm: string;
  professionalTermPlural: string;
  serviceTerm: string;
  serviceTermPlural: string;
  appointmentTerm: string;
  appointmentTermPlural: string;
  workplaceTerm: string;
  workplaceTermPlural: string;
  flowItemTerm: string;
  flowItemTermPlural: string;
}

export interface UiPreferences {
  themeBadge: string;
  defaultView: 'flow' | 'calendar' | 'agenda';
  primaryIcon: string;
  enableComandasFlow: boolean;
  enableWorkstations: boolean;
  enableClientPortal: boolean;
  enableMedicalRecords: boolean;
}

export interface ContextConfig {
  niche: NicheType;
  nicheLabel: string;
  vocabulary: VocabularyConfig;
  uiPreferences: UiPreferences;
  customOverrides?: Partial<VocabularyConfig>;
  updatedAt: number;
}

export interface User {
  id: string; // from Firebase Auth uid
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  salonId: string;
  clientId?: string;
  portalAccessEnabled?: boolean;
  agencySalonId?: string;
  companyName?: string;
  professionalId?: string;
  specialty?: string;
  professionalFunction?: string;
  professionalCategory?: string;
  status?: string;
  isActive?: boolean;
  onboardingStatus?: 'pending_payment' | 'pending_setup' | 'completed';
  photoURL?: string;
  avatarUrl?: string;
  bio?: string;
  headline?: string;
  instagram?: string;
  linkedin?: string;
  whatsapp?: string;
  website?: string;
  specialties?: string[];
  bannerUrl?: string;
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
  businessType: BusinessType | 'agency' | 'consulting' | 'services' | string;
  segment?: 'beauty' | 'agency' | 'consulting' | 'health' | 'services' | string;
  managementMode?: 'liberal' | 'business' | string;
  enabledModules?: Record<string, boolean>;
  contextConfig?: ContextConfig;
  monthlyGoal?: number;
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
  // Stripe & Billing properties (Active providers: manual_pix, asaas)
  billingProvider?: 'manual' | 'manual_pix' | 'asaas';
  billingMode?: 'manual_pix' | 'recurring_card' | 'recurring_gateway' | 'one_time_gateway';
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerCheckoutUrl?: string;
  providerLastPaymentId?: string;
  asaasLastEvent?: string;
  billingRequiresMigration?: boolean;
  billing?: Record<string, any>;
  homologationOrderId?: string;
  homologationOfferId?: string;
  pendingPlan?: string;
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
  photoURL?: string;
  avatarUrl?: string;
  userId?: string;
  professionalId?: string;
  pushEnabled?: boolean;
  fcmToken?: string;
  fcmTokens?: string[];
  pushPreferences?: {
    onConfirmed: boolean;
    onCanceled: boolean;
  };
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
  costPrice?: number;
  priceType?: 'fixed' | 'from' | 'variable';
  durationMinutes: number; // in minutes
  description?: string;
  isActive: boolean;
  onlineBookingEnabled?: boolean;
  source?: 'template' | 'custom' | string;
  type?: 'service' | 'product';
  createdAt: number;
  updatedAt: number;
}

export type ClientGender = 'female' | 'male' | 'other' | 'prefer_not_to_say';

export interface ClientAddress {
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export type ClientFormResponseValue = string | number | boolean | string[];

export interface Client {
  id: string;
  name: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  gender?: ClientGender | string;
  birthDate?: string; // YYYY-MM-DD
  cpf?: string;
  rg?: string;
  address?: ClientAddress;
  notes?: string;
  anamneseResponses?: Record<string, ClientFormResponseValue>;
  prontuarioResponses?: Record<string, ClientFormResponseValue>;
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
  creditBalance?: number; // positive = crédito disponível, negative = saldo em aberto / fiado
  status?: 'active' | 'inactive';
  mergedIntoClientId?: string;
  createdBy?: string;
  updatedBy?: string;
  archived?: boolean;
  deletedAt?: number | null;
}

export type ClientFormScope = 'anamnese' | 'prontuario';

export type ClientCustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean';

export interface ClientCustomField {
  id: string;
  scope: ClientFormScope;
  label: string;
  slug: string;
  type: ClientCustomFieldType;
  order: number;
  defaultValue?: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ClientNoticeSeverity = 'info' | 'warning' | 'critical';

export interface ClientNotice {
  id: string;
  title: string;
  message: string;
  severity: ClientNoticeSeverity;
  triggers: {
    onSchedule: boolean;
    onComanda: boolean;
  };
  targetType: 'clients' | 'tags' | 'all';
  clientIds: string[];
  targetTags: string[];
  isActive: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: number;
  updatedAt: number;
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

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'waiting'
  | 'in_service'
  | 'completed'
  | 'canceled'
  | 'no_show'
  | 'blocked';

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
  endTime?: string; // HH:mm
  status: AppointmentStatus;
  notes?: string;
  source?: 'manual' | 'client_booking'; // origem do agendamento
  clientPhone?: string;                  // para agendamentos online (sem cadastro)
  clientEmail?: string;
  serviceDuration?: number;              // duração em minutos
  price?: number;                        // valor cobrado
  isBlock?: boolean;                     // bloqueio de horário na agenda
  confirmToken?: string;
  confirmationStatus?: 'pending' | 'awaiting_client' | 'confirmed_by_client' | 'declined_by_client';
  whatsappSentAt?: number;
  confirmedAt?: number;
  canceledAt?: number;
  confirmationChannel?: 'whatsapp_cloud' | 'whatsapp_link' | 'public_link' | 'manual';
  whatsappMessageId?: string;
  resourceId?: string;
  resourceName?: string;
  comandaId?: string;
  isManualLaunch?: boolean;
  paymentMethod?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WeeklyGoalSplit {
  weekNumber: number; // 1, 2, 3, 4
  label: string;      // "Semana 1 (01 a 07)", etc.
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  targetAmount: number;
  currentAmount?: number;
}

export interface Goal {
  id: string;
  title?: string;
  month: string; // YYYY-MM
  periodType?: 'mensal' | 'semanal';
  targetAmount: number;
  currentAmount: number;
  weeklyGoals?: WeeklyGoalSplit[];
  weeklyDistributionMode?: 'equal' | 'custom';
  createdAt: number;
  updatedAt: number;
}

export interface ProfessionalGoal {
  id: string; // professionalId_month
  professionalId: string;
  professionalName: string;
  month: string; // YYYY-MM
  periodType?: 'mensal' | 'semanal';
  targetAmount: number;
  currentValue?: number;
  weeklyGoals?: WeeklyGoalSplit[];
  weeklyDistributionMode?: 'equal' | 'custom';
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
  qualityEvent?: {
    type: 'customer_complaint';
    occurred: boolean;
    relatedToProfessional: boolean;
    description?: string;
    penalty?: number;
  };

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

// --- Área do Cliente / Client Portal Types ---
export interface ClientReport {
  id: string;
  salonId: string;
  clientId?: string | null;
  clientName: string;
  clientEmail?: string;
  title: string;
  period: string;
  summary: string;
  reportType?: 'general' | 'google_meu_negocio' | 'meta_ads' | 'seo';
  metrics: {
    leads?: number;
    reach?: number;
    conversions?: number;
    investment?: number;
    revenue?: number;
    roas?: number;
    cpc?: number;
    cpl?: number;
  };
  gmbMetrics?: {
    // Interações no Perfil da Empresa
    totalInteractions?: number; // Total de interações no perfil da empresa
    calls?: number; // Chamadas telefônicas diretas
    chatClicks?: number; // Cliques no chat / mensagens
    bookings?: number; // Agendamentos iniciados pelo perfil
    directionRequests?: number; // Orientações / Solicitações de rota (Waze / Google Maps)
    websiteClicks?: number; // Cliques no website
    
    // Histórico de Interações Mês a Mês do GMN
    monthlyInteractions?: Array<{
      month: string; // ex: "junho de 2026"
      interactions: number; // ex: 63
    }>;

    // Como as pessoas descobriram sua empresa (Visualizações do Perfil)
    peopleViewedProfile?: number; // Número total de pessoas que visualizaram o Perfil da Empresa
    mapsImpressions?: number; // Impressões no Google Maps
    searchImpressions?: number; // Impressões no Google Search
    
    // Detalhes sobre a plataforma e o dispositivo
    platformBreakdown?: {
      searchMobile?: { count: number; percentage: number }; // Pesquisa Google - dispositivos móveis
      mapsMobile?: { count: number; percentage: number }; // Google Maps - dispositivos móveis
      searchDesktop?: { count: number; percentage: number }; // Pesquisa Google - computadores
      mapsDesktop?: { count: number; percentage: number }; // Google Maps - computadores
    };

    rankingPosition?: number; // Posição no Mapa local (ex: 1, 2, 3...)
    targetKeyword?: string; // Palavra-chave principal monitorada
    topKeywords?: Array<{ keyword: string; count?: number } | string>; // Consultas de busca
    rating?: number; // Avaliação média (ex: 4.9)
    reviewsCount?: number; // Total de avaliações
  };
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  month?: number;     // 1 a 12
  year?: number;      // ex: 2026
  externalUrl?: string;
  fileUrl?: string;
  status: 'published' | 'draft';
  publishedAt?: number | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClientContract {
  id: string;
  salonId: string;
  clientId?: string | null;
  clientName: string;
  clientEmail?: string;
  title: string;
  contractType: 'retainer_monthly' | 'project' | 'setup_onboarding' | 'consulting' | 'nda' | string;
  monthlyValue: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'pending_signature' | 'signed' | 'review' | 'canceled';
  scope: string;
  signedDocumentUrl?: string;
  paymentTerms?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClientPortalInvite {
  id: string;
  token: string;
  salonId: string;
  agencyName: string;
  inviteType: 'client';
  role: 'client';
  clientName: string;
  companyName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientId?: string | null;
  notes?: string;
  status: 'pending' | 'accepted' | 'expired' | 'canceled';
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  acceptedAt?: number;
  acceptedByEmail?: string;
}

export interface ClientApproval {
  id: string;
  salonId: string;
  clientId?: string | null;
  clientName?: string;
  title: string;
  description?: string;
  type: 'instagram_post' | 'landing_page' | 'gmn_post' | 'other';
  mediaUrl?: string;
  copyText?: string;
  previewUrl?: string;
  status: 'pending' | 'approved' | 'revisions_requested';
  clientFeedback?: string;
  approvedAt?: number | null;
  feedbackAt?: number | null;
  createdBy?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ClientTicketMessage {
  id: string;
  senderRole: 'client' | 'agency';
  senderName: string;
  text: string;
  createdAt: number;
}

export interface ClientTicket {
  id: string;
  salonId: string;
  clientId?: string | null;
  clientName?: string;
  clientEmail?: string;
  subject: string;
  category: 'google_meu_negocio' | 'site_landing_page' | 'instagram' | 'geral';
  priority: 'baixa' | 'media' | 'alta';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  messages: ClientTicketMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ClientDeliverable {
  id: string;
  salonId: string;
  clientId?: string | null;
  clientName?: string;
  title: string;
  category: 'google_meu_negocio' | 'site_landing_page' | 'instagram' | 'geral';
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  deliverableUrl?: string;
  completedAt?: number | null;
  createdAt: number;
}

export interface ClientServiceRequest {
  id: string;
  salonId: string;
  clientId?: string | null;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceId: string;
  serviceName: string;
  category: 'google_meu_negocio' | 'site_landing_page' | 'instagram';
  notes?: string;
  status: 'requested' | 'in_review' | 'quoted' | 'accepted' | 'declined';
  createdAt: number;
  updatedAt?: number;
}

export interface LumiereSystemUser {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  salonId: string;
  salonName: string;
  city?: string;
  state?: string;
  portalAccessEnabled: boolean;
  linkedClientId: string | null;
  reportsCount: number;
  createdAt: number;
}

export interface PackageIncludedService {
  serviceId: string;
  serviceName: string;
  sessions: number;
}

export interface ServicePackage {
  id: string;
  salonId?: string;
  name: string;
  description?: string;
  includedServices: PackageIncludedService[];
  price: number;
  validityDays: number;
  isActive: boolean;
  onlineBookingEnabled?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SalonResourceType = 'room' | 'equipment' | 'chair' | 'other';

export interface SalonResource {
  id: string;
  salonId?: string;
  name: string;
  type: SalonResourceType;
  description?: string;
  quantity: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ComandaItem {
  type: 'service' | 'product' | 'package';
  id: string;
  name: string;
  quantity?: number;
  unitPrice?: number;
  discountPercent?: number;
  price: number; // subtotal líquido do item (unitPrice * qty - desconto)
  professionalId: string;
  professionalName: string;
  appointmentId?: string;
  updatedByName?: string;
  updatedAt?: number;
}

export interface ComandaPaymentSplit {
  id: string;
  method: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer' | 'client_credit' | 'other';
  amount: number;
  info?: string;
}

export interface ComandaFlow {
  id: string;
  comandaNumber?: number;
  clientId: string;
  clientName: string;
  status: 'checked_in' | 'in_service' | 'checkout_pending' | 'completed' | 'canceled';
  items: ComandaItem[];
  date: string;
  time: string;
  notes?: string;
  prontuarioNotes?: string;
  paymentMethod?: string;
  paymentSplits?: ComandaPaymentSplit[];
  cashRegisterName?: string;
  totalAmount: number;
  servicesTotal?: number;
  productsTotal?: number;
  discount?: number;
  charges?: number;
  finalTotal?: number;
  paidAmount?: number;
  clientBalanceDelta?: number;
  openedByName?: string;
  updatedByName?: string;
  lastItemUpdatedByName?: string;
  lastItemUpdatedAt?: number;
  closedByName?: string;
  closedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  netAmount?: number;
  type: 'revenue' | 'expense';
  category: string;
  date: string;
  status?: 'paid' | 'pending';
  paymentMethod: string;
  cashRegisterName?: string;
  comandaId?: string;
  comandaNumber?: number;
  payoutId?: string;
  createdByName?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface CommissionAdjustment {
  id: string;
  professionalId: string;
  professionalName: string;
  type: 'bonus' | 'discount';
  amount: number;
  description: string;
  date: string;
  month: string; // YYYY-MM
  status: 'pending' | 'settled';
  payoutId?: string;
  createdByName?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface CommissionPayoutItem {
  professionalId: string;
  professionalName: string;
  role?: string;
  rateioAmount: number;
  bonusAmount: number;
  discountAmount: number;
  netAmount: number;
  adjustmentsAppliedIds?: string[];
}

export interface CommissionPayout {
  id: string;
  periodStart: string;
  periodEnd: string;
  monthLabel?: string;
  paymentMethod: string;
  cashRegisterName?: string;
  notes?: string;
  totalAmount: number;
  professionalsCount: number;
  items: CommissionPayoutItem[];
  paidByName?: string;
  paidAt: number;
  createdAt: number;
}

export type SalonNotificationType =
  | 'appointment_confirmed'
  | 'appointment_canceled'
  | 'appointment_created'
  | 'system'
  | 'alert';

export interface SalonNotification {
  id: string;
  type: SalonNotificationType | string;
  title: string;
  message: string;
  appointmentId?: string;
  professionalId?: string;
  professionalName?: string;
  clientName?: string;
  date?: string;
  time?: string;
  actionUrl?: string;
  pushDispatched?: boolean;
  pushTokensCount?: number;
  read: boolean;
  readAt?: number;
  createdAt: number;
}

export type StockLocation = 'resale' | 'internal_use' | 'warehouse' | 'mixed';

export interface ProductSupplierLink {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCode?: string;
  supplierDescription?: string;
  costPrice: number;
}

export interface InventoryItem {
  id: string;
  salonId?: string;
  name: string;
  brand: string;
  line?: string;
  sku: string; // Código interno
  barcode?: string; // Código de barras EAN
  category: string;
  stockLocation?: StockLocation;
  unit?: string; // un, ml, g, cx, kg, L
  characteristics?: string;
  description?: string;
  quantity: number;
  minQuantity: number;
  idealQuantity?: number;
  costPrice: number;
  sellingPrice: number;
  supplier: string;
  supplierId?: string;
  supplierLinks?: ProductSupplierLink[];
  nextExpirationDate?: string; // YYYY-MM-DD
  batchCode?: string;
  createdAt?: number;
  updatedAt: number;
}

export interface Supplier {
  id: string;
  salonId?: string;
  tradeName: string; // Nome Fantasia
  companyName?: string; // Razão Social
  document?: string; // CNPJ ou CPF
  contactName?: string; // Responsável
  website?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  zipCode?: string;
  state?: string;
  city?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  notes?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'canceled';

export interface PurchaseOrderItem {
  id: string;
  productId?: string; // empty when creating a brand new product from NF-e
  productName: string;
  sku?: string;
  barcode?: string;
  brand?: string;
  category?: string;
  stockLocation?: StockLocation;
  quantity: number;
  unitCost: number;
  totalCost: number;
  expirationDate?: string;
  createNewProduct?: boolean;
}

export interface PurchaseOrder {
  id: string;
  salonId?: string;
  orderNumber: string;
  supplierId?: string;
  supplierName: string;
  supplierDocument?: string;
  status: PurchaseOrderStatus;
  origin: 'manual' | 'nfe_xml' | 'auto_restock';
  invoiceNumber?: string;
  invoiceKey?: string;
  orderDate: string; // YYYY-MM-DD
  expectedDeliveryDate?: string;
  receivedDate?: string;
  items: PurchaseOrderItem[];
  totalCost: number;
  recordFinancialExpense?: boolean;
  notes?: string;
  createdByName?: string;
  receivedByName?: string;
  createdAt: number;
  updatedAt: number;
}

export type StockMovementType =
  | 'in'
  | 'out'
  | 'inventory_adjustment'
  | 'comanda_sale'
  | 'purchase_order'
  | 'requisition';

export interface StockMovement {
  id: string;
  salonId?: string;
  productId: string;
  productName: string;
  productSku?: string;
  type: StockMovementType;
  quantityDelta: number; // positive for entries, negative for exits
  previousQuantity: number;
  newQuantity: number;
  unitCost?: number;
  totalCost?: number;
  reason: string;
  notes?: string;
  expirationDate?: string;
  supplierId?: string;
  supplierName?: string;
  professionalId?: string;
  professionalName?: string;
  comandaId?: string;
  purchaseOrderId?: string;
  inventorySessionId?: string;
  requisitionId?: string;
  movementDate: string; // YYYY-MM-DD
  performedById: string;
  performedByName: string;
  createdAt: number;
}

export interface StockInventoryItemCount {
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  stockLocation?: StockLocation;
  systemQty: number;
  countedQty: number;
  diffQty: number;
  unitCost: number;
  financialImpact: number;
  counted: boolean;
}

export interface StockInventoryScanLog {
  id: string;
  query: string;
  productId: string;
  productName: string;
  delta: number;
  scannedAt: number;
}

export interface StockInventorySession {
  id: string;
  salonId?: string;
  sessionNumber: string;
  date: string; // YYYY-MM-DD
  stockLocationFilter: 'all' | StockLocation;
  status: 'draft' | 'completed';
  responsibleName: string;
  items: StockInventoryItemCount[];
  scanLogs: StockInventoryScanLog[];
  missingUnitsTotal: number;
  surplusUnitsTotal: number;
  balanceImpactAmount: number;
  notes?: string;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type StockRequisitionStatus = 'pending' | 'approved' | 'rejected';

export interface StockRequisition {
  id: string;
  salonId?: string;
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  requesterId: string;
  requesterName: string;
  professionalId?: string;
  professionalName?: string;
  serviceId?: string;
  serviceName?: string;
  comandaId?: string;
  comandaNumber?: number;
  notes?: string;
  status: StockRequisitionStatus;
  reviewedByName?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface NfeParsedItem {
  code: string;
  ean: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface NfeParsedInvoice {
  invoiceNumber: string;
  invoiceKey: string;
  issueDate: string;
  totalValue: number;
  supplier: {
    document: string;
    companyName: string;
    tradeName: string;
    phone?: string;
    zipCode?: string;
    state?: string;
    city?: string;
    address?: string;
    number?: string;
    neighborhood?: string;
  };
  items: NfeParsedItem[];
}

// =====================================================
// LUMIÈRE CRM 360° (OMNICHANNEL WHATSAPP, FUNIL & IA)
// =====================================================

export type CrmOrigin = 'receptivo' | 'confirmacao' | 'marketing' | 'attendant';

export type CrmFunnelStage =
  | 'awaiting_reply'
  | 'in_service'
  | 'interested'
  | 'scheduled'
  | 'lost'
  | 'other';

export type CrmHandlingMode = 'ai' | 'human' | 'handoff';

export interface CrmConversation {
  id: string;
  salonId?: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  channel: 'whatsapp';
  status: 'awaiting_reply' | 'in_service' | 'resolved';
  handlingMode: CrmHandlingMode;
  assignedAttendantId?: string;
  assignedAttendantName?: string;
  aiPausedForClient?: boolean;
  isPinned?: boolean;
  unreadCount: number;
  lastMessageText: string;
  lastMessageAt: number;
  lastMessageDirection: 'inbound' | 'outbound' | 'system';
  lastInboundAt?: number;
  firstResponseAt?: number;
  firstResponseMs?: number;
  origin: CrmOrigin;
  opportunityId?: string;
  opportunityNumber?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CrmMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound' | 'system';
  senderType: 'client' | 'attendant' | 'ai' | 'system';
  senderId?: string;
  senderName?: string;
  body: string;
  mediaType?: 'text' | 'image' | 'audio' | 'document';
  deliveryStatus: 'sent' | 'delivered' | 'read' | 'queued' | 'failed';
  waMessageId?: string;
  createdAt: number;
}

export interface CrmOpportunityNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
}

export interface CrmOpportunityHistoryEntry {
  id: string;
  action: string;
  detail: string;
  actorName: string;
  createdAt: number;
}

export interface CrmOpportunity {
  id: string;
  opportunityNumber: number;
  conversationId?: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  stage: CrmFunnelStage;
  origin: CrmOrigin;
  assignedAttendantId?: string;
  assignedAttendantName?: string;
  estimatedValue: number;
  valueSource: 'ai' | 'appointment' | 'manual';
  serviceInterest?: string;
  linkedAppointmentId?: string;
  linkedAppointmentDate?: string;
  linkedAppointmentTime?: string;
  isRescheduled?: boolean;
  closeReason?: string;
  closeComment?: string;
  waitingSince?: number;
  movedManually?: boolean;
  notes?: CrmOpportunityNote[];
  history?: CrmOpportunityHistoryEntry[];
  closedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type CrmCampaignType =
  | 'confirmation'
  | 'birthday'
  | 'service_return'
  | 'inactive_clients'
  | 'post_service_csat';

export interface CrmCampaign {
  id: string;
  type: CrmCampaignType;
  title: string;
  description: string;
  enabled: boolean;
  messageTemplate: string;
  imageUrl?: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  dailyLimit: number;
  config: {
    daysBefore?: number;
    inactiveMonths?: number;
    blockBookedNextDays?: number;
    defaultReturnDays?: number;
    birthdayTiming?: 'on_day' | 'days_before' | 'month_start';
    birthdayDaysBefore?: number;
    activeRecentMonths?: number;
  };
  metrics: {
    sentCount: number;
    deliveredCount: number;
    repliedCount: number;
    convertedBookings: number;
    recoveredRevenue: number;
    csatSum: number;
    csatCount: number;
  };
  lastRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CrmCampaignDispatch {
  id: string;
  campaignId: string;
  campaignType: CrmCampaignType;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  status: 'sent' | 'postponed' | 'replied' | 'converted' | 'failed';
  statusReason?: string;
  renderedMessage: string;
  csatRating?: number;
  convertedRevenue?: number;
  dispatchedAt: number;
  createdAt: number;
}

export interface CrmQuickReply {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  scope: 'salon' | 'personal';
  ownerUid?: string;
  ownerName?: string;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CrmAttendant {
  id: string;
  userId?: string;
  professionalId?: string;
  name: string;
  email: string;
  permission: 'admin' | 'attendant' | 'viewer';
  isOnline: boolean;
  useSignature: boolean;
  canDeleteCards: boolean;
  canAssumeConversations: boolean;
  conversationsHandled: number;
  messagesSent: number;
  avgFirstResponseMs: number;
  scheduledCount: number;
  generatedRevenue: number;
  lastSeenAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CrmSettings {
  id?: string;
  funnelRules: {
    awaitingReplyAlertHours: number;
    inServiceStalledDays: number;
    autoLostDays: number;
    aiHandoffTimeoutMinutes: number;
    reopenWindowDays: number;
    autoEstimateWithAi: boolean;
    autoLinkClientByPhone: boolean;
  };
  teamRules: {
    requireSignature: boolean;
    privateConversations: boolean;
    autoAssignOnReply: boolean;
  };
  aiConfig: {
    enabled: boolean;
    agentName: string;
    tone: 'acolhedor' | 'sofisticado' | 'objetivo';
    greetingMessage: string;
    qualificationInstructions: string;
    handoffOnPriceObjection: boolean;
    handoffOnHumanRequest: boolean;
    workingHoursOnly: boolean;
  };
  updatedAt: number;
}


export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface PlayerProfile {
  id: string;
  position?: string;
  jerseyNumber?: number;
  federationId?: string;
  medicalPassDue?: string;
  notes?: string;
}

export interface Discipline {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  icon?: string;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categories: Category[];
}

export interface Category {
  id: string;
  tenantId: string;
  disciplineId: string;
  name: string;
  ageFrom?: number;
  ageTo?: number;
  gender?: 'MALE' | 'FEMALE' | 'MIXED';
  feeAmount?: string;
  schedule?: string;
  isActive: boolean;
  discipline: { id: string; name: string };
}

export interface Enrollment {
  id: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    discipline: { id: string; name: string };
  };
  member?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface Member {
  id: string;
  tenantId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  dni: string;
  email?: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  photoUrl?: string;
  status: MemberStatus;
  notes?: string;
  hasPin?: boolean;
  createdAt: string;
  updatedAt: string;
  player?: PlayerProfile;
  enrollments: Enrollment[];
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FeeType {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export type FeeStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';

export interface Fee {
  id: string;
  tenantId: string;
  memberId: string;
  feeTypeId: string;
  categoryId?: string;
  period: string;
  amount: string;
  paidAmount: string;
  dueDate?: string;
  status: FeeStatus;
  externalReference?: string;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
  };
  feeType: { id: string; name: string } | null;
  category?: {
    id: string;
    name: string;
    discipline: { name: string };
  };
  payments: Payment[];
}

export type PaymentMethod =
  | 'CASH'
  | 'TRANSFER'
  | 'MERCADO_PAGO'
  | 'DEBIT'
  | 'CREDIT'
  | 'OTHER';

export interface Payment {
  id: string;
  amount: string;
  method: PaymentMethod;
  status: string;
  reference?: string;
  paidAt: string;
}

export interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: string;
  description?: string;
  date: string;
  // Los movimientos no se borran: se anulan con motivo y dejan de sumar
  status: 'ACTIVE' | 'VOIDED';
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
}

// Montos como string decimal (ver lib/money.ts)
export interface DashboardSummary {
  period: string;
  activeMembers: number;
  totalMembers: number;
  feesThisMonth: number;
  collectedThisMonth: string;
  incomeThisMonth: string;
  expenseThisMonth: string;
  balanceThisMonth: string;
}

export interface CashClosure {
  date: string;
  transactionsIncome: string;
  transactionsExpense: string;
  paymentsIncome: string;
  totalIncome: string;
  totalExpense: string;
  balance: string;
}

export interface Attendance {
  id: string;
  categoryId: string;
  memberId: string;
  date: string;
  present: boolean;
  notes?: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
  };
  category: {
    id: string;
    name: string;
    discipline: { name: string };
  };
}

export type StaffRole = 'ADMIN' | 'OPERATOR' | 'TEACHER' | 'STAFF';

export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export interface ClubConfig {
  name: string;
  legalName?: string | null;
  document?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  monthlyFee?: string | null;
  // Enmascarados por la API ("APP_USR-****1234"); null si no están cargados
  mpAccessToken?: string | null;
  mpWebhookSecret?: string | null;
  heroImageUrl?: string | null;
  timezone?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  published: boolean;
  publishedAt?: string | null;
  createdAt: string;
}

export interface ClubEvent {
  id: string;
  title: string;
  description?: string | null;
  eventDate: string;
  location?: string | null;
  isPublic: boolean;
}

export interface DelinquentMember {
  member: {
    id: string;
    memberNumber?: string | null;
    firstName: string;
    lastName: string;
    dni: string;
    phone?: string | null;
    email?: string | null;
  };
  fees: {
    id: string;
    period: string;
    concept: string;
    category?: string | null;
    owed: string;
    dueDate?: string | null;
    status: FeeStatus;
  }[];
  total: string;
  feesCount: number;
  oldestPeriod: string;
}

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  amount: string;
  method: PaymentMethod;
  reference?: string | null;
  paidAt: string;
  member: { id: string; firstName: string; lastName: string; dni?: string } | null;
  memberNumber?: string | null;
  fee: {
    id: string;
    period: string;
    concept: string;
    category?: string | null;
    amount: string;
    paidAmount: string;
    balance: string;
    status: FeeStatus;
  } | null;
  club: {
    name: string;
    legalName?: string | null;
    document?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logoUrl?: string | null;
  };
}

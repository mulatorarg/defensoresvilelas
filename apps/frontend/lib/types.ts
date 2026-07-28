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
  member: {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
  };
  feeType: { id: string; name: string };
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
  createdAt: string;
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

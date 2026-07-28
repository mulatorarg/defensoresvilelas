const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('accessToken') ?? ''
      : '';
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(error.message ?? 'Error en la petición');
  }

  return res.json();
}

export interface MemberFilters {
  search?: string;
  status?: string;
  categoryId?: string;
  disciplineId?: string;
  page?: number;
  limit?: number;
}

export function buildQueryString(filters: object) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getMembers(filters: MemberFilters = {}) {
  return apiFetch(`/api/members${buildQueryString(filters)}`);
}

export function createMember(data: Record<string, unknown>) {
  return apiFetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateMember(id: string, data: Record<string, unknown>) {
  return apiFetch(`/api/members/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteMember(id: string) {
  return apiFetch(`/api/members/${id}`, {
    method: 'DELETE',
  });
}

// Disciplinas
export function getDisciplines() {
  return apiFetch('/api/disciplines');
}

export function createDiscipline(data: Record<string, unknown>) {
  return apiFetch('/api/disciplines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateDiscipline(id: string, data: Record<string, unknown>) {
  return apiFetch(`/api/disciplines/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteDiscipline(id: string) {
  return apiFetch(`/api/disciplines/${id}`, { method: 'DELETE' });
}

// Categorías
export function getCategories(disciplineId?: string) {
  return apiFetch(`/api/categories${buildQueryString({ disciplineId })}`);
}

export function createCategory(data: Record<string, unknown>) {
  return apiFetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateCategory(id: string, data: Record<string, unknown>) {
  return apiFetch(`/api/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id: string) {
  return apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
}

// Inscripciones
export function createEnrollment(data: Record<string, unknown>) {
  return apiFetch('/api/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteEnrollment(id: string) {
  return apiFetch(`/api/enrollments/${id}`, { method: 'DELETE' });
}

// Tipos de cuota
export function getFeeTypes() {
  return apiFetch('/api/fee-types');
}

export function createFeeType(data: Record<string, unknown>) {
  return apiFetch('/api/fee-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateFeeType(id: string, data: Record<string, unknown>) {
  return apiFetch(`/api/fee-types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteFeeType(id: string) {
  return apiFetch(`/api/fee-types/${id}`, { method: 'DELETE' });
}

// Cuotas
export interface FeeFilters {
  memberId?: string;
  status?: string;
  period?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export function getFees(filters: FeeFilters = {}) {
  return apiFetch(`/api/fees${buildQueryString(filters)}`);
}

export function generateFees(data: Record<string, unknown>) {
  return apiFetch('/api/fees/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Pagos
export function createPayment(data: Record<string, unknown>) {
  return apiFetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function createMercadoPagoPreference(feeId: string) {
  return apiFetch('/api/payments/mercado-pago/preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feeId }),
  });
}

// Reportes
export function getDashboardSummary() {
  return apiFetch('/api/reports/dashboard');
}

export function getMembersReport(filters: Record<string, unknown> = {}) {
  return apiFetch(`/api/reports/members${buildQueryString(filters)}`);
}

export function getFeesReport(filters: Record<string, unknown> = {}) {
  return apiFetch(`/api/reports/fees${buildQueryString(filters)}`);
}

export function getIncomeExpenseReport(filters: Record<string, unknown> = {}) {
  return apiFetch(`/api/reports/income-expense${buildQueryString(filters)}`);
}

// Asistencias
export interface AttendanceFilters {
  categoryId?: string;
  date?: string;
  memberId?: string;
}

export function getAttendances(filters: AttendanceFilters = {}) {
  return apiFetch(`/api/attendances${buildQueryString(filters)}`);
}

export function createAttendance(data: Record<string, unknown>) {
  return apiFetch('/api/attendances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function bulkCreateAttendance(data: Record<string, unknown>) {
  return apiFetch('/api/attendances/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteAttendance(id: string) {
  return apiFetch(`/api/attendances/${id}`, { method: 'DELETE' });
}

// Transacciones de caja
export function getTransactions(filters: Record<string, unknown> = {}) {
  return apiFetch(`/api/transactions${buildQueryString(filters)}`);
}

export function createTransaction(data: Record<string, unknown>) {
  return apiFetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(id: string) {
  return apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
}

export function getCashClosure(date: string) {
  return apiFetch(`/api/reports/cash-closure${buildQueryString({ date })}`);
}

// --- Landing pública del club (sin JWT) ---

async function publicFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error('Error en la petición');
  }
  return res.json();
}

export function getPublicClub() {
  return publicFetch('/api/club');
}

// Configuración del club (admin)
export function getClubConfig() {
  return apiFetch('/api/club/config');
}

export function updateClubConfig(data: Record<string, unknown>) {
  return apiFetch('/api/club/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function getPublicDisciplines() {
  return publicFetch('/api/public/disciplines');
}

export function getPublicNews(limit = 6) {
  return publicFetch(`/api/public/news?limit=${limit}`);
}

export function getPublicEvents(limit = 6) {
  return publicFetch(`/api/public/events?limit=${limit}`);
}

export function getPublicMatches(limit = 6) {
  return publicFetch(`/api/public/matches?limit=${limit}`);
}

// --- Registro público de socios (pago simulado) ---

export function registerPublicMember(data: Record<string, unknown>) {
  return publicFetch2('/api/public/register', data);
}

async function publicFetch2(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new Error(msg ?? 'Error en la petición');
  }
  return data;
}

// --- Portal del socio ---

export async function memberLogin(dni: string, birthDate: string) {
  const data = await publicFetch2('/api/member-portal/login', { dni, birthDate });
  if (typeof window !== 'undefined') {
    localStorage.setItem('memberToken', data.accessToken);
    localStorage.setItem('memberInfo', JSON.stringify(data.member));
  }
  return data;
}

export function memberLogout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('memberToken');
  localStorage.removeItem('memberInfo');
}

export function getMemberInfo() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('memberInfo');
  return raw ? JSON.parse(raw) : null;
}

async function memberFetch(path: string) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('memberToken') ?? '' : '';
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    memberLogout();
    throw new Error('SESSION_EXPIRED');
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error' }));
    throw new Error(error.message ?? 'Error en la petición');
  }
  return res.json();
}

export function getMemberProfile() {
  return memberFetch('/api/member-portal/me');
}

export function getMemberFees() {
  return memberFetch('/api/member-portal/me/fees');
}

export function getMemberCard() {
  return memberFetch('/api/member-portal/me/card');
}

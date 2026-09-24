import type { Discipline, FeeType } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Error de la API con su código HTTP (TanStack Query no reintenta los 4xx). */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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

  if (res.status === 401 && token && typeof window !== 'undefined') {
    // Token vencido o revocado: se limpia la sesión y se vuelve al login
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    const returnTo = encodeURIComponent(window.location.pathname);
    // Recarga completa a propósito: descarta el estado de la sesión vencida
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login/?returnTo=${returnTo}`);
    throw new ApiError('Tu sesión expiró. Volvé a ingresar.', 401);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error desconocido' }));
    throw new ApiError(errorMessage(error.message) ?? 'Error en la petición', res.status);
  }

  return res.json();
}

/** La API responde `message` como string o, en errores de validación, como array. */
function errorMessage(message: unknown): string | undefined {
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : undefined;
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

export function resetMemberPin(id: string) {
  return apiFetch(`/api/members/${id}/reset-pin`, { method: 'POST' });
}

// Disciplinas
export function getDisciplines() {
  return apiFetch('/api/disciplines') as Promise<Discipline[]>;
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

export function getCategory(id: string) {
  return apiFetch(`/api/categories/${id}`);
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
  return apiFetch('/api/fee-types') as Promise<FeeType[]>;
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

export function cancelFee(id: string, reason: string) {
  return apiFetch(`/api/fees/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

// Pagos
export function getPaymentReceipt(id: string) {
  return apiFetch(`/api/payments/${id}`);
}

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

export function getDelinquencyReport() {
  return apiFetch('/api/reports/delinquency');
}

/**
 * Descarga un archivo de la API (CSV de reportes) con el token de la sesión:
 * un <a href> directo no mandaría el header Authorization.
 */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'No se pudo descargar' }));
    throw new Error(errorMessage(error.message) ?? 'No se pudo descargar');
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadReportCsv(report: 'members' | 'fees' | 'cash' | 'delinquency', filters: object = {}) {
  return downloadFile(`/api/reports/${report}.csv${buildQueryString(filters)}`, `${report}.csv`);
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

export function voidTransaction(id: string, reason: string) {
  return apiFetch(`/api/transactions/${id}/void`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
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

// --- Registro público de socios (la primera cuota queda pendiente) ---

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
    throw new Error(errorMessage(data.message) ?? 'Error en la petición');
  }
  return data;
}

// --- Portal del socio ---

/** Evento que avisa a la UI que la sesión del socio cambió (login, logout, vencimiento). */
export const MEMBER_SESSION_EVENT = 'member-session';

function storeMemberSession(data: { accessToken: string; member: unknown }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('memberToken', data.accessToken);
  localStorage.setItem('memberInfo', JSON.stringify(data.member));
  window.dispatchEvent(new Event(MEMBER_SESSION_EVENT));
}

/**
 * Login del socio: DNI + fecha de nacimiento + PIN.
 * Si el socio todavía no tiene PIN devuelve `{ pinSetupRequired: true }` (sin
 * sesión) y hay que repetir el login con `newPin`.
 */
export async function memberLogin(credentials: {
  dni: string;
  birthDate: string;
  pin?: string;
  newPin?: string;
}): Promise<{ pinSetupRequired: true } | { pinSetupRequired?: false }> {
  const data = await publicFetch2('/api/member-portal/login', credentials);
  if (data.pinSetupRequired) return { pinSetupRequired: true };
  storeMemberSession(data);
  return {};
}

export function memberLogout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('memberToken');
  localStorage.removeItem('memberInfo');
  window.dispatchEvent(new Event(MEMBER_SESSION_EVENT));
}

export function getMemberInfo() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('memberInfo');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function memberFetch(path: string) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('memberToken') ?? '' : '';
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    memberLogout();
    throw new ApiError('Tu sesión venció. Volvé a ingresar.', 401);
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error' }));
    throw new ApiError(errorMessage(error.message) ?? 'Error en la petición', res.status);
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

export async function changeMemberPin(currentPin: string, newPin: string) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('memberToken') ?? '' : '';
  const res = await fetch(`${API_BASE}/api/member-portal/me/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPin, newPin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorMessage(data.message) ?? 'No pudimos cambiar el PIN');
  }
  // El cambio cierra las otras sesiones y devuelve un token nuevo
  storeMemberSession(data);
}

export async function payFeeWithMercadoPago(feeId: string): Promise<{ initPoint?: string }> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('memberToken') ?? '' : '';
  const res = await fetch(`${API_BASE}/api/member-portal/me/fees/${feeId}/mp-preference`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorMessage(data.message) ?? 'No pudimos iniciar el pago');
  }
  return data;
}

// --- Cuenta propia del staff ---

export function changeOwnPassword(currentPassword: string, newPassword: string) {
  return apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function logoutAllSessions() {
  return apiFetch('/api/auth/logout-all', { method: 'POST' });
}

// --- Usuarios del staff (ADMIN) ---

export function getUsers() {
  return apiFetch('/api/users');
}

export function createUser(data: Record<string, unknown>) {
  return apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateUser(id: string, data: Record<string, unknown>) {
  return apiFetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function resetUserPassword(id: string, newPassword: string) {
  return apiFetch(`/api/users/${id}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword }),
  });
}

// --- Imágenes (fotos de socios, logo, noticias) ---

export type UploadFolder = 'socios' | 'club' | 'noticias';

export async function uploadImage(file: Blob, folder: UploadFolder, filename = 'imagen.jpg') {
  const body = new FormData();
  body.append('folder', folder);
  body.append('file', file, filename);
  // Sin Content-Type: el navegador arma el multipart con su boundary
  return apiFetch('/api/uploads', { method: 'POST', body }) as Promise<{ url: string }>;
}

// --- Noticias y eventos ---

export function getNewsAdmin(page = 1, limit = 20) {
  return apiFetch(`/api/news${buildQueryString({ page, limit })}`);
}

export function saveNews(id: string | null, data: Record<string, unknown>) {
  return apiFetch(id ? `/api/news/${id}` : '/api/news', {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteNews(id: string) {
  return apiFetch(`/api/news/${id}`, { method: 'DELETE' });
}

export function getEventsAdmin(page = 1, limit = 20) {
  return apiFetch(`/api/events${buildQueryString({ page, limit })}`);
}

export function saveEvent(id: string | null, data: Record<string, unknown>) {
  return apiFetch(id ? `/api/events/${id}` : '/api/events', {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteEvent(id: string) {
  return apiFetch(`/api/events/${id}`, { method: 'DELETE' });
}

export function getMemberPayments() {
  return memberFetch('/api/member-portal/me/payments');
}

export function getMemberReceipt(id: string) {
  return memberFetch(`/api/member-portal/me/payments/${id}`);
}

// --- Auditoría (ADMIN) ---

export function getAuditLog(filters: object = {}) {
  return apiFetch(`/api/audit${buildQueryString(filters)}`);
}

import { useMemo, useSyncExternalStore } from 'react';

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export function isTokenValid(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('accessToken');
  if (!token) return false;

  try {
    // El payload del JWT es base64url: se normaliza antes de atob()
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function setSession(data: LoginResponse) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('user', JSON.stringify(data.user));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  localStorage.removeItem('tenantSlug'); // limpieza de sesiones viejas
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getUser(): LoginResponse['user'] | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

/**
 * Usuario logueado para mostrar en la UI. Lee localStorage sólo en el cliente
 * (en el prerender del export estático devuelve null), así el HTML estático y
 * la primera renderización del cliente coinciden y no hay error de hidratación.
 */
export function useStoredUser(): LoginResponse['user'] | null {
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => localStorage.getItem('user'),
    () => null,
  );
  return useMemo(() => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [raw]);
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error de login' }));
    const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
    throw new Error(message ?? 'Error de login');
  }

  return res.json() as Promise<LoginResponse>;
}

'use client';

/**
 * Capa de datos con TanStack Query: claves de cache y hooks compartidos.
 *
 * Criterio de claves: [recurso, ...filtros]. Invalidar ['fees'] refresca todos
 * los listados de cuotas, sin importar filtros o página.
 */
import { QueryClient, useQuery } from '@tanstack/react-query';
import { ApiError, getDisciplines, getFeeTypes, getPublicClub } from './api';

export const qk = {
  club: ['club'] as const,
  clubConfig: ['club-config'] as const,
  disciplines: ['disciplines'] as const,
  feeTypes: ['fee-types'] as const,
  dashboard: ['dashboard'] as const,
  members: (filters: object) => ['members', filters] as const,
  fees: (filters: object) => ['fees', filters] as const,
  delinquency: ['delinquency'] as const,
  attendances: (filters: object) => ['attendances', filters] as const,
  transactions: (filters: object) => ['transactions', filters] as const,
  cashClosure: (date: string) => ['cash-closure', date] as const,
  reports: (name: string, filters: object) => ['reports', name, filters] as const,
  news: ['news'] as const,
  events: ['events'] as const,
  users: ['users'] as const,
  audit: (filters: object) => ['audit', filters] as const,
  receipt: (id: string) => ['receipt', id] as const,
  category: (id: string) => ['category', id] as const,
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Un 4xx (permisos, validación, no encontrado) no se arregla reintentando
        retry: (failures, error) =>
          !(error instanceof ApiError && error.status < 500) && failures < 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Mensaje para mostrar de un error de la API o de red. */
export function errorText(error: unknown, fallback = 'Algo salió mal'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// Catálogos: cambian poco, se reusan 5 minutos entre pantallas
const CATALOG_STALE = 5 * 60_000;

export function useDisciplines() {
  return useQuery({ queryKey: qk.disciplines, queryFn: getDisciplines, staleTime: CATALOG_STALE });
}

export function useFeeTypes() {
  return useQuery({ queryKey: qk.feeTypes, queryFn: getFeeTypes, staleTime: CATALOG_STALE });
}

export function usePublicClub() {
  return useQuery({ queryKey: qk.club, queryFn: getPublicClub, staleTime: CATALOG_STALE });
}

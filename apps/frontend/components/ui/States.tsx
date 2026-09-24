'use client';

import { AlertCircle, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { errorText } from '@/lib/queries';
import { Button } from './Button';

/** Filas grises mientras carga (en lugar de "Cargando..."). */
export function SkeletonRows({ count = 5, height = 'h-16' }: { count?: number; height?: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${height} animate-pulse rounded-2xl bg-gray-200/60`} />
      ))}
    </div>
  );
}

/** Error al cargar datos, con reintento. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-red-500" aria-hidden />
      <p className="mt-2 font-semibold text-red-800">No se pudieron cargar los datos</p>
      <p className="mt-1 text-sm text-red-700">{errorText(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry} icon={<RotateCw className="h-4 w-4" aria-hidden />}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function Pagination({
  meta,
  onPage,
  label = 'resultados',
}: {
  meta?: PageMeta | null;
  onPage: (page: number) => void;
  label?: string;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
      <span>
        {meta.total} {label} · página {meta.page} de {meta.totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
        >
          Anterior
        </Button>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Siguiente
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

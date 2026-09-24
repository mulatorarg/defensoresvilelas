'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { getAuditLog } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/types';
import { formatDateTime } from '@/lib/dates';
import { qk } from '@/lib/queries';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, Pagination, SkeletonRows } from '@/components/ui/States';
import { RoleGuard } from '@/components/common/RoleGuard';

interface AuditEntry {
  id: string;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: unknown;
  createdAt: string;
}

const ACTIONS: Record<string, string> = {
  CREATE: 'Alta',
  UPDATE: 'Modificación',
  DELETE: 'Borrado',
  VOID: 'Anulación de movimiento',
  CANCEL: 'Anulación de cuota',
  DEACTIVATE: 'Baja',
  GENERATE: 'Generación',
  RESET_PIN: 'Blanqueo de PIN',
  RESET_PASSWORD: 'Contraseña nueva',
  CHANGE_PASSWORD: 'Cambio de contraseña',
  LOGOUT_ALL: 'Cierre de sesiones',
  UPLOAD: 'Subida de imagen',
  MP_WEBHOOK: 'Pago de Mercado Pago',
};

const ENTITIES: Record<string, string> = {
  member: 'Socio',
  payment: 'Pago',
  fee: 'Cuota',
  transaction: 'Movimiento de caja',
  club_config: 'Configuración',
  user: 'Usuario',
  news: 'Noticia',
  event: 'Evento',
  image: 'Imagen',
};

const options = (map: Record<string, string>, all: string) => [
  { value: '', label: all },
  ...Object.entries(map).map(([value, label]) => ({ value, label })),
];

function Auditoria() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const filters = { entity, action, page, limit: 30 };
  const log = useQuery<PaginatedResponse<AuditEntry>>({
    queryKey: qk.audit(filters),
    queryFn: () => getAuditLog(filters),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 md:max-w-xl">
        <Select
          label="Qué"
          options={options(ENTITIES, 'Todo')}
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Acción"
          options={options(ACTIONS, 'Todas')}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {log.isPending ? (
        <SkeletonRows />
      ) : log.isError ? (
        <ErrorState error={log.error} onRetry={() => log.refetch()} />
      ) : log.data.items.length === 0 ? (
        <EmptyState title="Sin registros" hint="Probá con otros filtros." />
      ) : (
        <>
          <ul className={`divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white ${log.isPlaceholderData ? 'opacity-60' : ''}`}>
            {log.data.items.map((entry) => {
              const expanded = open === entry.id;
              const hasDetail = entry.detail !== null && entry.detail !== undefined;
              return (
                <li key={entry.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {ACTIONS[entry.action] ?? entry.action} · {ENTITIES[entry.entity] ?? entry.entity}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.userEmail ?? 'Sistema (Mercado Pago)'} · {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                    {hasDetail && (
                      <button
                        onClick={() => setOpen(expanded ? null : entry.id)}
                        aria-expanded={expanded}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Detalle
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                      </button>
                    )}
                  </div>
                  {expanded && hasDetail && (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                      {JSON.stringify(entry.detail, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination meta={log.data.meta} onPage={setPage} label="registros" />
        </>
      )}
    </>
  );
}

export default function AuditoriaPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Auditoría"
        description="Quién hizo qué con el dinero y los datos sensibles: pagos, anulaciones, bajas, permisos y configuración."
      />
      <RoleGuard roles={['ADMIN']}>
        <Auditoria />
      </RoleGuard>
    </div>
  );
}

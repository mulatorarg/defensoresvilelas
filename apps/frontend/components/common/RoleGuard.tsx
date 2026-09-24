'use client';

import { ReactNode } from 'react';
import { useStoredUser } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Muestra la página solo a los roles indicados. Es una ayuda de UI: el backend
 * valida los permisos de cada endpoint igual.
 */
export function RoleGuard({ roles, children }: { roles: string[]; children: ReactNode }) {
  const user = useStoredUser();
  if (!user) return null; // hidratando: AuthGuard ya maneja la sesión
  if (!roles.includes(user.role)) {
    return (
      <EmptyState
        title="No tenés acceso a esta sección"
        hint="Pedile a un administrador del club que te habilite si lo necesitás."
      />
    );
  }
  return <>{children}</>;
}

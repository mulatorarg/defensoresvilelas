'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isTokenValid } from '@/lib/auth';

const noopSubscribe = () => () => {};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // null en el prerender del export estático; en el cliente, si hay sesión válida
  const valid = useSyncExternalStore(noopSubscribe, isTokenValid, () => null);

  useEffect(() => {
    if (valid === false) {
      router.replace(`/login/?returnTo=${encodeURIComponent(pathname ?? '/admin/')}`);
    }
  }, [valid, router, pathname]);

  if (!valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100" aria-busy="true">
        <div className="text-gray-600">Verificando sesión...</div>
      </div>
    );
  }

  return <>{children}</>;
}

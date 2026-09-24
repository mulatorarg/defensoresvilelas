'use client';

import { ReactNode, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/queries';

/** Cache de datos (TanStack Query) para el admin y el portal del socio. */
export function Providers({ children }: { children: ReactNode }) {
  // Un cliente por pestaña, creado una sola vez
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

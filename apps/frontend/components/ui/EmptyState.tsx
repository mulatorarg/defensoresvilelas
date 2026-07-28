import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  hint?: string;
  children?: ReactNode; // acción sugerida
}

export function EmptyState({ icon = '📭', title, hint, children }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 text-3xl">
        {icon}
      </div>
      <p className="font-display text-lg font-bold text-gray-800">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">{hint}</p>}
      {children && <div className="mt-5 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode; // acciones (botones) a la derecha
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

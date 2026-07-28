'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDashboardSummary } from '@/lib/api';
import { getUser } from '@/lib/auth';

interface Summary {
  activeMembers: number;
  totalMembers: number;
  feesThisMonth: number;
  collectedThisMonth: number;
  incomeThisMonth: number;
  expenseThisMonth: number;
}

const formatMoney = (value: number) =>
  value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

function StatCard({
  label,
  value,
  caption,
  icon,
  accent,
  delay,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: string;
  accent?: 'primary' | 'green' | 'red';
  delay: number;
}) {
  const accentClasses = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-500',
  }[accent ?? 'primary'];

  return (
    <div
      className="animate-rise rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md"
      style={{ animationDelay: delay + 's' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-400">
          {label}
        </p>
        <span
          className={
            'flex h-9 w-9 items-center justify-center rounded-xl text-lg ' + accentClasses
          }
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 font-display text-3xl font-bold text-gray-900">{value}</p>
      {caption && <p className="mt-1 text-[12px] text-gray-400">{caption}</p>}
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: '/admin/socios/', label: 'Nuevo socio', icon: '➕' },
  { href: '/admin/cuotas/', label: 'Registrar pago', icon: '💳' },
  { href: '/admin/asistencias/', label: 'Tomar asistencia', icon: '✅' },
  { href: '/admin/caja/', label: 'Movimiento de caja', icon: '💰' },
];

export default function AdminPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const balance =
    (summary?.incomeThisMonth ?? 0) +
    (summary?.collectedThisMonth ?? 0) -
    (summary?.expenseThisMonth ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Encabezado */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] capitalize text-gray-400">{today}</p>
          <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">
            Hola{user ? ', ' + user.firstName : ''} 👋
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-600 shadow-sm transition-all hover:border-primary/40 hover:text-primary"
            >
              <span>{a.icon}</span>
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-200/60" />
          ))}
        </div>
      ) : (
        <>
          {/* Socios y cuotas */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              label="Socios activos"
              value={String(summary?.activeMembers ?? 0)}
              caption={'de ' + (summary?.totalMembers ?? 0) + ' totales'}
              icon="👥"
              delay={0.05}
            />
            <StatCard
              label="Cuotas del mes"
              value={String(summary?.feesThisMonth ?? 0)}
              caption="generadas este mes"
              icon="🧾"
              delay={0.1}
            />
            <StatCard
              label="Recaudado del mes"
              value={formatMoney(summary?.collectedThisMonth ?? 0)}
              caption="pagos registrados"
              icon="💵"
              accent="green"
              delay={0.15}
            />
          </div>

          {/* Caja */}
          <h2 className="mb-3 mt-9 text-[13px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Caja del mes
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              label="Ingresos"
              value={formatMoney(summary?.incomeThisMonth ?? 0)}
              caption="otros ingresos de caja"
              icon="📈"
              accent="green"
              delay={0.2}
            />
            <StatCard
              label="Egresos"
              value={formatMoney(summary?.expenseThisMonth ?? 0)}
              caption="gastos registrados"
              icon="📉"
              accent="red"
              delay={0.25}
            />
            <div
              className="animate-rise rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_var(--color-primary)]"
              style={{
                animationDelay: '0.3s',
                backgroundImage:
                  'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
                Balance del mes
              </p>
              <p className="mt-1 font-display text-3xl font-bold">{formatMoney(balance)}</p>
              <p className="mt-1 text-[12px] text-white/60">
                cuotas + ingresos − egresos
              </p>
            </div>
          </div>

          {/* Ayuda inicial si el club está vacío */}
          {(summary?.totalMembers ?? 0) === 0 && (
            <div className="animate-rise mt-9 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
              <p className="font-display text-lg font-bold text-gray-800">
                Empecemos a cargar el club 🏟️
              </p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-gray-500">
                Todavía no hay socios. Un buen orden: revisá las{' '}
                <Link href="/admin/disciplinas/" className="font-semibold text-primary hover:underline">
                  disciplinas y categorías
                </Link>
                , después cargá los{' '}
                <Link href="/admin/socios/" className="font-semibold text-primary hover:underline">
                  socios
                </Link>{' '}
                y generá las{' '}
                <Link href="/admin/cuotas/" className="font-semibold text-primary hover:underline">
                  cuotas del mes
                </Link>
                .
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

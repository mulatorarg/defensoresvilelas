'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  CalendarCheck,
  CreditCard,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideProps,
} from 'lucide-react';
import { getDashboardSummary } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { formatMoney as formatMoneyBase, type Money } from '@/lib/money';
import { qk } from '@/lib/queries';
import type { DashboardSummary } from '@/lib/types';
import { ErrorState } from '@/components/ui/States';

const formatMoney = (value: Money) => formatMoneyBase(value, { decimals: 0 });

function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: ComponentType<LucideProps>;
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
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
        <span className={'flex h-9 w-9 items-center justify-center rounded-xl ' + accentClasses} aria-hidden>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-1 font-display text-3xl font-bold text-gray-900">{value}</p>
      {caption && <p className="mt-1 text-[12px] text-gray-400">{caption}</p>}
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: '/admin/socios/', label: 'Nuevo socio', icon: UserPlus },
  { href: '/admin/cuotas/', label: 'Registrar pago', icon: CreditCard },
  { href: '/admin/asistencias/', label: 'Tomar asistencia', icon: CalendarCheck },
  { href: '/admin/caja/', label: 'Movimiento de caja', icon: Wallet },
];

export default function AdminPage() {
  const user = useStoredUser();
  const summaryQuery = useQuery<DashboardSummary>({ queryKey: qk.dashboard, queryFn: getDashboardSummary });
  const summary = summaryQuery.data;

  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="mx-auto max-w-6xl">
      {/* Encabezado */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-gray-400 first-letter:uppercase">{today}</p>
          <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">
            Hola{user ? ', ' + user.firstName : ''}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href + label}
              href={href}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-600 shadow-sm transition-all hover:border-primary/40 hover:text-primary"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {summaryQuery.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-busy="true">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-200/60" />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <ErrorState error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
      ) : (
        <>
          {/* Socios y cuotas */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              label="Socios activos"
              value={String(summary?.activeMembers ?? 0)}
              caption={'de ' + (summary?.totalMembers ?? 0) + ' totales'}
              icon={Users}
              delay={0.05}
            />
            <StatCard
              label="Cuotas del mes"
              value={String(summary?.feesThisMonth ?? 0)}
              caption="generadas este mes"
              icon={Receipt}
              delay={0.1}
            />
            <StatCard
              label="Recaudado del mes"
              value={formatMoney(summary?.collectedThisMonth)}
              caption="pagos registrados"
              icon={Banknote}
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
              value={formatMoney(summary?.incomeThisMonth)}
              caption="otros ingresos de caja"
              icon={TrendingUp}
              accent="green"
              delay={0.2}
            />
            <StatCard
              label="Egresos"
              value={formatMoney(summary?.expenseThisMonth)}
              caption="gastos registrados"
              icon={TrendingDown}
              accent="red"
              delay={0.25}
            />
            <div
              className="animate-rise rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_var(--color-primary)]"
              style={{
                animationDelay: '0.3s',
                backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">Balance del mes</p>
              <p className="mt-1 font-display text-3xl font-bold">{formatMoney(summary?.balanceThisMonth)}</p>
              <p className="mt-1 text-[12px] text-white/60">cuotas + ingresos - egresos</p>
            </div>
          </div>

          {/* Ayuda inicial si el club está vacío */}
          {(summary?.totalMembers ?? 0) === 0 && (
            <div className="animate-rise mt-9 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
              <p className="font-display text-lg font-bold text-gray-800">Empecemos a cargar el club</p>
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

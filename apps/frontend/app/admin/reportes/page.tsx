'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import {
  downloadReportCsv,
  getDashboardSummary,
  getMembersReport,
  getFeesReport,
  getIncomeExpenseReport,
} from '@/lib/api';
import { Member, Fee, Transaction, DashboardSummary, PaginatedResponse } from '@/lib/types';
import { formatMoney, toNumber } from '@/lib/money';
import { currentPeriod, formatDateOnly, todayLocal } from '@/lib/dates';
import { errorText, qk } from '@/lib/queries';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataList } from '@/components/ui/DataList';
import { ErrorState, Pagination, SkeletonRows } from '@/components/ui/States';
import { useFeedback } from '@/components/ui/Feedback';
import { RoleGuard } from '@/components/common/RoleGuard';

const PAGE_SIZE = 25;

type WithSummary<T> = PaginatedResponse<T> & { summary: Record<string, string> };

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
];

const feeStatusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PARTIALLY_PAID', label: 'Parcial' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'CANCELLED', label: 'Anulada' },
];

const FEE_STATUS: Record<string, string> = {
  PENDING: 'Pendiente',
  PARTIALLY_PAID: 'Parcial',
  PAID: 'Pagada',
  CANCELLED: 'Anulada',
};

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6" aria-label={title}>
      <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <h2 className="text-xl font-bold">{title}</h2>
        {actions && <div className="flex flex-wrap items-end gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Totals({ items }: { items: { label: string; value: string; tone?: 'green' | 'red' }[] }) {
  const tones = { green: 'bg-green-50 text-green-800', red: 'bg-red-50 text-red-800' };
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((t) => (
        <div key={t.label} className={`rounded-xl p-3 ${t.tone ? tones[t.tone] : 'bg-gray-50'}`}>
          <p className="text-xs opacity-70">{t.label}</p>
          <p className="font-bold">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

function Reportes() {
  const { toast } = useFeedback();
  const [memberStatus, setMemberStatus] = useState('');
  const [membersPage, setMembersPage] = useState(1);
  const [feePeriod, setFeePeriod] = useState('');
  const [feeStatus, setFeeStatus] = useState('');
  const [feesPage, setFeesPage] = useState(1);
  const [from, setFrom] = useState(() => `${currentPeriod()}-01`); // mes en curso
  const [to, setTo] = useState(todayLocal);
  const [txPage, setTxPage] = useState(1);

  const summary = useQuery<DashboardSummary>({ queryKey: qk.dashboard, queryFn: getDashboardSummary });

  const memberFilters = { status: memberStatus, page: membersPage, limit: PAGE_SIZE };
  const members = useQuery<PaginatedResponse<Member>>({
    queryKey: qk.reports('members', memberFilters),
    queryFn: () => getMembersReport(memberFilters),
    placeholderData: keepPreviousData,
  });

  const feeFilters = { period: feePeriod, status: feeStatus, page: feesPage, limit: PAGE_SIZE };
  const fees = useQuery<WithSummary<Fee>>({
    queryKey: qk.reports('fees', feeFilters),
    queryFn: () => getFeesReport(feeFilters),
    placeholderData: keepPreviousData,
  });

  const txFilters = { from, to, page: txPage, limit: PAGE_SIZE };
  const transactions = useQuery<WithSummary<Transaction>>({
    queryKey: qk.reports('income-expense', txFilters),
    queryFn: () => getIncomeExpenseReport(txFilters),
    placeholderData: keepPreviousData,
  });

  const exportCsv = async (report: 'members' | 'fees' | 'cash', filters: object) => {
    try {
      await downloadReportCsv(report, filters);
    } catch (err) {
      toast(errorText(err, 'No se pudo exportar'), 'error');
    }
  };

  const exportButton = (report: 'members' | 'fees' | 'cash', filters: object, label = 'Exportar CSV') => (
    <Button variant="secondary" onClick={() => exportCsv(report, filters)} icon={<Download className="h-4 w-4" aria-hidden />}>
      {label}
    </Button>
  );

  const s = summary.data;

  return (
    <div className="space-y-8">
      {/* Resumen */}
      <section aria-label="Resumen del mes">
        <h2 className="mb-4 text-xl font-bold">Resumen del mes</h2>
        {summary.isError ? (
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <p className="text-sm text-gray-500">Socios activos</p>
              <p className="mt-2 text-3xl font-bold">
                {s?.activeMembers ?? '-'} / {s?.totalMembers ?? '-'}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <p className="text-sm text-gray-500">Recaudado en cuotas</p>
              <p className="mt-2 text-3xl font-bold">{s ? formatMoney(s.collectedThisMonth) : '-'}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <p className="text-sm text-gray-500">Balance de caja (sin cuotas)</p>
              <p className="mt-2 text-3xl font-bold">
                {s ? formatMoney(toNumber(s.incomeThisMonth) - toNumber(s.expenseThisMonth)) : '-'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Socios */}
      <Section
        title="Socios"
        actions={
          <>
            <Select
              label="Estado"
              options={statusOptions}
              value={memberStatus}
              onChange={(e) => {
                setMemberStatus(e.target.value);
                setMembersPage(1);
              }}
            />
            {exportButton('members', { status: memberStatus })}
          </>
        }
      >
        {members.isPending ? (
          <SkeletonRows count={4} height="h-10" />
        ) : members.isError ? (
          <ErrorState error={members.error} onRetry={() => members.refetch()} />
        ) : (
          <>
            <DataList
              rows={members.data.items}
              rowKey={(m) => m.id}
              columns={[
                { key: 'name', header: 'Socio', cell: (m) => `${m.lastName}, ${m.firstName}` },
                { key: 'dni', header: 'DNI', cell: (m) => m.dni },
                {
                  key: 'enr',
                  header: 'Inscripciones',
                  cell: (m) => m.enrollments.map((e) => `${e.category.discipline.name} ${e.category.name}`).join(', ') || '-',
                },
              ]}
            />
            <Pagination meta={members.data.meta} onPage={setMembersPage} label="socios" />
          </>
        )}
      </Section>

      {/* Cuotas */}
      <Section
        title="Cuotas"
        actions={
          <>
            <Input
              type="month"
              label="Período"
              value={feePeriod}
              onChange={(e) => {
                setFeePeriod(e.target.value);
                setFeesPage(1);
              }}
              className="w-44"
            />
            <Select
              label="Estado"
              options={feeStatusOptions}
              value={feeStatus}
              onChange={(e) => {
                setFeeStatus(e.target.value);
                setFeesPage(1);
              }}
            />
            {exportButton('fees', { period: feePeriod, status: feeStatus })}
          </>
        }
      >
        {fees.isPending ? (
          <SkeletonRows count={4} height="h-10" />
        ) : fees.isError ? (
          <ErrorState error={fees.error} onRetry={() => fees.refetch()} />
        ) : (
          <>
            <Totals
              items={[
                { label: 'Total', value: formatMoney(fees.data.summary.totalAmount) },
                { label: 'Pagado', value: formatMoney(fees.data.summary.totalPaid), tone: 'green' },
                { label: 'Pendiente', value: formatMoney(fees.data.summary.totalPending), tone: 'red' },
              ]}
            />
            <DataList
              rows={fees.data.items}
              rowKey={(f) => f.id}
              columns={[
                { key: 'name', header: 'Socio', cell: (f) => `${f.member.lastName}, ${f.member.firstName}` },
                { key: 'concept', header: 'Concepto', cell: (f) => `${f.feeType?.name ?? 'Cuota'} ${f.period}` },
                { key: 'status', header: 'Estado', cell: (f) => FEE_STATUS[f.status] ?? f.status },
                { key: 'amount', header: 'Monto', align: 'right', cell: (f) => formatMoney(f.amount) },
              ]}
            />
            <Pagination meta={fees.data.meta} onPage={setFeesPage} label="cuotas" />
          </>
        )}
      </Section>

      {/* Caja */}
      <Section
        title="Movimientos de caja"
        actions={
          <>
            <Input
              type="date"
              label="Desde"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setTxPage(1);
              }}
            />
            <Input
              type="date"
              label="Hasta"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setTxPage(1);
              }}
            />
            {exportButton('cash', { from, to }, 'Exportar caja CSV')}
          </>
        }
      >
        {transactions.isPending ? (
          <SkeletonRows count={4} height="h-10" />
        ) : transactions.isError ? (
          <ErrorState error={transactions.error} onRetry={() => transactions.refetch()} />
        ) : (
          <>
            <Totals
              items={[
                { label: 'Ingresos', value: formatMoney(transactions.data.summary.income), tone: 'green' },
                { label: 'Egresos', value: formatMoney(transactions.data.summary.expense), tone: 'red' },
                { label: 'Balance', value: formatMoney(transactions.data.summary.balance) },
              ]}
            />
            <DataList
              rows={transactions.data.items}
              rowKey={(t) => t.id}
              empty="Sin movimientos en el período."
              columns={[
                { key: 'date', header: 'Fecha', cell: (t) => formatDateOnly(t.date) },
                { key: 'type', header: 'Tipo', cell: (t) => (t.type === 'INCOME' ? 'Ingreso' : 'Egreso') },
                { key: 'category', header: 'Categoría', cell: (t) => t.category },
                { key: 'amount', header: 'Monto', align: 'right', cell: (t) => formatMoney(t.amount) },
              ]}
            />
            <Pagination meta={transactions.data.meta} onPage={setTxPage} label="movimientos" />
            <p className="mt-2 text-xs text-gray-400">
              El listado muestra la caja manual; el CSV suma también los pagos de cuotas del período.
            </p>
          </>
        )}
      </Section>
    </div>
  );
}

export default function ReportesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Reportes" description="Socios, cuotas y caja, con exportación a CSV para Excel." />
      <RoleGuard roles={['ADMIN', 'OPERATOR']}>
        <Reportes />
      </RoleGuard>
    </div>
  );
}

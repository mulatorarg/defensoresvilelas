'use client';

import { useEffect, useState } from 'react';
import {
  getDashboardSummary,
  getMembersReport,
  getFeesReport,
  getIncomeExpenseReport,
} from '@/lib/api';
import { Member, Fee, Transaction } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface Summary {
  activeMembers: number;
  totalMembers: number;
  feesThisMonth: number;
  collectedThisMonth: number;
  incomeThisMonth: number;
  expenseThisMonth: number;
}

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
];

const feeStatusOptions = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PARTIALLY_PAID', label: 'Parcial' },
  { value: 'PAID', label: 'Pagada' },
];

export default function ReportesPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [fees, setFees] = useState<{ items: Fee[]; summary: Record<string, number> } | null>(null);
  const [incomeExpense, setIncomeExpense] = useState<{
    items: Transaction[];
    summary: Record<string, number>;
  } | null>(null);

  const [memberStatus, setMemberStatus] = useState('');
  const [feePeriod, setFeePeriod] = useState('');
  const [feeStatus, setFeeStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchSummary = async () => {
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch {
      setSummary(null);
    }
  };

  const fetchMembers = async () => {
    try {
      const data = await getMembersReport({ status: memberStatus });
      setMembers(data.items);
    } catch {
      setMembers([]);
    }
  };

  const fetchFees = async () => {
    try {
      const data = await getFeesReport({ period: feePeriod, status: feeStatus });
      setFees(data);
    } catch {
      setFees(null);
    }
  };

  const fetchIncomeExpense = async () => {
    try {
      const data = await getIncomeExpenseReport({ from, to });
      setIncomeExpense(data);
    } catch {
      setIncomeExpense(null);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchMembers();
    fetchFees();
    fetchIncomeExpense();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatMoney = (value: number) =>
    value?.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) ?? '$ 0,00';

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Reportes</h1>

      {/* Resumen */}
      <section>
        <h2 className="text-xl font-bold mb-4">Resumen del mes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Socios activos</p>
            <p className="text-3xl font-bold mt-2">
              {summary?.activeMembers ?? 0} / {summary?.totalMembers ?? 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Recaudado</p>
            <p className="text-3xl font-bold mt-2">
              {formatMoney(summary?.collectedThisMonth ?? 0)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Balance</p>
            <p className="text-3xl font-bold mt-2">
              {formatMoney(
                (summary?.incomeThisMonth ?? 0) - (summary?.expenseThisMonth ?? 0),
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Socios */}
      <section className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h2 className="text-xl font-bold">Socios</h2>
          <div className="flex gap-2">
            <Select
              options={statusOptions}
              value={memberStatus}
              onChange={(e) => setMemberStatus(e.target.value)}
            />
            <Button onClick={fetchMembers}>Filtrar</Button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-2">Total: {members.length}</p>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Socio</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">DNI</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Inscripciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-sm">
                    {m.lastName}, {m.firstName}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{m.dni}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {m.enrollments.map((e) => e.category.name).join(', ') || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cuotas */}
      <section className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h2 className="text-xl font-bold">Cuotas</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Período (AAAA-MM)"
              value={feePeriod}
              onChange={(e) => setFeePeriod(e.target.value)}
              className="w-40"
            />
            <Select
              options={feeStatusOptions}
              value={feeStatus}
              onChange={(e) => setFeeStatus(e.target.value)}
            />
            <Button onClick={fetchFees}>Filtrar</Button>
          </div>
        </div>
        {fees && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-bold">{formatMoney(fees.summary.totalAmount)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Pagado</p>
              <p className="font-bold">{formatMoney(fees.summary.totalPaid)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Pendiente</p>
              <p className="font-bold">{formatMoney(fees.summary.totalPending)}</p>
            </div>
          </div>
        )}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Socio</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Concepto</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Estado</th>
                <th className="px-4 py-2 text-right text-xs uppercase text-gray-500">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fees?.items.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2 text-sm">
                    {f.member.lastName}, {f.member.firstName}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {f.feeType.name} {f.period && `(${f.period})`}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{f.status}</td>
                  <td className="px-4 py-2 text-sm text-right">${f.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ingresos/Egresos */}
      <section className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h2 className="text-xl font-bold">Ingresos y egresos</h2>
          <div className="flex gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <Button onClick={fetchIncomeExpense}>Filtrar</Button>
          </div>
        </div>
        {incomeExpense && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 p-3 rounded">
              <p className="text-xs text-green-700">Ingresos</p>
              <p className="font-bold text-green-800">
                {formatMoney(incomeExpense.summary.income)}
              </p>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <p className="text-xs text-red-700">Egresos</p>
              <p className="font-bold text-red-800">
                {formatMoney(incomeExpense.summary.expense)}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Balance</p>
              <p className="font-bold">{formatMoney(incomeExpense.summary.balance)}</p>
            </div>
          </div>
        )}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Fecha</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Tipo</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Categoría</th>
                <th className="px-4 py-2 text-right text-xs uppercase text-gray-500">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {incomeExpense?.items.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-sm">
                    {new Date(t.date ?? t.createdAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        t.type === 'INCOME'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{t.category}</td>
                  <td className="px-4 py-2 text-sm text-right">${t.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

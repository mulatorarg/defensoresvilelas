'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Plus, Wallet } from 'lucide-react';
import { CashClosure, Transaction } from '@/lib/types';
import { getTransactions, createTransaction, voidTransaction, getCashClosure } from '@/lib/api';
import { errorText, qk } from '@/lib/queries';
import { formatDateOnly, todayLocal } from '@/lib/dates';
import { formatMoney, toNumber } from '@/lib/money';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { useFeedback } from '@/components/ui/Feedback';
import { RoleGuard } from '@/components/common/RoleGuard';
import { TransactionForm } from '@/components/cash/TransactionForm';

function Caja() {
  const { toast } = useFeedback();
  const queryClient = useQueryClient();
  const today = todayLocal();
  const [date, setDate] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  // Movimiento a anular (los movimientos no se borran: quedan con su motivo)
  const [voiding, setVoiding] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const txQuery = useQuery<Transaction[]>({
    queryKey: qk.transactions({ from: date, to: date }),
    queryFn: () => getTransactions({ from: date, to: date }),
  });
  const closureQuery = useQuery<CashClosure>({
    queryKey: qk.cashClosure(date),
    queryFn: () => getCashClosure(date),
  });

  const refresh = () => {
    for (const key of [['transactions'], ['cash-closure'], qk.dashboard, ['reports']]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const create = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      toast('Movimiento registrado');
      setFormOpen(false);
      refresh();
    },
    onError: (err) => toast(errorText(err, 'Error al guardar'), 'error'),
  });

  const voidTx = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => voidTransaction(id, reason),
    onSuccess: () => {
      toast('Movimiento anulado');
      setVoiding(null);
      refresh();
    },
    onError: (err) => toast(errorText(err, 'Error al anular'), 'error'),
  });

  const closure = closureQuery.data;
  const transactions = txQuery.data ?? [];

  return (
    <>
      <PageHeader title="Caja" description="Cierre del día: cuotas cobradas, otros ingresos y gastos.">
        <Button onClick={() => setFormOpen(true)} icon={<Plus className="h-4 w-4" aria-hidden />}>
          Nuevo movimiento
        </Button>
      </PageHeader>
      <div className="mb-6 w-48">
        <Input label="Día" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>

      {/* Cierre de caja */}
      {closureQuery.isError ? (
        <div className="mb-8">
          <ErrorState error={closureQuery.error} onRetry={() => closureQuery.refetch()} />
        </div>
      ) : !closure ? (
        <div className="mb-8">
          <SkeletonRows count={1} height="h-40" />
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">Ingresos por cuotas</p>
            <p className="text-2xl font-bold text-green-800">{formatMoney(closure.paymentsIncome)}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-700">Otros ingresos</p>
            <p className="text-2xl font-bold text-blue-800">{formatMoney(closure.transactionsIncome)}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">Egresos</p>
            <p className="text-2xl font-bold text-red-800">{formatMoney(closure.transactionsExpense)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 md:col-span-3">
            <p className="text-sm text-gray-600">Balance del día</p>
            <p className={`text-3xl font-bold ${toNumber(closure.balance) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatMoney(closure.balance)}
            </p>
          </div>
        </div>
      )}

      {/* Movimientos */}
      <h2 className="mb-4 text-xl font-bold">Movimientos del día</h2>
      {txQuery.isPending ? (
        <SkeletonRows count={3} />
      ) : txQuery.isError ? (
        <ErrorState error={txQuery.error} onRetry={() => txQuery.refetch()} />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7 text-gray-400" aria-hidden />}
          title={`Sin movimientos de caja el ${formatDateOnly(date)}`}
          hint="Los pagos de cuotas se suman solos al cierre; acá van los demás ingresos y gastos."
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {transactions.map((t) => {
            const voided = t.status === 'VOIDED';
            return (
              <li key={t.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 ${voided ? 'opacity-60' : ''}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        t.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                    </span>
                    <span className={`font-medium ${voided ? 'line-through' : ''}`}>{t.category}</span>
                    {voided && (
                      <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">Anulado</span>
                    )}
                  </div>
                  {t.description && <p className="mt-1 text-sm text-gray-600">{t.description}</p>}
                  {voided && t.voidReason && <p className="mt-1 text-xs text-gray-500">Motivo: {t.voidReason}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-700'} ${voided ? 'line-through' : ''}`}>
                    {t.type === 'INCOME' ? '+' : '-'} {formatMoney(t.amount)}
                  </span>
                  {!voided && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => {
                        setVoiding(t);
                        setVoidReason('');
                      }}
                      icon={<Ban className="h-4 w-4" aria-hidden />}
                      aria-label={`Anular ${t.category} por ${formatMoney(t.amount)}`}
                    >
                      Anular
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Nuevo movimiento de caja">
        {formOpen && (
          <TransactionForm onSubmit={(data) => create.mutate(data)} onCancel={() => setFormOpen(false)} isLoading={create.isPending} />
        )}
      </Modal>

      <Modal
        isOpen={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Anular movimiento"
        subtitle="El movimiento deja de sumar en la caja, pero queda registrado con el motivo."
      >
        {voiding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              voidTx.mutate({ id: voiding.id, reason: voidReason.trim() });
            }}
            className="space-y-4"
          >
            <p className="text-sm text-gray-700">
              {voiding.type === 'INCOME' ? 'Ingreso' : 'Egreso'} · {voiding.category} ·{' '}
              <strong>{formatMoney(voiding.amount)}</strong>
            </p>
            <Input
              label="Motivo"
              required
              minLength={3}
              maxLength={500}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Ej.: cargado dos veces"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setVoiding(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger" disabled={voidTx.isPending || voidReason.trim().length < 3}>
                Anular
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function CajaPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <RoleGuard roles={['ADMIN', 'OPERATOR']}>
        <Caja />
      </RoleGuard>
    </div>
  );
}

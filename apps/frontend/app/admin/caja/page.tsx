'use client';

import { useEffect, useState } from 'react';
import { CashClosure, Transaction } from '@/lib/types';
import {
  getTransactions,
  createTransaction,
  voidTransaction,
  getCashClosure,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useFeedback } from '@/components/ui/Feedback';
import { TransactionForm } from '@/components/cash/TransactionForm';
import { formatDateOnly, todayLocal } from '@/lib/dates';
import { formatMoney, toNumber } from '@/lib/money';

export default function CajaPage() {
  const { toast } = useFeedback();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closure, setClosure] = useState<CashClosure | null>(null);
  const [date, setDate] = useState(todayLocal);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Movimiento a anular (los movimientos no se borran: quedan con su motivo)
  const [voiding, setVoiding] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txData, closureData] = await Promise.all([
        getTransactions({ from: date, to: date }),
        getCashClosure(date),
      ]);
      setTransactions(txData);
      setClosure(closureData);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al cargar', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      await createTransaction(data);
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openVoid = (t: Transaction) => {
    setVoiding(t);
    setVoidReason('');
  };

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiding) return;
    setSaving(true);
    try {
      await voidTransaction(voiding.id, voidReason.trim());
      toast('Movimiento anulado');
      setVoiding(null);
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al anular', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">Caja</h1>
        <Button onClick={() => setModalOpen(true)}>Nuevo movimiento</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Cierre de caja */}
      {closure && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-700">Ingresos por pagos</p>
            <p className="text-2xl font-bold text-green-800">
              {formatMoney(closure.paymentsIncome)}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">Ingresos manuales</p>
            <p className="text-2xl font-bold text-blue-800">
              {formatMoney(closure.transactionsIncome)}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-red-700">Egresos</p>
            <p className="text-2xl font-bold text-red-800">
              {formatMoney(closure.transactionsExpense)}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 md:col-span-3">
            <p className="text-sm text-gray-600">Balance del día</p>
            <p
              className={`text-3xl font-bold ${
                toNumber(closure.balance) >= 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {formatMoney(closure.balance)}
            </p>
          </div>
        </div>
      )}

      {/* Transacciones */}
      <h2 className="text-xl font-bold mb-4">Movimientos del día</h2>
      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : transactions.length === 0 ? (
        <p className="text-gray-500">No hay movimientos para esta fecha.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {transactions.map((t) => {
            const voided = t.status === 'VOIDED';
            return (
              <div
                key={t.id}
                className={`p-4 flex justify-between items-center hover:bg-gray-50 ${
                  voided ? 'opacity-60' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        t.type === 'INCOME'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                    </span>
                    <span className={`font-medium ${voided ? 'line-through' : ''}`}>
                      {t.category}
                    </span>
                    {voided && (
                      <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        Anulado
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-sm text-gray-600 mt-1">{t.description}</p>
                  )}
                  {voided && t.voidReason && (
                    <p className="text-xs text-gray-500 mt-1">Motivo: {t.voidReason}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {formatDateOnly(t.date)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`font-bold ${
                      t.type === 'INCOME' ? 'text-green-700' : 'text-red-700'
                    } ${voided ? 'line-through' : ''}`}
                  >
                    {t.type === 'INCOME' ? '+' : '-'} {formatMoney(t.amount)}
                  </span>
                  {!voided && (
                    <Button
                      variant="ghost"
                      className="text-sm text-red-600 hover:text-red-700"
                      onClick={() => openVoid(t)}
                    >
                      Anular
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo movimiento de caja"
      >
        <TransactionForm
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          isLoading={saving}
        />
      </Modal>

      <Modal
        isOpen={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Anular movimiento"
        subtitle="El movimiento deja de sumar en la caja, pero queda registrado con el motivo."
      >
        {voiding && (
          <form onSubmit={handleVoid} className="space-y-4">
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
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setVoiding(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger" disabled={saving || voidReason.trim().length < 3}>
                Anular
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

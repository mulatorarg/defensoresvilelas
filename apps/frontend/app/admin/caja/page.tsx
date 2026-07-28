'use client';

import { useEffect, useState } from 'react';
import { Transaction } from '@/lib/types';
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
  getCashClosure,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/cash/TransactionForm';

interface CashClosure {
  transactionsIncome: number;
  transactionsExpense: number;
  paymentsIncome: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export default function CajaPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closure, setClosure] = useState<CashClosure | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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
      alert(err instanceof Error ? err.message : 'Error al cargar');
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
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
      await deleteTransaction(id);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const formatMoney = (value: number) =>
    value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Caja</h1>
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
                closure.balance >= 0 ? 'text-green-700' : 'text-red-700'
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
          {transactions.map((t) => (
            <div
              key={t.id}
              className="p-4 flex justify-between items-center hover:bg-gray-50"
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
                  <span className="font-medium">{t.category}</span>
                </div>
                {t.description && (
                  <p className="text-sm text-gray-600 mt-1">{t.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  {new Date(t.date).toLocaleDateString('es-AR')}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`font-bold ${
                    t.type === 'INCOME' ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {t.type === 'INCOME' ? '+' : '-'} ${t.amount}
                </span>
                <Button
                  variant="ghost"
                  className="text-sm text-red-600 hover:text-red-700"
                  onClick={() => handleDelete(t.id)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
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
    </div>
  );
}

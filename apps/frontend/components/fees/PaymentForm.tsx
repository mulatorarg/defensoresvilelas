'use client';

import { useState } from 'react';
import { Fee } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface PaymentFormProps {
  fee: Fee;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const methodOptions = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'DEBIT', label: 'Débito' },
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'OTHER', label: 'Otro' },
];

export function PaymentForm({
  fee,
  onSubmit,
  onCancel,
  isLoading,
}: PaymentFormProps) {
  const remaining = Number(fee.amount) - Number(fee.paidAmount);

  const [form, setForm] = useState({
    amount: remaining.toFixed(2),
    method: 'CASH',
    reference: '',
    paidAt: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      feeId: fee.id,
      amount: form.amount,
      method: form.method,
      reference: form.reference || undefined,
      paidAt: form.paidAt,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Cuota de <strong>{fee.member.lastName}, {fee.member.firstName}</strong>
        <br />
        Total: ${fee.amount} | Restante: ${remaining.toFixed(2)}
      </p>
      <Input
        label="Monto a pagar"
        type="number"
        step="0.01"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        required
      />
      <Select
        label="Método"
        options={methodOptions}
        value={form.method}
        onChange={(e) => setForm({ ...form, method: e.target.value })}
      />
      <Input
        label="Referencia"
        value={form.reference}
        onChange={(e) => setForm({ ...form, reference: e.target.value })}
      />
      <Input
        label="Fecha de pago"
        type="date"
        value={form.paidAt}
        onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Registrando...' : 'Registrar pago'}
        </Button>
      </div>
    </form>
  );
}

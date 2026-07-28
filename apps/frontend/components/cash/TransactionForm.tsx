'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface TransactionFormProps {
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const typeOptions = [
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Egreso' },
];

const categoryOptions = [
  { value: 'Pago a profesor', label: 'Pago a profesor' },
  { value: 'Pago a proveedor', label: 'Pago a proveedor' },
  { value: 'Alquiler', label: 'Alquiler' },
  { value: 'Gastos varios', label: 'Gastos varios' },
  { value: 'Otros ingresos', label: 'Otros ingresos' },
  { value: 'Otros egresos', label: 'Otros egresos' },
];

export function TransactionForm({
  onSubmit,
  onCancel,
  isLoading,
}: TransactionFormProps) {
  const [form, setForm] = useState({
    type: 'EXPENSE',
    category: 'Gastos varios',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Tipo"
        options={typeOptions}
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
      />
      <Select
        label="Categoría"
        options={categoryOptions}
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
      />
      <Input
        label="Monto"
        type="number"
        step="0.01"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        required
      />
      <Input
        label="Descripción"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Input
        label="Fecha"
        type="date"
        value={form.date}
        onChange={(e) => setForm({ ...form, date: e.target.value })}
        required
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

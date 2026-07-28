'use client';

import { useMemo, useState } from 'react';
import { Category, Discipline, FeeType } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface FeeGeneratorProps {
  feeTypes: FeeType[];
  disciplines: Discipline[];
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function FeeGenerator({
  feeTypes,
  disciplines,
  onSubmit,
  onCancel,
  isLoading,
}: FeeGeneratorProps) {
  const today = new Date();
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [form, setForm] = useState({
    period: defaultPeriod,
    feeTypeId: feeTypes[0]?.id ?? '',
    disciplineId: '',
    categoryId: '',
    amount: '',
    dueDate: '',
  });

  const categories = useMemo<Category[]>(() => {
    const discipline = disciplines.find((d) => d.id === form.disciplineId);
    return discipline?.categories ?? [];
  }, [disciplines, form.disciplineId]);

  const feeTypeOptions = feeTypes.map((ft) => ({
    value: ft.id,
    label: ft.name,
  }));

  const disciplineOptions = [
    { value: '', label: 'Todas las disciplinas' },
    ...disciplines.map((d) => ({ value: d.id, label: d.name })),
  ];

  const categoryOptions = [
    { value: '', label: 'Todas las categorías' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      period: form.period,
      feeTypeId: form.feeTypeId,
      dueDate: form.dueDate || undefined,
    };
    if (form.categoryId) data.categoryId = form.categoryId;
    if (form.amount) data.amount = form.amount;
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Período (AAAA-MM)"
        value={form.period}
        onChange={(e) => setForm({ ...form, period: e.target.value })}
        required
      />
      <Select
        label="Tipo de cuota"
        options={feeTypeOptions}
        value={form.feeTypeId}
        onChange={(e) => setForm({ ...form, feeTypeId: e.target.value })}
        required
      />
      <Select
        label="Disciplina"
        options={disciplineOptions}
        value={form.disciplineId}
        onChange={(e) =>
          setForm({ ...form, disciplineId: e.target.value, categoryId: '' })
        }
      />
      <Select
        label="Categoría"
        options={categoryOptions}
        value={form.categoryId}
        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
      />
      <Input
        label="Monto (opcional si la categoría tiene cuota)"
        type="number"
        step="0.01"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
      />
      <Input
        label="Fecha de vencimiento"
        type="date"
        value={form.dueDate}
        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Generando...' : 'Generar cuotas'}
        </Button>
      </div>
    </form>
  );
}

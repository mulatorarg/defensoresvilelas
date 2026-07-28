'use client';

import { useState } from 'react';
import { Category, Discipline } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface CategoryFormProps {
  disciplines: Discipline[];
  category?: Category | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const genderOptions = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MIXED', label: 'Mixto' },
];

interface FormState {
  disciplineId: string;
  name: string;
  ageFrom: string;
  ageTo: string;
  gender: string;
  feeAmount: string;
  schedule: string;
  isActive: boolean;
}

export function CategoryForm({
  disciplines,
  category,
  onSubmit,
  onCancel,
  isLoading,
}: CategoryFormProps) {
  const [form, setForm] = useState<FormState>({
    disciplineId: category?.disciplineId ?? disciplines[0]?.id ?? '',
    name: category?.name ?? '',
    ageFrom: category?.ageFrom?.toString() ?? '',
    ageTo: category?.ageTo?.toString() ?? '',
    gender: category?.gender ?? 'MIXED',
    feeAmount: category?.feeAmount ?? '',
    schedule: category?.schedule ?? '',
    isActive: category?.isActive ?? true,
  });

  const disciplineOptions = disciplines.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      name: form.name,
      disciplineId: form.disciplineId,
      gender: form.gender,
      schedule: form.schedule,
      isActive: form.isActive,
    };
    if (form.ageFrom !== '') data.ageFrom = Number(form.ageFrom);
    if (form.ageTo !== '') data.ageTo = Number(form.ageTo);
    if (form.feeAmount !== '') data.feeAmount = form.feeAmount;
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Disciplina"
        options={disciplineOptions}
        value={form.disciplineId}
        onChange={(e) => setForm({ ...form, disciplineId: e.target.value })}
        required
      />
      <Input
        label="Nombre de categoría"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Edad desde"
          type="number"
          value={form.ageFrom}
          onChange={(e) => setForm({ ...form, ageFrom: e.target.value })}
        />
        <Input
          label="Edad hasta"
          type="number"
          value={form.ageTo}
          onChange={(e) => setForm({ ...form, ageTo: e.target.value })}
        />
      </div>
      <Select
        label="Género"
        options={genderOptions}
        value={form.gender}
        onChange={(e) => setForm({ ...form, gender: e.target.value })}
      />
      <Input
        label="Monto de cuota"
        type="number"
        step="0.01"
        value={form.feeAmount}
        onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
      />
      <Input
        label="Horario"
        placeholder="Ej: Lunes y Miércoles 18:00"
        value={form.schedule}
        onChange={(e) => setForm({ ...form, schedule: e.target.value })}
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        <span className="text-sm text-gray-700">Activa</span>
      </label>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : category ? 'Guardar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}

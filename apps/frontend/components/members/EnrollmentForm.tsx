'use client';

import { useMemo, useState } from 'react';
import { Category, Discipline } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface EnrollmentFormProps {
  disciplines: Discipline[];
  memberId: string;
  onSubmit: (data: { memberId: string; categoryId: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EnrollmentForm({
  disciplines,
  memberId,
  onSubmit,
  onCancel,
  isLoading,
}: EnrollmentFormProps) {
  const [disciplineId, setDisciplineId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const categories = useMemo<Category[]>(() => {
    const discipline = disciplines.find((d) => d.id === disciplineId);
    return discipline?.categories ?? [];
  }, [disciplines, disciplineId]);

  const disciplineOptions = [
    { value: '', label: 'Seleccionar disciplina' },
    ...disciplines.map((d) => ({ value: d.id, label: d.name })),
  ];

  const categoryOptions = [
    { value: '', label: 'Seleccionar categoría' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return;
    onSubmit({ memberId, categoryId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Disciplina"
        options={disciplineOptions}
        value={disciplineId}
        onChange={(e) => {
          setDisciplineId(e.target.value);
          setCategoryId('');
        }}
        required
      />
      <Select
        label="Categoría"
        options={categoryOptions}
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        required
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || !categoryId}>
          {isLoading ? 'Inscribiendo...' : 'Inscribir'}
        </Button>
      </div>
    </form>
  );
}

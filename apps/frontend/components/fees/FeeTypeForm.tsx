'use client';

import { useState } from 'react';
import { FeeType } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface FeeTypeFormProps {
  feeType?: FeeType | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function FeeTypeForm({
  feeType,
  onSubmit,
  onCancel,
  isLoading,
}: FeeTypeFormProps) {
  const [form, setForm] = useState({
    name: feeType?.name ?? '',
    description: feeType?.description ?? '',
    isActive: feeType?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nombre"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <Input
        label="Descripción"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        <span className="text-sm text-gray-700">Activo</span>
      </label>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : feeType ? 'Guardar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}

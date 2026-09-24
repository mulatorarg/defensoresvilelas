'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Discipline } from '@/lib/types';
import { Select } from '@/components/ui/Select';
import { FormActions } from '@/components/ui/FormActions';

const schema = z.object({
  disciplineId: z.string().min(1, 'Elegí la disciplina'),
  categoryId: z.string().min(1, 'Elegí la categoría'),
});

type FormValues = z.infer<typeof schema>;

interface EnrollmentFormProps {
  disciplines: Discipline[];
  memberId: string;
  onSubmit: (data: { memberId: string; categoryId: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EnrollmentForm({ disciplines, memberId, onSubmit, onCancel, isLoading }: EnrollmentFormProps) {
  const { register, control, setValue, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { disciplineId: '', categoryId: '' },
  });
  const disciplineId = useWatch({ control, name: 'disciplineId' });

  // Solo disciplinas y categorías activas
  const active = disciplines.filter((d) => d.isActive);
  const categories = active.find((d) => d.id === disciplineId)?.categories.filter((c) => c.isActive) ?? [];

  const disciplineField = register('disciplineId');

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit({ memberId, categoryId: v.categoryId }))}
      className="space-y-4"
      noValidate
    >
      <Select
        label="Disciplina"
        options={[{ value: '', label: 'Seleccionar disciplina' }, ...active.map((d) => ({ value: d.id, label: d.name }))]}
        {...disciplineField}
        onChange={(e) => {
          disciplineField.onChange(e);
          setValue('categoryId', '');
        }}
        error={errors.disciplineId?.message}
      />
      <Select
        label="Categoría"
        options={[
          { value: '', label: 'Seleccionar categoría' },
          ...categories.map((c) => ({ value: c.id, label: c.schedule ? `${c.name} (${c.schedule})` : c.name })),
        ]}
        {...register('categoryId')}
        error={errors.categoryId?.message}
      />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel="Inscribir" loadingLabel="Inscribiendo..." />
    </form>
  );
}

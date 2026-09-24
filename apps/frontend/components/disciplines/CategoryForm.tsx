'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Category, Discipline } from '@/lib/types';
import { optionalAge, optionalMoney, optionalText, requiredText } from '@/lib/validation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormActions } from '@/components/ui/FormActions';

const genderOptions = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MIXED', label: 'Mixto' },
];

const schema = z
  .object({
    disciplineId: z.string().min(1, 'Elegí la disciplina'),
    name: requiredText('Nombre'),
    ageFrom: optionalAge,
    ageTo: optionalAge,
    gender: z.enum(['MALE', 'FEMALE', 'MIXED']),
    feeAmount: optionalMoney('Cuota'),
    schedule: optionalText(),
    isActive: z.boolean(),
  })
  .refine((v) => !v.ageFrom || !v.ageTo || Number(v.ageFrom) <= Number(v.ageTo), {
    path: ['ageTo'],
    message: 'Tiene que ser mayor o igual a "Edad desde"',
  });

type FormValues = z.input<typeof schema>;

interface CategoryFormProps {
  disciplines: Discipline[];
  category?: Category | null;
  /** Disciplina preseleccionada al crear una categoría nueva. */
  defaultDisciplineId?: string;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CategoryForm({
  disciplines,
  category,
  defaultDisciplineId,
  onSubmit,
  onCancel,
  isLoading,
}: CategoryFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      disciplineId: category?.disciplineId ?? defaultDisciplineId ?? disciplines[0]?.id ?? '',
      name: category?.name ?? '',
      ageFrom: category?.ageFrom?.toString() ?? '',
      ageTo: category?.ageTo?.toString() ?? '',
      gender: category?.gender ?? 'MIXED',
      feeAmount: category?.feeAmount ?? '',
      schedule: category?.schedule ?? '',
      isActive: category?.isActive ?? true,
    },
  });

  const submit = handleSubmit((v) => {
    const data: Record<string, unknown> = {
      name: v.name,
      disciplineId: v.disciplineId,
      gender: v.gender,
      schedule: v.schedule,
      isActive: v.isActive,
    };
    if (v.ageFrom !== '') data.ageFrom = Number(v.ageFrom);
    if (v.ageTo !== '') data.ageTo = Number(v.ageTo);
    if (v.feeAmount !== '') data.feeAmount = v.feeAmount;
    onSubmit(data);
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Select
        label="Disciplina"
        options={disciplines.map((d) => ({ value: d.id, label: d.name }))}
        {...register('disciplineId')}
        error={errors.disciplineId?.message}
      />
      <Input label="Nombre de categoría" {...register('name')} error={errors.name?.message} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Edad desde" inputMode="numeric" {...register('ageFrom')} error={errors.ageFrom?.message} />
        <Input label="Edad hasta" inputMode="numeric" {...register('ageTo')} error={errors.ageTo?.message} />
      </div>
      <Select label="Género" options={genderOptions} {...register('gender')} />
      <Input
        label="Monto de cuota"
        inputMode="decimal"
        hint="Si queda vacío se usa la cuota social del club"
        {...register('feeAmount')}
        error={errors.feeAmount?.message}
      />
      <Input
        label="Horario"
        placeholder="Ej: Lunes y Miércoles 18:00"
        {...register('schedule')}
        error={errors.schedule?.message}
      />
      <Checkbox label="Activa" {...register('isActive')} />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel={category ? 'Guardar' : 'Crear'} />
    </form>
  );
}

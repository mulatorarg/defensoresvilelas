'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Discipline, FeeType } from '@/lib/types';
import { optionalDate, optionalMoney, period } from '@/lib/validation';
import { currentPeriod } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormActions } from '@/components/ui/FormActions';

interface FeeGeneratorProps {
  feeTypes: FeeType[];
  disciplines: Discipline[];
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function FeeGenerator({ feeTypes, disciplines, onSubmit, onCancel, isLoading }: FeeGeneratorProps) {
  // Solo catálogos activos: no se generan cuotas de tipos o categorías dados de baja
  const activeTypes = feeTypes.filter((ft) => ft.isActive);
  const activeDisciplines = disciplines.filter((d) => d.isActive);

  const schema = z
    .object({
      period,
      feeTypeId: z.string().min(1, 'Elegí el tipo de cuota'),
      disciplineId: z.string(),
      categoryId: z.string(),
      amount: optionalMoney('Monto'),
      dueDate: optionalDate,
    })
    .refine(
      (v) => {
        if (v.amount) return true;
        const category = activeDisciplines.flatMap((d) => d.categories).find((c) => c.id === v.categoryId);
        return Boolean(category?.feeAmount);
      },
      { path: ['amount'], message: 'Indicá el monto (o elegí una categoría con cuota definida)' },
    );

  const { register, control, setValue, handleSubmit, formState: { errors } } = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      period: currentPeriod(),
      feeTypeId: activeTypes[0]?.id ?? '',
      disciplineId: '',
      categoryId: '',
      amount: '',
      dueDate: '',
    },
  });

  const disciplineId = useWatch({ control, name: 'disciplineId' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const categories =
    activeDisciplines.find((d) => d.id === disciplineId)?.categories.filter((c) => c.isActive) ?? [];
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const disciplineField = register('disciplineId');

  const submit = handleSubmit((v) => {
    const data: Record<string, unknown> = { period: v.period, feeTypeId: v.feeTypeId };
    if (v.dueDate) data.dueDate = v.dueDate;
    if (v.categoryId) data.categoryId = v.categoryId;
    if (v.amount) data.amount = v.amount;
    onSubmit(data);
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Período" type="month" {...register('period')} error={errors.period?.message} />
        <Select
          label="Tipo de cuota"
          options={activeTypes.map((ft) => ({ value: ft.id, label: ft.name }))}
          {...register('feeTypeId')}
          error={errors.feeTypeId?.message}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Disciplina"
          options={[{ value: '', label: 'Todas (todos los socios activos)' }, ...activeDisciplines.map((d) => ({ value: d.id, label: d.name }))]}
          {...disciplineField}
          onChange={(e) => {
            disciplineField.onChange(e);
            setValue('categoryId', '');
          }}
        />
        <Select
          label="Categoría"
          options={[{ value: '', label: 'Todas las categorías' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          {...register('categoryId')}
        />
      </div>
      <Input
        label="Monto"
        inputMode="decimal"
        hint={
          selectedCategory?.feeAmount
            ? `Vacío = cuota de la categoría (${formatMoney(selectedCategory.feeAmount)})`
            : 'Obligatorio salvo que la categoría tenga cuota definida'
        }
        {...register('amount')}
        error={errors.amount?.message}
      />
      <Input label="Fecha de vencimiento" type="date" {...register('dueDate')} error={errors.dueDate?.message} />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel="Generar cuotas" loadingLabel="Generando..." />
    </form>
  );
}

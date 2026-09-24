'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { money, optionalText, requiredDate } from '@/lib/validation';
import { todayLocal } from '@/lib/dates';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormActions } from '@/components/ui/FormActions';

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

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.string().min(1),
  amount: money('Monto'),
  description: optionalText(1000),
  date: requiredDate('Fecha'),
});

interface TransactionFormProps {
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TransactionForm({ onSubmit, onCancel, isLoading }: TransactionFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { type: 'EXPENSE', category: 'Gastos varios', amount: '', description: '', date: todayLocal() },
  });

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Tipo" options={typeOptions} {...register('type')} />
        <Select label="Categoría" options={categoryOptions} {...register('category')} />
      </div>
      <Input label="Monto" inputMode="decimal" {...register('amount')} error={errors.amount?.message} />
      <Input label="Descripción" {...register('description')} error={errors.description?.message} />
      <Input label="Fecha" type="date" {...register('date')} error={errors.date?.message} />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel="Guardar" />
    </form>
  );
}

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FeeType } from '@/lib/types';
import { optionalText, requiredText } from '@/lib/validation';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormActions } from '@/components/ui/FormActions';

const schema = z.object({
  name: requiredText('Nombre'),
  description: optionalText(1000),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface FeeTypeFormProps {
  feeType?: FeeType | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function FeeTypeForm({ feeType, onSubmit, onCancel, isLoading }: FeeTypeFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: feeType?.name ?? '',
      description: feeType?.description ?? '',
      isActive: feeType?.isActive ?? true,
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4" noValidate>
      <Input label="Nombre" {...register('name')} error={errors.name?.message} />
      <Input label="Descripción" {...register('description')} error={errors.description?.message} />
      <Checkbox label="Activo" hint="Los inactivos no se ofrecen al generar cuotas" {...register('isActive')} />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel={feeType ? 'Guardar' : 'Crear'} />
    </form>
  );
}

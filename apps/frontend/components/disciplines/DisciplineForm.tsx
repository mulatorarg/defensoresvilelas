'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Discipline } from '@/lib/types';
import { optionalText, requiredText } from '@/lib/validation';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormActions } from '@/components/ui/FormActions';
import { ImageUpload } from '@/components/common/ImageUpload';

const schema = z.object({
  name: requiredText('Nombre'),
  description: optionalText(1000),
  icon: optionalText(16),
  imageUrl: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface DisciplineFormProps {
  discipline?: Discipline | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DisciplineForm({ discipline, onSubmit, onCancel, isLoading }: DisciplineFormProps) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: discipline?.name ?? '',
      description: discipline?.description ?? '',
      icon: discipline?.icon ?? '',
      imageUrl: discipline?.imageUrl ?? '',
      isActive: discipline?.isActive ?? true,
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4" noValidate>
      <Input label="Nombre" {...register('name')} error={errors.name?.message} />
      <Input label="Descripción" {...register('description')} error={errors.description?.message} />
      <Input
        label="Ícono en la web"
        hint="Un emoji que acompaña el nombre en la landing (opcional)"
        {...register('icon')}
        error={errors.icon?.message}
      />
      <Controller
        control={control}
        name="imageUrl"
        render={({ field }) => (
          <ImageUpload
            label="Foto para la web"
            folder="club"
            maxSize={1200}
            value={field.value}
            onChange={field.onChange}
            hint="Si no cargás una, la web usa una foto genérica del deporte"
          />
        )}
      />
      <Checkbox label="Activa" {...register('isActive')} />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel={discipline ? 'Guardar' : 'Crear'} />
    </form>
  );
}

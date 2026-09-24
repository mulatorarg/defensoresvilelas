'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Member } from '@/lib/types';
import { dni, optionalDate, optionalEmail, optionalText, requiredText } from '@/lib/validation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormActions } from '@/components/ui/FormActions';
import { ImageUpload } from '@/components/common/ImageUpload';

const statusOptions = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
];

const schema = z.object({
  firstName: requiredText('Nombre'),
  lastName: requiredText('Apellido'),
  dni,
  email: optionalEmail,
  phone: optionalText(),
  address: optionalText(),
  birthDate: optionalDate,
  photoUrl: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  notes: optionalText(1000),
  position: optionalText(),
  jerseyNumber: z.string().refine((v) => v === '' || /^\d{1,3}$/.test(v), 'Número inválido'),
  federationId: optionalText(),
  medicalPassDue: optionalDate,
});

type FormValues = z.infer<typeof schema>;

interface MemberFormProps {
  member?: Member | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const dateOnly = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

export function MemberForm({ member, onSubmit, onCancel, isLoading }: MemberFormProps) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: member?.firstName ?? '',
      lastName: member?.lastName ?? '',
      dni: member?.dni ?? '',
      email: member?.email ?? '',
      phone: member?.phone ?? '',
      address: member?.address ?? '',
      birthDate: dateOnly(member?.birthDate),
      photoUrl: member?.photoUrl ?? '',
      status: member?.status ?? 'ACTIVE',
      notes: member?.notes ?? '',
      position: member?.player?.position ?? '',
      jerseyNumber: member?.player?.jerseyNumber?.toString() ?? '',
      federationId: member?.player?.federationId ?? '',
      medicalPassDue: dateOnly(member?.player?.medicalPassDue),
    },
  });

  const submit = handleSubmit((v) => {
    const data: Record<string, unknown> = {
      firstName: v.firstName,
      lastName: v.lastName,
      dni: v.dni,
      email: v.email,
      phone: v.phone,
      address: v.address,
      photoUrl: v.photoUrl,
      status: v.status,
      notes: v.notes,
    };
    if (v.birthDate) data.birthDate = v.birthDate;

    // El perfil deportivo se manda solo si tiene algún dato (o si ya existía):
    // antes se creaba un perfil vacío para cada socio aunque no jugara
    const hasPlayerData = [v.position, v.jerseyNumber, v.federationId, v.medicalPassDue].some(Boolean);
    if (hasPlayerData || member?.player) {
      data.playerProfile = {
        position: v.position,
        federationId: v.federationId,
        ...(v.jerseyNumber ? { jerseyNumber: Number(v.jerseyNumber) } : {}),
        ...(v.medicalPassDue ? { medicalPassDue: v.medicalPassDue } : {}),
      };
    }
    onSubmit(data);
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Nombre" autoComplete="off" {...register('firstName')} error={errors.firstName?.message} />
        <Input label="Apellido" autoComplete="off" {...register('lastName')} error={errors.lastName?.message} />
        <Input label="DNI" inputMode="numeric" {...register('dni')} error={errors.dni?.message} />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Teléfono" type="tel" hint="Con código de área, para contactarlo por WhatsApp" {...register('phone')} error={errors.phone?.message} />
        <Input label="Dirección" {...register('address')} error={errors.address?.message} />
        <Input label="Fecha de nacimiento" type="date" {...register('birthDate')} error={errors.birthDate?.message} />
        <Select label="Estado" options={statusOptions} {...register('status')} />
        <div className="md:col-span-2">
          <Controller
            control={control}
            name="photoUrl"
            render={({ field }) => (
              <ImageUpload
                label="Foto"
                folder="socios"
                square
                maxSize={800}
                value={field.value}
                onChange={field.onChange}
                hint="Se recorta cuadrada y se achica antes de subir"
              />
            )}
          />
        </div>
      </div>

      <Input label="Notas" {...register('notes')} error={errors.notes?.message} />

      <fieldset className="mt-4 border-t border-gray-200 pt-4">
        <legend className="mb-3 pt-4 font-semibold text-gray-800">Datos deportivos (opcional)</legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Posición" {...register('position')} error={errors.position?.message} />
          <Input label="Número de camiseta" inputMode="numeric" {...register('jerseyNumber')} error={errors.jerseyNumber?.message} />
          <Input label="ID Federación" {...register('federationId')} error={errors.federationId?.message} />
          <Input label="Vencimiento apto físico" type="date" {...register('medicalPassDue')} error={errors.medicalPassDue?.message} />
        </div>
      </fieldset>

      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel={member ? 'Guardar cambios' : 'Crear socio'} />
    </form>
  );
}

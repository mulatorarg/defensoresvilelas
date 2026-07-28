'use client';

import { useState, useEffect } from 'react';
import { Member } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface MemberFormProps {
  member?: Member | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const statusOptions = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
];

export function MemberForm({
  member,
  onSubmit,
  onCancel,
  isLoading,
}: MemberFormProps) {
  const [form, setForm] = useState<Record<string, unknown>>({
    firstName: '',
    lastName: '',
    dni: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    photoUrl: '',
    status: 'ACTIVE',
    notes: '',
    playerProfile: {
      position: '',
      jerseyNumber: '',
      federationId: '',
      medicalPassDue: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (member) {
      setForm({
        firstName: member.firstName,
        lastName: member.lastName,
        dni: member.dni,
        email: member.email ?? '',
        phone: member.phone ?? '',
        address: member.address ?? '',
        birthDate: member.birthDate ? member.birthDate.split('T')[0] : '',
        photoUrl: member.photoUrl ?? '',
        status: member.status,
        notes: member.notes ?? '',
        playerProfile: {
          position: member.player?.position ?? '',
          jerseyNumber: member.player?.jerseyNumber ?? '',
          federationId: member.player?.federationId ?? '',
          medicalPassDue: member.player?.medicalPassDue
            ? member.player.medicalPassDue.split('T')[0]
            : '',
          notes: member.player?.notes ?? '',
        },
      });
    }
  }, [member]);

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updatePlayerField = (field: string, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      playerProfile: { ...(prev.playerProfile as object), [field]: value },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form };
    if (data.birthDate === '') delete data.birthDate;
    const player = data.playerProfile as Record<string, unknown>;
    if (player?.medicalPassDue === '') delete player.medicalPassDue;
    if (player?.jerseyNumber === '' || player?.jerseyNumber === undefined) {
      delete player.jerseyNumber;
    } else {
      player.jerseyNumber = Number(player.jerseyNumber);
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre"
          value={form.firstName as string}
          onChange={(e) => updateField('firstName', e.target.value)}
          required
        />
        <Input
          label="Apellido"
          value={form.lastName as string}
          onChange={(e) => updateField('lastName', e.target.value)}
          required
        />
        <Input
          label="DNI"
          value={form.dni as string}
          onChange={(e) => updateField('dni', e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email as string}
          onChange={(e) => updateField('email', e.target.value)}
        />
        <Input
          label="Teléfono"
          value={form.phone as string}
          onChange={(e) => updateField('phone', e.target.value)}
        />
        <Input
          label="Dirección"
          value={form.address as string}
          onChange={(e) => updateField('address', e.target.value)}
        />
        <Input
          label="Fecha de nacimiento"
          type="date"
          value={form.birthDate as string}
          onChange={(e) => updateField('birthDate', e.target.value)}
        />
        <Input
          label="URL de foto"
          value={form.photoUrl as string}
          onChange={(e) => updateField('photoUrl', e.target.value)}
        />
        <Select
          label="Estado"
          options={statusOptions}
          value={form.status as string}
          onChange={(e) => updateField('status', e.target.value)}
        />
      </div>

      <Input
        label="Notas"
        value={form.notes as string}
        onChange={(e) => updateField('notes', e.target.value)}
      />

      <div className="border-t border-gray-200 pt-4 mt-4">
        <h3 className="font-semibold text-gray-800 mb-3">
          Datos deportivos (opcional)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Posición"
            value={(form.playerProfile as Record<string, unknown>)?.position as string}
            onChange={(e) => updatePlayerField('position', e.target.value)}
          />
          <Input
            label="Número de camiseta"
            type="number"
            value={(form.playerProfile as Record<string, unknown>)?.jerseyNumber as string}
            onChange={(e) => updatePlayerField('jerseyNumber', e.target.value)}
          />
          <Input
            label="ID Federación"
            value={(form.playerProfile as Record<string, unknown>)?.federationId as string}
            onChange={(e) => updatePlayerField('federationId', e.target.value)}
          />
          <Input
            label="Vencimiento apto físico"
            type="date"
            value={(form.playerProfile as Record<string, unknown>)?.medicalPassDue as string}
            onChange={(e) => updatePlayerField('medicalPassDue', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : member ? 'Guardar cambios' : 'Crear socio'}
        </Button>
      </div>
    </form>
  );
}

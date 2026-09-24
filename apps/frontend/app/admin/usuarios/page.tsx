'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, UserPlus } from 'lucide-react';
import { createUser, getUsers, resetUserPassword, updateUser } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { errorText, qk } from '@/lib/queries';
import { optionalText, requiredText } from '@/lib/validation';
import type { StaffRole, StaffUser } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormActions } from '@/components/ui/FormActions';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { useFeedback } from '@/components/ui/Feedback';
import { RoleGuard } from '@/components/common/RoleGuard';

const ROLES: { value: StaffRole; label: string; hint: string }[] = [
  { value: 'ADMIN', label: 'Administrador', hint: 'Todo, incluidos usuarios y configuración' },
  { value: 'OPERATOR', label: 'Secretaría', hint: 'Socios, cuotas, caja, reportes y contenido' },
  { value: 'TEACHER', label: 'Profesor', hint: 'Consulta de socios, inscripciones y asistencia' },
  { value: 'STAFF', label: 'Personal', hint: 'Consulta de socios y control de acceso' },
];
const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

const userSchema = z.object({
  firstName: requiredText('Nombre'),
  lastName: requiredText('Apellido'),
  email: z.string().trim().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Email inválido'),
  phone: optionalText(),
  role: z.enum(['ADMIN', 'OPERATOR', 'TEACHER', 'STAFF']),
  password: z.string(),
});
type UserValues = z.infer<typeof userSchema>;

const passwordSchema = z.object({ password: z.string().min(8, 'Mínimo 8 caracteres') });

function UserForm({
  user,
  isSelf,
  onSubmit,
  onCancel,
  isLoading,
}: {
  user: StaffUser | null;
  isSelf: boolean;
  onSubmit: (data: UserValues) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  // La contraseña inicial solo se pide al crear
  const schema = user
    ? userSchema
    : userSchema.extend({ password: z.string().min(8, 'Mínimo 8 caracteres') });
  const { register, handleSubmit, formState: { errors } } = useForm<UserValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      role: user?.role ?? 'OPERATOR',
      password: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Nombre" {...register('firstName')} error={errors.firstName?.message} />
        <Input label="Apellido" {...register('lastName')} error={errors.lastName?.message} />
      </div>
      <Input label="Email" type="email" autoComplete="off" {...register('email')} error={errors.email?.message} />
      <Input label="Teléfono" type="tel" {...register('phone')} error={errors.phone?.message} />
      <Select
        label="Rol"
        options={ROLES.map((r) => ({ value: r.value, label: `${r.label} - ${r.hint}` }))}
        disabled={isSelf}
        {...register('role')}
      />
      {!user && (
        <Input
          label="Contraseña inicial"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres. La persona la cambia desde Mi cuenta."
          {...register('password')}
          error={errors.password?.message}
        />
      )}
      {user && <p className="text-xs text-gray-400">Cambiar el rol cierra las sesiones abiertas de ese usuario.</p>}
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel="Guardar" />
    </form>
  );
}

function PasswordForm({ onSubmit, onCancel, isLoading }: { onSubmit: (password: string) => void; onCancel: () => void; isLoading: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<{ password: string }>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });
  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v.password))} className="space-y-4" noValidate>
      <Input
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres. Se cierran sus sesiones abiertas."
        {...register('password')}
        error={errors.password?.message}
      />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel="Guardar" />
    </form>
  );
}

function UsuariosList() {
  const me = useStoredUser();
  const { toast, confirmAction } = useFeedback();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(null);
  const [resetting, setResetting] = useState<StaffUser | null>(null);

  const usersQuery = useQuery<StaffUser[]>({ queryKey: qk.users, queryFn: getUsers });
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.users });
  const fail = (fallback: string) => (err: unknown) => toast(errorText(err, fallback), 'error');

  const save = useMutation({
    mutationFn: (v: UserValues) => {
      const data = { firstName: v.firstName, lastName: v.lastName, email: v.email, role: v.role, phone: v.phone || null };
      return editing && editing !== 'new' ? updateUser(editing.id, data) : createUser({ ...data, password: v.password });
    },
    onSuccess: () => {
      toast(editing === 'new' ? 'Usuario creado' : 'Usuario actualizado');
      setEditing(null);
      refresh();
    },
    onError: fail('Error al guardar'),
  });

  const reset = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPassword(id, password),
    onSuccess: () => {
      toast(`Contraseña de ${resetting?.firstName} actualizada. Pasásela por un medio seguro.`);
      setResetting(null);
    },
    onError: fail('Error al cambiar la contraseña'),
  });

  const toggleActive = async (user: StaffUser) => {
    const ok = await confirmAction({
      title: user.isActive ? `¿Desactivar a ${user.firstName}?` : `¿Reactivar a ${user.firstName}?`,
      message: user.isActive
        ? 'No va a poder ingresar y se cierran sus sesiones abiertas.'
        : 'Va a poder volver a ingresar con su contraseña.',
      confirmLabel: user.isActive ? 'Desactivar' : 'Reactivar',
      danger: user.isActive,
    });
    if (!ok) return;
    try {
      await updateUser(user.id, { isActive: !user.isActive });
      toast(user.isActive ? 'Usuario desactivado' : 'Usuario reactivado');
      refresh();
    } catch (err) {
      fail('Error al actualizar')(err);
    }
  };

  const editingUser = editing && editing !== 'new' ? editing : null;
  const users = usersQuery.data ?? [];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing('new')} icon={<UserPlus className="h-4 w-4" aria-hidden />}>
          Nuevo usuario
        </Button>
      </div>

      {usersQuery.isPending ? (
        <SkeletonRows count={3} />
      ) : usersQuery.isError ? (
        <ErrorState error={usersQuery.error} onRetry={() => usersQuery.refetch()} />
      ) : users.length === 0 ? (
        <EmptyState title="No hay usuarios cargados" />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {users.map((user) => {
            const isMe = user.id === me?.id;
            return (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className={user.isActive ? '' : 'opacity-50'}>
                  <p className="font-semibold text-gray-900">
                    {user.lastName}, {user.firstName}
                    {isMe && <span className="ml-2 text-xs font-normal text-gray-400">(vos)</span>}
                  </p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <p className="mt-1 text-xs">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{roleLabel(user.role)}</span>
                    {!user.isActive && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-500">Inactivo</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(user)} icon={<Pencil className="h-4 w-4" aria-hidden />}>
                    Editar
                  </Button>
                  {!isMe && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setResetting(user)} icon={<KeyRound className="h-4 w-4" aria-hidden />}>
                        Nueva contraseña
                      </Button>
                      <Button variant={user.isActive ? 'danger' : 'soft'} size="sm" onClick={() => toggleActive(user)}>
                        {user.isActive ? 'Desactivar' : 'Reactivar'}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}>
        {editing !== null && (
          <UserForm
            key={editingUser?.id ?? 'new'}
            user={editingUser}
            isSelf={editingUser?.id === me?.id}
            onSubmit={(v) => save.mutate(v)}
            onCancel={() => setEditing(null)}
            isLoading={save.isPending}
          />
        )}
      </Modal>

      <Modal
        isOpen={resetting !== null}
        onClose={() => setResetting(null)}
        title="Nueva contraseña"
        subtitle={resetting ? `${resetting.firstName} ${resetting.lastName}` : undefined}
      >
        {resetting && (
          <PasswordForm
            key={resetting.id}
            onSubmit={(password) => reset.mutate({ id: resetting.id, password })}
            onCancel={() => setResetting(null)}
            isLoading={reset.isPending}
          />
        )}
      </Modal>
    </>
  );
}

export default function UsuariosPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Usuarios" description="Quiénes pueden ingresar al panel y con qué permisos." />
      <RoleGuard roles={['ADMIN']}>
        <UsuariosList />
      </RoleGuard>
    </div>
  );
}

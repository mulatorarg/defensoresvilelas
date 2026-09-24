'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { changeOwnPassword, logoutAllSessions } from '@/lib/api';
import { clearSession, setSession, type LoginResponse } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useFeedback } from '@/components/ui/Feedback';

/** Mi cuenta: cambio de contraseña propia y cierre de todas las sesiones. */
export function AccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, confirmAction } = useFeedback();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setForm({ current: '', next: '', confirm: '' });
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.next.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }
    if (form.next !== form.confirm) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      // Devuelve un token nuevo: las demás sesiones quedan cerradas
      const session: LoginResponse = await changeOwnPassword(form.current, form.next);
      setSession(session);
      toast('Contraseña actualizada. Se cerraron tus otras sesiones.');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutAll = async () => {
    const ok = await confirmAction({
      title: '¿Cerrar sesión en todos los dispositivos?',
      message: 'Vas a tener que volver a ingresar, también en este dispositivo.',
      confirmLabel: 'Cerrar todas',
      danger: true,
    });
    if (!ok) return;
    try {
      await logoutAllSessions();
    } finally {
      clearSession();
      queryClient.clear();
      router.push('/login/');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Mi cuenta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm font-semibold text-gray-800">Cambiar contraseña</p>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Input
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          required
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
        />
        <Input
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres"
          required
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
        />
        <Input
          label="Repetí la contraseña nueva"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Cambiar contraseña'}
          </Button>
        </div>
      </form>
      <div className="mt-6 border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-gray-800">Sesiones</p>
        <p className="mt-1 text-sm text-gray-500">
          Si ingresaste desde una computadora que no es tuya, podés cerrar la sesión en todos lados.
        </p>
        <Button className="mt-3" variant="danger" size="sm" onClick={handleLogoutAll}>
          Cerrar sesión en todos los dispositivos
        </Button>
      </div>
    </Modal>
  );
}

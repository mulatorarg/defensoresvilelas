'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ClipboardCheck, Trash2 } from 'lucide-react';
import { Attendance } from '@/lib/types';
import { getAttendances, bulkCreateAttendance, deleteAttendance } from '@/lib/api';
import { errorText, qk, useDisciplines } from '@/lib/queries';
import { formatDateOnly, todayLocal } from '@/lib/dates';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { useFeedback } from '@/components/ui/Feedback';
import { AttendanceTaker } from '@/components/attendances/AttendanceTaker';

export default function AsistenciasPage() {
  const { toast, confirmAction } = useFeedback();
  const queryClient = useQueryClient();
  const today = todayLocal();
  const [date, setDate] = useState(today);
  const [takerOpen, setTakerOpen] = useState(false);

  const attendancesQuery = useQuery<Attendance[]>({
    queryKey: qk.attendances({ date }),
    queryFn: () => getAttendances({ date }),
  });
  const { data: disciplines = [] } = useDisciplines();
  const attendances = attendancesQuery.data ?? [];

  const save = useMutation({
    mutationFn: bulkCreateAttendance,
    onSuccess: (_result, variables) => {
      toast('Asistencia guardada');
      setTakerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      setDate(String(variables.date));
    },
    onError: (err) => toast(errorText(err, 'Error al guardar'), 'error'),
  });

  const handleDelete = async (att: Attendance) => {
    const ok = await confirmAction({
      title: '¿Eliminar este registro de asistencia?',
      message: `${att.member.lastName}, ${att.member.firstName} · ${formatDateOnly(att.date)}`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAttendance(att.id);
      toast('Registro eliminado');
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
    } catch (err) {
      toast(errorText(err, 'Error al eliminar'), 'error');
    }
  };

  const present = attendances.filter((a) => a.present).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Asistencia" description="Presentes y ausentes por categoría y día.">
        <Button onClick={() => setTakerOpen(true)} icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}>
          Tomar asistencia
        </Button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Input
            label="Fecha"
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
        {date !== today && (
          <Button variant="ghost" onClick={() => setDate(today)}>
            Hoy
          </Button>
        )}
        {attendances.length > 0 && (
          <p className="pb-2 text-sm text-gray-500" role="status">
            {present} presentes · {attendances.length - present} ausentes
          </p>
        )}
      </div>

      {attendancesQuery.isPending ? (
        <SkeletonRows />
      ) : attendancesQuery.isError ? (
        <ErrorState error={attendancesQuery.error} onRetry={() => attendancesQuery.refetch()} />
      ) : attendances.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-7 w-7 text-gray-400" aria-hidden />}
          title={`No hay asistencia cargada para el ${formatDateOnly(date)}`}
          hint="Tomá asistencia eligiendo la disciplina y la categoría."
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {attendances.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {att.member.lastName}, {att.member.firstName}
                </p>
                <p className="text-sm text-gray-600">
                  {att.category.discipline.name} - {att.category.name}
                </p>
                <p className="text-xs text-gray-500">
                  <span className={att.present ? 'font-semibold text-green-700' : 'font-semibold text-red-600'}>
                    {att.present ? 'Presente' : 'Ausente'}
                  </span>
                  {att.notes && ` · ${att.notes}`}
                </p>
              </div>
              <button
                onClick={() => handleDelete(att)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Eliminar la asistencia de ${att.member.firstName} ${att.member.lastName}`}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={takerOpen} onClose={() => setTakerOpen(false)} title="Tomar asistencia">
        {takerOpen && (
          <AttendanceTaker
            disciplines={disciplines}
            initialDate={date}
            onSubmit={(data) => save.mutate(data)}
            onCancel={() => setTakerOpen(false)}
            isLoading={save.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

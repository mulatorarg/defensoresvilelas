'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Attendance, Discipline } from '@/lib/types';
import { getAttendances, getCategory } from '@/lib/api';
import { errorText, qk } from '@/lib/queries';
import { todayLocal } from '@/lib/dates';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface AttendanceRecord {
  memberId: string;
  present: boolean;
  notes: string;
}

interface EnrolledMember {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
}

interface AttendanceTakerProps {
  disciplines: Discipline[];
  /** Fecha con la que abre (la elegida en el listado). */
  initialDate?: string;
  onSubmit: (data: { categoryId: string; date: string; records: AttendanceRecord[] }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AttendanceTaker({ disciplines, initialDate, onSubmit, onCancel, isLoading }: AttendanceTakerProps) {
  const today = todayLocal();
  const [disciplineId, setDisciplineId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(initialDate || today);
  // Cambios que hizo el usuario sobre lo cargado (se descartan al cambiar categoría o fecha)
  const [edits, setEdits] = useState<Record<string, AttendanceRecord>>({});

  // Solo disciplinas y categorías activas
  const activeDisciplines = disciplines.filter((d) => d.isActive);
  const categories = activeDisciplines.find((d) => d.id === disciplineId)?.categories.filter((c) => c.isActive) ?? [];

  // Inscriptos activos de la categoría (sin el tope del listado de socios)
  const categoryQuery = useQuery<{ enrollments: { member: EnrolledMember }[] }>({
    queryKey: qk.category(categoryId),
    queryFn: () => getCategory(categoryId),
    enabled: Boolean(categoryId),
  });
  // Asistencia ya guardada ese día: se precarga para editarla en lugar de pisarla
  const savedQuery = useQuery<Attendance[]>({
    queryKey: qk.attendances({ categoryId, date }),
    queryFn: () => getAttendances({ categoryId, date }),
    enabled: Boolean(categoryId && date),
  });

  const members = useMemo(
    () =>
      (categoryQuery.data?.enrollments ?? [])
        .map((e) => e.member)
        .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es')),
    [categoryQuery.data],
  );
  const saved = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    (savedQuery.data ?? []).forEach((a) => {
      map[a.memberId] = { memberId: a.memberId, present: a.present, notes: a.notes ?? '' };
    });
    return map;
  }, [savedQuery.data]);

  const recordFor = (memberId: string): AttendanceRecord =>
    edits[memberId] ?? saved[memberId] ?? { memberId, present: true, notes: '' };
  const update = (memberId: string, change: Partial<AttendanceRecord>) =>
    setEdits((prev) => ({ ...prev, [memberId]: { ...recordFor(memberId), ...change } }));

  const loading = categoryQuery.isFetching || savedQuery.isFetching;
  const loadError = categoryQuery.error ?? savedQuery.error;
  const existingCount = savedQuery.data?.length ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !date) return;
    onSubmit({ categoryId, date, records: members.map((m) => recordFor(m.id)) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Select
          label="Disciplina"
          options={[{ value: '', label: 'Seleccionar disciplina' }, ...activeDisciplines.map((d) => ({ value: d.id, label: d.name }))]}
          value={disciplineId}
          onChange={(e) => {
            setDisciplineId(e.target.value);
            setCategoryId('');
            setEdits({});
          }}
          required
        />
        <Select
          label="Categoría"
          options={[{ value: '', label: 'Seleccionar categoría' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setEdits({});
          }}
          required
        />
        <Input
          label="Fecha"
          type="date"
          max={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setEdits({});
          }}
          required
        />
      </div>

      {categoryId && (
        <>
          {existingCount > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
              Ya hay asistencia guardada para este día ({existingCount} registros): se muestra para editarla.
            </p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{members.length} socios inscriptos</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setEdits(Object.fromEntries(members.map((m) => [m.id, { ...recordFor(m.id), present: true }])))
              }
            >
              Marcar todos presentes
            </Button>
          </div>

          <div className="max-h-96 divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200">
            {loading && members.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Cargando inscriptos...</p>
            ) : loadError ? (
              <p className="p-4 text-sm text-red-600">{errorText(loadError, 'No se pudieron cargar los inscriptos')}</p>
            ) : members.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No hay socios inscriptos en esta categoría.</p>
            ) : (
              members.map((member) => {
                const record = recordFor(member.id);
                return (
                  <div key={member.id} className="flex flex-wrap items-center gap-3 p-3 hover:bg-gray-50">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={record.present}
                        onChange={() => update(member.id, { present: !record.present })}
                        className="h-5 w-5 shrink-0 rounded accent-[var(--color-primary)]"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {member.lastName}, {member.firstName}
                        </span>
                        <span className="block text-xs text-gray-500">
                          DNI {member.dni} · {record.present ? 'Presente' : 'Ausente'}
                        </span>
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="Notas"
                      aria-label={`Notas de ${member.firstName} ${member.lastName}`}
                      value={record.notes}
                      onChange={(e) => update(member.id, { notes: e.target.value })}
                      className="w-full rounded border border-gray-300 px-3 py-1 text-sm sm:w-40"
                    />
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || loading || !categoryId || members.length === 0}>
          {isLoading ? 'Guardando...' : 'Guardar asistencia'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Category, Discipline, Member } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface AttendanceRecord {
  memberId: string;
  present: boolean;
  notes: string;
}

interface AttendanceTakerProps {
  disciplines: Discipline[];
  members: Member[];
  onSubmit: (data: {
    categoryId: string;
    date: string;
    records: AttendanceRecord[];
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AttendanceTaker({
  disciplines,
  members,
  onSubmit,
  onCancel,
  isLoading,
}: AttendanceTakerProps) {
  const today = new Date().toISOString().split('T')[0];
  const [disciplineId, setDisciplineId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});

  const categories = useMemo<Category[]>(() => {
    const discipline = disciplines.find((d) => d.id === disciplineId);
    return discipline?.categories ?? [];
  }, [disciplines, disciplineId]);

  const enrolledMembers = useMemo(() => {
    return members.filter((m) =>
      m.enrollments.some((e) => e.categoryId === categoryId),
    );
  }, [members, categoryId]);

  const disciplineOptions = [
    { value: '', label: 'Seleccionar disciplina' },
    ...disciplines.map((d) => ({ value: d.id, label: d.name })),
  ];

  const categoryOptions = [
    { value: '', label: 'Seleccionar categoría' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const togglePresent = (memberId: string) => {
    setRecords((prev) => ({
      ...prev,
      [memberId]: {
        memberId,
        present: !(prev[memberId]?.present ?? true),
        notes: prev[memberId]?.notes ?? '',
      },
    }));
  };

  const setNotes = (memberId: string, notes: string) => {
    setRecords((prev) => ({
      ...prev,
      [memberId]: {
        memberId,
        present: prev[memberId]?.present ?? true,
        notes,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !date) return;

    const recordsToSubmit = enrolledMembers.map((m) => ({
      memberId: m.id,
      present: records[m.id]?.present ?? true,
      notes: records[m.id]?.notes ?? '',
    }));

    onSubmit({ categoryId, date, records: recordsToSubmit });
  };

  const allPresent = () => {
    const updated: Record<string, AttendanceRecord> = {};
    enrolledMembers.forEach((m) => {
      updated[m.id] = { memberId: m.id, present: true, notes: records[m.id]?.notes ?? '' };
    });
    setRecords(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Disciplina"
          options={disciplineOptions}
          value={disciplineId}
          onChange={(e) => {
            setDisciplineId(e.target.value);
            setCategoryId('');
          }}
          required
        />
        <Select
          label="Categoría"
          options={categoryOptions}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
      </div>

      {categoryId && (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {enrolledMembers.length} socios inscriptos
            </p>
            <Button type="button" variant="secondary" onClick={allPresent}>
              Marcar todos presentes
            </Button>
          </div>

          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {enrolledMembers.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">
                No hay socios inscriptos en esta categoría.
              </p>
            ) : (
              enrolledMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-3 flex items-center gap-4 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={records[member.id]?.present ?? true}
                    onChange={() => togglePresent(member.id)}
                    className="w-5 h-5 text-primary rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      {member.lastName}, {member.firstName}
                    </p>
                    <p className="text-xs text-gray-500">DNI {member.dni}</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Notas"
                    value={records[member.id]?.notes ?? ''}
                    onChange={(e) => setNotes(member.id, e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm w-40"
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || !categoryId}>
          {isLoading ? 'Guardando...' : 'Guardar asistencia'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Attendance, Discipline, Member } from '@/lib/types';
import {
  getAttendances,
  getDisciplines,
  getMembers,
  bulkCreateAttendance,
  deleteAttendance,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AttendanceTaker } from '@/components/attendances/AttendanceTaker';

export default function AsistenciasPage() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [takerOpen, setTakerOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attData, discData, membersData] = await Promise.all([
        getAttendances({ date: today }),
        getDisciplines(),
        getMembers({ limit: 1000 }),
      ]);
      setAttendances(attData);
      setDisciplines(discData);
      setMembers(membersData.items);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (data: {
    categoryId: string;
    date: string;
    records: { memberId: string; present: boolean; notes: string }[];
  }) => {
    setSaving(true);
    try {
      await bulkCreateAttendance(data);
      setTakerOpen(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro de asistencia?')) return;
    try {
      await deleteAttendance(id);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">Asistencia</h1>
        <Button onClick={() => setTakerOpen(true)}>Tomar asistencia</Button>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : attendances.length === 0 ? (
        <p className="text-gray-500">No hay registros de asistencia para hoy.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {attendances.map((att) => (
            <div
              key={att.id}
              className="p-4 flex justify-between items-center hover:bg-gray-50"
            >
              <div>
                <p className="font-medium">
                  {att.member.lastName}, {att.member.firstName}
                </p>
                <p className="text-sm text-gray-600">
                  {att.category.discipline.name} - {att.category.name}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(att.date).toLocaleDateString('es-AR')} —{' '}
                  {att.present ? 'Presente' : 'Ausente'}
                  {att.notes && ` · ${att.notes}`}
                </p>
              </div>
              <Button
                variant="ghost"
                className="text-sm text-red-600 hover:text-red-700"
                onClick={() => handleDelete(att.id)}
              >
                Eliminar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={takerOpen}
        onClose={() => setTakerOpen(false)}
        title="Tomar asistencia"
      >
        <AttendanceTaker
          disciplines={disciplines}
          members={members}
          onSubmit={handleSubmit}
          onCancel={() => setTakerOpen(false)}
          isLoading={saving}
        />
      </Modal>
    </div>
  );
}

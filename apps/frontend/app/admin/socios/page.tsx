'use client';

import { useEffect, useState } from 'react';
import { Member, PaginatedResponse, Discipline } from '@/lib/types';
import {
  getMembers,
  createMember,
  updateMember,
  deleteMember,
  getDisciplines,
  createEnrollment,
  deleteEnrollment,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { MemberTable } from '@/components/members/MemberTable';
import { MemberForm } from '@/components/members/MemberForm';
import { EnrollmentForm } from '@/components/members/EnrollmentForm';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
];

export default function SociosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Member>['meta'] | null>(
    null,
  );
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [enrollingMember, setEnrollingMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data: PaginatedResponse<Member> = await getMembers({
        search,
        status,
        page,
        limit: 20,
      });
      setMembers(data.items);
      setMeta(data.meta);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cargar socios');
    } finally {
      setLoading(false);
    }
  };

  const fetchDisciplines = async () => {
    try {
      const data = await getDisciplines();
      setDisciplines(data);
    } catch {
      // Silencioso: no bloquea la carga de socios
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchDisciplines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  const handleOpenCreate = () => {
    setEditingMember(null);
    setIsModalOpen(true);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editingMember) {
        await updateMember(editingMember.id, data);
      } else {
        await createMember(data);
      }
      handleCloseModal();
      fetchMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member: Member) => {
    if (!confirm(`¿Dar de baja a ${member.firstName} ${member.lastName}?`)) {
      return;
    }
    try {
      await deleteMember(member.id);
      fetchMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al dar de baja');
    }
  };

  const handleEnroll = (member: Member) => {
    setEnrollingMember(member);
  };

  const handleCloseEnrollment = () => {
    setEnrollingMember(null);
  };

  const handleSubmitEnrollment = async (data: {
    memberId: string;
    categoryId: string;
  }) => {
    setSaving(true);
    try {
      await createEnrollment(data);
      handleCloseEnrollment();
      fetchMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al inscribir');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveEnrollment = async (member: Member, enrollmentId: string) => {
    if (!confirm('¿Quitar esta inscripción?')) return;
    try {
      await deleteEnrollment(enrollmentId);
      fetchMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al quitar inscripción');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Socios</h1>
        <Button onClick={handleOpenCreate}>Nuevo socio</Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Buscar por nombre, apellido o DNI"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="md:w-96"
          />
          <Select
            options={statusOptions}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="md:w-64"
          />
        </div>
      </div>

      {loading && members.length === 0 ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <>
          <MemberTable
            members={members}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onEnroll={handleEnroll}
            onRemoveEnrollment={handleRemoveEnrollment}
          />

          {meta && meta.totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <p className="text-sm text-gray-600">
                Mostrando {members.length} de {meta.total} socios
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                <span className="px-3 py-2 text-sm text-gray-700">
                  Página {meta.page} de {meta.totalPages}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingMember ? 'Editar socio' : 'Nuevo socio'}
      >
        <MemberForm
          member={editingMember}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isLoading={saving}
        />
      </Modal>

      <Modal
        isOpen={!!enrollingMember}
        onClose={handleCloseEnrollment}
        title={`Inscribir a ${enrollingMember?.firstName} ${enrollingMember?.lastName}`}
      >
        {enrollingMember && (
          <EnrollmentForm
            disciplines={disciplines}
            memberId={enrollingMember.id}
            onSubmit={handleSubmitEnrollment}
            onCancel={handleCloseEnrollment}
            isLoading={saving}
          />
        )}
      </Modal>
    </div>
  );
}

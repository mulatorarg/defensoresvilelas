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
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFeedback } from '@/components/ui/Feedback';
import { MemberTable } from '@/components/members/MemberTable';
import { MemberForm } from '@/components/members/MemberForm';
import { EnrollmentForm } from '@/components/members/EnrollmentForm';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
  { value: 'SUSPENDED', label: 'Suspendidos' },
];

export default function SociosPage() {
  const { toast, confirmAction } = useFeedback();
  const [members, setMembers] = useState<Member[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Member>['meta'] | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [enrollingMember, setEnrollingMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);

  // Búsqueda con debounce: no dispara una request por tecla
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

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
      toast(err instanceof Error ? err.message : 'Error al cargar socios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  useEffect(() => {
    getDisciplines()
      .then(setDisciplines)
      .catch(() => {});
  }, []);

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
        toast('Datos del socio actualizados');
      } else {
        await createMember(data);
        toast('Socio creado correctamente');
      }
      handleCloseModal();
      fetchMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member: Member) => {
    const ok = await confirmAction({
      title: `¿Dar de baja a ${member.firstName} ${member.lastName}?`,
      message:
        'El socio pasa a estado Inactivo. Su historial de pagos y asistencias se conserva, y podés reactivarlo cuando quieras.',
      confirmLabel: 'Dar de baja',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMember(member.id);
      toast(`${member.firstName} ${member.lastName} fue dado de baja`);
      fetchMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al dar de baja', 'error');
    }
  };

  const handleEnroll = (member: Member) => setEnrollingMember(member);
  const handleCloseEnrollment = () => setEnrollingMember(null);

  const handleSubmitEnrollment = async (data: {
    memberId: string;
    categoryId: string;
  }) => {
    setSaving(true);
    try {
      await createEnrollment(data);
      toast('Inscripción registrada');
      handleCloseEnrollment();
      fetchMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al inscribir', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveEnrollment = async (member: Member, enrollmentId: string) => {
    const ok = await confirmAction({
      title: '¿Quitar esta inscripción?',
      message: `${member.firstName} dejará de figurar en la categoría (el historial de asistencias se conserva).`,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEnrollment(enrollmentId);
      toast('Inscripción quitada');
      fetchMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al quitar inscripción', 'error');
    }
  };

  const hasFilters = search !== '' || status !== '';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Socios"
        description={
          meta ? `${meta.total} socio${meta.total === 1 ? '' : 's'} en el club` : undefined
        }
      >
        <Button onClick={handleOpenCreate} icon={<span className="text-base leading-none">+</span>}>
          Nuevo socio
        </Button>
      </PageHeader>

      {/* Filtros */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <Input
          placeholder="Buscar por nombre, apellido o DNI…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="md:max-w-md"
          leftIcon={
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
            </svg>
          }
        />
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="md:w-56"
        />
      </div>

      {loading && members.length === 0 ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-200/50" />
          ))}
        </div>
      ) : members.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon="🔍"
            title="No encontramos socios con ese criterio"
            hint="Probá con otro nombre o DNI, o quitá los filtros."
          >
            <Button
              variant="secondary"
              onClick={() => {
                setSearchInput('');
                setStatus('');
              }}
            >
              Limpiar filtros
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon="👥"
            title="Todavía no hay socios cargados"
            hint="Cargá el primer socio del club o esperá a que se registren desde la web."
          >
            <Button onClick={handleOpenCreate}>Cargar primer socio</Button>
          </EmptyState>
        )
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
            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Mostrando {members.length} de {meta.total} socios
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ← Anterior
                </Button>
                <span className="px-2 text-sm text-gray-500">
                  {meta.page} / {meta.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                >
                  Siguiente →
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
        subtitle={
          editingMember
            ? `Nº ${editingMember.memberNumber} · DNI ${editingMember.dni}`
            : 'Los datos se pueden completar o corregir después.'
        }
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
        subtitle="Elegí la disciplina y la categoría donde va a participar."
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

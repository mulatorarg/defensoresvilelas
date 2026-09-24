'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Users } from 'lucide-react';
import { Member, PaginatedResponse } from '@/lib/types';
import {
  getMembers,
  createMember,
  updateMember,
  deleteMember,
  resetMemberPin,
  createEnrollment,
  deleteEnrollment,
} from '@/lib/api';
import { errorText, qk, useDisciplines } from '@/lib/queries';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, Pagination, SkeletonRows } from '@/components/ui/States';
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
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [enrollingMember, setEnrollingMember] = useState<Member | null>(null);

  // La página vuelve a 1 cuando cambia la búsqueda (sin efecto: se compara al renderizar)
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setPage(1);
  }

  const filters = { search, status, page, limit: 20 };
  const membersQuery = useQuery<PaginatedResponse<Member>>({
    queryKey: qk.members(filters),
    queryFn: () => getMembers(filters),
    placeholderData: keepPreviousData, // la tabla no parpadea al paginar o filtrar
  });
  const { data: disciplines = [] } = useDisciplines();
  const members = membersQuery.data?.items ?? [];
  const meta = membersQuery.data?.meta;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: qk.dashboard });
  };
  const onError = (fallback: string) => (err: unknown) => toast(errorText(err, fallback), 'error');

  const saveMember = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editing && editing !== 'new' ? updateMember(editing.id, data) : createMember(data),
    onSuccess: () => {
      toast(editing === 'new' ? 'Socio creado correctamente' : 'Datos del socio actualizados');
      setEditing(null);
      refresh();
    },
    onError: onError('Error al guardar'),
  });

  const enroll = useMutation({
    mutationFn: createEnrollment,
    onSuccess: () => {
      toast('Inscripción registrada');
      setEnrollingMember(null);
      refresh();
    },
    onError: onError('Error al inscribir'),
  });

  // Acciones con confirmación
  const runAction = async (action: () => Promise<unknown>, done: string, fallback: string) => {
    try {
      await action();
      toast(done);
      refresh();
    } catch (err) {
      toast(errorText(err, fallback), 'error');
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
    if (ok) runAction(() => deleteMember(member.id), `${member.firstName} ${member.lastName} fue dado de baja`, 'Error al dar de baja');
  };

  const handleResetPin = async (member: Member) => {
    const ok = await confirmAction({
      title: `¿Blanquear el PIN de ${member.firstName} ${member.lastName}?`,
      message: 'Se cierran sus sesiones abiertas en el portal del socio. En el próximo ingreso va a tener que crear un PIN nuevo.',
      confirmLabel: 'Blanquear PIN',
    });
    if (ok) runAction(() => resetMemberPin(member.id), `PIN de ${member.firstName} blanqueado`, 'Error al blanquear el PIN');
  };

  const handleRemoveEnrollment = async (member: Member, enrollmentId: string) => {
    const ok = await confirmAction({
      title: '¿Quitar esta inscripción?',
      message: `${member.firstName} dejará de figurar en la categoría (el historial de asistencias se conserva).`,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (ok) runAction(() => deleteEnrollment(enrollmentId), 'Inscripción quitada', 'Error al quitar inscripción');
  };

  const hasFilters = search !== '' || status !== '';
  const editingMember = editing && editing !== 'new' ? editing : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Socios"
        description={meta ? `${meta.total} socio${meta.total === 1 ? '' : 's'}${hasFilters ? ' con este filtro' : ' en el club'}` : undefined}
      >
        <Button onClick={() => setEditing('new')} icon={<UserPlus className="h-4 w-4" aria-hidden />}>
          Nuevo socio
        </Button>
      </PageHeader>

      {/* Filtros */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <Input
          aria-label="Buscar socio"
          placeholder="Buscar por nombre, apellido, DNI o número"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="md:max-w-md"
          leftIcon={<Search className="h-4 w-4" />}
        />
        <Select
          aria-label="Estado"
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="md:w-56"
        />
      </div>

      {membersQuery.isPending ? (
        <SkeletonRows />
      ) : membersQuery.isError ? (
        <ErrorState error={membersQuery.error} onRetry={() => membersQuery.refetch()} />
      ) : members.length === 0 ? (
        hasFilters ? (
          <EmptyState title="No encontramos socios con ese criterio" hint="Probá con otro nombre o DNI, o quitá los filtros.">
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
            icon={<Users className="h-7 w-7 text-gray-400" aria-hidden />}
            title="Todavía no hay socios cargados"
            hint="Cargá el primer socio del club o esperá a que se registren desde la web."
          >
            <Button onClick={() => setEditing('new')}>Cargar primer socio</Button>
          </EmptyState>
        )
      ) : (
        <div className={membersQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <MemberTable
            members={members}
            onEdit={setEditing}
            onDelete={handleDelete}
            onResetPin={handleResetPin}
            onEnroll={setEnrollingMember}
            onRemoveEnrollment={handleRemoveEnrollment}
          />
          <Pagination meta={meta} onPage={setPage} label="socios" />
        </div>
      )}

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editingMember ? 'Editar socio' : 'Nuevo socio'}
        subtitle={
          editingMember
            ? `N.º ${editingMember.memberNumber} · DNI ${editingMember.dni}`
            : 'Los datos se pueden completar o corregir después.'
        }
      >
        <MemberForm
          key={editingMember?.id ?? 'new'}
          member={editingMember}
          onSubmit={(data) => saveMember.mutate(data)}
          onCancel={() => setEditing(null)}
          isLoading={saveMember.isPending}
        />
      </Modal>

      <Modal
        isOpen={!!enrollingMember}
        onClose={() => setEnrollingMember(null)}
        title={`Inscribir a ${enrollingMember?.firstName} ${enrollingMember?.lastName}`}
        subtitle="Elegí la disciplina y la categoría donde va a participar."
      >
        {enrollingMember && (
          <EnrollmentForm
            disciplines={disciplines}
            memberId={enrollingMember.id}
            onSubmit={(data) => enroll.mutate(data)}
            onCancel={() => setEnrollingMember(null)}
            isLoading={enroll.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

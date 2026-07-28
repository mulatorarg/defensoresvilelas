'use client';

import { Member } from '@/lib/types';

interface MemberTableProps {
  members: Member[];
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onEnroll: (member: Member) => void;
  onRemoveEnrollment: (member: Member, enrollmentId: string) => void;
}

const STATUS: Record<string, { label: string; classes: string; dot: string }> = {
  ACTIVE: { label: 'Activo', classes: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  INACTIVE: { label: 'Inactivo', classes: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  SUSPENDED: {
    label: 'Suspendido',
    classes: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
};

const TH = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400';

function initials(member: Member) {
  return (member.firstName[0] ?? '') + (member.lastName[0] ?? '');
}

export function MemberTable({
  members,
  onEdit,
  onDelete,
  onEnroll,
  onRemoveEnrollment,
}: MemberTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50/70">
          <tr>
            <th className={TH}>Socio</th>
            <th className={TH}>DNI</th>
            <th className={TH}>Contacto</th>
            <th className={TH}>Estado</th>
            <th className={TH}>Disciplinas</th>
            <th className={`${TH} text-right`}>Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {members.map((member) => {
            const status = STATUS[member.status] ?? STATUS.ACTIVE;
            return (
              <tr key={member.id} className="group transition-colors hover:bg-gray-50/60">
                {/* Socio: avatar + nombre + nº */}
                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-[12px] font-bold uppercase text-primary">
                      {initials(member)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {member.lastName}, {member.firstName}
                      </p>
                      <p className="font-mono text-[11px] text-gray-400">
                        Nº {member.memberNumber}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-3.5 font-mono text-sm text-gray-600">
                  {member.dni}
                </td>

                <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-600">
                  {member.phone && <div>{member.phone}</div>}
                  {member.email && (
                    <div className="text-xs text-gray-400">{member.email}</div>
                  )}
                  {!member.phone && !member.email && (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.classes}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </td>

                {/* Disciplinas como chips */}
                <td className="px-4 py-3.5">
                  {member.enrollments.length === 0 ? (
                    <button
                      onClick={() => onEnroll(member)}
                      className="text-xs text-gray-300 underline-offset-2 hover:text-primary hover:underline"
                    >
                      Sin inscripciones
                    </button>
                  ) : (
                    <div className="flex max-w-64 flex-wrap gap-1.5">
                      {member.enrollments.map((e) => (
                        <span
                          key={e.id}
                          className="group/chip inline-flex items-center gap-1 rounded-full bg-primary/8 py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-primary"
                          title={`${e.category.discipline.name} · ${e.category.name}`}
                        >
                          {e.category.discipline.name} · {e.category.name}
                          <button
                            onClick={() => onRemoveEnrollment(member, e.id)}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-primary/50 transition-colors hover:bg-red-100 hover:text-red-600"
                            title="Quitar inscripción"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </td>

                {/* Acciones */}
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => onEnroll(member)}
                      className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                      title="Inscribir en una disciplina"
                    >
                      + Inscribir
                    </button>
                    <button
                      onClick={() => onEdit(member)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      title="Editar datos"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(member)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Dar de baja"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

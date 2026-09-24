'use client';

import { KeyRound, Pencil, Plus, UserMinus, X } from 'lucide-react';
import { Member } from '@/lib/types';

interface MemberTableProps {
  members: Member[];
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onResetPin: (member: Member) => void;
  onEnroll: (member: Member) => void;
  onRemoveEnrollment: (member: Member, enrollmentId: string) => void;
}

const STATUS: Record<string, { label: string; classes: string; dot: string }> = {
  ACTIVE: { label: 'Activo', classes: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  INACTIVE: { label: 'Inactivo', classes: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  SUSPENDED: { label: 'Suspendido', classes: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
};

const TH = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400';

function initials(member: Member) {
  return (member.firstName[0] ?? '') + (member.lastName[0] ?? '');
}

function Avatar({ member }: { member: Member }) {
  return member.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={member.photoUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-[12px] font-bold uppercase text-primary"
      aria-hidden
    >
      {initials(member)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.ACTIVE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700';

type RowProps = Omit<MemberTableProps, 'members'> & { member: Member };

function Actions({ member, onEdit, onDelete, onResetPin, onEnroll }: RowProps) {
  const name = `${member.firstName} ${member.lastName}`;
  return (
    <div className="flex justify-end gap-1">
      <button
        onClick={() => onEnroll(member)}
        className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
        aria-label={`Inscribir a ${name} en una disciplina`}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Inscribir
      </button>
      <button onClick={() => onEdit(member)} className={iconButton} title="Editar datos" aria-label={`Editar a ${name}`}>
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      {member.hasPin && (
        <button
          onClick={() => onResetPin(member)}
          className={iconButton}
          title="Blanquear PIN del portal"
          aria-label={`Blanquear el PIN de ${name}`}
        >
          <KeyRound className="h-4 w-4" aria-hidden />
        </button>
      )}
      {member.status !== 'INACTIVE' && (
        <button
          onClick={() => onDelete(member)}
          className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
          title="Dar de baja"
          aria-label={`Dar de baja a ${name}`}
        >
          <UserMinus className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

function Enrollments({ member, onEnroll, onRemoveEnrollment }: RowProps) {
  if (member.enrollments.length === 0) {
    return (
      <button
        onClick={() => onEnroll(member)}
        className="text-xs text-gray-400 underline-offset-2 hover:text-primary hover:underline"
      >
        Sin inscripciones
      </button>
    );
  }
  return (
    <div className="flex max-w-72 flex-wrap gap-1.5">
      {member.enrollments.map((e) => (
        <span
          key={e.id}
          className="inline-flex items-center gap-1 rounded-full bg-primary/8 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-primary"
        >
          {e.category.discipline.name} · {e.category.name}
          <button
            onClick={() => onRemoveEnrollment(member, e.id)}
            className="flex h-4 w-4 items-center justify-center rounded-full text-primary/60 hover:bg-primary/15 hover:text-primary"
            aria-label={`Quitar inscripción a ${e.category.discipline.name} ${e.category.name}`}
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}

export function MemberTable({ members, ...handlers }: MemberTableProps) {
  return (
    <>
      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:block">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/70">
            <tr>
              <th scope="col" className={TH}>Socio</th>
              <th scope="col" className={TH}>DNI</th>
              <th scope="col" className={TH}>Contacto</th>
              <th scope="col" className={TH}>Estado</th>
              <th scope="col" className={TH}>Disciplinas</th>
              <th scope="col" className={`${TH} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {members.map((member) => (
              <tr key={member.id} className="transition-colors hover:bg-gray-50/60">
                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar member={member} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {member.lastName}, {member.firstName}
                      </p>
                      <p className="font-mono text-[11px] text-gray-400">N.º {member.memberNumber}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 font-mono text-sm text-gray-600">{member.dni}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-600">
                  {member.phone && <div>{member.phone}</div>}
                  {member.email && <div className="text-xs text-gray-400">{member.email}</div>}
                  {!member.phone && !member.email && <span className="text-xs text-gray-300">-</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <StatusBadge status={member.status} />
                </td>
                <td className="px-4 py-3.5">
                  <Enrollments member={member} {...handlers} />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right">
                  <Actions member={member} {...handlers} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: tarjetas */}
      <ul className="space-y-2 md:hidden">
        {members.map((member) => (
          <li key={member.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-3">
              <Avatar member={member} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">
                  {member.lastName}, {member.firstName}
                </p>
                <p className="text-xs text-gray-500">
                  DNI {member.dni} · N.º {member.memberNumber}
                </p>
                {member.phone && <p className="text-xs text-gray-500">{member.phone}</p>}
              </div>
              <StatusBadge status={member.status} />
            </div>
            <div className="mt-3">
              <Enrollments member={member} {...handlers} />
            </div>
            <div className="mt-3 border-t border-gray-50 pt-2">
              <Actions member={member} {...handlers} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

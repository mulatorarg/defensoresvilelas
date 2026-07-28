'use client';

import { Member } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface MemberTableProps {
  members: Member[];
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onEnroll: (member: Member) => void;
  onRemoveEnrollment: (member: Member, enrollmentId: string) => void;
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  SUSPENDED: 'Suspendido',
};

const statusClasses: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
};

export function MemberTable({
  members,
  onEdit,
  onDelete,
  onEnroll,
  onRemoveEnrollment,
}: MemberTableProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No se encontraron socios.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nº
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Socio
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              DNI
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contacto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Disciplinas
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {members.map((member) => (
            <tr key={member.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {member.memberNumber}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {member.lastName}, {member.firstName}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {member.dni}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {member.phone && <div>{member.phone}</div>}
                {member.email && <div className="text-xs">{member.email}</div>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${statusClasses[member.status]}`}
                >
                  {statusLabels[member.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {member.enrollments.length === 0 ? (
                  <span className="text-gray-400">Sin inscripciones</span>
                ) : (
                  <ul className="space-y-1">
                    {member.enrollments.map((e) => (
                      <li key={e.id} className="flex items-center gap-2">
                        <span>
                          {e.category.discipline.name} - {e.category.name}
                        </span>
                        <button
                          onClick={() => onRemoveEnrollment(member, e.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                          title="Quitar inscripción"
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    className="text-sm py-1 px-2"
                    onClick={() => onEnroll(member)}
                  >
                    Inscribir
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-sm py-1 px-2"
                    onClick={() => onEdit(member)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-sm py-1 px-2 text-red-600 hover:text-red-700"
                    onClick={() => onDelete(member)}
                  >
                    Dar de baja
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

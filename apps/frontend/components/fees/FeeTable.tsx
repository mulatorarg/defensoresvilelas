'use client';

import { Fee } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface FeeTableProps {
  fees: Fee[];
  onRegisterPayment: (fee: Fee) => void;
  onPayWithMP: (fee: Fee) => void;
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  PARTIALLY_PAID: 'Parcial',
  CANCELLED: 'Cancelada',
};

const statusClasses: Record<string, string> = {
  PENDING: 'bg-red-100 text-red-800',
  PAID: 'bg-green-100 text-green-800',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

export function FeeTable({ fees, onRegisterPayment, onPayWithMP }: FeeTableProps) {
  if (fees.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No se encontraron cuotas.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Socio
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Concepto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Período
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Monto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Pagado
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Estado
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {fees.map((fee) => (
            <tr key={fee.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                {fee.member.lastName}, {fee.member.firstName}
                <div className="text-xs text-gray-500">DNI {fee.member.dni}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                {fee.feeType.name}
                {fee.category && (
                  <div className="text-xs text-gray-500">
                    {fee.category.discipline.name} - {fee.category.name}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                {fee.period}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                ${fee.amount}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                ${fee.paidAmount}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${statusClasses[fee.status]}`}
                >
                  {statusLabels[fee.status]}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                <div className="flex justify-end gap-2">
                  {fee.status !== 'PAID' && (
                    <>
                      <Button
                        variant="ghost"
                        className="text-sm py-1 px-2"
                        onClick={() => onRegisterPayment(fee)}
                      >
                        Pagar
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-sm py-1 px-2 text-primary"
                        onClick={() => onPayWithMP(fee)}
                      >
                        Pagar con MP
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

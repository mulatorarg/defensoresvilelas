'use client';

import Link from 'next/link';
import { Ban, Link2, Receipt, Wallet } from 'lucide-react';
import { Fee } from '@/lib/types';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

interface FeeTableProps {
  fees: Fee[];
  onRegisterPayment: (fee: Fee) => void;
  onPayWithMP: (fee: Fee) => void;
  onCancel: (fee: Fee) => void;
}

const STATUS: Record<string, { label: string; classes: string }> = {
  PENDING: { label: 'Pendiente', classes: 'bg-red-100 text-red-800' },
  PAID: { label: 'Pagada', classes: 'bg-green-100 text-green-800' },
  PARTIALLY_PAID: { label: 'Parcial', classes: 'bg-yellow-100 text-yellow-800' },
  CANCELLED: { label: 'Anulada', classes: 'bg-gray-100 text-gray-600' },
};

const TH = 'px-4 py-3 text-left text-xs font-medium uppercase text-gray-500';

function StatusBadge({ fee }: { fee: Fee }) {
  const s = STATUS[fee.status] ?? STATUS.PENDING;
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${s.classes}`}
      title={fee.status === 'CANCELLED' && fee.cancelReason ? `Motivo: ${fee.cancelReason}` : undefined}
    >
      {s.label}
    </span>
  );
}

function Receipts({ fee }: { fee: Fee }) {
  if (fee.payments.length === 0) return null;
  return (
    <div className="mt-0.5 flex flex-col gap-0.5">
      {fee.payments.map((p) => (
        <Link key={p.id} href={`/admin/recibo/?id=${p.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <Receipt className="h-3 w-3" aria-hidden />
          Recibo {formatDate(p.paidAt, { day: 'numeric', month: 'numeric' })} · {formatMoney(p.amount, { decimals: 0 })}
        </Link>
      ))}
    </div>
  );
}

function Actions({ fee, onRegisterPayment, onPayWithMP, onCancel }: Omit<FeeTableProps, 'fees'> & { fee: Fee }) {
  const open = fee.status === 'PENDING' || fee.status === 'PARTIALLY_PAID';
  if (!open) return null;
  const who = `${fee.member.firstName} ${fee.member.lastName} ${fee.period}`;
  const btn = 'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors';
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button onClick={() => onRegisterPayment(fee)} className={`${btn} text-gray-700 hover:bg-gray-100`} aria-label={`Registrar pago de ${who}`}>
        <Wallet className="h-4 w-4" aria-hidden /> Pagar
      </button>
      <button onClick={() => onPayWithMP(fee)} className={`${btn} text-primary hover:bg-primary/10`} aria-label={`Link de Mercado Pago para ${who}`}>
        <Link2 className="h-4 w-4" aria-hidden /> Link MP
      </button>
      {fee.payments.length === 0 && (
        <button onClick={() => onCancel(fee)} className={`${btn} text-red-600 hover:bg-red-50`} aria-label={`Anular la cuota de ${who}`}>
          <Ban className="h-4 w-4" aria-hidden /> Anular
        </button>
      )}
    </div>
  );
}

export function FeeTable({ fees, ...handlers }: FeeTableProps) {
  if (fees.length === 0) {
    return <div className="py-12 text-center text-gray-500">No se encontraron cuotas.</div>;
  }

  return (
    <>
      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className={TH}>Socio</th>
              <th scope="col" className={TH}>Concepto</th>
              <th scope="col" className={TH}>Período</th>
              <th scope="col" className={TH}>Monto</th>
              <th scope="col" className={TH}>Pagado</th>
              <th scope="col" className={TH}>Estado</th>
              <th scope="col" className={`${TH} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {fees.map((fee) => {
              const cancelled = fee.status === 'CANCELLED';
              return (
                <tr key={fee.id} className={`hover:bg-gray-50 ${cancelled ? 'opacity-60' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {fee.member.lastName}, {fee.member.firstName}
                    <div className="text-xs text-gray-500">DNI {fee.member.dni}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {fee.feeType?.name ?? 'Cuota'}
                    {fee.category && (
                      <div className="text-xs text-gray-500">
                        {fee.category.discipline.name} - {fee.category.name}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{fee.period}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-sm text-gray-700 ${cancelled ? 'line-through' : ''}`}>
                    {formatMoney(fee.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatMoney(fee.paidAmount)}
                    <Receipts fee={fee} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge fee={fee} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <Actions fee={fee} {...handlers} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular: tarjetas */}
      <ul className="space-y-2 md:hidden">
        {fees.map((fee) => (
          <li key={fee.id} className={`rounded-xl border border-gray-200 bg-white p-4 ${fee.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">
                  {fee.member.lastName}, {fee.member.firstName}
                </p>
                <p className="text-xs text-gray-500">
                  {fee.feeType?.name ?? 'Cuota'} {fee.period}
                  {fee.category && ` · ${fee.category.discipline.name} ${fee.category.name}`}
                </p>
              </div>
              <StatusBadge fee={fee} />
            </div>
            <p className="mt-2 text-sm text-gray-700">
              {formatMoney(fee.paidAmount)} de {formatMoney(fee.amount)}
            </p>
            <Receipts fee={fee} />
            <div className="mt-2 border-t border-gray-100 pt-2">
              <Actions fee={fee} {...handlers} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

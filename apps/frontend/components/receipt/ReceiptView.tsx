'use client';

import { ReactNode } from 'react';
import { MessageCircle, Printer } from 'lucide-react';
import type { PaymentReceipt } from '@/lib/types';
import { formatDateTime } from '@/lib/dates';
import { formatMoney, toNumber } from '@/lib/money';
import { Button } from '@/components/ui/Button';

const METHODS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  MERCADO_PAGO: 'Mercado Pago',
  DEBIT: 'Tarjeta de débito',
  CREDIT: 'Tarjeta de crédito',
  OTHER: 'Otro',
};

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-6 py-1.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

/** Recibo imprimible (admin y portal del socio). Al imprimir se ocultan los botones. */
export function ReceiptView({ receipt, back }: { receipt: PaymentReceipt; back?: ReactNode }) {
  const { club, member, fee } = receipt;
  const whatsappText = encodeURIComponent(
    `Recibo ${receipt.receiptNumber} - ${club.name}\n` +
      `${member ? `${member.lastName}, ${member.firstName}` : ''}\n` +
      `${fee ? `${fee.concept} ${fee.period}` : 'Pago'}: ${formatMoney(receipt.amount)}\n` +
      `Fecha: ${formatDateTime(receipt.paidAt)}`,
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 print:hidden">
        {back ?? <span />}
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Enviar por WhatsApp
          </a>
          <Button onClick={() => window.print()} icon={<Printer className="h-4 w-4" aria-hidden />}>
            Imprimir o guardar PDF
          </Button>
        </div>
      </div>

      <article
        aria-label={`Recibo ${receipt.receiptNumber}`}
        className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 sm:p-8 print:rounded-none print:border-0 print:p-0"
      >
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4">
            {club.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.logoUrl} alt="" className="h-16 w-16 object-contain" />
            )}
            <div>
              <p className="font-display text-lg font-bold">{club.legalName || club.name}</p>
              {club.document && <p className="text-xs text-gray-500">CUIT {club.document}</p>}
              {club.address && <p className="text-xs text-gray-500">{club.address}</p>}
              {(club.phone || club.email) && (
                <p className="text-xs text-gray-500">{[club.phone, club.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-gray-400">Recibo</p>
            <p className="font-display text-xl font-bold">N.º {receipt.receiptNumber}</p>
            <p className="text-xs text-gray-500">{formatDateTime(receipt.paidAt)}</p>
          </div>
        </header>

        <dl className="border-b border-gray-200 py-4">
          <Row label="Recibimos de" value={member ? `${member.lastName}, ${member.firstName}` : null} />
          <Row label="DNI" value={member?.dni} />
          <Row label="N.º de socio" value={receipt.memberNumber} />
        </dl>

        <dl className="border-b border-gray-200 py-4">
          <Row label="Concepto" value={fee ? `${fee.concept} - período ${fee.period}` : 'Pago'} />
          <Row label="Categoría" value={fee?.category} />
          <Row label="Medio de pago" value={METHODS[receipt.method] ?? receipt.method} />
          <Row label="Referencia" value={receipt.reference} />
        </dl>

        <div className="py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-gray-700">Importe recibido</span>
            <span className="font-display text-3xl font-bold">{formatMoney(receipt.amount)}</span>
          </div>
          {fee && (
            <dl className="mt-3 text-sm">
              <Row label="Total de la cuota" value={formatMoney(fee.amount)} />
              <Row label="Pagado a la fecha" value={formatMoney(fee.paidAmount)} />
              <Row label="Saldo pendiente" value={toNumber(fee.balance) > 0 ? formatMoney(fee.balance) : 'Sin saldo: cuota paga'} />
            </dl>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          Comprobante de pago emitido por {club.name}. No válido como factura.
        </p>
      </article>
    </>
  );
}

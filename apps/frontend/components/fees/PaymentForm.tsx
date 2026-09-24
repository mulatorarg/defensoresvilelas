'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Fee } from '@/lib/types';
import { money, optionalText, requiredDate } from '@/lib/validation';
import { formatMoney, toNumber } from '@/lib/money';
import { todayLocal } from '@/lib/dates';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormActions } from '@/components/ui/FormActions';

const methodOptions = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'DEBIT', label: 'Débito' },
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'OTHER', label: 'Otro' },
];

interface PaymentFormProps {
  fee: Fee;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PaymentForm({ fee, onSubmit, onCancel, isLoading }: PaymentFormProps) {
  const remaining = toNumber(fee.amount) - toNumber(fee.paidAmount);

  // El mismo límite que valida la API: no se cobra más que el saldo
  const schema = z.object({
    amount: money('Monto').refine((v) => Number(v) <= remaining + 1e-9, {
      message: `No puede superar el saldo (${formatMoney(remaining)})`,
    }),
    method: z.enum(['CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'OTHER']),
    reference: optionalText(),
    paidAt: requiredDate('Fecha de pago').refine((v) => v <= todayLocal(), 'No puede ser una fecha futura'),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { amount: remaining.toFixed(2), method: 'CASH', reference: '', paidAt: todayLocal() },
  });

  const submit = handleSubmit((v) =>
    onSubmit({
      feeId: fee.id,
      amount: v.amount,
      method: v.method,
      reference: v.reference || undefined,
      paidAt: v.paidAt,
    }),
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <strong className="text-gray-900">
          {fee.member.lastName}, {fee.member.firstName}
        </strong>
        <br />
        {fee.feeType?.name ?? 'Cuota'} {fee.period} · Total {formatMoney(fee.amount)} · Saldo{' '}
        <strong className="text-gray-900">{formatMoney(remaining)}</strong>
      </p>
      <Input label="Monto a pagar" inputMode="decimal" {...register('amount')} error={errors.amount?.message} />
      <Select label="Medio de pago" options={methodOptions} {...register('method')} />
      <Input
        label="Referencia"
        hint="N.º de transferencia o comprobante (opcional)"
        {...register('reference')}
        error={errors.reference?.message}
      />
      <Input
        label="Fecha de pago"
        type="date"
        max={todayLocal()}
        {...register('paidAt')}
        error={errors.paidAt?.message}
      />
      <FormActions
        onCancel={onCancel}
        isLoading={isLoading}
        submitLabel="Registrar pago"
        loadingLabel="Registrando..."
      />
    </form>
  );
}

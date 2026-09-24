'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, ChevronDown, Clock, Receipt, RefreshCw, X } from 'lucide-react';
import {
  ApiError,
  changeMemberPin,
  getMemberCard,
  getMemberFees,
  getMemberPayments,
  getMemberProfile,
  memberLogout,
  payFeeWithMercadoPago,
} from '@/lib/api';
import { errorText } from '@/lib/queries';
import { formatDate } from '@/lib/dates';
import { formatMoney, toNumber } from '@/lib/money';
import { DarkField } from './DarkField';

interface Fee {
  id: string;
  period: string;
  amount: string;
  paidAmount: string;
  status: string;
  feeType?: { name: string } | null;
  category?: { name: string; discipline?: { name: string } } | null;
}

interface Profile {
  memberNumber?: string | null;
  photoUrl?: string | null;
  firstName: string;
  lastName: string;
  dni: string;
  enrollments: { id: string; category: { name: string; schedule?: string | null; discipline: { name: string } } }[];
}

interface MemberPayment {
  id: string;
  amount: string;
  paidAt: string;
  period?: string | null;
  concept: string;
  receiptNumber: string;
}

interface Club {
  name: string;
  logoUrl?: string | null;
  onlinePayments?: boolean;
}

const money = (v: string | number) => formatMoney(v, { decimals: 0 });
const gradientBg = { backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' };
const card = 'rounded-3xl border border-white/8 bg-white/3 p-6';

// Resultado del pago al volver de Mercado Pago (?status=success|pending|failure)
const PAYMENT_STATUS: Record<string, { tone: 'ok' | 'warn' | 'error'; text: string }> = {
  success: { tone: 'ok', text: '¡Pago aprobado! En unos minutos la cuota figura como paga (la confirmación de Mercado Pago puede demorar).' },
  pending: { tone: 'warn', text: 'Tu pago quedó pendiente de acreditación. Cuando Mercado Pago lo confirme, la cuota se actualiza sola.' },
  failure: { tone: 'error', text: 'El pago no se completó. Podés intentarlo de nuevo o pagar en secretaría.' },
};

const pinSchema = z
  .object({
    current: z.string().min(1, 'Ingresá tu PIN actual'),
    next: z.string().regex(/^\d{4,6}$/, 'De 4 a 6 números'),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Los PIN no coinciden' });
type PinValues = z.infer<typeof pinSchema>;

function ChangePin() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<PinValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: { current: '', next: '', confirm: '' },
  });
  const submit = handleSubmit(async (v) => {
    try {
      await changeMemberPin(v.current, v.next);
      reset();
      setDone(true);
    } catch (err) {
      setError('current', { message: errorText(err, 'No pudimos cambiar el PIN.') });
    }
  });

  return (
    <section className={card} aria-labelledby="cambiar-pin">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
        <h2 id="cambiar-pin" className="font-display text-lg font-bold">
          Cambiar PIN
        </h2>
        <ChevronDown className={`h-5 w-5 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          {done && (
            <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-[13px] text-white/80">
              PIN actualizado. Se cerraron tus otras sesiones.
            </p>
          )}
          <DarkField label="PIN actual" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} {...register('current')} error={errors.current?.message} />
          <DarkField label="PIN nuevo (4 a 6 números)" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} {...register('next')} error={errors.next?.message} />
          <DarkField label="Repetí el PIN nuevo" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} {...register('confirm')} error={errors.confirm?.message} />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full border border-white/15 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white disabled:opacity-60"
          >
            Guardar PIN
          </button>
        </form>
      )}
    </section>
  );
}

export function MemberPanel({ club, paymentStatus, onDismissStatus }: { club: Club; paymentStatus: string | null; onDismissStatus: () => void }) {
  const profile = useQuery<Profile>({ queryKey: ['member', 'profile'], queryFn: getMemberProfile });
  const fees = useQuery<Fee[]>({ queryKey: ['member', 'fees'], queryFn: getMemberFees });
  const payments = useQuery<MemberPayment[]>({ queryKey: ['member', 'payments'], queryFn: getMemberPayments });
  // El QR vence a los 5 minutos: se renueva solo cada 4 para que el carnet en la puerta siempre sea válido
  const qr = useQuery({
    queryKey: ['member', 'card'],
    queryFn: async () => QRCode.toDataURL((await getMemberCard()).qrPayload, { width: 260, margin: 1 }),
    refetchInterval: 4 * 60_000,
    refetchIntervalInBackground: false,
  });

  // Sesión vencida o revocada: vuelve al login (memberFetch ya limpió el token)
  const expired = [profile, fees, payments, qr].some((q) => q.error instanceof ApiError && q.error.status === 401);
  useEffect(() => {
    if (expired) memberLogout();
  }, [expired]);

  const pay = useMutation({
    mutationFn: payFeeWithMercadoPago,
    onSuccess: ({ initPoint }) => {
      if (initPoint) window.location.assign(initPoint);
    },
  });

  const status = paymentStatus ? PAYMENT_STATUS[paymentStatus] : null;
  const p = profile.data;

  return (
    <div className="grid gap-6 md:grid-cols-5">
      {/* Carnet */}
      <div className="md:col-span-2">
        <div
          className="overflow-hidden rounded-3xl p-px"
          style={{ backgroundImage: 'linear-gradient(140deg, var(--color-primary), rgba(255,255,255,0.12), var(--color-secondary))' }}
        >
          <div className="rounded-[calc(var(--radius-3xl)-1px)] bg-[#0a1410] p-6 text-center">
            <div className="mb-4 flex items-center justify-center gap-2.5">
              {club.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={club.logoUrl} alt="" className="h-8 w-8 object-contain" />
              )}
              <p className="font-display text-[13px] font-bold">{club.name}</p>
            </div>
            {qr.data ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr.data} alt="Código QR del carnet" className="mx-auto rounded-2xl bg-white p-2" width={220} height={220} />
            ) : (
              <div className="mx-auto h-[220px] w-[220px] animate-pulse rounded-2xl bg-white/10" aria-label="Cargando carnet" />
            )}
            <div className="mt-4 flex items-center justify-center gap-3">
              {p?.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="" className="h-12 w-12 rounded-full border border-white/20 object-cover" />
              )}
              <p className="font-display text-lg font-bold">
                {p?.firstName} {p?.lastName}
              </p>
            </div>
            <p className="text-[13px] text-white/50">DNI {p?.dni}</p>
            <p className="mt-1 font-display text-2xl font-black tracking-[0.2em]" style={{ color: 'var(--color-primary)' }}>
              {p?.memberNumber}
            </p>
            <button
              onClick={() => qr.refetch()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-2 text-[12px] font-semibold text-white/60 transition-colors hover:border-white/40 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${qr.isFetching ? 'animate-spin' : ''}`} aria-hidden />
              Actualizar QR
            </button>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-white/30">Se renueva automáticamente</p>
            {qr.isError && !expired && (
              <p className="mt-2 text-[12px] text-red-300">Sin conexión: el QR se actualiza al volver la señal.</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 md:col-span-3">
        {status && (
          <div
            role="status"
            className={`flex items-start justify-between gap-4 rounded-2xl border px-5 py-4 text-[13px] ${
              status.tone === 'ok'
                ? 'border-primary/30 bg-primary/10 text-white/85'
                : status.tone === 'warn'
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            <p>{status.text}</p>
            <button onClick={onDismissStatus} className="text-white/50 hover:text-white" aria-label="Cerrar aviso">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {/* Cuotas pendientes */}
        <section className={card} aria-labelledby="mis-cuotas">
          <h2 id="mis-cuotas" className="font-display text-lg font-bold">
            Mis cuotas pendientes
          </h2>
          {fees.isPending ? (
            <div className="mt-4 h-16 animate-pulse rounded-2xl bg-white/5" />
          ) : (fees.data ?? []).length === 0 ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-[13px] text-white/75">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
              Estás al día. ¡Gracias por bancar al club!
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(fees.data ?? []).map((fee) => {
                const pending = toNumber(fee.amount) - toNumber(fee.paidAmount);
                return (
                  <li key={fee.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/7 bg-black/25 px-5 py-3.5">
                    <div>
                      <p className="text-sm font-semibold">
                        {fee.feeType?.name ?? 'Cuota'} · {fee.period}
                      </p>
                      <p className="text-[12px] text-white/50">
                        {fee.category ? `${fee.category.discipline?.name ?? ''} ${fee.category.name}` : 'Cuota social'}
                        {fee.status === 'PARTIALLY_PAID' && ` · pagado ${money(fee.paidAmount)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-display text-lg font-bold">{money(pending)}</p>
                        <p className="text-[11px] uppercase tracking-wide text-amber-300/90">
                          {fee.status === 'PARTIALLY_PAID' ? 'Parcial' : 'Pendiente'}
                        </p>
                      </div>
                      {club.onlinePayments && (
                        <button
                          onClick={() => pay.mutate(fee.id)}
                          disabled={pay.isPending}
                          className="rounded-full px-4 py-2 text-[12px] font-bold text-white transition-transform hover:scale-[1.04] disabled:opacity-60"
                          style={gradientBg}
                          aria-label={`Pagar ${fee.feeType?.name ?? 'cuota'} ${fee.period} por ${money(pending)}`}
                        >
                          {pay.isPending && pay.variables === fee.id ? 'Abriendo…' : 'Pagar'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {pay.isError && (
            <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
              {errorText(pay.error, 'No pudimos iniciar el pago')}
            </p>
          )}
          <p className="mt-4 text-[11px] text-white/40">
            {club.onlinePayments
              ? 'El pago se hace en Mercado Pago (tarjeta, dinero en cuenta o efectivo). También podés pagar en secretaría.'
              : 'Por ahora las cuotas se pagan en secretaría.'}
          </p>
        </section>

        {/* Pagos y recibos */}
        <section className={card} aria-labelledby="mis-pagos">
          <h2 id="mis-pagos" className="font-display text-lg font-bold">
            Mis pagos
          </h2>
          {payments.isPending ? (
            <div className="mt-4 h-12 animate-pulse rounded-2xl bg-white/5" />
          ) : (payments.data ?? []).length === 0 ? (
            <p className="mt-3 text-[13px] text-white/50">Todavía no hay pagos registrados.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/7">
              {(payments.data ?? []).map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">
                      {payment.concept} {payment.period}
                    </p>
                    <p className="text-[12px] text-white/50">
                      {formatDate(payment.paidAt, { day: 'numeric', month: 'long', year: 'numeric' })} · {money(payment.amount)}
                    </p>
                  </div>
                  <Link
                    href={`/socio/recibo/?id=${payment.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/70 hover:border-white/40 hover:text-white"
                    aria-label={`Ver recibo ${payment.receiptNumber}`}
                  >
                    <Receipt className="h-3.5 w-3.5" aria-hidden />
                    Recibo
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Actividades */}
        <section className={card} aria-labelledby="mis-actividades">
          <h2 id="mis-actividades" className="font-display text-lg font-bold">
            Mis actividades
          </h2>
          {p?.enrollments?.length ? (
            <ul className="mt-4 space-y-3">
              {p.enrollments.map((e) => (
                <li key={e.id} className="rounded-2xl border border-white/7 bg-black/25 px-5 py-3.5">
                  <p className="text-sm font-semibold">
                    {e.category.discipline.name} · {e.category.name}
                  </p>
                  {e.category.schedule && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/50">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {e.category.schedule}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-white/50">No estás inscripto en ninguna disciplina. Consultá en secretaría para sumarte.</p>
          )}
        </section>

        <ChangePin />
      </div>
    </div>
  );
}

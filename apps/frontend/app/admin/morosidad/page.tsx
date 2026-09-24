'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Download, MessageCircle, Search } from 'lucide-react';
import { downloadReportCsv, getDelinquencyReport } from '@/lib/api';
import { errorText, qk, usePublicClub } from '@/lib/queries';
import type { DelinquentMember } from '@/lib/types';
import { formatDateOnly } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFeedback } from '@/components/ui/Feedback';
import { RoleGuard } from '@/components/common/RoleGuard';
import { ErrorState, SkeletonRows } from '@/components/ui/States';

/**
 * Número para wa.me en formato internacional argentino (549 + área + número).
 * Acepta lo que se suele cargar: con 0 adelante, con +54, con espacios o guiones.
 */
function whatsappNumber(phone?: string | null): string | null {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('54')) digits = digits.slice(2);
  if (digits.startsWith('9')) digits = digits.slice(1);
  if (digits.startsWith('0')) digits = digits.slice(1);
  // Formato local con "15" después del código de área (11 15..., 362 15..., 3783 15...):
  // área + número son 10 dígitos, así que con el 15 quedan 12
  if (digits.length === 12) {
    const at = [2, 3, 4].find((i) => digits.slice(i, i + 2) === '15');
    if (at !== undefined) digits = digits.slice(0, at) + digits.slice(at + 2);
  }
  return digits.length >= 8 ? `549${digits}` : null;
}

function MorosidadList() {
  const { toast } = useFeedback();
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const report = useQuery<{ items: DelinquentMember[]; summary: { members: number; fees: number; total: string } }>({
    queryKey: qk.delinquency,
    queryFn: getDelinquencyReport,
  });
  const { data: club } = usePublicClub();
  const items = useMemo(() => report.data?.items ?? [], [report.data]);
  const summary = report.data?.summary;
  const clubName = club?.name ?? 'el club';

  const visible = useMemo(() => {
    const text = filter.trim().toLowerCase();
    if (!text) return items;
    return items.filter(({ member }) =>
      `${member.firstName} ${member.lastName} ${member.dni} ${member.memberNumber ?? ''}`
        .toLowerCase()
        .includes(text),
    );
  }, [items, filter]);

  const whatsappLink = (item: DelinquentMember) => {
    const number = whatsappNumber(item.member.phone);
    if (!number) return null;
    const periods = item.fees.map((f) => f.period).join(', ');
    const text =
      `Hola ${item.member.firstName}, te escribimos de ${clubName}. ` +
      `Tenés ${item.feesCount === 1 ? 'una cuota vencida' : `${item.feesCount} cuotas vencidas`} ` +
      `(${periods}) por un total de ${formatMoney(item.total, { decimals: 0 })}. ` +
      'Podés abonarla en secretaría. Si ya la pagaste, avisanos así lo registramos. ¡Gracias!';
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  };

  const handleExport = async () => {
    try {
      await downloadReportCsv('delinquency');
    } catch (err) {
      toast(errorText(err, 'No se pudo exportar'), 'error');
    }
  };

  if (report.isPending) return <SkeletonRows />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">Socios con deuda</p>
          <p className="mt-1 font-display text-3xl font-bold text-gray-900">{summary?.members ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-500">Cuotas vencidas</p>
          <p className="mt-1 font-display text-3xl font-bold text-gray-900">{summary?.fees ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="text-sm text-red-700">Total adeudado</p>
          <p className="mt-1 font-display text-3xl font-bold text-red-800">
            {formatMoney(summary?.total, { decimals: 0 })}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Buscar por nombre, DNI o número"
            aria-label="Buscar socio"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={items.length === 0}
          icon={<Download className="h-4 w-4" aria-hidden />}
        >
          Exportar CSV
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? 'No hay cuotas vencidas' : 'Sin resultados'}
          hint={
            items.length === 0
              ? 'Todos los socios activos están al día.'
              : 'Probá con otro nombre o DNI.'
          }
        />
      ) : (
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {visible.map((item) => {
            const link = whatsappLink(item);
            const open = expanded === item.member.id;
            return (
              <div key={item.member.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => setExpanded(open ? null : item.member.id)}
                    aria-expanded={open}
                  >
                    <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                      {item.member.lastName}, {item.member.firstName}
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </p>
                    <p className="text-sm text-gray-500">
                      DNI {item.member.dni}
                      {item.member.memberNumber && ` · Socio ${item.member.memberNumber}`}
                      {' · '}
                      {item.feesCount === 1 ? '1 cuota' : `${item.feesCount} cuotas`} desde {item.oldestPeriod}
                    </p>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg font-bold text-red-700">
                      {formatMoney(item.total, { decimals: 0 })}
                    </span>
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#25d366] px-3 py-1.5 text-[13px] font-semibold text-white hover:brightness-105"
                        aria-label={`Escribirle por WhatsApp a ${item.member.firstName} ${item.member.lastName}`}
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Sin teléfono</span>
                    )}
                  </div>
                </div>
                {open && (
                  <ul className="mt-3 space-y-1 rounded-xl bg-gray-50 p-3 text-sm">
                    {item.fees.map((fee) => (
                      <li key={fee.id} className="flex justify-between gap-3">
                        <span className="text-gray-700">
                          {fee.period} · {fee.concept}
                          {fee.category && ` (${fee.category})`}
                          {fee.dueDate && (
                            <span className="text-gray-400"> · venció {formatDateOnly(fee.dueDate)}</span>
                          )}
                        </span>
                        <span className="font-semibold text-gray-900">{formatMoney(fee.owed)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-gray-400">
        Vencida: fecha de vencimiento pasada o, si la cuota no tiene, período anterior al mes
        actual. Las cuotas anuladas no cuentan.
      </p>
    </>
  );
}

export default function MorosidadPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Morosidad"
        description="Socios activos con cuotas vencidas, del mayor al menor saldo."
      />
      <RoleGuard roles={['ADMIN', 'OPERATOR']}>
        <MorosidadList />
      </RoleGuard>
    </div>
  );
}

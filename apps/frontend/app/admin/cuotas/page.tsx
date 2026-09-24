'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings2 } from 'lucide-react';
import { Fee, FeeType, PaginatedResponse } from '@/lib/types';
import {
  getFees,
  createFeeType,
  updateFeeType,
  deleteFeeType,
  generateFees,
  createPayment,
  createMercadoPagoPreference,
  cancelFee,
} from '@/lib/api';
import { errorText, qk, useDisciplines, useFeeTypes } from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, Pagination, SkeletonRows } from '@/components/ui/States';
import { useFeedback } from '@/components/ui/Feedback';
import { FeeTypeForm } from '@/components/fees/FeeTypeForm';
import { FeeGenerator } from '@/components/fees/FeeGenerator';
import { PaymentForm } from '@/components/fees/PaymentForm';
import { FeeTable } from '@/components/fees/FeeTable';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PARTIALLY_PAID', label: 'Parcial' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'CANCELLED', label: 'Anulada' },
];

export default function CuotasPage() {
  const { toast, confirmAction } = useFeedback();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [feeTypeEditing, setFeeTypeEditing] = useState<FeeType | 'new' | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [paymentFee, setPaymentFee] = useState<Fee | null>(null);
  const [cancelling, setCancelling] = useState<Fee | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const filters = { period, status, page, limit: 20 };
  const feesQuery = useQuery<PaginatedResponse<Fee>>({
    queryKey: qk.fees(filters),
    queryFn: () => getFees(filters),
    placeholderData: keepPreviousData,
  });
  // Catálogos: se piden una vez y se comparten con el resto de las pantallas
  const { data: feeTypes = [] } = useFeeTypes();
  const { data: disciplines = [] } = useDisciplines();

  // Un pago o una anulación cambian cuotas, morosidad, caja y dashboard
  const refreshMoney = () => {
    for (const key of [['fees'], qk.delinquency, qk.dashboard, ['cash-closure'], ['reports']]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };
  const onError = (fallback: string) => (err: unknown) => toast(errorText(err, fallback), 'error');

  const saveFeeType = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      feeTypeEditing && feeTypeEditing !== 'new' ? updateFeeType(feeTypeEditing.id, data) : createFeeType(data),
    onSuccess: () => {
      toast('Tipo de cuota guardado');
      setFeeTypeEditing(null);
      queryClient.invalidateQueries({ queryKey: qk.feeTypes });
    },
    onError: onError('Error al guardar'),
  });

  const generate = useMutation({
    mutationFn: generateFees,
    onSuccess: (result: { created?: number; skipped?: number }) => {
      const created = result.created ?? 0;
      const skipped = result.skipped ?? 0;
      toast(
        created > 0
          ? `Se generaron ${created} cuotas${skipped ? ` (${skipped} ya existían)` : ''}`
          : 'No se generaron cuotas nuevas: ya existían para ese período',
      );
      setGeneratorOpen(false);
      refreshMoney();
    },
    onError: onError('Error al generar'),
  });

  const pay = useMutation({
    mutationFn: createPayment,
    onSuccess: (payment: { amount: string }) => {
      setPaymentFee(null);
      toast(`Pago de ${formatMoney(payment.amount)} registrado. El recibo queda en la columna Pagado.`);
      refreshMoney();
    },
    onError: onError('Error al registrar pago'),
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelFee(id, reason),
    onSuccess: () => {
      toast('Cuota anulada');
      setCancelling(null);
      refreshMoney();
    },
    onError: onError('Error al anular'),
  });

  const handlePayWithMP = async (fee: Fee) => {
    try {
      const result = await createMercadoPagoPreference(fee.id);
      if (!result.initPoint) {
        toast('No se pudo generar el link de pago', 'error');
        return;
      }
      await navigator.clipboard?.writeText(result.initPoint).catch(() => {});
      toast('Link de Mercado Pago copiado: pegáselo al socio por WhatsApp o email');
      window.open(result.initPoint, '_blank', 'noopener');
    } catch (err) {
      toast(errorText(err, 'Error con Mercado Pago'), 'error');
    }
  };

  const handleFeeTypeDelete = async (feeType: FeeType) => {
    const ok = await confirmAction({
      title: `¿Desactivar ${feeType.name}?`,
      message: 'No se va a poder usar para generar cuotas nuevas. Las ya generadas no cambian.',
      confirmLabel: 'Desactivar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteFeeType(feeType.id);
      toast('Tipo de cuota desactivado');
      queryClient.invalidateQueries({ queryKey: qk.feeTypes });
    } catch (err) {
      toast(errorText(err, 'Error al desactivar'), 'error');
    }
  };

  const fees = feesQuery.data?.items ?? [];
  const feeTypeInEdit = feeTypeEditing && feeTypeEditing !== 'new' ? feeTypeEditing : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Cuotas y pagos" description="Cobros de cuotas, links de pago y anulaciones.">
        <Button variant="secondary" onClick={() => setFeeTypeEditing('new')} icon={<Settings2 className="h-4 w-4" aria-hidden />}>
          Tipo de cuota
        </Button>
        <Button onClick={() => setGeneratorOpen(true)} icon={<Plus className="h-4 w-4" aria-hidden />}>
          Generar cuotas
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:flex-row">
        <Input
          type="month"
          label="Período"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(1);
          }}
          className="md:w-48"
        />
        <Select
          label="Estado"
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="md:w-48"
        />
        {(period || status) && (
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={() => {
                setPeriod('');
                setStatus('');
                setPage(1);
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {feesQuery.isPending ? (
        <SkeletonRows />
      ) : feesQuery.isError ? (
        <ErrorState error={feesQuery.error} onRetry={() => feesQuery.refetch()} />
      ) : (
        <div className={feesQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <FeeTable
            fees={fees}
            onRegisterPayment={setPaymentFee}
            onPayWithMP={handlePayWithMP}
            onCancel={(fee) => {
              setCancelling(fee);
              setCancelReason('');
            }}
          />
          <Pagination meta={feesQuery.data?.meta} onPage={setPage} label="cuotas" />
        </div>
      )}

      <section className="mt-8" aria-labelledby="tipos-cuota">
        <h2 id="tipos-cuota" className="mb-3 text-lg font-bold">
          Tipos de cuota
        </h2>
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {feeTypes.map((ft) => (
            <li key={ft.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="font-medium">
                  {ft.name}
                  {!ft.isActive && <span className="ml-2 text-xs text-gray-500">(inactivo)</span>}
                </p>
                {ft.description && <p className="text-sm text-gray-600">{ft.description}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setFeeTypeEditing(ft)}>
                  Editar
                </Button>
                {ft.isActive && (
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleFeeTypeDelete(ft)}>
                    Desactivar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Modal
        isOpen={feeTypeEditing !== null}
        onClose={() => setFeeTypeEditing(null)}
        title={feeTypeInEdit ? 'Editar tipo de cuota' : 'Nuevo tipo de cuota'}
      >
        <FeeTypeForm
          key={feeTypeInEdit?.id ?? 'new'}
          feeType={feeTypeInEdit}
          onSubmit={(data) => saveFeeType.mutate(data)}
          onCancel={() => setFeeTypeEditing(null)}
          isLoading={saveFeeType.isPending}
        />
      </Modal>

      <Modal isOpen={generatorOpen} onClose={() => setGeneratorOpen(false)} title="Generar cuotas">
        {generatorOpen && (
          <FeeGenerator
            feeTypes={feeTypes}
            disciplines={disciplines}
            onSubmit={(data) => generate.mutate(data)}
            onCancel={() => setGeneratorOpen(false)}
            isLoading={generate.isPending}
          />
        )}
      </Modal>

      <Modal isOpen={!!paymentFee} onClose={() => setPaymentFee(null)} title="Registrar pago">
        {paymentFee && (
          <PaymentForm
            key={paymentFee.id}
            fee={paymentFee}
            onSubmit={(data) => pay.mutate(data)}
            onCancel={() => setPaymentFee(null)}
            isLoading={pay.isPending}
          />
        )}
      </Modal>

      <Modal
        isOpen={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="Anular cuota"
        subtitle="La cuota deja de figurar como deuda. Solo se pueden anular cuotas sin pagos."
      >
        {cancelling && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              cancel.mutate({ id: cancelling.id, reason: cancelReason.trim() });
            }}
            className="space-y-4"
          >
            <p className="text-sm text-gray-700">
              {cancelling.member.lastName}, {cancelling.member.firstName} · {cancelling.feeType?.name ?? 'Cuota'}{' '}
              {cancelling.period} · <strong>{formatMoney(cancelling.amount)}</strong>
            </p>
            <Input
              label="Motivo"
              required
              minLength={3}
              maxLength={500}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej.: generada por error, socio becado"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCancelling(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger" disabled={cancel.isPending || cancelReason.trim().length < 3}>
                Anular cuota
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Fee, FeeType, Discipline, PaginatedResponse } from '@/lib/types';
import {
  getFees,
  getFeeTypes,
  getDisciplines,
  createFeeType,
  updateFeeType,
  deleteFeeType,
  generateFees,
  createPayment,
  createMercadoPagoPreference,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { FeeTypeForm } from '@/components/fees/FeeTypeForm';
import { FeeGenerator } from '@/components/fees/FeeGenerator';
import { PaymentForm } from '@/components/fees/PaymentForm';
import { FeeTable } from '@/components/fees/FeeTable';

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PARTIALLY_PAID', label: 'Parcial' },
  { value: 'PAID', label: 'Pagada' },
];

export default function CuotasPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Fee>['meta'] | null>(null);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [feeTypeModalOpen, setFeeTypeModalOpen] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);

  const [generatorOpen, setGeneratorOpen] = useState(false);

  const [paymentFee, setPaymentFee] = useState<Fee | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feesData, typesData, disciplinesData] = await Promise.all([
        getFees({ period, status, page, limit: 20 }),
        getFeeTypes(),
        getDisciplines(),
      ]);
      setFees(feesData.items);
      setMeta(feesData.meta);
      setFeeTypes(typesData);
      setDisciplines(disciplinesData);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, status, page]);

  // --- Tipos de cuota ---
  const openFeeTypeCreate = () => {
    setEditingFeeType(null);
    setFeeTypeModalOpen(true);
  };

  const openFeeTypeEdit = (feeType: FeeType) => {
    setEditingFeeType(feeType);
    setFeeTypeModalOpen(true);
  };

  const closeFeeTypeModal = () => {
    setFeeTypeModalOpen(false);
    setEditingFeeType(null);
  };

  const handleFeeTypeSubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editingFeeType) {
        await updateFeeType(editingFeeType.id, data);
      } else {
        await createFeeType(data);
      }
      closeFeeTypeModal();
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleFeeTypeDelete = async (feeType: FeeType) => {
    if (!confirm(`¿Desactivar ${feeType.name}?`)) return;
    try {
      await deleteFeeType(feeType.id);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  // --- Generador ---
  const handleGenerate = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const result = await generateFees(data);
      alert(`Cuotas generadas: ${result.created ?? 0}`);
      setGeneratorOpen(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al generar');
    } finally {
      setSaving(false);
    }
  };

  // --- Pagos ---
  const handleRegisterPayment = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      await createPayment(data);
      setPaymentFee(null);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar pago');
    } finally {
      setSaving(false);
    }
  };

  const handlePayWithMP = async (fee: Fee) => {
    try {
      const result = await createMercadoPagoPreference(fee.id);
      if (result.initPoint) {
        window.location.href = result.initPoint;
      } else {
        alert('No se pudo generar el link de pago');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error con Mercado Pago');
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">Cuotas y Pagos</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setGeneratorOpen(true)}>
            Generar cuotas
          </Button>
          <Button onClick={openFeeTypeCreate}>Tipos de cuota</Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Período (AAAA-MM)"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setPage(1);
            }}
            className="md:w-48"
          />
          <Select
            options={statusOptions}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="md:w-48"
          />
        </div>
      </div>

      {loading && fees.length === 0 ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <>
          <FeeTable
            fees={fees}
            onRegisterPayment={setPaymentFee}
            onPayWithMP={handlePayWithMP}
          />

          {meta && meta.totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <p className="text-sm text-gray-600">
                Mostrando {fees.length} de {meta.total} cuotas
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                <span className="px-3 py-2 text-sm text-gray-700">
                  Página {meta.page} de {meta.totalPages}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={feeTypeModalOpen}
        onClose={closeFeeTypeModal}
        title={editingFeeType ? 'Editar tipo de cuota' : 'Nuevo tipo de cuota'}
      >
        <FeeTypeForm
          feeType={editingFeeType}
          onSubmit={handleFeeTypeSubmit}
          onCancel={closeFeeTypeModal}
          isLoading={saving}
        />
      </Modal>

      <Modal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        title="Generar cuotas"
      >
        <FeeGenerator
          feeTypes={feeTypes}
          disciplines={disciplines}
          onSubmit={handleGenerate}
          onCancel={() => setGeneratorOpen(false)}
          isLoading={saving}
        />
      </Modal>

      <Modal
        isOpen={!!paymentFee}
        onClose={() => setPaymentFee(null)}
        title="Registrar pago"
      >
        {paymentFee && (
          <PaymentForm
            fee={paymentFee}
            onSubmit={handleRegisterPayment}
            onCancel={() => setPaymentFee(null)}
            isLoading={saving}
          />
        )}
      </Modal>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3">Tipos de cuota configurados</h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {feeTypes.map((ft) => (
            <div
              key={ft.id}
              className="p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-medium">
                  {ft.name}
                  {!ft.isActive && (
                    <span className="ml-2 text-xs text-gray-500">(inactivo)</span>
                  )}
                </p>
                {ft.description && (
                  <p className="text-sm text-gray-600">{ft.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="text-sm py-1 px-2"
                  onClick={() => openFeeTypeEdit(ft)}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  className="text-sm py-1 px-2 text-red-600 hover:text-red-700"
                  onClick={() => handleFeeTypeDelete(ft)}
                >
                  Desactivar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

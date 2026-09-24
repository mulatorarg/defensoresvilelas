'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, CreditCard, Pencil, Plus, Power, Trophy, UsersRound } from 'lucide-react';
import { Discipline, Category } from '@/lib/types';
import {
  createDiscipline,
  updateDiscipline,
  deleteDiscipline,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/api';
import { errorText, qk, useDisciplines } from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { useFeedback } from '@/components/ui/Feedback';
import { DisciplineForm } from '@/components/disciplines/DisciplineForm';
import { CategoryForm } from '@/components/disciplines/CategoryForm';

const GENDER: Record<string, { label: string; classes: string }> = {
  MALE: { label: 'Masculino', classes: 'bg-sky-50 text-sky-700' },
  FEMALE: { label: 'Femenino', classes: 'bg-pink-50 text-pink-600' },
  MIXED: { label: 'Mixto', classes: 'bg-gray-100 text-gray-500' },
};

function ageLabel(category: Category) {
  if (category.ageFrom && category.ageTo) return `${category.ageFrom} a ${category.ageTo} años`;
  if (category.ageFrom) return `desde ${category.ageFrom} años`;
  if (category.ageTo) return `hasta ${category.ageTo} años`;
  return null;
}

const iconBtn =
  'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700';

function ToggleButton({ active, name, onClick }: { active: boolean; name: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600'
          : 'flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10'
      }
      title={active ? 'Desactivar' : 'Reactivar'}
      aria-label={`${active ? 'Desactivar' : 'Reactivar'} ${name}`}
    >
      <Power className="h-4 w-4" aria-hidden />
    </button>
  );
}

export default function DisciplinasPage() {
  const { toast, confirmAction } = useFeedback();
  const queryClient = useQueryClient();
  const disciplinesQuery = useDisciplines();
  const disciplines = disciplinesQuery.data ?? [];
  const [saving, setSaving] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | 'new' | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ category: Category | null; disciplineId: string } | null>(null);

  const run = async (action: () => Promise<unknown>, done: string, fallback = 'Error al guardar') => {
    setSaving(true);
    try {
      await action();
      toast(done);
      // Disciplinas y categorías son un catálogo compartido: se refrescan en todas las pantallas
      await queryClient.invalidateQueries({ queryKey: qk.disciplines });
      return true;
    } catch (err) {
      toast(errorText(err, fallback), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDiscipline = async (data: Record<string, unknown>) => {
    const target = editingDiscipline;
    const ok = await run(
      () => (target && target !== 'new' ? updateDiscipline(target.id, data) : createDiscipline(data)),
      target && target !== 'new' ? 'Disciplina actualizada' : 'Disciplina creada',
    );
    if (ok) setEditingDiscipline(null);
  };

  const saveCategory = async (data: Record<string, unknown>) => {
    if (!editingCategory) return;
    const { category, disciplineId } = editingCategory;
    const ok = await run(
      () => (category ? updateCategory(category.id, data) : createCategory({ ...data, disciplineId: data.disciplineId ?? disciplineId })),
      category ? 'Categoría actualizada' : 'Categoría creada',
    );
    if (ok) setEditingCategory(null);
  };

  const toggleDiscipline = async (discipline: Discipline) => {
    if (discipline.isActive) {
      const ok = await confirmAction({
        title: `¿Desactivar ${discipline.name}?`,
        message: 'Deja de mostrarse en la web y en las inscripciones. No se borra nada: podés reactivarla cuando quieras.',
        confirmLabel: 'Desactivar',
        danger: true,
      });
      if (ok) run(() => deleteDiscipline(discipline.id), `${discipline.name} desactivada`, 'Error al desactivar');
    } else {
      run(() => updateDiscipline(discipline.id, { isActive: true }), `${discipline.name} reactivada`, 'Error al reactivar');
    }
  };

  const toggleCategory = async (category: Category) => {
    if (category.isActive) {
      const ok = await confirmAction({
        title: `¿Desactivar ${category.name}?`,
        message: 'Podés reactivarla cuando quieras; no se pierde nada.',
        confirmLabel: 'Desactivar',
        danger: true,
      });
      if (ok) run(() => deleteCategory(category.id), `${category.name} desactivada`, 'Error al desactivar');
    } else {
      run(() => updateCategory(category.id, { isActive: true }), `${category.name} reactivada`, 'Error al reactivar');
    }
  };

  const disciplineInEdit = editingDiscipline && editingDiscipline !== 'new' ? editingDiscipline : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Disciplinas y Categorías" description="Las actividades del club y sus grupos por edad y género.">
        <Button onClick={() => setEditingDiscipline('new')} icon={<Plus className="h-4 w-4" aria-hidden />}>
          Nueva disciplina
        </Button>
      </PageHeader>

      {disciplinesQuery.isPending ? (
        <SkeletonRows count={3} height="h-40" />
      ) : disciplinesQuery.isError ? (
        <ErrorState error={disciplinesQuery.error} onRetry={() => disciplinesQuery.refetch()} />
      ) : disciplines.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-7 w-7 text-gray-400" aria-hidden />}
          title="Todavía no hay disciplinas"
          hint="Empezá creando la primera actividad del club (fútbol, básquet, vóley...)."
        >
          <Button onClick={() => setEditingDiscipline('new')}>Crear la primera</Button>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {disciplines.map((discipline) => (
            <section
              key={discipline.id}
              aria-labelledby={`disc-${discipline.id}`}
              className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
                discipline.isActive ? '' : 'opacity-75'
              }`}
            >
              {/* Encabezado de la disciplina */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div className="flex items-center gap-3.5">
                  {discipline.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={discipline.imageUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-2xl text-primary" aria-hidden>
                      {discipline.icon || <Trophy className="h-5 w-5" />}
                    </span>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id={`disc-${discipline.id}`} className="font-display text-lg font-bold text-gray-900">
                        {discipline.name}
                      </h2>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                        {discipline.categories.length} categoría{discipline.categories.length === 1 ? '' : 's'}
                      </span>
                      {!discipline.isActive && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                          Inactiva
                        </span>
                      )}
                    </div>
                    {discipline.description && <p className="mt-0.5 text-[13px] text-gray-400">{discipline.description}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => setEditingCategory({ category: null, disciplineId: discipline.id })}
                    icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Categoría
                  </Button>
                  <button
                    onClick={() => setEditingDiscipline(discipline)}
                    className={iconBtn}
                    title="Editar disciplina"
                    aria-label={`Editar ${discipline.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <ToggleButton active={discipline.isActive} name={discipline.name} onClick={() => toggleDiscipline(discipline)} />
                </div>
              </div>

              {/* Categorías */}
              <div className="p-4">
                {discipline.categories.length === 0 ? (
                  <button
                    onClick={() => setEditingCategory({ category: null, disciplineId: discipline.id })}
                    className="w-full rounded-xl border border-dashed border-gray-300 py-6 text-sm text-gray-400 transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    Agregar la primera categoría
                  </button>
                ) : (
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {discipline.categories.map((category) => {
                      const gender = GENDER[category.gender ?? 'MIXED'] ?? GENDER.MIXED;
                      const age = ageLabel(category);
                      return (
                        <li
                          key={category.id}
                          className={`group rounded-xl border border-gray-100 bg-gray-50/60 p-4 transition-colors hover:border-gray-200 hover:bg-white ${
                            category.isActive ? '' : 'opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-sm font-bold text-gray-900">{category.name}</h3>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${gender.classes}`}>
                                {gender.label}
                              </span>
                              {!category.isActive && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">
                                  Inactiva
                                </span>
                              )}
                            </div>
                            {/* Visibles siempre en celular y con el teclado; en escritorio, al pasar el mouse */}
                            <div className="flex gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                              <button
                                onClick={() => setEditingCategory({ category, disciplineId: discipline.id })}
                                className={iconBtn}
                                title="Editar categoría"
                                aria-label={`Editar ${category.name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </button>
                              <ToggleButton active={category.isActive} name={category.name} onClick={() => toggleCategory(category)} />
                            </div>
                          </div>

                          <div className="mt-2.5 space-y-1 text-[12.5px] text-gray-500">
                            {age && (
                              <p className="flex items-center gap-1.5">
                                <UsersRound className="h-3.5 w-3.5" aria-hidden /> {age}
                              </p>
                            )}
                            <p className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" aria-hidden /> {category.schedule || 'Sin horario definido'}
                            </p>
                            {category.feeAmount && (
                              <p className="flex items-center gap-1.5 font-semibold text-gray-700">
                                <CreditCard className="h-3.5 w-3.5" aria-hidden /> Cuota {formatMoney(category.feeAmount, { decimals: 0 })}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        isOpen={editingDiscipline !== null}
        onClose={() => setEditingDiscipline(null)}
        title={disciplineInEdit ? 'Editar disciplina' : 'Nueva disciplina'}
      >
        <DisciplineForm
          key={disciplineInEdit?.id ?? 'new'}
          discipline={disciplineInEdit}
          onSubmit={saveDiscipline}
          onCancel={() => setEditingDiscipline(null)}
          isLoading={saving}
        />
      </Modal>

      <Modal
        isOpen={editingCategory !== null}
        onClose={() => setEditingCategory(null)}
        title={editingCategory?.category ? 'Editar categoría' : 'Nueva categoría'}
        subtitle="El nombre, los rangos de edad y el horario aparecen en la web del club."
      >
        {editingCategory && (
          <CategoryForm
            key={editingCategory.category?.id ?? `new-${editingCategory.disciplineId}`}
            disciplines={disciplines.filter((d) => d.isActive || d.id === editingCategory.disciplineId)}
            category={editingCategory.category}
            defaultDisciplineId={editingCategory.disciplineId}
            onSubmit={saveCategory}
            onCancel={() => setEditingCategory(null)}
            isLoading={saving}
          />
        )}
      </Modal>
    </div>
  );
}

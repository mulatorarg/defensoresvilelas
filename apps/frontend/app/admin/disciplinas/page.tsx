'use client';

import { useEffect, useState } from 'react';
import { Discipline, Category } from '@/lib/types';
import {
  getDisciplines,
  createDiscipline,
  updateDiscipline,
  deleteDiscipline,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFeedback } from '@/components/ui/Feedback';
import { DisciplineForm } from '@/components/disciplines/DisciplineForm';
import { CategoryForm } from '@/components/disciplines/CategoryForm';

const GENDER: Record<string, { label: string; classes: string }> = {
  MALE: { label: 'Masculino', classes: 'bg-sky-50 text-sky-700' },
  FEMALE: { label: 'Femenino', classes: 'bg-pink-50 text-pink-600' },
  MIXED: { label: 'Mixto', classes: 'bg-gray-100 text-gray-500' },
};

function ageLabel(category: Category) {
  if (category.ageFrom && category.ageTo) return `${category.ageFrom}–${category.ageTo} años`;
  if (category.ageFrom) return `+${category.ageFrom} años`;
  if (category.ageTo) return `hasta ${category.ageTo} años`;
  return null;
}

const iconBtn =
  'flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700';

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M13 3h-2v10h2V3zm4.83 2.17-1.42 1.42A6.92 6.92 0 0 1 19 12a7 7 0 0 1-14 0c0-2.05.88-3.9 2.58-5.41L6.17 5.17A8.93 8.93 0 0 0 3 12a9 9 0 0 0 18 0c0-2.74-1.23-5.18-3.17-6.83z" />
    </svg>
  );
}

export default function DisciplinasPage() {
  const { toast, confirmAction } = useFeedback();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [disciplineModalOpen, setDisciplineModalOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryDisciplineId, setCategoryDisciplineId] = useState<string>('');

  const fetchDisciplines = async () => {
    setLoading(true);
    try {
      const data = await getDisciplines();
      setDisciplines(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al cargar disciplinas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisciplines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Disciplinas ---
  const openDisciplineCreate = () => {
    setEditingDiscipline(null);
    setDisciplineModalOpen(true);
  };

  const openDisciplineEdit = (discipline: Discipline) => {
    setEditingDiscipline(discipline);
    setDisciplineModalOpen(true);
  };

  const closeDisciplineModal = () => {
    setDisciplineModalOpen(false);
    setEditingDiscipline(null);
  };

  const handleDisciplineSubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editingDiscipline) {
        await updateDiscipline(editingDiscipline.id, data);
        toast('Disciplina actualizada');
      } else {
        await createDiscipline(data);
        toast('Disciplina creada');
      }
      closeDisciplineModal();
      fetchDisciplines();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleDiscipline = async (discipline: Discipline) => {
    if (discipline.isActive) {
      const ok = await confirmAction({
        title: `¿Desactivar ${discipline.name}?`,
        message:
          'Deja de mostrarse en la web y en las inscripciones. No se borra nada: podés reactivarla cuando quieras.',
        confirmLabel: 'Desactivar',
        danger: true,
      });
      if (!ok) return;
      try {
        await deleteDiscipline(discipline.id);
        toast(`${discipline.name} desactivada`);
        fetchDisciplines();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al desactivar', 'error');
      }
    } else {
      try {
        await updateDiscipline(discipline.id, { isActive: true });
        toast(`${discipline.name} reactivada`);
        fetchDisciplines();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al reactivar', 'error');
      }
    }
  };

  // --- Categorías ---
  const openCategoryCreate = (disciplineId: string) => {
    setCategoryDisciplineId(disciplineId);
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };

  const openCategoryEdit = (category: Category) => {
    setCategoryDisciplineId(category.disciplineId);
    setEditingCategory(category);
    setCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setCategoryModalOpen(false);
    setEditingCategory(null);
    setCategoryDisciplineId('');
  };

  const handleCategorySubmit = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, data);
        toast('Categoría actualizada');
      } else {
        await createCategory({ ...data, disciplineId: categoryDisciplineId });
        toast('Categoría creada');
      }
      closeCategoryModal();
      fetchDisciplines();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar categoría', 'error');
    } finally {
      setSaving(false);
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
      if (!ok) return;
      try {
        await deleteCategory(category.id);
        toast(`${category.name} desactivada`);
        fetchDisciplines();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al desactivar', 'error');
      }
    } else {
      try {
        await updateCategory(category.id, { isActive: true });
        toast(`${category.name} reactivada`);
        fetchDisciplines();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al reactivar', 'error');
      }
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Disciplinas y Categorías"
        description="Las actividades del club y sus grupos por edad y género."
      >
        <Button onClick={openDisciplineCreate} icon={<span className="text-base leading-none">+</span>}>
          Nueva disciplina
        </Button>
      </PageHeader>

      {loading && disciplines.length === 0 ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-200/50" />
          ))}
        </div>
      ) : disciplines.length === 0 ? (
        <EmptyState
          icon="🏅"
          title="Todavía no hay disciplinas"
          hint="Empezá creando la primera actividad del club (fútbol, básquet, vóley...)."
        >
          <Button onClick={openDisciplineCreate}>Crear la primera</Button>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {disciplines.map((discipline) => (
            <section
              key={discipline.id}
              className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
                discipline.isActive ? '' : 'opacity-75'
              }`}
            >
              {/* Encabezado de la disciplina */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                    {discipline.icon || '🏅'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-bold text-gray-900">
                        {discipline.name}
                      </h2>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                        {discipline.categories.length} categoría
                        {discipline.categories.length === 1 ? '' : 's'}
                      </span>
                      {!discipline.isActive && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                          Inactiva
                        </span>
                      )}
                    </div>
                    {discipline.description && (
                      <p className="mt-0.5 text-[13px] text-gray-400">
                        {discipline.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => openCategoryCreate(discipline.id)}
                  >
                    + Categoría
                  </Button>
                  <button
                    onClick={() => openDisciplineEdit(discipline)}
                    className={iconBtn}
                    title="Editar disciplina"
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={() => toggleDiscipline(discipline)}
                    className={
                      discipline.isActive
                        ? 'flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600'
                        : 'flex h-7 w-7 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10'
                    }
                    title={discipline.isActive ? 'Desactivar' : 'Reactivar'}
                  >
                    <PowerIcon />
                  </button>
                </div>
              </div>

              {/* Categorías */}
              <div className="p-4">
                {discipline.categories.length === 0 ? (
                  <button
                    onClick={() => openCategoryCreate(discipline.id)}
                    className="w-full rounded-xl border border-dashed border-gray-300 py-6 text-sm text-gray-400 transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    + Agregar la primera categoría
                  </button>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {discipline.categories.map((category) => {
                      const gender = GENDER[category.gender ?? 'MIXED'] ?? GENDER.MIXED;
                      const age = ageLabel(category);
                      return (
                        <div
                          key={category.id}
                          className={`group rounded-xl border border-gray-100 bg-gray-50/60 p-4 transition-colors hover:border-gray-200 hover:bg-white ${
                            category.isActive ? '' : 'opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-sm font-bold text-gray-900">
                                {category.name}
                              </h3>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${gender.classes}`}
                              >
                                {gender.label}
                              </span>
                              {!category.isActive && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">
                                  Inactiva
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => openCategoryEdit(category)}
                                className={iconBtn}
                                title="Editar categoría"
                              >
                                <EditIcon />
                              </button>
                              <button
                                onClick={() => toggleCategory(category)}
                                className={
                                  category.isActive
                                    ? 'flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600'
                                    : 'flex h-7 w-7 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10'
                                }
                                title={category.isActive ? 'Desactivar' : 'Reactivar'}
                              >
                                <PowerIcon />
                              </button>
                            </div>
                          </div>

                          <div className="mt-2.5 space-y-1 text-[12.5px] text-gray-500">
                            {age && <p>👶 {age}</p>}
                            <p>🕐 {category.schedule || 'Sin horario definido'}</p>
                            {category.feeAmount && (
                              <p className="font-semibold text-gray-700">
                                💳 Cuota $
                                {Number(category.feeAmount).toLocaleString('es-AR')}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        isOpen={disciplineModalOpen}
        onClose={closeDisciplineModal}
        title={editingDiscipline ? 'Editar disciplina' : 'Nueva disciplina'}
      >
        <DisciplineForm
          discipline={editingDiscipline}
          onSubmit={handleDisciplineSubmit}
          onCancel={closeDisciplineModal}
          isLoading={saving}
        />
      </Modal>

      <Modal
        isOpen={categoryModalOpen}
        onClose={closeCategoryModal}
        title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
        subtitle="El nombre, los rangos de edad y el horario aparecen en la web del club."
      >
        <CategoryForm
          disciplines={disciplines}
          category={editingCategory}
          onSubmit={handleCategorySubmit}
          onCancel={closeCategoryModal}
          isLoading={saving}
        />
      </Modal>
    </div>
  );
}

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
import { DisciplineForm } from '@/components/disciplines/DisciplineForm';
import { CategoryForm } from '@/components/disciplines/CategoryForm';

export default function DisciplinasPage() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [disciplineModalOpen, setDisciplineModalOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(
    null,
  );

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryDisciplineId, setCategoryDisciplineId] = useState<string>('');

  const fetchDisciplines = async () => {
    setLoading(true);
    try {
      const data = await getDisciplines();
      setDisciplines(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cargar disciplinas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisciplines();
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
      } else {
        await createDiscipline(data);
      }
      closeDisciplineModal();
      fetchDisciplines();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDisciplineDelete = async (discipline: Discipline) => {
    if (!confirm(`¿Desactivar ${discipline.name}?`)) return;
    try {
      await deleteDiscipline(discipline.id);
      fetchDisciplines();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al desactivar');
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
      } else {
        await createCategory({ ...data, disciplineId: categoryDisciplineId });
      }
      closeCategoryModal();
      fetchDisciplines();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryDelete = async (category: Category) => {
    if (!confirm(`¿Desactivar ${category.name}?`)) return;
    try {
      await deleteCategory(category.id);
      fetchDisciplines();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al desactivar');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Disciplinas y Categorías</h1>
        <Button onClick={openDisciplineCreate}>Nueva disciplina</Button>
      </div>

      {loading && disciplines.length === 0 ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <div className="space-y-6">
          {disciplines.map((discipline) => (
            <div
              key={discipline.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div>
                  <h2 className="text-lg font-bold">
                    {discipline.icon && (
                      <span className="mr-2">{discipline.icon}</span>
                    )}
                    {discipline.name}
                    {!discipline.isActive && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (inactiva)
                      </span>
                    )}
                  </h2>
                  {discipline.description && (
                    <p className="text-sm text-gray-600">
                      {discipline.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="text-sm py-1 px-2"
                    onClick={() => openCategoryCreate(discipline.id)}
                  >
                    + Categoría
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-sm py-1 px-2"
                    onClick={() => openDisciplineEdit(discipline)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-sm py-1 px-2 text-red-600 hover:text-red-700"
                    onClick={() => handleDisciplineDelete(discipline)}
                  >
                    Desactivar
                  </Button>
                </div>
              </div>

              <div className="p-4">
                {discipline.categories.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Sin categorías cargadas.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {discipline.categories.map((category) => (
                      <div
                        key={category.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold">{category.name}</h3>
                          {!category.isActive && (
                            <span className="text-xs text-gray-500">
                              inactiva
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {category.schedule || 'Sin horario'}
                        </p>
                        {category.feeAmount && (
                          <p className="text-sm font-medium text-gray-800 mt-1">
                            Cuota: ${category.feeAmount}
                          </p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="ghost"
                            className="text-xs py-1 px-2"
                            onClick={() => openCategoryEdit(category)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            className="text-xs py-1 px-2 text-red-600 hover:text-red-700"
                            onClick={() => handleCategoryDelete(category)}
                          >
                            Desactivar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

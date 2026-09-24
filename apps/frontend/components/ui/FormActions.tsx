import { Button } from './Button';

/** Botonera estándar de los formularios en modales. */
export function FormActions({
  onCancel,
  isLoading,
  submitLabel,
  loadingLabel = 'Guardando...',
}: {
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel: string;
  loadingLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-4">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? loadingLabel : submitLabel}
      </Button>
    </div>
  );
}

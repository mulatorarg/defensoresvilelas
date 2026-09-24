import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface DarkFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/** Campo del portal del socio (tema oscuro) con etiqueta visible y error accesible. */
export const DarkField = forwardRef<HTMLInputElement, DarkFieldProps>(({ label, error, className = '', id, ...props }, ref) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-hidden transition-colors focus:border-primary/60 focus:bg-white/8 disabled:opacity-60 ${
          error ? 'border-red-400/60' : 'border-white/10'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-[12px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
});

DarkField.displayName = 'DarkField';

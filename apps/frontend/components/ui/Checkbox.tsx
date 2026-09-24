import { InputHTMLAttributes, forwardRef } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, hint, className = '', ...props }, ref) => (
    <label className={`flex items-start gap-2.5 text-sm text-gray-700 ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[var(--color-primary)]"
        {...props}
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
    </label>
  ),
);

Checkbox.displayName = 'Checkbox';

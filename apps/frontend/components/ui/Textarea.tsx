import { TextareaHTMLAttributes, forwardRef, useId } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, rows = 3, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const helpId = `${fieldId}-help`;
    const help = error || hint;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-semibold text-gray-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={help ? helpId : undefined}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary/25 focus:border-primary ${
            error ? 'border-red-400' : 'border-gray-300'
          } ${className}`}
          {...props}
        />
        {help && (
          <p id={helpId} className={`mt-1 ${error ? 'text-sm text-red-600' : 'text-xs text-gray-400'}`}>
            {help}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

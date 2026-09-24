import { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const helpId = `${inputId}-help`;
    const help = error || hint;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={help ? helpId : undefined}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary/25 focus:border-primary ${
              leftIcon ? 'pl-10' : ''
            } ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
            {...props}
          />
        </div>
        {help && (
          <p id={helpId} className={`mt-1 ${error ? 'text-sm text-red-600' : 'text-xs text-gray-400'}`}>
            {help}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

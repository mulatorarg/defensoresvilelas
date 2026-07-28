import { SelectHTMLAttributes, forwardRef } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Option[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-[13px] font-semibold text-gray-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full cursor-pointer rounded-xl border bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary/25 focus:border-primary ${
            error ? 'border-red-400' : 'border-gray-300'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';

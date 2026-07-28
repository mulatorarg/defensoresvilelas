import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

const variants = {
  primary:
    'bg-primary text-white shadow-sm hover:brightness-110 focus-visible:ring-primary/40',
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 focus-visible:ring-gray-300',
  soft: 'bg-primary/10 text-primary hover:bg-primary/15 focus-visible:ring-primary/30',
  danger:
    'bg-red-50 text-red-600 hover:bg-red-100 focus-visible:ring-red-300',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-300',
};

const sizes = {
  sm: 'px-3 py-1.5 text-[13px] gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-all focus-visible:outline-hidden focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

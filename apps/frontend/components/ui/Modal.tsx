'use client';

import { ReactNode, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, subtitle, children }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  useFocusTrap(dialog, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="animate-rise flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-hidden [animation-duration:0.35s] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <h2 id={titleId} className="font-display text-lg font-bold text-gray-900">
              {title}
            </h2>
            {subtitle && (
              <p id={subtitleId} className="mt-0.5 text-[13px] text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

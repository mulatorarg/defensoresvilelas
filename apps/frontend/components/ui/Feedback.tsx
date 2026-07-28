'use client';

/**
 * Feedback global del admin: toasts (avisos) y diálogos de confirmación,
 * en reemplazo de los alert()/confirm() del navegador.
 *
 *   const { toast, confirmAction } = useFeedback();
 *   toast('Socio guardado');
 *   toast('No se pudo guardar', 'error');
 *   if (await confirmAction({ title: '¿Dar de baja?', danger: true })) { ... }
 */
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Button } from './Button';

type ToastType = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface FeedbackContextValue {
  toast: (message: string, type?: ToastType) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback debe usarse dentro de <FeedbackProvider>');
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const closeConfirm = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirmAction }}>
      {children}

      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg [animation-duration:0.3s] ${
              t.type === 'success'
                ? 'border-primary/20 bg-white text-gray-800'
                : 'border-red-200 bg-white text-gray-800'
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                t.type === 'success' ? 'bg-primary' : 'bg-red-500'
              }`}
            >
              {t.type === 'success' ? '✓' : '!'}
            </span>
            <p className="leading-snug">{t.message}</p>
          </div>
        ))}
      </div>

      {/* Confirmación */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="animate-rise w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl [animation-duration:0.3s]"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-label={confirmState.title}
          >
            <div
              className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
                confirmState.danger ? 'bg-red-50' : 'bg-primary/10'
              }`}
            >
              {confirmState.danger ? '⚠️' : '❓'}
            </div>
            <h3 className="font-display text-lg font-bold text-gray-900">
              {confirmState.title}
            </h3>
            {confirmState.message && (
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {confirmState.message}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => closeConfirm(false)}>
                Cancelar
              </Button>
              <Button
                variant={confirmState.danger ? 'danger' : 'primary'}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accesibilidad de diálogos: mientras `active`, el foco queda dentro de
 * `container` (Tab y Shift+Tab ciclan), Escape llama a `onEscape` y, al cerrar,
 * el foco vuelve al elemento que abrió el diálogo.
 */
export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
) {
  // Ref para no reiniciar la trampa cuando el padre pasa una función nueva en cada render
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = container.current;

    const focusables = () =>
      root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    // Primer campo del diálogo (o el diálogo mismo), salvo que algo ya tenga autoFocus
    if (root && !root.contains(document.activeElement)) {
      const first = focusables().find((el) => el.tagName !== 'BUTTON') ?? focusables()[0];
      (first ?? root).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [active, container]);
}

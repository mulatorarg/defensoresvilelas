import { useEffect, useState } from 'react';

/** Devuelve `value` recién cuando dejó de cambiar durante `delay` ms (búsquedas). */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

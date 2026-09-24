// Montos: la API los devuelve como string decimal ("12000.50") para no perder
// precisión. Convertir con toNumber solo para mostrar o sumar en pantalla.

export type Money = string | number | null | undefined;

export function toNumber(value: Money): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: Money, { decimals = 2 }: { decimals?: number } = {}): string {
  return toNumber(value).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

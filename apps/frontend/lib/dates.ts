/**
 * Fechas "de calendario" (sin hora): la API las devuelve como
 * "2026-09-23T00:00:00.000Z". Pasarlas por `new Date()` las corre un día
 * hacia atrás en Argentina (UTC-3), y `toISOString()` da la fecha UTC, que
 * después de las 21 h ya es "mañana". Estos helpers trabajan con la fecha local.
 */

/** Fecha local de hoy en formato YYYY-MM-DD (para inputs type="date"). */
export function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** "2026-09-23T00:00:00.000Z" -> "23/9/2026", sin conversión de zona horaria. */
export function formatDateOnly(iso?: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(year, month - 1, day).toLocaleDateString('es-AR');
}

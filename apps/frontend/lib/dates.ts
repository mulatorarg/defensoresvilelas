/**
 * Fechas: la API guarda y devuelve todo en UTC ("2026-09-23T01:30:00.000Z").
 * En pantalla se muestra SIEMPRE la hora del club (Argentina), sin importar la
 * zona horaria del navegador o del dispositivo: por eso ningún helper usa la
 * zona local del navegador (getDate(), toISOString(), toLocale... sin timeZone).
 *
 * Dos tipos de valores:
 * - Instantes (pagos, publicaciones, eventos): se convierten a la hora del club.
 * - Fechas de calendario (fecha de un movimiento, de una asistencia, de
 *   nacimiento): la API las manda como "AAAA-MM-DDT00:00:00.000Z" y se muestran
 *   tal cual, sin conversión (convertirlas las correría un día hacia atrás).
 */

// Misma zona que CLUB_TIMEZONE del backend (app/clock.py)
export const CLUB_TIMEZONE =
  process.env.NEXT_PUBLIC_CLUB_TIMEZONE || 'America/Argentina/Buenos_Aires';

const LOCALE = 'es-AR';

/** Partes de fecha de un instante en la zona del club. */
function clubDateParts(date: Date): { year: string; month: string; day: string } {
  // en-CA formatea como AAAA-MM-DD
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .split('-');
  return { year, month, day };
}

/** Hoy en la zona del club, AAAA-MM-DD (para inputs type="date"). */
export function todayLocal(): string {
  const { year, month, day } = clubDateParts(new Date());
  return `${year}-${month}-${day}`;
}

/** Mes corriente en la zona del club, AAAA-MM (período de cuotas). */
export function currentPeriod(): string {
  const { year, month } = clubDateParts(new Date());
  return `${year}-${month}`;
}

/** Fecha de calendario "2026-09-23T00:00:00.000Z" -> "23/9/2026", sin conversión de zona. */
export function formatDateOnly(iso?: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** Instante en la hora del club, con el formato que se pida (por defecto 23/9/2026). */
export function formatDate(
  value?: string | Date | null,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: CLUB_TIMEZONE, ...options }).format(date);
}

/** Instante con fecha y hora (24 h) en la hora del club: "23/9/2026, 22:30". */
export function formatDateTime(value?: string | Date | null): string {
  return formatDate(value, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/**
 * Instante (ISO UTC) a valor de <input type="datetime-local"> en hora del club:
 * "2026-10-05T21:00:00.000Z" -> "2026-10-05T18:00". La API interpreta ese valor
 * (sin zona) como hora del club al guardarlo.
 */
export function toClubDateTimeInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CLUB_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

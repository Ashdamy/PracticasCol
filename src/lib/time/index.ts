/**
 * Utilidades de fecha en hora de Colombia (America/Bogota, UTC-5 sin horario de verano).
 * Las fechas de calendario se manejan como strings ISO `yyyy-mm-dd` para evitar errores de zona horaria.
 */
export const TIME_ZONE = "America/Bogota";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Colombia como `yyyy-mm-dd`. */
export function todayInBogota(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

function toUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Días de `from` a `to` (ambos `yyyy-mm-dd`). Positivo si `to` es posterior. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** Suma (o resta) días a una fecha `yyyy-mm-dd`. */
export function addDays(isoDate: string, days: number): string {
  return new Date(toUtcMs(isoDate) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Días transcurridos desde un ISO datetime hasta `now`. */
export function daysSince(isoDateTime: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(isoDateTime).getTime()) / 86_400_000);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtcMs(value));
}

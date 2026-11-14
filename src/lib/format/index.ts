import type { Compensation, DeadlineInfo } from "@/lib/contracts";
import { COMPENSATION_TYPE_LABELS } from "@/lib/catalog/labels";
export function semesterRange(min: number | null, max: number | null) {
  if (min !== null && max !== null) {
    return min === max
      ? `${min}.º semestre`
      : `Del ${min}.º al ${max}.º semestre`;
  }
  if (min !== null) return `Desde ${min}.º semestre`;
  if (max !== null) return `Hasta ${max}.º semestre`;
  return "No publicado";
}
export function money(c: Compensation) {
  return c.amountCop !== null
    ? `${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(c.amountCop)} / mes`
    : COMPENSATION_TYPE_LABELS[c.type];
}
export function date(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00-05:00` : value));
}
export function deadline(d: DeadlineInfo) {
  if (d.type === "hasta_agotar_cupos") return "Hasta agotar cupos";
  if (d.type === "no_publicada" || d.daysLeft === null)
    return "Cierre sin publicar";
  if (d.daysLeft < 0) return "Convocatoria cerrada";
  if (d.daysLeft === 0) return "Cierra hoy";
  if (d.daysLeft === 1) return "Cierra mañana";
  return `Cierra en ${d.daysLeft} días`;
}

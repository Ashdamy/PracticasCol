/** Fechas de convocatorias en español → ISO `yyyy-mm-dd`. Funciones puras. */
import type { DeadlineType } from "@/lib/contracts";
import { daysBetween } from "@/lib/time";
import type { Confidence, Normalized } from "../types";
import { excerpt, fold, isBlank, result } from "./text";

const MONTHS: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sept: 9, sep: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};
const MONTH_ALT = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const YMD_RE = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/;
const DMY_RE = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/;
const DAY_MONTH_RE = new RegExp(
  `\\b(\\d{1,2})\\s*(?:de\\s+)?(${MONTH_ALT})\\b\\.?(?:\\s*,?\\s*(?:de\\s+|del\\s+)?(\\d{4})\\b)?`,
);
const MONTH_DAY_RE = new RegExp(
  `\\b(${MONTH_ALT})\\b\\.?\\s+(\\d{1,2})\\b(?:\\s*,?\\s*(?:de\\s+|del\\s+)?(\\d{4})\\b)?`,
);
const DM_RE = /\b(\d{1,2})\/(\d{1,2})\b/;

interface Parts {
  year: number | null;
  month: number;
  day: number;
  note?: string;
  /** Posición en el texto donde termina la fecha encontrada. */
  end: number;
}

function parseParts(f: string): Parts | null {
  let m = YMD_RE.exec(f);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), end: m.index + m[0].length };

  m = DMY_RE.exec(f);
  if (m) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    const parts: Parts = { year: Number(m[3]), month, day, end: m.index + m[0].length };
    if (m[3].length === 2) {
      parts.year = 2000 + Number(m[3]);
      parts.note = "Año de dos dígitos: se asumió 20xx";
    }
    // En Colombia se escribe día/mes; si el "mes" es > 12 la fuente usó mes/día.
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
      parts.day = day;
      parts.month = month;
      parts.note = "Formato mes/día: se intercambiaron día y mes";
    }
    return parts;
  }

  m = DAY_MONTH_RE.exec(f);
  if (m) return { year: m[3] ? Number(m[3]) : null, month: MONTHS[m[2]], day: Number(m[1]), end: m.index + m[0].length };

  m = MONTH_DAY_RE.exec(f);
  if (m) return { year: m[3] ? Number(m[3]) : null, month: MONTHS[m[1]], day: Number(m[2]), end: m.index + m[0].length };

  m = DM_RE.exec(f);
  if (m) return { year: null, month: Number(m[2]), day: Number(m[1]), end: m.index + m[0].length };

  return null;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

type Resolved =
  | { kind: "ok"; date: string; confidence: Confidence; note?: string }
  | { kind: "invalid" }
  | { kind: "none" };

const SEVERAL_DATES_NOTE = "La fuente menciona varias fechas: se tomó la última como cierre";

/** Todas las fechas del texto, en orden (máx. 6 para no recorrer textos enormes). */
function parseAllParts(f: string): Parts[] {
  const all: Parts[] = [];
  let rest = f;
  while (all.length < 6) {
    const parts = parseParts(rest);
    if (!parts) break;
    all.push(parts);
    rest = rest.slice(parts.end);
  }
  return all;
}

/**
 * Interpreta una fecha del texto (ya pasado por `fold`).
 * `pick: "last"` sirve para rangos ("del 1 de noviembre al 15 de diciembre"): el cierre es la última fecha.
 */
function resolve(f: string, today: string | undefined, pick: "first" | "last" = "first"): Resolved {
  if (pick === "last") {
    const all = parseAllParts(f);
    if (all.length > 1) {
      const last = resolveParts(all[all.length - 1], today);
      if (last.kind !== "ok") return last;
      return {
        kind: "ok",
        date: last.date,
        confidence: last.confidence === "baja" ? "baja" : "media",
        note: last.note ? `${SEVERAL_DATES_NOTE}. ${last.note}` : SEVERAL_DATES_NOTE,
      };
    }
  }
  const parts = parseParts(f);
  if (!parts) return { kind: "none" };
  return resolveParts(parts, today);
}

function resolveParts(parts: Parts, today: string | undefined): Resolved {

  if (parts.year !== null) {
    const date = toIso(parts.year, parts.month, parts.day);
    if (!date) return { kind: "invalid" };
    if (today) {
      const diff = daysBetween(today, date);
      if (diff > 730 || diff < -365) {
        return { kind: "ok", date, confidence: "baja", note: `Fecha poco probable (${date}); confirmar` };
      }
    }
    return { kind: "ok", date, confidence: parts.note ? "media" : "alta", note: parts.note };
  }

  // Sin año: el próximo que no quede en el pasado.
  if (!today) return { kind: "invalid" };
  const currentYear = Number(today.slice(0, 4));
  for (const year of [currentYear, currentYear + 1]) {
    const date = toIso(year, parts.month, parts.day);
    if (date && date >= today) {
      return { kind: "ok", date, confidence: "media", note: `La fuente no indica el año: se asumió ${year}` };
    }
  }
  return { kind: "invalid" };
}

const NOT_PUBLISHED_RE =
  /no (se )?(especific|public|defin|indic|inform|aplica)|sin (fecha|definir|especificar)|por (definir|confirmar)|^n\/?a$|pendiente/;
const UNTIL_FILLED_RE =
  /agotar|(llenar|completar|cubrir)(se)? (las |los |la )?(vacantes?|cupos?|plazas?)|convocatoria (abierta|permanente|continua)|permanente|abierta todo el ano/;

export interface DeadlineValue {
  type: DeadlineType;
  date: string | null;
}

/**
 * Fecha límite de una convocatoria.
 * @param today hoy en Colombia (`yyyy-mm-dd`); se usa para completar fechas sin año.
 */
export function normalizeDeadline(text: string | null | undefined, today: string): Normalized<DeadlineValue> {
  if (isBlank(text)) return result({ type: "no_publicada", date: null }, "alta");
  const f = fold(text);

  const resolved = resolve(f, today, "last");
  if (resolved.kind === "ok") {
    return result({ type: "fecha", date: resolved.date }, resolved.confidence, resolved.note);
  }
  if (resolved.kind === "invalid") {
    return result(
      { type: "no_publicada", date: null },
      "baja",
      `Fecha límite inválida en la fuente: "${excerpt(text)}"`,
    );
  }
  if (UNTIL_FILLED_RE.test(f)) return result({ type: "hasta_agotar_cupos", date: null }, "alta");
  if (NOT_PUBLISHED_RE.test(f)) return result({ type: "no_publicada", date: null }, "alta");
  return result(
    { type: "no_publicada", date: null },
    "baja",
    `No se pudo interpretar la fecha límite: "${excerpt(text)}"`,
  );
}

/**
 * Fecha suelta (p. ej. fecha de inicio). Sin `today` no se pueden completar fechas sin año.
 */
export function normalizeDate(text: string | null | undefined, today?: string): Normalized<string | null> {
  if (isBlank(text)) return result(null, "alta");
  const f = fold(text);
  const resolved = resolve(f, today);
  if (resolved.kind === "ok") return result(resolved.date, resolved.confidence, resolved.note);
  if (resolved.kind === "invalid") return result(null, "baja", `Fecha inválida en la fuente: "${excerpt(text)}"`);
  if (/inmediat|cuanto antes|por (definir|confirmar)|a convenir/.test(f)) return result(null, "alta");
  return result(null, "baja", `No se pudo interpretar la fecha: "${excerpt(text)}"`);
}

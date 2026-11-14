/** Rango de semestres y si acepta egresados. Función pura. */
import type { Confidence, Normalized } from "../types";
import { clean, excerpt, isBlank, result } from "./text";

export interface SemesterValue {
  min: number | null;
  max: number | null;
  acceptsGraduates: boolean | null;
}

const ORDINAL_WORDS: Record<string, number> = {
  primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4, quinto: 5, sexto: 6,
  septimo: 7, octavo: 8, noveno: 9, decimo: 10, undecimo: 11, duodecimo: 12,
};
const ORDINAL_RE = new RegExp(`\\b(${Object.keys(ORDINAL_WORDS).join("|")})\\b`, "g");

const SEM = "(?:semestres?|niveles|nivel)";
const RANGE_BEFORE_RE = new RegExp(`\\b(\\d{1,2}) ?(?:y|a|al|o|hasta)(?: el)? (\\d{1,2}) ?${SEM}\\b`);
const RANGE_AFTER_RE = new RegExp(`\\b${SEM} (\\d{1,2}) ?(?:y|a|al|o|hasta)(?: el)? (\\d{1,2})\\b`);
const SINGLE_BEFORE_RE = new RegExp(`\\b(\\d{1,2}) ?${SEM}\\b`);
const SINGLE_AFTER_RE = new RegExp(`\\b${SEM} (\\d{1,2})\\b`);

const MIN_HINT_RE = /a partir|desde|en adelante|minimo|superior|o mas|cursado|aprobado|mayor|haber|culminado/;
const MAX_HINT_RE = /\bhasta\b|maximo|no superior/;

function graduates(n: string): boolean | null {
  if (/\b(no|sin) (ser )?(egresad|graduad|titulad)/.test(n)) return false;
  if (/egresad|graduad|titulad/.test(n)) return true;
  if (/estudiantes? activ|matriculad|matricula vigente/.test(n)) return false;
  return null;
}

const valid = (s: number) => s >= 1 && s <= 12;

export function normalizeSemester(text: string | null | undefined): Normalized<SemesterValue> {
  if (isBlank(text)) return result({ min: null, max: null, acceptsGraduates: null }, "alta");

  const n = clean(text)
    .replace(ORDINAL_RE, (w) => String(ORDINAL_WORDS[w]))
    // "8vo", "7mo", "1er", "8o" → número
    .replace(/\b(\d{1,2})(?:avo|ero|vo|mo|to|no|ro|do|er|o|a)\b/g, "$1");
  const acceptsGraduates = graduates(n);

  let min: number | null = null;
  let max: number | null = null;
  let confidence: Confidence = "alta";
  let note: string | undefined;

  const range = RANGE_BEFORE_RE.exec(n) ?? RANGE_AFTER_RE.exec(n);
  const single = SINGLE_BEFORE_RE.exec(n) ?? SINGLE_AFTER_RE.exec(n);

  if (range) {
    min = Number(range[1]);
    max = Number(range[2]);
    if (MIN_HINT_RE.test(n) && /en adelante|o mas|superior/.test(n)) max = null;
  } else if (single) {
    const value = Number(single[1]);
    if (MIN_HINT_RE.test(n)) min = value;
    else if (MAX_HINT_RE.test(n)) max = value;
    else {
      min = value;
      confidence = "media";
      note = `"${excerpt(text)}": se tomó como semestre mínimo`;
    }
  } else if (/ultim[oa]s? (semestres?|anos?|niveles)/.test(n)) {
    confidence = "baja";
    note = "«Últimos semestres» sin número: definir el semestre mínimo";
  } else if (acceptsGraduates === null) {
    confidence = "baja";
    note = `No se pudo interpretar el semestre: "${excerpt(text)}"`;
  }

  if ((min !== null && !valid(min)) || (max !== null && !valid(max)) || (min !== null && max !== null && min > max)) {
    return result(
      { min: null, max: null, acceptsGraduates },
      "baja",
      `Rango de semestres inválido: "${excerpt(text)}"`,
    );
  }
  return result({ min, max, acceptsGraduates }, confidence, note);
}

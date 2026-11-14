/** Duración en meses. Función pura. */
import type { Normalized } from "../types";
import { clean, excerpt, isBlank, result } from "./text";

export type DurationValue = { min: number; max: number } | null;

const NUMBER_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};
const WORDS_RE = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b`, "g");

const UNIT = "(mes(?:es)?|semanas?|anos?|semestres?|trimestres?|dias?)";
const RANGE_RE = new RegExp(`\\b(\\d{1,3})(?:\\s*(?:a|y|o|hasta)\\s*|\\s+)(\\d{1,3})\\s*${UNIT}\\b`);
const SINGLE_RE = new RegExp(`\\b(\\d{1,3})\\s*${UNIT}\\b`);

function toMonths(amount: number, unit: string): number {
  let months: number;
  if (unit.startsWith("mes")) months = amount;
  else if (unit.startsWith("semana")) months = amount / 4.345;
  else if (unit.startsWith("ano")) months = amount * 12;
  else if (unit.startsWith("semestre")) months = amount * 6;
  else if (unit.startsWith("trimestre")) months = amount * 3;
  else months = amount / 30;
  return Math.max(1, Math.round(months));
}

export function normalizeDuration(text: string | null | undefined): Normalized<DurationValue> {
  if (isBlank(text)) return result(null, "alta");
  const n = clean(text).replace(WORDS_RE, (w) => String(NUMBER_WORDS[w]));

  let value: DurationValue = null;
  const range = RANGE_RE.exec(n);
  if (range) {
    const a = toMonths(Number(range[1]), range[3]);
    const b = toMonths(Number(range[2]), range[3]);
    value = { min: Math.min(a, b), max: Math.max(a, b) };
  } else {
    const single = SINGLE_RE.exec(n);
    if (single) {
      const months = toMonths(Number(single[1]), single[2]);
      value = { min: months, max: months };
    }
  }

  if (!value) {
    if (/\bsemestral(es)?\b|\bsemestre\b/.test(n)) {
      return result({ min: 6, max: 6 }, "media", "Duración «semestral»: se asumieron 6 meses");
    }
    if (/\banual(es)?\b/.test(n)) return result({ min: 12, max: 12 }, "media", "Duración «anual»: se asumieron 12 meses");
    return result(null, "baja", `No se pudo interpretar la duración: "${excerpt(text)}"`);
  }
  if (value.max > 24) {
    return result(value, "baja", `Duración poco probable (${value.max} meses); confirmar`);
  }
  return result(value, "alta");
}

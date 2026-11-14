/** Utilidades de texto compartidas por los normalizadores. */
import { normalize } from "@/server/search/text";
import type { Confidence, Normalized } from "../types";

/** Sin tildes, minúsculas y solo letras/números (la puntuación se vuelve espacio). */
export function clean(text: string): string {
  return normalize(text).replace(/\s+/g, " ").trim();
}

/** Sin tildes y en minúsculas, pero conserva la puntuación (fechas, montos, URLs). */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isBlank(text: string | null | undefined): text is null | undefined | "" {
  return text == null || text.trim() === "";
}

export function result<T>(value: T, confidence: Confidence, note?: string): Normalized<T> {
  return note ? { value, confidence, note } : { value, confidence };
}

const ORDER: Record<Confidence, number> = { baja: 0, media: 1, alta: 2 };

/** La menor de las confianzas. */
export function lowest(...levels: Confidence[]): Confidence {
  return levels.reduce<Confidence>((min, c) => (ORDER[c] < ORDER[min] ? c : min), "alta");
}

/** Recorta un texto para mostrarlo en notas de revisión. */
export function excerpt(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Reemplaza una frase completa (palabras enteras) por el separador "|".
 * Devuelve el texto restante y si hubo coincidencia. `phrase` debe venir de `clean()`.
 */
export function consumePhrase(text: string, phrase: string): [rest: string, hit: boolean] {
  const re = new RegExp(`(^|[ |])${phrase}(?=$|[ |])`, "g");
  let hit = false;
  const rest = text.replace(re, (_m, pre: string) => {
    hit = true;
    return `${pre}|`;
  });
  return [rest, hit];
}

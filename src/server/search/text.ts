/** Normalización y coincidencia de texto en español (sin tildes, plurales simples, stopwords). */

const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "en", "y", "o", "a", "al", "para", "por", "con", "un", "una", "e", "u",
]);

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ");
}

/** Raíz muy simple: quita plurales "-es"/"-s" para que "practicas" ≈ "practica". */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

/** Un token de la consulta coincide si alguna palabra del campo empieza por él (búsqueda mientras se escribe). */
export function fieldMatches(queryToken: string, fieldTokens: readonly string[]): boolean {
  return fieldTokens.some((w) => w === queryToken || (queryToken.length >= 3 && w.startsWith(queryToken)));
}

export interface WeightedField {
  tokens: string[];
  weight: number;
}

/**
 * Puntaje de relevancia. Devuelve 0 si algún token de la consulta no aparece en ningún campo (semántica AND).
 */
export function scoreText(queryTokens: readonly string[], fields: readonly WeightedField[]): number {
  let score = 0;
  for (const t of queryTokens) {
    let best = 0;
    for (const f of fields) if (f.weight > best && fieldMatches(t, f.tokens)) best = f.weight;
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

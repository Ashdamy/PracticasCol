/**
 * Deduplicación (AGENTS.md §12): hash de (organización + título normalizado + fecha límite)
 * y similitud de trigramas para los casos dudosos.
 */
import { createHash } from "node:crypto";
import { tokenize } from "@/server/search/text";
import { clean } from "./normalize/text";

export const TITLE_SIMILARITY_THRESHOLD = 0.8;

/** Organización comparable: sin tildes, sin puntuación y sin sufijos societarios ("S.A.S.", "Ltda."). */
export function normalizeOrganization(name: string): string {
  return clean(name)
    .replace(/( (s a s|sas|s a|sa|ltda|limitada|e s p|esp|s en c))+$/, "")
    .trim();
}

/** Título comparable: sin tildes, sin stopwords y con plurales simples reducidos. */
export function normalizeTitle(title: string): string {
  return tokenize(title).join(" ");
}

export function dedupeHash(organizationName: string, title: string, deadlineDate: string | null): string {
  const key = [normalizeOrganization(organizationName), normalizeTitle(title), deadlineDate ?? ""].join("|");
  return createHash("sha256").update(key).digest("hex");
}

function trigrams(text: string): Set<string> {
  const padded = `  ${clean(text)} `;
  const set = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i += 1) set.add(padded.slice(i, i + 3));
  return set;
}

/** Jaccard de trigramas del texto normalizado (0 = nada en común, 1 = igual). */
export function trigramSimilarity(a: string, b: string): number {
  const na = clean(a);
  const nb = clean(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = trigrams(na);
  const tb = trigrams(nb);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

export interface Dedupable {
  organizationName: string;
  title: string;
  deadlineDate: string | null;
}

export interface DuplicateMatch<T> {
  match: T;
  kind: "exacto" | "probable";
  similarity: number;
}

/**
 * - `exacto`: mismo hash (misma organización, título y fecha límite).
 * - `probable`: misma organización, título muy parecido y misma fecha límite (o alguna sin fecha). Va a revisión.
 */
export function findDuplicate<T extends Dedupable>(candidate: Dedupable, existing: readonly T[]): DuplicateMatch<T> | null {
  const hash = dedupeHash(candidate.organizationName, candidate.title, candidate.deadlineDate);
  const organization = normalizeOrganization(candidate.organizationName);
  const title = normalizeTitle(candidate.title);

  let best: DuplicateMatch<T> | null = null;
  for (const other of existing) {
    if (dedupeHash(other.organizationName, other.title, other.deadlineDate) === hash) {
      return { match: other, kind: "exacto", similarity: 1 };
    }
    if (!organization || normalizeOrganization(other.organizationName) !== organization) continue;
    const sameDeadline =
      candidate.deadlineDate === null || other.deadlineDate === null || candidate.deadlineDate === other.deadlineDate;
    if (!sameDeadline) continue;
    const similarity = trigramSimilarity(title, normalizeTitle(other.title));
    if (similarity >= TITLE_SIMILARITY_THRESHOLD && (!best || similarity > best.similarity)) {
      best = { match: other, kind: "probable", similarity };
    }
  }
  return best;
}

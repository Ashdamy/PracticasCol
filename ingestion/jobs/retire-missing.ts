/**
 * Ofertas de agregadores que dejaron de aparecer (función pura).
 *
 * Los agregadores como Jooble no publican fecha de cierre: la única señal de que una oferta cerró es que la
 * fuente deja de mostrarla. Cada corrida de la ingesta anota `lastVerifiedAt` en lo que la fuente volvió a
 * mostrar (`store.markSeen`); aquí se buscan las que llevan `maxDays` días sin aparecer.
 *
 * Los días se cuentan desde la **última corrida** de esa fuente (la `lastVerifiedAt` más reciente entre sus
 * ofertas), no desde hoy: si la ingesta deja de correr unos días, no se retira todo de golpe.
 * Solo se tocan las ofertas cuyas fuentes son TODAS agregadores: si también llegó por carga manual o por la
 * página de la empresa, una persona decide.
 */
import { JOOBLE_SOURCE_ID } from "../adapters/jooble";
import type { StoredOpportunity } from "../store";

/** Fuentes que no traen fecha de cierre y se limpian por ausencia. */
export const AGGREGATOR_SOURCE_IDS: readonly string[] = [JOOBLE_SOURCE_ID];
export const DEFAULT_MISSING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type MissingTarget = Pick<StoredOpportunity, "id" | "title" | "status" | "sources" | "lastVerifiedAt">;

export interface MissingDecision<T extends MissingTarget = MissingTarget> {
  opportunity: T;
  /** Publicada → `vencida` (su URL sigue con aviso); en revisión → `retirada` (nunca se mostró). */
  newStatus: "vencida" | "retirada";
  /** Días entre su última aparición y la última corrida de la fuente. */
  daysMissing: number;
}

export interface MissingReport<T extends MissingTarget = MissingTarget> {
  /** Última corrida conocida por fuente (ISO), o vacío si nunca corrió. */
  lastRunBySource: Map<string, string>;
  decisions: MissingDecision<T>[];
}

export function findMissingFromAggregators<T extends MissingTarget>(
  opportunities: readonly T[],
  options: { sourceIds?: readonly string[]; maxDays?: number } = {},
): MissingReport<T> {
  const sourceIds = new Set(options.sourceIds ?? AGGREGATOR_SOURCE_IDS);
  const maxDays = Math.max(1, options.maxDays ?? DEFAULT_MISSING_DAYS);

  const lastRunBySource = new Map<string, string>();
  for (const o of opportunities) {
    for (const s of o.sources) {
      if (!sourceIds.has(s.sourceId)) continue;
      const previous = lastRunBySource.get(s.sourceId);
      if (!previous || o.lastVerifiedAt > previous) lastRunBySource.set(s.sourceId, o.lastVerifiedAt);
    }
  }

  const decisions: MissingDecision<T>[] = [];
  for (const o of opportunities) {
    if (o.status !== "publicada" && o.status !== "en_revision") continue;
    if (o.sources.length === 0 || !o.sources.every((s) => sourceIds.has(s.sourceId))) continue;
    const reference = o.sources
      .map((s) => lastRunBySource.get(s.sourceId))
      .filter((v): v is string => v !== undefined)
      .sort()
      .at(-1);
    if (!reference) continue;
    const missingMs = Date.parse(reference) - Date.parse(o.lastVerifiedAt);
    if (!Number.isFinite(missingMs) || missingMs < maxDays * DAY_MS) continue;
    decisions.push({
      opportunity: o,
      newStatus: o.status === "publicada" ? "vencida" : "retirada",
      daysMissing: Math.floor(missingMs / DAY_MS),
    });
  }
  decisions.sort((a, b) => b.daysMissing - a.daysMissing || a.opportunity.title.localeCompare(b.opportunity.title, "es"));
  return { lastRunBySource, decisions };
}

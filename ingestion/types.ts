/**
 * Tipos base del motor de ingesta (AGENTS.md §12).
 * Flujo: adapter.fetch() → RawItem[] → adapter.parse() → OpportunityDraft → normalizeDraft() → OpportunityCandidate.
 */
import type { SourceMethod } from "@/lib/contracts";
import type { OpportunityRecord } from "@/server/domain/types";
import type { PoliteFetcher } from "./http";

/** Ítem crudo tal como llegó de la fuente. `payload` se guarda en `raw_items` junto con su hash. */
export interface RawItem {
  sourceId: string;
  /** Identificador del ítem en la fuente (si existe). */
  externalId: string | null;
  url: string;
  payload: unknown;
  /** ISO datetime. */
  fetchedAt: string;
}

/** Campos tal como vienen de la fuente, sin interpretar. */
export interface OpportunityDraft {
  title: string | null;
  organizationName: string | null;
  typeText: string | null;
  levelText: string | null;
  municipalityText: string | null;
  modalityText: string | null;
  compensationText: string | null;
  durationText: string | null;
  deadlineText: string | null;
  startDateText: string | null;
  description: string | null;
  programsText: string | null;
  semesterText: string | null;
  /** Texto libre; cada requisito separado por salto de línea o ";". */
  requirementsText: string | null;
  applyUrl: string | null;
  sourceUrl: string | null;
  /** Restricción de instituciones ("solo estudiantes de X"). */
  institutionsText?: string | null;
}

export interface IngestionLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface AdapterContext {
  http: PoliteFetcher;
  now: Date;
  log: IngestionLogger;
}

export interface SourceAdapter {
  id: string;
  name: string;
  method: SourceMethod;
  /** Solo si es `true` (y todo sale con confianza alta) se publica sin revisión humana. */
  autoPublish?: boolean;
  fetch(ctx: AdapterContext): Promise<RawItem[]>;
  parse(raw: RawItem): OpportunityDraft;
}

export type Confidence = "alta" | "media" | "baja";

export interface Normalized<T> {
  value: T;
  confidence: Confidence;
  /** Explicación para la revisión humana. Si existe, el ítem no se publica solo. */
  note?: string;
}

/** Oportunidad normalizada, lista para deduplicar y guardar. */
export type OpportunityCandidate = Omit<
  OpportunityRecord,
  "id" | "organizationId" | "publishedAt" | "lastVerifiedAt"
> & { organizationName: string };

export interface IngestionError {
  url: string;
  message: string;
}

export interface IngestionReport {
  sourceId: string;
  /** Ítems que devolvió el adaptador. */
  fetched: number;
  /** Ítems cuyo contenido no cambió desde la última corrida (mismo hash). */
  unchanged: number;
  created: number;
  updated: number;
  /** Duplicados exactos de una oportunidad existente: solo se agregó la fuente. */
  duplicates: number;
  /** Duplicados probables: se crearon en revisión con una nota. */
  probableDuplicates: number;
  /** Creados o actualizados que quedaron `en_revision`. */
  needsReview: number;
  /** Llegaron con la fecha límite ya vencida (los nuevos no se crean). */
  expired: number;
  errors: IngestionError[];
  warnings: string[];
  durationMs: number;
}

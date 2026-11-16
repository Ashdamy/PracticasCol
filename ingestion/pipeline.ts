/**
 * Orquestador de la ingesta: adaptador → crudo → borrador → normalizado → deduplicado → guardado.
 * Cada adaptador y cada ítem corren aislados: un fallo no detiene a los demás (AGENTS.md §12).
 */
import { createHash } from "node:crypto";
import type { Modality, OpportunityStatus } from "@/lib/contracts";
import { todayInBogota } from "@/lib/time";
import { findDuplicate } from "./dedupe";
import type { PoliteFetcher } from "./http";
import { normalizeDraft } from "./normalize";
import type { IngestionStore, StoredOpportunity } from "./store";
import type { Confidence, IngestionLogger, IngestionReport, OpportunityCandidate, RawItem, SourceAdapter } from "./types";

export type ItemOutcome =
  | "sin_cambios"
  | "creada"
  | "actualizada"
  | "duplicado_exacto"
  | "duplicado_probable"
  | "vencida"
  | "error";

export interface IngestionItemResult {
  sourceId: string;
  externalId: string | null;
  url: string;
  title: string | null;
  outcome: ItemOutcome;
  status: OpportunityStatus | null;
  confidence: Confidence | null;
  /** Lugar y modalidad ya normalizados (`null` si el ítem no llegó a normalizarse). */
  municipalitySlug: string | null;
  modality: Modality | null;
  issues: string[];
}

export interface IngestionRun {
  startedAt: string;
  dryRun: boolean;
  reports: IngestionReport[];
  items: IngestionItemResult[];
}

export interface RunIngestionOptions {
  adapters: readonly SourceAdapter[];
  store: IngestionStore;
  http: PoliteFetcher;
  now?: Date;
  /** No escribe nada en el store: solo calcula el reporte. */
  dryRun?: boolean;
  log?: IngestionLogger;
}

const SILENT: IngestionLogger = { info: () => undefined, warn: () => undefined };

/** JSON con las llaves ordenadas, para que el mismo contenido dé siempre el mismo hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function contentHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptyReport(sourceId: string): IngestionReport {
  return {
    sourceId,
    fetched: 0,
    unchanged: 0,
    created: 0,
    updated: 0,
    duplicates: 0,
    probableDuplicates: 0,
    needsReview: 0,
    expired: 0,
    errors: [],
    warnings: [],
    durationMs: 0,
  };
}

/** Al actualizar no se pisa una decisión humana: lo publicado o retirado se queda así (salvo que venza). */
function statusForUpdate(existing: OpportunityStatus, incoming: OpportunityStatus): OpportunityStatus {
  if (existing === "retirada") return "retirada";
  if (incoming === "vencida") return "vencida";
  if (existing === "publicada") return "publicada";
  return incoming;
}

function mergeSources(
  existing: StoredOpportunity["sources"],
  incoming: OpportunityCandidate["sources"],
): OpportunityCandidate["sources"] {
  const merged = [...existing];
  for (const source of incoming) {
    if (!merged.some((s) => s.sourceId === source.sourceId && s.url === source.url)) merged.push(source);
  }
  return merged;
}

export async function runIngestion(options: RunIngestionOptions): Promise<IngestionRun> {
  const { adapters, store, http, dryRun = false, log = SILENT } = options;
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const today = todayInBogota(now);

  // Copia de trabajo: incluye lo creado en esta corrida, así se detectan duplicados dentro del mismo lote
  // (y entre fuentes) también en `dryRun`.
  const known: StoredOpportunity[] = await store.listOpportunities();
  const seenHashes = new Set<string>();
  const reports: IngestionReport[] = [];
  const items: IngestionItemResult[] = [];
  let virtualId = 0;

  for (const adapter of adapters) {
    const startedAt = Date.now();
    const report = emptyReport(adapter.id);
    reports.push(report);

    let rawItems: RawItem[] = [];
    try {
      rawItems = await adapter.fetch({ http, now, log });
    } catch (error) {
      report.errors.push({ url: `adapter:${adapter.id}`, message: errorMessage(error) });
      log.warn(`[${adapter.id}] falló la descarga: ${errorMessage(error)}`);
      report.durationMs = Date.now() - startedAt;
      if (!dryRun) await store.recordRun(report).catch(() => undefined);
      continue;
    }

    report.fetched = rawItems.length;
    if (rawItems.length === 0) {
      // En fuentes filtradas (p. ej. ATS con solo prácticas) puede ser normal; el log del adaptador dice
      // cuántas ofertas tenía el tablero. Si el tablero también viene vacío, sí puede haber un cambio.
      report.warnings.push(`${adapter.name} devolvió 0 ítems: puede que hoy no haya ofertas que pasen el filtro o que la fuente haya cambiado (revisa el log)`);
    }

    for (const raw of rawItems) {
      const item: IngestionItemResult = {
        sourceId: adapter.id,
        externalId: raw.externalId,
        url: raw.url,
        title: null,
        outcome: "error",
        status: null,
        confidence: null,
        municipalitySlug: null,
        modality: null,
        issues: [],
      };
      items.push(item);

      let hash: string | null = null;
      try {
        hash = contentHash(raw.payload);
        const hashKey = `${adapter.id}:${hash}`;
        const isNew = !seenHashes.has(hashKey) && !(await store.hasRaw(adapter.id, hash));
        seenHashes.add(hashKey);
        if (!isNew) {
          report.unchanged += 1;
          item.outcome = "sin_cambios";
          continue;
        }

        const draft = adapter.parse(raw);
        const normalized = normalizeDraft(draft, {
          today,
          sourceId: adapter.id,
          autoPublish: adapter.autoPublish === true,
        });
        const { candidate } = normalized;
        item.title = candidate.title || null;
        item.confidence = normalized.confidence;
        item.issues = [...normalized.issues];
        item.status = candidate.status;
        item.municipalitySlug = candidate.municipalitySlug;
        item.modality = candidate.modality;

        const duplicate = findDuplicate(candidate, known);
        const sourceRef = candidate.sources[0];

        if (duplicate?.kind === "exacto") {
          const existing = duplicate.match;
          const sameSource = existing.sources.some((s) => s.sourceId === adapter.id);
          if (!sameSource) {
            // Otra fuente publica la misma convocatoria: se conserva la existente y se suma la fuente.
            if (!dryRun) await store.addSourceToOpportunity(existing.id, sourceRef.sourceId, sourceRef.url, nowIso);
            existing.sources = mergeSources(existing.sources, [sourceRef]);
            existing.lastVerifiedAt = nowIso;
            report.duplicates += 1;
            item.outcome = "duplicado_exacto";
            item.status = existing.status;
            continue;
          }
          // La misma fuente cambió el contenido: se actualiza.
          const updated: OpportunityCandidate = {
            ...candidate,
            slug: existing.slug,
            status: statusForUpdate(existing.status, candidate.status),
            sources: mergeSources(existing.sources, candidate.sources),
          };
          // Una publicada que cambia con dudas sigue visible, pero queda marcada para que una persona la mire.
          const needsReview =
            updated.status === "en_revision" || (updated.status === "publicada" && normalized.issues.length > 0);
          const stored = dryRun
            ? { ...existing, ...updated, lastVerifiedAt: nowIso, needsReview, reviewNotes: normalized.issues }
            : await store.upsertOpportunity(updated, {
                existingId: existing.id,
                reviewNotes: normalized.issues,
                needsReview,
                now: nowIso,
              });
          Object.assign(existing, stored);
          report.updated += 1;
          if (needsReview) report.needsReview += 1;
          if (candidate.status === "vencida") report.expired += 1;
          item.outcome = "actualizada";
          item.status = updated.status;
          continue;
        }

        if (candidate.status === "vencida") {
          // Una convocatoria nueva que ya cerró no aporta al catálogo.
          report.expired += 1;
          item.outcome = "vencida";
          continue;
        }

        const toCreate: OpportunityCandidate = { ...candidate };
        const reviewNotes = [...normalized.issues];
        if (duplicate?.kind === "probable") {
          toCreate.status = "en_revision";
          reviewNotes.push(
            `Posible duplicado de «${duplicate.match.title}» (${duplicate.match.id}, similitud ${duplicate.similarity.toFixed(2)})`,
          );
          report.probableDuplicates += 1;
        }

        let stored: StoredOpportunity;
        if (dryRun) {
          virtualId += 1;
          stored = {
            ...toCreate,
            id: `dry-run-${virtualId}`,
            organizationId: "",
            publishedAt: nowIso,
            lastVerifiedAt: nowIso,
            needsReview: toCreate.status === "en_revision",
            reviewNotes,
          };
        } else {
          stored = await store.upsertOpportunity(toCreate, { reviewNotes, now: nowIso });
        }
        known.push(stored);
        report.created += 1;
        if (toCreate.status === "en_revision") report.needsReview += 1;
        item.outcome = duplicate?.kind === "probable" ? "duplicado_probable" : "creada";
        item.status = toCreate.status;
        item.issues = reviewNotes;
      } catch (error) {
        item.outcome = "error";
        item.issues = [errorMessage(error)];
        report.errors.push({ url: raw.url, message: errorMessage(error) });
      } finally {
        // El crudo se guarda al final: si el ítem falló, la próxima corrida lo vuelve a intentar.
        if (!dryRun && hash !== null && item.outcome !== "error" && item.outcome !== "sin_cambios") {
          await store.saveRaw(raw, hash).catch((error: unknown) => {
            report.warnings.push(`No se pudo guardar el crudo de ${raw.url}: ${errorMessage(error)}`);
          });
        }
      }
    }

    report.durationMs = Date.now() - startedAt;
    log.info(`[${adapter.id}] ${report.fetched} ítems, ${report.created} nuevas, ${report.needsReview} en revisión`);
    if (!dryRun) {
      await store.recordRun(report).catch((error: unknown) => {
        report.warnings.push(`No se pudo registrar la corrida: ${errorMessage(error)}`);
      });
    }
  }

  return { startedAt: nowIso, dryRun, reports, items };
}

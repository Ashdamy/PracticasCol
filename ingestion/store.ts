/**
 * Persistencia de la ingesta. Hoy solo existe la versión en memoria (tests y CLI);
 * la implementación sobre Supabase llega en la Fase 1 con esta misma interfaz.
 */
import type { OpportunityRecord, OrganizationRecord } from "@/server/domain/types";
import { normalizeOrganization } from "./dedupe";
import { slugify } from "./normalize";
import { companyWebsiteFromUrls } from "./organization-website";
import type { IngestionReport, OpportunityCandidate, RawItem } from "./types";

export interface StoredOpportunity extends OpportunityRecord {
  organizationName: string;
  needsReview: boolean;
  /** Observaciones de la normalización y la deduplicación, para la cola de revisión. */
  reviewNotes: string[];
}

export interface UpsertOptions {
  /** Si viene, actualiza esa oportunidad; si no, crea una nueva. */
  existingId?: string;
  reviewNotes?: string[];
  /** Fuerza la marca de revisión aunque el estado no sea `en_revision` (p. ej. una publicada que cambió con dudas). */
  needsReview?: boolean;
  /** ISO datetime de la corrida (para `publishedAt` y `lastVerifiedAt`). */
  now?: string;
}

export interface IngestionStore {
  listOpportunities(): Promise<StoredOpportunity[]>;
  upsertOpportunity(candidate: OpportunityCandidate, options?: UpsertOptions): Promise<StoredOpportunity>;
  /** Agrega la fuente (si no estaba) y actualiza `lastVerifiedAt`. */
  addSourceToOpportunity(id: string, sourceId: string, url: string, verifiedAt?: string): Promise<void>;
  /** ¿Ya se había guardado este contenido para esta fuente? (lo usa `dryRun`, que no escribe). */
  hasRaw(sourceId: string, contentHash: string): Promise<boolean>;
  /** Guarda el ítem crudo. Devuelve `false` si ese hash ya existía para esa fuente (sin cambios). */
  saveRaw(raw: RawItem, contentHash: string): Promise<boolean>;
  recordRun(report: IngestionReport): Promise<void>;
}

export interface MemoryStoreSeed {
  opportunities?: readonly OpportunityRecord[];
  organizations?: readonly OrganizationRecord[];
}

export interface MemoryStore extends IngestionStore {
  /** Solo para tests y el CLI. */
  readonly organizations: readonly OrganizationRecord[];
  readonly runs: IngestionReport[];
  readonly rawItems: { raw: RawItem; contentHash: string }[];
}

export function createMemoryStore(seed: MemoryStoreSeed = {}): MemoryStore {
  const organizations: OrganizationRecord[] = [...(seed.organizations ?? [])];
  const organizationName = (id: string) => organizations.find((o) => o.id === id)?.name ?? id;
  const opportunities: StoredOpportunity[] = (seed.opportunities ?? []).map((record) => ({
    ...record,
    organizationName: organizationName(record.organizationId),
    needsReview: record.status === "en_revision",
    reviewNotes: [],
  }));
  const rawHashes = new Set<string>();
  const rawItems: { raw: RawItem; contentHash: string }[] = [];
  const runs: IngestionReport[] = [];
  let sequence = 0;

  function organizationIdFor(name: string, urls: readonly (string | undefined)[]): string {
    const key = normalizeOrganization(name);
    const found = organizations.find((o) => normalizeOrganization(o.name) === key);
    if (found) return found.id;
    const created: OrganizationRecord = {
      id: `org-${slugify(name, 60) || `ingesta-${organizations.length + 1}`}`,
      name,
      sector: "privado",
      logoUrl: null,
      // Solo al crearla: una organización que ya existe conserva su sitio.
      website: companyWebsiteFromUrls(name, urls),
    };
    organizations.push(created);
    return created.id;
  }

  function uniqueSlug(slug: string, ownId: string | undefined): string {
    let candidate = slug;
    for (let n = 2; opportunities.some((o) => o.slug === candidate && o.id !== ownId); n += 1) {
      candidate = `${slug}-${n}`;
    }
    return candidate;
  }

  return {
    organizations,
    runs,
    rawItems,

    async listOpportunities() {
      return opportunities.map((o) => ({ ...o, sources: [...o.sources], reviewNotes: [...o.reviewNotes] }));
    },

    async upsertOpportunity(candidate, options = {}) {
      const now = options.now ?? new Date().toISOString();
      const { organizationName: name, ...fields } = candidate;
      const index = options.existingId ? opportunities.findIndex((o) => o.id === options.existingId) : -1;
      if (options.existingId && index === -1) {
        throw new Error(`No existe la oportunidad ${options.existingId}`);
      }
      const previous = index === -1 ? null : opportunities[index];
      sequence += previous ? 0 : 1;
      const id = previous?.id ?? `opp-ing-${String(sequence).padStart(4, "0")}`;
      const stored: StoredOpportunity = {
        ...fields,
        id,
        slug: previous?.slug ?? uniqueSlug(fields.slug, id),
        organizationId: organizationIdFor(name, [fields.applyUrl, fields.sources[0]?.url]),
        organizationName: name,
        publishedAt: previous?.publishedAt ?? now,
        lastVerifiedAt: now,
        needsReview: options.needsReview ?? fields.status === "en_revision",
        reviewNotes: options.reviewNotes ?? [],
      };
      if (previous) opportunities[index] = stored;
      else opportunities.push(stored);
      return { ...stored };
    },

    async addSourceToOpportunity(id, sourceId, url, verifiedAt) {
      const opportunity = opportunities.find((o) => o.id === id);
      if (!opportunity) throw new Error(`No existe la oportunidad ${id}`);
      if (!opportunity.sources.some((s) => s.sourceId === sourceId && s.url === url)) {
        opportunity.sources = [...opportunity.sources, { sourceId, url }];
      }
      opportunity.lastVerifiedAt = verifiedAt ?? new Date().toISOString();
    },

    async hasRaw(sourceId, contentHash) {
      return rawHashes.has(`${sourceId}:${contentHash}`);
    },

    async saveRaw(raw, contentHash) {
      const key = `${raw.sourceId}:${contentHash}`;
      if (rawHashes.has(key)) return false;
      rawHashes.add(key);
      rawItems.push({ raw, contentHash });
      return true;
    },

    async recordRun(report) {
      runs.push(report);
    },
  };
}

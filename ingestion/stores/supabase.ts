/**
 * Store de la ingesta sobre Supabase (misma interfaz que el de memoria, `IngestionStore`).
 * Usa la clave secreta (omite RLS): solo para scripts que corren en la máquina del PO o en el cron.
 *
 * Las escrituras de una oportunidad son varias peticiones (fila + relaciones) y no una transacción:
 * si algo falla a mitad, el ítem queda como error, su crudo no se guarda y la siguiente corrida lo reintenta.
 */
import { existsSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpportunityStatus, SourceMethod } from "@/lib/contracts";
import {
  OPPORTUNITY_SELECT,
  RELATION_TABLES,
  recordToColumns,
  relationRows,
  rowToRecord,
  toIso,
  type OpportunityRow,
} from "@/server/repo/supabase-mappers";
import {
  UNIQUE_VIOLATION,
  createSupabaseAdminClient,
  fetchAll,
  readSupabaseEnv,
  unwrap,
  type DbResult,
} from "@/server/repo/supabase-shared";
import { dedupeHash, normalizeOrganization } from "../dedupe";
import { companyWebsiteFromUrls } from "../organization-website";
import type { IngestionStore, StoredOpportunity } from "../store";
import type { IngestionReport } from "../types";

/** Primer slug libre: `base`, `base-2`, `base-3`… */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let candidate = base;
  for (let n = 2; used.has(candidate); n += 1) candidate = `${base}-${n}`;
  return candidate;
}

/** Llave con la que se busca una organización ya existente. Vacía si no hay nombre. */
export function organizationKey(name: string): string {
  const trimmed = name.trim();
  return normalizeOrganization(trimmed) || trimmed.toLowerCase();
}

export function rowToStored(row: OpportunityRow): StoredOpportunity {
  return {
    ...rowToRecord(row),
    organizationName: row.organizations?.name ?? "",
    needsReview: row.needs_review,
    reviewNotes: row.review_notes ?? [],
  };
}

export interface SourceSeed {
  id: string;
  name: string;
  method: SourceMethod;
}

export interface StatusPatch {
  status: OpportunityStatus;
  needsReview?: boolean;
  /** ISO datetime. */
  publishedAt?: string;
  lastVerifiedAt?: string;
}

export interface SupabaseStore extends IngestionStore {
  /** Crea las fuentes que falten (las del catálogo ya existen y no se tocan). */
  ensureSources(sources: readonly SourceSeed[]): Promise<void>;
  /** Nombre visible de cada fuente, por id. */
  sourceNames(): Promise<Map<string, string>>;
  /** Cambia el estado de una oportunidad (CLI de administración). */
  setStatus(id: string, patch: StatusPatch): Promise<void>;
}

/** URLs o ids por consulta en `markSeen` (la URL de PostgREST tiene un límite de tamaño). */
const SEEN_CHUNK = 50;

const INCOMPLETE_NOTE ="Cerró sin haberse publicado y le faltaba la organización o el enlace: se retiró";

export function createSupabaseStore(client: SupabaseClient): SupabaseStore {
  /** `website` solo se guarda al crear la organización: nunca pisa el de una que ya existe. */
  async function organizationIdFor(name: string, website: string | null): Promise<string | null> {
    const key = organizationKey(name);
    if (!key) return null;
    const find = async (): Promise<string | null> => {
      const result: DbResult<unknown> = await client
        .from("organizations")
        .select("id")
        .eq("normalized_name", key)
        .maybeSingle();
      return (unwrap(result, "buscar la organización") as { id: string } | null)?.id ?? null;
    };
    const existing = await find();
    if (existing) return existing;
    const created: DbResult<unknown> = await client
      .from("organizations")
      .insert({ name: name.trim(), normalized_name: key, ...(website ? { website } : {}) })
      .select("id")
      .single();
    // Otra corrida pudo crearla en el intermedio.
    if (created.error?.code === UNIQUE_VIOLATION) {
      const again = await find();
      if (again) return again;
    }
    return (unwrap(created, "crear la organización") as { id: string }).id;
  }

  async function freeSlug(base: string): Promise<string> {
    // Los slugs solo tienen [a-z0-9-], así que no hay comodines de LIKE que escapar.
    const rows = await fetchAll<{ slug: string }>(
      (from, to) => client.from("opportunities").select("slug").like("slug", `${base}%`).order("slug").range(from, to),
      "revisar los slugs existentes",
    );
    return uniqueSlug(
      base,
      rows.map((r) => r.slug),
    );
  }

  async function readOne(id: string): Promise<OpportunityRow | null> {
    const result: DbResult<unknown> = await client
      .from("opportunities")
      .select(OPPORTUNITY_SELECT)
      .eq("id", id)
      .maybeSingle();
    return unwrap(result, "leer la convocatoria") as OpportunityRow | null;
  }

  return {
    async listOpportunities() {
      const rows = await fetchAll<OpportunityRow>(
        (from, to) => client.from("opportunities").select(OPPORTUNITY_SELECT).order("id").range(from, to),
        "leer las convocatorias",
      );
      return rows.map(rowToStored);
    },

    async upsertOpportunity(candidate, options = {}) {
      const now = options.now ?? new Date().toISOString();
      const { organizationName, ...fields } = candidate;
      const previous = options.existingId ? await readOne(options.existingId) : null;
      if (options.existingId && !previous) throw new Error(`No existe la oportunidad ${options.existingId}`);

      const organizationId = await organizationIdFor(
        organizationName,
        companyWebsiteFromUrls(organizationName, [fields.applyUrl, fields.sources[0]?.url]),
      );
      let status = fields.status;
      const reviewNotes = [...(options.reviewNotes ?? [])];
      // Lo público exige organización y enlace (restricción `public_is_complete`).
      if (status === "vencida" && (!organizationId || !fields.applyUrl)) {
        status = "retirada";
        reviewNotes.push(INCOMPLETE_NOTE);
      }
      const columns = recordToColumns({
        ...fields,
        status,
        slug: previous?.slug ?? (await freeSlug(fields.slug)),
        organizationId,
        needsReview: options.needsReview ?? status === "en_revision",
        reviewNotes,
        dedupeHash: dedupeHash(organizationName, fields.title, fields.deadlineDate),
        publishedAt: previous?.published_at ?? (status === "publicada" ? now : null),
        lastVerifiedAt: now,
      });

      const written: DbResult<unknown> = previous
        ? await client.from("opportunities").update(columns).eq("id", previous.id).select("id").single()
        : await client.from("opportunities").insert(columns).select("id").single();
      const { id } = unwrap(written, previous ? "actualizar la convocatoria" : "crear la convocatoria") as { id: string };

      const relations = relationRows(id, fields);
      for (const table of RELATION_TABLES) {
        if (previous) {
          unwrap(await client.from(table).delete().eq("opportunity_id", id), `limpiar ${table}`);
        }
        const rows: Record<string, unknown>[] = relations[table];
        if (rows.length > 0) unwrap(await client.from(table).insert(rows), `guardar ${table}`);
      }

      const stored = await readOne(id);
      if (!stored) throw new Error(`La oportunidad ${id} no quedó guardada`);
      return rowToStored(stored);
    },

    async addSourceToOpportunity(id, sourceId, url, verifiedAt) {
      const existing: DbResult<unknown> = await client
        .from("opportunity_sources")
        .select("source_id, url, position")
        .eq("opportunity_id", id);
      const rows = (unwrap(existing, "leer las fuentes de la convocatoria") ?? []) as {
        source_id: string;
        url: string;
        position: number;
      }[];
      if (!rows.some((r) => r.source_id === sourceId && r.url === url)) {
        const position = rows.reduce((max, r) => Math.max(max, r.position + 1), 0);
        unwrap(
          await client.from("opportunity_sources").insert({ opportunity_id: id, source_id: sourceId, url, position }),
          "agregar la fuente a la convocatoria",
        );
      }
      const updated: DbResult<unknown> = await client
        .from("opportunities")
        .update({ last_verified_at: verifiedAt ?? new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (((unwrap(updated, "actualizar la fecha de verificación") ?? []) as unknown[]).length === 0) {
        throw new Error(`No existe la oportunidad ${id}`);
      }
    },

    async markSeen(sourceId, urls, seenAt) {
      const unique = [...new Set(urls)];
      const ids = new Set<string>();
      for (let i = 0; i < unique.length; i += SEEN_CHUNK) {
        const result: DbResult<unknown> = await client
          .from("opportunity_sources")
          .select("opportunity_id")
          .eq("source_id", sourceId)
          .in("url", unique.slice(i, i + SEEN_CHUNK));
        for (const row of (unwrap(result, "buscar las ofertas vistas") ?? []) as { opportunity_id: string }[]) {
          ids.add(row.opportunity_id);
        }
      }
      const all = [...ids];
      for (let i = 0; i < all.length; i += SEEN_CHUNK) {
        unwrap(
          await client
            .from("opportunities")
            .update({ last_verified_at: seenAt })
            .in("id", all.slice(i, i + SEEN_CHUNK)),
          "anotar las ofertas vistas",
        );
      }
      return all.length;
    },

    async hasRaw(sourceId, contentHash) {
      const result: DbResult<unknown> = await client
        .from("raw_items")
        .select("id")
        .eq("source_id", sourceId)
        .eq("content_hash", contentHash)
        .limit(1);
      return ((unwrap(result, "consultar los datos crudos") ?? []) as unknown[]).length > 0;
    },

    async saveRaw(raw, contentHash) {
      const result: DbResult<unknown> = await client
        .from("raw_items")
        .upsert(
          {
            source_id: raw.sourceId,
            external_id: raw.externalId,
            url: raw.url,
            payload: raw.payload,
            content_hash: contentHash,
            fetched_at: raw.fetchedAt,
          },
          { onConflict: "source_id,content_hash", ignoreDuplicates: true },
        )
        .select("id");
      // Con `ignoreDuplicates`, una fila que ya existía no se devuelve.
      return ((unwrap(result, "guardar el dato crudo") ?? []) as unknown[]).length > 0;
    },

    async recordRun(report: IngestionReport) {
      const finishedAt = Date.now();
      unwrap(
        await client.from("ingestion_runs").insert({
          source_id: report.sourceId,
          started_at: new Date(finishedAt - report.durationMs).toISOString(),
          report,
        }),
        "registrar la corrida",
      );
      unwrap(
        await client
          .from("sources")
          .update({
            last_run_at: new Date(finishedAt).toISOString(),
            last_run_status: report.errors.length > 0 ? "con_errores" : "ok",
            last_run_count: report.fetched,
          })
          .eq("id", report.sourceId),
        "actualizar la fuente",
      );
    },

    async ensureSources(sources) {
      if (sources.length === 0) return;
      unwrap(
        await client.from("sources").upsert(
          // Sin página propia conocida: apunta a /fuentes hasta que alguien registre la URL real.
          sources.map((s) => ({ id: s.id, name: s.name, method: s.method, url: "/fuentes" })),
          { onConflict: "id", ignoreDuplicates: true },
        ),
        "registrar las fuentes",
      );
    },

    async sourceNames() {
      const result: DbResult<unknown> = await client.from("sources").select("id, name");
      const rows = (unwrap(result, "leer las fuentes") ?? []) as { id: string; name: string }[];
      return new Map(rows.map((r) => [r.id, r.name]));
    },

    async setStatus(id, patch) {
      const result: DbResult<unknown> = await client
        .from("opportunities")
        .update({
          status: patch.status,
          ...(patch.needsReview === undefined ? {} : { needs_review: patch.needsReview }),
          ...(patch.publishedAt === undefined ? {} : { published_at: toIso(patch.publishedAt) }),
          ...(patch.lastVerifiedAt === undefined ? {} : { last_verified_at: toIso(patch.lastVerifiedAt) }),
        })
        .eq("id", id)
        .select("id");
      if (((unwrap(result, "cambiar el estado") ?? []) as unknown[]).length === 0) {
        throw new Error(`No existe la oportunidad ${id}`);
      }
    },
  };
}

/** Carga `.env.local` (si existe) sin pisar las variables que ya vengan del entorno. */
export function loadLocalEnv(path = ".env.local"): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

/** Abre el store con la configuración de `.env.local`. Lanza un error claro si falta algo. */
export function openSupabaseStore(): SupabaseStore {
  loadLocalEnv();
  return createSupabaseStore(createSupabaseAdminClient(readSupabaseEnv()));
}

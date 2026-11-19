/**
 * Repositorio sobre Supabase (Fase 1). Se activa con `USE_MOCKS=false` (ver `getRepository`).
 * Usa la clave secreta, así que SOLO corre en el servidor: nada de este archivo puede llegar al navegador.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpportunityRecord } from "@/server/domain/types";
import type { Repository } from "./index";
import {
  OPPORTUNITY_SELECT,
  PUBLIC_STATUSES,
  issueReportRowToRecord,
  organizationRowToRecord,
  rowToRecord,
  sourceRowToRecord,
  type IssueReportRow,
  type OpportunityRow,
  type OrganizationRow,
  type SourceRow,
} from "./supabase-mappers";
import { fetchAll, isUuid, unwrap, type DbResult } from "./supabase-shared";

/** Cuánto se reutiliza una lectura en memoria antes de volver a la base. */
export const DEFAULT_CACHE_TTL_MS = 45_000;

export interface SupabaseRepositoryOptions {
  cacheTtlMs?: number;
  /** Reloj inyectable para tests (milisegundos). */
  now?: () => number;
}

// Reloj monótono: no depende de la hora del sistema y Next lo permite durante el prerender (Date.now() no).
const monotonicNow = () => performance.now();

/** Caché de un solo valor con vencimiento. Varias peticiones simultáneas comparten la misma consulta. */
export function ttlCache<T>(load: () => Promise<T>, ttlMs: number, now: () => number = monotonicNow): () => Promise<T> {
  let entry: { value: Promise<T>; expiresAt: number } | null = null;
  return () => {
    if (entry && entry.expiresAt > now()) return entry.value;
    const current = { value: load(), expiresAt: now() + ttlMs };
    entry = current;
    // Un fallo no se guarda: la siguiente petición vuelve a intentar.
    current.value.catch(() => {
      if (entry === current) entry = null;
    });
    return current.value;
  };
}

export function createSupabaseRepository(client: SupabaseClient, options: SupabaseRepositoryOptions = {}): Repository {
  const ttl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const now = options.now ?? monotonicNow;

  const publicRecords = ttlCache(
    async () => {
      const rows = await fetchAll<OpportunityRow>(
        (from, to) =>
          client
            .from("opportunities")
            .select(OPPORTUNITY_SELECT)
            .in("status", [...PUBLIC_STATUSES])
            .order("id")
            .range(from, to),
        "leer las convocatorias publicadas",
      );
      return rows.map(rowToRecord);
    },
    ttl,
    now,
  );

  const organizations = ttlCache(
    async () => {
      const rows = await fetchAll<OrganizationRow>(
        (from, to) => client.from("organizations").select("id, name, sector, logo_url, website").order("id").range(from, to),
        "leer las organizaciones",
      );
      return rows.map(organizationRowToRecord);
    },
    ttl,
    now,
  );

  const sources = ttlCache(
    async () => {
      const rows = await fetchAll<SourceRow>(
        (from, to) =>
          client
            .from("sources")
            .select("id, name, url, method, last_run_at")
            .eq("enabled", true)
            .order("name")
            .range(from, to),
        "leer las fuentes",
      );
      return rows.map(sourceRowToRecord);
    },
    ttl,
    now,
  );

  async function findOne(column: "slug" | "id", value: string): Promise<OpportunityRecord | null> {
    const cached = (await publicRecords()).find((r) => r[column] === value);
    if (cached) return cached;
    // No está entre las públicas: puede no existir o estar en otro estado (quien llama decide si la muestra).
    const result: DbResult<unknown> = await client
      .from("opportunities")
      .select(OPPORTUNITY_SELECT)
      .eq(column, value)
      .maybeSingle();
    const row = unwrap(result, "leer la convocatoria") as OpportunityRow | null;
    return row ? rowToRecord(row) : null;
  }

  return {
    listPublicRecords: () => publicRecords(),
    getRecordBySlug: (slug) => findOne("slug", slug),
    // Un id que no es UUID no puede existir (y Postgres rechazaría la consulta).
    getRecordById: async (id) => (isUuid(id) ? findOne("id", id) : null),
    listOrganizations: () => organizations(),
    listSources: () => sources(),

    async insertIssueReport(report) {
      const result: DbResult<unknown> = await client
        .from("issue_reports")
        .insert({ opportunity_id: report.opportunityId, reason: report.reason, comment: report.comment })
        .select("id, opportunity_id, reason, comment, created_at")
        .single();
      return issueReportRowToRecord(unwrap(result, "guardar el reporte") as IssueReportRow);
    },
  };
}

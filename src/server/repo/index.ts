/**
 * Acceso a datos. Dos implementaciones con la misma interfaz:
 * - `memoryRepository`: datos de prueba (por defecto, `USE_MOCKS` distinto de "false").
 * - Supabase (`supabase.ts`): cuando `USE_MOCKS=false` y están `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
 */
import type { IssueReportRecord, OpportunityRecord, OrganizationRecord, SourceRecord } from "@/server/domain/types";
import type { OpportunityCandidate } from "../../../ingestion/types";
import { memoryRepository } from "./memory";
import { createSupabaseRepository } from "./supabase";
import { createSupabaseAdminClient, readSupabaseEnv, type SupabaseEnv } from "./supabase-shared";

export interface Repository {
  /** Registros visibles al público (publicada y vencida; los vencidos por fecha se filtran después). */
  listPublicRecords(): Promise<OpportunityRecord[]>;
  getRecordBySlug(slug: string): Promise<OpportunityRecord | null>;
  getRecordById(id: string): Promise<OpportunityRecord | null>;
  listOrganizations(): Promise<OrganizationRecord[]>;
  listSources(): Promise<SourceRecord[]>;
  insertIssueReport(report: Omit<IssueReportRecord, "id" | "createdAt">): Promise<IssueReportRecord>;

  // ---- Formulario «Publica tu práctica» ----
  /** Todas las convocatorias (cualquier estado), con lo justo para buscar duplicados. */
  listDedupeTargets(): Promise<DedupeTarget[]>;
  /** Envíos del formulario desde esa IP (hash) y con ese correo, desde las fechas dadas. */
  countRecentPublications(query: RecentPublicationsQuery): Promise<{ byIp: number; byEmail: number }>;
  /** Guarda la convocatoria en revisión y, aparte, el contacto privado de quien la envió. */
  savePublication(candidate: OpportunityCandidate, reviewNotes: string[], contact: PublicationContact): Promise<{ id: string }>;
}

export interface DedupeTarget {
  id: string;
  title: string;
  organizationName: string;
  deadlineDate: string | null;
}

export interface RecentPublicationsQuery {
  ipHash: string;
  email: string;
  /** ISO datetime. */
  ipSince: string;
  /** ISO datetime. */
  emailSince: string;
}

/** Datos privados de quien publica: nunca se muestran en el sitio. */
export interface PublicationContact {
  name: string;
  email: string;
  role: string;
  ipHash: string;
}

export function isMockMode(): boolean {
  return process.env.USE_MOCKS !== "false";
}

// Un solo cliente (y una sola caché) por proceso del servidor.
let supabaseRepository: Repository | null = null;

/** @throws si `USE_MOCKS=false` y faltan las variables de Supabase (mensaje en español, sin valores). */
export function getRepository(): Repository {
  if (isMockMode()) return memoryRepository;
  if (!supabaseRepository) {
    let env: SupabaseEnv;
    try {
      env = readSupabaseEnv();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`USE_MOCKS=false, pero no se puede usar Supabase. ${detail}`);
    }
    supabaseRepository = createSupabaseRepository(createSupabaseAdminClient(env));
  }
  return supabaseRepository;
}

/** Solo para tests: olvida el repositorio de Supabase ya creado. */
export function resetRepositoryForTests(): void {
  supabaseRepository = null;
}

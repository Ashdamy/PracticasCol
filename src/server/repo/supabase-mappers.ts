/**
 * Mapeo puro entre filas de Supabase (snake_case, supabase/migrations) y el modelo interno (`OpportunityRecord`).
 * Sin acceso a red: lo usan el repositorio (`supabase.ts`), el store de la ingesta y los tests.
 */
import type {
  CompensationType,
  DeadlineType,
  EducationLevel,
  Modality,
  OpportunityStatus,
  OpportunityType,
  Sector,
  SourceMethod,
} from "@/lib/contracts";
import type { IssueReportRecord, OpportunityRecord, OrganizationRecord, SourceRecord } from "@/server/domain/types";

/** Columnas propias de `opportunities` (sin relaciones). */
export interface OpportunityColumns {
  slug: string;
  title: string;
  organization_id: string | null;
  type: OpportunityType;
  levels: EducationLevel[];
  municipality_slug: string | null;
  modality: Modality;
  compensation_type: CompensationType;
  compensation_amount_cop: number | null;
  duration_months_min: number | null;
  duration_months_max: number | null;
  deadline_type: DeadlineType;
  deadline_date: string | null;
  start_date: string | null;
  description: string;
  open_to_all_programs: boolean;
  accepts_related_programs: boolean;
  semester_min: number | null;
  semester_max: number | null;
  accepts_graduates: boolean | null;
  restricted_to_institutions: boolean;
  other_requirements: string[];
  apply_url: string;
  status: OpportunityStatus;
  needs_review: boolean;
  review_notes: string[];
  dedupe_hash: string | null;
  published_at: string | null;
  last_verified_at: string;
}

/** Fila tal como la devuelve `OPPORTUNITY_SELECT`. */
export interface OpportunityRow extends OpportunityColumns {
  id: string;
  first_seen_at: string;
  opportunity_programs?: { program_id: string }[] | null;
  opportunity_knowledge_areas?: { knowledge_area_id: string }[] | null;
  opportunity_institutions?: { institution_id: string }[] | null;
  opportunity_sources?: { source_id: string; url: string; position: number }[] | null;
  organizations?: { name: string } | null;
}

/** Una sola consulta trae la oportunidad con todas sus relaciones (PostgREST las anida por llave foránea). */
export const OPPORTUNITY_SELECT =
  "*, organizations(name), opportunity_programs(program_id), opportunity_knowledge_areas(knowledge_area_id), " +
  "opportunity_institutions(institution_id), opportunity_sources(source_id, url, position)";

export const PUBLIC_STATUSES: readonly OpportunityStatus[] = ["publicada", "vencida"];

/** Postgres devuelve `2026-11-16T15:00:00+00:00`; el resto del código espera ISO con `Z`. */
export function toIso(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toISOString();
}

export function rowToRecord(row: OpportunityRow): OpportunityRecord {
  const sources = [...(row.opportunity_sources ?? [])]
    .sort((a, b) => a.position - b.position || a.source_id.localeCompare(b.source_id) || a.url.localeCompare(b.url))
    .map((s) => ({ sourceId: s.source_id, url: s.url }));
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    organizationId: row.organization_id ?? "",
    type: row.type,
    levels: row.levels ?? [],
    municipalitySlug: row.municipality_slug,
    modality: row.modality,
    compensationType: row.compensation_type,
    compensationAmountCop: row.compensation_amount_cop,
    durationMonthsMin: row.duration_months_min,
    durationMonthsMax: row.duration_months_max,
    deadlineType: row.deadline_type,
    deadlineDate: row.deadline_type === "fecha" ? row.deadline_date : null,
    startDate: row.start_date,
    description: row.description ?? "",
    openToAllPrograms: row.open_to_all_programs,
    programIds: (row.opportunity_programs ?? []).map((p) => p.program_id).sort(),
    knowledgeAreaIds: (row.opportunity_knowledge_areas ?? []).map((a) => a.knowledge_area_id).sort(),
    acceptsRelatedPrograms: row.accepts_related_programs,
    semesterMin: row.semester_min,
    semesterMax: row.semester_max,
    acceptsGraduates: row.accepts_graduates,
    // `null` = abierta a cualquier institución; una lista (aunque vacía) = restringida.
    institutionIds: row.restricted_to_institutions
      ? (row.opportunity_institutions ?? []).map((i) => i.institution_id).sort()
      : null,
    otherRequirements: row.other_requirements ?? [],
    applyUrl: row.apply_url ?? "",
    sources,
    status: row.status,
    // Lo que nunca se ha publicado no tiene `published_at`: se usa la fecha en que se vio por primera vez.
    publishedAt: toIso(row.published_at ?? row.first_seen_at),
    lastVerifiedAt: toIso(row.last_verified_at),
  };
}

/** Datos de una oportunidad listos para escribir (lo que no está en `OpportunityRecord` va aparte). */
export interface OpportunityWrite
  extends Omit<OpportunityRecord, "id" | "organizationId" | "publishedAt" | "lastVerifiedAt"> {
  organizationId: string | null;
  needsReview: boolean;
  reviewNotes: string[];
  dedupeHash: string | null;
  /** `null` mientras no se haya publicado. */
  publishedAt: string | null;
  lastVerifiedAt: string;
}

export function recordToColumns(record: OpportunityWrite): OpportunityColumns {
  // La tabla exige coherencia: hay fecha si y solo si el tipo es `fecha`.
  const hasDate = record.deadlineType === "fecha" && !!record.deadlineDate;
  return {
    slug: record.slug,
    title: record.title,
    organization_id: record.organizationId || null,
    type: record.type,
    levels: [...record.levels],
    municipality_slug: record.municipalitySlug,
    modality: record.modality,
    compensation_type: record.compensationType,
    compensation_amount_cop: record.compensationAmountCop,
    duration_months_min: record.durationMonthsMin,
    duration_months_max: record.durationMonthsMax,
    deadline_type: record.deadlineType === "fecha" && !hasDate ? "no_publicada" : record.deadlineType,
    deadline_date: hasDate ? record.deadlineDate : null,
    start_date: record.startDate,
    description: record.description,
    open_to_all_programs: record.openToAllPrograms,
    accepts_related_programs: record.acceptsRelatedPrograms,
    semester_min: record.semesterMin,
    semester_max: record.semesterMax,
    accepts_graduates: record.acceptsGraduates,
    restricted_to_institutions: record.institutionIds !== null,
    other_requirements: [...record.otherRequirements],
    apply_url: record.applyUrl,
    status: record.status,
    needs_review: record.needsReview,
    review_notes: [...record.reviewNotes],
    dedupe_hash: record.dedupeHash,
    published_at: record.publishedAt,
    last_verified_at: record.lastVerifiedAt,
  };
}

export interface RelationRows {
  opportunity_programs: { opportunity_id: string; program_id: string }[];
  opportunity_knowledge_areas: { opportunity_id: string; knowledge_area_id: string }[];
  opportunity_institutions: { opportunity_id: string; institution_id: string }[];
  opportunity_sources: { opportunity_id: string; source_id: string; url: string; position: number }[];
}

export const RELATION_TABLES = [
  "opportunity_programs",
  "opportunity_knowledge_areas",
  "opportunity_institutions",
  "opportunity_sources",
] as const satisfies readonly (keyof RelationRows)[];

/** Filas de las tablas de relación. Quita repetidos; la primera fuente queda en la posición 0 (principal). */
export function relationRows(
  opportunityId: string,
  record: Pick<OpportunityRecord, "programIds" | "knowledgeAreaIds" | "institutionIds" | "sources">,
): RelationRows {
  const unique = (ids: readonly string[]) => [...new Set(ids)];
  const seen = new Set<string>();
  const sources = record.sources.filter((s) => {
    const key = `${s.sourceId}\n${s.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    opportunity_programs: unique(record.programIds).map((program_id) => ({ opportunity_id: opportunityId, program_id })),
    opportunity_knowledge_areas: unique(record.knowledgeAreaIds).map((knowledge_area_id) => ({
      opportunity_id: opportunityId,
      knowledge_area_id,
    })),
    opportunity_institutions: unique(record.institutionIds ?? []).map((institution_id) => ({
      opportunity_id: opportunityId,
      institution_id,
    })),
    opportunity_sources: sources.map((s, position) => ({
      opportunity_id: opportunityId,
      source_id: s.sourceId,
      url: s.url,
      position,
    })),
  };
}

export interface OrganizationRow {
  id: string;
  name: string;
  sector: Sector;
  logo_url: string | null;
}

export function organizationRowToRecord(row: OrganizationRow): OrganizationRecord {
  return { id: row.id, name: row.name, sector: row.sector, logoUrl: row.logo_url };
}

export interface SourceRow {
  id: string;
  name: string;
  url: string;
  method: SourceMethod;
  last_run_at: string | null;
}

export function sourceRowToRecord(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    method: row.method,
    lastRunAt: row.last_run_at ? toIso(row.last_run_at) : null,
  };
}

export interface IssueReportRow {
  id: string;
  opportunity_id: string;
  reason: string;
  comment: string | null;
  created_at: string;
}

export function issueReportRowToRecord(row: IssueReportRow): IssueReportRecord {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    reason: row.reason,
    comment: row.comment,
    createdAt: toIso(row.created_at),
  };
}

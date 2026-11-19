/**
 * Modelo interno (forma de almacenamiento). La UI NUNCA usa estos tipos: usa los de "@/lib/contracts".
 * Refleja las tablas de supabase/migrations (AGENTS.md §13).
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

export interface OrganizationRecord {
  id: string;
  name: string;
  sector: Sector;
  logoUrl: string | null;
  /** Sitio web (dominio). De aquí sale el logo de Brandfetch cuando no hay `logoUrl` explícito. */
  website?: string | null;
}

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  method: SourceMethod;
  lastRunAt: string | null;
}

export interface OpportunityRecord {
  id: string;
  slug: string;
  title: string;
  organizationId: string;
  type: OpportunityType;
  levels: EducationLevel[];
  municipalitySlug: string | null;
  modality: Modality;
  compensationType: CompensationType;
  compensationAmountCop: number | null;
  durationMonthsMin: number | null;
  durationMonthsMax: number | null;
  deadlineType: DeadlineType;
  deadlineDate: string | null;
  startDate: string | null;
  description: string;
  // Requisitos
  openToAllPrograms: boolean;
  programIds: string[];
  knowledgeAreaIds: string[];
  acceptsRelatedPrograms: boolean;
  semesterMin: number | null;
  semesterMax: number | null;
  acceptsGraduates: boolean | null;
  institutionIds: string[] | null;
  otherRequirements: string[];
  // Trazabilidad
  applyUrl: string;
  /** La primera es la fuente principal. */
  sources: { sourceId: string; url: string }[];
  status: OpportunityStatus;
  publishedAt: string;
  lastVerifiedAt: string;
}

export interface IssueReportRecord {
  id: string;
  opportunityId: string;
  reason: string;
  comment: string | null;
  createdAt: string;
}

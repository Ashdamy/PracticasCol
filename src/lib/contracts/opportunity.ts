import type {
  CompensationType,
  DeadlineType,
  EducationLevel,
  EligibilityVerdict,
  Modality,
  OpportunityStatus,
  OpportunityType,
  Sector,
  SourceMethod,
} from "./enums";
import type { EligibilityResult } from "./eligibility";

/** Opción genérica para selects y facetas. */
export interface Option {
  value: string;
  label: string;
}

export interface FacetOption extends Option {
  count: number;
}

export interface OrganizationSummary {
  name: string;
  logoUrl: string | null;
  sector: Sector;
}

export interface MunicipalityRef {
  slug: string;
  name: string;
}

export interface Compensation {
  type: CompensationType;
  /** Monto mensual en pesos colombianos, si se publicó. */
  amountCop: number | null;
}

export interface DeadlineInfo {
  type: DeadlineType;
  /** Fecha ISO `yyyy-mm-dd` (hora de Colombia). Solo cuando `type === "fecha"`. */
  date: string | null;
  /** Días que faltan (0 = cierra hoy, negativo = ya cerró). `null` si no hay fecha. */
  daysLeft: number | null;
}

/** Datos de una tarjeta en listados (AGENTS.md §11). */
export interface OpportunityCard {
  id: string;
  slug: string;
  title: string;
  organization: OrganizationSummary;
  type: OpportunityType;
  levels: EducationLevel[];
  /** `null` cuando es 100% remota o no se publicó el municipio. */
  municipality: MunicipalityRef | null;
  modality: Modality;
  compensation: Compensation;
  durationMonths: { min: number; max: number } | null;
  deadline: DeadlineInfo;
  /**
   * Fuente principal. `url` es la página de esa fuente donde se encontró la convocatoria
   * (no es el enlace de postulación; ese es `applyUrl` en el detalle).
   */
  source: { name: string; url: string };
  /** ISO datetime de la última verificación humana o automática. */
  lastVerifiedAt: string;
  /** true si no se verifica hace más de `STALE_AFTER_DAYS` días. */
  isStale: boolean;
  /** `null` si no hay perfil del estudiante. */
  eligibility: { verdict: EligibilityVerdict } | null;
}

export interface OpportunityRequirements {
  semesterMin: number | null;
  semesterMax: number | null;
  /** Programas mencionados explícitamente. Vacío = no especifica. */
  programs: { id: string; name: string }[];
  /** La convocatoria dice "y afines". */
  acceptsRelatedPrograms: boolean;
  /** `null` = abierta a cualquier institución. */
  institutions: { id: string; name: string }[] | null;
  /** Requisitos en texto libre (idioma, promedio, disponibilidad…). */
  other: string[];
}

export interface OpportunityDetail extends Omit<OpportunityCard, "eligibility"> {
  /** Resumen propio (no copia íntegra de la fuente). Texto plano con saltos de línea. */
  description: string;
  requirements: OpportunityRequirements;
  /** ISO `yyyy-mm-dd` o null. */
  startDate: string | null;
  /** Enlace oficial donde se postula. */
  applyUrl: string;
  /** Página donde se encontró la convocatoria. */
  sourceUrl: string;
  /** `publicada` o `vencida` (las `retirada` no se exponen). */
  status: OpportunityStatus;
  /** Todas las fuentes donde se encontró (tras deduplicar). */
  sources: { name: string; url: string }[];
  publishedAt: string;
  eligibility: EligibilityResult | null;
}

export interface SourceSummary {
  name: string;
  url: string;
  method: SourceMethod;
  lastRunAt: string | null;
  activeCount: number;
}

export interface HomeData {
  closingSoon: OpportunityCard[];
  recent: OpportunityCard[];
  totals: { active: number; sources: number; organizations: number };
}

export interface FilterOptions {
  institutions: (Option & { levels: EducationLevel[] })[];
  programs: (Option & { level: EducationLevel; knowledgeAreaId: string; institutionIds: string[] })[];
  municipalities: Option[];
  types: Option[];
  levels: Option[];
  modalities: Option[];
}

/** Días sin verificar a partir de los cuales una oferta se marca como posiblemente desactualizada. */
export const STALE_AFTER_DAYS = 14;

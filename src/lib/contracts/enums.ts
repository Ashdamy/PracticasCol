/**
 * Enums del dominio (AGENTS.md §5).
 * Los valores van en español snake_case y son estables: se guardan en BD y viajan en la URL.
 * Las etiquetas para UI viven en `src/lib/catalog/labels.ts`.
 */
import { z } from "zod";

export const OPPORTUNITY_TYPES = [
  "practica_profesional",
  "practica_empresarial",
  "pasantia",
  "contrato_aprendizaje",
  "judicatura",
] as const;
export const OpportunityTypeSchema = z.enum(OPPORTUNITY_TYPES);
export type OpportunityType = z.infer<typeof OpportunityTypeSchema>;

export const EDUCATION_LEVELS = [
  "tecnico_laboral",
  "tecnico_profesional",
  "tecnologo",
  "universitario",
  "posgrado",
] as const;
export const EducationLevelSchema = z.enum(EDUCATION_LEVELS);
export type EducationLevel = z.infer<typeof EducationLevelSchema>;

/** `no_especificada`: la fuente no dice la modalidad (se muestra «Modalidad desconocida»; nunca se asume presencial). */
export const MODALITIES = ["presencial", "hibrida", "remota", "no_especificada"] as const;
export const ModalitySchema = z.enum(MODALITIES);
export type Modality = z.infer<typeof ModalitySchema>;

export const SECTORS = ["privado", "publico", "mixto", "ong"] as const;
export const SectorSchema = z.enum(SECTORS);
export type Sector = z.infer<typeof SectorSchema>;

export const COMPENSATION_TYPES = [
  "salario",
  "apoyo_sostenimiento",
  "auxilio",
  "sin_remuneracion",
  "no_especificado",
] as const;
export const CompensationTypeSchema = z.enum(COMPENSATION_TYPES);
export type CompensationType = z.infer<typeof CompensationTypeSchema>;

/** Tipos de compensación que cuentan como "con apoyo económico" (filtro `remunerada=1`). */
export const PAID_COMPENSATION_TYPES: readonly CompensationType[] = [
  "salario",
  "apoyo_sostenimiento",
  "auxilio",
];

export const DEADLINE_TYPES = ["fecha", "hasta_agotar_cupos", "no_publicada"] as const;
export const DeadlineTypeSchema = z.enum(DEADLINE_TYPES);
export type DeadlineType = z.infer<typeof DeadlineTypeSchema>;

export const OPPORTUNITY_STATUSES = [
  "borrador",
  "en_revision",
  "publicada",
  "vencida",
  "retirada",
] as const;
export const OpportunityStatusSchema = z.enum(OPPORTUNITY_STATUSES);
export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>;

export const SOURCE_METHODS = ["api", "scraping", "manual"] as const;
export const SourceMethodSchema = z.enum(SOURCE_METHODS);
export type SourceMethod = z.infer<typeof SourceMethodSchema>;

export const SORT_OPTIONS = ["relevancia", "cierre", "recientes"] as const;
export const SortOptionSchema = z.enum(SORT_OPTIONS);
export type SortOption = z.infer<typeof SortOptionSchema>;

export const ISSUE_REASONS = [
  "vencida",
  "enlace_roto",
  "datos_incorrectos",
  "sospechosa",
  "otro",
] as const;
export const IssueReasonSchema = z.enum(ISSUE_REASONS);
export type IssueReason = z.infer<typeof IssueReasonSchema>;

// ---- Elegibilidad ----
export const ELIGIBILITY_VERDICTS = ["cumple", "revisar", "no_cumple", "sin_perfil"] as const;
export type EligibilityVerdict = (typeof ELIGIBILITY_VERDICTS)[number];

export const ELIGIBILITY_CRITERIA = [
  "nivel",
  "programa",
  "semestre",
  "institucion",
  "fecha_limite",
  "otros",
] as const;
export type EligibilityCriterion = (typeof ELIGIBILITY_CRITERIA)[number];

export const CHECK_STATUSES = ["cumple", "no_cumple", "desconocido", "verificar"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

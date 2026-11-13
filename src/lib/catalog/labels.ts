/**
 * Etiquetas en español por defecto para los enums del dominio.
 * Codex puede usarlas tal cual o definir sus propias variantes (cortas, plurales) en src/lib/format.
 */
import type {
  CompensationType,
  DeadlineType,
  EducationLevel,
  IssueReason,
  Modality,
  OpportunityStatus,
  OpportunityType,
  Sector,
  SortOption,
  SourceMethod,
} from "@/lib/contracts";

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  practica_profesional: "Práctica profesional",
  practica_empresarial: "Práctica empresarial",
  pasantia: "Pasantía",
  contrato_aprendizaje: "Contrato de aprendizaje",
  judicatura: "Judicatura",
};

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  tecnico_laboral: "Técnico laboral",
  tecnico_profesional: "Técnico profesional",
  tecnologo: "Tecnólogo",
  universitario: "Universitario (pregrado)",
  posgrado: "Posgrado",
};

export const MODALITY_LABELS: Record<Modality, string> = {
  presencial: "Presencial",
  hibrida: "Híbrida",
  remota: "Remota",
};

export const SECTOR_LABELS: Record<Sector, string> = {
  privado: "Privado",
  publico: "Público",
  mixto: "Mixto",
  ong: "ONG / Fundación",
};

export const COMPENSATION_TYPE_LABELS: Record<CompensationType, string> = {
  salario: "Salario",
  apoyo_sostenimiento: "Apoyo de sostenimiento",
  auxilio: "Auxilio económico",
  sin_remuneracion: "Sin remuneración",
  no_especificado: "No especificado",
};

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  fecha: "Fecha límite",
  hasta_agotar_cupos: "Hasta agotar cupos",
  no_publicada: "Fecha no publicada",
};

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  publicada: "Publicada",
  vencida: "Vencida",
  retirada: "Retirada",
};

export const SORT_LABELS: Record<SortOption, string> = {
  relevancia: "Más relevantes",
  cierre: "Cierran primero",
  recientes: "Más recientes",
};

export const SOURCE_METHOD_LABELS: Record<SourceMethod, string> = {
  api: "Conexión oficial (API/feed)",
  scraping: "Lectura automática de página pública",
  manual: "Revisión manual del equipo",
};

export const ISSUE_REASON_LABELS: Record<IssueReason, string> = {
  vencida: "Ya cerró",
  enlace_roto: "El enlace no funciona",
  datos_incorrectos: "Hay datos incorrectos",
  sospechosa: "Parece sospechosa o fraudulenta",
  otro: "Otro motivo",
};

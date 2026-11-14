/**
 * Borrador de una fuente → oportunidad normalizada.
 * Regla de publicación (AGENTS.md §12): todo queda `en_revision` salvo que la fuente tenga `autoPublish`,
 * los campos críticos tengan confianza alta y no haya ninguna observación.
 */
import type { OpportunityStatus } from "@/lib/contracts";
import { getProgram } from "@/lib/catalog/academic";
import { EDUCATION_LEVELS } from "@/lib/contracts";
import type { Confidence, Normalized, OpportunityCandidate, OpportunityDraft } from "../types";
import { normalizeCompensation } from "./compensation";
import { normalizeDate, normalizeDeadline } from "./dates";
import { normalizeDuration } from "./duration";
import { normalizeMunicipality } from "./geo";
import { normalizeInstitutions } from "./institutions";
import { normalizeLevels } from "./levels";
import { normalizeModality } from "./modality";
import { normalizePrograms } from "./programs";
import { normalizeSemester } from "./semester";
import { clean, isBlank, lowest, result } from "./text";
import { normalizeOpportunityType } from "./type";

export * from "./compensation";
export * from "./dates";
export * from "./duration";
export * from "./geo";
export * from "./institutions";
export * from "./levels";
export * from "./modality";
export * from "./programs";
export * from "./semester";
export * from "./type";

export const MAX_DESCRIPTION_LENGTH = 600;
export const MAX_REQUIREMENTS = 8;
export const MAX_SLUG_LENGTH = 80;
const MAX_TITLE_LENGTH = 160;

export interface NormalizeOptions {
  /** Hoy en Colombia, `yyyy-mm-dd`. */
  today: string;
  sourceId: string;
  autoPublish?: boolean;
}

export interface NormalizedDraft {
  candidate: OpportunityCandidate;
  /** Observaciones para la revisión humana. Con al menos una, no se publica solo. */
  issues: string[];
  /** La menor confianza entre todos los campos. */
  confidence: Confidence;
  needsReview: boolean;
  fieldConfidence: Record<string, Confidence>;
}

/** Campos sin los que una oportunidad no se puede publicar sin revisión. */
export const CRITICAL_FIELDS = ["title", "organizationName", "applyUrl", "type", "levels", "deadline"] as const;

export function slugify(text: string, maxLength = MAX_SLUG_LENGTH): string {
  const slug = clean(text).replace(/ñ/g, "n").replace(/ /g, "-");
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");
  return (slug[maxLength] === "-" || lastDash <= 0 ? cut : cut.slice(0, lastDash)).replace(/-+$/, "");
}

/** Resumen propio: recorta en límite de palabra (no se copian descripciones largas de la fuente). */
export function summarize(text: string | null | undefined, maxLength = MAX_DESCRIPTION_LENGTH): string {
  if (isBlank(text)) return "";
  const tidy = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (tidy.length <= maxLength) return tidy;
  const cut = tidy.slice(0, maxLength - 1);
  const lastSpace = cut.search(/\s\S*$/);
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** Requisitos en texto libre → lista limpia, sin duplicados. */
export function splitRequirements(text: string | null | undefined, max = MAX_REQUIREMENTS): string[] {
  if (isBlank(text)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of text.split(/[\n;]/)) {
    const item = part
      .replace(/^\s*(?:[-–—•·*]+|\d{1,2}[.)])\s*/, "")
      .replace(/\s+/g, " ")
      .replace(/[.\s]+$/, "")
      .trim();
    const key = clean(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items.slice(0, max);
}

function parseUrl(value: string | null | undefined): URL | null {
  if (isBlank(value)) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function tidyLine(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeDraft(draft: OpportunityDraft, options: NormalizeOptions): NormalizedDraft {
  const { today, sourceId, autoPublish = false } = options;
  const issues: string[] = [];
  const fieldConfidence: Record<string, Confidence> = {};

  /** Registra la confianza del campo; cualquier nota o confianza no alta queda como observación. */
  function take<T>(field: string, label: string, normalized: Normalized<T>): T {
    fieldConfidence[field] = normalized.confidence;
    if (normalized.note) issues.push(`${label}: ${normalized.note}`);
    else if (normalized.confidence !== "alta") issues.push(`${label}: confianza ${normalized.confidence}`);
    return normalized.value;
  }

  // ---- Identidad ----
  let title = tidyLine(draft.title);
  if (title.length > MAX_TITLE_LENGTH) {
    title = take("title", "Título", result(summarize(title, MAX_TITLE_LENGTH), "media", "se recortó por largo"));
  } else {
    take("title", "Título", title ? result(title, "alta") : result(title, "baja", "falta el título"));
  }
  const organizationName = tidyLine(draft.organizationName);
  take(
    "organizationName",
    "Organización",
    organizationName ? result(organizationName, "alta") : result("", "baja", "falta la organización"),
  );

  // ---- Enlaces ----
  const apply = parseUrl(draft.applyUrl);
  const source = parseUrl(draft.sourceUrl);
  let applyUrl: string;
  if (apply?.protocol === "https:") applyUrl = take("applyUrl", "Enlace de postulación", result(apply.href, "alta"));
  else if (apply) {
    applyUrl = take("applyUrl", "Enlace de postulación", result(apply.href, "baja", "no usa https"));
  } else if (source) {
    applyUrl = take(
      "applyUrl",
      "Enlace de postulación",
      result(source.href, "media", "falta o es inválido: se usó el enlace de la fuente"),
    );
  } else {
    applyUrl = take("applyUrl", "Enlace de postulación", result("", "baja", "falta o es inválido"));
  }
  const sourceUrl = (source ?? apply)?.href ?? "";

  // ---- Clasificación ----
  const type = take("type", "Tipo", normalizeOpportunityType(draft.typeText, draft.title)) ?? "practica_profesional";

  const programs = take("programs", "Programas", normalizePrograms(draft.programsText));

  let levelsResult = normalizeLevels(draft.levelText);
  if (isBlank(draft.levelText) && programs.programIds.length > 0) {
    const inferred = new Set(programs.programIds.map((id) => getProgram(id)?.level));
    levelsResult = result(
      EDUCATION_LEVELS.filter((l) => inferred.has(l)),
      "media",
      "no indicado: se dedujo de los programas",
    );
  }
  const levels = take("levels", "Nivel", levelsResult);

  // ---- Lugar y modalidad ----
  const municipalityResult = normalizeMunicipality(draft.municipalityText);
  const modalityResult =
    isBlank(draft.modalityText) && municipalityResult.value.remote
      ? result("remota" as const, "alta")
      : normalizeModality(draft.modalityText);
  const modality = take("modality", "Modalidad", modalityResult);
  // Una oferta remota no necesita municipio.
  const municipalityOptional =
    modality === "remota" && (isBlank(draft.municipalityText) || municipalityResult.value.remote);
  const municipalitySlug = take(
    "municipality",
    "Municipio",
    municipalityOptional && municipalityResult.value.slug === null
      ? result({ slug: null, remote: true }, "alta")
      : municipalityResult,
  ).slug;

  // ---- Condiciones ----
  const compensation = take("compensation", "Pago", normalizeCompensation(draft.compensationText));
  const duration = take("duration", "Duración", normalizeDuration(draft.durationText));
  const deadline = take("deadline", "Fecha límite", normalizeDeadline(draft.deadlineText, today));
  const startDate = take("startDate", "Fecha de inicio", normalizeDate(draft.startDateText, today));
  const semester = take("semester", "Semestre", normalizeSemester(draft.semesterText));
  const institutionIds = take("institutions", "Instituciones", normalizeInstitutions(draft.institutionsText));

  const description = summarize(draft.description);
  take("description", "Descripción", description ? result(description, "alta") : result("", "media", "falta la descripción"));

  // ---- Estado ----
  const expired = deadline.type === "fecha" && deadline.date !== null && deadline.date < today;
  if (expired) issues.push(`Fecha límite: ya pasó (${deadline.date})`);

  const criticalOk = CRITICAL_FIELDS.every((field) => fieldConfidence[field] === "alta");
  let status: OpportunityStatus = "en_revision";
  if (expired) status = "vencida";
  else if (autoPublish && criticalOk && issues.length === 0) status = "publicada";

  let confidence = lowest(...Object.values(fieldConfidence));
  if (issues.length > 0) confidence = lowest(confidence, "media");

  const candidate: OpportunityCandidate = {
    slug: slugify(`${title} ${organizationName}`) || "convocatoria",
    title,
    organizationName,
    type,
    levels,
    municipalitySlug,
    modality,
    compensationType: compensation.type,
    compensationAmountCop: compensation.amountCop,
    durationMonthsMin: duration?.min ?? null,
    durationMonthsMax: duration?.max ?? null,
    deadlineType: deadline.type,
    deadlineDate: deadline.date,
    startDate,
    description,
    openToAllPrograms: programs.openToAllPrograms,
    programIds: programs.programIds,
    knowledgeAreaIds: programs.knowledgeAreaIds,
    acceptsRelatedPrograms: programs.acceptsRelatedPrograms,
    semesterMin: semester.min,
    semesterMax: semester.max,
    acceptsGraduates: semester.acceptsGraduates,
    institutionIds,
    otherRequirements: splitRequirements(draft.requirementsText),
    applyUrl,
    sources: [{ sourceId, url: sourceUrl }],
    status,
  };

  return { candidate, issues, confidence, needsReview: status === "en_revision", fieldConfidence };
}

/**
 * Reglas puras del formulario «Publica tu práctica»: antispam, validación contra el catálogo, armado de la
 * convocatoria y observaciones para la revisión. Sin red ni base de datos, para poder probarlas.
 */
import { createHmac } from "node:crypto";
import { PAID_COMPENSATION_TYPES, type PublishOpportunity } from "@/lib/contracts";
import { getProgram } from "@/lib/catalog/academic";
import { getMunicipality } from "@/lib/catalog/geo";
import { slugify } from "../../../ingestion/normalize";
import { clean } from "../../../ingestion/normalize/text";
import type { OpportunityCandidate } from "../../../ingestion/types";

export const PUBLICATION_SOURCE_ID = "src-publicacion-directa";
/** Envíos más rápidos que esto (desde que se mostró el formulario) se tratan como bot. */
export const MIN_FILL_MS = 3000;
/** Un formulario abierto hace más de un día se considera viejo: hay que recargarlo. */
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
/** Límites de envíos. */
export const MAX_PER_IP_PER_HOUR = 5;
export const MAX_PER_EMAIL_PER_DAY = 10;

// ---------------------------------------------------------------------------
// Antispam
// ---------------------------------------------------------------------------

export type BotSignal = "trampa" | "muy_rapido" | "formulario_viejo";

export function botSignal(input: Pick<PublishOpportunity, "trap" | "startedAt">, nowMs: number): BotSignal | null {
  if (input.trap.trim() !== "") return "trampa";
  const elapsed = nowMs - input.startedAt;
  if (elapsed < MIN_FILL_MS) return "muy_rapido";
  if (elapsed > MAX_FORM_AGE_MS) return "formulario_viejo";
  return null;
}

/** HMAC de la IP: permite contar envíos repetidos sin guardar la IP. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret || "practicascol-dev").update(ip.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/** Primera IP de `x-forwarded-for` (la del cliente en Vercel), o la de `x-real-ip`. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "desconocida";
}

// ---------------------------------------------------------------------------
// Validación contra el catálogo y la fecha
// ---------------------------------------------------------------------------

/** Errores por campo que el esquema no puede saber (catálogo y fecha de hoy). Vacío = todo bien. */
export function catalogErrors(input: PublishOpportunity, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.municipality && !getMunicipality(input.municipality)) {
    errors.municipality = "Ese municipio no está en la lista";
  }
  const unknownPrograms = input.programIds.filter((id) => !getProgram(id));
  if (unknownPrograms.length > 0) errors.programIds = "Hay programas que no están en la lista";
  if (input.deadlineType === "fecha" && input.deadlineDate && input.deadlineDate < today) {
    errors.deadlineDate = "La fecha de cierre ya pasó";
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Convocatoria
// ---------------------------------------------------------------------------

export function buildCandidate(input: PublishOpportunity): OpportunityCandidate {
  const programs = input.programIds.map((id) => getProgram(id)).filter((p) => p !== undefined);
  const paid = (PAID_COMPENSATION_TYPES as readonly string[]).includes(input.compensationType);
  const knowledgeAreaIds = input.acceptsRelatedPrograms ? [...new Set(programs.map((p) => p.knowledgeAreaId))] : [];
  return {
    slug: slugify(`${input.title} ${input.organizationName}`) || "convocatoria",
    title: input.title,
    organizationName: input.organizationName,
    type: input.type,
    levels: [...new Set(input.levels)],
    municipalitySlug: input.municipality,
    modality: input.modality,
    compensationType: input.compensationType,
    compensationAmountCop: paid && input.compensationAmountCop ? input.compensationAmountCop : null,
    durationMonthsMin: input.durationMonths,
    durationMonthsMax: input.durationMonths,
    deadlineType: input.deadlineType,
    deadlineDate: input.deadlineType === "fecha" ? input.deadlineDate : null,
    startDate: input.startDate,
    description: input.description,
    openToAllPrograms: programs.length === 0,
    programIds: programs.map((p) => p.id),
    knowledgeAreaIds,
    acceptsRelatedPrograms: input.acceptsRelatedPrograms && programs.length > 0,
    semesterMin: input.semesterMin,
    semesterMax: input.semesterMax,
    acceptsGraduates: null,
    institutionIds: null,
    otherRequirements: input.requirements,
    applyUrl: input.applyUrl,
    sources: [{ sourceId: PUBLICATION_SOURCE_ID, url: input.applyUrl }],
    status: "en_revision",
  };
}

// ---------------------------------------------------------------------------
// Observaciones para quien revisa
// ---------------------------------------------------------------------------

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "hotmail.es",
  "outlook.com",
  "outlook.es",
  "live.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
]);

const RISKY_LINK_DOMAINS = ["bit.ly", "tinyurl.com", "cutt.ly", "wa.me", "whatsapp.com", "t.me", "linktr.ee"];

/** Señales de cobro: una práctica nunca le cobra al estudiante. */
const PAYMENT_RE =
  /\b(pagar|pago de (la )?inscripcion|costo de (la )?inscripcion|cuota|consignar|consignacion|deposito|inversion inicial|matricula|valor del curso|curso previo|kit de)\b/;

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Observaciones para la revisión humana. Empiezan por «⚠» las que piden mirar con cuidado.
 * Nunca incluyen el correo ni el nombre del contacto: `review_notes` vive en la tabla de convocatorias.
 */
export function reviewNotesFor(input: PublishOpportunity): string[] {
  const notes = ["Enviada por el formulario «Publica tu práctica»: verifica la oferta antes de aprobarla (contacto en «ver»)"];
  const emailDomain = input.contactEmail.split("@")[1]?.toLowerCase() ?? "";
  const linkDomain = domainOf(input.applyUrl) ?? "";

  if (FREE_EMAIL_DOMAINS.has(emailDomain)) {
    notes.push("⚠ El contacto usa un correo personal (no de la empresa): confirma que trabaja allí");
  } else if (emailDomain && linkDomain && !linkDomain.endsWith(emailDomain) && !emailDomain.endsWith(linkDomain)) {
    notes.push(`El dominio del correo (${emailDomain}) no coincide con el del enlace (${linkDomain}): puede ser un portal de empleo, revísalo`);
  }
  if (RISKY_LINK_DOMAINS.some((d) => linkDomain === d || linkDomain.endsWith(`.${d}`))) {
    notes.push(`⚠ El enlace de postulación es un acortador o un chat (${linkDomain}): pide el enlace oficial`);
  }
  const text = clean([input.title, input.description, ...input.requirements].join(" "));
  if (PAYMENT_RE.test(text)) {
    notes.push("⚠ Menciona pagos o inscripciones: una práctica nunca debe cobrarle al estudiante");
  }
  if (input.type === "contrato_aprendizaje" && input.compensationType !== "apoyo_sostenimiento") {
    notes.push("El contrato de aprendizaje paga apoyo de sostenimiento: revisa el tipo de pago");
  }
  return notes;
}

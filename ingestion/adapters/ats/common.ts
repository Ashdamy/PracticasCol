/**
 * Base común de los conectores de ATS (Greenhouse y Lever): filtro Colombia + prácticas, limpieza de HTML,
 * extracto corto y mapeo al borrador. Funciones puras, sin red.
 *
 * Reglas (AGENTS.md §12 y Ley 1581 de 2012):
 * - No se guarda la descripción completa: solo un extracto de `MAX_EXCERPT_LENGTH` caracteres.
 * - No se copia ningún dato de personas (reclutadores, hiring managers, correos, teléfonos). Por eso el
 *   `payload` del ítem crudo es una ficha propia con campos de lista blanca, no la respuesta de la API.
 */
import { MUNICIPALITIES } from "@/lib/catalog/geo";
import { clean } from "../../normalize/text";
import type { OpportunityDraft } from "../../types";

export type AtsProvider = "greenhouse" | "lever";

export interface AtsFilter {
  /** Países aceptados, como texto o expresión regular sin tildes ("colombia"). Por defecto, solo Colombia. */
  countries?: readonly string[];
  /** Solo ofertas cuyo título habla de práctica, pasantía, aprendiz, intern, trainee, etc. */
  onlyInternships: boolean;
}

export interface AtsAdapterConfig {
  /** Id estable de la fuente (por ejemplo `src-ats-empresa`). */
  id: string;
  name: string;
  /** Identificador del tablero en el ATS (el `token` de Greenhouse o la `company` de Lever). */
  token: string;
  /** Nombre de la organización que publica: los ATS no lo traen en cada oferta. */
  organizationName: string;
  filter: AtsFilter;
}

/** Ficha propia de una oferta: lo único que se guarda como crudo. Debe ser estable entre corridas. */
export interface AtsPosting {
  provider: AtsProvider;
  id: string;
  title: string;
  /** Ubicación elegida (la primera que pasa el filtro). */
  location: string;
  /** "remote", "hybrid", "on-site"… tal como lo dice la fuente, o `null`. */
  workplaceType: string | null;
  commitment: string | null;
  department: string | null;
  /** Página pública de la oferta. */
  url: string;
  applyUrl: string;
  /** ISO datetime de publicación (Lever) o `null`. */
  postedAt: string | null;
  /** ISO datetime de la última edición (Greenhouse) o `null`. */
  updatedAt: string | null;
  /** Extracto de la descripción (máx. `MAX_EXCERPT_LENGTH`). */
  excerpt: string;
  /** Título + primeras líneas de la descripción: pista para deducir el nivel de formación. */
  levelHint: string;
  /** Hasta `MAX_REQUIREMENTS` viñetas cortas de una lista de requisitos. */
  requirements: string[];
  /** Texto de pago listo para el normalizador, o `null`. */
  compensation: string | null;
}

export const DEFAULT_COUNTRIES: readonly string[] = ["colombia"];
export const MAX_EXCERPT_LENGTH = 300;
export const MAX_REQUIREMENTS = 5;
export const MAX_REQUIREMENT_LENGTH = 160;
const LEVEL_HINT_LENGTH = 240;

// ---------------------------------------------------------------------------
// Lectura defensiva del JSON
// ---------------------------------------------------------------------------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Texto no vacío y sin espacios sobrantes, o `null`. */
export function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const tidy = value.replace(/\s+/g, " ").trim();
  return tidy === "" ? null : tidy;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ---------------------------------------------------------------------------
// HTML → texto plano
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  iquest: "¿",
  iexcl: "¡",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  laquo: "«",
  raquo: "»",
};

function codePoint(code: number, fallback: string): string {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
}

/** Desescapa entidades HTML (con nombre, decimales y hexadecimales). Las desconocidas se dejan igual. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body[0] !== "#") return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match;
    const hex = body[1] === "x" || body[1] === "X";
    return codePoint(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10), match);
  });
}

/** HTML → texto plano: los bloques se vuelven saltos de línea y las viñetas, "- ". */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/ /g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "" && line !== "-")
    .join("\n");
}

/** Viñetas (`<li>`) de un fragmento HTML, como texto plano. */
export function listItems(html: string): string[] {
  const items: string[] = [];
  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)(?=<li\b|<\/li\s*>|<\/[uo]l\s*>|$)/gi)) {
    const item = htmlToText(match[1]).replace(/\s+/g, " ").trim();
    if (item) items.push(item);
  }
  return items;
}

// ---------------------------------------------------------------------------
// Datos personales
// ---------------------------------------------------------------------------

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE_RE = /\+\d[\d\s().-]{7,}\d|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/;
const PROFILE_RE = /linkedin\.com\/in\//i;
const RECRUITER_RE =
  /\b(recruiters?|hiring managers?|reclutador(?:a|es|as)?|talent (?:acquisition )?partners?|hiring leads?)\b/i;

/** `true` si la frase puede identificar a una persona (correo, teléfono, perfil o mención de quien recluta). */
export function mentionsPerson(sentence: string): boolean {
  return EMAIL_RE.test(sentence) || PHONE_RE.test(sentence) || PROFILE_RE.test(sentence) || RECRUITER_RE.test(sentence);
}

/**
 * Quita las frases que puedan identificar a una persona (Ley 1581 de 2012). Se elimina la frase completa,
 * no solo el correo, porque suele traer también el nombre ("Escríbele a … al correo …").
 */
export function scrubPersonalData(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .split(/(?<=[.!?…])\s+/)
        .filter((sentence) => !mentionsPerson(sentence))
        .join(" "),
    )
    .filter((line) => line.trim() !== "")
    .join("\n");
}

// ---------------------------------------------------------------------------
// Extracto
// ---------------------------------------------------------------------------

/** Recorta en límite de palabra y termina en "…" (solo si hubo que recortar). */
export function truncate(text: string, maxLength: number): string {
  const tidy = text.replace(/\s+/g, " ").trim();
  if (tidy.length <= maxLength) return tidy;
  const cut = tidy.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Si la palabra termina justo en el corte, no hay que retroceder.
  const whole = tidy[maxLength - 1] === " " || lastSpace <= 0 ? cut : cut.slice(0, lastSpace);
  return `${whole.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** Extracto de la descripción: sin datos personales y de máximo `MAX_EXCERPT_LENGTH` caracteres. */
export function makeExcerpt(plainText: string, maxLength = MAX_EXCERPT_LENGTH): string {
  return truncate(scrubPersonalData(plainText), maxLength);
}

/** Título + primeras líneas de la descripción (para deducir el nivel de formación). */
export function makeLevelHint(title: string, plainText: string): string {
  const firstLines = scrubPersonalData(plainText).split("\n").slice(0, 2).join(" ");
  return `${title}. ${truncate(firstLines, LEVEL_HINT_LENGTH)}`.replace(/\s+/g, " ").trim();
}

/** Deja hasta 5 viñetas cortas, sin datos personales. */
export function pickRequirements(items: readonly string[]): string[] {
  return items
    .map((item) => item.replace(/\s+/g, " ").replace(/;/g, ",").trim())
    .filter((item) => item !== "" && item.length <= MAX_REQUIREMENT_LENGTH && !mentionsPerson(item))
    .slice(0, MAX_REQUIREMENTS);
}

// ---------------------------------------------------------------------------
// Filtro
// ---------------------------------------------------------------------------

const MUNICIPALITY_RES = MUNICIPALITIES.map((m) => new RegExp(`\\b${clean(m.name)}\\b`));

const INTERNSHIP_RE =
  /\b(practicantes?|practicas?|pasantes?|pasantias?|aprendiz|aprendices|becari[oa]s?|interns?|internships?|trainees?|students?|estudiantes?)\b/;

const REMOTE_RE = /\b(remote|remot[oa]s?|teletrabajo)\b/;

/** El título habla de una práctica (español o inglés, sin tildes ni mayúsculas). */
export function isInternshipTitle(title: string): boolean {
  return INTERNSHIP_RE.test(clean(title));
}

export function mentionsRemote(text: string | null | undefined): boolean {
  return text != null && REMOTE_RE.test(clean(text));
}

export function compileCountries(countries: readonly string[] = DEFAULT_COUNTRIES): RegExp[] {
  return countries.map((country) => new RegExp(`\\b(?:${country})\\b`, "i"));
}

/** La ubicación menciona un país aceptado o un municipio del catálogo. */
export function matchesLocation(text: string, countries: readonly RegExp[]): boolean {
  const n = clean(text);
  return countries.some((re) => re.test(n)) || MUNICIPALITY_RES.some((re) => re.test(n));
}

/** Primera ubicación candidata que pasa el filtro (`null` si ninguna: la oferta se descarta). */
export function pickLocation(candidates: readonly (string | null)[], countries: readonly RegExp[]): string | null {
  for (const candidate of candidates) {
    if (candidate && matchesLocation(candidate, countries)) return candidate;
  }
  return null;
}

export interface FilterStats {
  total: number;
  inCountry: number;
  kept: number;
}

/** Resumen para el log de la corrida: deja ver si una fuente con 0 prácticas sigue viva. */
export function describeStats(config: AtsAdapterConfig, stats: FilterStats): string {
  const scope = config.filter.onlyInternships ? "prácticas" : "ofertas";
  return `[${config.id}] ${stats.total} ofertas en el tablero, ${stats.inCountry} en el país, ${stats.kept} ${scope} que pasan el filtro`;
}

// ---------------------------------------------------------------------------
// Ficha → borrador
// ---------------------------------------------------------------------------

/** Solo copia textos: interpretar es trabajo de `normalize/`. */
export function postingToDraft(posting: AtsPosting, organizationName: string): OpportunityDraft {
  const workplace = posting.workplaceType ?? (mentionsRemote(posting.location) ? "Remote" : null);
  return {
    title: posting.title,
    organizationName,
    typeText: posting.title,
    levelText: posting.levelHint,
    municipalityText: posting.location,
    modalityText: workplace,
    compensationText: posting.compensation,
    durationText: null,
    // Estos ATS no publican fecha de cierre.
    deadlineText: null,
    startDateText: null,
    description: posting.excerpt || null,
    programsText: null,
    semesterText: null,
    requirementsText: posting.requirements.length > 0 ? posting.requirements.join("\n") : null,
    institutionsText: null,
    applyUrl: posting.applyUrl,
    sourceUrl: posting.url,
  };
}

/** Lee la ficha guardada en `RawItem.payload`. */
export function asPosting(payload: unknown): AtsPosting {
  if (!isRecord(payload) || typeof payload.title !== "string" || typeof payload.url !== "string") {
    throw new Error("Ítem de ATS con formato inesperado");
  }
  return payload as unknown as AtsPosting;
}

/** Respuesta 200 con JSON, o error (el pipeline lo aísla y lo reporta). */
export function parseJsonResponse(response: { status: number; text: string }, url: string): unknown {
  if (response.status !== 200) throw new Error(`Respuesta ${response.status} de ${url}`);
  try {
    return JSON.parse(response.text) as unknown;
  } catch {
    throw new Error(`La respuesta de ${url} no es JSON válido`);
  }
}

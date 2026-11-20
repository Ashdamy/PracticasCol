/**
 * Reglas puras del CLI de administración (`admin.ts`): a quién se refiere un argumento, cuándo se puede
 * aprobar una convocatoria y cómo se muestra. Sin red ni base de datos, para poder probarlas.
 */
import { OPPORTUNITY_TYPES, type OpportunityType } from "@/lib/contracts";
import { getMunicipality, MUNICIPALITIES } from "@/lib/catalog/geo";
import { MODALITY_LABELS, OPPORTUNITY_TYPE_LABELS, STATUS_LABELS } from "@/lib/catalog/labels";
import { clean } from "./normalize/text";
import type { StoredOpportunity } from "./store";

export const SHORT_ID_LENGTH = 8;
/** Mínimo de caracteres para buscar por el comienzo del id. */
export const MIN_ID_PREFIX = 6;

export const shortId = (id: string): string => id.slice(0, SHORT_ID_LENGTH);

export type Target = Pick<StoredOpportunity, "id" | "slug">;

/**
 * Busca por id completo, por slug o por el comienzo del id (el "id corto" que muestran las listas).
 * @throws si no hay ninguna o si el comienzo del id coincide con varias.
 */
export function resolveTarget<T extends Target>(key: string, all: readonly T[]): T {
  const wanted = key.trim().toLowerCase();
  if (!wanted) throw new Error("Falta el id o el slug de la convocatoria");
  const exact = all.find((o) => o.id.toLowerCase() === wanted || o.slug === wanted);
  if (exact) return exact;
  if (wanted.length >= MIN_ID_PREFIX) {
    const byPrefix = all.filter((o) => o.id.toLowerCase().startsWith(wanted));
    if (byPrefix.length === 1) return byPrefix[0];
    if (byPrefix.length > 1) {
      throw new Error(`«${key}» coincide con ${byPrefix.length} convocatorias: usa el id completo o el slug`);
    }
  }
  throw new Error(`No hay ninguna convocatoria con id o slug «${key}»`);
}

export type Approvable = Pick<
  StoredOpportunity,
  "title" | "organizationId" | "organizationName" | "applyUrl" | "deadlineType" | "deadlineDate" | "status"
>;

export interface ApprovalProblem {
  message: string;
  /** `true`: ni con `--forzar` se puede publicar (la base de datos lo impide o no tendría sentido). */
  blocking: boolean;
}

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Qué impide publicar una convocatoria. Lista vacía = se puede aprobar.
 * `--forzar` salta los problemas no bloqueantes (título vacío, enlace sin https, fecha ya pasada);
 * sin organización o sin enlace no se publica nunca: es lo mínimo que ve el estudiante.
 */
export function approvalProblems(opportunity: Approvable, today: string): ApprovalProblem[] {
  const problems: ApprovalProblem[] = [];
  if (opportunity.status === "publicada") problems.push({ message: "ya está publicada", blocking: true });
  if (!opportunity.title.trim()) problems.push({ message: "falta el título", blocking: false });
  if (!opportunity.organizationId || !opportunity.organizationName.trim()) {
    problems.push({ message: "falta la organización", blocking: true });
  }
  if (!opportunity.applyUrl.trim()) problems.push({ message: "falta el enlace de postulación", blocking: true });
  else if (!isHttps(opportunity.applyUrl)) {
    problems.push({ message: "el enlace de postulación no es https", blocking: false });
  }
  if (opportunity.deadlineType === "fecha" && opportunity.deadlineDate && opportunity.deadlineDate < today) {
    problems.push({ message: `la fecha límite ya pasó (${opportunity.deadlineDate})`, blocking: false });
  }
  return problems;
}

export interface ApprovalDecision {
  approve: boolean;
  problems: ApprovalProblem[];
}

export function decideApproval(opportunity: Approvable, today: string, force: boolean): ApprovalDecision {
  const problems = approvalProblems(opportunity, today);
  const stoppers = force ? problems.filter((p) => p.blocking) : problems;
  return { approve: stoppers.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Aprobación en bloque
// ---------------------------------------------------------------------------

/** Filtros de `aprobar-lote`. Se combinan con «y»; los textos ignoran tildes y mayúsculas. */
export interface BatchFilters {
  /** Parte del id o del nombre de la fuente principal (`jooble`, `src-api-jooble-co`). */
  source: string | null;
  /** Parte del nombre de la organización. */
  organization: string | null;
  /** Slug del municipio (`medellin`) o su nombre. */
  municipality: string | null;
  type: OpportunityType | null;
  /** Parte del título. */
  title: string | null;
  /** Solo las que no tienen ninguna observación de la ingesta. */
  withoutNotes: boolean;
}

export const EMPTY_BATCH_FILTERS: BatchFilters = {
  source: null,
  organization: null,
  municipality: null,
  type: null,
  title: null,
  withoutNotes: false,
};

/** Las observaciones de la ingesta que marcan un posible duplicado empiezan así (ver `pipeline.ts`). */
const PROBABLE_DUPLICATE_RE = /^posible duplicado/i;

export function isProbableDuplicate(opportunity: Pick<StoredOpportunity, "reviewNotes">): boolean {
  return opportunity.reviewNotes.some((note) => PROBABLE_DUPLICATE_RE.test(note.trim()));
}

export function hasBatchFilter(filters: BatchFilters): boolean {
  return (
    filters.source !== null ||
    filters.organization !== null ||
    filters.municipality !== null ||
    filters.type !== null ||
    filters.title !== null ||
    filters.withoutNotes
  );
}

function includesClean(haystack: string, needle: string): boolean {
  return clean(haystack).includes(clean(needle));
}

/** Slug del municipio a partir del slug o del nombre («Itagüí», «itagui»). `null` si no existe. */
export function resolveMunicipalitySlug(text: string): string | null {
  const wanted = clean(text);
  return MUNICIPALITIES.find((m) => m.slug === wanted.replace(/\s+/g, "-") || clean(m.name) === wanted)?.slug ?? null;
}

export function matchesBatchFilters(
  opportunity: StoredOpportunity,
  filters: BatchFilters,
  sourceNames: ReadonlyMap<string, string>,
): boolean {
  if (filters.source !== null) {
    const sourceId = opportunity.sources[0]?.sourceId ?? "";
    const name = sourceNames.get(sourceId) ?? "";
    if (!includesClean(sourceId, filters.source) && !includesClean(name, filters.source)) return false;
  }
  if (filters.organization !== null && !includesClean(opportunity.organizationName, filters.organization)) return false;
  if (filters.municipality !== null && opportunity.municipalitySlug !== filters.municipality) return false;
  if (filters.type !== null && opportunity.type !== filters.type) return false;
  if (filters.title !== null && !includesClean(opportunity.title, filters.title)) return false;
  if (filters.withoutNotes && opportunity.reviewNotes.length > 0) return false;
  return true;
}

export interface BatchSkip {
  opportunity: StoredOpportunity;
  reasons: string[];
}

export interface BatchSelection {
  approve: StoredOpportunity[];
  /** Coinciden con los filtros pero no se pueden aprobar en bloque. */
  skipped: BatchSkip[];
}

/**
 * Qué publicaría `aprobar-lote`: las convocatorias en revisión que pasan los filtros y las mismas reglas de
 * `aprobar` (`decideApproval`). Los posibles duplicados nunca entran: se revisan una por una.
 */
export function selectBatch(
  all: readonly StoredOpportunity[],
  filters: BatchFilters,
  sourceNames: ReadonlyMap<string, string>,
  today: string,
  force: boolean,
): BatchSelection {
  const selection: BatchSelection = { approve: [], skipped: [] };
  const candidates = all
    .filter((o) => o.status === "en_revision" && matchesBatchFilters(o, filters, sourceNames))
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
  for (const opportunity of candidates) {
    const reasons: string[] = [];
    if (isProbableDuplicate(opportunity)) reasons.push("posible duplicado: revísala con «ver» y apruébala sola");
    const decision = decideApproval(opportunity, today, force);
    if (!decision.approve) reasons.push(...decision.problems.map((p) => p.message));
    if (reasons.length > 0) selection.skipped.push({ opportunity, reasons });
    else selection.approve.push(opportunity);
  }
  return selection;
}

/** Resumen de lo que se aprobaría (o se aprobó) y de lo que se saltó. */
export function formatBatchSelection(selection: BatchSelection, confirmed: boolean): string {
  const lines: string[] = [];
  lines.push(`${confirmed ? "Se publican" : "Se publicarían"}: ${selection.approve.length}`);
  for (const o of selection.approve) {
    const place = getMunicipality(o.municipalitySlug)?.name ?? "sin municipio";
    lines.push(`  ${shortId(o.id)}  ${o.title} — ${o.organizationName} (${place} · ${OPPORTUNITY_TYPE_LABELS[o.type]})`);
  }
  if (selection.skipped.length > 0) {
    lines.push("", `No entran en el lote: ${selection.skipped.length}`);
    for (const { opportunity, reasons } of selection.skipped) {
      lines.push(`  ${shortId(opportunity.id)}  ${opportunity.title || "(sin título)"}: ${reasons.join("; ")}`);
    }
  }
  if (!confirmed && selection.approve.length > 0) {
    lines.push("", "No se cambió nada. Si la lista está bien, repite el mismo comando con --confirmar.");
  }
  return lines.join("\n");
}

export interface AdminArgs {
  command: string | null;
  targets: string[];
  force: boolean;
  /** Filtros de `aprobar-lote`. */
  batch: BatchFilters;
  /** `--confirmar`: en `aprobar-lote`, publica de verdad (sin él solo muestra la lista). */
  confirm: boolean;
  /** `--todos`: en `reportes`, incluye los ya resueltos. */
  all: boolean;
  help: boolean;
  /** `--sitio <dominio>`: en `empresa`, el sitio web de la organización. */
  site: string | null;
  /** `--logo <url https>`: en `empresa`, un logo explícito. */
  logo: string | null;
  /** `--sin-logo`: en `empresa`, borra el sitio web y el logo. */
  noLogo: boolean;
}

const BATCH_VALUE_FLAGS: readonly string[] = ["--fuente", "--empresa", "--municipio", "--tipo", "--titulo"];

function setBatchFilter(filters: BatchFilters, flag: string, value: string): void {
  if (flag === "--fuente") filters.source = value;
  else if (flag === "--empresa") filters.organization = value;
  else if (flag === "--titulo") filters.title = value;
  else if (flag === "--municipio") {
    const slug = resolveMunicipalitySlug(value);
    if (!slug) throw new Error(`No hay un municipio «${value}» en el catálogo: ${MUNICIPALITIES.map((m) => m.slug).join(", ")}`);
    filters.municipality = slug;
  } else if (flag === "--tipo") {
    const type = OPPORTUNITY_TYPES.find((t) => t === value.trim().toLowerCase());
    if (!type) throw new Error(`Tipo desconocido «${value}»: ${OPPORTUNITY_TYPES.join(", ")}`);
    filters.type = type;
  }
}

export function parseAdminArgs(argv: readonly string[]): AdminArgs {
  const args: AdminArgs = {
    command: null,
    targets: [],
    force: false,
    batch: { ...EMPTY_BATCH_FILTERS },
    confirm: false,
    all: false,
    help: false,
    site: null,
    logo: null,
    noLogo: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    if (flag === "--sitio" || flag === "--logo") {
      const value = inline ?? argv[(i += 1)];
      if (!value?.trim() || value.startsWith("--")) throw new Error(`Falta el valor de ${flag}`);
      if (flag === "--sitio") args.site = value.trim();
      else args.logo = value.trim();
    } else if (BATCH_VALUE_FLAGS.includes(flag)) {
      const value = (inline ?? argv[(i += 1)])?.trim();
      if (!value || value.startsWith("--")) throw new Error(`Falta el valor de ${flag}`);
      setBatchFilter(args.batch, flag, value);
    } else if (arg === "--sin-observaciones") args.batch.withoutNotes = true;
    else if (arg === "--confirmar") args.confirm = true;
    else if (arg === "--sin-logo") args.noLogo = true;
    else if (arg === "--forzar") args.force = true;
    else if (arg === "--todos") args.all = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--")) throw new Error(`Opción desconocida: ${arg}`);
    else if (args.command === null) args.command = arg.toLowerCase();
    else args.targets.push(arg);
  }
  return args;
}

type Listable = Pick<StoredOpportunity, "id" | "title" | "organizationName" | "sources" | "reviewNotes">;

/** Una línea por convocatoria y, debajo, sus observaciones. */
export function formatListItem(opportunity: Listable, sourceNames: ReadonlyMap<string, string>): string {
  const sourceId = opportunity.sources[0]?.sourceId;
  const source = sourceId ? (sourceNames.get(sourceId) ?? sourceId) : "sin fuente";
  const lines = [
    `${shortId(opportunity.id)}  ${opportunity.title || "(sin título)"} — ${opportunity.organizationName || "(sin organización)"} [${source}]`,
  ];
  for (const note of opportunity.reviewNotes) lines.push(`          - ${note}`);
  return lines.join("\n");
}

export function formatDetail(o: StoredOpportunity, sourceNames: ReadonlyMap<string, string>): string {
  const deadline =
    o.deadlineType === "fecha" ? (o.deadlineDate ?? "—") : o.deadlineType === "hasta_agotar_cupos" ? "hasta agotar cupos" : "no publicada";
  const duration =
    o.durationMonthsMin === null && o.durationMonthsMax === null
      ? "—"
      : [...new Set([o.durationMonthsMin ?? o.durationMonthsMax, o.durationMonthsMax ?? o.durationMonthsMin])].join(" a ") + " meses";
  const rows: [string, string][] = [
    ["Id", o.id],
    ["Slug", o.slug],
    ["Título", o.title || "(sin título)"],
    ["Organización", o.organizationName || "(sin organización)"],
    ["Estado", `${STATUS_LABELS[o.status]}${o.needsReview ? " (marcada para revisión)" : ""}`],
    ["Tipo", OPPORTUNITY_TYPE_LABELS[o.type]],
    ["Niveles", o.levels.join(", ") || "—"],
    ["Lugar", `${getMunicipality(o.municipalitySlug)?.name ?? "sin municipio"} · ${MODALITY_LABELS[o.modality]}`],
    ["Pago", `${o.compensationType}${o.compensationAmountCop === null ? "" : ` · $${o.compensationAmountCop.toLocaleString("es-CO")}`}`],
    ["Duración", duration],
    ["Fecha límite", deadline],
    ["Inicio", o.startDate ?? "—"],
    ["Programas", o.openToAllPrograms ? "cualquier programa" : [...o.programIds, ...o.knowledgeAreaIds].join(", ") || "—"],
    ["Afines", o.acceptsRelatedPrograms ? "sí" : "no"],
    ["Semestre", `${o.semesterMin ?? "—"} a ${o.semesterMax ?? "—"}`],
    ["Instituciones", o.institutionIds === null ? "cualquiera" : o.institutionIds.join(", ") || "(restringida, sin lista)"],
    ["Postulación", o.applyUrl || "(sin enlace)"],
    ["Fuentes", o.sources.map((s) => `${sourceNames.get(s.sourceId) ?? s.sourceId}: ${s.url}`).join(" | ") || "—"],
    ["Verificada", o.lastVerifiedAt],
    ["Descripción", o.description || "—"],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`);
  if (o.otherRequirements.length > 0) lines.push("Otros requisitos:", ...o.otherRequirements.map((r) => `  - ${r}`));
  if (o.reviewNotes.length > 0) lines.push("Observaciones:", ...o.reviewNotes.map((n) => `  - ${n}`));
  return lines.join("\n");
}

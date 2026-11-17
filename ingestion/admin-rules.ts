/**
 * Reglas puras del CLI de administración (`admin.ts`): a quién se refiere un argumento, cuándo se puede
 * aprobar una convocatoria y cómo se muestra. Sin red ni base de datos, para poder probarlas.
 */
import { getMunicipality } from "@/lib/catalog/geo";
import { MODALITY_LABELS, OPPORTUNITY_TYPE_LABELS, STATUS_LABELS } from "@/lib/catalog/labels";
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

export interface AdminArgs {
  command: string | null;
  targets: string[];
  force: boolean;
  /** `--todos`: en `reportes`, incluye los ya resueltos. */
  all: boolean;
  help: boolean;
}

export function parseAdminArgs(argv: readonly string[]): AdminArgs {
  const args: AdminArgs = { command: null, targets: [], force: false, all: false, help: false };
  for (const arg of argv) {
    if (arg === "--forzar") args.force = true;
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

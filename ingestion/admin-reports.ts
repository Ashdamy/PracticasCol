/**
 * Reportes de los estudiantes («Reportar error») en el CLI de administración: lectura, formato, sugerencia
 * de acción por motivo y marcado como resuelto. Las reglas son puras; las dos funciones que hablan con
 * Supabase reciben el cliente, para poder probarlas con el cliente falso.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ISSUE_REASON_LABELS, STATUS_LABELS } from "@/lib/catalog/labels";
import type { IssueReason } from "@/lib/contracts";
import { fetchAll, unwrap, type DbResult } from "@/server/repo/supabase-shared";
import { TIME_ZONE } from "@/lib/time";
import { MIN_ID_PREFIX, shortId } from "./admin-rules";
import type { StoredOpportunity } from "./store";

export const COMMENT_MAX_LENGTH = 200;

export interface IssueReport {
  id: string;
  opportunityId: string;
  reason: IssueReason;
  comment: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface IssueReportRow {
  id: string;
  opportunity_id: string;
  reason: IssueReason;
  comment: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export const ISSUE_REPORT_SELECT = "id, opportunity_id, reason, comment, resolved, resolved_at, created_at";

export function rowToIssueReport(row: IssueReportRow): IssueReport {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    reason: row.reason,
    comment: row.comment,
    resolved: row.resolved,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

/** Los más recientes primero; con `includeResolved: false` solo los que faltan por atender. */
export function selectReports(reports: readonly IssueReport[], includeResolved: boolean): IssueReport[] {
  return reports
    .filter((r) => includeResolved || !r.resolved)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}

/**
 * Busca un reporte por id completo o por el comienzo del id (el "id corto" de la lista).
 * @throws si no hay ninguno o si el comienzo coincide con varios.
 */
export function resolveReportId<T extends Pick<IssueReport, "id">>(key: string, all: readonly T[]): T {
  const wanted = key.trim().toLowerCase();
  if (!wanted) throw new Error("Falta el id del reporte");
  const exact = all.find((r) => r.id.toLowerCase() === wanted);
  if (exact) return exact;
  if (wanted.length >= MIN_ID_PREFIX) {
    const byPrefix = all.filter((r) => r.id.toLowerCase().startsWith(wanted));
    if (byPrefix.length === 1) return byPrefix[0];
    if (byPrefix.length > 1) throw new Error(`«${key}» coincide con ${byPrefix.length} reportes: usa el id completo`);
  }
  throw new Error(`No hay ningún reporte con id «${key}»`);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `yyyy-mm-dd hh:mm` en hora de Colombia. */
export function formatBogotaDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/**
 * Comentario en una línea y recortado. Lo escribe cualquier visitante: se quitan los caracteres de control
 * para que no pueda mandar secuencias de escape a la terminal.
 */
export function clipComment(comment: string | null, max = COMMENT_MAX_LENGTH): string {
  const clean = (comment ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export type ReportedOpportunity = Pick<StoredOpportunity, "id" | "title" | "organizationName" | "status">;

export const retireCommand = (opportunityId: string): string => `npm run admin -- retirar ${shortId(opportunityId)}`;

/**
 * Qué conviene hacer según el motivo. Nunca ejecuta nada: solo deja el comando listo para copiar.
 * `null` si el motivo no tiene una acción evidente (datos incorrectos, otro) o si no hay nada que retirar.
 */
export function suggestAction(reason: IssueReason, opportunity: ReportedOpportunity | undefined): string | null {
  if (!opportunity) return null;
  if (reason !== "vencida" && reason !== "enlace_roto" && reason !== "sospechosa") return null;
  if (opportunity.status === "retirada") return "La convocatoria ya está retirada: solo falta resolver el reporte.";
  const command = retireCommand(opportunity.id);
  if (reason === "sospechosa") return `¡Revísala con prioridad! Si no es confiable, retírala: ${command}`;
  const check = reason === "vencida" ? "Si confirmas que ya cerró" : "Si confirmas que el enlace no funciona";
  return `${check}, retírala: ${command}`;
}

const INDENT = " ".repeat(10);

/** Una línea por reporte y, debajo, la convocatoria, el comentario y la sugerencia. */
export function formatReport(report: IssueReport, opportunity: ReportedOpportunity | undefined): string {
  const resolved = report.resolved
    ? `  [RESUELTO${report.resolvedAt ? ` ${formatBogotaDateTime(report.resolvedAt)}` : ""}]`
    : "";
  const lines = [
    `${shortId(report.id)}  ${formatBogotaDateTime(report.createdAt)}  ${ISSUE_REASON_LABELS[report.reason] ?? report.reason}${resolved}`,
    opportunity
      ? `${INDENT}Convocatoria: ${shortId(opportunity.id)} «${opportunity.title || "(sin título)"}» — ${opportunity.organizationName || "(sin organización)"} [${STATUS_LABELS[opportunity.status]}]`
      : `${INDENT}Convocatoria: ${shortId(report.opportunityId)} (no encontrada)`,
  ];
  const comment = clipComment(report.comment);
  if (comment) lines.push(`${INDENT}Comentario: ${comment}`);
  const suggestion = report.resolved ? null : suggestAction(report.reason, opportunity);
  if (suggestion) lines.push(`${INDENT}Sugerencia: ${suggestion}`);
  return lines.join("\n");
}

/** Texto completo del comando `reportes`. */
export function formatReportList(
  reports: readonly IssueReport[],
  opportunities: readonly ReportedOpportunity[],
  includeResolved: boolean,
): string {
  const selected = selectReports(reports, includeResolved);
  if (selected.length === 0) {
    if (includeResolved) return "No hay reportes.";
    const resolved = reports.length;
    return resolved > 0
      ? `No hay reportes sin resolver (${resolved} ya resuelto${resolved === 1 ? "" : "s"}: usa --todos para verlos).`
      : "No hay reportes sin resolver.";
  }
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const pending = selected.filter((r) => !r.resolved).length;
  const title = includeResolved
    ? `Reportes: ${selected.length} (${pending} sin resolver)`
    : `Reportes sin resolver: ${selected.length}`;
  const lines = [title, ...selected.map((r) => formatReport(r, byId.get(r.opportunityId)))];
  if (pending > 0) lines.push("", "Cuando atiendas uno, ciérralo con: npm run admin -- resolver <id-reporte>");
  return lines.join("\n");
}

/** Todos los reportes (resueltos o no), los más recientes primero. */
export async function listIssueReports(client: SupabaseClient): Promise<IssueReport[]> {
  const rows = await fetchAll<IssueReportRow>(
    (from, to) =>
      client
        .from("issue_reports")
        .select(ISSUE_REPORT_SELECT)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    "leer los reportes",
  );
  return rows.map(rowToIssueReport);
}

/** Marca un reporte como resuelto y guarda cuándo. @throws si el reporte no existe. */
export async function markReportResolved(client: SupabaseClient, id: string, now: Date = new Date()): Promise<void> {
  const result: DbResult<unknown> = await client
    .from("issue_reports")
    .update({ resolved: true, resolved_at: now.toISOString() })
    .eq("id", id)
    .select("id");
  if (((unwrap(result, "resolver el reporte") ?? []) as unknown[]).length === 0) {
    throw new Error(`No existe el reporte ${id}`);
  }
}

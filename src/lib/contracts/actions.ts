import { z } from "zod";
import { IssueReasonSchema } from "./enums";

/** Respuesta estándar de todas las server actions (AGENTS.md §11). Nunca lanzan al cliente. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export interface ActionError {
  code: "VALIDATION" | "NOT_FOUND" | "UNAUTHORIZED" | "RATE_LIMITED" | "INTERNAL";
  message: string;
  /** Errores por campo, con la ruta del campo como clave (p. ej. "programId"). */
  fieldErrors?: Record<string, string>;
}

export const ReportIssueSchema = z.object({
  opportunityId: z.string().min(1),
  reason: IssueReasonSchema,
  comment: z.string().trim().max(500).optional(),
});
export type ReportIssueInput = z.infer<typeof ReportIssueSchema>;

/** Convierte un error de Zod en `fieldErrors` (primer mensaje por campo). */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

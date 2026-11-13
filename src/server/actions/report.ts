"use server";
/** ★ "Reportar error" en una oportunidad (AGENTS.md §11). */
import { ReportIssueSchema, zodFieldErrors, type ActionResult, type ReportIssueInput } from "@/lib/contracts";
import { getRepository } from "@/server/repo";

export async function reportIssue(input: ReportIssueInput): Promise<ActionResult<null>> {
  const parsed = ReportIssueSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisa el reporte.", fieldErrors: zodFieldErrors(parsed.error) },
    };
  }
  try {
    const repo = getRepository();
    if (!(await repo.getRecordById(parsed.data.opportunityId))) {
      return { ok: false, error: { code: "NOT_FOUND", message: "La convocatoria no existe." } };
    }
    // TODO(Fase 1): límite de reportes por IP para evitar abuso.
    await repo.insertIssueReport({
      opportunityId: parsed.data.opportunityId,
      reason: parsed.data.reason,
      comment: parsed.data.comment || null,
    });
    return { ok: true, data: null };
  } catch (e) {
    console.error("[reportIssue]", e);
    return { ok: false, error: { code: "INTERNAL", message: "No pudimos enviar el reporte. Intenta de nuevo." } };
  }
}

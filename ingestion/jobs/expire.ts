/** Job diario (AGENTS.md §12): oportunidades publicadas con fecha límite pasada → `vencida`. Función pura. */
import type { OpportunityRecord } from "@/server/domain/types";

export type Expirable = Pick<OpportunityRecord, "id" | "status" | "deadlineType" | "deadlineDate">;

/**
 * @param today hoy en Colombia (`todayInBogota()`), `yyyy-mm-dd`.
 * @returns ids que deben pasar de `publicada` a `vencida`. El día de cierre todavía cuenta como abierto.
 */
export function expireOpportunities(records: readonly Expirable[], today: string): string[] {
  return records
    .filter(
      (r) => r.status === "publicada" && r.deadlineType === "fecha" && r.deadlineDate !== null && r.deadlineDate < today,
    )
    .map((r) => r.id);
}

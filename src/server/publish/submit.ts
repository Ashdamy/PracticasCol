/**
 * Lógica de `submitOpportunity` sin dependencias de Next (petición, cabeceras), para poder probarla.
 * Orden: esquema → antispam → límite de envíos → catálogo y fecha → duplicados → guardar en revisión.
 */
import {
  PublishOpportunitySchema,
  zodFieldErrors,
  type ActionResult,
  type PublishOpportunityInput,
  type PublishReceipt,
} from "@/lib/contracts";
import { todayInBogota } from "@/lib/time";
import type { Repository } from "@/server/repo";
import { findDuplicate } from "../../../ingestion/dedupe";
import {
  MAX_PER_EMAIL_PER_DAY,
  MAX_PER_IP_PER_HOUR,
  botSignal,
  buildCandidate,
  catalogErrors,
  reviewNotesFor,
} from "./rules";

export interface SubmitDeps {
  repo: Repository;
  now: Date;
  /** HMAC de la IP de quien envía (ver `hashIp`). */
  ipHash: string;
  log?: (message: string) => void;
}

const HOUR_MS = 60 * 60 * 1000;

/** Referencia corta que se le muestra a quien publica. */
export function referenceFor(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function submitOpportunityWith(input: PublishOpportunityInput, deps: SubmitDeps): Promise<ActionResult<PublishReceipt>> {
  const log = deps.log ?? (() => undefined);
  const parsed = PublishOpportunitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisa los campos marcados.", fieldErrors: zodFieldErrors(parsed.error) },
    };
  }
  const data = parsed.data;
  const nowMs = deps.now.getTime();

  const signal = botSignal(data, nowMs);
  if (signal === "trampa") {
    // A un bot no se le dice que lo detectamos: respuesta normal, sin guardar nada.
    log(`[submitOpportunity] envío descartado (campo trampa)`);
    return { ok: true, data: { reference: "RECIBIDA" } };
  }
  if (signal === "muy_rapido") {
    return { ok: false, error: { code: "VALIDATION", message: "Revisa el formulario e inténtalo de nuevo en unos segundos." } };
  }
  if (signal === "formulario_viejo") {
    return { ok: false, error: { code: "VALIDATION", message: "El formulario lleva mucho tiempo abierto. Recarga la página y vuelve a enviarlo." } };
  }

  try {
    const recent = await deps.repo.countRecentPublications({
      ipHash: deps.ipHash,
      email: data.contactEmail,
      ipSince: new Date(nowMs - HOUR_MS).toISOString(),
      emailSince: new Date(nowMs - 24 * HOUR_MS).toISOString(),
    });
    if (recent.byIp >= MAX_PER_IP_PER_HOUR || recent.byEmail >= MAX_PER_EMAIL_PER_DAY) {
      return {
        ok: false,
        error: { code: "RATE_LIMITED", message: "Ya recibimos varias convocatorias tuyas hace poco. Intenta de nuevo más tarde." },
      };
    }

    const fieldErrors = catalogErrors(data, todayInBogota(deps.now));
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: { code: "VALIDATION", message: "Revisa los campos marcados.", fieldErrors } };
    }

    const candidate = buildCandidate(data);
    const reviewNotes = reviewNotesFor(data);
    const duplicate = findDuplicate(candidate, await deps.repo.listDedupeTargets());
    if (duplicate) {
      // Mismo prefijo que la ingesta: `aprobar-lote` nunca aprueba en bloque un posible duplicado.
      reviewNotes.push(
        `Posible duplicado de «${duplicate.match.title}» (${duplicate.match.id}, ${duplicate.kind === "exacto" ? "igual" : `similitud ${duplicate.similarity.toFixed(2)}`})`,
      );
    }

    const { id } = await deps.repo.savePublication(candidate, reviewNotes, {
      name: data.contactName,
      email: data.contactEmail,
      role: data.contactRole,
      ipHash: deps.ipHash,
    });
    return { ok: true, data: { reference: referenceFor(id) } };
  } catch (error) {
    log(`[submitOpportunity] ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, error: { code: "INTERNAL", message: "No pudimos recibir la convocatoria. Intenta de nuevo en unos minutos." } };
  }
}

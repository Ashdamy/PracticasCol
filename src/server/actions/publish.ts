"use server";
/**
 * ★ Formulario «Publica tu práctica» (contrato v0.1.3, `PublishOpportunitySchema`).
 * Nunca publica: deja la convocatoria en revisión para el administrador. Nunca lanza: devuelve `ActionResult`.
 */
import { headers } from "next/headers";
import type { ActionResult, PublishOpportunityInput, PublishReceipt } from "@/lib/contracts";
import { clientIp, hashIp } from "@/server/publish/rules";
import { submitOpportunityWith } from "@/server/publish/submit";
import { getRepository } from "@/server/repo";

export async function submitOpportunity(input: PublishOpportunityInput): Promise<ActionResult<PublishReceipt>> {
  try {
    const ip = clientIp(await headers());
    // La clave secreta del servidor sirve de llave del HMAC: la IP nunca se guarda tal cual.
    const ipHash = hashIp(ip, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
    return await submitOpportunityWith(input, {
      repo: getRepository(),
      now: new Date(),
      ipHash,
      log: (message) => console.error(message),
    });
  } catch (error) {
    console.error("[submitOpportunity]", error instanceof Error ? error.message : String(error));
    return { ok: false, error: { code: "INTERNAL", message: "No pudimos recibir la convocatoria. Intenta de nuevo en unos minutos." } };
  }
}

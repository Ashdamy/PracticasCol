/** Modalidad de trabajo. Función pura. */
import type { Modality } from "@/lib/contracts";
import type { Normalized } from "../types";
import { clean, excerpt, isBlank, result } from "./text";

const HYBRID_RE = /\b(hibrid[oa]s?|mixt[oa]s?|semipresencial(es)?|semi presencial|alternancia)\b/;
const REMOTE_RE = /\b(remot[oa]s?|teletrabajo|virtual(es)?|home office|desde casa|trabajo en casa)\b/;
const ONSITE_RE = /\b(presencial(es)?|en sitio|en planta|en oficina)\b/;

export function normalizeModality(text: string | null | undefined): Normalized<Modality> {
  if (isBlank(text)) return result("presencial", "baja", "Modalidad no indicada: se asumió presencial");
  const n = clean(text);

  if (HYBRID_RE.test(n)) return result("hibrida", "alta");
  const remote = REMOTE_RE.test(n);
  const onsite = ONSITE_RE.test(n);
  if (remote && onsite) {
    return result("hibrida", "media", "La fuente menciona presencial y remoto: se asumió híbrida");
  }
  if (remote) return result("remota", "alta");
  if (onsite) return result("presencial", "alta");
  return result("presencial", "baja", `No se reconoció la modalidad ("${excerpt(text)}"): se asumió presencial`);
}

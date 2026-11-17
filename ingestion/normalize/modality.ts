/** Modalidad de trabajo. Función pura. Entiende español y los términos en inglés de los ATS. */
import type { Modality } from "@/lib/contracts";
import type { Normalized } from "../types";
import { clean, excerpt, isBlank, result } from "./text";

const HYBRID_RE = /\b(hibrid[oa]s?|hybrid|mixt[oa]s?|semipresencial(es)?|semi presencial|alternancia)\b/;
const REMOTE_RE = /\b(remot[oa]s?|remote|teletrabajo|virtual(es)?|home office|desde casa|trabajo en casa)\b/;
// `clean` convierte "on-site" en "on site".
const ONSITE_RE = /\b(presencial(es)?|en sitio|en planta|en oficina|onsite|on site|in office)\b/;
/**
 * Formas explícitas de decir «no se sabe» (p. ej. la opción «Desconocida» de la plantilla).
 * Va anclada al texto completo: "por definir con el jefe" no entra aquí y queda como no reconocida.
 * `clean` convierte "N/A" en "n a".
 */
const UNKNOWN_RE =
  /^(modalidad )?(desconocid[oa]|no especificad[oa]|sin especificar|no indicad[oa]|no informad[oa]|no informa|no aplica|por confirmar|por definir|sin definir|n a)$/;

/**
 * Si la fuente no dice la modalidad, el resultado es `no_especificada`: es un hecho, no una duda,
 * así que sale con confianza alta y sin nota. Nunca se asume presencial.
 */
export function normalizeModality(text: string | null | undefined): Normalized<Modality> {
  if (isBlank(text)) return result("no_especificada", "alta");
  const n = clean(text);

  if (HYBRID_RE.test(n)) return result("hibrida", "alta");
  const remote = REMOTE_RE.test(n);
  const onsite = ONSITE_RE.test(n);
  if (remote && onsite) {
    return result("hibrida", "media", "La fuente menciona presencial y remoto: se asumió híbrida");
  }
  if (remote) return result("remota", "alta");
  if (onsite) return result("presencial", "alta");
  if (UNKNOWN_RE.test(n)) return result("no_especificada", "alta");
  return result("no_especificada", "media", `No se reconoció la modalidad ("${excerpt(text)}")`);
}

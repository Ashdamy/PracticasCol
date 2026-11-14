/** Restricción de instituciones ("solo estudiantes de X") contra el catálogo. Función pura. */
import { INSTITUTIONS } from "@/lib/catalog/academic";
import type { Normalized } from "../types";
import { clean, consumePhrase, excerpt, isBlank, result } from "./text";

/** Nombres con los que las convocatorias mencionan a cada institución (ya normalizados). */
const EXTRA_ALIASES: Record<string, string[]> = {
  "inst-udea": ["u de a", "udea"],
  "inst-unal-med": ["universidad nacional de colombia", "universidad nacional", "unal", "la nacional"],
  "inst-upb": ["bolivariana"],
  "inst-udem": ["u de m", "udem"],
  "inst-eia": ["escuela de ingenieria de antioquia"],
  "inst-ucc-med": ["universidad cooperativa de colombia", "universidad cooperativa", "cooperativa"],
  "inst-amigo": ["luis amigo", "funlam"],
  "inst-usb-med": ["universidad de san buenaventura", "san buenaventura"],
  "inst-unaula": ["autonoma latinoamericana"],
  "inst-uniminuto-ant": ["minuto de dios", "uniminuto"],
  "inst-ceipa": ["ceipa"],
  "inst-esumer": ["esumer"],
  "inst-itm": ["itm"],
  "inst-pascual-bravo": ["pascual bravo"],
  "inst-poli-jic": ["politecnico jic", "politecnico jaime isaza cadavid", "politecnico jaime isaza", "politecnico colombiano", "poli jic", "poli"],
  "inst-colmayor": ["colegio mayor de antioquia", "colegio mayor", "colmayor"],
  "inst-tdea": ["tdea", "tecnologico de antioquia"],
  "inst-sena-ant": ["servicio nacional de aprendizaje", "sena"],
};

const ENTRIES = INSTITUTIONS.flatMap((inst) =>
  [...new Set([clean(inst.name), clean(inst.shortName), ...(EXTRA_ALIASES[inst.id] ?? [])])].map((phrase) => ({
    phrase,
    id: inst.id,
  })),
).sort((a, b) => b.phrase.length - a.phrase.length);

const ANY_RE = /\b(cualquier|todas las|todos los) (institucion(es)?|universidad(es)?|ies)\b|\bsin restriccion\b/;
const INSTITUTION_WORD_RE = /\b(universidad|universitaria|institucion|corporacion|fundacion|politecnico|tecnologico|instituto|escuela)\b/;

/**
 * `null` = abierta a cualquier institución. Una lista = exclusiva de esas instituciones.
 */
export function normalizeInstitutions(text: string | null | undefined): Normalized<string[] | null> {
  if (isBlank(text)) return result(null, "alta");
  let rest = clean(text);
  if (ANY_RE.test(rest)) return result(null, "alta");

  const ids = new Set<string>();
  for (const entry of ENTRIES) {
    const [next, hit] = consumePhrase(rest, entry.phrase);
    if (hit) ids.add(entry.id);
    rest = next;
  }

  if (ids.size === 0) {
    return result(null, "baja", `Instituciones no reconocidas: "${excerpt(text)}"`);
  }
  const value = INSTITUTIONS.filter((i) => ids.has(i.id)).map((i) => i.id);
  if (INSTITUTION_WORD_RE.test(rest)) {
    return result(value, "media", `Puede haber instituciones sin reconocer en "${excerpt(text)}"`);
  }
  return result(value, "alta");
}

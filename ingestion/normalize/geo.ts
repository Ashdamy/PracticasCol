/** Municipio de la convocatoria → slug del catálogo (AGENTS.md §5). Función pura. */
import { MUNICIPALITIES } from "@/lib/catalog/geo";
import type { Normalized } from "../types";
import { clean, excerpt, fold, isBlank, result } from "./text";

export interface MunicipalityValue {
  slug: string | null;
  /** La fuente dice que el trabajo es remoto. */
  remote: boolean;
}

const CATALOG = MUNICIPALITIES.map((m) => ({
  slug: m.slug,
  re: new RegExp(`\\b${clean(m.name)}\\b`),
}));

const REMOTE_RE = /\b(remot[oa]s?|remote|teletrabajo|virtual|home office|desde casa|trabajo en casa)\b/;
/** Otros departamentos y capitales del país. */
const ELSEWHERE_RE =
  /\b(santander|cundinamarca|bogota|valle del cauca|atlantico|bolivar|boyaca|risaralda|quindio|tolima|huila|narino|cauca|meta|cesar|magdalena|cordoba|sucre|choco|casanare|arauca|putumayo|guajira)\b/;
const METRO_RE = /\b(area metropolitana|valle de aburra|valle del aburra|amva|antioquia)\b/;

function matchesIn(segment: string): { slug: string; index: number }[] {
  const found: { slug: string; index: number }[] = [];
  for (const m of CATALOG) {
    const hit = m.re.exec(segment);
    if (hit) found.push({ slug: m.slug, index: hit.index });
  }
  return found.sort((a, b) => a.index - b.index);
}

export function normalizeMunicipality(text: string | null | undefined): Normalized<MunicipalityValue> {
  if (isBlank(text)) return result({ slug: null, remote: false }, "baja", "Municipio no indicado");

  const all = clean(text);
  const remote = REMOTE_RE.test(all);
  // El primer segmento es el municipio; lo demás suele ser departamento o país ("Medellín, Antioquia").
  const segments = fold(text)
    .split(/[,;()/|]| - /)
    .map(clean)
    .filter(Boolean);

  // "Barbosa, Santander" o "Manizales, Caldas": el municipio homónimo no es el del Valle de Aburrá.
  if (segments.slice(1).some((s) => ELSEWHERE_RE.test(s))) {
    return result({ slug: null, remote }, "alta", `Municipio fuera de cobertura: "${excerpt(text)}"`);
  }

  const first = matchesIn(segments[0] ?? "");
  if (first.length === 1) return result({ slug: first[0].slug, remote }, "alta");
  if (first.length > 1) {
    return result(
      { slug: first[0].slug, remote },
      "media",
      `La fuente menciona varios municipios ("${excerpt(text)}"): se tomó el primero`,
    );
  }

  // "Caldas" y "Barbosa" también son un departamento y un municipio de Santander: solo valen en primer lugar.
  const later = segments
    .slice(1)
    .flatMap(matchesIn)
    .filter((m) => m.slug !== "caldas" && m.slug !== "barbosa");
  if (later.length > 0) {
    return result(
      { slug: later[0].slug, remote },
      "media",
      `Municipio tomado de un texto compuesto ("${excerpt(text)}"); confirmar`,
    );
  }

  if (remote) return result({ slug: null, remote: true }, "alta");
  // "Colombia" a secas (común en los ATS): está en el país, pero no se sabe en qué municipio.
  if (segments.length > 0 && segments.every((s) => s === "colombia")) {
    return result({ slug: null, remote: false }, "media", `La fuente solo indica el país ("${excerpt(text)}")`);
  }
  if (METRO_RE.test(all)) {
    return result(
      { slug: null, remote: false },
      "media",
      `La fuente no precisa el municipio ("${excerpt(text)}")`,
    );
  }
  return result({ slug: null, remote: false }, "alta", `Municipio fuera de cobertura: "${excerpt(text)}"`);
}

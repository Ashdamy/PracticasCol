/** Programas y áreas aceptadas, emparejados contra el catálogo (AGENTS.md §5). Función pura. */
import { KNOWLEDGE_AREAS, PROGRAMS } from "@/lib/catalog/academic";
import type { Confidence, Normalized } from "../types";
import { clean, consumePhrase, excerpt, fold, isBlank, lowest, result } from "./text";

export interface ProgramsValue {
  programIds: string[];
  knowledgeAreaIds: string[];
  acceptsRelatedPrograms: boolean;
  openToAllPrograms: boolean;
}

const EMPTY: ProgramsValue = {
  programIds: [],
  knowledgeAreaIds: [],
  acceptsRelatedPrograms: false,
  openToAllPrograms: false,
};

/** Formas en que las convocatorias nombran a las personas en vez del programa. */
const ALIASES: [RegExp, string][] = [
  [/\badministrador(es|a|as)? de empresas\b/g, "administracion de empresas"],
  [/\bcontador(es|a|as)? public[oa]s?\b/g, "contaduria publica"],
  [/\bcontaduria\b(?! publica)/g, "contaduria publica"],
  [/\babogad[oa]s?\b/g, "derecho"],
  [/\bpsicolog[oa]s?\b/g, "psicologia"],
  [/\bcomunicador(es|a|as)? social(es)?\b/g, "comunicacion social"],
  [/\beconomistas?\b/g, "economia"],
  [/\benfermer[oa]s?\b/g, "enfermeria"],
  [/\bdisenador(es|a|as)? grafic[oa]s?\b/g, "diseno grafico"],
  [/\bmarketing\b/g, "mercadeo"],
  [/\btecnolog[oa]s? en\b/g, "tecnologia en"],
];

const PREFIX_RE =
  /^(?:ingenieria (?:de|en)|tecnologia en|tecnica profesional en|tecnico profesional en|tecnico en|especializacion en) /;

/** "ingenieros industriales" → "ingenieria industrial"; "ingeniero mecánico" → "ingenieria mecanica". */
function engineersToProgram(text: string): string {
  return text.replace(/\bingenier[oa]s?\b( [a-z]+)?/g, (_m, next: string | undefined) => {
    let word = (next ?? "").trim();
    if (word && word !== "de" && word !== "en") {
      if (/[^aeiou]es$/.test(word)) word = word.slice(0, -2);
      else if (/[oa]s$/.test(word)) word = `${word.slice(0, -2)}a`;
      else if (word.length > 2 && word.endsWith("o")) word = `${word.slice(0, -1)}a`;
    }
    return word ? `ingenieria ${word}` : "ingenieria";
  });
}

function applyAliases(text: string): string {
  return ALIASES.reduce((t, [re, to]) => t.replace(re, to), engineersToProgram(text));
}

interface Entry {
  phrase: string;
  ids: string[];
}

function byLength(a: Entry, b: Entry): number {
  return b.phrase.length - a.phrase.length;
}

function buildEntries(): { exact: Entry[]; variants: Entry[] } {
  const exact = new Map<string, string[]>();
  const variants = new Map<string, string[]>();
  for (const p of PROGRAMS) {
    const full = applyAliases(clean(p.name));
    exact.set(full, [...(exact.get(full) ?? []), p.id]);
    const short = full.replace(PREFIX_RE, "");
    if (short !== full && short.length >= 5) variants.set(short, [...(variants.get(short) ?? []), p.id]);
  }
  for (const phrase of exact.keys()) variants.delete(phrase);
  const toList = (m: Map<string, string[]>) => [...m].map(([phrase, ids]) => ({ phrase, ids })).sort(byLength);
  return { exact: toList(exact), variants: toList(variants) };
}

const ENTRIES = buildEntries();
const ENGINEERING_AREAS = KNOWLEDGE_AREAS.filter((a) => a.id.startsWith("nbc-ing-")).map((a) => a.id);

/** Áreas genéricas. `confidence` baja = demasiado amplio para confiar. */
const GENERIC_AREAS: { re: RegExp; ids: string[]; confidence: Confidence; label: string }[] = [
  {
    re: /\b(todas las |cualquier |areas? de |carreras? de |programas? de )?ingenierias\b|\b(cualquier|areas? de|carreras? de) ingenieria\b/g,
    ids: ENGINEERING_AREAS,
    confidence: "baja",
    label: "«ingenierías» es genérico: se asignaron todas las áreas de ingeniería",
  },
  {
    re: /\b((carreras|areas|ciencias|programas|profesiones) )?administrativ[ao]s\b/g,
    ids: ["nbc-administracion"],
    confidence: "media",
    label: "área genérica «administrativas»",
  },
  {
    re: /\b(carreras|areas|ciencias|programas) (contables|financieras)\b|\barea contable\b/g,
    ids: ["nbc-contaduria"],
    confidence: "media",
    label: "área genérica «contables»",
  },
  {
    re: /\bciencias economicas\b/g,
    ids: ["nbc-economia"],
    confidence: "media",
    label: "área genérica «ciencias económicas»",
  },
  {
    re: /\b(informatica|computacion|sistemas|tecnologias de la informacion)\b/g,
    ids: ["nbc-ing-sistemas"],
    confidence: "media",
    label: "área genérica de sistemas",
  },
  { re: /\badministracion\b/g, ids: ["nbc-administracion"], confidence: "media", label: "área «administración»" },
  {
    re: /\b(comunicacion(es)?|periodismo)\b/g,
    ids: ["nbc-comunicacion"],
    confidence: "media",
    label: "área «comunicación»",
  },
  { re: /\bdiseno\b/g, ids: ["nbc-diseno"], confidence: "media", label: "área «diseño»" },
  {
    re: /\b(telecomunicaciones|telematica)\b/g,
    ids: ["nbc-ing-electronica"],
    confidence: "media",
    label: "área de telecomunicaciones",
  },
];

const RELATED_RE = /\bafin(es)?\b|\bsimilares\b|\brelacionad[oa]s\b/;
const OPEN_RE =
  /\b(cualquier|todas las|todos los) (carreras?|programas?|profesion(es)?|areas?|disciplinas?)\b|\bno aplica restriccion\b/;

/** Palabras que no nombran un programa. */
const FILLER = new Set(
  (
    "de del la las el los en y o e u a al con que para por como tales ser estar " +
    "estudiante estudiantes carrera carreras programa programas afin afines area areas " +
    "profesional profesionales tecnologia tecnologias tecnologo tecnologos tecnico tecnicos tecnica tecnicas " +
    "ingenieria similares relacionadas relacionados cualquier todas todos otras otros " +
    "ultimo ultimos semestre semestres formacion titulo cursando cursar universitario universitarios " +
    "practicante practicantes aprendiz aprendices sena pregrado especializacion ciencias nivel"
  ).split(" "),
);

function unrecognizedChunks(rest: string): string[] {
  return rest
    .split("|")
    .flatMap((chunk) => chunk.split(/(?:^| )(?:y|o|e|u)(?= |$)/))
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.split(" ").some((w) => w.length >= 3 && !FILLER.has(w)));
}

export function normalizePrograms(text: string | null | undefined): Normalized<ProgramsValue> {
  if (isBlank(text)) return result(EMPTY, "alta");

  // Los separadores fuertes se conservan como "|" para no unir nombres de programas vecinos.
  let rest = fold(text)
    .split(/[,;:\n/•·|()]|\. /)
    .map((segment) => applyAliases(clean(segment)))
    .filter(Boolean)
    .join(" | ");

  const acceptsRelatedPrograms = RELATED_RE.test(rest);
  if (OPEN_RE.test(rest)) {
    return result({ ...EMPTY, openToAllPrograms: true }, "alta");
  }

  const programIds = new Set<string>();
  const knowledgeAreaIds = new Set<string>();
  const notes: string[] = [];
  let confidence: Confidence = "alta";

  for (const entry of ENTRIES.exact) {
    const [next, hit] = consumePhrase(rest, entry.phrase);
    if (hit) entry.ids.forEach((id) => programIds.add(id));
    rest = next;
  }
  for (const entry of ENTRIES.variants) {
    const [next, hit] = consumePhrase(rest, entry.phrase);
    if (!hit) continue;
    rest = next;
    entry.ids.forEach((id) => programIds.add(id));
    confidence = lowest(confidence, "media");
    notes.push(
      entry.ids.length > 1
        ? `«${entry.phrase}» coincide con ${entry.ids.length} programas del catálogo: se incluyeron todos`
        : `«${entry.phrase}» se emparejó por nombre abreviado`,
    );
  }
  for (const area of GENERIC_AREAS) {
    area.re.lastIndex = 0;
    if (!area.re.test(rest)) continue;
    rest = rest.replace(area.re, "|");
    area.ids.forEach((id) => knowledgeAreaIds.add(id));
    confidence = lowest(confidence, area.confidence);
    notes.push(`Programas: ${area.label}`);
  }

  const unknown = unrecognizedChunks(rest);
  const matchedSomething = programIds.size + knowledgeAreaIds.size > 0;
  if (unknown.length > 0) {
    confidence = lowest(confidence, matchedSomething ? "media" : "baja");
    notes.push(`Programas no reconocidos: ${unknown.map((u) => `«${excerpt(u, 60)}»`).join(", ")}`);
  } else if (!matchedSomething) {
    confidence = "baja";
    notes.push(`No se reconoció ningún programa en "${excerpt(text)}"`);
  }

  return result(
    {
      programIds: PROGRAMS.filter((p) => programIds.has(p.id)).map((p) => p.id),
      knowledgeAreaIds: KNOWLEDGE_AREAS.filter((a) => knowledgeAreaIds.has(a.id)).map((a) => a.id),
      acceptsRelatedPrograms,
      openToAllPrograms: false,
    },
    confidence,
    notes.length > 0 ? notes.join(". ") : undefined,
  );
}

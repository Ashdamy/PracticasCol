/** Tipo de oportunidad (AGENTS.md §5). Función pura. */
import type { OpportunityType } from "@/lib/contracts";
import type { Confidence, Normalized } from "../types";
import { clean, isBlank, lowest, result } from "./text";

const VAGUE_PRACTICE_NOTE = "La fuente dice «práctica» sin precisar: se asumió práctica profesional";
/** Los ATS internacionales publican en inglés: "intern" no distingue práctica, pasantía ni contrato de aprendizaje. */
export const ENGLISH_TYPE_NOTE = "Término en inglés; confirmar tipo";

interface TypeHit {
  type: OpportunityType;
  confidence: Confidence;
  note?: string;
}

function detect(n: string): TypeHit | null {
  if (/\bjudicaturas?\b/.test(n)) return { type: "judicatura", confidence: "alta" };
  if (/\b(contratos? de aprendizaje|aprendiz|aprendices|etapa productiva|cuota sena)\b/.test(n)) {
    return { type: "contrato_aprendizaje", confidence: "alta" };
  }
  if (/\bpasant(ia|ias|e|es)\b/.test(n)) return { type: "pasantia", confidence: "alta" };
  if (/\bpractica(s|nte|ntes)? empresarial(es)?\b/.test(n)) return { type: "practica_empresarial", confidence: "alta" };
  if (/\bpractica(s|nte|ntes)? (profesional(es)?|laboral(es)?|academicas?|universitari[ao]s?)\b/.test(n)) {
    return { type: "practica_profesional", confidence: "alta" };
  }
  // "Práctica" o "practicante" a secas: la fuente no distingue profesional de empresarial.
  if (/\bpractica(s|nte|ntes)?\b/.test(n)) {
    return { type: "practica_profesional", confidence: "media", note: VAGUE_PRACTICE_NOTE };
  }
  // Inglés ("Marketing Intern", "Summer Internship"). No coincide con "internal" ni "international".
  if (/\b(interns?|internships?)\b/.test(n)) {
    return { type: "practica_profesional", confidence: "media", note: ENGLISH_TYPE_NOTE };
  }
  // "Trainee" también nombra programas para recién graduados: confianza baja.
  if (/\btrainees?\b/.test(n)) return { type: "practica_profesional", confidence: "baja", note: ENGLISH_TYPE_NOTE };
  return null;
}

/**
 * @param fallbackText texto alterno (normalmente el título) si `text` no dice el tipo.
 * Devuelve `null` si no se reconoce: quien llama decide el valor por defecto.
 */
export function normalizeOpportunityType(
  text: string | null | undefined,
  fallbackText?: string | null,
): Normalized<OpportunityType | null> {
  if (!isBlank(text)) {
    const hit = detect(clean(text));
    if (hit) return result(hit.type, hit.confidence, hit.note);
  }
  if (!isBlank(fallbackText)) {
    const hit = detect(clean(fallbackText));
    if (hit) {
      return result(hit.type, lowest(hit.confidence, "media"), "Tipo de oportunidad deducido del título; confirmar");
    }
  }
  return result(null, "baja", "No se reconoció el tipo de oportunidad");
}

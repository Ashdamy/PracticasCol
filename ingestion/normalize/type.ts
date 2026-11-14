/** Tipo de oportunidad (AGENTS.md §5). Función pura. */
import type { OpportunityType } from "@/lib/contracts";
import type { Confidence, Normalized } from "../types";
import { clean, isBlank, result } from "./text";

function detect(n: string): { type: OpportunityType; confidence: Confidence } | null {
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
  if (/\bpractica(s|nte|ntes)?\b/.test(n)) return { type: "practica_profesional", confidence: "media" };
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
    if (hit) {
      return result(
        hit.type,
        hit.confidence,
        hit.confidence === "alta" ? undefined : "La fuente dice «práctica» sin precisar: se asumió práctica profesional",
      );
    }
  }
  if (!isBlank(fallbackText)) {
    const hit = detect(clean(fallbackText));
    if (hit) return result(hit.type, "media", "Tipo de oportunidad deducido del título; confirmar");
  }
  return result(null, "baja", "No se reconoció el tipo de oportunidad");
}

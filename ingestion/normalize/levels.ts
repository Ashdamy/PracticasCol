/** Niveles de formación aceptados. Función pura. */
import { EDUCATION_LEVELS, type EducationLevel } from "@/lib/contracts";
import type { Confidence, Normalized } from "../types";
import { clean, excerpt, isBlank, result } from "./text";

const TL = "\\btecnic[oa]s? laboral(?:es)?\\b";
const TP = "\\btecnic[oa]s? profesional(?:es)?\\b";
/** "Profesional" que NO habla del nivel de formación. */
const NOT_LEVEL = "\\b(?:practicas?|practicantes?|experiencia|perfil|desarrollo|crecimiento) profesional(?:es)?\\b";

export const ENGLISH_STUDENT_NOTE = "Término en inglés («student»): se asumió universitario; confirmar";

export function normalizeLevels(text: string | null | undefined): Normalized<EducationLevel[]> {
  if (isBlank(text)) return result([], "baja", "Nivel de formación no indicado");

  let rest = clean(text);
  const found = new Set<EducationLevel>();
  let confidence: Confidence = "alta";
  let note: string | undefined;

  if (/\b(todos los niveles|cualquier nivel)\b/.test(rest)) {
    return result([...EDUCATION_LEVELS], "media", "La fuente dice «todos los niveles»; confirmar");
  }

  if (new RegExp(TL).test(rest)) found.add("tecnico_laboral");
  if (new RegExp(TP).test(rest)) found.add("tecnico_profesional");
  rest = rest.replace(new RegExp(TL, "g"), " ").replace(new RegExp(TP, "g"), " ");

  if (/\btecnolog(o|a|os|as|ia|ias|ico|ica|icos|icas)\b/.test(rest)) found.add("tecnologo");
  if (/\b(especializacion(es)?|especialistas?|maestrias?|magister|posgrados?|postgrados?|doctorados?)\b/.test(rest)) {
    found.add("posgrado");
  }

  const withoutNoise = rest.replace(new RegExp(NOT_LEVEL, "g"), " ");
  if (/\b(universitari[oa]s?|pregrados?|profesional(es)?)\b/.test(withoutNoise)) found.add("universitario");

  if (/\btecnic[oa]s?\b/.test(rest)) {
    found.add("tecnico_laboral");
    found.add("tecnico_profesional");
    confidence = "media";
    note = "«Técnico» sin precisar: se asumió técnico laboral y técnico profesional";
  }

  if (found.size === 0 && /\b(sena|aprendiz|aprendices)\b/.test(rest)) {
    return result(
      ["tecnico_laboral", "tecnologo"],
      "baja",
      "Solo se menciona al SENA: se asumió técnico laboral y tecnólogo; confirmar",
    );
  }
  // Inglés de los ATS ("university student", "undergraduate"): no dice si es técnico, tecnólogo o universitario.
  if (found.size === 0 && /\b(students?|undergraduates?|undergrads?)\b/.test(rest)) {
    return result(["universitario"], "baja", ENGLISH_STUDENT_NOTE);
  }
  if (found.size === 0) {
    return result([], "baja", `No se reconoció el nivel de formación: "${excerpt(text)}"`);
  }
  return result(
    EDUCATION_LEVELS.filter((l) => found.has(l)),
    confidence,
    note,
  );
}

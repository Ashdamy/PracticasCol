import type {
  CheckStatus,
  EligibilityCriterion,
  EligibilityVerdict,
} from "./enums";

/**
 * Resultado del motor "¿Aplico?" (AGENTS.md §10).
 * `code` es estable: la UI puede mapearlo a su propio texto. `message` es el texto por defecto.
 */
export interface EligibilityCheck {
  criterion: EligibilityCriterion;
  status: CheckStatus;
  code: EligibilityCode;
  message: string;
}

export interface EligibilityResult {
  verdict: EligibilityVerdict;
  checks: EligibilityCheck[];
}

export type EligibilityCode =
  // nivel
  | "LEVEL_ACCEPTED"
  | "LEVEL_NOT_ACCEPTED"
  | "LEVEL_NOT_SPECIFIED"
  // programa
  | "PROGRAM_ANY"
  | "PROGRAM_LISTED"
  | "PROGRAM_AREA_LISTED"
  | "PROGRAM_RELATED_AREA"
  | "PROGRAM_UNKNOWN_IN_PROFILE"
  | "PROGRAM_NOT_LISTED"
  | "PROGRAM_NOT_SPECIFIED"
  // semestre
  | "SEMESTER_IN_RANGE"
  | "SEMESTER_OUT_OF_RANGE"
  | "SEMESTER_NOT_SPECIFIED"
  | "SEMESTER_UNKNOWN_IN_PROFILE"
  | "GRADUATE_ACCEPTED"
  | "GRADUATE_NOT_ACCEPTED"
  | "GRADUATE_UNKNOWN"
  // institución
  | "INSTITUTION_OPEN"
  | "INSTITUTION_LISTED"
  | "INSTITUTION_NOT_LISTED"
  // fecha límite
  | "DEADLINE_OPEN"
  | "DEADLINE_PASSED"
  | "DEADLINE_UNTIL_FILLED"
  | "DEADLINE_NOT_PUBLISHED"
  // otros
  | "OTHER_REQUIREMENTS";

export const ELIGIBILITY_DISCLAIMER = "Confirma los requisitos en la convocatoria oficial.";

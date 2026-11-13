/**
 * Motor "¿Aplico?" (AGENTS.md §10). Funciones puras, deterministas e isomórficas.
 * Regla de oro: ante la duda → `revisar`, nunca `no_cumple`.
 */
import type {
  CheckStatus,
  DeadlineType,
  EducationLevel,
  EligibilityCheck,
  EligibilityCode,
  EligibilityCriterion,
  EligibilityResult,
  EligibilityVerdict,
} from "@/lib/contracts";
import { daysBetween } from "@/lib/time";

/** Requisitos de una oportunidad tal como los necesita el motor. */
export interface EligibilityOpportunity {
  /** Vacío = no especifica nivel. */
  levels: readonly EducationLevel[];
  /** La convocatoria dice explícitamente "cualquier carrera / todos los programas". */
  openToAllPrograms: boolean;
  /** Programas mencionados explícitamente. */
  programIds: readonly string[];
  /** Áreas (NBC) aceptadas explícitamente, p. ej. "carreras administrativas". */
  knowledgeAreaIds: readonly string[];
  /** Áreas (NBC) de los programas mencionados; se usa para interpretar "y afines". */
  programKnowledgeAreaIds: readonly string[];
  acceptsRelatedPrograms: boolean;
  semesterMin: number | null;
  semesterMax: number | null;
  /** true/false si la convocatoria lo dice; null si no lo menciona. */
  acceptsGraduates: boolean | null;
  /** null = abierta a cualquier institución. */
  institutionIds: readonly string[] | null;
  deadline: { type: DeadlineType; date: string | null };
  otherRequirements: readonly string[];
}

/** Perfil del estudiante con el área de su programa ya resuelta desde el catálogo. */
export interface EligibilityProfile {
  level: EducationLevel;
  institutionId: string;
  programId: string;
  /** NBC del programa del estudiante; null si el programa no está en el catálogo. */
  programKnowledgeAreaId: string | null;
  semester: number | null;
  isGraduate: boolean;
}

const check = (
  criterion: EligibilityCriterion,
  status: CheckStatus,
  code: EligibilityCode,
  message: string,
): EligibilityCheck => ({ criterion, status, code, message });

function checkLevel(o: EligibilityOpportunity, p: EligibilityProfile): EligibilityCheck {
  if (o.levels.length === 0)
    return check("nivel", "desconocido", "LEVEL_NOT_SPECIFIED", "La convocatoria no indica el nivel de formación.");
  if (o.levels.includes(p.level))
    return check("nivel", "cumple", "LEVEL_ACCEPTED", "Tu nivel de formación es aceptado.");
  return check("nivel", "no_cumple", "LEVEL_NOT_ACCEPTED", "Esta convocatoria es para otro nivel de formación.");
}

function checkProgram(o: EligibilityOpportunity, p: EligibilityProfile): EligibilityCheck {
  if (o.openToAllPrograms)
    return check("programa", "cumple", "PROGRAM_ANY", "Está abierta a estudiantes de cualquier programa.");
  if (o.programIds.includes(p.programId))
    return check("programa", "cumple", "PROGRAM_LISTED", "Tu programa aparece en la convocatoria.");
  const nothingSpecified = o.programIds.length === 0 && o.knowledgeAreaIds.length === 0;
  if (nothingSpecified)
    return check("programa", "desconocido", "PROGRAM_NOT_SPECIFIED", "La convocatoria no indica qué programas acepta.");
  if (!p.programKnowledgeAreaId)
    return check("programa", "desconocido", "PROGRAM_UNKNOWN_IN_PROFILE", "No pudimos comparar tu programa con los solicitados.");
  if (o.knowledgeAreaIds.includes(p.programKnowledgeAreaId))
    return check("programa", "cumple", "PROGRAM_AREA_LISTED", "Tu programa pertenece a un área aceptada.");
  if (o.acceptsRelatedPrograms && o.programKnowledgeAreaIds.includes(p.programKnowledgeAreaId))
    return check(
      "programa",
      "verificar",
      "PROGRAM_RELATED_AREA",
      "Piden programas afines al tuyo. Verifica si tu programa se considera afín.",
    );
  return check("programa", "no_cumple", "PROGRAM_NOT_LISTED", "Tu programa no está entre los solicitados.");
}

function checkSemester(o: EligibilityOpportunity, p: EligibilityProfile): EligibilityCheck {
  if (p.isGraduate) {
    if (o.acceptsGraduates === true)
      return check("semestre", "cumple", "GRADUATE_ACCEPTED", "Aceptan egresados o estudiantes con materias terminadas.");
    if (o.acceptsGraduates === false)
      return check("semestre", "no_cumple", "GRADUATE_NOT_ACCEPTED", "Esta convocatoria es solo para estudiantes activos.");
    return check("semestre", "verificar", "GRADUATE_UNKNOWN", "No dice si acepta egresados. Verifícalo en la convocatoria.");
  }
  if (o.semesterMin === null && o.semesterMax === null)
    return check("semestre", "desconocido", "SEMESTER_NOT_SPECIFIED", "La convocatoria no indica un semestre mínimo.");
  if (p.semester === null)
    return check("semestre", "desconocido", "SEMESTER_UNKNOWN_IN_PROFILE", "Agrega tu semestre al perfil para comprobar este requisito.");
  const min = o.semesterMin ?? 1;
  const max = o.semesterMax ?? Infinity;
  if (p.semester >= min && p.semester <= max)
    return check("semestre", "cumple", "SEMESTER_IN_RANGE", "Tu semestre está dentro del rango solicitado.");
  return check(
    "semestre",
    "no_cumple",
    "SEMESTER_OUT_OF_RANGE",
    o.semesterMax === null
      ? `Piden estar desde ${min}.º semestre.`
      : `Piden estar entre ${min}.º y ${o.semesterMax}.º semestre.`,
  );
}

function checkInstitution(o: EligibilityOpportunity, p: EligibilityProfile): EligibilityCheck {
  if (o.institutionIds === null)
    return check("institucion", "cumple", "INSTITUTION_OPEN", "Está abierta a estudiantes de cualquier institución.");
  if (o.institutionIds.includes(p.institutionId))
    return check("institucion", "cumple", "INSTITUTION_LISTED", "Tu institución está incluida.");
  return check("institucion", "no_cumple", "INSTITUTION_NOT_LISTED", "Es exclusiva para estudiantes de otras instituciones.");
}

export function checkDeadline(o: Pick<EligibilityOpportunity, "deadline">, today: string): EligibilityCheck {
  const { type, date } = o.deadline;
  if (type === "hasta_agotar_cupos")
    return check("fecha_limite", "verificar", "DEADLINE_UNTIL_FILLED", "Abierta hasta agotar cupos: postúlate pronto.");
  if (type === "no_publicada" || !date)
    return check("fecha_limite", "desconocido", "DEADLINE_NOT_PUBLISHED", "No publicaron fecha límite. Consulta la fuente.");
  const left = daysBetween(today, date);
  if (left < 0) return check("fecha_limite", "no_cumple", "DEADLINE_PASSED", "Esta convocatoria ya cerró.");
  const msg = left === 0 ? "Cierra hoy." : left === 1 ? "Cierra mañana." : `Cierra en ${left} días.`;
  return check("fecha_limite", "cumple", "DEADLINE_OPEN", msg);
}

function checkOther(o: EligibilityOpportunity): EligibilityCheck | null {
  if (o.otherRequirements.length === 0) return null;
  return check("otros", "verificar", "OTHER_REQUIREMENTS", `Revisa también: ${o.otherRequirements.join("; ")}.`);
}

export function verdictFromChecks(checks: readonly EligibilityCheck[]): Exclude<EligibilityVerdict, "sin_perfil"> {
  if (checks.some((c) => c.status === "no_cumple")) return "no_cumple";
  const ok = (criterion: EligibilityCriterion) =>
    checks.some((c) => c.criterion === criterion && c.status === "cumple");
  return ok("nivel") && ok("programa") ? "cumple" : "revisar";
}

/**
 * Evalúa si el estudiante cumple los requisitos de una oportunidad.
 * @param today fecha `yyyy-mm-dd` en hora de Colombia (usa `todayInBogota()`).
 */
export function evaluateEligibility(
  opportunity: EligibilityOpportunity,
  profile: EligibilityProfile | null,
  today: string,
): EligibilityResult {
  if (!profile) return { verdict: "sin_perfil", checks: [] };
  const checks = [
    checkLevel(opportunity, profile),
    checkProgram(opportunity, profile),
    checkSemester(opportunity, profile),
    checkInstitution(opportunity, profile),
    checkDeadline(opportunity, today),
    checkOther(opportunity),
  ].filter((c): c is EligibilityCheck => c !== null);
  return { verdict: verdictFromChecks(checks), checks };
}

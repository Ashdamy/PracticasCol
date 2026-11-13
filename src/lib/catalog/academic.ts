/**
 * Catálogo académico semilla (AGENTS.md §5).
 * - knowledgeAreas: Núcleos Básicos del Conocimiento (NBC, SNIES) — subconjunto inicial.
 * - programs: programas "canónicos" (el nombre con el que las convocatorias los mencionan).
 * - institutions: instituciones del Valle de Aburrá.
 * En la Fase 1 esto se mueve a tablas (supabase/seed) y se completa con datos abiertos de SNIES/SENA.
 * Las listas institución→programa son ilustrativas; deben validarse contra SNIES.
 */
import type { EducationLevel } from "@/lib/contracts";

export interface KnowledgeArea {
  id: string;
  name: string;
}

export interface Program {
  id: string;
  name: string;
  level: EducationLevel;
  knowledgeAreaId: string;
}

export interface Institution {
  id: string;
  name: string;
  shortName: string;
  sector: "publica" | "privada";
  programIds: string[];
}

export const KNOWLEDGE_AREAS: readonly KnowledgeArea[] = [
  { id: "nbc-administracion", name: "Administración" },
  { id: "nbc-contaduria", name: "Contaduría pública" },
  { id: "nbc-economia", name: "Economía" },
  { id: "nbc-ing-industrial", name: "Ingeniería industrial y afines" },
  { id: "nbc-ing-sistemas", name: "Ingeniería de sistemas, telemática y afines" },
  { id: "nbc-ing-civil", name: "Ingeniería civil y afines" },
  { id: "nbc-ing-electronica", name: "Ingeniería electrónica, telecomunicaciones y afines" },
  { id: "nbc-ing-mecanica", name: "Ingeniería mecánica y afines" },
  { id: "nbc-ing-ambiental", name: "Ingeniería ambiental, sanitaria y afines" },
  { id: "nbc-derecho", name: "Derecho y afines" },
  { id: "nbc-psicologia", name: "Psicología" },
  { id: "nbc-comunicacion", name: "Comunicación social, periodismo y afines" },
  { id: "nbc-diseno", name: "Diseño" },
  { id: "nbc-enfermeria", name: "Enfermería" },
];

export const PROGRAMS: readonly Program[] = [
  // Universitario
  { id: "prog-adm-empresas", name: "Administración de Empresas", level: "universitario", knowledgeAreaId: "nbc-administracion" },
  { id: "prog-negocios-int", name: "Negocios Internacionales", level: "universitario", knowledgeAreaId: "nbc-administracion" },
  { id: "prog-mercadeo", name: "Mercadeo", level: "universitario", knowledgeAreaId: "nbc-administracion" },
  { id: "prog-contaduria", name: "Contaduría Pública", level: "universitario", knowledgeAreaId: "nbc-contaduria" },
  { id: "prog-economia", name: "Economía", level: "universitario", knowledgeAreaId: "nbc-economia" },
  { id: "prog-ing-industrial", name: "Ingeniería Industrial", level: "universitario", knowledgeAreaId: "nbc-ing-industrial" },
  { id: "prog-ing-produccion", name: "Ingeniería de Producción", level: "universitario", knowledgeAreaId: "nbc-ing-industrial" },
  { id: "prog-ing-sistemas", name: "Ingeniería de Sistemas", level: "universitario", knowledgeAreaId: "nbc-ing-sistemas" },
  { id: "prog-ing-software", name: "Ingeniería de Software", level: "universitario", knowledgeAreaId: "nbc-ing-sistemas" },
  { id: "prog-ing-civil", name: "Ingeniería Civil", level: "universitario", knowledgeAreaId: "nbc-ing-civil" },
  { id: "prog-ing-electronica", name: "Ingeniería Electrónica", level: "universitario", knowledgeAreaId: "nbc-ing-electronica" },
  { id: "prog-ing-mecanica", name: "Ingeniería Mecánica", level: "universitario", knowledgeAreaId: "nbc-ing-mecanica" },
  { id: "prog-ing-ambiental", name: "Ingeniería Ambiental", level: "universitario", knowledgeAreaId: "nbc-ing-ambiental" },
  { id: "prog-derecho", name: "Derecho", level: "universitario", knowledgeAreaId: "nbc-derecho" },
  { id: "prog-psicologia", name: "Psicología", level: "universitario", knowledgeAreaId: "nbc-psicologia" },
  { id: "prog-comunicacion", name: "Comunicación Social", level: "universitario", knowledgeAreaId: "nbc-comunicacion" },
  { id: "prog-diseno-grafico", name: "Diseño Gráfico", level: "universitario", knowledgeAreaId: "nbc-diseno" },
  { id: "prog-enfermeria", name: "Enfermería", level: "universitario", knowledgeAreaId: "nbc-enfermeria" },
  // Tecnólogo
  { id: "prog-tec-desarrollo-sw", name: "Tecnología en Desarrollo de Software", level: "tecnologo", knowledgeAreaId: "nbc-ing-sistemas" },
  { id: "prog-tec-analisis-sw", name: "Tecnólogo en Análisis y Desarrollo de Software", level: "tecnologo", knowledgeAreaId: "nbc-ing-sistemas" },
  { id: "prog-tec-gestion-adm", name: "Tecnología en Gestión Administrativa", level: "tecnologo", knowledgeAreaId: "nbc-administracion" },
  { id: "prog-tec-logistica", name: "Tecnología en Gestión Logística", level: "tecnologo", knowledgeAreaId: "nbc-ing-industrial" },
  { id: "prog-tec-contable", name: "Tecnología en Gestión Contable y Financiera", level: "tecnologo", knowledgeAreaId: "nbc-contaduria" },
  { id: "prog-tec-electronica", name: "Tecnología en Electrónica", level: "tecnologo", knowledgeAreaId: "nbc-ing-electronica" },
  { id: "prog-tec-mecatronica", name: "Tecnología en Mecatrónica", level: "tecnologo", knowledgeAreaId: "nbc-ing-mecanica" },
  // Técnico profesional / laboral
  { id: "prog-tp-sistemas", name: "Técnica Profesional en Sistemas", level: "tecnico_profesional", knowledgeAreaId: "nbc-ing-sistemas" },
  { id: "prog-tp-mercadeo", name: "Técnica Profesional en Mercadeo", level: "tecnico_profesional", knowledgeAreaId: "nbc-administracion" },
  { id: "prog-tl-asistencia-adm", name: "Técnico en Asistencia Administrativa", level: "tecnico_laboral", knowledgeAreaId: "nbc-administracion" },
  { id: "prog-tl-contabilizacion", name: "Técnico en Contabilización de Operaciones Comerciales y Financieras", level: "tecnico_laboral", knowledgeAreaId: "nbc-contaduria" },
  { id: "prog-tl-programacion", name: "Técnico en Programación de Software", level: "tecnico_laboral", knowledgeAreaId: "nbc-ing-sistemas" },
  // Posgrado
  { id: "prog-esp-gerencia-proyectos", name: "Especialización en Gerencia de Proyectos", level: "posgrado", knowledgeAreaId: "nbc-administracion" },
];

const UNI_CORE = [
  "prog-adm-empresas", "prog-contaduria", "prog-economia", "prog-ing-industrial",
  "prog-ing-sistemas", "prog-ing-civil", "prog-derecho", "prog-psicologia", "prog-comunicacion",
];

export const INSTITUTIONS: readonly Institution[] = [
  { id: "inst-udea", name: "Universidad de Antioquia", shortName: "UdeA", sector: "publica",
    programIds: [...UNI_CORE, "prog-ing-electronica", "prog-ing-mecanica", "prog-ing-ambiental", "prog-enfermeria"] },
  { id: "inst-unal-med", name: "Universidad Nacional de Colombia - Sede Medellín", shortName: "UNAL Medellín", sector: "publica",
    programIds: ["prog-ing-industrial", "prog-ing-sistemas", "prog-ing-civil", "prog-ing-mecanica", "prog-ing-ambiental", "prog-economia"] },
  { id: "inst-eafit", name: "Universidad EAFIT", shortName: "EAFIT", sector: "privada",
    programIds: [...UNI_CORE, "prog-negocios-int", "prog-mercadeo", "prog-ing-produccion", "prog-ing-mecanica", "prog-diseno-grafico", "prog-esp-gerencia-proyectos"] },
  { id: "inst-upb", name: "Universidad Pontificia Bolivariana", shortName: "UPB", sector: "privada",
    programIds: [...UNI_CORE, "prog-ing-electronica", "prog-ing-mecanica", "prog-diseno-grafico", "prog-negocios-int", "prog-esp-gerencia-proyectos"] },
  { id: "inst-udem", name: "Universidad de Medellín", shortName: "UdeM", sector: "privada",
    programIds: [...UNI_CORE, "prog-mercadeo", "prog-negocios-int"] },
  { id: "inst-ces", name: "Universidad CES", shortName: "CES", sector: "privada",
    programIds: ["prog-psicologia", "prog-derecho", "prog-enfermeria", "prog-adm-empresas"] },
  { id: "inst-eia", name: "Universidad EIA", shortName: "EIA", sector: "privada",
    programIds: ["prog-ing-industrial", "prog-ing-civil", "prog-ing-sistemas", "prog-ing-ambiental", "prog-ing-mecanica"] },
  { id: "inst-ucc-med", name: "Universidad Cooperativa de Colombia - Medellín", shortName: "UCC", sector: "privada",
    programIds: ["prog-derecho", "prog-psicologia", "prog-contaduria", "prog-adm-empresas", "prog-ing-sistemas", "prog-enfermeria"] },
  { id: "inst-amigo", name: "Universidad Católica Luis Amigó", shortName: "Luis Amigó", sector: "privada",
    programIds: ["prog-psicologia", "prog-derecho", "prog-contaduria", "prog-adm-empresas", "prog-ing-sistemas", "prog-comunicacion"] },
  { id: "inst-usb-med", name: "Universidad de San Buenaventura - Medellín", shortName: "USB", sector: "privada",
    programIds: ["prog-psicologia", "prog-derecho", "prog-ing-sistemas", "prog-ing-electronica", "prog-adm-empresas"] },
  { id: "inst-unaula", name: "Universidad Autónoma Latinoamericana", shortName: "UNAULA", sector: "privada",
    programIds: ["prog-derecho", "prog-contaduria", "prog-economia", "prog-ing-industrial", "prog-adm-empresas"] },
  { id: "inst-uniminuto-ant", name: "Corporación Universitaria Minuto de Dios - Antioquia", shortName: "Uniminuto", sector: "privada",
    programIds: ["prog-adm-empresas", "prog-contaduria", "prog-psicologia", "prog-comunicacion", "prog-tec-logistica"] },
  { id: "inst-ceipa", name: "CEIPA Business School", shortName: "CEIPA", sector: "privada",
    programIds: ["prog-adm-empresas", "prog-negocios-int", "prog-mercadeo", "prog-tec-gestion-adm"] },
  { id: "inst-esumer", name: "Institución Universitaria Esumer", shortName: "ESUMER", sector: "publica",
    programIds: ["prog-negocios-int", "prog-mercadeo", "prog-adm-empresas", "prog-contaduria", "prog-tec-logistica"] },
  { id: "inst-itm", name: "Instituto Tecnológico Metropolitano", shortName: "ITM", sector: "publica",
    programIds: ["prog-ing-sistemas", "prog-ing-electronica", "prog-ing-mecanica", "prog-ing-produccion", "prog-tec-desarrollo-sw", "prog-tec-electronica", "prog-tec-mecatronica", "prog-tec-contable"] },
  { id: "inst-pascual-bravo", name: "Institución Universitaria Pascual Bravo", shortName: "Pascual Bravo", sector: "publica",
    programIds: ["prog-ing-mecanica", "prog-ing-electronica", "prog-ing-sistemas", "prog-tec-desarrollo-sw", "prog-tec-mecatronica", "prog-tec-electronica", "prog-diseno-grafico"] },
  { id: "inst-poli-jic", name: "Politécnico Colombiano Jaime Isaza Cadavid", shortName: "Poli JIC", sector: "publica",
    programIds: ["prog-ing-industrial", "prog-ing-sistemas", "prog-ing-civil", "prog-contaduria", "prog-adm-empresas", "prog-tec-gestion-adm", "prog-tec-logistica", "prog-tp-sistemas", "prog-comunicacion"] },
  { id: "inst-colmayor", name: "Institución Universitaria Colegio Mayor de Antioquia", shortName: "Colmayor", sector: "publica",
    programIds: ["prog-ing-ambiental", "prog-adm-empresas", "prog-tec-gestion-adm", "prog-tp-mercadeo"] },
  { id: "inst-tdea", name: "Tecnológico de Antioquia", shortName: "TdeA", sector: "publica",
    programIds: ["prog-ing-sistemas", "prog-ing-ambiental", "prog-psicologia", "prog-contaduria", "prog-derecho", "prog-tec-desarrollo-sw", "prog-tec-contable", "prog-tp-sistemas"] },
  { id: "inst-sena-ant", name: "SENA - Regional Antioquia", shortName: "SENA", sector: "publica",
    programIds: ["prog-tec-analisis-sw", "prog-tec-gestion-adm", "prog-tec-logistica", "prog-tec-contable", "prog-tec-electronica", "prog-tec-mecatronica", "prog-tl-asistencia-adm", "prog-tl-contabilizacion", "prog-tl-programacion"] },
];

const programById = new Map(PROGRAMS.map((p) => [p.id, p]));
const institutionById = new Map(INSTITUTIONS.map((i) => [i.id, i]));
const areaById = new Map(KNOWLEDGE_AREAS.map((a) => [a.id, a]));

export const getProgram = (id: string | null | undefined) => (id ? programById.get(id) : undefined);
export const getInstitution = (id: string | null | undefined) => (id ? institutionById.get(id) : undefined);
export const getKnowledgeArea = (id: string | null | undefined) => (id ? areaById.get(id) : undefined);

/** Niveles que ofrece una institución (derivado de sus programas). */
export function institutionLevels(inst: Institution): EducationLevel[] {
  return [...new Set(inst.programIds.map((id) => programById.get(id)?.level).filter(Boolean))] as EducationLevel[];
}

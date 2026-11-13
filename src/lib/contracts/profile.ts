import { z } from "zod";
import { EducationLevelSchema, ModalitySchema } from "./enums";

/**
 * Perfil académico del estudiante (AGENTS.md §10).
 * En v1 vive en la cookie `pc_profile` (sin datos personales, sin cuenta).
 */
export const StudentProfileSchema = z.object({
  institutionId: z.string().min(1, "Elige tu institución"),
  programId: z.string().min(1, "Elige tu programa"),
  level: EducationLevelSchema,
  /** Semestre o trimestre actual (1–12). `null` si no aplica o no lo quiere indicar. */
  semester: z.number().int().min(1).max(12).nullable(),
  /** Ya terminó materias o es egresado (relevante para judicatura y algunas prácticas). */
  isGraduate: z.boolean().default(false),
  municipality: z.string().min(1).nullable().default(null),
  preferredModalities: z.array(ModalitySchema).default([]),
});

export type StudentProfile = z.infer<typeof StudentProfileSchema>;
/** Lo que se envía a `saveProfile` (los campos con default son opcionales). */
export type StudentProfileInput = z.input<typeof StudentProfileSchema>;

export const PROFILE_COOKIE = "pc_profile";

"use server";
/**
 * ★ Server actions del perfil (AGENTS.md §11). Se pueden llamar desde client components:
 *   const res = await saveProfile({ institutionId, programId, level, semester, ... })
 * Nunca lanzan: devuelven ActionResult.
 */
import { revalidatePath } from "next/cache";
import {
  StudentProfileSchema,
  zodFieldErrors,
  type ActionResult,
  type StudentProfile,
  type StudentProfileInput,
} from "@/lib/contracts";
import { getInstitution, getProgram } from "@/lib/catalog/academic";
import { getMunicipality } from "@/lib/catalog/geo";
import { deleteProfileCookie, writeProfileCookie } from "@/server/profile";

export async function saveProfile(input: StudentProfileInput): Promise<ActionResult<StudentProfile>> {
  const parsed = StudentProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisa los datos del perfil.", fieldErrors: zodFieldErrors(parsed.error) },
    };
  }
  const profile = parsed.data;
  const fieldErrors: Record<string, string> = {};
  const program = getProgram(profile.programId);
  if (!getInstitution(profile.institutionId)) fieldErrors.institutionId = "Institución no encontrada.";
  if (!program) fieldErrors.programId = "Programa no encontrado.";
  else if (program.level !== profile.level)
    fieldErrors.level = "El nivel no coincide con el programa elegido.";
  if (profile.municipality && !getMunicipality(profile.municipality))
    fieldErrors.municipality = "Municipio no válido.";
  // Nota: no se exige que la institución ofrezca el programa; el catálogo semilla aún es incompleto.
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: { code: "VALIDATION", message: "Revisa los datos del perfil.", fieldErrors } };
  }

  try {
    await writeProfileCookie(profile);
    revalidatePath("/", "layout");
    return { ok: true, data: profile };
  } catch (e) {
    console.error("[saveProfile]", e);
    return { ok: false, error: { code: "INTERNAL", message: "No pudimos guardar tu perfil. Intenta de nuevo." } };
  }
}

export async function clearProfile(): Promise<ActionResult<null>> {
  try {
    await deleteProfileCookie();
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    console.error("[clearProfile]", e);
    return { ok: false, error: { code: "INTERNAL", message: "No pudimos borrar tu perfil. Intenta de nuevo." } };
  }
}

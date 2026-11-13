import "server-only";
import { cookies } from "next/headers";
import { PROFILE_COOKIE, StudentProfileSchema, type StudentProfile } from "@/lib/contracts";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function encodeProfile(profile: StudentProfile): string {
  return Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
}

export function decodeProfile(value: string | undefined): StudentProfile | null {
  if (!value) return null;
  try {
    const parsed = StudentProfileSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Lee el perfil de la cookie (Server Components, queries y actions). Cookie inválida → null. */
export async function readProfileCookie(): Promise<StudentProfile | null> {
  const store = await cookies();
  return decodeProfile(store.get(PROFILE_COOKIE)?.value);
}

/** Solo desde Server Functions / Route Handlers. */
export async function writeProfileCookie(profile: StudentProfile): Promise<void> {
  const store = await cookies();
  store.set(PROFILE_COOKIE, encodeProfile(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function deleteProfileCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PROFILE_COOKIE);
}

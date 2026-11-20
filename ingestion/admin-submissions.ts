/**
 * Contacto privado de las convocatorias enviadas por el formulario «Publica tu práctica»
 * (tabla `opportunity_submissions`). Solo lo usa el CLI de administración: nunca se muestra en el sitio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrap, type DbResult } from "@/server/repo/supabase-shared";

export interface SubmissionContact {
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export async function submissionContacts(client: SupabaseClient, opportunityId: string): Promise<SubmissionContact[]> {
  const result: DbResult<unknown> = await client
    .from("opportunity_submissions")
    .select("contact_name, contact_email, contact_role, created_at")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: true });
  const rows = (unwrap(result, "leer el contacto de la publicación") ?? []) as {
    contact_name: string;
    contact_email: string;
    contact_role: string;
    created_at: string;
  }[];
  return rows.map((r) => ({ name: r.contact_name, email: r.contact_email, role: r.contact_role, createdAt: r.created_at }));
}

/** Líneas para el detalle de `ver`. Vacío si la convocatoria no vino del formulario. */
export function formatSubmissionContacts(contacts: readonly SubmissionContact[]): string {
  if (contacts.length === 0) return "";
  const lines = ["Enviada por (privado, solo para verificar):"];
  for (const c of contacts) {
    lines.push(`  - ${c.name}${c.role ? ` (${c.role})` : ""} <${c.email}> el ${c.createdAt.slice(0, 16).replace("T", " ")} UTC`);
  }
  return lines.join("\n");
}

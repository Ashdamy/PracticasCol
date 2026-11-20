/**
 * Configuración local para los comandos de terminal (`npm run ingest`, `npm run admin`).
 * Vive aparte de `stores/supabase.ts` porque el sitio importa ese store: si leyera el disco, Vercel empaquetaría
 * todo el proyecto en la función del servidor.
 */
import { existsSync } from "node:fs";
import { createSupabaseAdminClient, readSupabaseEnv } from "@/server/repo/supabase-shared";
import { createSupabaseStore, type SupabaseStore } from "./stores/supabase";

/** Carga `.env.local` (si existe) sin pisar las variables que ya vengan del entorno. */
export function loadLocalEnv(path = ".env.local"): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

/** Abre el store con la configuración de `.env.local`. Lanza un error claro si falta algo. */
export function openSupabaseStore(): SupabaseStore {
  loadLocalEnv();
  return createSupabaseStore(createSupabaseAdminClient(readSupabaseEnv()));
}

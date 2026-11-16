/**
 * Piezas comunes para hablar con Supabase desde el servidor y desde los scripts (`ingestion/`).
 *
 * ⚠ La clave secreta (`SUPABASE_SERVICE_ROLE_KEY`) omite RLS. Solo se lee de variables de entorno SIN el
 * prefijo `NEXT_PUBLIC_`, así que Next nunca la incluye en el código del navegador. No la imprimas ni la
 * pongas en mensajes de error. Este módulo no lleva `import "server-only"` porque también lo usan los
 * scripts de `ingestion/` (tsx); la app lo usa solo a través de `supabase.ts`, que sí lo lleva.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseEnv {
  url: string;
  secretKey: string;
}

export const SUPABASE_URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_SECRET_VAR = "SUPABASE_SERVICE_ROLE_KEY";

/** Lee la configuración o lanza un error claro (sin mostrar valores). */
export function readSupabaseEnv(env: Record<string, string | undefined> = process.env): SupabaseEnv {
  const url = env[SUPABASE_URL_VAR]?.trim();
  const secretKey = env[SUPABASE_SECRET_VAR]?.trim();
  if (!url || !secretKey) {
    const missing = [!url && SUPABASE_URL_VAR, !secretKey && SUPABASE_SECRET_VAR].filter(Boolean);
    throw new Error(
      `Falta configurar Supabase: ${missing.join(" y ")}. Agrégalas en .env.local (ver .env.example) o usa USE_MOCKS=true para trabajar con los datos de prueba.`,
    );
  }
  if (!/^https:\/\//.test(url)) {
    throw new Error(`${SUPABASE_URL_VAR} debe ser una URL https (p. ej. https://<ref>.supabase.co).`);
  }
  return { url, secretKey };
}

/** Cliente con la clave secreta: sin sesión, sin refresco de tokens y sin caché de `fetch`. */
export function createSupabaseAdminClient(env: SupabaseEnv = readSupabaseEnv()): SupabaseClient {
  return createClient(env.url, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export interface DbError {
  message: string;
  code?: string;
}

export interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

/** Código de Postgres para "llave duplicada". */
export const UNIQUE_VIOLATION = "23505";

/** Devuelve `data` o lanza un error en español que dice qué se estaba haciendo. */
export function unwrap<T>(result: DbResult<T>, doing: string): T {
  if (result.error) throw new Error(`Supabase: no se pudo ${doing}: ${result.error.message}`);
  return result.data as T;
}

export const PAGE_SIZE = 1000;

/**
 * Trae todas las filas de una consulta paginando con `range` (PostgREST corta en 1.000 filas por respuesta).
 * La consulta debe venir con un orden estable.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<DbResult<unknown>>,
  doing: string,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const batch = (unwrap(await page(from, from + pageSize - 1), doing) ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID.test(value);

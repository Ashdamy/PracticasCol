/**
 * Organizaciones (empresas) en el CLI de administración: listado, búsqueda por nombre y cambio del sitio web
 * o del logo. Las reglas son puras; las dos funciones que hablan con Supabase reciben el cliente, para poder
 * probarlas con el cliente falso. El logo se arma en `src/server/domain/logos.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isLogoExcluded, logoUrlFor, websiteDomain } from "@/server/domain/logos";
import { fetchAll, unwrap, type DbResult } from "@/server/repo/supabase-shared";

export interface AdminOrganization {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
}

export interface AdminOrganizationRow {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
}

export const ORGANIZATION_SELECT = "id, name, website, logo_url";

export function rowToAdminOrganization(row: AdminOrganizationRow): AdminOrganization {
  return { id: row.id, name: row.name, website: row.website, logoUrl: row.logo_url };
}

/** Comparable: minúsculas, sin tildes y con espacios simples. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca una organización por nombre exacto o por una parte única del nombre (sin importar tildes ni mayúsculas).
 * @throws si no hay ninguna o si la parte coincide con varias (el mensaje las nombra).
 */
export function resolveOrganization<T extends Pick<AdminOrganization, "name">>(key: string, all: readonly T[]): T {
  const wanted = fold(key);
  if (!wanted) throw new Error('Falta el nombre de la empresa: npm run admin -- empresa "<nombre>" --sitio <dominio>');
  const exact = all.filter((o) => fold(o.name) === wanted);
  if (exact.length === 1) return exact[0];
  const partial = exact.length > 1 ? exact : all.filter((o) => fold(o.name).includes(wanted));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    const names = partial
      .map((o) => `«${o.name}»`)
      .sort((a, b) => a.localeCompare(b, "es"))
      .join(", ");
    throw new Error(`«${key}» coincide con ${partial.length} empresas: ${names}. Escribe el nombre completo`);
  }
  throw new Error(`No hay ninguna empresa cuyo nombre contenga «${key}». Míralas con: npm run admin -- empresas`);
}

export interface OrganizationPatch {
  website?: string | null;
  logoUrl?: string | null;
}

export interface OrganizationOptions {
  site: string | null;
  logo: string | null;
  noLogo: boolean;
}

/**
 * Valida las opciones de `empresa` y las convierte en el cambio a guardar.
 * `--sitio` se normaliza a dominio; `--logo` debe ser una URL https; `--sin-logo` borra ambos y no se combina.
 * @throws con un mensaje claro si falta la opción o un valor no sirve.
 */
export function organizationPatch(options: OrganizationOptions): OrganizationPatch {
  if (options.noLogo) {
    if (options.site !== null || options.logo !== null) {
      throw new Error("--sin-logo borra el sitio y el logo: no se combina con --sitio ni con --logo");
    }
    return { website: null, logoUrl: null };
  }
  const patch: OrganizationPatch = {};
  if (options.site !== null) {
    const domain = websiteDomain(options.site);
    if (!domain) throw new Error(`«${options.site}» no es un dominio válido (ejemplo: empresa.com.co)`);
    patch.website = domain;
  }
  if (options.logo !== null) {
    let url: URL | null = null;
    try {
      url = new URL(options.logo);
    } catch {
      url = null;
    }
    if (url?.protocol !== "https:") throw new Error(`«${options.logo}» no es una URL https de una imagen`);
    patch.logoUrl = url.href;
  }
  if (patch.website === undefined && patch.logoUrl === undefined) {
    throw new Error("Indica qué cambiar: --sitio <dominio>, --logo <url https> o --sin-logo");
  }
  return patch;
}

export function applyOrganizationPatch(org: AdminOrganization, patch: OrganizationPatch): AdminOrganization {
  return {
    ...org,
    ...(patch.website === undefined ? {} : { website: patch.website }),
    ...(patch.logoUrl === undefined ? {} : { logoUrl: patch.logoUrl }),
  };
}

/** ¿El sitio le mostrará logo? Con el motivo, para la lista. */
export function logoStatus(org: AdminOrganization, clientId: string | null): string {
  if (isLogoExcluded(org.name)) return "no (confidencial o agencia)";
  if (logoUrlFor(org, clientId)) return org.logoUrl?.trim() ? "sí (logo propio)" : "sí (Brandfetch)";
  if (!org.website?.trim()) return "no (sin sitio web)";
  if (!websiteDomain(org.website)) return "no (el sitio no es un dominio válido)";
  return "no (falta NEXT_PUBLIC_BRANDFETCH_CLIENT_ID)";
}

/** Tabla de organizaciones en orden alfabético: nombre, sitio web, logo explícito y si tendrá logo. */
export function formatOrganizationList(organizations: readonly AdminOrganization[], clientId: string | null): string {
  const sorted = [...organizations].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const rows = sorted.map((o) => [o.name, o.website?.trim() || "—", o.logoUrl?.trim() || "—", logoStatus(o, clientId)]);
  const header = ["Empresa", "Sitio web", "Logo propio", "¿Tendrá logo?"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => (i === cells.length - 1 ? cell : cell.padEnd(widths[i])))
      .join("  ")
      .trimEnd();
  const withLogo = sorted.filter((o) => logoUrlFor(o, clientId)).length;
  return [
    `Empresas: ${sorted.length} (con logo: ${withLogo}, con iniciales: ${sorted.length - withLogo})`,
    line(header),
    ...rows.map(line),
  ].join("\n");
}

export async function listOrganizations(client: SupabaseClient): Promise<AdminOrganization[]> {
  const rows = await fetchAll<AdminOrganizationRow>(
    (from, to) => client.from("organizations").select(ORGANIZATION_SELECT).order("id").range(from, to),
    "leer las empresas",
  );
  return rows.map(rowToAdminOrganization);
}

export async function updateOrganization(client: SupabaseClient, id: string, patch: OrganizationPatch): Promise<void> {
  const result: DbResult<unknown> = await client
    .from("organizations")
    .update({
      ...(patch.website === undefined ? {} : { website: patch.website }),
      ...(patch.logoUrl === undefined ? {} : { logo_url: patch.logoUrl }),
    })
    .eq("id", id)
    .select("id");
  if (((unwrap(result, "actualizar la empresa") ?? []) as unknown[]).length === 0) {
    throw new Error(`No existe la empresa ${id}`);
  }
}

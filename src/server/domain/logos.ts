/**
 * Logos de las organizaciones (Brandfetch Logo API). Funciones puras: solo construyen URLs, nunca piden nada.
 *
 * Reglas de Brandfetch (https://docs.brandfetch.com/logo-api/guidelines):
 * - Cada URL lleva el client ID público (`?c=`).
 * - Hotlinking obligatorio: la URL se incrusta tal cual en un `<img>`; no se descargan ni se guardan copias
 *   (por eso la UI NO debe usar `next/image`, que las optimiza y almacena).
 * - No se permiten peticiones programáticas a las imágenes.
 */
import type { OrganizationRecord } from "./types";

export const BRANDFETCH_CLIENT_ID_VAR = "NEXT_PUBLIC_BRANDFETCH_CLIENT_ID";
export const BRANDFETCH_CDN = "https://cdn.brandfetch.io";
/** Lado del ícono cuadrado en px (el doble del tamaño en pantalla, para pantallas de alta densidad). */
export const LOGO_SIZE_PX = 128;

/** Organizaciones que nunca llevan logo: la empresa real no es pública o el aviso es de una agencia. */
const NO_LOGO_NAME = /\(\s*(confidencial|empresa cliente)\s*\)/i;

export function isLogoExcluded(name: string): boolean {
  return NO_LOGO_NAME.test(name);
}

const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/**
 * Deja un sitio web como dominio: sin protocolo, sin `www.`, sin puerto, ruta ni parámetros, en minúsculas.
 * Devuelve `null` si no parece un dominio (vacío, IP, `localhost`, texto libre).
 */
export function websiteDomain(website: string | null | undefined): string | null {
  const text = (website ?? "").trim().toLowerCase();
  if (!text || /\s/.test(text)) return null;
  const host = text
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^.*@/, "")
    .replace(/:\d*$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  return DOMAIN.test(host) ? host : null;
}

/**
 * URL del ícono cuadrado de una marca en Brandfetch.
 * Formato (https://docs.brandfetch.com/logo-api/parameters):
 * `https://cdn.brandfetch.io/domain/{dominio}/w/{px}/h/{px}/fallback/404/icon?c={clientId}`.
 * `fallback/404` hace que, si no hay logo, la imagen falle (404 vacío) y la UI muestre las iniciales.
 */
export function brandfetchLogoUrl(domain: string, clientId: string): string {
  return `${BRANDFETCH_CDN}/domain/${domain}/w/${LOGO_SIZE_PX}/h/${LOGO_SIZE_PX}/fallback/404/icon?c=${encodeURIComponent(clientId)}`;
}

/** El client ID configurado, o `null` si falta (sin él no hay logos de Brandfetch). */
export function readBrandfetchClientId(env: Record<string, string | undefined> = process.env): string | null {
  return env[BRANDFETCH_CLIENT_ID_VAR]?.trim() || null;
}

export type LogoOrganization = Pick<OrganizationRecord, "name" | "logoUrl" | "website">;

/**
 * Logo de una organización para el contrato (`organization.logoUrl`):
 * 1. Nunca para confidenciales ni agencias «(empresa cliente)».
 * 2. El `logoUrl` explícito, si existe.
 * 3. Brandfetch a partir del dominio de `website`, si hay client ID.
 * 4. `null` (la UI muestra las iniciales).
 */
export function logoUrlFor(org: LogoOrganization, clientId: string | null | undefined): string | null {
  if (isLogoExcluded(org.name)) return null;
  const explicit = org.logoUrl?.trim();
  if (explicit) return explicit;
  const id = clientId?.trim();
  const domain = websiteDomain(org.website);
  return id && domain ? brandfetchLogoUrl(domain, id) : null;
}

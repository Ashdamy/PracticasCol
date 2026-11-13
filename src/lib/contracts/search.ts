import { z } from "zod";
import {
  EDUCATION_LEVELS,
  MODALITIES,
  OPPORTUNITY_TYPES,
  SORT_OPTIONS,
  type EducationLevel,
  type Modality,
  type OpportunityType,
  type SortOption,
} from "./enums";
import type { FacetOption, OpportunityCard } from "./opportunity";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface SearchParams {
  q?: string;
  types?: OpportunityType[];
  levels?: EducationLevel[];
  /** slugs de municipio */
  municipalities?: string[];
  modalities?: Modality[];
  institutionId?: string;
  programId?: string;
  /** Solo con salario, apoyo de sostenimiento o auxilio. */
  paidOnly?: boolean;
  maxDurationMonths?: number;
  /** Solo las que cierran dentro de N días (excluye las sin fecha). */
  closesWithinDays?: number;
  /** Usa el perfil de la cookie y excluye las de veredicto `no_cumple`. */
  eligibleOnly?: boolean;
  sort?: SortOption;
  /** Empieza en 1. */
  page?: number;
  pageSize?: number;
}

export type FacetKey = "types" | "levels" | "municipalities" | "modalities";

export interface SearchResult {
  items: OpportunityCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Conteos por faceta, calculados sin aplicar el filtro de esa misma faceta. */
  facets: Record<FacetKey, FacetOption[]>;
  /** true si se evaluó la elegibilidad con el perfil del estudiante. */
  appliedProfile: boolean;
  /** Parámetros efectivos tras normalizar (útil para pintar chips de filtros activos). */
  params: NormalizedSearchParams;
}

export type NormalizedSearchParams = SearchParams & {
  sort: SortOption;
  page: number;
  pageSize: number;
};

// ---------------------------------------------------------------------------
// URL <-> SearchParams (AGENTS.md §9). Claves en español para URLs legibles.
// ---------------------------------------------------------------------------

export const URL_KEYS = {
  q: "q",
  types: "tipo",
  levels: "nivel",
  municipalities: "municipio",
  modalities: "modalidad",
  institutionId: "institucion",
  programId: "programa",
  paidOnly: "remunerada",
  maxDurationMonths: "duracion_max",
  closesWithinDays: "cierra_en",
  eligibleOnly: "aplico",
  sort: "orden",
  page: "pagina",
  pageSize: "por_pagina",
} as const satisfies Record<keyof SearchParams, string>;

type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function readRaw(raw: RawParams, key: string): string | undefined {
  if (!raw) return undefined;
  if (raw instanceof URLSearchParams) {
    const all = raw.getAll(key);
    return all.length ? all.join(",") : undefined;
  }
  const v = raw[key];
  if (Array.isArray(v)) return v.join(",");
  return v ?? undefined;
}

function readList<T extends string>(value: string | undefined, allowed: readonly T[]): T[] | undefined {
  if (!value) return undefined;
  const set = new Set(allowed as readonly string[]);
  const out = [...new Set(value.split(",").map((s) => s.trim()).filter((s) => set.has(s)))] as T[];
  return out.length ? out : undefined;
}

function readSlugList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const out = [
    ...new Set(
      value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[a-z0-9-]{1,60}$/.test(s)),
    ),
  ];
  return out.length ? out : undefined;
}

function readInt(value: string | undefined, min: number, max: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

function readId(value: string | undefined): string | undefined {
  return value && /^[a-z0-9_-]{1,64}$/i.test(value) ? value : undefined;
}

const truthy = (v: string | undefined) => v === "1" || v === "true" || v === "si";

/**
 * Convierte los searchParams de la URL (o el objeto `searchParams` de Next) en `SearchParams`.
 * Nunca lanza: los valores inválidos se ignoran para que una URL mal formada no rompa la página.
 */
export function parseSearchParams(raw: RawParams): NormalizedSearchParams {
  const q = readRaw(raw, URL_KEYS.q)?.trim().slice(0, 120) || undefined;
  const sort = (readList(readRaw(raw, URL_KEYS.sort), SORT_OPTIONS)?.[0] ?? "relevancia") as SortOption;
  return {
    q,
    types: readList(readRaw(raw, URL_KEYS.types), OPPORTUNITY_TYPES),
    levels: readList(readRaw(raw, URL_KEYS.levels), EDUCATION_LEVELS),
    municipalities: readSlugList(readRaw(raw, URL_KEYS.municipalities)),
    modalities: readList(readRaw(raw, URL_KEYS.modalities), MODALITIES),
    institutionId: readId(readRaw(raw, URL_KEYS.institutionId)),
    programId: readId(readRaw(raw, URL_KEYS.programId)),
    paidOnly: truthy(readRaw(raw, URL_KEYS.paidOnly)) || undefined,
    maxDurationMonths: readInt(readRaw(raw, URL_KEYS.maxDurationMonths), 1, 36),
    closesWithinDays: readInt(readRaw(raw, URL_KEYS.closesWithinDays), 0, 365),
    eligibleOnly: truthy(readRaw(raw, URL_KEYS.eligibleOnly)) || undefined,
    sort,
    page: readInt(readRaw(raw, URL_KEYS.page), 1, 10_000) ?? 1,
    pageSize: readInt(readRaw(raw, URL_KEYS.pageSize), 1, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE,
  };
}

/**
 * Convierte `SearchParams` en URLSearchParams (omite defaults para URLs cortas).
 * Uso: `/practicas?${toSearchParams({ ...params, page: 2 })}`
 */
export function toSearchParams(params: SearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  const setList = (key: string, list?: readonly string[]) => {
    if (list?.length) sp.set(key, list.join(","));
  };
  if (params.q?.trim()) sp.set(URL_KEYS.q, params.q.trim());
  setList(URL_KEYS.types, params.types);
  setList(URL_KEYS.levels, params.levels);
  setList(URL_KEYS.municipalities, params.municipalities);
  setList(URL_KEYS.modalities, params.modalities);
  if (params.institutionId) sp.set(URL_KEYS.institutionId, params.institutionId);
  if (params.programId) sp.set(URL_KEYS.programId, params.programId);
  if (params.paidOnly) sp.set(URL_KEYS.paidOnly, "1");
  if (params.maxDurationMonths) sp.set(URL_KEYS.maxDurationMonths, String(params.maxDurationMonths));
  if (params.closesWithinDays !== undefined) sp.set(URL_KEYS.closesWithinDays, String(params.closesWithinDays));
  if (params.eligibleOnly) sp.set(URL_KEYS.eligibleOnly, "1");
  if (params.sort && params.sort !== "relevancia") sp.set(URL_KEYS.sort, params.sort);
  if (params.page && params.page > 1) sp.set(URL_KEYS.page, String(params.page));
  if (params.pageSize && params.pageSize !== DEFAULT_PAGE_SIZE) sp.set(URL_KEYS.pageSize, String(params.pageSize));
  return sp;
}

/** Cuántos filtros (no texto, orden ni paginación) están activos. Útil para el badge del botón "Filtros". */
export function countActiveFilters(p: SearchParams): number {
  return (
    (p.types?.length ?? 0) +
    (p.levels?.length ?? 0) +
    (p.municipalities?.length ?? 0) +
    (p.modalities?.length ?? 0) +
    (p.institutionId ? 1 : 0) +
    (p.programId ? 1 : 0) +
    (p.paidOnly ? 1 : 0) +
    (p.maxDurationMonths ? 1 : 0) +
    (p.closesWithinDays !== undefined ? 1 : 0) +
    (p.eligibleOnly ? 1 : 0)
  );
}

/** Esquema Zod equivalente, por si se recibe `SearchParams` como JSON (p. ej. desde un client component). */
export const SearchParamsSchema = z.object({
  q: z.string().max(120).optional(),
  types: z.array(z.enum(OPPORTUNITY_TYPES)).optional(),
  levels: z.array(z.enum(EDUCATION_LEVELS)).optional(),
  municipalities: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).optional(),
  modalities: z.array(z.enum(MODALITIES)).optional(),
  institutionId: z.string().max(64).optional(),
  programId: z.string().max(64).optional(),
  paidOnly: z.boolean().optional(),
  maxDurationMonths: z.number().int().min(1).max(36).optional(),
  closesWithinDays: z.number().int().min(0).max(365).optional(),
  eligibleOnly: z.boolean().optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

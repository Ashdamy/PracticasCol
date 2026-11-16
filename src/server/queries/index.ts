/**
 * ★ Lecturas que consume la UI (AGENTS.md §11). Llamar desde Server Components.
 * Codex: importa de "@/server/queries"; nunca de "@/server/repo" ni "@/server/db".
 */
import "server-only";
import { connection } from "next/server";
import {
  EDUCATION_LEVELS,
  MODALITIES,
  OPPORTUNITY_TYPES,
  type FilterOptions,
  type HomeData,
  type OpportunityDetail,
  type SearchParams,
  type SearchResult,
  type SourceSummary,
  type StudentProfile,
} from "@/lib/contracts";
import { INSTITUTIONS, PROGRAMS, institutionLevels } from "@/lib/catalog/academic";
import { MUNICIPALITIES } from "@/lib/catalog/geo";
import { EDUCATION_LEVEL_LABELS, MODALITY_LABELS, OPPORTUNITY_TYPE_LABELS } from "@/lib/catalog/labels";
import { todayInBogota } from "@/lib/time";
import { daysLeft, effectiveStatus, resolveProfile, toCard, toDetail, type MapContext } from "@/server/domain/mappers";
import { readProfileCookie } from "@/server/profile";
import { getRepository } from "@/server/repo";
import { searchRecords } from "@/server/search/engine";

async function buildContext(profile?: StudentProfile | null): Promise<MapContext> {
  // Datos por petición (cookie del perfil + fecha actual). Con cacheComponents la UI debe envolver en <Suspense>.
  await connection();
  const repo = getRepository();
  const [organizations, sources] = await Promise.all([repo.listOrganizations(), repo.listSources()]);
  const now = new Date();
  return {
    organizations: new Map(organizations.map((o) => [o.id, o])),
    sources: new Map(sources.map((s) => [s.id, s])),
    now,
    today: todayInBogota(now),
    profile: resolveProfile(profile === undefined ? await readProfileCookie() : profile),
  };
}

/** Búsqueda principal. Pasa `parseSearchParams(await props.searchParams)`. */
export async function searchOpportunities(params: SearchParams): Promise<SearchResult> {
  // Primero la señal de "datos por petición": el repositorio no debe consultarse durante el prerender.
  await connection();
  const [ctx, records] = await Promise.all([buildContext(), getRepository().listPublicRecords()]);
  return searchRecords(records, params, ctx);
}

/** Detalle por slug. `null` si no existe o fue retirada → usar `notFound()`. Las vencidas sí se devuelven. */
export async function getOpportunity(slug: string): Promise<OpportunityDetail | null> {
  await connection();
  const [ctx, record] = await Promise.all([buildContext(), getRepository().getRecordBySlug(slug)]);
  if (!record) return null;
  const status = effectiveStatus(record, ctx.today);
  if (status !== "publicada" && status !== "vencida") return null;
  return toDetail(record, ctx);
}

export async function getHomeData(): Promise<HomeData> {
  await connection();
  const [ctx, records] = await Promise.all([buildContext(), getRepository().listPublicRecords()]);
  const active = records.filter((r) => effectiveStatus(r, ctx.today) === "publicada");
  const closingSoon = active
    .filter((r) => {
      const left = daysLeft(r, ctx.today);
      return left !== null && left <= 7;
    })
    .sort((a, b) => (daysLeft(a, ctx.today) ?? 0) - (daysLeft(b, ctx.today) ?? 0))
    .slice(0, 6);
  const recent = [...active].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 6);
  return {
    closingSoon: closingSoon.map((r) => toCard(r, ctx)),
    recent: recent.map((r) => toCard(r, ctx)),
    totals: {
      active: active.length,
      sources: ctx.sources.size,
      organizations: new Set(active.map((r) => r.organizationId)).size,
    },
  };
}

/** Opciones para selects de filtros y del formulario de perfil. */
export async function getFilterOptions(): Promise<FilterOptions> {
  return {
    institutions: INSTITUTIONS.map((i) => ({ value: i.id, label: i.name, levels: institutionLevels(i) }))
      .sort((a, b) => a.label.localeCompare(b.label, "es")),
    programs: PROGRAMS.map((p) => ({
      value: p.id,
      label: p.name,
      level: p.level,
      knowledgeAreaId: p.knowledgeAreaId,
      institutionIds: INSTITUTIONS.filter((i) => i.programIds.includes(p.id)).map((i) => i.id),
    })).sort((a, b) => a.label.localeCompare(b.label, "es")),
    municipalities: MUNICIPALITIES.map((m) => ({ value: m.slug, label: m.name })),
    types: OPPORTUNITY_TYPES.map((v) => ({ value: v, label: OPPORTUNITY_TYPE_LABELS[v] })),
    levels: EDUCATION_LEVELS.map((v) => ({ value: v, label: EDUCATION_LEVEL_LABELS[v] })),
    modalities: MODALITIES.map((v) => ({ value: v, label: MODALITY_LABELS[v] })),
  };
}

/** Perfil guardado en la cookie, o null. */
export async function getProfile(): Promise<StudentProfile | null> {
  await connection();
  return readProfileCookie();
}

/** Página /fuentes (transparencia). */
export async function listSources(): Promise<SourceSummary[]> {
  await connection();
  const repo = getRepository();
  const [sources, records] = await Promise.all([repo.listSources(), repo.listPublicRecords()]);
  const today = todayInBogota();
  const active = records.filter((r) => effectiveStatus(r, today) === "publicada");
  return sources.map((s) => ({
    name: s.name,
    url: s.url,
    method: s.method,
    lastRunAt: s.lastRunAt,
    activeCount: active.filter((r) => r.sources.some((x) => x.sourceId === s.id)).length,
  }));
}

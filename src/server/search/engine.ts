/**
 * Motor de búsqueda en memoria sobre registros publicados.
 * Para el volumen del MVP (< ~5.000 convocatorias activas) es suficiente y se comporta igual con mocks o con BD.
 * Si el volumen crece, se reemplaza por Postgres FTS manteniendo esta misma firma.
 */
import {
  DEFAULT_PAGE_SIZE,
  EDUCATION_LEVELS,
  MAX_PAGE_SIZE,
  MODALITIES,
  OPPORTUNITY_TYPES,
  PAID_COMPENSATION_TYPES,
  type EligibilityResult,
  type FacetKey,
  type FacetOption,
  type NormalizedSearchParams,
  type SearchParams,
  type SearchResult,
} from "@/lib/contracts";
import {
  EDUCATION_LEVEL_LABELS,
  MODALITY_LABELS,
  OPPORTUNITY_TYPE_LABELS,
} from "@/lib/catalog/labels";
import { getProgram } from "@/lib/catalog/academic";
import { MUNICIPALITIES } from "@/lib/catalog/geo";
import { daysLeft, effectiveStatus, evaluate, toCard, type MapContext } from "@/server/domain/mappers";
import type { OpportunityRecord } from "@/server/domain/types";
import { scoreText, tokenize, type WeightedField } from "./text";

interface Candidate {
  record: OpportunityRecord;
  eligibility: EligibilityResult | null;
  fields: WeightedField[];
  score: number;
}

export function normalizeParams(params: SearchParams): NormalizedSearchParams {
  return {
    ...params,
    q: params.q?.trim() || undefined,
    sort: params.sort ?? "relevancia",
    page: Math.max(1, Math.floor(params.page ?? 1)),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? DEFAULT_PAGE_SIZE))),
  };
}

function buildFields(r: OpportunityRecord, ctx: MapContext): WeightedField[] {
  const org = ctx.organizations.get(r.organizationId)?.name ?? "";
  const programs = r.programIds.map((id) => getProgram(id)?.name ?? "").join(" ");
  return [
    { tokens: tokenize(r.title), weight: 3 },
    { tokens: tokenize(`${org} ${programs} ${OPPORTUNITY_TYPE_LABELS[r.type]}`), weight: 2 },
    { tokens: tokenize(`${r.description} ${r.otherRequirements.join(" ")}`), weight: 1 },
  ];
}

type Predicate = (c: Candidate) => boolean;

function programCheckFails(c: Candidate, programId: string): boolean {
  const area = getProgram(programId)?.knowledgeAreaId ?? null;
  const r = c.record;
  if (r.openToAllPrograms || r.programIds.includes(programId)) return false;
  if (r.programIds.length === 0 && r.knowledgeAreaIds.length === 0) return false; // no especifica → se muestra
  if (!area) return false;
  if (r.knowledgeAreaIds.includes(area)) return false;
  if (r.acceptsRelatedPrograms && r.programIds.some((id) => getProgram(id)?.knowledgeAreaId === area)) return false;
  return true;
}

/** Predicados por filtro. Las facetas se calculan aplicando todos menos el de su propia dimensión. */
function buildPredicates(p: NormalizedSearchParams, ctx: MapContext, useProfile: boolean) {
  const preds: Partial<Record<FacetKey | "other", Predicate[]>> = { other: [] };
  const add = (key: FacetKey | "other", fn: Predicate) => (preds[key] ??= []).push(fn);

  if (p.types?.length) add("types", (c) => p.types!.includes(c.record.type));
  if (p.levels?.length) add("levels", (c) => c.record.levels.some((l) => p.levels!.includes(l)));
  if (p.modalities?.length) add("modalities", (c) => p.modalities!.includes(c.record.modality));
  if (p.municipalities?.length)
    add(
      "municipalities",
      (c) =>
        c.record.modality === "remota" ||
        (c.record.municipalitySlug !== null && p.municipalities!.includes(c.record.municipalitySlug)),
    );
  if (p.institutionId) {
    const id = p.institutionId;
    add("other", (c) => c.record.institutionIds === null || c.record.institutionIds.includes(id));
  }
  if (p.programId) {
    const id = p.programId;
    add("other", (c) => !programCheckFails(c, id));
  }
  if (p.paidOnly) add("other", (c) => PAID_COMPENSATION_TYPES.includes(c.record.compensationType));
  if (p.maxDurationMonths) {
    const max = p.maxDurationMonths;
    add("other", (c) => {
      const min = c.record.durationMonthsMin ?? c.record.durationMonthsMax;
      return min !== null && min <= max;
    });
  }
  if (p.closesWithinDays !== undefined) {
    const within = p.closesWithinDays;
    add("other", (c) => {
      const left = daysLeft(c.record, ctx.today);
      return left !== null && left >= 0 && left <= within;
    });
  }
  if (p.eligibleOnly && useProfile) add("other", (c) => c.eligibility?.verdict !== "no_cumple");
  return preds;
}

function countFacet(
  candidates: Candidate[],
  key: FacetKey,
  preds: ReturnType<typeof buildPredicates>,
  valueOf: (c: Candidate) => string[],
  options: { value: string; label: string }[],
): FacetOption[] {
  const active = (Object.keys(preds) as (FacetKey | "other")[])
    .filter((k) => k !== key)
    .flatMap((k) => preds[k] ?? []);
  const counts = new Map<string, number>();
  for (const c of candidates) {
    if (!active.every((fn) => fn(c))) continue;
    for (const v of new Set(valueOf(c))) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return options.map((o) => ({ ...o, count: counts.get(o.value) ?? 0 }));
}

const VERDICT_RANK = { cumple: 0, revisar: 1, sin_perfil: 1, no_cumple: 2 } as const;

function compareByDeadline(a: Candidate, b: Candidate, today: string): number {
  const da = daysLeft(a.record, today);
  const db = daysLeft(b.record, today);
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

const byRecent = (a: Candidate, b: Candidate) => b.record.publishedAt.localeCompare(a.record.publishedAt);

export function searchRecords(
  records: readonly OpportunityRecord[],
  rawParams: SearchParams,
  ctx: MapContext,
): SearchResult {
  const params = normalizeParams(rawParams);
  const useProfile = ctx.profile !== null;
  const queryTokens = params.q ? tokenize(params.q) : [];

  // 1. Solo publicadas y no vencidas; texto.
  let candidates: Candidate[] = records
    .filter((r) => effectiveStatus(r, ctx.today) === "publicada")
    .map((record) => ({ record, eligibility: evaluate(record, ctx), fields: buildFields(record, ctx), score: 0 }));
  if (queryTokens.length) {
    candidates = candidates
      .map((c) => ({ ...c, score: scoreText(queryTokens, c.fields) }))
      .filter((c) => c.score > 0);
  }

  // 2. Facetas y filtros.
  const preds = buildPredicates(params, ctx, useProfile);
  const facets: SearchResult["facets"] = {
    types: countFacet(candidates, "types", preds, (c) => [c.record.type],
      OPPORTUNITY_TYPES.map((v) => ({ value: v, label: OPPORTUNITY_TYPE_LABELS[v] }))),
    levels: countFacet(candidates, "levels", preds, (c) => c.record.levels,
      EDUCATION_LEVELS.map((v) => ({ value: v, label: EDUCATION_LEVEL_LABELS[v] }))),
    modalities: countFacet(candidates, "modalities", preds, (c) => [c.record.modality],
      MODALITIES.map((v) => ({ value: v, label: MODALITY_LABELS[v] }))),
    municipalities: countFacet(candidates, "municipalities", preds,
      (c) => (c.record.municipalitySlug ? [c.record.municipalitySlug] : []),
      MUNICIPALITIES.map((m) => ({ value: m.slug, label: m.name }))),
  };
  const all = Object.values(preds).flatMap((list) => list ?? []);
  const filtered = candidates.filter((c) => all.every((fn) => fn(c)));

  // 3. Orden.
  const sorted = [...filtered].sort((a, b) => {
    if (params.sort === "cierre") return compareByDeadline(a, b, ctx.today) || byRecent(a, b);
    if (params.sort === "recientes") return byRecent(a, b);
    // relevancia: texto → elegibilidad → cierre → recientes
    return (
      b.score - a.score ||
      VERDICT_RANK[a.eligibility?.verdict ?? "sin_perfil"] - VERDICT_RANK[b.eligibility?.verdict ?? "sin_perfil"] ||
      compareByDeadline(a, b, ctx.today) ||
      byRecent(a, b)
    );
  });

  // 4. Paginación.
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const start = (params.page - 1) * params.pageSize;
  const items = sorted.slice(start, start + params.pageSize).map((c) => toCard(c.record, ctx, c.eligibility));

  return { items, total, page: params.page, pageSize: params.pageSize, totalPages, facets, appliedProfile: useProfile, params };
}

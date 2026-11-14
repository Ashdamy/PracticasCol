/** Convierte registros internos en objetos del contrato (OpportunityCard / OpportunityDetail). */
import {
  STALE_AFTER_DAYS,
  type EligibilityResult,
  type OpportunityCard,
  type OpportunityDetail,
  type StudentProfile,
} from "@/lib/contracts";
import { getInstitution, getKnowledgeArea, getProgram } from "@/lib/catalog/academic";
import { getMunicipality } from "@/lib/catalog/geo";
import {
  evaluateEligibility,
  type EligibilityOpportunity,
  type EligibilityProfile,
} from "@/lib/eligibility";
import { daysBetween, daysSince } from "@/lib/time";
import type { OpportunityRecord, OrganizationRecord, SourceRecord } from "./types";

export interface Lookups {
  organizations: ReadonlyMap<string, OrganizationRecord>;
  sources: ReadonlyMap<string, SourceRecord>;
}

export interface MapContext extends Lookups {
  today: string;
  now: Date;
  profile: EligibilityProfile | null;
}

export function resolveProfile(profile: StudentProfile | null): EligibilityProfile | null {
  if (!profile) return null;
  return {
    level: profile.level,
    institutionId: profile.institutionId,
    programId: profile.programId,
    programKnowledgeAreaId: getProgram(profile.programId)?.knowledgeAreaId ?? null,
    semester: profile.semester,
    isGraduate: profile.isGraduate,
  };
}

export function toEligibilityInput(r: OpportunityRecord): EligibilityOpportunity {
  return {
    levels: r.levels,
    openToAllPrograms: r.openToAllPrograms,
    programIds: r.programIds,
    knowledgeAreaIds: r.knowledgeAreaIds,
    programKnowledgeAreaIds: [
      ...new Set(r.programIds.map((id) => getProgram(id)?.knowledgeAreaId).filter((x): x is string => !!x)),
    ],
    acceptsRelatedPrograms: r.acceptsRelatedPrograms,
    semesterMin: r.semesterMin,
    semesterMax: r.semesterMax,
    acceptsGraduates: r.acceptsGraduates,
    institutionIds: r.institutionIds,
    deadline: { type: r.deadlineType, date: r.deadlineDate },
    otherRequirements: r.otherRequirements,
  };
}

export function daysLeft(r: OpportunityRecord, today: string): number | null {
  return r.deadlineType === "fecha" && r.deadlineDate ? daysBetween(today, r.deadlineDate) : null;
}

/** Una oportunidad "publicada" cuya fecha ya pasó se trata como vencida aunque el job aún no la marque. */
export function effectiveStatus(r: OpportunityRecord, today: string): OpportunityRecord["status"] {
  if (r.status === "publicada") {
    const left = daysLeft(r, today);
    if (left !== null && left < 0) return "vencida";
  }
  return r.status;
}

export function evaluate(r: OpportunityRecord, ctx: Pick<MapContext, "profile" | "today">): EligibilityResult | null {
  return ctx.profile ? evaluateEligibility(toEligibilityInput(r), ctx.profile, ctx.today) : null;
}

const UNKNOWN_ORG: OrganizationRecord = { id: "?", name: "Organización no especificada", sector: "privado", logoUrl: null };

export function toCard(r: OpportunityRecord, ctx: MapContext, eligibility = evaluate(r, ctx)): OpportunityCard {
  const org = ctx.organizations.get(r.organizationId) ?? UNKNOWN_ORG;
  const mainSource = ctx.sources.get(r.sources[0]?.sourceId ?? "");
  const muni = getMunicipality(r.municipalitySlug);
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    organization: { name: org.name, logoUrl: org.logoUrl, sector: org.sector },
    type: r.type,
    levels: r.levels,
    municipality: muni ? { slug: muni.slug, name: muni.name } : null,
    modality: r.modality,
    compensation: { type: r.compensationType, amountCop: r.compensationAmountCop },
    durationMonths:
      r.durationMonthsMin !== null || r.durationMonthsMax !== null
        ? {
            min: r.durationMonthsMin ?? r.durationMonthsMax!,
            max: r.durationMonthsMax ?? r.durationMonthsMin!,
          }
        : null,
    deadline: { type: r.deadlineType, date: r.deadlineDate, daysLeft: daysLeft(r, ctx.today) },
    source: { name: mainSource?.name ?? "Fuente no disponible", url: r.sources[0]?.url ?? r.applyUrl },
    lastVerifiedAt: r.lastVerifiedAt,
    isStale: daysSince(r.lastVerifiedAt, ctx.now) > STALE_AFTER_DAYS,
    eligibility: eligibility ? { verdict: eligibility.verdict } : null,
  };
}

export function toDetail(r: OpportunityRecord, ctx: MapContext): OpportunityDetail {
  const eligibility = evaluate(r, ctx);
  const card = toCard(r, ctx, eligibility);
  const programs = r.programIds
    .map((id) => getProgram(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.name }));
  const areas = r.knowledgeAreaIds
    .map((id) => getKnowledgeArea(id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ id: a.id, name: `Área: ${a.name}` }));
  const institutions =
    r.institutionIds === null
      ? null
      : r.institutionIds
          .map((id) => getInstitution(id))
          .filter((i): i is NonNullable<typeof i> => !!i)
          .map((i) => ({ id: i.id, name: i.name }));
  return {
    ...card,
    description: r.description,
    requirements: {
      semesterMin: r.semesterMin,
      semesterMax: r.semesterMax,
      programs: [...programs, ...areas],
      acceptsRelatedPrograms: r.acceptsRelatedPrograms,
      institutions,
      other: r.otherRequirements,
    },
    startDate: r.startDate,
    applyUrl: r.applyUrl,
    sourceUrl: r.sources[0]?.url ?? r.applyUrl,
    status: effectiveStatus(r, ctx.today),
    sources: r.sources.map((s) => ({ name: ctx.sources.get(s.sourceId)?.name ?? "Fuente", url: s.url })),
    publishedAt: r.publishedAt,
    eligibility,
  };
}

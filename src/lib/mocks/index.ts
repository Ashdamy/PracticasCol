/**
 * Objetos del CONTRATO listos para prototipar UI sin servidor (p. ej. en un client component o en tests de UI).
 * En las páginas reales usa "@/server/queries" (con USE_MOCKS=true ya devuelven estos mismos datos).
 */
import type { OpportunityCard, OpportunityDetail, SearchResult, StudentProfile } from "@/lib/contracts";
import { resolveProfile, toCard, toDetail, type MapContext } from "@/server/domain/mappers";
import { searchRecords } from "@/server/search/engine";
import { todayInBogota } from "@/lib/time";
import { MOCK_OPPORTUNITIES, MOCK_ORGANIZATIONS, MOCK_SOURCES } from "./data";

export const mockProfile: StudentProfile = {
  institutionId: "inst-eafit",
  programId: "prog-ing-industrial",
  level: "universitario",
  semester: 8,
  isGraduate: false,
  municipality: "envigado",
  preferredModalities: ["presencial", "hibrida"],
};

function ctx(profile: StudentProfile | null): MapContext {
  const now = new Date();
  return {
    organizations: new Map(MOCK_ORGANIZATIONS.map((o) => [o.id, o])),
    sources: new Map(MOCK_SOURCES.map((s) => [s.id, s])),
    now,
    today: todayInBogota(now),
    profile: resolveProfile(profile),
  };
}

const published = MOCK_OPPORTUNITIES.filter((o) => o.status === "publicada");

/** Tarjetas sin perfil (eligibility = null). */
export const mockCards: OpportunityCard[] = published.map((r) => toCard(r, ctx(null)));
/** Tarjetas evaluadas con `mockProfile` (incluye cumple / revisar / no_cumple). */
export const mockCardsWithProfile: OpportunityCard[] = published.map((r) => toCard(r, ctx(mockProfile)));
/** Detalle de la primera oportunidad, evaluado con `mockProfile`. */
export const mockDetail: OpportunityDetail = toDetail(published[0], ctx(mockProfile));
export const mockSearchResult: SearchResult = searchRecords(MOCK_OPPORTUNITIES, {}, ctx(null));

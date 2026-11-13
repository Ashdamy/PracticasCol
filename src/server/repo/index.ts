/**
 * Acceso a datos. En Fase 0 solo existe la implementación en memoria (mocks).
 * En Fase 1 se agrega `supabaseRepository` con la misma interfaz y se elige por variable de entorno.
 */
import type { IssueReportRecord, OpportunityRecord, OrganizationRecord, SourceRecord } from "@/server/domain/types";
import { memoryRepository } from "./memory";

export interface Repository {
  /** Registros visibles al público (publicada; los vencidos se filtran después por fecha). */
  listPublicRecords(): Promise<OpportunityRecord[]>;
  getRecordBySlug(slug: string): Promise<OpportunityRecord | null>;
  getRecordById(id: string): Promise<OpportunityRecord | null>;
  listOrganizations(): Promise<OrganizationRecord[]>;
  listSources(): Promise<SourceRecord[]>;
  insertIssueReport(report: Omit<IssueReportRecord, "id" | "createdAt">): Promise<IssueReportRecord>;
}

export function isMockMode(): boolean {
  return process.env.USE_MOCKS !== "false";
}

export function getRepository(): Repository {
  if (isMockMode()) return memoryRepository;
  // Fase 1: return supabaseRepository;
  throw new Error("USE_MOCKS=false pero el repositorio de Supabase aún no está implementado (Fase 1).");
}

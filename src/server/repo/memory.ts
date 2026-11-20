import { MOCK_OPPORTUNITIES, MOCK_ORGANIZATIONS, MOCK_SOURCES } from "@/lib/mocks/data";
import type { IssueReportRecord } from "@/server/domain/types";
import type { OpportunityCandidate } from "../../../ingestion/types";
import type { PublicationContact, Repository } from "./index";

const reports: IssueReportRecord[] = [];

/** Publicaciones recibidas en modo de prueba (se pierden al reiniciar). Exportado para los tests. */
export const memoryPublications: {
  id: string;
  candidate: OpportunityCandidate;
  reviewNotes: string[];
  contact: PublicationContact;
  createdAt: string;
}[] = [];

/** Repositorio en memoria sobre los datos de prueba. Los reportes se pierden al reiniciar. */
export const memoryRepository: Repository = {
  async listPublicRecords() {
    return MOCK_OPPORTUNITIES.filter((o) => o.status === "publicada" || o.status === "vencida");
  },
  async getRecordBySlug(slug) {
    return MOCK_OPPORTUNITIES.find((o) => o.slug === slug) ?? null;
  },
  async getRecordById(id) {
    return MOCK_OPPORTUNITIES.find((o) => o.id === id) ?? null;
  },
  async listOrganizations() {
    return MOCK_ORGANIZATIONS;
  },
  async listSources() {
    return MOCK_SOURCES;
  },
  async insertIssueReport(input) {
    const report: IssueReportRecord = {
      ...input,
      id: `rep-${reports.length + 1}`,
      createdAt: new Date().toISOString(),
    };
    reports.push(report);
    console.info("[PrácticasCol] Reporte recibido (mock):", report);
    return report;
  },
  async listDedupeTargets() {
    const orgName = (id: string) => MOCK_ORGANIZATIONS.find((o) => o.id === id)?.name ?? "";
    return [
      ...MOCK_OPPORTUNITIES.map((o) => ({ id: o.id, title: o.title, organizationName: orgName(o.organizationId), deadlineDate: o.deadlineDate })),
      ...memoryPublications.map((p) => ({
        id: p.id,
        title: p.candidate.title,
        organizationName: p.candidate.organizationName,
        deadlineDate: p.candidate.deadlineDate,
      })),
    ];
  },
  async countRecentPublications({ ipHash, email, ipSince, emailSince }) {
    const wanted = email.trim().toLowerCase();
    return {
      byIp: memoryPublications.filter((p) => p.contact.ipHash === ipHash && p.createdAt >= ipSince).length,
      byEmail: memoryPublications.filter((p) => p.contact.email.toLowerCase() === wanted && p.createdAt >= emailSince).length,
    };
  },
  async savePublication(candidate, reviewNotes, contact) {
    const id = `pub-${String(memoryPublications.length + 1).padStart(4, "0")}`;
    memoryPublications.push({ id, candidate, reviewNotes, contact, createdAt: new Date().toISOString() });
    // Sin el correo en el log: también en desarrollo se trata como dato personal.
    console.info(`[PrácticasCol] Publicación recibida (mock): ${id} «${candidate.title}» — ${candidate.organizationName}`);
    return { id };
  },
};

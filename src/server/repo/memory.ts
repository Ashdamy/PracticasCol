import { MOCK_OPPORTUNITIES, MOCK_ORGANIZATIONS, MOCK_SOURCES } from "@/lib/mocks/data";
import type { IssueReportRecord } from "@/server/domain/types";
import type { Repository } from "./index";

const reports: IssueReportRecord[] = [];

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
};

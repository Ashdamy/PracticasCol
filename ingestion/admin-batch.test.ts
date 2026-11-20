import { describe, expect, it } from "vitest";
import {
  EMPTY_BATCH_FILTERS,
  formatBatchSelection,
  hasBatchFilter,
  isProbableDuplicate,
  parseAdminArgs,
  resolveMunicipalitySlug,
  selectBatch,
  type BatchFilters,
} from "./admin-rules";
import type { StoredOpportunity } from "./store";

const TODAY = "2026-11-20";
const SOURCES = new Map([
  ["src-api-jooble-co", "Jooble Colombia"],
  ["src-manual", "Carga manual"],
]);

let sequence = 0;
function stored(overrides: Partial<StoredOpportunity> = {}): StoredOpportunity {
  sequence += 1;
  const id = `${String(sequence).padStart(8, "0")}-0000-4000-8000-000000000000`;
  return {
    id,
    slug: `oferta-${sequence}`,
    title: `Practicante ${sequence}`,
    organizationId: "11111111-1111-4111-8111-111111111111",
    organizationName: "Empresa Ficticia S.A.S.",
    type: "practica_profesional",
    levels: ["universitario"],
    municipalitySlug: "medellin",
    modality: "no_especificada",
    compensationType: "no_especificado",
    compensationAmountCop: null,
    durationMonthsMin: null,
    durationMonthsMax: null,
    deadlineType: "no_publicada",
    deadlineDate: null,
    startDate: null,
    description: "",
    openToAllPrograms: true,
    programIds: [],
    knowledgeAreaIds: [],
    acceptsRelatedPrograms: false,
    semesterMin: null,
    semesterMax: null,
    acceptsGraduates: null,
    institutionIds: null,
    otherRequirements: [],
    applyUrl: `https://co.jooble.org/jdp/${sequence}`,
    sources: [{ sourceId: "src-api-jooble-co", url: `https://co.jooble.org/jdp/${sequence}` }],
    status: "en_revision",
    publishedAt: "2026-11-20T00:00:00Z",
    lastVerifiedAt: "2026-11-20T00:00:00Z",
    needsReview: true,
    reviewNotes: [],
    ...overrides,
  };
}

const filters = (overrides: Partial<BatchFilters>): BatchFilters => ({ ...EMPTY_BATCH_FILTERS, ...overrides });

describe("selectBatch", () => {
  it("filtra por fuente usando el id o el nombre, sin tildes ni mayúsculas", () => {
    const jooble = stored();
    const manual = stored({ sources: [{ sourceId: "src-manual", url: "https://example.com" }] });
    expect(selectBatch([jooble, manual], filters({ source: "JOOBLE" }), SOURCES, TODAY, false).approve).toEqual([jooble]);
    expect(selectBatch([jooble, manual], filters({ source: "carga manual" }), SOURCES, TODAY, false).approve).toEqual([manual]);
  });

  it("combina los filtros con «y»", () => {
    const a = stored({ municipalitySlug: "envigado", type: "contrato_aprendizaje", title: "Aprendiz SENA logística" });
    const b = stored({ municipalitySlug: "envigado", type: "practica_profesional" });
    const c = stored({ municipalitySlug: "medellin", type: "contrato_aprendizaje" });
    const selection = selectBatch(
      [a, b, c],
      filters({ source: "jooble", municipality: "envigado", type: "contrato_aprendizaje", title: "logistica" }),
      SOURCES,
      TODAY,
      false,
    );
    expect(selection.approve).toEqual([a]);
  });

  it("filtra por empresa y por «sin observaciones»", () => {
    const clean = stored({ organizationName: "Grupo Éxito" });
    const withNotes = stored({ organizationName: "Grupo Éxito", reviewNotes: ["Nivel: no se reconoció"] });
    const other = stored({ organizationName: "Postobón S.A." });
    const selection = selectBatch([clean, withNotes, other], filters({ organization: "exito", withoutNotes: true }), SOURCES, TODAY, false);
    expect(selection.approve).toEqual([clean]);
  });

  it("solo toma las que están en revisión", () => {
    const published = stored({ status: "publicada" });
    const retired = stored({ status: "retirada" });
    const pending = stored();
    expect(selectBatch([published, retired, pending], filters({ source: "jooble" }), SOURCES, TODAY, false).approve).toEqual([pending]);
  });

  it("nunca incluye posibles duplicados, ni con --forzar", () => {
    const duplicate = stored({ reviewNotes: ["Posible duplicado de «Practicante 1» (abc, similitud 0.84)"] });
    const selection = selectBatch([duplicate], filters({ source: "jooble" }), SOURCES, TODAY, true);
    expect(selection.approve).toEqual([]);
    expect(selection.skipped[0].reasons.join(" ")).toContain("posible duplicado");
  });

  it("aplica las reglas de «aprobar»: sin organización nunca, enlace http solo con --forzar", () => {
    const noOrg = stored({ organizationId: "", organizationName: "" });
    const http = stored({ applyUrl: "http://example.com/oferta" });
    const normal = selectBatch([noOrg, http], filters({ source: "jooble" }), SOURCES, TODAY, false);
    expect(normal.approve).toEqual([]);
    expect(normal.skipped).toHaveLength(2);
    const forced = selectBatch([noOrg, http], filters({ source: "jooble" }), SOURCES, TODAY, true);
    expect(forced.approve).toEqual([http]);
    expect(forced.skipped.map((s) => s.opportunity)).toEqual([noOrg]);
  });

  it("deja fuera las que ya cerraron", () => {
    const closed = stored({ deadlineType: "fecha", deadlineDate: "2026-11-01" });
    expect(selectBatch([closed], filters({ source: "jooble" }), SOURCES, TODAY, false).approve).toEqual([]);
  });
});

describe("formatBatchSelection", () => {
  it("sin --confirmar explica que no cambió nada", () => {
    const text = formatBatchSelection({ approve: [stored({ title: "Practicante de datos" })], skipped: [] }, false);
    expect(text).toContain("Se publicarían: 1");
    expect(text).toContain("Practicante de datos");
    expect(text).toContain("--confirmar");
  });

  it("con --confirmar dice que se publican", () => {
    expect(formatBatchSelection({ approve: [], skipped: [] }, true)).toContain("Se publican: 0");
  });
});

describe("parseAdminArgs (aprobar-lote)", () => {
  it("lee los filtros con espacio o con =", () => {
    const args = parseAdminArgs([
      "aprobar-lote",
      "--fuente",
      "jooble",
      "--municipio=Itagüí",
      "--tipo",
      "contrato_aprendizaje",
      "--empresa=Grupo Éxito",
      "--titulo",
      "SENA",
      "--sin-observaciones",
      "--confirmar",
    ]);
    expect(args.command).toBe("aprobar-lote");
    expect(args.confirm).toBe(true);
    expect(args.batch).toEqual({
      source: "jooble",
      organization: "Grupo Éxito",
      municipality: "itagui",
      type: "contrato_aprendizaje",
      title: "SENA",
      withoutNotes: true,
    });
    expect(hasBatchFilter(args.batch)).toBe(true);
  });

  it("sin filtros no hay lote", () => {
    expect(hasBatchFilter(parseAdminArgs(["aprobar-lote"]).batch)).toBe(false);
  });

  it("rechaza municipios y tipos que no existen", () => {
    expect(() => parseAdminArgs(["aprobar-lote", "--municipio", "Bogotá"])).toThrow(/municipio/);
    expect(() => parseAdminArgs(["aprobar-lote", "--tipo", "empleo"])).toThrow(/Tipo desconocido/);
    expect(() => parseAdminArgs(["aprobar-lote", "--fuente"])).toThrow(/Falta el valor/);
  });

  it("lee --dias para «desaparecidas» y rechaza valores raros", () => {
    expect(parseAdminArgs(["desaparecidas", "--dias", "10", "--confirmar"])).toMatchObject({ command: "desaparecidas", days: 10, confirm: true });
    expect(parseAdminArgs(["desaparecidas", "--dias=3"]).days).toBe(3);
    expect(() => parseAdminArgs(["desaparecidas", "--dias", "0"])).toThrow(/--dias/);
    expect(() => parseAdminArgs(["desaparecidas", "--dias", "abc"])).toThrow(/--dias/);
  });

  it("entiende el nombre del municipio o su slug", () => {
    expect(resolveMunicipalitySlug("La Estrella")).toBe("la-estrella");
    expect(resolveMunicipalitySlug("la-estrella")).toBe("la-estrella");
    expect(resolveMunicipalitySlug("Bogotá")).toBeNull();
  });
});

describe("isProbableDuplicate", () => {
  it("reconoce la nota que deja la ingesta", () => {
    expect(isProbableDuplicate({ reviewNotes: ["Posible duplicado de «X» (id, similitud 0.9)"] })).toBe(true);
    expect(isProbableDuplicate({ reviewNotes: ["Nivel: no se reconoció"] })).toBe(false);
  });
});

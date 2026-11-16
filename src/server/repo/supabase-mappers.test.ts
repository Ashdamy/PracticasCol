import { describe, expect, it } from "vitest";
import {
  issueReportRowToRecord,
  organizationRowToRecord,
  recordToColumns,
  relationRows,
  rowToRecord,
  sourceRowToRecord,
  toIso,
  type OpportunityRow,
  type OpportunityWrite,
} from "./supabase-mappers";

const ID = "0b8f6c1e-2a4d-4e7b-9c3a-5d6e7f8a9b0c";

function row(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    id: ID,
    slug: "practicante-de-datos-empresa-ficticia",
    title: "Practicante de datos",
    organization_id: "11111111-1111-4111-8111-111111111111",
    type: "practica_profesional",
    levels: ["universitario", "tecnologo"],
    municipality_slug: "medellin",
    modality: "hibrida",
    compensation_type: "apoyo_sostenimiento",
    compensation_amount_cop: 1_750_000,
    duration_months_min: 4,
    duration_months_max: 6,
    deadline_type: "fecha",
    deadline_date: "2026-12-15",
    start_date: "2027-02-01",
    description: "Resumen propio.",
    open_to_all_programs: false,
    accepts_related_programs: true,
    semester_min: 7,
    semester_max: null,
    accepts_graduates: false,
    restricted_to_institutions: true,
    other_requirements: ["Excel intermedio"],
    apply_url: "https://example.com/postular",
    status: "publicada",
    needs_review: false,
    review_notes: [],
    dedupe_hash: "abc",
    first_seen_at: "2026-11-10T10:00:00+00:00",
    published_at: "2026-11-12T15:30:00+00:00",
    last_verified_at: "2026-11-16T08:00:00.123456+00:00",
    opportunity_programs: [{ program_id: "prog-ing-sistemas" }, { program_id: "prog-ing-industrial" }],
    opportunity_knowledge_areas: [{ knowledge_area_id: "nbc-ing-sistemas" }],
    opportunity_institutions: [{ institution_id: "inst-udea" }],
    opportunity_sources: [
      { source_id: "src-ats-clara", url: "https://example.com/b", position: 1 },
      { source_id: "src-manual-xlsx", url: "https://example.com/a", position: 0 },
    ],
    organizations: { name: "Empresa Ficticia S.A.S." },
    ...overrides,
  };
}

describe("rowToRecord", () => {
  it("convierte todas las columnas y relaciones", () => {
    expect(rowToRecord(row())).toEqual({
      id: ID,
      slug: "practicante-de-datos-empresa-ficticia",
      title: "Practicante de datos",
      organizationId: "11111111-1111-4111-8111-111111111111",
      type: "practica_profesional",
      levels: ["universitario", "tecnologo"],
      municipalitySlug: "medellin",
      modality: "hibrida",
      compensationType: "apoyo_sostenimiento",
      compensationAmountCop: 1_750_000,
      durationMonthsMin: 4,
      durationMonthsMax: 6,
      deadlineType: "fecha",
      deadlineDate: "2026-12-15",
      startDate: "2027-02-01",
      description: "Resumen propio.",
      openToAllPrograms: false,
      programIds: ["prog-ing-industrial", "prog-ing-sistemas"],
      knowledgeAreaIds: ["nbc-ing-sistemas"],
      acceptsRelatedPrograms: true,
      semesterMin: 7,
      semesterMax: null,
      acceptsGraduates: false,
      institutionIds: ["inst-udea"],
      otherRequirements: ["Excel intermedio"],
      applyUrl: "https://example.com/postular",
      sources: [
        { sourceId: "src-manual-xlsx", url: "https://example.com/a" },
        { sourceId: "src-ats-clara", url: "https://example.com/b" },
      ],
      status: "publicada",
      publishedAt: "2026-11-12T15:30:00.000Z",
      lastVerifiedAt: "2026-11-16T08:00:00.123Z",
    });
  });

  it("la fuente principal es la de posición 0, sin importar el orden en que llegue", () => {
    expect(rowToRecord(row()).sources[0]).toEqual({ sourceId: "src-manual-xlsx", url: "https://example.com/a" });
  });

  it("sin restricción de instituciones devuelve null (abierta a cualquiera)", () => {
    const record = rowToRecord(row({ restricted_to_institutions: false, opportunity_institutions: [] }));
    expect(record.institutionIds).toBeNull();
  });

  it("restringida pero sin lista devuelve una lista vacía, no null", () => {
    const record = rowToRecord(row({ restricted_to_institutions: true, opportunity_institutions: [] }));
    expect(record.institutionIds).toEqual([]);
  });

  it("sin published_at usa first_seen_at, y sin organización deja el id vacío", () => {
    const record = rowToRecord(row({ published_at: null, organization_id: null, status: "en_revision" }));
    expect(record.publishedAt).toBe("2026-11-10T10:00:00.000Z");
    expect(record.organizationId).toBe("");
  });

  it("tolera relaciones ausentes y una fecha sobrante cuando el tipo no es fecha", () => {
    const record = rowToRecord(
      row({
        deadline_type: "hasta_agotar_cupos",
        deadline_date: "2026-12-15",
        opportunity_programs: null,
        opportunity_knowledge_areas: undefined,
        opportunity_sources: null,
      }),
    );
    expect(record.deadlineDate).toBeNull();
    expect(record.programIds).toEqual([]);
    expect(record.knowledgeAreaIds).toEqual([]);
    expect(record.sources).toEqual([]);
  });
});

function write(overrides: Partial<OpportunityWrite> = {}): OpportunityWrite {
  const { id: _id, publishedAt, lastVerifiedAt, organizationId, ...fields } = rowToRecord(row());
  void _id;
  return {
    ...fields,
    organizationId,
    needsReview: true,
    reviewNotes: ["Nivel: confianza media"],
    dedupeHash: "hash-1",
    publishedAt,
    lastVerifiedAt,
    ...overrides,
  };
}

describe("recordToColumns", () => {
  it("ida y vuelta: registro → columnas + relaciones → registro", () => {
    const original = write();
    const columns = recordToColumns(original);
    const relations = relationRows(ID, original);
    const back = rowToRecord({
      ...columns,
      id: ID,
      first_seen_at: "2026-11-10T10:00:00+00:00",
      opportunity_programs: relations.opportunity_programs,
      opportunity_knowledge_areas: relations.opportunity_knowledge_areas,
      opportunity_institutions: relations.opportunity_institutions,
      opportunity_sources: relations.opportunity_sources,
    });
    const { needsReview, reviewNotes, dedupeHash, ...expected } = original;
    expect(back).toEqual({ ...expected, id: ID });
    expect(columns.needs_review).toBe(needsReview);
    expect(columns.review_notes).toEqual(reviewNotes);
    expect(columns.dedupe_hash).toBe(dedupeHash);
  });

  it("marca restricted_to_institutions según institutionIds", () => {
    expect(recordToColumns(write({ institutionIds: null })).restricted_to_institutions).toBe(false);
    expect(recordToColumns(write({ institutionIds: [] })).restricted_to_institutions).toBe(true);
  });

  it("organización vacía se guarda como null", () => {
    expect(recordToColumns(write({ organizationId: "" })).organization_id).toBeNull();
    expect(recordToColumns(write({ organizationId: null })).organization_id).toBeNull();
  });

  it("mantiene la coherencia de la fecha límite que exige la tabla", () => {
    const withoutDate = recordToColumns(write({ deadlineType: "fecha", deadlineDate: null }));
    expect([withoutDate.deadline_type, withoutDate.deadline_date]).toEqual(["no_publicada", null]);
    const extraDate = recordToColumns(write({ deadlineType: "hasta_agotar_cupos", deadlineDate: "2026-12-01" }));
    expect([extraDate.deadline_type, extraDate.deadline_date]).toEqual(["hasta_agotar_cupos", null]);
  });

  it("published_at queda null mientras no se publique", () => {
    expect(recordToColumns(write({ status: "en_revision", publishedAt: null })).published_at).toBeNull();
  });
});

describe("relationRows", () => {
  it("quita repetidos y numera las fuentes en orden", () => {
    const relations = relationRows("opp", {
      programIds: ["prog-derecho", "prog-derecho"],
      knowledgeAreaIds: [],
      institutionIds: null,
      sources: [
        { sourceId: "src-a", url: "https://example.com/1" },
        { sourceId: "src-a", url: "https://example.com/1" },
        { sourceId: "src-a", url: "https://example.com/2" },
        { sourceId: "src-b", url: "https://example.com/1" },
      ],
    });
    expect(relations.opportunity_programs).toEqual([{ opportunity_id: "opp", program_id: "prog-derecho" }]);
    expect(relations.opportunity_knowledge_areas).toEqual([]);
    expect(relations.opportunity_institutions).toEqual([]);
    expect(relations.opportunity_sources).toEqual([
      { opportunity_id: "opp", source_id: "src-a", url: "https://example.com/1", position: 0 },
      { opportunity_id: "opp", source_id: "src-a", url: "https://example.com/2", position: 1 },
      { opportunity_id: "opp", source_id: "src-b", url: "https://example.com/1", position: 2 },
    ]);
  });
});

describe("otras filas", () => {
  it("organización, fuente y reporte", () => {
    expect(organizationRowToRecord({ id: "o1", name: "Org", sector: "mixto", logo_url: null })).toEqual({
      id: "o1",
      name: "Org",
      sector: "mixto",
      logoUrl: null,
    });
    expect(
      sourceRowToRecord({ id: "src-x", name: "X", url: "https://example.com", method: "api", last_run_at: "2026-11-16T05:00:00-05:00" }),
    ).toEqual({ id: "src-x", name: "X", url: "https://example.com", method: "api", lastRunAt: "2026-11-16T10:00:00.000Z" });
    expect(sourceRowToRecord({ id: "s", name: "S", url: "/fuentes", method: "manual", last_run_at: null }).lastRunAt).toBeNull();
    expect(
      issueReportRowToRecord({ id: "r1", opportunity_id: ID, reason: "enlace_roto", comment: null, created_at: "2026-11-16T10:00:00+00:00" }),
    ).toEqual({ id: "r1", opportunityId: ID, reason: "enlace_roto", comment: null, createdAt: "2026-11-16T10:00:00.000Z" });
  });

  it("toIso deja pasar lo que no es una fecha", () => {
    expect(toIso("no-es-fecha")).toBe("no-es-fecha");
  });
});

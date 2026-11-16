import { describe, expect, it } from "vitest";
import type { OpportunityRow } from "@/server/repo/supabase-mappers";
import { createFakeSupabase, op, type FakeHandler, type FakeQuery } from "@/test/fake-supabase";
import { dedupeHash } from "../dedupe";
import type { OpportunityCandidate, RawItem } from "../types";
import { createSupabaseStore, organizationKey, rowToStored, uniqueSlug } from "./supabase";

const NOW = "2026-11-16T15:00:00.000Z";
const OPP_ID = "0b8f6c1e-2a4d-4e7b-9c3a-5d6e7f8a9b0c";
const ORG_ID = "11111111-1111-4111-8111-111111111111";

function candidate(overrides: Partial<OpportunityCandidate> = {}): OpportunityCandidate {
  return {
    slug: "practicante-de-datos-empresa-ficticia",
    title: "Practicante de datos",
    organizationName: "Empresa Ficticia S.A.S.",
    type: "practica_profesional",
    levels: ["universitario"],
    municipalitySlug: "medellin",
    modality: "presencial",
    compensationType: "no_especificado",
    compensationAmountCop: null,
    durationMonthsMin: 6,
    durationMonthsMax: 6,
    deadlineType: "fecha",
    deadlineDate: "2026-12-15",
    startDate: null,
    description: "Resumen.",
    openToAllPrograms: false,
    programIds: ["prog-ing-sistemas"],
    knowledgeAreaIds: ["nbc-ing-sistemas"],
    acceptsRelatedPrograms: true,
    semesterMin: null,
    semesterMax: null,
    acceptsGraduates: null,
    institutionIds: null,
    otherRequirements: [],
    applyUrl: "https://example.com/postular",
    sources: [{ sourceId: "src-manual-xlsx", url: "https://example.com/fuente" }],
    status: "en_revision",
    ...overrides,
  };
}

/** Base de datos mínima en memoria que entiende las consultas que hace el store. */
function fakeDb(seed: { slugs?: string[]; organizations?: Record<string, string>; previous?: OpportunityRow } = {}) {
  const organizations = new Map(Object.entries(seed.organizations ?? {}));
  const written: { table: string; method: string; payload: unknown }[] = [];
  let stored: OpportunityRow | null = seed.previous ?? null;

  const handler: FakeHandler = (q: FakeQuery) => {
    for (const method of ["insert", "update", "upsert", "delete"]) {
      const args = op(q, method);
      if (args) written.push({ table: q.table, method, payload: args[0] });
    }
    if (q.table === "organizations") {
      const insert = op(q, "insert")?.[0] as { normalized_name: string } | undefined;
      if (insert) {
        organizations.set(insert.normalized_name, ORG_ID);
        return { data: { id: ORG_ID } };
      }
      const id = organizations.get(String(op(q, "eq")?.[1]));
      return { data: id ? { id } : null };
    }
    if (q.table === "opportunities") {
      if (op(q, "like")) return { data: (seed.slugs ?? []).map((slug) => ({ slug })) };
      const columns = (op(q, "insert") ?? op(q, "update"))?.[0] as OpportunityRow | undefined;
      if (columns) {
        stored = { ...stored, ...columns, id: OPP_ID, first_seen_at: stored?.first_seen_at ?? NOW };
        return { data: { id: OPP_ID } };
      }
      if (op(q, "maybeSingle")) return { data: stored && { ...stored, organizations: { name: "Empresa Ficticia S.A.S." } } };
    }
    return { data: [] };
  };
  const { client, queries } = createFakeSupabase(handler);
  return { store: createSupabaseStore(client), queries, written, organizations };
}

describe("uniqueSlug", () => {
  it("devuelve el slug tal cual si está libre", () => {
    expect(uniqueSlug("practica", [])).toBe("practica");
    expect(uniqueSlug("practica", ["practica-de-ventas", "otra"])).toBe("practica");
  });

  it("agrega el primer sufijo libre cuando choca", () => {
    expect(uniqueSlug("practica", ["practica"])).toBe("practica-2");
    expect(uniqueSlug("practica", ["practica", "practica-2", "practica-3"])).toBe("practica-4");
    expect(uniqueSlug("practica", ["practica", "practica-3"])).toBe("practica-2");
  });
});

describe("organizationKey", () => {
  it("ignora tildes, mayúsculas y sufijos societarios", () => {
    expect(organizationKey("Empresa Ficticia S.A.S.")).toBe(organizationKey("  empresa ficticia "));
    expect(organizationKey("Logística Andina Ltda.")).toBe(organizationKey("LOGISTICA ANDINA"));
  });

  it("queda vacía solo si no hay nombre", () => {
    expect(organizationKey("   ")).toBe("");
    expect(organizationKey("S.A.S.")).not.toBe("");
  });
});

describe("createSupabaseStore.upsertOpportunity", () => {
  it("crea la organización, elige un slug libre y guarda relaciones y observaciones", async () => {
    const { store, written, organizations } = fakeDb({ slugs: ["practicante-de-datos-empresa-ficticia"] });
    const result = await store.upsertOpportunity(candidate(), { reviewNotes: ["Nivel: confianza media"], now: NOW });

    expect(organizations.get(organizationKey("Empresa Ficticia S.A.S."))).toBe(ORG_ID);
    const insert = written.find((w) => w.table === "opportunities" && w.method === "insert")?.payload as Record<string, unknown>;
    expect(insert).toMatchObject({
      slug: "practicante-de-datos-empresa-ficticia-2",
      organization_id: ORG_ID,
      status: "en_revision",
      needs_review: true,
      review_notes: ["Nivel: confianza media"],
      dedupe_hash: dedupeHash("Empresa Ficticia S.A.S.", "Practicante de datos", "2026-12-15"),
      published_at: null,
      last_verified_at: NOW,
    });
    expect(written.find((w) => w.table === "opportunity_programs")?.payload).toEqual([
      { opportunity_id: OPP_ID, program_id: "prog-ing-sistemas" },
    ]);
    expect(written.find((w) => w.table === "opportunity_sources")?.payload).toEqual([
      { opportunity_id: OPP_ID, source_id: "src-manual-xlsx", url: "https://example.com/fuente", position: 0 },
    ]);
    // Sin restricción de instituciones no se escribe nada en esa tabla.
    expect(written.some((w) => w.table === "opportunity_institutions")).toBe(false);
    expect(result).toMatchObject({ id: OPP_ID, organizationName: "Empresa Ficticia S.A.S.", needsReview: true });
  });

  it("reutiliza la organización existente y marca published_at al publicar", async () => {
    const { store, written } = fakeDb({ organizations: { [organizationKey("Empresa Ficticia")]: "org-existente" } });
    await store.upsertOpportunity(candidate({ status: "publicada" }), { now: NOW });
    expect(written.some((w) => w.table === "organizations")).toBe(false);
    expect(written.find((w) => w.table === "opportunities")?.payload).toMatchObject({
      organization_id: "org-existente",
      status: "publicada",
      needs_review: false,
      published_at: NOW,
    });
  });

  it("al actualizar conserva el slug y la fecha de publicación, y reemplaza las relaciones", async () => {
    const previous = {
      id: OPP_ID,
      slug: "slug-original",
      status: "publicada",
      published_at: "2026-11-01T00:00:00+00:00",
      first_seen_at: "2026-10-30T00:00:00+00:00",
    } as OpportunityRow;
    const { store, written } = fakeDb({ previous, organizations: { [organizationKey("Empresa Ficticia")]: ORG_ID } });
    await store.upsertOpportunity(candidate({ status: "publicada", slug: "otro-slug" }), {
      existingId: OPP_ID,
      needsReview: true,
      now: NOW,
    });
    expect(written.find((w) => w.table === "opportunities" && w.method === "update")?.payload).toMatchObject({
      slug: "slug-original",
      published_at: "2026-11-01T00:00:00+00:00",
      needs_review: true,
    });
    expect(written.filter((w) => w.method === "delete").map((w) => w.table)).toEqual([
      "opportunity_programs",
      "opportunity_knowledge_areas",
      "opportunity_institutions",
      "opportunity_sources",
    ]);
  });

  it("falla si se pide actualizar una que no existe", async () => {
    const { store } = fakeDb();
    await expect(store.upsertOpportunity(candidate(), { existingId: OPP_ID })).rejects.toThrow("No existe la oportunidad");
  });

  it("sin organización guarda null y una vencida incompleta pasa a retirada", async () => {
    const { store, written } = fakeDb();
    await store.upsertOpportunity(candidate({ organizationName: "", status: "vencida" }), { now: NOW });
    const insert = written.find((w) => w.table === "opportunities")?.payload as Record<string, unknown>;
    expect(insert.organization_id).toBeNull();
    expect(insert.status).toBe("retirada");
    expect(insert.review_notes).toHaveLength(1);
  });
});

describe("createSupabaseStore: crudos, fuentes y corridas", () => {
  const raw: RawItem = { sourceId: "src-manual-xlsx", externalId: "2", url: "https://example.com/f", payload: { a: 1 }, fetchedAt: NOW };

  it("saveRaw devuelve false cuando el hash ya existía", async () => {
    let rows: unknown[] = [{ id: 1 }];
    const { client, queries } = createFakeSupabase(() => ({ data: rows }));
    const store = createSupabaseStore(client);
    expect(await store.saveRaw(raw, "hash")).toBe(true);
    expect(op(queries[0], "upsert")).toEqual([
      { source_id: "src-manual-xlsx", external_id: "2", url: "https://example.com/f", payload: { a: 1 }, content_hash: "hash", fetched_at: NOW },
      { onConflict: "source_id,content_hash", ignoreDuplicates: true },
    ]);
    rows = [];
    expect(await store.saveRaw(raw, "hash")).toBe(false);
    expect(await store.hasRaw("src-manual-xlsx", "hash")).toBe(false);
  });

  it("addSourceToOpportunity no repite la fuente y la agrega al final", async () => {
    const existing = [{ source_id: "src-a", url: "https://example.com/1", position: 0 }];
    const { client, queries } = createFakeSupabase((q) =>
      q.table === "opportunity_sources" && op(q, "select") ? { data: existing } : { data: [{ id: OPP_ID }] },
    );
    const store = createSupabaseStore(client);
    await store.addSourceToOpportunity(OPP_ID, "src-a", "https://example.com/1", NOW);
    expect(queries.some((q) => op(q, "insert"))).toBe(false);
    await store.addSourceToOpportunity(OPP_ID, "src-b", "https://example.com/2", NOW);
    expect(queries.map((q) => op(q, "insert")?.[0]).find(Boolean)).toEqual({
      opportunity_id: OPP_ID,
      source_id: "src-b",
      url: "https://example.com/2",
      position: 1,
    });
  });

  it("recordRun guarda el reporte y actualiza la fuente", async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: null }));
    const report = {
      sourceId: "src-manual-xlsx", fetched: 2, unchanged: 0, created: 2, updated: 0, duplicates: 0,
      probableDuplicates: 0, needsReview: 2, expired: 0, errors: [], warnings: [], durationMs: 10,
    };
    await createSupabaseStore(client).recordRun(report);
    expect(queries.map((q) => q.table)).toEqual(["ingestion_runs", "sources"]);
    expect(op(queries[0], "insert")?.[0]).toMatchObject({ source_id: "src-manual-xlsx", report });
    expect(op(queries[1], "update")?.[0]).toMatchObject({ last_run_status: "ok", last_run_count: 2 });
  });

  it("ensureSources no pisa las fuentes que ya existen", async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: null }));
    await createSupabaseStore(client).ensureSources([{ id: "src-nueva", name: "Nueva", method: "manual" }]);
    expect(op(queries[0], "upsert")).toEqual([
      [{ id: "src-nueva", name: "Nueva", method: "manual", url: "/fuentes" }],
      { onConflict: "id", ignoreDuplicates: true },
    ]);
  });

  it("setStatus falla si la convocatoria no existe", async () => {
    const { client } = createFakeSupabase(() => ({ data: [] }));
    await expect(createSupabaseStore(client).setStatus(OPP_ID, { status: "retirada" })).rejects.toThrow("No existe la oportunidad");
  });
});

describe("rowToStored", () => {
  it("agrega el nombre de la organización y las observaciones", () => {
    const stored = rowToStored({
      id: OPP_ID, slug: "s", title: "T", organization_id: null, type: "pasantia", levels: [], municipality_slug: null,
      modality: "remota", compensation_type: "no_especificado", compensation_amount_cop: null, duration_months_min: null,
      duration_months_max: null, deadline_type: "no_publicada", deadline_date: null, start_date: null, description: "",
      open_to_all_programs: false, accepts_related_programs: false, semester_min: null, semester_max: null,
      accepts_graduates: null, restricted_to_institutions: false, other_requirements: [], apply_url: "", status: "en_revision",
      needs_review: true, review_notes: ["Organización: falta la organización"], dedupe_hash: null,
      first_seen_at: NOW, published_at: null, last_verified_at: NOW, organizations: null,
    });
    expect(stored).toMatchObject({ organizationName: "", needsReview: true, reviewNotes: ["Organización: falta la organización"] });
  });
});

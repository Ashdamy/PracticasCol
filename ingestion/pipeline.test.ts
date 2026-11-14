import { describe, expect, it } from "vitest";
import type { PoliteFetcher } from "./http";
import { contentHash, runIngestion, stableStringify } from "./pipeline";
import { createMemoryStore } from "./store";
import type { OpportunityDraft, RawItem, SourceAdapter } from "./types";

/** 10:00 a. m. en Colombia → hoy = 2026-11-13. */
const NOW = new Date("2026-11-13T15:00:00.000Z");
const LATER = new Date("2026-11-14T15:00:00.000Z");

/** Ningún test toca la red: si un adaptador intenta descargar, falla. */
const http: PoliteFetcher = {
  get: async (url) => {
    throw new Error(`Petición de red inesperada en un test: ${url}`);
  },
  isAllowed: async () => false,
};

function draft(overrides: Partial<OpportunityDraft> = {}): OpportunityDraft {
  return {
    title: "Practicante de Ingeniería Industrial",
    organizationName: "Empresa Ficticia Uno S.A.S.",
    typeText: "Práctica profesional",
    levelText: "Universitario",
    municipalityText: "Medellín",
    modalityText: "Híbrida",
    compensationText: "Apoyo de sostenimiento $1.750.000",
    durationText: "6 meses",
    deadlineText: "15 de diciembre de 2026",
    startDateText: null,
    description: "Apoyo al equipo de mejora continua de la planta.",
    programsText: "Ingeniería Industrial",
    semesterText: "A partir de 8° semestre",
    requirementsText: "Manejo intermedio de Excel",
    institutionsText: null,
    applyUrl: "https://example.com/postular/1",
    sourceUrl: "https://example.com/convocatorias/1",
    ...overrides,
  };
}

interface FakeAdapterOptions {
  id?: string;
  autoPublish?: boolean;
  drafts?: OpportunityDraft[];
  fetchError?: string;
}

/** Adaptador de prueba: el `payload` de cada ítem es el propio borrador. */
function fakeAdapter(options: FakeAdapterOptions = {}): SourceAdapter {
  const id = options.id ?? "src-a";
  return {
    id,
    name: `Fuente ${id}`,
    method: "scraping",
    autoPublish: options.autoPublish,
    async fetch(ctx): Promise<RawItem[]> {
      if (options.fetchError) throw new Error(options.fetchError);
      return (options.drafts ?? []).map((payload, index) => ({
        sourceId: id,
        externalId: String(index + 1),
        url: payload.sourceUrl ?? `https://example.com/${id}/${index + 1}`,
        payload,
        fetchedAt: ctx.now.toISOString(),
      }));
    },
    parse(raw): OpportunityDraft {
      const payload = raw.payload as OpportunityDraft & { explode?: boolean };
      if (payload.explode) throw new Error("HTML inesperado");
      return payload;
    },
  };
}

describe("runIngestion", () => {
  it("una fuente que falla no tumba a las demás", async () => {
    const store = createMemoryStore();
    const run = await runIngestion({
      adapters: [
        fakeAdapter({ id: "src-rota", fetchError: "ECONNRESET" }),
        fakeAdapter({ id: "src-b", drafts: [draft()] }),
      ],
      store,
      http,
      now: NOW,
    });

    const [broken, healthy] = run.reports;
    expect(broken).toMatchObject({ sourceId: "src-rota", fetched: 0, created: 0 });
    expect(broken.errors).toEqual([{ url: "adapter:src-rota", message: "ECONNRESET" }]);
    expect(healthy).toMatchObject({ sourceId: "src-b", fetched: 1, created: 1, errors: [] });
    expect(await store.listOpportunities()).toHaveLength(1);
    expect(store.runs.map((r) => r.sourceId)).toEqual(["src-rota", "src-b"]);
  });

  it("un ítem que falla al interpretarse no detiene a los demás y se reintenta en la siguiente corrida", async () => {
    const store = createMemoryStore();
    const bad = { ...draft({ title: "Rota", sourceUrl: "https://example.com/rota" }), explode: true };
    const adapter = fakeAdapter({ drafts: [bad, draft()] });

    const first = await runIngestion({ adapters: [adapter], store, http, now: NOW });
    expect(first.reports[0]).toMatchObject({ fetched: 2, created: 1 });
    expect(first.reports[0].errors).toEqual([{ url: "https://example.com/rota", message: "HTML inesperado" }]);
    expect(first.items.map((i) => i.outcome)).toEqual(["error", "creada"]);

    // El crudo del ítem fallido no se guardó: vuelve a intentarse (y el bueno sale sin cambios).
    const second = await runIngestion({ adapters: [adapter], store, http, now: LATER });
    expect(second.items.map((i) => i.outcome)).toEqual(["error", "sin_cambios"]);
  });

  it("no reprocesa lo que no cambió (hash de contenido) y actualiza lo que sí", async () => {
    const store = createMemoryStore();
    const first = await runIngestion({ adapters: [fakeAdapter({ drafts: [draft()] })], store, http, now: NOW });
    expect(first.reports[0]).toMatchObject({ created: 1, unchanged: 0 });

    const second = await runIngestion({ adapters: [fakeAdapter({ drafts: [draft()] })], store, http, now: LATER });
    expect(second.reports[0]).toMatchObject({ fetched: 1, unchanged: 1, created: 0, updated: 0 });
    expect(second.items[0].outcome).toBe("sin_cambios");
    expect(store.rawItems).toHaveLength(1);

    // La misma fuente cambia un dato (mismo título, organización y fecha): se actualiza, no se duplica.
    const changed = draft({ compensationText: "Apoyo de sostenimiento $1.900.000" });
    const third = await runIngestion({ adapters: [fakeAdapter({ drafts: [changed] })], store, http, now: LATER });
    expect(third.reports[0]).toMatchObject({ unchanged: 0, created: 0, updated: 1 });
    const stored = await store.listOpportunities();
    expect(stored).toHaveLength(1);
    expect(stored[0].compensationAmountCop).toBe(1_900_000);
    expect(stored[0].lastVerifiedAt).toBe(LATER.toISOString());
  });

  it("duplicado exacto desde otra fuente: suma la fuente y actualiza la verificación", async () => {
    const store = createMemoryStore();
    await runIngestion({ adapters: [fakeAdapter({ id: "src-a", drafts: [draft()] })], store, http, now: NOW });

    // Mismo contenido con otra puntuación, sin sufijo societario y con otro formato de fecha.
    const same = draft({
      title: "PRACTICANTE DE INGENIERIA INDUSTRIAL",
      organizationName: "Empresa Ficticia Uno",
      deadlineText: "15/12/2026",
      sourceUrl: "https://example.com/otra-fuente/77",
    });
    const run = await runIngestion({
      adapters: [fakeAdapter({ id: "src-b", drafts: [same] })],
      store,
      http,
      now: LATER,
    });

    expect(run.reports[0]).toMatchObject({ duplicates: 1, created: 0, updated: 0 });
    expect(run.items[0].outcome).toBe("duplicado_exacto");
    const stored = await store.listOpportunities();
    expect(stored).toHaveLength(1);
    expect(stored[0].sources).toEqual([
      { sourceId: "src-a", url: "https://example.com/convocatorias/1" },
      { sourceId: "src-b", url: "https://example.com/otra-fuente/77" },
    ]);
    expect(stored[0].title).toBe("Practicante de Ingeniería Industrial");
    expect(stored[0].lastVerifiedAt).toBe(LATER.toISOString());
  });

  it("duplicado probable: se crea en revisión con una nota, aunque la fuente publique sola", async () => {
    const store = createMemoryStore();
    await runIngestion({
      adapters: [fakeAdapter({ id: "src-a", autoPublish: true, drafts: [draft()] })],
      store,
      http,
      now: NOW,
    });

    const similar = draft({ title: "Practicante de Ingeniería Industrial 2027", sourceUrl: "https://example.com/b/1" });
    const run = await runIngestion({
      adapters: [fakeAdapter({ id: "src-b", autoPublish: true, drafts: [similar] })],
      store,
      http,
      now: LATER,
    });

    expect(run.reports[0]).toMatchObject({ created: 1, probableDuplicates: 1, needsReview: 1, duplicates: 0 });
    expect(run.items[0]).toMatchObject({ outcome: "duplicado_probable", status: "en_revision" });
    const stored = await store.listOpportunities();
    expect(stored).toHaveLength(2);
    expect(stored[1].status).toBe("en_revision");
    expect(stored[1].reviewNotes.join(" ")).toContain("Posible duplicado de «Practicante de Ingeniería Industrial»");
  });

  it("una fuente que devuelve 0 ítems deja un aviso", async () => {
    const run = await runIngestion({
      adapters: [fakeAdapter({ drafts: [] })],
      store: createMemoryStore(),
      http,
      now: NOW,
    });
    expect(run.reports[0].fetched).toBe(0);
    expect(run.reports[0].errors).toEqual([]);
    expect(run.reports[0].warnings).toHaveLength(1);
    expect(run.reports[0].warnings[0]).toContain("0 ítems");
  });

  it("publica sola únicamente con autoPublish y confianza alta", async () => {
    const perfect = draft();
    const doubtful = draft({
      title: "Auxiliar de bodega",
      typeText: "Práctica", // sin precisar → confianza media
      sourceUrl: "https://example.com/convocatorias/2",
    });
    const noLink = draft({ title: "Analista junior", applyUrl: null, sourceUrl: "https://example.com/convocatorias/3" });

    const store = createMemoryStore();
    const run = await runIngestion({
      adapters: [
        fakeAdapter({ id: "src-auto", autoPublish: true, drafts: [perfect, doubtful, noLink] }),
        fakeAdapter({
          id: "src-manual",
          drafts: [draft({ title: "Practicante de Calidad", sourceUrl: "https://example.com/m/1" })],
        }),
      ],
      store,
      http,
      now: NOW,
    });

    expect(run.items.map((i) => i.status)).toEqual(["publicada", "en_revision", "en_revision", "en_revision"]);
    expect(run.items[0]).toMatchObject({ confidence: "alta", issues: [] });
    expect(run.items[1].issues.join(" ")).toContain("Tipo");
    expect(run.items[2].issues.join(" ")).toContain("Enlace de postulación");
    // Sin autoPublish queda en revisión aunque no tenga ninguna observación.
    expect(run.items[3]).toMatchObject({ confidence: "alta", issues: [], status: "en_revision" });
    expect(run.reports[0]).toMatchObject({ created: 3, needsReview: 2 });
    expect(run.reports[1]).toMatchObject({ created: 1, needsReview: 1 });

    const stored = await store.listOpportunities();
    expect(stored.filter((o) => o.status === "publicada")).toHaveLength(1);
    expect(stored.filter((o) => o.needsReview)).toHaveLength(3);
  });

  it("una convocatoria nueva que ya cerró no se crea", async () => {
    const store = createMemoryStore();
    const run = await runIngestion({
      adapters: [fakeAdapter({ autoPublish: true, drafts: [draft({ deadlineText: "12/11/2026" })] })],
      store,
      http,
      now: NOW,
    });
    expect(run.reports[0]).toMatchObject({ expired: 1, created: 0 });
    expect(run.items[0]).toMatchObject({ outcome: "vencida", status: "vencida" });
    expect(await store.listOpportunities()).toEqual([]);
  });

  it("no pisa una decisión humana: lo publicado sigue publicado, pero queda marcado si cambia con dudas", async () => {
    const store = createMemoryStore();
    await runIngestion({ adapters: [fakeAdapter({ autoPublish: true, drafts: [draft()] })], store, http, now: NOW });
    expect((await store.listOpportunities())[0]).toMatchObject({ status: "publicada", needsReview: false });

    const changed = draft({ modalityText: "Por definir con el jefe" });
    const run = await runIngestion({
      adapters: [fakeAdapter({ autoPublish: true, drafts: [changed] })],
      store,
      http,
      now: LATER,
    });

    expect(run.reports[0]).toMatchObject({ updated: 1, needsReview: 1 });
    const [stored] = await store.listOpportunities();
    expect(stored).toMatchObject({ status: "publicada", needsReview: true });
    expect(stored.reviewNotes.join(" ")).toContain("Modalidad");
  });

  it("dryRun calcula el reporte pero no escribe nada", async () => {
    const store = createMemoryStore();
    const adapter = fakeAdapter({
      drafts: [draft(), draft({ title: "Practicante de Calidad", sourceUrl: "https://example.com/c/2" })],
    });

    const run = await runIngestion({ adapters: [adapter], store, http, now: NOW, dryRun: true });
    expect(run.dryRun).toBe(true);
    expect(run.reports[0]).toMatchObject({ fetched: 2, created: 2, needsReview: 2 });
    expect(await store.listOpportunities()).toEqual([]);
    expect(store.rawItems).toEqual([]);
    expect(store.runs).toEqual([]);

    // Como no guardó nada, una corrida real posterior sí crea.
    const real = await runIngestion({ adapters: [adapter], store, http, now: NOW });
    expect(real.reports[0]).toMatchObject({ created: 2, unchanged: 0 });
    expect(await store.listOpportunities()).toHaveLength(2);
  });

  it("detecta duplicados dentro del mismo lote, también en dryRun", async () => {
    const run = await runIngestion({
      adapters: [
        fakeAdapter({ id: "src-a", drafts: [draft()] }),
        fakeAdapter({ id: "src-b", drafts: [draft({ sourceUrl: "https://example.com/b/9" })] }),
      ],
      store: createMemoryStore(),
      http,
      now: NOW,
      dryRun: true,
    });
    expect(run.reports.map((r) => [r.created, r.duplicates])).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});

describe("contentHash", () => {
  it("no depende del orden de las llaves", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 3, c: undefined }] })).toBe('{"a":[2,{"d":3}],"b":1}');
    expect(contentHash({ a: 1, b: "x" })).toBe(contentHash({ b: "x", a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
});

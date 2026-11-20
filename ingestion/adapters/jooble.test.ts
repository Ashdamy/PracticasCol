import { describe, expect, it } from "vitest";
import type { HttpResponse, PoliteFetcher } from "../http";
import { normalizeDraft } from "../normalize";
import { runIngestion } from "../pipeline";
import { createMemoryStore } from "../store";
import type { AdapterContext } from "../types";
import {
  createJoobleAdapter,
  createJoobleTransport,
  DEFAULT_JOOBLE_QUERIES,
  joobleJobToPosting,
  joobleToDraft,
  JOOBLE_SOURCE_ID,
  redactKey,
  type JoobleRequestBody,
  type JoobleResponse,
  type JoobleTransport,
} from "./jooble";

const NOW = new Date("2026-11-20T15:00:00Z");
const KEY = "11111111-2222-3333-4444-555555555555";

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    title: "Practicante Administrativo",
    location: "Medellín, Antioquia",
    snippet: "Buscamos <b>practicante</b> de administración&nbsp;para apoyo en procesos. Escríbele a ana@empresa.com para más info.",
    salary: "1.423.500 $",
    source: "jooble",
    type: "Tiempo completo",
    link: "https://co.jooble.org/jdp/101",
    company: "Empresa Ficticia S.A.S.",
    updated: "2026-11-19T10:00:00.0000000",
    ...overrides,
  };
}

function page(jobs: unknown[], totalCount = jobs.length): JoobleResponse {
  return { status: 200, text: JSON.stringify({ totalCount, jobs }) };
}

function fakeTransport(responder: (body: JoobleRequestBody, call: number) => JoobleResponse) {
  const calls: JoobleRequestBody[] = [];
  const transport: JoobleTransport = {
    async post(body) {
      calls.push(body);
      return responder(body, calls.length);
    },
  };
  return { transport, calls };
}

function context(allowed = true) {
  const logs: string[] = [];
  const http: PoliteFetcher = {
    async get(url: string): Promise<HttpResponse> {
      throw new Error(`no debería hacer GET a ${url}`);
    },
    async isAllowed() {
      return allowed;
    },
  };
  const ctx: AdapterContext = { http, now: NOW, log: { info: (m) => logs.push(m), warn: (m) => logs.push(m) } };
  return { ctx, logs };
}

describe("joobleJobToPosting", () => {
  it("convierte una práctica del Valle de Aburrá en una ficha propia", () => {
    const mapped = joobleJobToPosting(job());
    expect("posting" in mapped).toBe(true);
    if (!("posting" in mapped)) return;
    expect(mapped.posting).toMatchObject({
      provider: "jooble",
      id: "101",
      title: "Practicante Administrativo",
      company: "Empresa Ficticia S.A.S.",
      location: "Medellín, Antioquia",
      url: "https://co.jooble.org/jdp/101",
      modalityHint: null,
    });
  });

  it("quita el HTML y los datos personales del extracto", () => {
    const mapped = joobleJobToPosting(job());
    if (!("posting" in mapped)) throw new Error("debía pasar el filtro");
    expect(mapped.posting.excerpt).not.toMatch(/<b>|&nbsp;/);
    expect(mapped.posting.excerpt).not.toContain("ana@empresa.com");
    expect(mapped.posting.excerpt).toContain("practicante de administración para apoyo");
    expect(mapped.posting.excerpt.length).toBeLessThanOrEqual(300);
  });

  it("descarta lo que no es práctica", () => {
    expect(joobleJobToPosting(job({ title: "Analista de datos senior" }))).toEqual({ skip: "no_es_practica" });
  });

  it("descarta lo que está fuera del Valle de Aburrá", () => {
    expect(joobleJobToPosting(job({ location: "Bogotá, D.C." }))).toEqual({ skip: "fuera_de_cobertura" });
  });

  it("acepta las remotas en Colombia aunque no digan municipio", () => {
    const mapped = joobleJobToPosting(job({ title: "Practicante de marketing remoto", location: "Colombia" }));
    if (!("posting" in mapped)) throw new Error("debía pasar el filtro");
    expect(mapped.posting.modalityHint).toContain("remoto");
  });

  it("descarta ítems sin id, título o enlace válido", () => {
    expect(joobleJobToPosting(job({ link: "javascript:alert(1)" }))).toEqual({ skip: "formato" });
    expect(joobleJobToPosting(job({ id: null }))).toEqual({ skip: "formato" });
    expect(joobleJobToPosting("texto")).toEqual({ skip: "formato" });
  });

  it("el borrador no inventa la modalidad ni la fecha de cierre", () => {
    const mapped = joobleJobToPosting(job());
    if (!("posting" in mapped)) throw new Error("debía pasar el filtro");
    const draft = joobleToDraft(mapped.posting);
    expect(draft.modalityText).toBeNull();
    expect(draft.deadlineText).toBeNull();
    expect(draft.applyUrl).toBe("https://co.jooble.org/jdp/101");
    const normalized = normalizeDraft(draft, { today: "2026-11-20", sourceId: JOOBLE_SOURCE_ID });
    expect(normalized.candidate.modality).toBe("no_especificada");
    expect(normalized.candidate.municipalitySlug).toBe("medellin");
  });
});

describe("createJoobleAdapter", () => {
  it("recorre las búsquedas, quita repetidas y deja estadísticas en el log", async () => {
    const { transport, calls } = fakeTransport((body) =>
      body.keywords === "practicante"
        ? page([job(), job({ id: 102, title: "Analista senior" }), job({ id: 103, location: "Cali" })])
        : page([job()]),
    );
    const adapter = createJoobleAdapter({
      transport,
      queries: [
        { keywords: "practicante", location: "Medellín", radius: "40" },
        { keywords: "pasante", location: "Medellín", radius: "40" },
      ],
    });
    const { ctx, logs } = context();
    const items = await adapter.fetch(ctx);
    expect(items.map((i) => i.externalId)).toEqual(["101"]);
    expect(calls.map((c) => [c.keywords, c.page, c.radius])).toEqual([
      ["practicante", "1", "40"],
      ["pasante", "1", "40"],
    ]);
    expect(logs.join("\n")).toMatch(/1 prácticas.*1 no son prácticas.*1 fuera de cobertura.*1 repetidas/);
  });

  it("pide la página 2 solo si hay más resultados", async () => {
    const { transport, calls } = fakeTransport((_body, call) =>
      call === 1 ? page([job()], 2) : page([job({ id: 104 })], 2),
    );
    const adapter = createJoobleAdapter({ transport, queries: [{ keywords: "practicante", location: "Medellín" }], pagesPerQuery: 3 });
    const items = await adapter.fetch(context().ctx);
    expect(items).toHaveLength(2);
    expect(calls.map((c) => c.page)).toEqual(["1", "2"]);
  });

  it("nunca pasa del tope de consultas de la corrida", async () => {
    const { transport, calls } = fakeTransport(() => page([job()], 1000));
    const adapter = createJoobleAdapter({ transport, maxRequests: 5 });
    const { ctx, logs } = context();
    await adapter.fetch(ctx);
    expect(calls).toHaveLength(5);
    expect(logs.join("\n")).toContain("tope de 5 consultas");
  });

  it("el tope nunca supera el límite diario de Jooble", async () => {
    const { transport, calls } = fakeTransport(() => page([job()], 100_000));
    const queries = Array.from({ length: 80 }, (_, i) => ({ keywords: `practicante ${i}`, location: "Medellín" }));
    const adapter = createJoobleAdapter({ transport, queries, pagesPerQuery: 5, maxRequests: 500 });
    await adapter.fetch(context().ctx);
    expect(calls).toHaveLength(100);
  });

  it("un 429 detiene la corrida sin reintentar y conserva lo que ya llegó", async () => {
    const { transport, calls } = fakeTransport((_body, call) => (call === 1 ? page([job()]) : { status: 429, text: "" }));
    const adapter = createJoobleAdapter({ transport });
    const { ctx, logs } = context();
    const items = await adapter.fetch(ctx);
    expect(items).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(logs.join("\n")).toContain("429");
  });

  it("un 403 explica que la clave debe ser la de Colombia", async () => {
    const { transport } = fakeTransport(() => ({ status: 403, text: "<html>Error 403</html>" }));
    const adapter = createJoobleAdapter({ transport });
    await expect(adapter.fetch(context().ctx)).rejects.toThrow(/co\.jooble\.org/);
  });

  it("no consulta si robots.txt no lo permite", async () => {
    const { transport, calls } = fakeTransport(() => page([job()]));
    const adapter = createJoobleAdapter({ transport });
    await expect(adapter.fetch(context(false).ctx)).rejects.toThrow(/robots\.txt/);
    expect(calls).toHaveLength(0);
  });

  it("las búsquedas por defecto caben con holgura en el límite diario", () => {
    expect(DEFAULT_JOOBLE_QUERIES.length * 2).toBeLessThanOrEqual(30);
  });

  it("todo lo de Jooble queda en revisión", async () => {
    const { transport } = fakeTransport(() => page([job()]));
    const store = createMemoryStore();
    const run = await runIngestion({
      adapters: [createJoobleAdapter({ transport, queries: [{ keywords: "practicante", location: "Medellín" }] })],
      store,
      http: context().ctx.http,
      now: NOW,
      dryRun: false,
    });
    expect(run.reports[0].sourceId).toBe(JOOBLE_SOURCE_ID);
    expect(run.reports[0].created).toBe(1);
    expect(run.items.every((i) => i.status === "en_revision")).toBe(true);
  });
});

describe("createJoobleTransport", () => {
  it("hace POST con JSON a co.jooble.org, sin cookies y sin seguir redirecciones", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ totalCount: 0, jobs: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const transport = createJoobleTransport({ apiKey: KEY, fetchImpl, sleep: async () => {} });
    const response = await transport.post({ keywords: "practicante", location: "Medellín", page: "1" });
    expect(response.status).toBe(200);
    expect(seen[0].url).toBe(`https://co.jooble.org/api/${KEY}`);
    expect(seen[0].init).toMatchObject({ method: "POST", credentials: "omit", redirect: "manual" });
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ keywords: "practicante", location: "Medellín", page: "1" });
  });

  it("espera al menos 2 s entre consultas", async () => {
    let clock = 0;
    const waits: number[] = [];
    const fetchImpl = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const transport = createJoobleTransport({
      apiKey: KEY,
      fetchImpl,
      minDelayMs: 500,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await transport.post({ keywords: "a", location: "Medellín", page: "1" });
    clock += 300;
    await transport.post({ keywords: "b", location: "Medellín", page: "1" });
    expect(waits).toEqual([1700]);
  });

  it("nunca deja la clave en los mensajes de error", async () => {
    const fetchImpl = (async (url: string) => {
      throw new Error(`fallo de red al pedir ${url}`);
    }) as unknown as typeof fetch;
    const transport = createJoobleTransport({ apiKey: KEY, fetchImpl, sleep: async () => {} });
    const error: unknown = await transport.post({ keywords: "a", location: "Medellín", page: "1" }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("<clave>");
    expect(message).not.toContain(KEY);
  });

  it("exige una clave", () => {
    expect(() => createJoobleTransport({ apiKey: "  " })).toThrow(/JOOBLE_API_KEY/);
  });

  it("redactKey tapa la clave tal cual y codificada", () => {
    expect(redactKey(`x ${KEY} y ${encodeURIComponent(KEY)}`, KEY)).toBe("x <clave> y <clave>");
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFakeSupabase, op, type FakeHandler } from "@/test/fake-supabase";
import { getRepository, resetRepositoryForTests } from "./index";
import { memoryRepository } from "./memory";
import { createSupabaseRepository, ttlCache } from "./supabase";
import type { OpportunityRow } from "./supabase-mappers";
import { fetchAll, readSupabaseEnv } from "./supabase-shared";

const ID = "0b8f6c1e-2a4d-4e7b-9c3a-5d6e7f8a9b0c";

function row(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    id: ID,
    slug: "practica-uno",
    title: "Práctica uno",
    organization_id: "11111111-1111-4111-8111-111111111111",
    type: "pasantia",
    levels: ["universitario"],
    municipality_slug: null,
    modality: "remota",
    compensation_type: "no_especificado",
    compensation_amount_cop: null,
    duration_months_min: null,
    duration_months_max: null,
    deadline_type: "no_publicada",
    deadline_date: null,
    start_date: null,
    description: "",
    open_to_all_programs: true,
    accepts_related_programs: false,
    semester_min: null,
    semester_max: null,
    accepts_graduates: null,
    restricted_to_institutions: false,
    other_requirements: [],
    apply_url: "https://example.com/postular",
    status: "publicada",
    needs_review: false,
    review_notes: [],
    dedupe_hash: null,
    first_seen_at: "2026-11-10T10:00:00+00:00",
    published_at: "2026-11-12T10:00:00+00:00",
    last_verified_at: "2026-11-15T10:00:00+00:00",
    opportunity_sources: [{ source_id: "src-manual-xlsx", url: "https://example.com/f", position: 0 }],
    ...overrides,
  };
}

describe("createSupabaseRepository", () => {
  it("lista solo publicadas y vencidas, y reutiliza la respuesta dentro del TTL", async () => {
    let clock = 0;
    const { client, queries } = createFakeSupabase((q) => (q.table === "opportunities" ? { data: [row()] } : undefined));
    const repo = createSupabaseRepository(client, { cacheTtlMs: 1000, now: () => clock });

    const first = await repo.listPublicRecords();
    expect(first.map((r) => r.slug)).toEqual(["practica-uno"]);
    expect(op(queries[0], "in")).toEqual(["status", ["publicada", "vencida"]]);

    clock = 999;
    await repo.listPublicRecords();
    expect(queries).toHaveLength(1);

    clock = 1000;
    await repo.listPublicRecords();
    expect(queries).toHaveLength(2);
  });

  it("busca por slug primero en la caché y solo va a la base si no está", async () => {
    const retired = row({ id: "22222222-2222-4222-8222-222222222222", slug: "retirada", status: "retirada" });
    const handler: FakeHandler = (q) => {
      if (q.table !== "opportunities") return undefined;
      if (op(q, "maybeSingle")) return { data: op(q, "eq")?.[1] === "retirada" ? retired : null };
      return { data: [row()] };
    };
    const { client, queries } = createFakeSupabase(handler);
    const repo = createSupabaseRepository(client);

    expect((await repo.getRecordBySlug("practica-uno"))?.id).toBe(ID);
    expect(queries).toHaveLength(1);
    expect((await repo.getRecordBySlug("retirada"))?.status).toBe("retirada");
    expect(await repo.getRecordBySlug("no-existe")).toBeNull();
    expect(queries).toHaveLength(3);
  });

  it("un id que no es UUID no consulta la base", async () => {
    const { client, queries } = createFakeSupabase((q) => ({ data: op(q, "maybeSingle") ? null : [] }));
    const repo = createSupabaseRepository(client);
    expect(await repo.getRecordById("opp-001")).toBeNull();
    expect(queries).toHaveLength(0);
    expect(await repo.getRecordById(ID)).toBeNull();
  });

  it("solo lista fuentes habilitadas y mapea organizaciones", async () => {
    const { client, queries } = createFakeSupabase((q) => {
      if (q.table === "sources") return { data: [{ id: "src-a", name: "A", url: "https://example.com", method: "api", last_run_at: null }] };
      if (q.table === "organizations") return { data: [{ id: "o1", name: "Org", sector: "privado", logo_url: null }] };
      return undefined;
    });
    const repo = createSupabaseRepository(client);
    expect(await repo.listSources()).toEqual([{ id: "src-a", name: "A", url: "https://example.com", method: "api", lastRunAt: null }]);
    expect(op(queries[0], "eq")).toEqual(["enabled", true]);
    expect(await repo.listOrganizations()).toEqual([{ id: "o1", name: "Org", sector: "privado", logoUrl: null }]);
  });

  it("guarda un reporte y devuelve el registro", async () => {
    const { client, queries } = createFakeSupabase(() => ({
      data: { id: "r1", opportunity_id: ID, reason: "otro", comment: "hola", created_at: "2026-11-16T10:00:00+00:00" },
    }));
    const repo = createSupabaseRepository(client);
    const report = await repo.insertIssueReport({ opportunityId: ID, reason: "otro", comment: "hola" });
    expect(report).toEqual({ id: "r1", opportunityId: ID, reason: "otro", comment: "hola", createdAt: "2026-11-16T10:00:00.000Z" });
    expect(op(queries[0], "insert")).toEqual([{ opportunity_id: ID, reason: "otro", comment: "hola" }]);
  });

  it("un error de la base sale en español y no queda en caché", async () => {
    let fail = true;
    const { client } = createFakeSupabase(() => (fail ? { error: { message: "boom" } } : { data: [row()] }));
    const repo = createSupabaseRepository(client);
    await expect(repo.listPublicRecords()).rejects.toThrow("Supabase: no se pudo leer las convocatorias publicadas: boom");
    fail = false;
    expect(await repo.listPublicRecords()).toHaveLength(1);
  });
});

describe("ttlCache", () => {
  it("comparte la misma carga entre llamadas simultáneas", async () => {
    let loads = 0;
    const cached = ttlCache(async () => (loads += 1), 1000, () => 0);
    expect(await Promise.all([cached(), cached(), cached()])).toEqual([1, 1, 1]);
  });
});

describe("fetchAll", () => {
  it("pagina hasta que una página llega incompleta", async () => {
    const ranges: [number, number][] = [];
    const all = [1, 2, 3, 4, 5];
    const rows = await fetchAll<number>(
      async (from, to) => {
        ranges.push([from, to]);
        return { data: all.slice(from, to + 1), error: null };
      },
      "leer",
      2,
    );
    expect(rows).toEqual(all);
    expect(ranges).toEqual([[0, 1], [2, 3], [4, 5]]);
  });
});

describe("readSupabaseEnv", () => {
  const SECRET = "sb_secret_valor-de-prueba";

  it("devuelve la configuración cuando está completa", () => {
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: " https://abc.supabase.co ", SUPABASE_SERVICE_ROLE_KEY: SECRET })).toEqual({
      url: "https://abc.supabase.co",
      secretKey: SECRET,
    });
  });

  it("dice qué variable falta, sin mostrar valores", () => {
    expect(() => readSupabaseEnv({})).toThrow("NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
    let message = "";
    try {
      readSupabaseEnv({ SUPABASE_SERVICE_ROLE_KEY: SECRET });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).not.toContain(SECRET);
  });

  it("exige https", () => {
    expect(() => readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://abc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: SECRET })).toThrow("https");
  });
});

describe("getRepository", () => {
  const KEYS = ["USE_MOCKS", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    resetRepositoryForTests();
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetRepositoryForTests();
  });

  it("usa los datos de prueba por defecto y con USE_MOCKS=true", () => {
    expect(getRepository()).toBe(memoryRepository);
    process.env.USE_MOCKS = "true";
    expect(getRepository()).toBe(memoryRepository);
  });

  it("con USE_MOCKS=true ignora las variables de Supabase", () => {
    process.env.USE_MOCKS = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_prueba";
    expect(getRepository()).toBe(memoryRepository);
  });

  it("con USE_MOCKS=false y las variables usa Supabase (un solo repositorio por proceso)", () => {
    process.env.USE_MOCKS = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_prueba";
    const repo = getRepository();
    expect(repo).not.toBe(memoryRepository);
    expect(getRepository()).toBe(repo);
  });

  it("con USE_MOCKS=false y sin variables lanza un error claro en español", () => {
    process.env.USE_MOCKS = "false";
    expect(() => getRepository()).toThrow(/USE_MOCKS=false, pero no se puede usar Supabase\. Falta configurar Supabase/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    expect(() => getRepository()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
});

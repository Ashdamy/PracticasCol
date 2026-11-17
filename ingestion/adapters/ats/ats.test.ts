/** Conectores de ATS (Greenhouse y Lever). Sin red: `http` falso y fixtures ficticios escritos a mano. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HttpResponse, PoliteFetcher } from "../../http";
import { normalizeDraft } from "../../normalize";
import { runIngestion } from "../../pipeline";
import { ATS_SOURCES, createAtsAdapter, findAtsSource } from "../../sources/ats";
import { createMemoryStore } from "../../store";
import type { AdapterContext, OpportunityDraft, RawItem, SourceAdapter } from "../../types";
import {
  compileCountries,
  decodeEntities,
  htmlToText,
  isInternshipTitle,
  listItems,
  makeExcerpt,
  matchesLocation,
  MAX_EXCERPT_LENGTH,
  scrubPersonalData,
  truncate,
  type AtsAdapterConfig,
  type AtsPosting,
} from "./common";
import { createGreenhouseAdapter, greenhouseBoardUrl, greenhouseContentToText } from "./greenhouse";
import { createLeverAdapter, leverEpochToIso, leverPostingsUrl, leverSalaryText } from "./lever";

const NOW = new Date("2026-11-16T15:00:00.000Z");
const TODAY = "2026-11-16";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
const GREENHOUSE_JSON = fixture("greenhouse-board.json");
const LEVER_JSON = fixture("lever-postings.json");

const config = (overrides: Partial<AtsAdapterConfig> = {}): AtsAdapterConfig => ({
  id: "src-ats-empresaficticia",
  name: "Empresa Ficticia (ATS)",
  token: "empresaficticia",
  organizationName: "Empresa Ficticia S.A.S.",
  filter: { countries: ["colombia"], onlyInternships: true },
  ...overrides,
});

/** `http` falso: responde lo que se le configure y registra cada URL pedida. */
function fakeHttp(responses: Record<string, string>, status = 200) {
  const requested: string[] = [];
  const http: PoliteFetcher = {
    async get(url: string): Promise<HttpResponse> {
      requested.push(url);
      return { status, text: responses[url] ?? "", url };
    },
    async isAllowed() {
      return true;
    },
  };
  return { http, requested };
}

function context(http: PoliteFetcher) {
  const logs: string[] = [];
  const ctx: AdapterContext = { http, now: NOW, log: { info: (m) => logs.push(m), warn: (m) => logs.push(m) } };
  return { ctx, logs };
}

async function collect(adapter: SourceAdapter, url: string, body: string) {
  const { http, requested } = fakeHttp({ [url]: body });
  const { ctx, logs } = context(http);
  const items = await adapter.fetch(ctx);
  const drafts = items.map((item) => adapter.parse(item));
  return { items, drafts, requested, logs };
}

const byTitle = (drafts: OpportunityDraft[], title: string) => {
  const draft = drafts.find((d) => d.title === title);
  if (!draft) throw new Error(`No hay borrador «${title}»`);
  return draft;
};

const posting = (item: RawItem) => item.payload as AtsPosting;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("utilidades comunes", () => {
  it("desescapa entidades con nombre, decimales y hexadecimales", () => {
    expect(decodeEntities("&lt;p&gt;Dise&ntilde;o &amp; c&#243;digo &#x1F600; &desconocida;&lt;/p&gt;")).toBe(
      "<p>Diseño & código 😀 &desconocida;</p>",
    );
  });

  it("convierte HTML en texto plano, con viñetas y sin scripts", () => {
    const html = "<div><h2>Título</h2><p>Hola&nbsp;<b>mundo</b></p><ul><li>Uno</li><li>Dos</li></ul><script>x()</script></div>";
    expect(htmlToText(html)).toBe("Título\nHola mundo\n- Uno\n- Dos");
  });

  it("saca las viñetas de una lista", () => {
    expect(listItems("<ul><li>Uno</li><li><b>Dos</b> y medio</li></ul>")).toEqual(["Uno", "Dos y medio"]);
    expect(listItems("<li>Sin cierre<li>Otra")).toEqual(["Sin cierre", "Otra"]);
  });

  it("recorta en límite de palabra y termina en «…»", () => {
    expect(truncate("uno dos tres cuatro", 12)).toBe("uno dos…");
    expect(truncate("uno dos tres", 12)).toBe("uno dos tres");
    expect(truncate("uno dos, tres cuatro", 9)).toBe("uno dos…");
    const long = "palabra ".repeat(100);
    const cut = makeExcerpt(long);
    expect(cut.length).toBeLessThanOrEqual(MAX_EXCERPT_LENGTH);
    expect(cut.endsWith("palabra…")).toBe(true);
  });

  it("quita las frases que identifican a una persona", () => {
    const text = "Aprenderás mucho. Escríbele a Fulana Inventada: fulana@ficticia.example. Te esperamos.";
    expect(scrubPersonalData(text)).toBe("Aprenderás mucho. Te esperamos.");
    expect(scrubPersonalData("Tu hiring manager será Mengano.\nLlama al +57 300 123 4567.\nSigue leyendo.")).toBe(
      "Sigue leyendo.",
    );
    expect(scrubPersonalData("Perfil: linkedin.com/in/fulana-inventada")).toBe("");
  });

  it.each([
    "Practicante de Mercadeo",
    "Prácticas universitarias 2027",
    "PASANTE DE DATOS",
    "Pasantía en comunicaciones",
    "Aprendiz SENA",
    "Becario de finanzas",
    "Marketing Intern",
    "Summer Internship - Design",
    "Finance Trainee",
    "Student Ambassador",
    "Estudiante en práctica",
  ])("título de práctica: %j", (title) => {
    expect(isInternshipTitle(title)).toBe(true);
  });

  it.each(["Internal Communications Manager", "International Sales Lead", "Senior Data Engineer", "Best Practices Lead"])(
    "título que no es de práctica: %j",
    (title) => {
      expect(isInternshipTitle(title)).toBe(false);
    },
  );

  it("filtra por país o por municipio del catálogo", () => {
    const countries = compileCountries(["colombia"]);
    for (const location of ["Medellín", "ENVIGADO, Antioquia", "Remote - Colombia", "Remoto Colombia", "Bogotá, Colombia", "Itagüí"]) {
      expect(matchesLocation(location, countries), location).toBe(true);
    }
    for (const location of ["Austin, Texas, United States", "Mexico City", "LatAm", "Remote"]) {
      expect(matchesLocation(location, countries), location).toBe(false);
    }
    expect(matchesLocation("Ciudad de México", compileCountries(["colombia", "mexico"]))).toBe(true);
  });
});

describe("Greenhouse", () => {
  const url = greenhouseBoardUrl("empresaficticia");

  it("pide el tablero por `ctx.http` y nunca usa `fetch` directo", async () => {
    const direct = vi.spyOn(globalThis, "fetch");
    const { requested } = await collect(createGreenhouseAdapter(config()), url, GREENHOUSE_JSON);
    expect(requested).toEqual(["https://boards-api.greenhouse.io/v1/boards/empresaficticia/jobs?content=true"]);
    expect(direct).not.toHaveBeenCalled();
  });

  it("deja solo las prácticas en Colombia", async () => {
    const adapter = createGreenhouseAdapter(config());
    const { items, logs } = await collect(adapter, url, GREENHOUSE_JSON);
    expect(items.map((i) => posting(i).title)).toEqual(["Marketing Intern", "Practicante de Diseño", "Finance Trainee"]);
    expect(items.map((i) => i.externalId)).toEqual(["1001", "1004", "1006"]);
    expect(items.every((i) => i.sourceId === "src-ats-empresaficticia" && i.fetchedAt === NOW.toISOString())).toBe(true);
    // La de EE. UU. y las que no son práctica quedan fuera, pero el log deja ver que el tablero respondió.
    expect(logs).toEqual(["[src-ats-empresaficticia] 6 ofertas en el tablero, 5 en el país, 3 prácticas que pasan el filtro"]);
    expect(adapter.method).toBe("api");
    expect(adapter.autoPublish).toBe(false);
  });

  it("sin `onlyInternships` trae todas las de Colombia", async () => {
    const adapter = createGreenhouseAdapter(config({ filter: { onlyInternships: false } }));
    const { items } = await collect(adapter, url, GREENHOUSE_JSON);
    expect(items.map((i) => i.externalId)).toEqual(["1001", "1003", "1004", "1005", "1006"]);
  });

  it("desescapa y limpia el HTML de `content`", () => {
    expect(greenhouseContentToText("&lt;p&gt;Dise&amp;ntilde;o &amp;amp; datos&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Uno&lt;/li&gt;&lt;/ul&gt;")).toBe(
      "Diseño & datos\n- Uno",
    );
    expect(greenhouseContentToText(null)).toBe("");
  });

  it("arma el borrador con extracto corto, URLs y sin datos de reclutadores", async () => {
    const { items, drafts } = await collect(createGreenhouseAdapter(config()), url, GREENHOUSE_JSON);
    const draft = byTitle(drafts, "Marketing Intern");
    expect(draft).toMatchObject({
      title: "Marketing Intern",
      organizationName: "Empresa Ficticia S.A.S.",
      typeText: "Marketing Intern",
      municipalityText: "Medellín, Antioquia, Colombia",
      modalityText: "Hybrid",
      compensationText: null,
      deadlineText: null,
      requirementsText: null,
      applyUrl: "https://boards.greenhouse.io/empresaficticia/jobs/1001",
      sourceUrl: "https://boards.greenhouse.io/empresaficticia/jobs/1001",
    });
    expect(draft.description).toMatch(/^En Empresa Ficticia ayudamos a marcas de América Latina a crecer en línea\. Buscamos/);
    expect(draft.description).toContain("aprender & aportar. Trabajarás con el equipo de pauta digital.");
    expect(draft.description!.length).toBeLessThanOrEqual(300);
    expect(draft.description!.endsWith("…")).toBe(true);
    expect(draft.description).not.toMatch(/[<>]|&\w+;|rastreo/);
    expect(draft.levelText).toMatch(/^Marketing Intern\. En Empresa Ficticia/);

    // Ni en el borrador ni en el crudo que se guarda (Ley 1581 de 2012).
    const stored = JSON.stringify({ items, drafts });
    expect(stored).not.toMatch(/Fulana|Inventada|ficticia\.example|recruiter/i);
    expect(posting(items[0]).updatedAt).toBe("2026-11-10T10:30:00-05:00");
    expect(posting(items[0]).department).toBe("Marketing");
  });

  it("marca como remota la que dice «Remote - Colombia» y usa la oficina si la ubicación no sirve", async () => {
    const { drafts } = await collect(createGreenhouseAdapter(config()), url, GREENHOUSE_JSON);
    expect(byTitle(drafts, "Practicante de Diseño")).toMatchObject({
      municipalityText: "Remote - Colombia",
      modalityText: "Remote",
      description: "Práctica remota para estudiantes de diseño gráfico.",
    });
    expect(byTitle(drafts, "Finance Trainee")).toMatchObject({
      municipalityText: "Envigado, Antioquia, Colombia",
      modalityText: null,
    });
  });

  it("los borradores se normalizan como se espera", async () => {
    const { drafts } = await collect(createGreenhouseAdapter(config()), url, GREENHOUSE_JSON);
    const normalize = (title: string) => normalizeDraft(byTitle(drafts, title), { today: TODAY, sourceId: "src-ats-empresaficticia" });

    const intern = normalize("Marketing Intern");
    expect(intern.candidate).toMatchObject({
      type: "practica_profesional",
      levels: ["universitario"],
      municipalitySlug: "medellin",
      modality: "hibrida",
      deadlineType: "no_publicada",
      status: "en_revision",
    });
    expect(intern.issues).toContain("Tipo: Término en inglés; confirmar tipo");

    expect(normalize("Practicante de Diseño").candidate).toMatchObject({ municipalitySlug: null, modality: "remota" });
    const trainee = normalize("Finance Trainee");
    expect(trainee.candidate).toMatchObject({ type: "practica_profesional", municipalitySlug: "envigado" });
    expect(trainee.fieldConfidence.type).toBe("baja");
  });

  it("falla con un error claro si el tablero no responde 200 o cambia de formato", async () => {
    const adapter = createGreenhouseAdapter(config());
    await expect(adapter.fetch(context(fakeHttp({}, 404).http).ctx)).rejects.toThrow("Respuesta 404");
    await expect(adapter.fetch(context(fakeHttp({ [url]: "<html>" }).http).ctx)).rejects.toThrow("no es JSON válido");
    await expect(adapter.fetch(context(fakeHttp({ [url]: "[]" }).http).ctx)).rejects.toThrow("no hay lista «jobs»");
  });
});

describe("Lever", () => {
  const url = leverPostingsUrl("empresaficticia");

  it("pide las vacantes por `ctx.http` y nunca usa `fetch` directo", async () => {
    const direct = vi.spyOn(globalThis, "fetch");
    const { requested } = await collect(createLeverAdapter(config()), url, LEVER_JSON);
    expect(requested).toEqual(["https://api.lever.co/v0/postings/empresaficticia?mode=json"]);
    expect(direct).not.toHaveBeenCalled();
  });

  it("deja solo las prácticas en Colombia", async () => {
    const { items, logs } = await collect(createLeverAdapter(config()), url, LEVER_JSON);
    expect(items.map((i) => posting(i).title)).toEqual([
      "Pasante de Datos",
      "Customer Success Trainee",
      "Estudiante en práctica - Finanzas",
    ]);
    expect(logs).toEqual(["[src-ats-empresaficticia] 5 ofertas en el tablero, 4 en el país, 3 prácticas que pasan el filtro"]);
  });

  it("convierte el epoch de `createdAt` en fecha ISO", async () => {
    expect(leverEpochToIso(1794324600000)).toBe("2026-11-10T15:30:00.000Z");
    expect(leverEpochToIso("1794324600000")).toBeNull();
    expect(leverEpochToIso(0)).toBeNull();
    const { items } = await collect(createLeverAdapter(config()), url, LEVER_JSON);
    expect(items.map((i) => posting(i).postedAt)).toEqual(["2026-11-10T15:30:00.000Z", "2026-10-01T12:00:00.000Z", null]);
  });

  it("arma el borrador con URLs, modalidad, requisitos y pago", async () => {
    const { items, drafts } = await collect(createLeverAdapter(config()), url, LEVER_JSON);
    const draft = byTitle(drafts, "Pasante de Datos");
    expect(draft).toMatchObject({
      organizationName: "Empresa Ficticia S.A.S.",
      typeText: "Pasante de Datos",
      municipalityText: "Medellín",
      modalityText: "hybrid",
      compensationText: "Salario 1750000 COP al mes",
      deadlineText: null,
      applyUrl: "https://jobs.lever.co/empresaficticia/aaaa1111-0000-4000-8000-000000002001/apply",
      sourceUrl: "https://jobs.lever.co/empresaficticia/aaaa1111-0000-4000-8000-000000002001",
      // Solo la lista de requisitos (no la de beneficios) y máximo 5 viñetas.
      requirementsText: [
        "Estar cursando desde 7.º semestre",
        "SQL básico",
        "Manejo de hojas de cálculo",
        "Disponibilidad de 6 meses",
        "Aval de práctica de tu universidad",
      ].join("\n"),
    });
    expect(draft.description!.length).toBeLessThanOrEqual(300);
    expect(draft.description!.endsWith("…")).toBe(true);
    expect(draft.description).toContain("Buscamos estudiantes de pregrado");

    // El JSON de Lever trae `hiringManager` y `owner`: nada de eso llega al borrador ni al crudo.
    const stored = JSON.stringify({ items, drafts });
    expect(stored).not.toMatch(/Mengano|Zutana|Inventad|ficticia\.example|hiring manager|recruiter/i);
    expect(posting(items[0])).toMatchObject({ commitment: "Internship", department: "Tecnología", workplaceType: "hybrid" });
  });

  it("usa `allLocations`, el HTML de `description` y descarta viñetas largas o con datos de personas", async () => {
    const { drafts } = await collect(createLeverAdapter(config()), url, LEVER_JSON);
    expect(byTitle(drafts, "Customer Success Trainee")).toMatchObject({
      municipalityText: "Colombia",
      modalityText: "remote",
      description: "Join our fictional customer success team as a trainee. You will learn by doing.",
      compensationText: "Remunerada (rango publicado en USD, por año; ver la convocatoria)",
      requirementsText: [
        "Currently enrolled as an undergraduate student",
        "Good written English",
        "Curiosity",
        "Empathy",
        "Basic spreadsheet skills",
      ].join("\n"),
    });
  });

  it("usa el código de país y cae a `hostedUrl` si no hay `applyUrl`", async () => {
    const { drafts } = await collect(createLeverAdapter(config()), url, LEVER_JSON);
    expect(byTitle(drafts, "Estudiante en práctica - Finanzas")).toMatchObject({
      municipalityText: "Bogotá, Colombia",
      modalityText: null,
      compensationText: null,
      requirementsText: null,
      applyUrl: "https://jobs.lever.co/empresaficticia/aaaa1111-0000-4000-8000-000000002005",
      sourceUrl: "https://jobs.lever.co/empresaficticia/aaaa1111-0000-4000-8000-000000002005",
    });
  });

  it("solo pasa el monto si está en pesos y por mes", () => {
    expect(leverSalaryText({ min: 1500000, max: 2000000, currency: "cop", interval: "per-month-salary" })).toBe(
      "Salario desde 1500000 hasta 2000000 COP al mes",
    );
    expect(leverSalaryText({ min: 24000000, max: 24000000, currency: "COP", interval: "per-year-salary" })).toBe(
      "Remunerada (rango publicado en COP, por año; ver la convocatoria)",
    );
    expect(leverSalaryText({ min: 0, max: 0, currency: "COP" })).toBeNull();
    expect(leverSalaryText(undefined)).toBeNull();
  });

  it("los borradores se normalizan como se espera", async () => {
    const { drafts } = await collect(createLeverAdapter(config()), url, LEVER_JSON);
    const normalize = (title: string) => normalizeDraft(byTitle(drafts, title), { today: TODAY, sourceId: "src-ats-empresaficticia" });

    expect(normalize("Pasante de Datos").candidate).toMatchObject({
      type: "pasantia",
      levels: ["universitario"],
      municipalitySlug: "medellin",
      modality: "hibrida",
      compensationType: "salario",
      compensationAmountCop: 1_750_000,
      status: "en_revision",
    });

    const trainee = normalize("Customer Success Trainee");
    expect(trainee.candidate).toMatchObject({
      municipalitySlug: null,
      modality: "remota",
      compensationType: "salario",
      compensationAmountCop: null,
    });
    expect(trainee.fieldConfidence.municipality).toBe("alta");

    const bogota = normalize("Estudiante en práctica - Finanzas");
    expect(bogota.candidate.municipalitySlug).toBeNull();
    expect(bogota.issues.some((issue) => issue.includes("fuera de cobertura"))).toBe(true);
  });

  it("falla con un error claro si la respuesta no es una lista", async () => {
    const adapter = createLeverAdapter(config());
    await expect(adapter.fetch(context(fakeHttp({ [url]: '{"ok":false}' }).http).ctx)).rejects.toThrow("no es una lista");
    await expect(adapter.fetch(context(fakeHttp({}, 503).http).ctx)).rejects.toThrow("Respuesta 503");
  });
});

describe("registro de fuentes ATS", () => {
  it("incluye las empresas del sondeo, todas con filtro Colombia + prácticas y sin publicar solas", () => {
    expect(ATS_SOURCES.map((s) => `${s.provider}:${s.token}`)).toEqual([
      "greenhouse:powerdigitalmarketing",
      "greenhouse:clara",
      "greenhouse:cobre",
      "greenhouse:wizeline",
      "lever:lahaus",
      "lever:yuno",
    ]);
    expect(new Set(ATS_SOURCES.map((s) => s.id)).size).toBe(ATS_SOURCES.length);
    for (const source of ATS_SOURCES) {
      expect(source.filter).toEqual({ countries: ["colombia"], onlyInternships: true });
      const adapter = createAtsAdapter(source);
      expect(adapter.id).toBe(source.id);
      expect(adapter.autoPublish).toBe(false);
      expect(adapter.method).toBe("api");
    }
  });

  it("solo consulta hosts de Greenhouse y Lever (nunca SmartRecruiters ni Ashby)", async () => {
    const { http, requested } = fakeHttp({});
    for (const source of ATS_SOURCES) {
      await createAtsAdapter(source)
        .fetch(context(http).ctx)
        .catch(() => undefined);
    }
    expect(requested).toHaveLength(ATS_SOURCES.length);
    expect(new Set(requested.map((u) => new URL(u).host))).toEqual(new Set(["boards-api.greenhouse.io", "api.lever.co"]));
  });

  it("encuentra una fuente por id o por token", () => {
    expect(findAtsSource("powerdigitalmarketing")?.organizationName).toBe("Power Digital Marketing");
    expect(findAtsSource("src-ats-yuno")?.provider).toBe("lever");
    expect(findAtsSource(" LaHaus ")?.organizationName).toBe("La Haus");
    expect(findAtsSource("smartrecruiters")).toBeUndefined();
  });
});

describe("pipeline con fuentes ATS", () => {
  it("todo queda en revisión y una segunda corrida no cambia nada", async () => {
    const greenhouse = createGreenhouseAdapter(config({ id: "src-ats-gh" }));
    const lever = createLeverAdapter(config({ id: "src-ats-lever", organizationName: "Otra Ficticia S.A.S." }));
    const { http } = fakeHttp({
      [greenhouseBoardUrl("empresaficticia")]: GREENHOUSE_JSON,
      [leverPostingsUrl("empresaficticia")]: LEVER_JSON,
    });
    const store = createMemoryStore();

    const first = await runIngestion({ adapters: [greenhouse, lever], store, http, now: NOW });
    expect(first.reports.map((r) => [r.fetched, r.created, r.needsReview, r.errors.length])).toEqual([
      [3, 3, 3, 0],
      [3, 3, 3, 0],
    ]);
    expect(first.items.every((i) => i.status === "en_revision")).toBe(true);
    expect(first.items.map((i) => [i.municipalitySlug, i.modality])).toEqual([
      ["medellin", "hibrida"],
      [null, "remota"],
      ["envigado", "no_especificada"],
      ["medellin", "hibrida"],
      [null, "remota"],
      [null, "no_especificada"],
    ]);

    const second = await runIngestion({ adapters: [greenhouse, lever], store, http, now: new Date("2026-11-17T15:00:00.000Z") });
    expect(second.reports.map((r) => [r.fetched, r.unchanged, r.created])).toEqual([
      [3, 3, 0],
      [3, 3, 0],
    ]);
  });
});

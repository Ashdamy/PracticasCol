import { beforeEach, describe, expect, it } from "vitest";
import { PublishOpportunitySchema, type PublishOpportunityInput } from "@/lib/contracts";
import { mockPublishInput } from "@/lib/mocks";
import { memoryPublications, memoryRepository } from "@/server/repo/memory";
import type { Repository } from "@/server/repo";
import {
  MAX_PER_IP_PER_HOUR,
  PUBLICATION_SOURCE_ID,
  botSignal,
  buildCandidate,
  catalogErrors,
  clientIp,
  hashIp,
  reviewNotesFor,
} from "./rules";
import { referenceFor, submitOpportunityWith } from "./submit";

/** 10:00 a. m. en Colombia → hoy = 2026-11-20. */
const NOW = new Date("2026-11-20T15:00:00.000Z");

function input(overrides: Partial<PublishOpportunityInput> = {}): PublishOpportunityInput {
  return { ...mockPublishInput, startedAt: NOW.getTime() - 60_000, ...overrides };
}

const parse = (overrides: Partial<PublishOpportunityInput> = {}) => PublishOpportunitySchema.parse(input(overrides));

function submit(overrides: Partial<PublishOpportunityInput> = {}, repo: Repository = memoryRepository, ipHash = "ip-a") {
  return submitOpportunityWith(input(overrides), { repo, now: NOW, ipHash });
}

beforeEach(() => {
  memoryPublications.length = 0;
});

describe("PublishOpportunitySchema", () => {
  it("el ejemplo de los mocks es válido", () => {
    expect(PublishOpportunitySchema.safeParse(input()).success).toBe(true);
  });

  it("exige municipio salvo en remotas", () => {
    expect(PublishOpportunitySchema.safeParse(input({ municipality: null })).success).toBe(false);
    expect(PublishOpportunitySchema.safeParse(input({ municipality: null, modality: "remota" })).success).toBe(true);
  });

  it("exige fecha cuando el cierre es por fecha", () => {
    const result = PublishOpportunitySchema.safeParse(input({ deadlineType: "fecha", deadlineDate: null }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["deadlineDate"]);
  });

  it("no acepta modalidad ni pago «sin especificar»: quien publica sí los sabe", () => {
    expect(PublishOpportunitySchema.safeParse({ ...input(), modality: "no_especificada" }).success).toBe(false);
    expect(PublishOpportunitySchema.safeParse({ ...input(), compensationType: "no_especificado" }).success).toBe(false);
  });

  it("exige enlace https, correo válido y las dos declaraciones", () => {
    expect(PublishOpportunitySchema.safeParse(input({ applyUrl: "http://example.com" })).success).toBe(false);
    expect(PublishOpportunitySchema.safeParse(input({ contactEmail: "no-es-correo" })).success).toBe(false);
    expect(PublishOpportunitySchema.safeParse({ ...input(), acceptsTerms: false }).success).toBe(false);
    expect(PublishOpportunitySchema.safeParse({ ...input(), acceptsPrivacy: false }).success).toBe(false);
  });

  it("valida rangos: semestres y monto sin pago", () => {
    expect(PublishOpportunitySchema.safeParse(input({ semesterMin: 9, semesterMax: 7 })).success).toBe(false);
    expect(
      PublishOpportunitySchema.safeParse(input({ compensationType: "sin_remuneracion", compensationAmountCop: 500_000 })).success,
    ).toBe(false);
  });
});

describe("antispam", () => {
  it("detecta el campo trampa, los envíos demasiado rápidos y los formularios viejos", () => {
    const now = NOW.getTime();
    expect(botSignal({ trap: "", startedAt: now - 10_000 }, now)).toBeNull();
    expect(botSignal({ trap: "http://spam", startedAt: now - 10_000 }, now)).toBe("trampa");
    expect(botSignal({ trap: "", startedAt: now - 1000 }, now)).toBe("muy_rapido");
    expect(botSignal({ trap: "", startedAt: now - 2 * 24 * 3600 * 1000 }, now)).toBe("formulario_viejo");
  });

  it("toma la IP del cliente de x-forwarded-for y la guarda solo como HMAC", () => {
    const headers = new Headers({ "x-forwarded-for": "190.1.2.3, 10.0.0.1" });
    expect(clientIp(headers)).toBe("190.1.2.3");
    expect(clientIp(new Headers())).toBe("desconocida");
    const hash = hashIp("190.1.2.3", "secreto");
    expect(hash).toHaveLength(32);
    expect(hash).not.toContain("190");
    expect(hashIp("190.1.2.3", "otro")).not.toBe(hash);
  });
});

describe("reglas", () => {
  it("rechaza municipios y programas que no están en el catálogo, y fechas pasadas", () => {
    expect(catalogErrors(parse({ municipality: "bogota" }), "2026-11-20")).toHaveProperty("municipality");
    expect(catalogErrors(parse({ programIds: ["prog-inventado"] }), "2026-11-20")).toHaveProperty("programIds");
    expect(catalogErrors(parse({ deadlineType: "fecha", deadlineDate: "2026-11-19" }), "2026-11-20")).toHaveProperty("deadlineDate");
    expect(catalogErrors(parse({ deadlineType: "fecha", deadlineDate: "2026-11-20" }), "2026-11-20")).toEqual({});
  });

  it("arma la convocatoria en revisión, con la fuente del formulario y los núcleos de «y afines»", () => {
    const candidate = buildCandidate(parse());
    expect(candidate).toMatchObject({
      status: "en_revision",
      municipalitySlug: "itagui",
      openToAllPrograms: false,
      programIds: ["prog-ing-industrial", "prog-ing-produccion"],
      acceptsRelatedPrograms: true,
      compensationAmountCop: 1_750_000,
      durationMonthsMin: 6,
      durationMonthsMax: 6,
      deadlineDate: null,
      otherRequirements: ["Excel intermedio", "Disponibilidad de tiempo completo"],
      sources: [{ sourceId: PUBLICATION_SOURCE_ID, url: "https://example.com/empleos/practicante-industrial" }],
    });
    expect(candidate.knowledgeAreaIds.length).toBeGreaterThan(0);
    expect(candidate.slug).toMatch(/^practicante-de-ingenieria-industrial/);
  });

  it("sin programas queda abierta a cualquiera", () => {
    const candidate = buildCandidate(parse({ programIds: [], acceptsRelatedPrograms: true }));
    expect(candidate).toMatchObject({ openToAllPrograms: true, acceptsRelatedPrograms: false, knowledgeAreaIds: [] });
  });

  it("marca correos personales, acortadores, cobros y pagos raros, sin incluir datos del contacto", () => {
    const notes = reviewNotesFor(
      parse({
        contactEmail: "alguien@gmail.com",
        applyUrl: "https://bit.ly/abc",
        description: "Para iniciar debes pagar la inscripción de 50.000 pesos y luego empiezas la práctica en la empresa.",
        type: "contrato_aprendizaje",
        compensationType: "salario",
      }),
    );
    const text = notes.join("\n");
    expect(text).toContain("correo personal");
    expect(text).toContain("acortador");
    expect(text).toContain("nunca debe cobrarle");
    expect(text).toContain("apoyo de sostenimiento");
    expect(text).not.toContain("alguien@gmail.com");
  });

  it("avisa cuando el dominio del correo no coincide con el del enlace", () => {
    const notes = reviewNotesFor(parse({ contactEmail: "rrhh@empresa.com.co", applyUrl: "https://otro-portal.com/oferta" }));
    expect(notes.join(" ")).toContain("no coincide");
    expect(reviewNotesFor(parse({ contactEmail: "rrhh@empresa.com.co", applyUrl: "https://empleos.empresa.com.co/1" })).join(" ")).not.toContain(
      "no coincide",
    );
  });
});

describe("submitOpportunityWith", () => {
  it("guarda en revisión con el contacto aparte y devuelve una referencia corta", async () => {
    const result = await submit();
    expect(result).toEqual({ ok: true, data: { reference: "PUB0001" } });
    expect(memoryPublications).toHaveLength(1);
    const [saved] = memoryPublications;
    expect(saved.candidate.status).toBe("en_revision");
    expect(saved.contact).toEqual({ name: "Persona de Prueba", email: "talento@example.com", role: "Analista de talento humano", ipHash: "ip-a" });
    expect(saved.reviewNotes.join(" ")).not.toContain("talento@example.com");
  });

  it("devuelve los errores por campo sin guardar nada", async () => {
    const result = await submit({ title: "Corto", applyUrl: "no-es-url" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(Object.keys(result.error.fieldErrors ?? {})).toEqual(expect.arrayContaining(["title", "applyUrl"]));
    expect(memoryPublications).toHaveLength(0);
  });

  it("al bot del campo trampa le responde «ok» pero no guarda nada", async () => {
    expect(await submit({ trap: "http://spam.example" })).toEqual({ ok: true, data: { reference: "RECIBIDA" } });
    expect(memoryPublications).toHaveLength(0);
  });

  it("rechaza los envíos demasiado rápidos", async () => {
    const result = await submit({ startedAt: NOW.getTime() - 500 });
    expect(result.ok).toBe(false);
    expect(memoryPublications).toHaveLength(0);
  });

  it("limita los envíos por IP", async () => {
    for (let i = 0; i < MAX_PER_IP_PER_HOUR; i += 1) {
      expect((await submit({ title: `Practicante número ${i} de prueba` })).ok).toBe(true);
    }
    const blocked = await submit({ title: "Practicante número extra de prueba" });
    expect(blocked).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
    expect((await submit({ title: "Practicante desde otra red" }, memoryRepository, "ip-b")).ok).toBe(true);
  });

  it("una fecha de cierre pasada se rechaza en el campo", async () => {
    const result = await submit({ deadlineType: "fecha", deadlineDate: "2026-11-01" });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { deadlineDate: "La fecha de cierre ya pasó" } } });
  });

  it("marca los posibles duplicados para que no entren en bloque", async () => {
    await submit();
    await submit({ contactEmail: "otra@example.com" });
    expect(memoryPublications[1].reviewNotes.join(" ")).toMatch(/^.*Posible duplicado de «Practicante de Ingeniería Industrial/);
  });

  it("si la base falla, responde un error amable sin detalles internos", async () => {
    const broken: Repository = {
      ...memoryRepository,
      countRecentPublications: async () => {
        throw new Error("Supabase: conexión rechazada (clave sb_secret_xyz)");
      },
    };
    const result = await submit({}, broken);
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    if (!result.ok) expect(result.error.message).not.toContain("sb_secret");
  });

  it("la referencia es corta y sin guiones", () => {
    expect(referenceFor("0b8f6c1e-2a4d-4e7b-9c3a-5d6e7f8a9b0c")).toBe("0B8F6C1E");
  });
});

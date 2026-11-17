import { describe, expect, it } from "vitest";
import type { OpportunityDraft } from "../types";
import { normalizeDraft, slugify, splitRequirements, summarize } from "./index";

const TODAY = "2026-11-13";

export function draft(overrides: Partial<OpportunityDraft> = {}): OpportunityDraft {
  return {
    title: "Practicante de Ingeniería Industrial",
    organizationName: "Empresa Ficticia Uno S.A.S.",
    typeText: "Práctica profesional",
    levelText: "Universitario",
    municipalityText: "Medellín, Antioquia",
    modalityText: "Híbrida",
    compensationText: "Apoyo de sostenimiento $1.750.000",
    durationText: "6 meses",
    deadlineText: "15 de diciembre de 2026",
    startDateText: "01/02/2027",
    description: "Apoyo al equipo de mejora continua de la planta.",
    programsText: "Ingeniería Industrial, Ingeniería de Producción y afines",
    semesterText: "A partir de 8° semestre",
    requirementsText: "Manejo intermedio de Excel; Disponibilidad de tiempo completo",
    institutionsText: null,
    applyUrl: "https://example.com/postular/1",
    sourceUrl: "https://example.com/convocatorias/1",
    ...overrides,
  };
}

const options = { today: TODAY, sourceId: "src-test", autoPublish: true };

describe("normalizeDraft", () => {
  it("convierte un borrador completo en una oportunidad lista", () => {
    const result = normalizeDraft(draft(), options);
    expect(result.issues).toEqual([]);
    expect(result.confidence).toBe("alta");
    expect(result.needsReview).toBe(false);
    expect(result.candidate).toEqual({
      slug: "practicante-de-ingenieria-industrial-empresa-ficticia-uno-s-a-s",
      title: "Practicante de Ingeniería Industrial",
      organizationName: "Empresa Ficticia Uno S.A.S.",
      type: "practica_profesional",
      levels: ["universitario"],
      municipalitySlug: "medellin",
      modality: "hibrida",
      compensationType: "apoyo_sostenimiento",
      compensationAmountCop: 1_750_000,
      durationMonthsMin: 6,
      durationMonthsMax: 6,
      deadlineType: "fecha",
      deadlineDate: "2026-12-15",
      startDate: "2027-02-01",
      description: "Apoyo al equipo de mejora continua de la planta.",
      openToAllPrograms: false,
      programIds: ["prog-ing-industrial", "prog-ing-produccion"],
      knowledgeAreaIds: [],
      acceptsRelatedPrograms: true,
      semesterMin: 8,
      semesterMax: null,
      acceptsGraduates: null,
      institutionIds: null,
      otherRequirements: ["Manejo intermedio de Excel", "Disponibilidad de tiempo completo"],
      applyUrl: "https://example.com/postular/1",
      sources: [{ sourceId: "src-test", url: "https://example.com/convocatorias/1" }],
      status: "publicada",
    });
  });

  it("sin autoPublish siempre queda en revisión, aunque todo esté perfecto", () => {
    const result = normalizeDraft(draft(), { ...options, autoPublish: false });
    expect(result.candidate.status).toBe("en_revision");
    expect(result.needsReview).toBe(true);
    expect(result.issues).toEqual([]);
    expect(normalizeDraft(draft(), { today: TODAY, sourceId: "src-test" }).candidate.status).toBe("en_revision");
  });

  it.each<[string, Partial<OpportunityDraft>]>([
    ["sin título", { title: " " }],
    ["sin organización", { organizationName: null }],
    ["enlace http", { applyUrl: "http://example.com/postular/1" }],
    ["enlace inválido", { applyUrl: "example.com/postular" }],
    ["enlace con otro protocolo", { applyUrl: "javascript:alert(1)", sourceUrl: null }],
    ["tipo deducido del título", { typeText: null }],
    ["nivel ambiguo", { levelText: "Técnico" }],
    ["sin nivel ni programas", { levelText: null, programsText: null }],
    ["fecha sin año", { deadlineText: "15 de diciembre" }],
    ["fecha inválida", { deadlineText: "31/02/2027" }],
    ["municipio fuera de cobertura", { municipalityText: "Bogotá" }],
    ["programa no reconocido", { programsText: "Gastronomía" }],
    ["pago ilegible", { compensationText: "Ver convocatoria" }],
    ["sin descripción", { description: null }],
  ])("con autoPublish no publica si hay dudas: %s", (_name, overrides) => {
    const result = normalizeDraft(draft(overrides), options);
    expect(result.candidate.status).toBe("en_revision");
    expect(result.needsReview).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.confidence).not.toBe("alta");
  });

  it("los campos opcionales vacíos no bloquean la publicación", () => {
    const result = normalizeDraft(
      draft({
        compensationText: null,
        durationText: null,
        startDateText: null,
        programsText: null,
        semesterText: null,
        requirementsText: null,
        deadlineText: "Hasta agotar cupos",
      }),
      options,
    );
    expect(result.issues).toEqual([]);
    expect(result.candidate.status).toBe("publicada");
    expect(result.candidate).toMatchObject({
      compensationType: "no_especificado",
      durationMonthsMin: null,
      deadlineType: "hasta_agotar_cupos",
      deadlineDate: null,
      programIds: [],
      otherRequirements: [],
    });
  });

  it("fecha límite pasada → vencida, nunca publicada", () => {
    const result = normalizeDraft(draft({ deadlineText: "12/11/2026" }), options);
    expect(result.candidate.status).toBe("vencida");
    expect(result.needsReview).toBe(false);
    expect(result.issues.join(" ")).toContain("ya pasó");
    // El día de cierre todavía está abierta.
    expect(normalizeDraft(draft({ deadlineText: "13/11/2026" }), options).candidate.status).toBe("publicada");
  });

  it("fecha límite con solo mes y año: último día del mes, a revisión; si ya pasó → vencida", () => {
    const open = normalizeDraft(draft({ deadlineText: "diciembre de 2026" }), options);
    expect(open.candidate).toMatchObject({ deadlineType: "fecha", deadlineDate: "2026-12-31", status: "en_revision" });
    expect(open.fieldConfidence.deadline).toBe("baja");
    expect(open.issues).toContain("Fecha límite: Solo se publicó mes y año; se asumió el último día del mes; confirmar");

    const past = normalizeDraft(draft({ deadlineText: "octubre 2026" }), options);
    expect(past.candidate).toMatchObject({ deadlineDate: "2026-10-31", status: "vencida" });
    expect(past.issues.join(" ")).toContain("ya pasó (2026-10-31)");

    // El mes en curso sigue abierto hasta su último día.
    expect(normalizeDraft(draft({ deadlineText: "11/2026" }), options).candidate).toMatchObject({
      deadlineDate: "2026-11-30",
      status: "en_revision",
    });
  });

  it("fecha de inicio con solo mes y año: día 1 con confianza media", () => {
    const result = normalizeDraft(draft({ startDateText: "enero 2027" }), options);
    expect(result.candidate.startDate).toBe("2027-01-01");
    expect(result.fieldConfidence.startDate).toBe("media");
    expect(result.issues).toEqual(["Fecha de inicio: Solo se publicó mes y año; se asumió el día 1"]);
  });

  describe("pago en contrato de aprendizaje (Ley 789 de 2002)", () => {
    const APPRENTICE_ISSUE = "Pago: en contrato de aprendizaje se interpreta como apoyo de sostenimiento";
    const apprentice = (compensationText: string) =>
      normalizeDraft(
        draft({ title: "Aprendiz de logística", typeText: "Contrato de aprendizaje", compensationText }),
        options,
      );

    it.each([
      ["$1.300.000", 1_300_000],
      ["Salario 1.300.000", 1_300_000],
      ["75% SMMLV", null],
    ])("%j → apoyo de sostenimiento, conserva el monto", (text, amountCop) => {
      const result = apprentice(text);
      expect(result.candidate.type).toBe("contrato_aprendizaje");
      expect(result.candidate.compensationType).toBe("apoyo_sostenimiento");
      expect(result.candidate.compensationAmountCop).toBe(amountCop);
      expect(result.issues).toContain(APPRENTICE_ISSUE);
      expect(result.issues.join(" ")).not.toContain("se asumió salario");
      expect(result.candidate.status).toBe("en_revision");
    });

    it("mantiene el aviso de salarios mínimos sin valor en pesos", () => {
      const result = apprentice("75% SMMLV");
      expect(result.issues.filter((issue) => issue.startsWith("Pago:"))).toEqual([
        APPRENTICE_ISSUE,
        'Pago: Monto expresado en salarios mínimos ("75% SMMLV"): falta el valor en pesos',
      ]);
    });

    it("si la fuente ya dice apoyo de sostenimiento no agrega observaciones", () => {
      const result = apprentice("Apoyo de sostenimiento $1.300.000");
      expect(result.candidate.compensationType).toBe("apoyo_sostenimiento");
      expect(result.issues).toEqual([]);
    });

    it("en otros tipos el pago no cambia", () => {
      const result = normalizeDraft(draft({ compensationText: "$1.300.000" }), options);
      expect(result.candidate.type).toBe("practica_profesional");
      expect(result.candidate.compensationType).toBe("salario");
      expect(result.candidate.compensationAmountCop).toBe(1_300_000);
      expect(result.issues).toEqual(["Pago: Monto sin etiqueta: se asumió salario"]);
    });
  });

  it("usa el enlace de la fuente si falta el de postulación (y lo marca)", () => {
    const result = normalizeDraft(draft({ applyUrl: null }), options);
    expect(result.candidate.applyUrl).toBe("https://example.com/convocatorias/1");
    expect(result.fieldConfidence.applyUrl).toBe("media");
    expect(result.candidate.status).toBe("en_revision");
  });

  it("usa el enlace de postulación como fuente si no hay enlace de fuente", () => {
    const result = normalizeDraft(draft({ sourceUrl: null }), options);
    expect(result.candidate.sources).toEqual([{ sourceId: "src-test", url: "https://example.com/postular/1" }]);
    expect(result.candidate.status).toBe("publicada");
  });

  it("deduce el nivel de los programas si la fuente no lo dice (confianza media)", () => {
    const result = normalizeDraft(
      draft({ levelText: null, programsText: "Tecnología en Desarrollo de Software, Ingeniería de Sistemas" }),
      options,
    );
    expect(result.candidate.levels).toEqual(["tecnologo", "universitario"]);
    expect(result.fieldConfidence.levels).toBe("media");
  });

  it("sin modalidad en la fuente → desconocida, sin observación y publicable (no se asume presencial)", () => {
    const unknown = normalizeDraft(draft({ modalityText: null }), options);
    expect(unknown.candidate).toMatchObject({ modality: "no_especificada", municipalitySlug: "medellin", status: "publicada" });
    expect(unknown.issues).toEqual([]);
    expect(unknown.fieldConfidence.modality).toBe("alta");

    // Texto que no se entiende: también desconocida, pero con observación → a revisión.
    const odd = normalizeDraft(draft({ modalityText: "Turnos rotativos" }), options);
    expect(odd.candidate).toMatchObject({ modality: "no_especificada", status: "en_revision" });
    expect(odd.issues).toEqual(['Modalidad: No se reconoció la modalidad ("Turnos rotativos")']);

    // Desconocida no es remota: sin municipio sigue faltando el municipio.
    const noCity = normalizeDraft(draft({ municipalityText: null, modalityText: null }), options);
    expect(noCity.candidate).toMatchObject({ modality: "no_especificada", municipalitySlug: null });
    expect(noCity.issues.join(" ")).toContain("Municipio");
  });

  it("una oferta remota no necesita municipio", () => {
    const remote = normalizeDraft(draft({ municipalityText: "Remoto", modalityText: null }), options);
    expect(remote.candidate).toMatchObject({ modality: "remota", municipalitySlug: null, status: "publicada" });

    const noCity = normalizeDraft(draft({ municipalityText: null, modalityText: "Teletrabajo" }), options);
    expect(noCity.candidate).toMatchObject({ modality: "remota", municipalitySlug: null });
    expect(noCity.issues).toEqual([]);

    const withCity = normalizeDraft(draft({ municipalityText: "Envigado", modalityText: "Remoto" }), options);
    expect(withCity.candidate).toMatchObject({ modality: "remota", municipalitySlug: "envigado" });
  });

  it("interpreta instituciones, egresados y tipo por defecto", () => {
    const result = normalizeDraft(
      draft({
        title: "Analista junior",
        typeText: null,
        institutionsText: "Solo estudiantes de EAFIT y UPB",
        semesterText: "Recién egresados",
      }),
      options,
    );
    expect(result.candidate.institutionIds).toEqual(["inst-eafit", "inst-upb"]);
    expect(result.candidate.acceptsGraduates).toBe(true);
    expect(result.candidate.type).toBe("practica_profesional");
    expect(result.fieldConfidence.type).toBe("baja");
  });
});

describe("slugify", () => {
  it("quita tildes, símbolos y espacios", () => {
    expect(slugify("Práctica: Diseño & Comunicación (2026) — Ñuñez")).toBe("practica-diseno-comunicacion-2026-nunez");
  });

  it("recorta a 80 caracteres en límite de palabra", () => {
    const slug = slugify(`${"palabra ".repeat(20)}final`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slug.endsWith("palabra")).toBe(true);
  });
});

describe("summarize", () => {
  it("deja igual los textos cortos y limpia espacios", () => {
    expect(summarize("  Hola   mundo.\r\n\r\n\r\n\r\nSegundo  párrafo. ")).toBe("Hola mundo.\n\nSegundo párrafo.");
    expect(summarize(null)).toBe("");
  });

  it("recorta a 600 caracteres sin partir palabras", () => {
    const long = "palabra ".repeat(200);
    const summary = summarize(long);
    expect(summary.length).toBeLessThanOrEqual(600);
    expect(summary.endsWith("palabra…")).toBe(true);
  });
});

describe("splitRequirements", () => {
  it("separa por salto de línea o punto y coma, limpia viñetas y quita duplicados", () => {
    expect(splitRequirements("- Excel intermedio;  • Inglés B1.\n1. excel INTERMEDIO\n\n2) Buena redacción")).toEqual([
      "Excel intermedio",
      "Inglés B1",
      "Buena redacción",
    ]);
  });

  it("máximo 8 requisitos", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Requisito ${i + 1}`).join("\n");
    expect(splitRequirements(many)).toHaveLength(8);
    expect(splitRequirements(null)).toEqual([]);
  });
});

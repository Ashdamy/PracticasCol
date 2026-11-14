/** Normalizadores de un solo campo: municipio, niveles, tipo, modalidad, pago, duración y semestre. */
import { describe, expect, it } from "vitest";
import { normalizeCompensation } from "./compensation";
import { normalizeDuration } from "./duration";
import { normalizeMunicipality } from "./geo";
import { normalizeLevels } from "./levels";
import { normalizeModality } from "./modality";
import { normalizeSemester } from "./semester";
import { normalizeOpportunityType } from "./type";

describe("normalizeMunicipality", () => {
  it.each([
    ["Medellín, Antioquia", "medellin"],
    ["MEDELLIN", "medellin"],
    ["Itagui", "itagui"],
    ["Itagüí", "itagui"],
    ["Envigado (Ant.)", "envigado"],
    ["La Estrella - Antioquia", "la-estrella"],
    ["Caldas, Antioquia", "caldas"],
    ["Rionegro", "rionegro"],
    ["  sabaneta  ", "sabaneta"],
  ])("%j → %s", (text, slug) => {
    expect(normalizeMunicipality(text)).toEqual({ value: { slug, remote: false }, confidence: "alta" });
  });

  it.each(["Área Metropolitana", "Valle de Aburrá", "Antioquia"])("%j → sin municipio, confianza media", (text) => {
    const result = normalizeMunicipality(text);
    expect(result.value).toEqual({ slug: null, remote: false });
    expect(result.confidence).toBe("media");
  });

  it.each(["Remoto", "Teletrabajo", "100% virtual"])("%j → remoto", (text) => {
    expect(normalizeMunicipality(text)).toEqual({ value: { slug: null, remote: true }, confidence: "alta" });
  });

  it("combina municipio y remoto", () => {
    expect(normalizeMunicipality("Medellín / Remoto").value).toEqual({ slug: "medellin", remote: true });
  });

  it.each(["Bogotá", "Cali, Valle del Cauca", "Manizales, Caldas", "Barbosa, Santander"])(
    "%j → fuera de cobertura (confianza alta con nota)",
    (text) => {
      const result = normalizeMunicipality(text);
      expect(result.value.slug).toBeNull();
      expect(result.confidence).toBe("alta");
      expect(result.note).toContain("fuera de cobertura");
    },
  );

  it("varios municipios → toma el primero con confianza media", () => {
    const result = normalizeMunicipality("Bello y Copacabana");
    expect(result.value.slug).toBe("bello");
    expect(result.confidence).toBe("media");
  });

  it("municipio en segundo lugar → confianza media", () => {
    const result = normalizeMunicipality("Sede El Poblado, Medellín");
    expect(result.value.slug).toBe("medellin");
    expect(result.confidence).toBe("media");
  });

  it("vacío → confianza baja", () => {
    expect(normalizeMunicipality(null).confidence).toBe("baja");
    expect(normalizeMunicipality("  ").value).toEqual({ slug: null, remote: false });
  });
});

describe("normalizeLevels", () => {
  it.each([
    ["Técnico laboral", ["tecnico_laboral"]],
    ["Técnica profesional", ["tecnico_profesional"]],
    ["Tecnólogo", ["tecnologo"]],
    ["Tecnología", ["tecnologo"]],
    ["Estudiantes de nivel tecnológico", ["tecnologo"]],
    ["Profesional", ["universitario"]],
    ["Universitario", ["universitario"]],
    ["Pregrado", ["universitario"]],
    ["Carrera profesional", ["universitario"]],
    ["Especialización o maestría", ["posgrado"]],
    ["Posgrado", ["posgrado"]],
    ["Tecnólogo o profesional", ["tecnologo", "universitario"]],
    ["Técnico profesional, tecnólogo y universitario", ["tecnico_profesional", "tecnologo", "universitario"]],
  ])("%j → %j", (text, levels) => {
    expect(normalizeLevels(text)).toEqual({ value: levels, confidence: "alta" });
  });

  it("«técnico» a secas → laboral y profesional con confianza media", () => {
    const result = normalizeLevels("Técnico");
    expect(result.value).toEqual(["tecnico_laboral", "tecnico_profesional"]);
    expect(result.confidence).toBe("media");
    expect(normalizeLevels("Técnicos o tecnólogos").value).toEqual([
      "tecnico_laboral",
      "tecnico_profesional",
      "tecnologo",
    ]);
  });

  it("«técnico profesional» no cuenta como universitario", () => {
    expect(normalizeLevels("Técnico profesional").value).toEqual(["tecnico_profesional"]);
  });

  it("«práctica profesional» no dice el nivel", () => {
    const result = normalizeLevels("Práctica profesional");
    expect(result.value).toEqual([]);
    expect(result.confidence).toBe("baja");
  });

  it("solo SENA → técnico laboral y tecnólogo con confianza baja", () => {
    const result = normalizeLevels("Aprendices SENA");
    expect(result.value).toEqual(["tecnico_laboral", "tecnologo"]);
    expect(result.confidence).toBe("baja");
  });

  it("vacío o irreconocible → [] con confianza baja", () => {
    expect(normalizeLevels(null)).toMatchObject({ value: [], confidence: "baja" });
    expect(normalizeLevels("Bachiller")).toMatchObject({ value: [], confidence: "baja" });
  });
});

describe("normalizeOpportunityType", () => {
  it.each([
    ["Pasantía", "pasantia"],
    ["Práctica profesional", "practica_profesional"],
    ["Prácticas empresariales", "practica_empresarial"],
    ["Contrato de aprendizaje", "contrato_aprendizaje"],
    ["Aprendiz SENA", "contrato_aprendizaje"],
    ["Etapa productiva", "contrato_aprendizaje"],
    ["Judicatura ad honorem", "judicatura"],
    ["Práctica laboral", "practica_profesional"],
  ])("%j → %s", (text, type) => {
    expect(normalizeOpportunityType(text)).toEqual({ value: type, confidence: "alta" });
  });

  it("«práctica» a secas → práctica profesional con confianza media", () => {
    expect(normalizeOpportunityType("Práctica")).toMatchObject({ value: "practica_profesional", confidence: "media" });
  });

  it("usa el título cuando no hay tipo (confianza media)", () => {
    expect(normalizeOpportunityType(null, "Pasante de comunicaciones")).toMatchObject({
      value: "pasantia",
      confidence: "media",
    });
    expect(normalizeOpportunityType("Vacante", "Aprendiz de logística")).toMatchObject({
      value: "contrato_aprendizaje",
      confidence: "media",
    });
  });

  it("sin pistas → null con confianza baja", () => {
    expect(normalizeOpportunityType(null, "Analista de datos")).toMatchObject({ value: null, confidence: "baja" });
    expect(normalizeOpportunityType(null)).toMatchObject({ value: null, confidence: "baja" });
  });
});

describe("normalizeModality", () => {
  it.each([
    ["Presencial", "presencial"],
    ["Híbrido", "hibrida"],
    ["Modalidad mixta", "hibrida"],
    ["Semipresencial", "hibrida"],
    ["Remoto", "remota"],
    ["Teletrabajo", "remota"],
    ["Virtual", "remota"],
    ["Home office", "remota"],
  ])("%j → %s", (text, modality) => {
    expect(normalizeModality(text)).toEqual({ value: modality, confidence: "alta" });
  });

  it("presencial y remoto a la vez → híbrida con confianza media", () => {
    expect(normalizeModality("3 días presencial y 2 remoto")).toMatchObject({ value: "hibrida", confidence: "media" });
  });

  it("vacío o irreconocible → presencial con confianza baja", () => {
    expect(normalizeModality(null)).toMatchObject({ value: "presencial", confidence: "baja" });
    expect(normalizeModality("Por definir")).toMatchObject({ value: "presencial", confidence: "baja" });
  });
});

describe("normalizeCompensation", () => {
  it.each([
    ["Apoyo de sostenimiento $1.750.000", "apoyo_sostenimiento", 1_750_000],
    ["Apoyo de sostenimiento: 1'750.000", "apoyo_sostenimiento", 1_750_000],
    ["Auxilio de COP 1750000", "auxilio", 1_750_000],
    ["Bonificación de 1,75 millones", "auxilio", 1_750_000],
    ["Salario 1.5 millones", "salario", 1_500_000],
    ["Salario: $2,000,000.00 mensuales", "salario", 2_000_000],
    ["Auxilio de transporte de 800 mil pesos", "auxilio", 800_000],
    ["Sueldo 1.423.500,00", "salario", 1_423_500],
  ])("%j → %s %d", (text, type, amountCop) => {
    expect(normalizeCompensation(text)).toEqual({ value: { type, amountCop }, confidence: "alta" });
  });

  it("monto sin etiqueta → salario con confianza media", () => {
    const result = normalizeCompensation("$1.750.000");
    expect(result.value).toEqual({ type: "salario", amountCop: 1_750_000 });
    expect(result.confidence).toBe("media");
  });

  it("etiqueta sin monto", () => {
    expect(normalizeCompensation("Apoyo de sostenimiento")).toEqual({
      value: { type: "apoyo_sostenimiento", amountCop: null },
      confidence: "alta",
    });
    expect(normalizeCompensation("Auxilio económico").value.type).toBe("auxilio");
  });

  it.each(["No remunerada", "Ad honorem", "Práctica sin remuneración"])("%j → sin_remuneracion", (text) => {
    expect(normalizeCompensation(text)).toEqual({ value: { type: "sin_remuneracion", amountCop: null }, confidence: "alta" });
  });

  it.each([null, "", "A convenir", "No especificado"])("%j → no_especificado", (text) => {
    expect(normalizeCompensation(text)).toEqual({ value: { type: "no_especificado", amountCop: null }, confidence: "alta" });
  });

  it("montos fuera de [100.000, 20.000.000] → confianza baja", () => {
    expect(normalizeCompensation("Salario $50.000")).toMatchObject({ confidence: "baja" });
    expect(normalizeCompensation("Salario $1.300")).toMatchObject({ confidence: "baja" });
    expect(normalizeCompensation("Auxilio de 175.000.000")).toMatchObject({ confidence: "baja" });
    expect(normalizeCompensation("Salario $100.000")).toMatchObject({ confidence: "alta" });
    expect(normalizeCompensation("Salario $20.000.000")).toMatchObject({ confidence: "alta" });
  });

  it("salarios mínimos: no inventa el valor en pesos", () => {
    const result = normalizeCompensation("Apoyo de sostenimiento equivalente a 1 SMMLV");
    expect(result.value).toEqual({ type: "apoyo_sostenimiento", amountCop: null });
    expect(result.confidence).toBe("media");
  });

  it("texto ilegible → no_especificado con confianza baja", () => {
    expect(normalizeCompensation("Ver convocatoria")).toMatchObject({
      value: { type: "no_especificado", amountCop: null },
      confidence: "baja",
    });
  });
});

describe("normalizeDuration", () => {
  it.each([
    ["6 meses", 6, 6],
    ["12 meses", 12, 12],
    ["4 a 6 meses", 4, 6],
    ["Entre 4 y 6 meses", 4, 6],
    ["4-6 meses", 4, 6],
    ["Un semestre", 6, 6],
    ["Un año", 12, 12],
    ["12 semanas", 3, 3],
    ["Seis meses, prorrogables", 6, 6],
    ["2 semestres", 12, 12],
  ])("%j → %d–%d meses", (text, min, max) => {
    expect(normalizeDuration(text)).toEqual({ value: { min, max }, confidence: "alta" });
  });

  it("vacío → null sin observaciones; ilegible → null con confianza baja", () => {
    expect(normalizeDuration(null)).toEqual({ value: null, confidence: "alta" });
    expect(normalizeDuration("Según convenio")).toMatchObject({ value: null, confidence: "baja" });
  });

  it("«semestral» → 6 meses con confianza media; duraciones largas → baja", () => {
    expect(normalizeDuration("Semestral")).toMatchObject({ value: { min: 6, max: 6 }, confidence: "media" });
    expect(normalizeDuration("36 meses")).toMatchObject({ confidence: "baja" });
  });
});

describe("normalizeSemester", () => {
  it.each([
    ["A partir de 8° semestre", 8, null],
    ["8vo semestre en adelante", 8, null],
    ["Desde octavo semestre", 8, null],
    ["Haber aprobado 6 semestres", 6, null],
    ["Entre 7 y 9 semestre", 7, 9],
    ["7° a 9° semestre", 7, 9],
    ["Semestres 6 a 10", 6, 10],
    ["Hasta 10 semestre", null, 10],
  ])("%j → min %j, max %j", (text, min, max) => {
    expect(normalizeSemester(text)).toEqual({ value: { min, max, acceptsGraduates: null }, confidence: "alta" });
  });

  it("un semestre sin contexto se toma como mínimo (confianza media)", () => {
    expect(normalizeSemester("8° semestre")).toMatchObject({
      value: { min: 8, max: null, acceptsGraduates: null },
      confidence: "media",
    });
  });

  it("«últimos semestres» → sin mínimo, confianza baja y nota", () => {
    const result = normalizeSemester("Estar en los últimos semestres");
    expect(result.value).toEqual({ min: null, max: null, acceptsGraduates: null });
    expect(result.confidence).toBe("baja");
    expect(result.note).toBeTruthy();
  });

  it("egresados y estudiantes activos", () => {
    expect(normalizeSemester("Egresados")).toEqual({
      value: { min: null, max: null, acceptsGraduates: true },
      confidence: "alta",
    });
    expect(normalizeSemester("Recién graduados o de 9 semestre en adelante").value).toEqual({
      min: 9,
      max: null,
      acceptsGraduates: true,
    });
    expect(normalizeSemester("Estudiantes activos").value.acceptsGraduates).toBe(false);
    expect(normalizeSemester("No ser egresado").value.acceptsGraduates).toBe(false);
  });

  it("vacío → sin restricción; rangos imposibles → confianza baja", () => {
    expect(normalizeSemester(null)).toEqual({
      value: { min: null, max: null, acceptsGraduates: null },
      confidence: "alta",
    });
    expect(normalizeSemester("A partir de 15 semestre")).toMatchObject({ value: { min: null }, confidence: "baja" });
    expect(normalizeSemester("Entre 9 y 7 semestre")).toMatchObject({ confidence: "baja" });
  });
});

/** Normalizadores que emparejan contra el catálogo: programas e instituciones. */
import { describe, expect, it } from "vitest";
import { normalizeInstitutions } from "./institutions";
import { normalizePrograms } from "./programs";

describe("normalizePrograms", () => {
  it("empareja nombres exactos del catálogo, sin importar tildes ni mayúsculas", () => {
    expect(normalizePrograms("Ingeniería Industrial, INGENIERIA DE PRODUCCION; Contaduría Pública")).toEqual({
      value: {
        programIds: ["prog-contaduria", "prog-ing-industrial", "prog-ing-produccion"],
        knowledgeAreaIds: [],
        acceptsRelatedPrograms: false,
        openToAllPrograms: false,
      },
      confidence: "alta",
    });
  });

  it.each(["Ingeniería Industrial y afines", "Ingeniería Industrial o afines", "Ingeniería Industrial, carreras afines"])(
    "detecta afines en %j",
    (text) => {
      expect(normalizePrograms(text)).toEqual({
        value: {
          programIds: ["prog-ing-industrial"],
          knowledgeAreaIds: [],
          acceptsRelatedPrograms: true,
          openToAllPrograms: false,
        },
        confidence: "alta",
      });
    },
  );

  it.each(["Cualquier carrera", "Todas las carreras", "Cualquier programa académico"])("%j → abierta a todos", (text) => {
    expect(normalizePrograms(text)).toEqual({
      value: { programIds: [], knowledgeAreaIds: [], acceptsRelatedPrograms: false, openToAllPrograms: true },
      confidence: "alta",
    });
  });

  it("no parte nombres de programa que contienen «y»", () => {
    const result = normalizePrograms("Tecnólogo en Análisis y Desarrollo de Software y Tecnología en Gestión Contable y Financiera");
    expect(result.value.programIds).toEqual(["prog-tec-analisis-sw", "prog-tec-contable"]);
    expect(result.confidence).toBe("alta");
  });

  it("entiende cómo se nombra a las personas (ingenieros, abogados, contadores…)", () => {
    expect(normalizePrograms("Ingenieros de sistemas o ingenieros industriales").value.programIds).toEqual([
      "prog-ing-industrial",
      "prog-ing-sistemas",
    ]);
    expect(normalizePrograms("Abogados").value.programIds).toEqual(["prog-derecho"]);
    expect(normalizePrograms("Contadores públicos y psicólogos").value.programIds).toEqual([
      "prog-contaduria",
      "prog-psicologia",
    ]);
  });

  it("variantes sin «Ingeniería de» / «Tecnología en» → confianza media", () => {
    const software = normalizePrograms("Desarrollo de Software");
    expect(software.value.programIds).toEqual(["prog-tec-desarrollo-sw"]);
    expect(software.confidence).toBe("media");

    // "Sistemas" existe como ingeniería y como técnica profesional: se incluyen ambos y se avisa.
    const systems = normalizePrograms("Sistemas");
    expect(systems.value.programIds).toEqual(["prog-ing-sistemas", "prog-tp-sistemas"]);
    expect(systems.confidence).toBe("media");
    expect(systems.note).toContain("2 programas");
  });

  it("áreas genéricas", () => {
    const admin = normalizePrograms("Carreras administrativas");
    expect(admin.value).toMatchObject({ programIds: [], knowledgeAreaIds: ["nbc-administracion"] });
    expect(admin.confidence).toBe("media");

    const engineering = normalizePrograms("Ingenierías");
    expect(engineering.value.knowledgeAreaIds).toEqual([
      "nbc-ing-industrial",
      "nbc-ing-sistemas",
      "nbc-ing-civil",
      "nbc-ing-electronica",
      "nbc-ing-mecanica",
      "nbc-ing-ambiental",
    ]);
    expect(engineering.confidence).toBe("baja");
    expect(engineering.note).toContain("genérico");

    expect(normalizePrograms("Administración, Diseño o Comunicación").value.knowledgeAreaIds).toEqual([
      "nbc-administracion",
      "nbc-comunicacion",
      "nbc-diseno",
    ]);
  });

  it("deja nota con los nombres que no reconoce", () => {
    const partial = normalizePrograms("Estudiantes de Ingeniería de Sistemas, Biología o Ingeniería Química");
    expect(partial.value.programIds).toEqual(["prog-ing-sistemas"]);
    expect(partial.confidence).toBe("media");
    expect(partial.note).toContain("biologia");
    expect(partial.note).toContain("ingenieria quimica");

    const none = normalizePrograms("Gastronomía");
    expect(none.value.programIds).toEqual([]);
    expect(none.confidence).toBe("baja");
    expect(none.note).toContain("gastronomia");
  });

  it("vacío → sin programas y sin observaciones", () => {
    expect(normalizePrograms(null)).toEqual({
      value: { programIds: [], knowledgeAreaIds: [], acceptsRelatedPrograms: false, openToAllPrograms: false },
      confidence: "alta",
    });
  });

  it("solo «afines» sin programa → confianza baja", () => {
    expect(normalizePrograms("Carreras afines")).toMatchObject({
      value: { acceptsRelatedPrograms: true, programIds: [] },
      confidence: "baja",
    });
  });
});

describe("normalizeInstitutions", () => {
  it.each([
    ["Solo estudiantes de la UdeA", ["inst-udea"]],
    ["Universidad de Antioquia", ["inst-udea"]],
    ["Poli", ["inst-poli-jic"]],
    ["Politécnico JIC", ["inst-poli-jic"]],
    ["SENA", ["inst-sena-ant"]],
    ["Aprendices del SENA o del ITM", ["inst-itm", "inst-sena-ant"]],
    ["EAFIT, UPB y Universidad de Medellín", ["inst-eafit", "inst-upb", "inst-udem"]],
    ["Universidad Nacional de Colombia - Sede Medellín", ["inst-unal-med"]],
    ["Tecnológico de Antioquia", ["inst-tdea"]],
  ])("%j → %j", (text, ids) => {
    expect(normalizeInstitutions(text)).toEqual({ value: ids, confidence: "alta" });
  });

  it("vacío o «cualquier institución» → null (abierta)", () => {
    expect(normalizeInstitutions(null)).toEqual({ value: null, confidence: "alta" });
    expect(normalizeInstitutions("Cualquier universidad")).toEqual({ value: null, confidence: "alta" });
  });

  it("institución desconocida → null con confianza baja", () => {
    const result = normalizeInstitutions("Universidad de los Andes");
    expect(result.value).toBeNull();
    expect(result.confidence).toBe("baja");
    expect(result.note).toContain("Andes");
  });

  it("mezcla de conocidas y desconocidas → confianza media", () => {
    const result = normalizeInstitutions("EAFIT y Universidad del Rosario");
    expect(result.value).toEqual(["inst-eafit"]);
    expect(result.confidence).toBe("media");
  });
});

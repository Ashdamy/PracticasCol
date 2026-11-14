import { describe, expect, it } from "vitest";
import { normalizeDate, normalizeDeadline } from "./dates";

const TODAY = "2026-11-13";

describe("normalizeDeadline", () => {
  it.each([
    ["15 de diciembre de 2026", "2026-12-15"],
    ["15 de dic. 2026", "2026-12-15"],
    ["15/12/2026", "2026-12-15"],
    ["15-12-2026", "2026-12-15"],
    ["2026-12-15", "2026-12-15"],
    ["diciembre 15 de 2026", "2026-12-15"],
    ["Diciembre 15, 2026", "2026-12-15"],
    ["Hasta el 5 de ENERO del 2027 a las 5:00 p.m.", "2027-01-05"],
    ["1 de marzo de 2027", "2027-03-01"],
    ["Cierre: 30 de sept. de 2027", "2027-09-30"],
  ])("interpreta %j", (text, date) => {
    expect(normalizeDeadline(text, TODAY)).toEqual({ value: { type: "fecha", date }, confidence: "alta" });
  });

  it("sin año asume el próximo que no esté en el pasado (confianza media)", () => {
    const thisYear = normalizeDeadline("15 de diciembre", TODAY);
    expect(thisYear.value).toEqual({ type: "fecha", date: "2026-12-15" });
    expect(thisYear.confidence).toBe("media");
    expect(thisYear.note).toContain("2026");

    const nextYear = normalizeDeadline("20 de enero", TODAY);
    expect(nextYear.value.date).toBe("2027-01-20");
    expect(nextYear.confidence).toBe("media");

    expect(normalizeDeadline("13/11", TODAY).value.date).toBe("2026-11-13");
    expect(normalizeDeadline("12/11", TODAY).value.date).toBe("2027-11-12");
  });

  it("una fecha pasada con año explícito se conserva (el estado lo decide normalizeDraft)", () => {
    expect(normalizeDeadline("01/11/2026", TODAY)).toEqual({
      value: { type: "fecha", date: "2026-11-01" },
      confidence: "alta",
    });
  });

  it.each(["Hasta agotar cupos", "hasta llenar vacantes", "Convocatoria permanente", "Hasta completar los cupos"])(
    "%j → hasta_agotar_cupos",
    (text) => {
      expect(normalizeDeadline(text, TODAY)).toEqual({
        value: { type: "hasta_agotar_cupos", date: null },
        confidence: "alta",
      });
    },
  );

  it.each([null, undefined, "", "   ", "No especificada", "Por definir", "N/A"])("%j → no_publicada", (text) => {
    expect(normalizeDeadline(text, TODAY)).toEqual({ value: { type: "no_publicada", date: null }, confidence: "alta" });
  });

  it.each(["31/02/2027", "31 de abril de 2027", "2027-13-01", "29 de febrero de 2027"])(
    "fecha inválida %j → no_publicada con confianza baja y nota",
    (text) => {
      const result = normalizeDeadline(text, TODAY);
      expect(result.value).toEqual({ type: "no_publicada", date: null });
      expect(result.confidence).toBe("baja");
      expect(result.note).toContain(text);
    },
  );

  it("acepta el 29 de febrero en año bisiesto", () => {
    expect(normalizeDeadline("29/02/2028", TODAY).value.date).toBe("2028-02-29");
  });

  it("marca los casos ambiguos o improbables", () => {
    const swapped = normalizeDeadline("12/25/2026", TODAY);
    expect(swapped.value.date).toBe("2026-12-25");
    expect(swapped.confidence).toBe("media");

    const shortYear = normalizeDeadline("15/12/26", TODAY);
    expect(shortYear.value.date).toBe("2026-12-15");
    expect(shortYear.confidence).toBe("media");

    expect(normalizeDeadline("15/12/2031", TODAY).confidence).toBe("baja");
    expect(normalizeDeadline("15/12/2019", TODAY).confidence).toBe("baja");
  });

  it("texto que no es fecha → confianza baja con nota", () => {
    const result = normalizeDeadline("Consultar con talento humano", TODAY);
    expect(result.value.type).toBe("no_publicada");
    expect(result.confidence).toBe("baja");
    expect(result.note).toBeTruthy();
    // "mayo 2027" no trae día: no se inventa.
    expect(normalizeDeadline("mayo 2027", TODAY).confidence).toBe("baja");
  });
});

describe("normalizeDate", () => {
  it("interpreta fechas con y sin año", () => {
    expect(normalizeDate("1 de febrero de 2027")).toEqual({ value: "2027-02-01", confidence: "alta" });
    expect(normalizeDate("01/02/2027", TODAY)).toEqual({ value: "2027-02-01", confidence: "alta" });
    expect(normalizeDate("1 de febrero", TODAY).value).toBe("2027-02-01");
    expect(normalizeDate("1 de febrero").confidence).toBe("baja");
  });

  it("vacío o inmediato → null sin observaciones", () => {
    expect(normalizeDate(null)).toEqual({ value: null, confidence: "alta" });
    expect(normalizeDate("Inmediata")).toEqual({ value: null, confidence: "alta" });
  });

  it("texto ilegible → null con nota", () => {
    const result = normalizeDate("cuando haya cupo", TODAY);
    expect(result.value).toBeNull();
    expect(result.confidence).toBe("baja");
  });
});

describe("normalizeDeadline con varias fechas", () => {
  it.each([
    ["Del 1 de noviembre al 15 de diciembre de 2026", "2026-12-15"],
    ["Del 01/11/2026 al 30/11/2026", "2026-11-30"],
    ["Inscripciones: 20 de noviembre de 2026 - 5 de diciembre de 2026", "2026-12-05"],
  ])("%j → toma la última (%s) con confianza media", (text, date) => {
    const r = normalizeDeadline(text, "2026-11-13");
    expect(r.value).toEqual({ type: "fecha", date });
    expect(r.confidence).toBe("media");
    expect(r.note).toContain("varias fechas");
  });

  it("una sola fecha con hora o con rango de días no cuenta como varias", () => {
    expect(normalizeDeadline("15/12/2026 a las 5:00 p. m.", "2026-11-13")).toEqual({
      value: { type: "fecha", date: "2026-12-15" },
      confidence: "alta",
    });
    expect(normalizeDeadline("Del 1 al 15 de diciembre de 2026", "2026-11-13")).toEqual({
      value: { type: "fecha", date: "2026-12-15" },
      confidence: "alta",
    });
  });
});

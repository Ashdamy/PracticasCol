import { describe, expect, it } from "vitest";
import { expireOpportunities, type Expirable } from "./expire";

const TODAY = "2026-11-13";

function record(id: string, overrides: Partial<Expirable> = {}): Expirable {
  return { id, status: "publicada", deadlineType: "fecha", deadlineDate: "2026-12-01", ...overrides };
}

describe("expireOpportunities", () => {
  it("vence las publicadas cuya fecha límite ya pasó", () => {
    const records = [
      record("ayer", { deadlineDate: "2026-11-12" }),
      record("hace-un-mes", { deadlineDate: "2026-10-13" }),
      record("futura", { deadlineDate: "2026-11-14" }),
    ];
    expect(expireOpportunities(records, TODAY)).toEqual(["ayer", "hace-un-mes"]);
  });

  it("el día de cierre todavía cuenta como abierta", () => {
    expect(expireOpportunities([record("hoy", { deadlineDate: TODAY })], TODAY)).toEqual([]);
    expect(expireOpportunities([record("hoy", { deadlineDate: TODAY })], "2026-11-14")).toEqual(["hoy"]);
  });

  it("no toca las que no tienen fecha concreta", () => {
    const records = [
      record("cupos", { deadlineType: "hasta_agotar_cupos", deadlineDate: null }),
      record("sin-publicar", { deadlineType: "no_publicada", deadlineDate: null }),
      // Dato inconsistente: tipo «fecha» sin fecha. No se vence a ciegas.
      record("inconsistente", { deadlineType: "fecha", deadlineDate: null }),
    ];
    expect(expireOpportunities(records, TODAY)).toEqual([]);
  });

  it.each(["borrador", "en_revision", "vencida", "retirada"] as const)("ignora las que están en estado %s", (status) => {
    expect(expireOpportunities([record("x", { status, deadlineDate: "2026-01-01" })], TODAY)).toEqual([]);
  });

  it("es pura: no modifica la entrada y acepta listas vacías", () => {
    const records = Object.freeze([Object.freeze(record("a", { deadlineDate: "2026-11-01" }))]);
    expect(expireOpportunities(records, TODAY)).toEqual(["a"]);
    expect(records[0].status).toBe("publicada");
    expect(expireOpportunities([], TODAY)).toEqual([]);
  });

  it("compara fechas de calendario entre años", () => {
    const records = [record("dic", { deadlineDate: "2026-12-31" }), record("ene", { deadlineDate: "2027-01-01" })];
    expect(expireOpportunities(records, "2027-01-01")).toEqual(["dic"]);
  });
});

import { describe, expect, it } from "vitest";
import { countActiveFilters, parseSearchParams, toSearchParams } from "./search";

describe("parseSearchParams / toSearchParams", () => {
  it("parsea claves en español e ignora valores inválidos", () => {
    const p = parseSearchParams(
      new URLSearchParams("q=analista&tipo=pasantia,xxx&nivel=tecnologo&municipio=medellin,ENVIGADO&remunerada=1&cierra_en=15&orden=cierre&pagina=2"),
    );
    expect(p).toMatchObject({
      q: "analista",
      types: ["pasantia"],
      levels: ["tecnologo"],
      municipalities: ["medellin", "envigado"],
      paidOnly: true,
      closesWithinDays: 15,
      sort: "cierre",
      page: 2,
      pageSize: 20,
    });
  });

  it("acepta el objeto searchParams de Next (string | string[])", () => {
    const p = parseSearchParams({ tipo: ["pasantia", "judicatura"], pagina: "abc" });
    expect(p.types).toEqual(["pasantia", "judicatura"]);
    expect(p.page).toBe(1);
  });

  it("ida y vuelta conserva los filtros y omite defaults", () => {
    const params = parseSearchParams(new URLSearchParams("tipo=pasantia&aplico=1&orden=recientes"));
    const sp = toSearchParams(params);
    expect(sp.toString()).toBe("tipo=pasantia&aplico=1&orden=recientes");
    expect(parseSearchParams(sp)).toEqual(params);
  });

  it("acepta la modalidad desconocida (modalidad=no_especificada)", () => {
    const params = parseSearchParams(new URLSearchParams("modalidad=no_especificada,remota,xxx"));
    expect(params.modalities).toEqual(["no_especificada", "remota"]);
    expect(toSearchParams(params).get("modalidad")).toBe("no_especificada,remota");
    expect(parseSearchParams(toSearchParams(params))).toEqual(params);
  });

  it("URL vacía → defaults", () => {
    expect(toSearchParams(parseSearchParams(null)).toString()).toBe("");
  });

  it("cuenta filtros activos", () => {
    expect(countActiveFilters(parseSearchParams(new URLSearchParams("q=x&tipo=pasantia,judicatura&remunerada=1")))).toBe(3);
  });
});

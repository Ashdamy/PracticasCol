import { describe, expect, it } from "vitest";
import { INSTITUTIONS, KNOWLEDGE_AREAS, PROGRAMS } from "@/lib/catalog/academic";
import { MUNICIPALITIES } from "@/lib/catalog/geo";
import { ATS_SOURCES } from "../../ingestion/sources/ats";
import { atsBoardUrl, buildCatalogSql, catalogSources, sqlString, upsertSql } from "./catalog-sql";

const sql = buildCatalogSql();

describe("sqlString", () => {
  it("duplica las comillas simples", () => {
    expect(sqlString("Universidad EAFIT")).toBe("'Universidad EAFIT'");
    expect(sqlString("L'Oréal d'Or")).toBe("'L''Oréal d''Or'");
    expect(sqlString("'; drop table sources; --")).toBe("'''; drop table sources; --'");
  });

  it("rechaza el carácter nulo", () => {
    expect(() => sqlString("a\0b")).toThrow("carácter nulo");
  });
});

describe("upsertSql", () => {
  it("genera insert … on conflict … do update", () => {
    expect(upsertSql({ table: "t", columns: ["id", "name", "ok"], key: ["id"], rows: [["a", "O'Hara", true], ["b", null, false]] })).toBe(
      "insert into t (id, name, ok) values\n  ('a', 'O''Hara', true),\n  ('b', null, false)\n" +
        "on conflict (id) do update set\n  name = excluded.name,\n  ok = excluded.ok;",
    );
  });

  it("usa do nothing cuando todas las columnas son la llave", () => {
    expect(upsertSql({ table: "t", columns: ["a", "b"], key: ["a", "b"], rows: [["1", "2"]] })).toContain("on conflict (a, b) do nothing;");
  });
});

describe("buildCatalogSql", () => {
  it("incluye todos los municipios con su código DANE", () => {
    for (const m of MUNICIPALITIES) {
      expect(sql).toContain(`(${sqlString(m.slug)}, ${sqlString(m.name)}, '${m.daneCode}', ${m.metro})`);
    }
  });

  it("incluye todas las áreas, programas e instituciones con los ids del código", () => {
    for (const a of KNOWLEDGE_AREAS) expect(sql).toContain(`(${sqlString(a.id)}, ${sqlString(a.name)})`);
    for (const p of PROGRAMS) {
      expect(sql).toContain(`(${sqlString(p.id)}, ${sqlString(p.name)}, '${p.level}', '${p.knowledgeAreaId}')`);
    }
    for (const i of INSTITUTIONS) {
      expect(sql).toContain(`(${sqlString(i.id)}, ${sqlString(i.name)}, ${sqlString(i.shortName)}, '${i.sector}')`);
    }
    expect(sql).toContain("'inst-udea'");
    expect(sql).toContain("'prog-ing-sistemas'");
  });

  it("incluye cada pareja institución-programa una sola vez", () => {
    const pairs = INSTITUTIONS.flatMap((i) => [...new Set(i.programIds)].map((p) => `  ('${i.id}', '${p}')`));
    for (const pair of pairs) expect(sql.split(pair).length - 1, pair).toBe(1);
  });

  it("incluye las cargas manuales y cada fuente ATS con método api", () => {
    expect(sql).toContain("('src-manual-xlsx', 'Carga manual (Excel)', '/fuentes', 'manual')");
    expect(sql).toContain("('src-manual-csv', 'Carga manual (CSV)', '/fuentes', 'manual')");
    expect(ATS_SOURCES.length).toBeGreaterThan(0);
    for (const s of ATS_SOURCES) {
      expect(sql).toContain(`(${sqlString(s.id)}, ${sqlString(s.name)}, ${sqlString(atsBoardUrl(s))}, 'api')`);
    }
    expect(catalogSources()).toHaveLength(ATS_SOURCES.length + 2);
  });

  it("se puede re-ejecutar: todo va con on conflict, y las fuentes no pisan su estado", () => {
    const inserts = sql.match(/^insert into /gm) ?? [];
    const conflicts = sql.match(/^on conflict \(/gm) ?? [];
    expect(inserts).toHaveLength(6);
    expect(conflicts).toHaveLength(6);
    const sourcesSql = sql.slice(sql.indexOf("insert into sources"));
    expect(sourcesSql).not.toContain("enabled");
    expect(sourcesSql).not.toContain("last_run_at");
  });

  it("escapa las comillas de los nombres", () => {
    const custom = buildCatalogSql({ sources: [{ id: "src-x", name: "Bolsa d'Empleo", url: "https://example.com", method: "scraping" }] });
    expect(custom).toContain("('src-x', 'Bolsa d''Empleo', 'https://example.com', 'scraping')");
  });

  it("respeta el orden de las llaves foráneas", () => {
    const order = ["municipalities", "knowledge_areas", "programs", "institutions", "institution_programs", "sources"].map((t) =>
      sql.indexOf(`insert into ${t} `),
    );
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

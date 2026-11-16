/**
 * Genera el SQL del catálogo (municipios, áreas NBC, programas, instituciones y fuentes) a partir del
 * catálogo en TypeScript, que sigue siendo la fuente de verdad. Función pura: no escribe archivos.
 * La escribe `build-catalog-sql.ts` (`npm run db:catalog`).
 */
import type { SourceMethod } from "@/lib/contracts";
import { INSTITUTIONS, KNOWLEDGE_AREAS, PROGRAMS } from "@/lib/catalog/academic";
import { MUNICIPALITIES } from "@/lib/catalog/geo";
import { ATS_SOURCES, type AtsSource } from "../../ingestion/sources/ats";

export interface CatalogSource {
  id: string;
  name: string;
  /** Página pública de la fuente. Las cargas manuales no tienen una: apuntan a la página /fuentes del sitio. */
  url: string;
  method: SourceMethod;
}

/** Fuentes de carga manual. Los ids coinciden con los de `ingestion/adapters/{xlsx,csv}.ts`. */
export const MANUAL_SOURCES: readonly CatalogSource[] = [
  { id: "src-manual-xlsx", name: "Carga manual (Excel)", url: "/fuentes", method: "manual" },
  { id: "src-manual-csv", name: "Carga manual (CSV)", url: "/fuentes", method: "manual" },
];

/** Tablero público de empleo de la empresa en su ATS (no la API). */
export function atsBoardUrl(source: Pick<AtsSource, "provider" | "token">): string {
  return source.provider === "greenhouse"
    ? `https://job-boards.greenhouse.io/${source.token}`
    : `https://jobs.lever.co/${source.token}`;
}

export function catalogSources(ats: readonly AtsSource[] = ATS_SOURCES): CatalogSource[] {
  return [
    ...MANUAL_SOURCES,
    ...ats.map((s): CatalogSource => ({ id: s.id, name: s.name, url: atsBoardUrl(s), method: "api" })),
  ];
}

/** Literal de texto SQL: comillas simples duplicadas. Rechaza el carácter nulo, que Postgres no admite. */
export function sqlString(value: string): string {
  if (value.includes("\0")) throw new Error("El texto contiene un carácter nulo");
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlValue(value: string | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return sqlString(value);
}

interface UpsertSpec {
  table: string;
  columns: readonly string[];
  /** Columnas de la llave (para `on conflict`). */
  key: readonly string[];
  rows: readonly (readonly (string | boolean | null)[])[];
}

/** `insert … on conflict (llave) do update`: se puede ejecutar varias veces sin duplicar. */
export function upsertSql({ table, columns, key, rows }: UpsertSpec): string {
  if (rows.length === 0) return `-- ${table}: sin filas`;
  const values = rows.map((row) => `  (${row.map(sqlValue).join(", ")})`).join(",\n");
  const updatable = columns.filter((c) => !key.includes(c));
  const conflict =
    updatable.length === 0
      ? "do nothing"
      : `do update set\n${updatable.map((c) => `  ${c} = excluded.${c}`).join(",\n")}`;
  return `insert into ${table} (${columns.join(", ")}) values\n${values}\non conflict (${key.join(", ")}) ${conflict};`;
}

export interface CatalogSqlInput {
  sources?: readonly CatalogSource[];
}

export function buildCatalogSql(input: CatalogSqlInput = {}): string {
  const sources = input.sources ?? catalogSources();
  const sections: [title: string, sql: string][] = [
    [
      "Municipios (código DANE)",
      upsertSql({
        table: "municipalities",
        columns: ["slug", "name", "dane_code", "metro"],
        key: ["slug"],
        rows: MUNICIPALITIES.map((m) => [m.slug, m.name, m.daneCode, m.metro]),
      }),
    ],
    [
      "Áreas de conocimiento (NBC)",
      upsertSql({
        table: "knowledge_areas",
        columns: ["id", "name"],
        key: ["id"],
        rows: KNOWLEDGE_AREAS.map((a) => [a.id, a.name]),
      }),
    ],
    [
      "Programas",
      upsertSql({
        table: "programs",
        columns: ["id", "name", "level", "knowledge_area_id"],
        key: ["id"],
        rows: PROGRAMS.map((p) => [p.id, p.name, p.level, p.knowledgeAreaId]),
      }),
    ],
    [
      "Instituciones",
      upsertSql({
        table: "institutions",
        columns: ["id", "name", "short_name", "sector"],
        key: ["id"],
        rows: INSTITUTIONS.map((i) => [i.id, i.name, i.shortName, i.sector]),
      }),
    ],
    [
      "Programas por institución",
      upsertSql({
        table: "institution_programs",
        columns: ["institution_id", "program_id"],
        key: ["institution_id", "program_id"],
        rows: INSTITUTIONS.flatMap((i) => [...new Set(i.programIds)].map((programId) => [i.id, programId])),
      }),
    ],
    [
      "Fuentes (cargas manuales y tableros ATS)",
      // Solo se actualizan nombre, url y método: no se pisan `enabled`, `terms_reviewed` ni la última corrida.
      upsertSql({
        table: "sources",
        columns: ["id", "name", "url", "method"],
        key: ["id"],
        rows: sources.map((s) => [s.id, s.name, s.url, s.method]),
      }),
    ],
  ];

  const header = [
    "-- PrácticasCol · catálogo (AGENTS.md §5 y §13).",
    "-- ARCHIVO GENERADO: no lo edites a mano. Se genera con `npm run db:catalog` a partir de",
    "-- src/lib/catalog (municipios, NBC, programas, instituciones) e ingestion/sources/ats.ts (fuentes).",
    "-- Usa `insert … on conflict … do update`, así que se puede re-ejecutar sin duplicar filas.",
  ].join("\n");
  return `${header}\n\n${sections.map(([title, sql]) => `-- ${title}\n${sql}`).join("\n\n")}\n`;
}

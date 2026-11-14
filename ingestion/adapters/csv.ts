/**
 * Adaptador CSV para la carga manual del Product Owner (AGENTS.md §2 D2 y §12).
 * Plantilla: ingestion/templates/convocatorias.csv
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { clean } from "../normalize/text";
import type { OpportunityDraft, RawItem, SourceAdapter } from "../types";

export const CSV_COLUMNS = [
  "titulo",
  "organizacion",
  "tipo",
  "nivel",
  "municipio",
  "modalidad",
  "pago",
  "duracion",
  "fecha_limite",
  "fecha_inicio",
  "descripcion",
  "programas",
  "semestre",
  "requisitos",
  "instituciones",
  "enlace_postulacion",
  "enlace_fuente",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];
export type CsvRow = Partial<Record<CsvColumn, string>>;

const REQUIRED_COLUMNS: readonly CsvColumn[] = ["titulo", "organizacion"];

/** Cuenta separadores fuera de comillas en la primera línea. */
export function detectDelimiter(text: string): "," | ";" {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") commas += 1;
    else if (!quoted && char === ";") semicolons += 1;
    else if (!quoted && (char === "\n" || char === "\r")) break;
  }
  return semicolons > commas ? ";" : ",";
}

/**
 * Parser CSV mínimo (RFC 4180): comillas dobles, `""` como escape y saltos de línea dentro de comillas.
 * Acepta BOM y finales de línea \n o \r\n. El separador se detecta solo si no se indica.
 */
export function parseCsv(input: string, delimiter?: "," | ";"): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const separator = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field.trim() === "") {
      field = "";
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV inválido: hay una comilla doble sin cerrar");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** "Fecha límite" → "fecha_limite". */
function headerKey(header: string): string {
  return clean(header).replace(/ /g, "_");
}

export interface CsvRecord {
  /** Número de fila como se ve en la hoja de cálculo (el encabezado es la 1). */
  rowNumber: number;
  values: CsvRow;
}

/** Convierte el texto del CSV en registros por columna conocida. Las filas vacías se ignoran. */
export function readCsvRecords(text: string): CsvRecord[] {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((r) => r.some((cell) => cell.trim() !== ""));
  if (headerIndex === -1) return [];

  const known = new Set<string>(CSV_COLUMNS);
  const columns = rows[headerIndex].map((h) => {
    const key = headerKey(h);
    return known.has(key) ? (key as CsvColumn) : null;
  });
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `Al CSV le faltan las columnas obligatorias: ${missing.join(", ")}. Usa ingestion/templates/convocatorias.csv como base.`,
    );
  }

  const records: CsvRecord[] = [];
  rows.slice(headerIndex + 1).forEach((cells, index) => {
    if (cells.every((cell) => cell.trim() === "")) return;
    const values: CsvRow = {};
    columns.forEach((column, i) => {
      const value = (cells[i] ?? "").trim();
      if (column && value) values[column] = value;
    });
    records.push({ rowNumber: headerIndex + index + 2, values });
  });
  return records;
}

export interface CsvAdapterOptions {
  id?: string;
  name?: string;
  filePath: string;
  /** Solo para cargas ya revisadas por una persona. Por defecto todo queda en revisión. */
  autoPublish?: boolean;
  /** Inyectable para tests. */
  readText?: (filePath: string) => Promise<string>;
}

const text = (value: string | undefined): string | null => (value && value.trim() !== "" ? value : null);

export function createCsvAdapter(options: CsvAdapterOptions): SourceAdapter {
  const id = options.id ?? "src-manual-csv";
  const read = options.readText ?? ((filePath: string) => readFile(filePath, "utf8"));
  const fileName = basename(options.filePath);

  return {
    id,
    name: options.name ?? "Carga manual (CSV)",
    method: "manual",
    autoPublish: options.autoPublish ?? false,

    async fetch(ctx): Promise<RawItem[]> {
      const records = readCsvRecords(await read(options.filePath));
      const fetchedAt = ctx.now.toISOString();
      return records.map((record) => ({
        sourceId: id,
        externalId: String(record.rowNumber),
        url: record.values.enlace_fuente ?? record.values.enlace_postulacion ?? `csv:${fileName}#fila-${record.rowNumber}`,
        payload: record.values,
        fetchedAt,
      }));
    },

    parse(raw): OpportunityDraft {
      const row = (raw.payload ?? {}) as CsvRow;
      return {
        title: text(row.titulo),
        organizationName: text(row.organizacion),
        typeText: text(row.tipo),
        levelText: text(row.nivel),
        municipalityText: text(row.municipio),
        modalityText: text(row.modalidad),
        compensationText: text(row.pago),
        durationText: text(row.duracion),
        deadlineText: text(row.fecha_limite),
        startDateText: text(row.fecha_inicio),
        description: text(row.descripcion),
        programsText: text(row.programas),
        semesterText: text(row.semestre),
        requirementsText: text(row.requisitos),
        institutionsText: text(row.instituciones),
        applyUrl: text(row.enlace_postulacion),
        sourceUrl: text(row.enlace_fuente),
      };
    },
  };
}

/**
 * Adaptador CSV para la carga manual del Product Owner (AGENTS.md §2 D2 y §12).
 * Plantilla: ingestion/templates/convocatorias.csv
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { OpportunityDraft, RawItem, SourceAdapter } from "../types";
import {
  rowToDraft,
  TABULAR_COLUMNS,
  toRecords,
  type TabularColumn,
  type TabularRecord,
  type TabularRow,
} from "./tabular";

/** Las columnas son las mismas para CSV y Excel (ver `tabular.ts`). */
export const CSV_COLUMNS = TABULAR_COLUMNS;
export type CsvColumn = TabularColumn;
export type CsvRow = TabularRow;
export type CsvRecord = TabularRecord;

/** Cuenta separadores fuera de comillas en la primera línea con contenido. */
export function detectDelimiter(input: string): "," | ";" {
  const text = input.replace(/^[\ufeff\s]+/, "");
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

/** Convierte el texto del CSV en registros por columna conocida. Las filas vacías se ignoran. */
export function readCsvRecords(text: string): CsvRecord[] {
  const rows = parseCsv(text).map((cells, index) => ({ rowNumber: index + 1, cells }));
  return toRecords(
    rows,
    (missing) =>
      `Al CSV le faltan las columnas obligatorias: ${missing.join(", ")}. Usa ingestion/templates/convocatorias.csv como base.`,
  );
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
      return rowToDraft((raw.payload ?? {}) as CsvRow);
    },
  };
}

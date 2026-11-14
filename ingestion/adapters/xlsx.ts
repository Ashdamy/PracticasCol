/**
 * Adaptador Excel (.xlsx) para la carga manual del Product Owner (AGENTS.md §2 D2 y §12).
 * Plantilla: ingestion/templates/convocatorias.xlsx (se genera con `npm run template:xlsx`).
 * Produce los mismos ítems y borradores que el adaptador CSV para filas equivalentes.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import type { OpportunityDraft, RawItem, SourceAdapter } from "../types";
import { LINK_COLUMNS, mapHeaders, rowToDraft, toRecords, type SheetRow, type TabularRecord, type TabularRow } from "./tabular";

export const XLSX_DEFAULT_SHEET = "Convocatorias";

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel guarda las fechas sin zona horaria y exceljs las entrega en UTC: se leen en UTC para no correr el día. */
function dateToText(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Sin notación científica (1750000, no 1.75e6) y sin ruido de coma flotante. */
function numberToText(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return BigInt(value).toString();
  return value.toFixed(10).replace(/\.?0+$/, "");
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * Valor de una celda de Excel → texto. `preferLink` (columnas de enlace) devuelve la URL de un hipervínculo
 * en lugar del texto que se ve en la celda. Vacío, `null` o error de fórmula → `null`.
 */
export function cellToText(value: unknown, preferLink = false): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return numberToText(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (value instanceof Date) return dateToText(value);
  if (!isObject(value)) return null;

  if ("hyperlink" in value) {
    const shown = cellToText(value.text);
    const link = typeof value.hyperlink === "string" ? value.hyperlink.trim() : "";
    if (preferLink && link !== "") return link;
    return shown ?? (link !== "" ? link : null);
  }
  if (Array.isArray(value.richText)) {
    return value.richText.map((part) => (isObject(part) && typeof part.text === "string" ? part.text : "")).join("");
  }
  if ("formula" in value || "sharedFormula" in value) return cellToText(value.result, preferLink);
  return null; // { error: "#N/A" } y similares
}

type CellInput = ArrayBuffer | Uint8Array;

/** Lee el libro y devuelve los registros de la hoja `sheetName` (o de la primera, si no existe). */
export async function readXlsxRecords(data: CellInput, sheetName: string = XLSX_DEFAULT_SHEET): Promise<TabularRecord[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs declara `Buffer`, pero acepta cualquier binario que entienda JSZip.
    await workbook.xlsx.load(data as never);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo leer el archivo de Excel: debe ser un .xlsx válido (${reason})`);
  }
  const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
  if (!sheet) return [];

  // Primera pasada: celdas tal como se ven, para ubicar el encabezado.
  const rawRows: { rowNumber: number; values: unknown[] }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      values[colNumber - 1] = cell.value;
    });
    rawRows.push({ rowNumber, values });
  });

  const asText = (values: unknown[], linkColumns: readonly boolean[] = []): string[] =>
    Array.from(values, (value, i) => cellToText(value, linkColumns[i] ?? false) ?? "");

  const headerIndex = rawRows.findIndex((row) => asText(row.values).some((cell) => cell.trim() !== ""));
  if (headerIndex === -1) return [];
  const headerCells = asText(rawRows[headerIndex].values);
  const linkColumns = mapHeaders(headerCells).map((column) => column !== null && LINK_COLUMNS.includes(column));

  const rows: SheetRow[] = [
    { rowNumber: rawRows[headerIndex].rowNumber, cells: headerCells },
    ...rawRows.slice(headerIndex + 1).map((row) => ({ rowNumber: row.rowNumber, cells: asText(row.values, linkColumns) })),
  ];
  return toRecords(
    rows,
    (missing) =>
      `A la hoja «${sheet.name}» le faltan las columnas obligatorias: ${missing.join(", ")}. Usa ingestion/templates/convocatorias.xlsx como base.`,
  );
}

export interface XlsxAdapterOptions {
  id?: string;
  name?: string;
  filePath: string;
  /** Hoja con las convocatorias. Si no existe, se usa la primera del libro. */
  sheetName?: string;
  /** Solo para cargas ya revisadas por una persona. Por defecto todo queda en revisión. */
  autoPublish?: boolean;
  /** Inyectable para tests. */
  readBinary?: (filePath: string) => Promise<CellInput>;
}

export function createXlsxAdapter(options: XlsxAdapterOptions): SourceAdapter {
  const id = options.id ?? "src-manual-xlsx";
  const read = options.readBinary ?? ((filePath: string) => readFile(filePath));
  const fileName = basename(options.filePath);

  return {
    id,
    name: options.name ?? "Carga manual (Excel)",
    method: "manual",
    autoPublish: options.autoPublish ?? false,

    async fetch(ctx): Promise<RawItem[]> {
      const records = await readXlsxRecords(await read(options.filePath), options.sheetName);
      const fetchedAt = ctx.now.toISOString();
      return records.map((record) => ({
        sourceId: id,
        externalId: String(record.rowNumber),
        url: record.values.enlace_fuente ?? record.values.enlace_postulacion ?? `xlsx:${fileName}#fila-${record.rowNumber}`,
        payload: record.values,
        fetchedAt,
      }));
    },

    parse(raw): OpportunityDraft {
      return rowToDraft((raw.payload ?? {}) as TabularRow);
    },
  };
}

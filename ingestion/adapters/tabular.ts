/**
 * Base común de las cargas manuales en tabla (CSV y Excel): columnas de la plantilla,
 * reconocimiento de encabezados y mapeo fila → borrador. Sin acceso a disco.
 */
import { clean } from "../normalize/text";
import type { OpportunityDraft } from "../types";

export const TABULAR_COLUMNS = [
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
export type TabularColumn = (typeof TABULAR_COLUMNS)[number];
export type TabularRow = Partial<Record<TabularColumn, string>>;

export const REQUIRED_COLUMNS: readonly TabularColumn[] = ["titulo", "organizacion"];
export const LINK_COLUMNS: readonly TabularColumn[] = ["enlace_postulacion", "enlace_fuente"];

const KNOWN_COLUMNS = new Set<string>(TABULAR_COLUMNS);

/** "Fecha límite" → "fecha_limite". */
export function headerKey(header: string): string {
  return clean(header).replace(/ /g, "_");
}

/** Columna de la plantilla que corresponde a cada encabezado (`null` si no se reconoce). */
export function mapHeaders(headers: readonly string[]): (TabularColumn | null)[] {
  return headers.map((header) => {
    const key = headerKey(header);
    return KNOWN_COLUMNS.has(key) ? (key as TabularColumn) : null;
  });
}

export interface TabularRecord {
  /** Número de fila como se ve en la hoja de cálculo (la primera es la 1). */
  rowNumber: number;
  values: TabularRow;
}

export interface SheetRow {
  rowNumber: number;
  cells: readonly string[];
}

const isEmptyRow = (row: SheetRow) => row.cells.every((cell) => cell.trim() === "");

/**
 * Convierte filas de texto en registros por columna conocida. El encabezado es la primera fila con contenido;
 * las filas vacías se ignoran. `missingColumnsMessage` arma el error si faltan columnas obligatorias.
 */
export function toRecords(
  rows: readonly SheetRow[],
  missingColumnsMessage: (missing: readonly TabularColumn[]) => string,
): TabularRecord[] {
  const headerIndex = rows.findIndex((row) => !isEmptyRow(row));
  if (headerIndex === -1) return [];

  const columns = mapHeaders(rows[headerIndex].cells);
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) throw new Error(missingColumnsMessage(missing));

  const records: TabularRecord[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (isEmptyRow(row)) continue;
    const values: TabularRow = {};
    columns.forEach((column, i) => {
      const value = (row.cells[i] ?? "").trim();
      if (column && value) values[column] = value;
    });
    records.push({ rowNumber: row.rowNumber, values });
  }
  return records;
}

const text = (value: string | undefined): string | null => (value && value.trim() !== "" ? value : null);

/** Solo copia textos tal como vienen; interpretar es trabajo de `normalize/`. */
export function rowToDraft(row: TabularRow): OpportunityDraft {
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
}
